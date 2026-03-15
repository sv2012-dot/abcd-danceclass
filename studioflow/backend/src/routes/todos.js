const express = require('express');
const router = express.Router({ mergeParams: true });
const { pool } = require('../database');

// GET /api/schools/:schoolId/todos
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.*,
        e.title as event_title, e.type as event_type,
        r.title as recital_title
       FROM todos t
       LEFT JOIN events e ON t.event_id = e.id
       LEFT JOIN recitals r ON t.recital_id = r.id
       WHERE t.school_id = ?
       ORDER BY t.is_complete ASC, t.due_date ASC, t.created_at DESC`,
      [req.params.schoolId]
    );
    res.json({ todos: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/schools/:schoolId/todos
router.post('/', async (req, res) => {
  try {
    const { title, notes, event_id, recital_id, due_date } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    const [r] = await pool.query(
      `INSERT INTO todos (school_id, user_id, title, notes, event_id, recital_id, due_date) VALUES (?,?,?,?,?,?,?)`,
      [req.params.schoolId, req.user.id, title, notes||null, event_id||null, recital_id||null, due_date||null]
    );
    const [rows] = await pool.query('SELECT * FROM todos WHERE id = ?', [r.insertId]);
    res.status(201).json({ todo: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/schools/:schoolId/todos/:id/toggle
router.put('/:id/toggle', async (req, res) => {
  try {
    await pool.query(
      'UPDATE todos SET is_complete = NOT is_complete WHERE id = ? AND school_id = ?',
      [req.params.id, req.params.schoolId]
    );
    const [rows] = await pool.query('SELECT * FROM todos WHERE id = ?', [req.params.id]);
    res.json({ todo: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/schools/:schoolId/todos/:id
router.put('/:id', async (req, res) => {
  try {
    const { title, notes, due_date, event_id, recital_id } = req.body;
    await pool.query(
      `UPDATE todos SET title=COALESCE(?,title), notes=COALESCE(?,notes), due_date=COALESCE(?,due_date), event_id=?, recital_id=? WHERE id=? AND school_id=?`,
      [title, notes, due_date, event_id||null, recital_id||null, req.params.id, req.params.schoolId]
    );
    const [rows] = await pool.query('SELECT * FROM todos WHERE id = ?', [req.params.id]);
    res.json({ todo: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/schools/:schoolId/todos/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM todos WHERE id = ? AND school_id = ?', [req.params.id, req.params.schoolId]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
