const express = require('express');
const db = require('../db');

// 거래처 테이블 자동 생성
(async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id VARCHAR(50) PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(200) NOT NULL,
        category ENUM('매출처', '매입처', '양방') DEFAULT '매출처',
        ceo VARCHAR(100),
        business_no VARCHAR(20),
        tel VARCHAR(20),
        fax VARCHAR(20),
        email VARCHAR(100),
        address TEXT,
        note TEXT,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_code (code),
        INDEX idx_category (category),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✅ 거래처 테이블 준비 완료');
  } catch (error) {
    console.error('  ❌ 거래처 테이블 생성 오류:', error);
  }
})();

module.exports = (pool) => {
  const r = express.Router();

  // 고객 생성
  r.post('/', async (req, res, next) => {
    try {
      const name = (req.body?.name || '').trim();
      if (!name) return res.status(400).json({ message: 'name required' });
      await pool.execute('INSERT INTO customers(name) VALUES(?)', [name]);
      res.status(201).json({ name });
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'duplicate' });
      next(e);
    }
  });

  // 고객 목록
  r.get('/', async (req, res, next) => {
    try {
      const q = (req.query.q || '').trim();
      const like = `%${q}%`;
      const [rows] = await pool.execute(
        'SELECT id,name,created_at FROM customers WHERE name LIKE ? ORDER BY name LIMIT 50',
        [like]
      );
      res.json(rows);
    } catch (e) { next(e); }
  });

  return r;
};