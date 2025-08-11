// routes/admin.js
const express = require('express');
const router = express.Router();
const db = require('../services/db');

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

// UPDATED: The add route now handles the 'ticketing_portal_url' field.
router.post('/projects/add', (req, res) => {
    const { project_url, report_url, category, custom_title, contact_person, ticketing_portal_url } = req.body;
    try {
        db.prepare('INSERT INTO projects (project_url, report_url, category, custom_title, contact_person, ticketing_portal_url) VALUES (?, ?, ?, ?, ?, ?)')
          .run(project_url, report_url, category, custom_title, contact_person, ticketing_portal_url);
        res.redirect('/admin?message=Project%20added%20successfully.');
    } catch (err) {
        res.redirect('/admin?message=Error:%20' + encodeURIComponent(err.message));
    }
});

// No changes to POST '/onhold/add'
router.post('/onhold/add', (req, res) => {
     const { custom_title, project_url, report_url, category } = req.body;
    try {
        const stmt = db.prepare('INSERT OR IGNORE INTO on_hold_projects (custom_title, project_url, report_url, category) VALUES (?, ?, ?, ?)');
        const info = stmt.run(custom_title || null, project_url, report_url || null, category);
        res.redirect(`/admin?message=${info.changes > 0 ? 'On-Hold%20project%20added.' : 'Error:%20On-Hold%20URL%20already%20exists.'}`);
     } catch (err) {
        res.redirect(`/admin?message=Error:%20${encodeURIComponent(err.message)}`);
     }
});

// No change to the GET edit route
router.get('/edit/:type/:id', (req, res) => {
    const { type, id } = req.params;
    const tableName = type === 'active' ? 'projects' : 'on_hold_projects';
    if (type !== 'active' && type !== 'onhold') return res.redirect('/admin?message=Error:%20Invalid%20project%20type.');
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

// UPDATED: The POST edit route now handles the 'ticketing_portal_url' field.
router.post('/edit/:type/:id', (req, res) => {
    const { type, id } = req.params;
    const { project_url, report_url, category, custom_title, status, contact_person, ticketing_portal_url } = req.body;
    
    if (type === 'active') {
        try {
            const stmt = db.prepare(
                `UPDATE projects SET project_url = ?, report_url = ?, category = ?, custom_title = ?, status = ?, contact_person = ?, ticketing_portal_url = ? WHERE id = ?`
            );
            stmt.run(project_url, report_url || null, category, custom_title, status, contact_person, ticketing_portal_url, id);
            res.redirect('/admin?message=Project%20updated.');
        } catch (err) {
            const project = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id);
            res.render('edit-project', {
                pageTitle: `Edit Active Project`, project: { ...project, ...req.body }, projectType: type, errorMessage: `Update Error: ${err.message}`
            });
        }
    } else { // type === 'onhold'
        try {
            const stmt = db.prepare(
                `UPDATE on_hold_projects SET project_url = ?, report_url = ?, category = ?, custom_title = ? WHERE id = ?`
            );
            stmt.run(project_url, report_url || null, category, custom_title, id);
            res.redirect('/admin?message=Project%20updated.');
        } catch (err) {
             const project = db.prepare(`SELECT * FROM on_hold_projects WHERE id = ?`).get(id);
            res.render('edit-project', {
                pageTitle: `Edit On-Hold Project`, project: { ...project, ...req.body }, projectType: type, errorMessage: `Update Error: ${err.message}`
            });
        }
    }
});

// No change to the delete route
router.post('/delete/:type/:id', (req, res) => {
    const { type, id } = req.params;
    const tableName = type === 'active' ? 'projects' : 'on_hold_projects';
    try {
        const result = db.prepare(`DELETE FROM ${tableName} WHERE id = ?`).run(id);
        res.redirect(`/admin?message=${result.changes > 0 ? 'Project%20deleted.' : 'Error:%20Project%20not%20found.'}`);
    } catch (err) {
        res.redirect('/admin?message=Error%20deleting%20project.');
    }
});

module.exports = router;
