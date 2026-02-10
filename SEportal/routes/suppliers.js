const express = require('express');

module.exports = (pool) => {
  const r = express.Router();

  // 생성
  r.post('/', async (req, res, next) => {
    try {
      const name = (req.body?.name || '').trim();
      if (!name) return res.status(400).json({ message: 'name required' });
      await pool.execute('INSERT INTO suppliers(name) VALUES(?)', [name]);
      res.status(201).json({ name });
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'duplicate' });
      next(e);
    }
  });

  // 조회
  r.get('/', async (req, res, next) => {
    try {
      const q = (req.query.q || '').trim();
      const like = `%${q}%`;
      const [rows] = await pool.execute(
        'SELECT id,name,created_at FROM suppliers WHERE name LIKE ? ORDER BY name LIMIT 50',
        [like]
      );
      res.json(rows);
    } catch (e) { next(e); }
  });

  return { handle: r };
};