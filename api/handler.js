// This is the new "perfected" handler function.
export default async function handler(req, res) {
  // We're adding a basic GET response for our cron job to hit.
  if (req.method === 'GET') {
    return res.status(200).send('Ladizian webhook handler is warm and ready.');
  }

  // The rest of the logic is for the POST webhook from WooCommerce.
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    // 1. Fetch the influencer data from our Google Sheet.
    // process.env.GOOGLE_SHEET_URL is a secure environment variable.
    const response = await fetch(process.env.GOOGLE_SHEET_URL);
    if (!response.ok) {
      throw new Error('Failed to fetch influencer sheet');
    }
    const csvData = await response.text();
    const rows = csvData.split('\n').map(row => row.split(','));

    // 2. Create the influencer map dynamically from the sheet data.
    const influencerMap = new Map();
    // Start from the second row to skip the header
    for (let i = 1; i < rows.length; i++) {
      const couponCode = rows[i][0]?.trim().toUpperCase();
      const streamlabsUrl = rows[i][1]?.trim();
      if (couponCode && streamlabsUrl) {
        influencerMap.set(couponCode, streamlabsUrl);
      }
    }

    // 3. Process the WooCommerce order (this part is the same as before).
    const orderData = req.body;
    if (orderData.coupon_lines && orderData.coupon_lines.length > 0) {
      const couponUsed = orderData.coupon_lines[0].code.toUpperCase();
      const influencerAlertUrl = influencerMap.get(couponUsed);

      if (influencerAlertUrl) {
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