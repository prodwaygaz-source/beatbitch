const Stripe = require('stripe');
const { sql, ensureSchema } = require('../lib/db');
const { readRaw } = require('../lib/auth');
// อย่าแตะ req.body ก่อนอ่าน raw — Stripe ต้องใช้ raw body ตรวจลายเซ็น
module.exports = async (req, res) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  let ev;
  try { ev = stripe.webhooks.constructEvent(await readRaw(req), req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET); }
  catch (e) { return res.status(400).send('Bad signature'); }
  try {
    await ensureSchema();
    const pi = ev.data.object;
    if (ev.type === 'payment_intent.succeeded') await sql`UPDATE orders SET status='paid',paid_at=now() WHERE pi_id=${pi.id} AND status<>'paid'`;
    if (ev.type === 'payment_intent.canceled' || ev.type === 'payment_intent.payment_failed') await sql`UPDATE orders SET status='expired' WHERE pi_id=${pi.id} AND status='pending'`;
    res.json({ received: true });
  } catch (e) { console.error(e); res.status(500).end(); }
};
