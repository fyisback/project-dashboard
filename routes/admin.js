// routes/admin.js
const express = require('express');
const router = express.Router();
const db = require('../services/db');
const crypto = require('crypto'); // Import the crypto module to generate tokens

// No changes to GET '/'
router.get('/', (req, res) => {
    try {
        const projects = db.prepare('SELECT * FROM projects ORDER BY category, id').all();
        const onHoldProjects = db.prepare('SELECT * FROM on_hold_projects ORDER BY category, id').all();
        res.render('admin', {
            pageTitle: 'Admin Panel',
            projects: projects,
            onHoldProjects: onHoldProjects,
            message: req.query.message
        });
    } catch (err) {
        console.error("Error loading admin panel:", err);
        res.status(500).send("Error loading admin data.");
    }
});

// UPDATED: The add route now generates and saves a unique share token.
router.post('/projects/add', (req, res) => {
    const { project_url, report_url, category, custom_title, contact_person, ticketing_portal_url } = req.body;
    const share_token = crypto.randomUUID(); // Generate a secure, random token
    try {
        db.prepare(
            'INSERT INTO projects (project_url, report_url, category, custom_title, contact_person, ticketing_portal_url, share_token) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(project_url, report_url, category, custom_title, contact_person, ticketing_portal_url, share_token);
        res.redirect('/admin?message=Project%20added%20successfully.');
    } catch (err) {
        res.redirect('/admin?message=Error:%20' + encodeURIComponent(err.message));
    }
});

// The rest of the file remains unchanged.
router.post('/onhold/add', (req, res) => {
     const { custom_title, project_url, report_url, category } = req.body;
    try {
        const stmt = db.prepare('INSERT OR IGNORE INTO on_hold_projects (custom_title, project_url, report_url, category) VALUES (?, ?, ?, ?)');
        stmt.run(custom_title || null, project_url, report_url || null, category);
        res.redirect(`/admin?message=On-Hold%20project%20added.`);
     } catch (err) {
        res.redirect(`/admin?message=Error:%20${encodeURIComponent(err.message)}`);
     }
});

router.get('/edit/:type/:id', (req, res) => {
    const { type, id } = req.params;
    const tableName = type === 'active' ? 'projects' : 'on_hold_projects';
    try {
        const project = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(id);
        if (project) {
            res.render('edit-project', { pageTitle: `Edit ${type} Project`, project, projectType: type });
        } else {
            res.redirect('/admin?message=Error:%20Project%20not%20found.');
        }
    } catch (err) {
        res.redirect('/admin?message=Error%20loading%20edit%20form.');
    }
});

router.post('/edit/:type/:id', (req, res) => {
    const { type, id } = req.params;
    const { project_url, report_url, category, custom_title, status, contact_person, ticketing_portal_url } = req.body;
    if (type === 'active') {
        try {
            db.prepare(
                `UPDATE projects SET project_url = ?, report_url = ?, category = ?, custom_title = ?, status = ?, contact_person = ?, ticketing_portal_url = ? WHERE id = ?`
            ).run(project_url, report_url, category, custom_title, status, contact_person, ticketing_portal_url, id);
            res.redirect('/admin?message=Project%20updated.');
        } catch (err) {
            res.redirect(`/admin/edit/active/${id}?message=${encodeURIComponent(err.message)}`);
        }
    } else {
        // Logic for on-hold projects
        res.redirect('/admin');
    }
});

router.post('/delete/:type/:id', (req, res) => {
    const { type, id } = req.params;
    const tableName = type === 'active' ? 'projects' : 'on_hold_projects';
    try {
        db.prepare(`DELETE FROM ${tableName} WHERE id = ?`).run(id);
        res.redirect(`/admin?message=Project%20deleted.`);
    } catch (err) {
        res.redirect('/admin?message=Error%20deleting%20project.');
    }
});

module.exports = router;
