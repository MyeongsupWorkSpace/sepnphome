const express = require('express');
const router = express.Router();
const db = require('../db');

// 편성 목록 조회
router.get('/', async (req, res) => {
  try {
    const { date } = req.query;
    
    let query = 'SELECT * FROM worker_assignments';
    let params = [];
    
    if (date) {
      query += ' WHERE date = ?';
      params.push(date);
    }
    
    query += ' ORDER BY date DESC, created_at DESC';
    
    const [rows] = await db.query(query, params);
    
    const assignments = rows.map(a => ({
      ...a,
      workers: typeof a.workers === 'string' 
        ? JSON.parse(a.workers) 
        : a.workers
    }));
    
    res.json(assignments);
  } catch (error) {
    console.error('  ❌ 편성 조회 오류:', error);
    res.status(500).json({ error: '서버 오류' });
  }
});

// 편성 등록
router.post('/', async (req, res) => {
  try {
    const { 
      date, process, processPerm, machine, 
      team, shift, start, end, workers, 
      createdBy, createdByName 
    } = req.body;
    
    const workersJson = JSON.stringify(workers);
    
    await db.query(
      `INSERT INTO worker_assignments 
       (date, process, process_perm, machine, team, shift, 
        start_time, end_time, workers, created_by, created_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [date, process, processPerm, machine, team, shift, 
       start, end, workersJson, createdBy, createdByName]
    );
    
    console.log(`  ✅ 편성 등록: ${process} ${machine} (${date})`);
    res.json({ ok: true });
    
  } catch (error) {
    console.error('  ❌ 편성 등록 오류:', error);
    res.status(500).json({ ok: false, error: '저장 실패' });
  }
});

// 편성 수정
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { machine, date, team, shift, start, end, workers } = req.body;
    
    const workersJson = JSON.stringify(workers);
    
    await db.query(
      `UPDATE worker_assignments SET 
        machine = ?, date = ?, team = ?, shift = ?, 
        start_time = ?, end_time = ?, workers = ?
       WHERE id = ?`,
      [machine, date, team, shift, start, end, workersJson, id]
    );
    
    console.log(`  ✅ 편성 수정: ID ${id}`);
    res.json({ ok: true });
    
  } catch (error) {
    console.error('  ❌ 편성 수정 오류:', error);
    res.status(500).json({ ok: false, error: '수정 실패' });
  }
});

// 편성 삭제
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM worker_assignments WHERE id = ?', [id]);
    
    console.log(`  ✅ 편성 삭제: ID ${id}`);
    res.json({ ok: true });
    
  } catch (error) {
    console.error('  ❌ 편성 삭제 오류:', error);
    res.status(500).json({ ok: false, error: '삭제 실패' });
  }
});

module.exports = router;