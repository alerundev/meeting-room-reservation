const path = require('node:path');
const express = require('express');
const { Pool } = require('pg');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  if (require.main === module) {
    console.error('DATABASE_URL 환경변수가 필요합니다.');
    process.exit(1);
  }
}

const pool = DATABASE_URL ? new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined
}) : null;

const INITIAL_ROOMS = [
  ['라운지 A', '최대 6명 · 화상회의 가능', 6],
  ['라운지 B', '최대 10명 · 대형 모니터', 10],
  ['대회의실', '최대 20명 · 화상회의 장비', 20]
];

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('CREATE EXTENSION IF NOT EXISTS btree_gist');
    await client.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL DEFAULT '',
        capacity INTEGER NOT NULL CHECK (capacity > 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS reservations (
        id SERIAL PRIMARY KEY,
        room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        reserver_name TEXT NOT NULL CHECK (char_length(trim(reserver_name)) BETWEEN 1 AND 100),
        email TEXT NOT NULL CHECK (char_length(trim(email)) BETWEEN 3 AND 254),
        start_at TIMESTAMPTZ NOT NULL,
        end_at TIMESTAMPTZ NOT NULL,
        title TEXT NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 200),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CHECK (end_at > start_at)
      )
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE reservations ADD CONSTRAINT reservations_no_overlap
          EXCLUDE USING gist (room_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    for (const [name, description, capacity] of INITIAL_ROOMS) {
      await client.query(
        'INSERT INTO rooms (name, description, capacity) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING',
        [name, description, capacity]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function isValidDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function validateReservation(body) {
  const required = ['roomId', 'reserverName', 'email', 'startAt', 'endAt', 'title'];
  const missing = required.filter((key) => body[key] === undefined || body[key] === null || String(body[key]).trim() === '');
  if (missing.length) return `필수 항목을 입력해 주세요: ${missing.join(', ')}`;
  if (!Number.isInteger(Number(body.roomId))) return '회의실을 선택해 주세요.';
  if (!isValidDate(body.startAt) || !isValidDate(body.endAt)) return '시작일시와 종료일시를 올바르게 입력해 주세요.';
  if (new Date(body.endAt) <= new Date(body.startAt)) return '종료일시는 시작일시보다 늦어야 합니다.';
  if (!/^\S+@\S+\.\S+$/.test(String(body.email).trim())) return '올바른 이메일을 입력해 주세요.';
  return null;
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/rooms', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id, name, description, capacity FROM rooms ORDER BY id');
    res.json(rows);
  } catch (error) { next(error); }
});

app.get('/api/reservations', async (req, res, next) => {
  try {
    const params = [];
    let where = '';
    if (req.query.date) {
      params.push(req.query.date);
      where = 'WHERE r.start_at < ($1::date + INTERVAL \'1 day\') AND r.end_at > $1::date';
    }
    const { rows } = await pool.query(`
      SELECT r.id, r.room_id AS "roomId", rm.name AS "roomName", r.reserver_name AS "reserverName",
        r.email, r.start_at AS "startAt", r.end_at AS "endAt", r.title
      FROM reservations r JOIN rooms rm ON rm.id = r.room_id ${where}
      ORDER BY r.start_at, rm.id
    `, params);
    res.json(rows);
  } catch (error) { next(error); }
});

app.post('/api/reservations', async (req, res, next) => {
  const validationError = validateReservation(req.body);
  if (validationError) return res.status(400).json({ error: validationError });
  try {
    const { roomId, reserverName, email, startAt, endAt, title } = req.body;
    const { rows } = await pool.query(`
      INSERT INTO reservations (room_id, reserver_name, email, start_at, end_at, title)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, room_id AS "roomId", reserver_name AS "reserverName", email, start_at AS "startAt", end_at AS "endAt", title
    `, [roomId, String(reserverName).trim(), String(email).trim(), startAt, endAt, String(title).trim()]);
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === '23P01') return res.status(409).json({ error: '해당 회의실에 같은 시간대의 예약이 이미 있습니다.' });
    if (error.code === '23503') return res.status(400).json({ error: '존재하지 않는 회의실입니다.' });
    next(error);
  }
});

app.delete('/api/reservations/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM reservations WHERE id = $1', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: '예약을 찾을 수 없습니다.' });
    res.status(204).end();
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

async function start() {
  await initializeDatabase();
  app.listen(PORT, '0.0.0.0', () => console.log(`회의실 예약시스템이 0.0.0.0:${PORT}에서 실행 중입니다.`));
}

if (require.main === module) start().catch((error) => { console.error('시작 실패:', error); process.exit(1); });

module.exports = { app, validateReservation };