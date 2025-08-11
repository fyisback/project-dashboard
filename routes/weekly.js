// routes/weekly.js
const express = require('express');
const router = express.Router();
const db = require('../services/db');

// --- Main Page ---
// GET: Renders the weekly hub page, fetching all action items and notes.
router.get('/', (req, res) => {
    try {
        const actionItems = db.prepare('SELECT * FROM action_items ORDER BY created_at DESC').all();
        const notes = db.prepare('SELECT * FROM weekly_notes ORDER BY created_at DESC').all();
        res.render('weekly-hub', {
            pageTitle: 'Weekly Hub',
            actionItems,
            notes,
            message: req.query.message
        });
    } catch (err) {
        console.error("Error loading weekly hub:", err);
        res.status(500).send("Error loading page data.");
    }
});

// --- Action Item Routes ---
// POST: Adds a new action item to the database.
router.post('/action-items/add', (req, res) => {
    const { task, owner, priority } = req.body;
    try {
        db.prepare('INSERT INTO action_items (task, owner, priority) VALUES (?, ?, ?)')
          .run(task, owner, priority);
    } catch (err) {
        console.error("Error adding action item:", err);
    }
    res.redirect('/weekly');
});

// POST: Updates the status of an existing action item.
router.post('/action-items/update/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        db.prepare('UPDATE action_items SET status = ? WHERE id = ?').run(status, id);
    } catch (err) {
        console.error("Error updating action item:", err);
    }
    res.redirect('/weekly');
});

// POST: Deletes an action item from the database.
router.post('/action-items/delete/:id', (req, res) => {
    const { id } = req.params;
    try {
        db.prepare('DELETE FROM action_items WHERE id = ?').run(id);
    } catch (err) {
        console.error("Error deleting action item:", err);
    }
    res.redirect('/weekly');
});

// --- Weekly Notes Routes ---
// POST: Adds a new note to the database.
router.post('/notes/add', (req, res) => {
    const { note } = req.body;
    try {
        db.prepare('INSERT INTO weekly_notes (note) VALUES (?)').run(note);
        res.redirect('/weekly?message=Note%20added%20successfully.');
    } catch (err) {
        console.error("Error adding note:", err);
        res.redirect('/weekly?message=Error%20adding%20note.');
    }
});

// POST: Updates an existing note.
router.post('/notes/edit/:id', (req, res) => {
    const { id } = req.params;
    const { note } = req.body;
    try {
        db.prepare('UPDATE weekly_notes SET note = ? WHERE id = ?').run(note, id);
        res.redirect('/weekly?message=Note%20updated%20successfully.');
    } catch (err) {
        console.error("Error editing note:", err);
        res.redirect('/weekly?message=Error%20updating%20note.');
    }
});

// POST: Deletes a note from the database.
router.post('/notes/delete/:id', (req, res) => {
    const { id } = req.params;
    try {
        db.prepare('DELETE FROM weekly_notes WHERE id = ?').run(id);
        res.redirect('/weekly?message=Note%20deleted%20successfully.');
    } catch (err) {
        console.error("Error deleting note:", err);
        res.redirect('/weekly?message=Error%20deleting%20note.');
    }
});

module.exports = router;
