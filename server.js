require('dotenv').config();
const express = require('express'), cors = require('cors'), multer = require('multer');
const path = require('path'), fs = require('fs'), sqlite3 = require('sqlite3').verbose();
const generatePayload = require('promptpay-qr'), QRCode = require('qrcode');

const DATA = path.resolve(process.env.DATA_DIR || __dirname);
const UP = path.join(DATA, 'uploads');
fs.mkdirSync(UP, { recursive: true });
const ADMIN = process.env.ADMIN_PASSWORD || '';
if (!ADMIN) console.warn('⚠️  ยังไม่ได้ตั้ง ADMIN_PASSWORD ใน .env — หน้าแอดมินจะใช้งานไม่ได้');

const db = new sqlite3.Database(path.join(DATA, 'store.db'));
const run = (s, p = []) => new Promise((ok, no) => db.run(s, p, function (e) { e ? no(e) : ok(this); }));
const all = (s, p = []) => new Promise((ok, no) => db.all(s, p, (e, r) => e ? no(e) : ok(r)));
const get = (s, p = []) => new Promise((ok, no) => db.get(s, p, (e, r) => e ? no(e) : ok(r)));

(async () => {
  await run(`CREATE TABLE IF NOT EXISTS beats(id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, genre TEXT,
    producers TEXT NOT NULL DEFAULT '[]', bpm INTEGER, bkey TEXT, price REAL NOT NULL, cover TEXT DEFAULT '', audio TEXT DEFAULT '')`);
  await run(`CREATE TABLE IF NOT EXISTS settings(k TEXT PRIMARY KEY, v TEXT)`);
  if (!(await get('SELECT id FROM beats LIMIT 1'))) {
    const seed = [['GHOST','drill',['PROD. ก้องเฟย์'],162,'D MIN',490],['NO SIGNAL','rage',['PROD. ปีศาจร้ายกัส'],150,'F MIN',490],
      ['AFTER DARK','trap',['PROD. กิมเค','PROD. ก้องเฟย์'],140,'C MIN',590]];
    for (const [t,g,p,b,k,pr] of seed) await run('INSERT INTO beats(title,genre,producers,bpm,bkey,price) VALUES(?,?,?,?,?,?)',[t,g,JSON.stringify(p),b,k,pr]);
  }
})();

const store = multer.diskStorage({
  destination: UP,
  filename: (q, f, cb) => cb(null, Date.now() + '-' + Math.random().toString(36).slice(2, 8) + path.extname(f.originalname).toLowerCase())
});
const upload = multer({ storage: store, limits: { fileSize: 80 * 1024 * 1024 },
  fileFilter: (q, f, cb) => cb(null, f.fieldname === 'audio' ? f.mimetype.startsWith('audio/') : f.mimetype.startsWith('image/')) })
  .fields([{ name: 'audio', maxCount: 1 }, { name: 'cover', maxCount: 1 }]);

const auth = (q, s, n) => ADMIN && q.get('x-admin-password') === ADMIN ? n() : s.status(401).json({ error: 'Unauthorized' });
const fmt = r => ({ ...r, producers: JSON.parse(r.producers || '[]') });
const parseP = v => { try { return [...new Set(JSON.parse(v).map(x => String(x).trim()).filter(Boolean))]; } catch { return []; } };
const rm = u => { if (u && u.startsWith('/uploads/')) fs.unlink(path.join(UP, path.basename(u)), () => {}); };
const fileUrl = (f, k) => f && f[k] ? '/uploads/' + f[k][0].filename : null;

const app = express();
app.use(cors()); app.use(express.json());
app.use('/uploads', express.static(UP));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/auth', auth, (q, s) => s.json({ ok: true }));
app.get('/api/beats', async (q, s, n) => { try { s.json((await all('SELECT * FROM beats ORDER BY id DESC')).map(fmt)); } catch (e) { n(e); } });

