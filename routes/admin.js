// routes/admin.js
const express = require('express');
const router = express.Router();
const db = require('../services/db');

// GET / - без змін
router.get('/', (req, res) => {
    try {
        const projects = db.prepare('SELECT * FROM projects ORDER BY category, id').all();
        // <<< ВИБИРАЄМО ТАКОЖ TITLE ДЛЯ ON HOLD >>>
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

// POST /projects/add - без змін
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

// POST /onhold/add - ОНОВЛЕНО
router.post('/onhold/add', (req, res) => {
     // <<< ОТРИМУЄМО title З ФОРМИ >>>
     const { title, project_url, report_url, category } = req.body;
     if (!project_url || !category) {
         return res.redirect('/admin?message=Error:%20Project%20URL%20and%20Category%20are%20required.');
     }
    try {
        // <<< ДОДАЄМО title ДО ЗАПИТУ INSERT >>>
        const stmt = db.prepare('INSERT OR IGNORE INTO on_hold_projects (title, project_url, report_url, category) VALUES (?, ?, ?, ?)');
        // <<< ПЕРЕДАЄМО title || null (якщо поле порожнє) >>>
        const info = stmt.run(title || null, project_url, report_url || null, category);
         res.redirect(`/admin?message=${info.changes > 0 ? 'On-Hold%20project%20added.' : 'Error:%20On-Hold%20URL%20already%20exists.'}`);
     } catch (err) {
        res.redirect(`/admin?message=Error:%20${encodeURIComponent(err.message)}`);
     }
});

// GET /edit/:type/:id - без змін
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


// POST /edit/:type/:id - ОНОВЛЕНО
router.post('/edit/:type/:id', (req, res) => {
    const { type, id } = req.params;
    // <<< ОТРИМУЄМО title З ФОРМИ (буде undefined, якщо type === 'active') >>>
    const { title, project_url, report_url, category } = req.body;
    const tableName = type === 'active' ? 'projects' : 'on_hold_projects';
     if (type !== 'active' && type !== 'onhold') return res.redirect('/admin?message=Error:%20Invalid%20project%20type.');

    if (!project_url || !category) {
        // Логіка для повторного рендерингу форми з помилкою - без змін
        const project = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(id);
        return res.render('edit-project', {
             pageTitle: `Edit ${type} Project`, project: { ...project, ...req.body }, projectType: type, errorMessage: 'URL and Category required.'
         });
    }
    try {
        let stmt;
        let info;
        if (type === 'active') {
             // Для активних проектів title не оновлюємо
             stmt = db.prepare(`UPDATE projects SET project_url = ?, report_url = ?, category = ? WHERE id = ?`);
             info = stmt.run(project_url, report_url || null, category, id);
        } else {
             // <<< ДЛЯ ON-HOLD ОНОВЛЮЄМО ТАКОЖ TITLE >>>
             stmt = db.prepare(`UPDATE on_hold_projects SET title = ?, project_url = ?, report_url = ?, category = ? WHERE id = ?`);
             // <<< ПЕРЕДАЄМО title || null >>>
             info = stmt.run(title || null, project_url, report_url || null, category, id);
        }
        res.redirect(`/admin?message=${info.changes > 0 ? 'Project%20updated.' : 'Error:%20Update%20failed%20or%20no%20changes.'}`);
    } catch (err) {
        // Логіка для повторного рендерингу форми з помилкою оновлення - без змін
        const project = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(id);
        res.render('edit-project', {
             pageTitle: `Edit ${type} Project`, project: { ...project, ...req.body }, projectType: type, errorMessage: `Update Error: ${err.message}`
         });
    }
});


// POST /delete/:type/:id - без змін
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