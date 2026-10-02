const Stripe = require('stripe');
const { sql, ensureSchema } = require('../lib/db');
// หน้าร้านโพลล์ endpoint นี้ — พอจ่ายแล้วคืนลิงก์ดาวน์โหลดให้อัตโนมัติ
module.exports = async (req, res) => {
  try {
    await ensureSchema();
    const { id, token } = req.query;
    let [o] = await sql`SELECT * FROM orders WHERE id=${id} AND token=${token}`;
    if (!o) return res.status(404).json({ error: 'ไม่พบออเดอร์' });
    if (o.status === 'pending') { // กันกรณี webhook มาช้า: ถาม Stripe ตรง ๆ
      const pi = await new Stripe(process.env.STRIPE_SECRET_KEY).paymentIntents.retrieve(o.pi_id);
      if (pi.status === 'succeeded') { await sql`UPDATE orders SET status='paid',paid_at=now() WHERE id=${o.id} AND status='pending'`; o.status = 'paid'; }
      else if (pi.status === 'canceled') { await sql`UPDATE orders SET status='expired' WHERE id=${o.id}`; o.status = 'expired'; }
    }
    if (o.status !== 'paid') return res.json({ status: o.status });
    const downloads = await sql`SELECT title,audio FROM beats WHERE id IN (SELECT jsonb_array_elements_text(${JSON.stringify(o.beat_ids)}::jsonb)::int)`;
    res.json({ status: 'paid', downloads });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};
