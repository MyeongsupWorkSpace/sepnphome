const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db');

router.post('/', async (req, res) => {
  try {
    const { username, password, display_name, email, role_id } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username/password required' });
    const hash = await bcrypt.hash(password, 12);
    const [r] = await db.query('INSERT INTO users (username, password_hash, display_name, email, role_id) VALUES (?, ?, ?, ?, ?)', [username, hash, display_name || null, email || null, role_id || 2]);
    res.status(201).json({ ok: true, userId: r.insertId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;