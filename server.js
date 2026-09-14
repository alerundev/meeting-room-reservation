const express = require('express');
const cors = require('cors');
const path = require('path');
const { pool, query, initDb } = require('./src/db');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/healthz', async (req, res) => {
  try {
    await query('SELECT 1');
    res.status(200).json({ status: 'ok', uptime: process.uptime(), db: 'connected' });
  } catch (err) {
    res.status(200).json({ status: 'ok', uptime: process.uptime(), db: 'disconnected', error: err.message });
  }
});

// API Routes

// 1. GET /api/rooms : 회의실 목록 조회
app.get('/api/rooms', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, name, capacity, location, description, created_at FROM rooms ORDER BY id ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching rooms:', err);
    res.status(500).json({ error: '회의실 목록을 가져오는 중 오류가 발생했습니다.' });
  }
});

// 2. POST /api/rooms : 회의실 추가
app.post('/api/rooms', async (req, res) => {
  const { name, capacity, location, description } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: '회의실 이름을 입력해주세요.' });
  }

  const parsedCapacity = parseInt(capacity, 10);
  if (isNaN(parsedCapacity) || parsedCapacity <= 0) {
    return res.status(400).json({ error: '수용 인원은 1명 이상의 정수여야 합니다.' });
  }

  if (!location || !location.trim()) {
    return res.status(400).json({ error: '회의실 위치를 입력해주세요.' });
  }

  try {
    const result = await query(
      `INSERT INTO rooms (name, capacity, location, description)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, capacity, location, description, created_at`,
      [name.trim(), parsedCapacity, location.trim(), description ? description.trim() : '']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating room:', err);
    res.status(500).json({ error: '회의실 생성 중 오류가 발생했습니다.' });
  }
});

// 3. GET /api/reservations : 예약 목록 조회 (date, room_id 필터링 지원)
app.get('/api/reservations', async (req, res) => {
  const { date, room_id } = req.query;

  try {
    let sql = `
      SELECT 
        r.id,
        r.room_id,
        rm.name AS room_name,
        rm.location AS room_location,
        rm.capacity AS room_capacity,
        r.title,
        r.reserver_name,
        r.start_time,
        r.end_time,
        r.memo,
        r.created_at
      FROM reservations r
      JOIN rooms rm ON r.room_id = rm.id
      WHERE 1=1
    `;
    const params = [];

    if (room_id) {
      params.push(parseInt(room_id, 10));
      sql += ` AND r.room_id = $${params.length}`;
    }

    if (date) {
      // date formatted as YYYY-MM-DD
      // Match reservations that overlap with this date
      params.push(`${date} 00:00:00`);
      params.push(`${date} 23:59:59`);
      sql += ` AND (r.start_time <= $${params.length} AND r.end_time >= $${params.length - 1})`;
    }

    sql += ' ORDER BY r.start_time ASC';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching reservations:', err);
    res.status(500).json({ error: '예약 목록을 가져오는 중 오류가 발생했습니다.' });
  }
});

// 4. POST /api/reservations : 예약 생성 (중복 시간 예약 방지 필수)
app.post('/api/reservations', async (req, res) => {
  const { room_id, title, reserver_name, start_time, end_time, memo } = req.body;

  if (!room_id) {
    return res.status(400).json({ error: '회의실을 선택해주세요.' });
  }
  if (!title || !title.trim()) {
    return res.status(400).json({ error: '예약 제목을 입력해주세요.' });
  }
  if (!reserver_name || !reserver_name.trim()) {
    return res.status(400).json({ error: '예약자명을 입력해주세요.' });
  }
  if (!start_time || !end_time) {
    return res.status(400).json({ error: '시작 시간과 종료 시간을 모두 입력해주세요.' });
  }

  const startDate = new Date(start_time);
  const endDate = new Date(end_time);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return res.status(400).json({ error: '올바른 날짜/시간 형식이 아닙니다.' });
  }

  if (endDate <= startDate) {
    return res.status(400).json({ error: '종료 시간은 시작 시간보다 이후여야 합니다.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if room exists
    const roomCheck = await client.query('SELECT id, name FROM rooms WHERE id = $1', [room_id]);
    if (roomCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: '존재하지 않는 회의실입니다.' });
    }

    // Check for overlapping reservations:
    // Two intervals [A, B] and [C, D] overlap if and only if A < D and B > C
    const overlapQuery = `
      SELECT id, title, reserver_name, start_time, end_time
      FROM reservations
      WHERE room_id = $1
        AND start_time < $3
        AND end_time > $2
      FOR UPDATE
    `;

    const overlapResult = await client.query(overlapQuery, [
      room_id,
      startDate.toISOString(),
      endDate.toISOString(),
    ]);

    if (overlapResult.rows.length > 0) {
      await client.query('ROLLBACK');
      const conflict = overlapResult.rows[0];
      const conflictStart = new Date(conflict.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      const conflictEnd = new Date(conflict.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      return res.status(409).json({
        error: `이미 해당 시간대에 예약이 있습니다. (${conflict.title} - ${conflict.reserver_name}, ${conflictStart} ~ ${conflictEnd})`,
        conflict: conflict
      });
    }

    // Insert new reservation
    const insertQuery = `
      INSERT INTO reservations (room_id, title, reserver_name, start_time, end_time, memo)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, room_id, title, reserver_name, start_time, end_time, memo, created_at
    `;

    const insertResult = await client.query(insertQuery, [
      room_id,
      title.trim(),
      reserver_name.trim(),
      startDate.toISOString(),
      endDate.toISOString(),
      memo ? memo.trim() : '',
    ]);

    await client.query('COMMIT');
    res.status(201).json(insertResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating reservation:', err);
    res.status(500).json({ error: '예약 처리 중 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
});

// 5. DELETE /api/reservations/:id : 예약 취소/삭제
app.delete('/api/reservations/:id', async (req, res) => {
  const { id } = req.params;
  const reservationId = parseInt(id, 10);

  if (isNaN(reservationId)) {
    return res.status(400).json({ error: '유효하지 않은 예약 ID입니다.' });
  }

  try {
    const result = await query(
      'DELETE FROM reservations WHERE id = $1 RETURNING id, title, reserver_name',
      [reservationId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: '해당 예약을 찾을 수 없습니다.' });
    }

    res.json({ message: '예약이 성공적으로 취소되었습니다.', reservation: result.rows[0] });
  } catch (err) {
    console.error('Error deleting reservation:', err);
    res.status(500).json({ error: '예약 취소 중 서버 오류가 발생했습니다.' });
  }
});

// Fallback to index.html for SPA-like navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Server Initialization
async function startServer() {
  try {
    console.log('Connecting to PostgreSQL database...');
    await initDb();
    console.log('PostgreSQL connected and schema ready.');
  } catch (err) {
    console.warn('PostgreSQL initialization warning (will retry on incoming requests if DB starts up later):', err.message);
  }

  app.listen(PORT, () => {
    console.log(`Meeting Room Reservation Server is running on http://localhost:${PORT}`);
  });
}

startServer();
