const { Pool } = require('pg');
require('dotenv').config();

// Construct database configuration using specific env vars or fallback URL
let poolConfig;
if (process.env.DATABASE_URL) {
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  };
} else {
  poolConfig = {
    host: process.env.DB_HOST || 'postgres-db',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'meeting_rooms',
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  };
}

const pool = new Pool(poolConfig);

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

    // Check if rooms table is empty, and seed exactly 3 default rooms
    const { rows } = await client.query('SELECT COUNT(*) AS count FROM rooms');
    if (parseInt(rows[0].count, 10) === 0) {
      console.log('Seeding initial 3 meeting rooms...');
      const seedRooms = [
        ['회의실 A (창의룸)', 6, '본관 3층 동편', '소규모 브레인스토밍 및 화상회의 최적화 (모니터, 화상카메라 구비)'],
        ['회의실 B (협업룸)', 8, '본관 3층 서편', '부서간 협업 및 주간 업무 미팅용 (대형 화이트보드 구비)'],
        ['회의실 C (비전룸)', 4, '본관 4층', '집중 인터뷰 및 1:1 면담용 방음 룸']
      ];

      for (const room of seedRooms) {
        await client.query(
          'INSERT INTO rooms (name, capacity, location, description) VALUES ($1, $2, $3, $4)',
          room
        );
      }
      console.log('Initial 3 meeting rooms seeded successfully.');
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
