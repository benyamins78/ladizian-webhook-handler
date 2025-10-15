// This is the main function that Vercel will run.
// It receives a request (req) and sends back a response (res).
export default function handler(req, res) {
  
  // We're setting the status code to 200, which means "OK".
  // Then we send back a simple JSON message.
  res.status(200).json({ 
    message: "Hello from your Ladizian API!" 
  });

}