app.post('/api/beats', auth, upload, async (q, s, n) => {
  try {
    const b = q.body, ps = parseP(b.producers);
    if (!b.title || !ps.length || !(Number(b.price) > 0)) return s.status(400).json({ error: 'ข้อมูลไม่ครบ (ชื่อบีท / Producer / ราคา)' });
    const r = await run('INSERT INTO beats(title,genre,producers,bpm,bkey,price,cover,audio) VALUES(?,?,?,?,?,?,?,?)',
      [b.title, b.genre, JSON.stringify(ps), Number(b.bpm) || null, b.bkey || '', Number(b.price), fileUrl(q.files, 'cover') || '', fileUrl(q.files, 'audio') || '']);
    s.json({ id: r.lastID });
  } catch (e) { n(e); }
});

app.put('/api/beats/:id', auth, upload, async (q, s, n) => {
  try {
    const old = await get('SELECT * FROM beats WHERE id=?', [q.params.id]);
    if (!old) return s.status(404).json({ error: 'ไม่พบบีท' });
    const b = q.body, ps = parseP(b.producers);
    if (!b.title || !ps.length || !(Number(b.price) > 0)) return s.status(400).json({ error: 'ข้อมูลไม่ครบ' });
    const cover = fileUrl(q.files, 'cover'), audio = fileUrl(q.files, 'audio');
    if (cover) rm(old.cover); if (audio) rm(old.audio);
    await run('UPDATE beats SET title=?,genre=?,producers=?,bpm=?,bkey=?,price=?,cover=?,audio=? WHERE id=?',
      [b.title, b.genre, JSON.stringify(ps), Number(b.bpm) || null, b.bkey || '', Number(b.price), cover || old.cover, audio || old.audio, old.id]);
    s.json({ ok: true });
  } catch (e) { n(e); }
});

app.delete('/api/beats/:id', auth, async (q, s, n) => {
  try {
    const old = await get('SELECT * FROM beats WHERE id=?', [q.params.id]);
    if (old) { rm(old.cover); rm(old.audio); await run('DELETE FROM beats WHERE id=?', [old.id]); }
    s.json({ ok: true });
  } catch (e) { n(e); }
});

const getSettings = async () => Object.fromEntries((await all('SELECT k,v FROM settings')).map(r => [r.k, r.v]));
app.get('/api/settings', auth, async (q, s, n) => { try { s.json(await getSettings()); } catch (e) { n(e); } });
app.put('/api/settings', auth, async (q, s, n) => {
  try {
    for (const k of ['number', 'name']) await run('INSERT INTO settings(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v', [k, String(q.body[k] || '').trim()]);
    s.json({ ok: true });
  } catch (e) { n(e); }
});

// สร้าง Dynamic PromptPay QR — คำนวณยอดรวมจากราคาใน DB (ไม่เชื่อราคาจาก client)
app.post('/api/qr', async (q, s, n) => {
  try {
    const ids = (Array.isArray(q.body.ids) ? q.body.ids : []).map(Number).filter(Boolean);
    if (!ids.length) return s.status(400).json({ error: 'ตะกร้าว่าง' });
    const rows = await all(`SELECT price FROM beats WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
    const total = rows.reduce((a, r) => a + r.price, 0);
    const st = await getSettings();
    if (!st.number) return s.status(400).json({ error: 'ร้านยังไม่ได้ตั้งค่าเลขพร้อมเพย์' });
    const payload = generatePayload(st.number.replace(/[^0-9]/g, ''), { amount: total });
    s.json({ total, number: st.number, name: st.name || '', qr: await QRCode.toDataURL(payload, { width: 400, margin: 2 }) });
  } catch (e) { n(e); }
});

app.use((e, q, s, n) => { console.error(e); s.status(500).json({ error: e.message || 'Server error' }); });
app.listen(process.env.PORT || 3000, () => console.log('Beat Store running on port ' + (process.env.PORT || 3000)));
