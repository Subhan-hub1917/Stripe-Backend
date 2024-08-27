import express from 'express';
const app = express();
import cors from 'cors';
import { config } from 'dotenv';
import stripePackage from 'stripe';

config({
  path: './config/config.env'
});

console.log('Stripe Secret Key:', process.env.STRIPE_SECRET_KEY); 
console.log('Stripe Webhook Secret:', process.env.STRIPE_WEBHOOK_SECRET); 

const str = stripePackage(process.env.STRIPE_SECRET_KEY);

// Use cors middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
}));

// Webhook route must come before the express.json() middleware
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Use the raw body for constructing the event
    event = str.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    try {
      const customer = session.customer ? await str.customers.retrieve(session.customer) : null;
      const invoice = session.invoice ? await str.invoices.retrieve(session.invoice) : null;
      console.log(customer)
      const customerEmail = customer ? customer.email : null;
      const customerName = customer ? customer.name : null;
      const totalAmount = session.amount_total / 100;
      const paymentStatus = session.payment_status;
      const invoiceUrl = invoice ? invoice.hosted_invoice_url : null;

      await handleCheckoutSessionCompleted({
        sessionId: session.id,
        customerEmail,
        customerName,
        totalAmount,
        paymentStatus,
        invoiceUrl,
      });
    } catch (error) {
      console.error(`Error handling checkout session: ${error.message}`);
      res.status(500).send(`Server Error: ${error.message}`);
      return;
    }
  }

  res.json({ received: true });
});

// Only use express.json() after the webhook route
app.use(express.json());

app.post('/checkout-session', async (req, res) => {
  const { products } = req.body;
  const lineItems = products.map((product) => ({
    price_data: {
      currency: "usd",
      product_data: {
        name: product.name,
        images: [product.image]
      },
      unit_amount: Math.round(product.price * 100)
    },
    quantity: product.quantity
  }));

  try {
    const session = await str.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: "https://stripe-cart-ten.vercel.app/success",
      cancel_url: "https://stripe-cart-ten.vercel.app/cancel"
    });
    res.json({ id: session.id });
  } catch (error) {
    res.status(500).send(`Error creating session: ${error.message}`);
  }
});

async function handleCheckoutSessionCompleted({ sessionId, customerEmail, customerName, totalAmount, paymentStatus, invoiceUrl }) {
  console.log(`Session ID: ${sessionId}`);
  console.log(`Customer Email: ${customerEmail}`);
  console.log(`Customer Name: ${customerName}`);
  console.log(`Total Amount: $${totalAmount}`);
  console.log(`Payment Status: ${paymentStatus}`);
  console.log(`Invoice URL: ${invoiceUrl}`);
}

export default app;
