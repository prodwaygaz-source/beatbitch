const { neon } = require('@neondatabase/serverless');
const seed = require('./admins.seed.json');
const sql = neon(process.env.DATABASE_URL);
let ready;
function ensureSchema() {
  return (ready ||= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS beats(id SERIAL PRIMARY KEY, title TEXT NOT NULL, genre TEXT, producers JSONB NOT NULL DEFAULT '[]', bpm INT, bkey TEXT, price NUMERIC NOT NULL, cover TEXT DEFAULT '', audio TEXT DEFAULT '')`;
    await sql`CREATE TABLE IF NOT EXISTS admins(username TEXT PRIMARY KEY, hash TEXT NOT NULL)`;
    await sql`CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY, token TEXT NOT NULL, email TEXT, beat_ids JSONB NOT NULL, total NUMERIC NOT NULL, pi_id TEXT UNIQUE, status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ DEFAULT now(), paid_at TIMESTAMPTZ)`;
    for (const a of seed) await sql`INSERT INTO admins(username,hash) VALUES(${a.username},${a.hash}) ON CONFLICT DO NOTHING`;
  })().catch(e => { ready = null; throw e; }));
}
module.exports = { sql, ensureSchema };
