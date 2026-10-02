const c = require('crypto');
const SECRET = () => process.env.SESSION_SECRET || '';
const b64 = s => Buffer.from(s).toString('base64url');
const sign = p => c.createHmac('sha256', SECRET()).update(p).digest('base64url');
exports.verifyPassword = (pw, stored) => {
  const [salt, hash] = stored.split(':');
  const a = Buffer.from(hash, 'hex'), b = c.scryptSync(pw, salt, 32);
  return a.length === b.length && c.timingSafeEqual(a, b);
};
exports.makeCookie = user => {
  const p = b64(JSON.stringify({ u: user, exp: Date.now() + 12 * 3600e3 }));
  return `sid=${p}.${sign(p)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`;
};
exports.clearCookie = 'sid=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0';
exports.getAdmin = req => {
  if (!SECRET()) return null;
  const m = /(?:^|;\s*)sid=([^;]+)/.exec(req.headers.cookie || '');
  if (!m) return null;
  const [p, s] = m[1].split('.');
  if (!p || !s || sign(p) !== s) return null;
  try { const d = JSON.parse(Buffer.from(p, 'base64url')); return d.exp > Date.now() ? d.u : null; } catch { return null; }
};
exports.requireAdmin = (req, res) => { const u = exports.getAdmin(req); if (!u) res.status(401).json({ error: 'Unauthorized' }); return u; };
exports.readRaw = async req => { const ch = []; for await (const x of req) ch.push(x); return Buffer.concat(ch); };
