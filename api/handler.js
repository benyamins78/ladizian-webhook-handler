// This is the main function that receives the webhook from WooCommerce
export default async function handler(req, res) {
  // We only want to process POST requests, which is what webhooks are.
  // This prevents the code from running if someone just visits the URL in a browser.
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    // A mapping of your influencer coupon codes to their alert URLs.
    // IMPORTANT: You MUST replace these with your actual influencer data.
    // The coupon codes should be in ALL CAPS.
    const influencerMap = {
      "BEN111": "https://streamlabs.com/alert-box/v3/DFE4FDC83ACFB55A534BB4A58316F1AA55E27D5FEA349A05264B474DF1EB71D1B5FC1F7E504F671256DAF2E656757D805EECB48F1CCB553E994DF69D6ED0A42FF6D3E26E165E7B4BFEDD4DB6C33015EFB7FA8DD494EE7F7D61031212BC6A70D30B9ADBB507988916C95E28C9146F8FD000AB4DEA4788748DC710E4B624?merch=1",
      "GAMERGOD20": "https://streamlabs.com/api/v1.0/merchandise/alert?access_token=INFLUENCER2_TOKEN",
      "QUEENBEE": "https://streamlabs.com/api/v1.0/merchandise/alert?access_token=INFLUENCER3_TOKEN"
    };

    // The order data sent by WooCommerce is in the 'body' of the request.
    const orderData = req.body;

    // Check if there are any coupon codes in the order
    if (orderData.coupon_lines && orderData.coupon_lines.length > 0) {
      const couponUsed = orderData.coupon_lines[0].code.toUpperCase();

      // Find the matching influencer URL from our map
      const influencerAlertUrl = influencerMap[couponUsed];

      if (influencerAlertUrl) {
        // A coupon we care about was used! Let's build and send the alert.
        const customerName = orderData.billing.first_name || 'A supporter';
        const productName = orderData.line_items[0].name;
        const orderTotal = orderData.total;
        const currency = orderData.currency;

        const alertPayload = {
          // You can customize this message!
          message: `${customerName} just bought the ${productName} with your code!`,
          value: orderTotal,
          currency: currency
        };

        // Send the POST request to the influencer's Streamlabs URL
        await fetch(influencerAlertUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alertPayload)
        });

        console.log(`Alert sent for coupon: ${couponUsed}`);
      }
    }
  } catch (error) {
    // If anything goes wrong, we log the error for debugging.
    console.error('Error processing webhook:', error);
  }

  // ALWAYS respond with a 200 OK to let WooCommerce know we received the webhook successfully.
  res.status(200).send('OK');
}