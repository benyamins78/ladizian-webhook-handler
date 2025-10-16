import crypto from 'crypto';

// This new config tells Vercel to give us the raw, unparsed request body,
// which is required for the security check to work correctly.
export const config = {
  api: {
    bodyParser: false,
  },
};

// A helper function to read the raw body from the request.
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', (err) => reject(err));
  });
}

// This is the main handler function, now with a security check.
export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).send('Ladizian webhook handler is warm and ready.');
  }

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  // --- NEW SECURITY CHECK ---
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
  // --- END SECURITY CHECK ---

  try {
    // We now parse the body ourselves, since we disabled the default parser.
    const orderData = JSON.parse(rawBody.toString());

    // The rest of the logic is exactly the same!
    const response = await fetch(process.env.GOOGLE_SHEET_URL);
    if (!response.ok) throw new Error('Failed to fetch influencer sheet');
    
    const csvData = await response.text();
    const rows = csvData.split('\n').map(row => row.split(','));

    const influencerMap = new Map();
    for (let i = 1; i < rows.length; i++) {
      const couponCode = rows[i][0]?.trim().toUpperCase();
      const streamlabsUrl = rows[i][1]?.trim();
      if (couponCode && streamlabsUrl) {
        influencerMap.set(couponCode, streamlabsUrl);
      }
    }

    if (orderData.coupon_lines && orderData.coupon_lines.length > 0) {
      const couponUsed = orderData.coupon_lines[0].code.toUpperCase();
      const influencerAlertUrl = influencerMap.get(couponUsed);

      if (influencerAlertUrl) {
        // ... (The alert sending logic is unchanged)
        const customerName = orderData.billing.first_name || 'A supporter';
        const productName = orderData.line_items[0].name;
        const orderTotal = orderData.total;
        const currency = orderData.currency;

        const alertPayload = {
          message: `${customerName} just bought the ${productName} with your code!`,
          value: orderTotal,
          currency: currency,
        };

        await fetch(influencerAlertUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alertPayload),
        });

        console.log(`Alert sent for coupon: ${couponUsed}`);
      }
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
  }

  res.status(200).send('OK');
}