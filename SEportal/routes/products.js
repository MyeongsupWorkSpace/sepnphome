const express = require('express');
const router = express.Router();
const db = require('../db');

// GET list (기존 유지)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT p.*, s.name AS supplier_name, pa.name AS paper_name FROM products p LEFT JOIN suppliers s ON p.supplier_id = s.id LEFT JOIN papers pa ON p.paper_id = pa.id ORDER BY p.id DESC LIMIT 200');
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// 제품 등록: supplier/paper/materials 동시 처리
router.post('/', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { code, name, description, price } = req.body;
    const supplier = req.body.supplier || null;
    const paper = req.body.paper || null;
    const materials = Array.isArray(req.body.materials) ? req.body.materials : [];
    const createdBy = req.body.created_by || null; // 프로덕션에서는 req.user.id로 대체

    // 1) supplier upsert
    let supplierId = null;
    if (supplier && supplier.name) {
      const [srows] = await conn.query('SELECT id FROM suppliers WHERE name = ? LIMIT 1', [supplier.name]);
      if (srows.length) {
        supplierId = srows[0].id;
        await conn.query('UPDATE suppliers SET contact = COALESCE(?, contact), phone = COALESCE(?, phone), email = COALESCE(?, email), address = COALESCE(?, address), updated_at = NOW() WHERE id = ?', [supplier.contact || null, supplier.phone || null, supplier.email || null, supplier.address || null, supplierId]);
      } else {
        const [sr] = await conn.query('INSERT INTO suppliers (name, contact, phone, email, address) VALUES (?, ?, ?, ?, ?)', [supplier.name, supplier.contact || null, supplier.phone || null, supplier.email || null, supplier.address || null]);
        supplierId = sr.insertId;
      }
    }

    // 2) paper upsert
    let paperId = null;
    if (paper && paper.name) {
      const [prows] = await conn.query('SELECT id FROM papers WHERE name = ? LIMIT 1', [paper.name]);
      if (prows.length) {
        paperId = prows[0].id;
        await conn.query('UPDATE papers SET size = COALESCE(?, size), weight = COALESCE(?, weight), description = COALESCE(?, description), updated_at = NOW() WHERE id = ?', [paper.size || null, paper.weight || null, paper.description || null, paperId]);
      } else {
        const [pr] = await conn.query('INSERT INTO papers (name, size, weight, description) VALUES (?, ?, ?, ?)', [paper.name, paper.size || null, paper.weight || null, paper.description || null]);
        paperId = pr.insertId;
      }
    }

    // 3) create product
    const [prod] = await conn.query('INSERT INTO products (code, name, description, price, supplier_id, paper_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)', [code || null, name, description || null, price || 0, supplierId, paperId, createdBy]);
    const productId = prod.insertId;

    // 4) materials upsert and link
    for (const m of materials) {
      if (!m || !m.name) continue;
      // upsert material by name
      const [mrows] = await conn.query('SELECT id FROM materials WHERE name = ? LIMIT 1', [m.name]);
      let materialId;
      if (mrows.length) {
        materialId = mrows[0].id;
        await conn.query('UPDATE materials SET type = COALESCE(?, type), unit = COALESCE(?, unit), note = COALESCE(?, note), updated_at = NOW() WHERE id = ?', [m.type || null, m.unit || null, m.note || null, materialId]);
      } else {
        const [mr] = await conn.query('INSERT INTO materials (name, type, unit, note) VALUES (?, ?, ?, ?)', [m.name, m.type || null, m.unit || null, m.note || null]);
        materialId = mr.insertId;
      }

      // link product_materials
      const qty = parseFloat(m.quantity || 0);
      await conn.query('INSERT INTO product_materials (product_id, material_id, quantity, unit, note) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), unit = VALUES(unit), note = VALUES(note)', [productId, materialId, qty, m.unit || null, m.note || null]);
    }

    // 5) audit log
    await conn.query('INSERT INTO audit_logs (actor_id, actor_name, action, entity, entity_id, payload, ip) VALUES (?, ?, ?, ?, ?, ?, ?)', [createdBy || null, null, 'create_product', 'product', productId, JSON.stringify(req.body || {}), req.ip || null]);

    await conn.commit();
    res.status(201).json({ ok: true, productId });
  } catch (err) {
    await conn.rollback();
    console.error('제품 등록 오류:', err);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

module.exports = router;