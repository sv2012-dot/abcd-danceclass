const express = require('express');
const router  = express.Router({ mergeParams: true });
const { pool } = require('../database');

// GET /api/schools/:schoolId/vendors
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    let q = 'SELECT * FROM vendors WHERE school_id = ? AND is_active = 1';
    const p = [req.params.schoolId];
    if (category) { q += ' AND category = ?'; p.push(category); }
    q += ' ORDER BY is_favorite DESC, name ASC';
    const [rows] = await pool.query(q, p);
    res.json({ vendors: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/schools/:schoolId/vendors
router.post('/', async (req, res) => {
  try {
    const { name, category, contact_name, phone, email, website, instagram, price_range, notes, is_favorite } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const [r] = await pool.query(
      `INSERT INTO vendors (school_id, name, category, contact_name, phone, email, website, instagram, price_range, notes, is_favorite)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [req.params.schoolId, name, category||'Other', contact_name||null, phone||null, email||null,
       website||null, instagram||null, price_range||null, notes||null, is_favorite?1:0]
    );
    const [rows] = await pool.query('SELECT * FROM vendors WHERE id = ?', [r.insertId]);
    res.status(201).json({ vendor: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/schools/:schoolId/vendors/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, category, contact_name, phone, email, website, instagram, price_range, notes, is_favorite } = req.body;
    await pool.query(
      `UPDATE vendors SET name=COALESCE(?,name), category=COALESCE(?,category), contact_name=?,
       phone=?, email=?, website=?, instagram=?, price_range=?, notes=?,
       is_favorite=COALESCE(?,is_favorite) WHERE id=? AND school_id=?`,
      [name, category, contact_name||null, phone||null, email||null, website||null,
       instagram||null, price_range||null, notes||null,
       is_favorite!=null?Number(is_favorite):null, req.params.id, req.params.schoolId]
    );
    const [rows] = await pool.query('SELECT * FROM vendors WHERE id = ?', [req.params.id]);
    res.json({ vendor: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/schools/:schoolId/vendors/:id  (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('UPDATE vendors SET is_active = 0 WHERE id = ? AND school_id = ?', [req.params.id, req.params.schoolId]);
    res.json({ message: 'Removed' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
