const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/meeting_rooms';

const pool = new Pool({
  connectionString,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create rooms table
    await client.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        capacity INT NOT NULL DEFAULT 4,
        location VARCHAR(100) NOT NULL,
        description TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create reservations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS reservations (
        id SERIAL PRIMARY KEY,
        room_id INT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        reserver_name VARCHAR(100) NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        memo TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT valid_time_range CHECK (end_time > start_time)
      );
    `);

    // Check if rooms table is empty, and seed default rooms
    const { rows } = await client.query('SELECT COUNT(*) AS count FROM rooms');
    if (parseInt(rows[0].count, 10) === 0) {
      console.log('Seeding initial meeting rooms...');
      const seedRooms = [
        ['회의실 A (창의룸)', 6, '본관 3층 동편', '소규모 브레인스토밍 및 화상회의 최적화 (모니터, 화상카메라 구비)'],
        ['회의실 B (협업룸)', 8, '본관 3층 서편', '부서간 협업 및 주간 업무 미팅용 (대형 화이트보드 구비)'],
        ['회의실 C (비전룸)', 4, '본관 4층', '집중 인터뷰 및 1:1 면담용 방음 룸'],
        ['대회의실 (그랜드홀)', 20, '본관 5층 중앙', '전사 타운홀 미팅 및 대규모 세미나용 (빔프로젝터, 듀얼마이크 구비)'],
        ['소회의실 (아이디어룸)', 4, '본관 2층', '신속한 데일리 스크럼 및 미니 회의 공간']
      ];

      for (const room of seedRooms) {
        await client.query(
          'INSERT INTO rooms (name, capacity, location, description) VALUES ($1, $2, $3, $4)',
          room
        );
      }
      console.log('Initial meeting rooms seeded successfully.');
    }

    await client.query('COMMIT');
    console.log('Database tables verified and initialized.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to initialize database tables:', err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  initDb,
};
