const express = require('express');

module.exports = (pool) => {
  const r = express.Router();

  // 주문 생성
  r.post('/', async (req, res, next) => {
    try {
      const customerId = +(req.body?.customer_id || 0);
      const orderNo = (req.body?.order_no || '').trim();
      if (!customerId || !orderNo) return res.status(400).json({ message: 'customer_id & order_no required' });
      await pool.execute(
        'INSERT INTO orders(customer_id, order_no) VALUES(?,?)',
        [customerId, orderNo]
      );
      res.status(201).json({ order_no: orderNo });
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'duplicate' });
      next(e);
    }
  });

  // 주문 목록
  r.get('/', async (_req, res, next) => {
    try {
      const [rows] = await pool.execute(
        `SELECT o.id,o.order_no,o.status,o.created_at,
                c.name AS customer_name
         FROM orders o JOIN customers c ON o.customer_id=c.id
         ORDER BY o.id DESC LIMIT 50`
      );
      res.json(rows);
    } catch (e) { next(e); }
  });

  return r;
};