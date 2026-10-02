const { sql, ensureSchema } = require('../lib/db');
const { verifyPassword, makeCookie, clearCookie, getAdmin } = require('../lib/auth');
module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') return res.json({ user: getAdmin(req) });
    if (req.method === 'DELETE') { res.setHeader('Set-Cookie', clearCookie); return res.json({ ok: true }); }
    if (req.method !== 'POST') return res.status(405).end();
    if (!process.env.SESSION_SECRET) return res.status(500).json({ error: 'ยังไม่ได้ตั้ง SESSION_SECRET' });
    await ensureSchema();
    const { username = '', password = '' } = req.body || {};
    const [a] = await sql`SELECT hash FROM admins WHERE username=${String(username).trim().toLowerCase()}`;
    if (!a || !verifyPassword(String(password), a.hash)) {
      await new Promise(r => setTimeout(r, 800));
      return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }
    res.setHeader('Set-Cookie', makeCookie(String(username).trim().toLowerCase()));
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};
