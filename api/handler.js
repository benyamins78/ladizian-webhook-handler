import crypto from 'crypto';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', (err) => reject(err));
  });
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).send('Ladizian webhook handler is warm and ready.');
  }

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const rawBody = await getRawBody(req);
  const signature = req.headers['x-wc-webhook-signature'];
  const secret = process.env.WOOCOMMERCE_SECRET;

  if (!secret) {
    console.error('Webhook secret is not configured.');
    return res.status(500).send('Internal Server Error');
  }

  const computedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');

  if (computedSignature !== signature) {
    console.warn('Invalid webhook signature received.');
    return res.status(401).send('Unauthorized');
  }

  try {
    const orderData = JSON.parse(rawBody.toString());

    const response = await fetch(process.env.GOOGLE_SHEET_URL);
    if (!response.ok) throw new Error('Failed to fetch influencer sheet');
    
    const csvData = await response.text();
    const rows = csvData.split('\n').map(row => row.split(','));

    const influencerMap = new Map();
    // Start from row 1 to skip header. We now join all subsequent columns
    // in case a URL itself contains a comma (less likely but safe).
    for (let i = 1; i < rows.length; i++) {
        const couponCode = rows[i][0]?.trim().toUpperCase();
        // The URLs are in the second column (index 1)
        const alertUrls = rows[i][1]?.trim();
        if (couponCode && alertUrls) {
            influencerMap.set(couponCode, alertUrls);
        }
    }

    if (orderData.coupon_lines && orderData.coupon_lines.length > 0) {
      const couponUsed = orderData.coupon_lines[0].code.toUpperCase();
      const urlString = influencerMap.get(couponUsed);

      // --- NEW MULTI-PLATFORM LOGIC ---
      if (urlString) {
        const customerName = orderData.billing.first_name || 'A supporter';
        const productName = orderData.line_items[0].name;
        const orderTotal = orderData.total;
        const currency = orderData.currency;

        // Build the alert payload ONCE.
        const alertPayload = {
          message: `${customerName} just bought the ${productName} with your code!`,
          value: orderTotal,
          currency: currency,
        };

        // Split the string of URLs by the comma into an array.
        const urls = urlString.split(',');

        // Use Promise.all to send all alerts in parallel for maximum speed.
        await Promise.all(
          urls.map(url => fetch(url.trim(), { // .trim() is added for safety
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(alertPayload),
          }))
        );

        console.log(`Alerts sent for coupon: ${couponUsed} to URLs: ${urls.join(', ')}`);
      }
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
  }

  res.status(200).send('OK');
}