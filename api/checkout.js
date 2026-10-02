const Stripe = require('stripe');
const crypto = require('crypto');
const { sql, ensureSchema } = require('../lib/db');
// สร้างออเดอร์ + Dynamic PromptPay QR (ยอดคำนวณจากราคาใน DB เสมอ)
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    await ensureSchema();
    const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).map(Number).filter(Boolean))];
    const email = String(req.body?.email || '').trim();
    if (!ids.length) return res.status(400).json({ error: 'ตะกร้าว่าง' });
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'กรุณากรอกอีเมลให้ถูกต้อง' });
    const rows = await sql`SELECT id,price::float AS price FROM beats WHERE id = ANY(${ids})`;
    if (!rows.length) return res.status(400).json({ error: 'ไม่พบสินค้า' });
    const total = rows.reduce((a, r) => a + r.price, 0);
    const orderId = crypto.randomBytes(6).toString('hex'), token = crypto.randomBytes(16).toString('hex');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const pi = await stripe.paymentIntents.create({
      amount: Math.round(total * 100), currency: 'thb',
      payment_method_types: ['promptpay'],
      payment_method_data: { type: 'promptpay', billing_details: { email } },
      confirm: true, receipt_email: email, metadata: { orderId }
    });
    const qr = pi.next_action?.promptpay_display_qr_code;
    if (!qr) throw new Error('สร้าง QR ไม่สำเร็จ (ตรวจสอบว่าเปิด PromptPay ใน Stripe แล้ว)');
    await sql`INSERT INTO orders(id,token,email,beat_ids,total,pi_id) VALUES(${orderId},${token},${email},${JSON.stringify(rows.map(r => r.id))}::jsonb,${total},${pi.id})`;
    res.json({ orderId, token, total, qr: qr.image_url_png });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};
