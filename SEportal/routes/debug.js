const express = require('express');
const router = express.Router();
let db;
try { db = require('../db'); } catch (e) { console.warn('⚠️ db 없음:', e.message); }

// 요청 로깅
router.use((req, res, next) => {
  console.log('[DEBUG][REQ]', req.method, req.originalUrl, { ip: req.ip, time: new Date().toISOString() });
  next();
});

// 현재 연결된 DB 정보 확인
router.get('/whoami', async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: 'db not available' });
    const [[info]] = await db.query('SELECT DATABASE() AS db, @@hostname AS host, NOW() AS now');
    res.json(info);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// 테스트 삽입 (POST JSON { actor, note })
router.post('/insert-test', async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: 'db not available' });
    await db.query(`
      CREATE TABLE IF NOT EXISTS debug_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        actor VARCHAR(64),
        note VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    const [r] = await db.execute(
      'INSERT INTO debug_events(actor, note) VALUES (?, ?)',
      [req.body.actor || 'tester', req.body.note || 'from debug']
    );
    console.log('[DEBUG][INSERT]', { affectedRows: r.affectedRows, insertId: r.insertId });
    res.json({ ok: true, insertId: r.insertId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// 최근 이벤트 조회
router.get('/events', async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: 'db not available' });
    const [rows] = await db.query('SELECT * FROM debug_events ORDER BY id DESC LIMIT 50');
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;