const { sql, ensureSchema } = require('../lib/db');
const { requireAdmin } = require('../lib/auth');
module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try { await ensureSchema(); res.json(await sql`SELECT id,email,total::float AS total,status,created_at,paid_at FROM orders ORDER BY created_at DESC LIMIT 100`); }
  catch (e) { res.status(500).json({ error: e.message }); }
};
