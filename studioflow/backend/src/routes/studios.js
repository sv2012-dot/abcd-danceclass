const express = require('express');
const router = express.Router({ mergeParams: true });
const { pool } = require('../database');

// GET /api/schools/:schoolId/studios
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM studios WHERE school_id = ? AND is_active = 1 ORDER BY is_favorite DESC, name ASC',
      [req.params.schoolId]
    );
    res.json({ studios: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/schools/:schoolId/studios
router.post('/', async (req, res) => {
  try {
    const { name, address, city, state, zip, phone, email, website, capacity, hourly_rate, notes, is_favorite } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const [r] = await pool.query(
      `INSERT INTO studios (school_id, name, address, city, state, zip, phone, email, website, capacity, hourly_rate, notes, is_favorite)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [req.params.schoolId, name, address||null, city||null, state||'WA', zip||null, phone||null, email||null, website||null, capacity||null, hourly_rate||null, notes||null, is_favorite?1:0]
    );
    const [rows] = await pool.query('SELECT * FROM studios WHERE id = ?', [r.insertId]);
    res.status(201).json({ studio: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/schools/:schoolId/studios/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, address, city, state, zip, phone, email, website, capacity, hourly_rate, notes, is_favorite } = req.body;
    await pool.query(
      `UPDATE studios SET name=COALESCE(?,name), address=?, city=?, state=?, zip=?, phone=?, email=?, website=?,
       capacity=?, hourly_rate=?, notes=?, is_favorite=COALESCE(?,is_favorite)
       WHERE id=? AND school_id=?`,
      [name, address||null, city||null, state||null, zip||null, phone||null, email||null, website||null,
       capacity||null, hourly_rate||null, notes||null, is_favorite!=null?Number(is_favorite):null,
       req.params.id, req.params.schoolId]
    );
    const [rows] = await pool.query('SELECT * FROM studios WHERE id = ?', [req.params.id]);
    res.json({ studio: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/schools/:schoolId/studios/:id  (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('UPDATE studios SET is_active = 0 WHERE id = ? AND school_id = ?', [req.params.id, req.params.schoolId]);
    res.json({ message: 'Removed' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
