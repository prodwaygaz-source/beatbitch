const { del } = require('@vercel/blob');
const { sql, ensureSchema } = require('../lib/db');
const { requireAdmin } = require('../lib/auth');
const clean = b => {
  const ps = [...new Set((Array.isArray(b.producers) ? b.producers : []).map(x => String(x).trim()).filter(Boolean))];
  if (!b.title || !ps.length || !(Number(b.price) > 0)) return null;
  return { title: String(b.title), genre: b.genre || '', ps: JSON.stringify(ps), bpm: Number(b.bpm) || null, bkey: b.bkey || '', price: Number(b.price) };
};
const rmBlob = u => u && u.includes('blob.vercel-storage.com') ? del(u).catch(() => {}) : null;
module.exports = async (req, res) => {
  try {
    await ensureSchema();
    if (req.method === 'GET') return res.json(await sql`SELECT id,title,genre,producers,bpm,bkey,price::float AS price,cover,audio FROM beats ORDER BY id DESC`);
    if (!requireAdmin(req, res)) return;
    const id = Number(req.query.id), b = req.body || {};
    if (req.method === 'DELETE') {
      const [o] = await sql`DELETE FROM beats WHERE id=${id} RETURNING cover,audio`;
      if (o) { await rmBlob(o.cover); await rmBlob(o.audio); }
      return res.json({ ok: true });
    }
    const d = clean(b);
    if (!d) return res.status(400).json({ error: 'ข้อมูลไม่ครบ (ชื่อบีท / Producer / ราคา)' });
    if (req.method === 'POST') {
      const [r] = await sql`INSERT INTO beats(title,genre,producers,bpm,bkey,price,cover,audio) VALUES(${d.title},${d.genre},${d.ps}::jsonb,${d.bpm},${d.bkey},${d.price},${b.cover || ''},${b.audio || ''}) RETURNING id`;
      return res.json({ id: r.id });
    }
    if (req.method === 'PUT') {
      const [old] = await sql`SELECT cover,audio FROM beats WHERE id=${id}`;
      if (!old) return res.status(404).json({ error: 'ไม่พบบีท' });
      const cover = b.cover || old.cover, audio = b.audio || old.audio;
      await sql`UPDATE beats SET title=${d.title},genre=${d.genre},producers=${d.ps}::jsonb,bpm=${d.bpm},bkey=${d.bkey},price=${d.price},cover=${cover},audio=${audio} WHERE id=${id}`;
      if (b.cover) await rmBlob(old.cover); if (b.audio) await rmBlob(old.audio);
      return res.json({ ok: true });
    }
    res.status(405).end();
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};
