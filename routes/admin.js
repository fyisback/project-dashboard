// routes/admin.js
const express = require('express');
const router = express.Router();
const db = require('../services/db');

// Display admin panel
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

// Add new active project
router.post('/projects/add', (req, res) => {
    const { project_url, report_url, category } = req.body;
    if (!project_url || !category) {
        return res.redirect('/admin?message=Error:%20Project%20URL%20and%20Category%20are%20required.');
    }
    try {
        const stmt = db.prepare('INSERT OR IGNORE INTO projects (project_url, report_url, category) VALUES (?, ?, ?)');
        const info = stmt.run(project_url, report_url || null, category);
        res.redirect(`/admin?message=${info.changes > 0 ? 'Active%20project%20added.' : 'Error:%20Project%20URL%20already%20exists.'}`);
    } catch (err) {
        res.redirect(`/admin?message=Error:%20${encodeURIComponent(err.message)}`);
    }
});

// Add new on-hold project
router.post('/onhold/add', (req, res) => {
    const { project_url, report_url, category } = req.body;
    if (!project_url || !category) {
        return res.redirect('/admin?message=Error:%20Project%20URL%20and%20Category%20are%20required.');
    }
    try {
        const stmt = db.prepare('INSERT OR IGNORE INTO on_hold_projects (project_url, report_url, category) VALUES (?, ?, ?)');
        const info = stmt.run(project_url, report_url || null, category);
        res.redirect(`/admin?message=${info.changes > 0 ? 'On-Hold%20project%20added.' : 'Error:%20On-Hold%20URL%20already%20exists.'}`);
     } catch (err) {
        res.redirect(`/admin?message=Error:%20${encodeURIComponent(err.message)}`);
     }
});

// Display edit form
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

// Update project
router.post('/edit/:type/:id', (req, res) => {
    const { type, id } = req.params;
    const { project_url, report_url, category } = req.body;
    const tableName = type === 'active' ? 'projects' : 'on_hold_projects';
     if (type !== 'active' && type !== 'onhold') return res.redirect('/admin?message=Error:%20Invalid%20project%20type.');

    if (!project_url || !category) {
        const project = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(id);
        return res.render('edit-project', {
             pageTitle: `Edit ${type} Project`, project: { ...project, ...req.body }, projectType: type, errorMessage: 'URL and Category required.'
         });
    }
    try {
        const info = db.prepare(`UPDATE ${tableName} SET project_url = ?, report_url = ?, category = ? WHERE id = ?`)
                       .run(project_url, report_url || null, category, id);
        res.redirect(`/admin?message=${info.changes > 0 ? 'Project%20updated.' : 'Error:%20Update%20failed%20or%20no%20changes.'}`);
    } catch (err) {
        const project = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(id);
        res.render('edit-project', {
             pageTitle: `Edit ${type} Project`, project: { ...project, ...req.body }, projectType: type, errorMessage: `Update Error: ${err.message}`
         });
    }
});

// Delete project
router.post('/delete/:type/:id', (req, res) => {
    const { type, id } = req.params;
    const tableName = type === 'active' ? 'projects' : 'on_hold_projects';
     if (type !== 'active' && type !== 'onhold') return res.redirect('/admin?message=Error:%20Invalid%20project%20type.');
    try {
        const result = db.prepare(`DELETE FROM ${tableName} WHERE id = ?`).run(id);
        res.redirect(`/admin?message=${result.changes > 0 ? 'Project%20deleted.' : 'Error:%20Project%20not%20found.'}`);
    } catch (err) {
        res.redirect('/admin?message=Error%20deleting%20project.');
    }
});

module.exports = router;