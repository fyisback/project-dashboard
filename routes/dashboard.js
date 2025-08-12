// routes/dashboard.js
const express = require('express');
const router = express.Router();
const db = require('../services/db');
const parser = require('../services/parser');
const pLimit = require('p-limit').default;

const limit = pLimit(5);

function calculateCategoryAverages(parsedData) {
    const categories = ['NBM', 'ThirdParty', 'NPPC'];
    const categoryScores = categories.reduce((acc, category) => ({ ...acc, [category]: { sum: 0, count: 0 } }), {});
    let totalSum = 0, totalCount = 0;
    parsedData.forEach(data => {
        if (data.success && typeof data.scoreValue === 'number') {
            if (categories.includes(data.category)) {
                categoryScores[data.category].sum += data.scoreValue;
                categoryScores[data.category].count++;
            }
            totalSum += data.scoreValue;
            totalCount++;
        }
    });
    const averages = Object.entries(categoryScores).map(([category, { sum, count }]) => ({
        category, average: count > 0 ? (sum / count).toFixed(2) : 'N/A',
    }));
    averages.unshift({ category: 'Total', average: totalCount > 0 ? (totalSum / totalCount).toFixed(2) : 'N/A' });
    return averages;
}

// --- Share Page Routes ---
router.get('/share/:token', async (req, res, next) => {
    try {
        const { token } = req.params;
        const project = db.prepare('SELECT * FROM projects WHERE share_token = ?').get(token);

        if (!project) {
            return res.status(404).render('404', { pageTitle: 'Project Not Found' });
        }

        const scores = db.prepare('SELECT * FROM project_scores WHERE project_id = ? ORDER BY checked_at ASC').all(project.id);
        const actionItems = db.prepare('SELECT * FROM project_action_items WHERE project_id = ? ORDER BY created_at DESC').all(project.id);

        res.render('share-details', {
            pageTitle: `Details for ${project.custom_title || project.project_url}`,
            project,
            scores,
            actionItems,
            message: req.query.message,
            host: req.get('host'),
            protocol: req.protocol
        });
    } catch (err) {
        next(err);
    }
});

router.post('/share/:token/notes', (req, res) => {
    const { token } = req.params;
    const { notes } = req.body;
    try {
        const project = db.prepare('SELECT id FROM projects WHERE share_token = ?').get(token);
        if (project) {
            db.prepare('UPDATE projects SET meeting_notes = ? WHERE id = ?').run(notes, project.id);
        }
    } catch (err) {
        console.error("Error saving notes from share page:", err);
    }
    res.redirect(`/share/${token}?message=Notes%20saved.`);
});

// NEW: Route to handle deleting notes from the share page
router.post('/share/:token/notes/delete', (req, res) => {
    const { token } = req.params;
    try {
        const project = db.prepare('SELECT id FROM projects WHERE share_token = ?').get(token);
        if (project) {
            db.prepare('UPDATE projects SET meeting_notes = NULL WHERE id = ?').run(project.id);
        }
    } catch (err) {
        console.error("Error deleting notes from share page:", err);
    }
    res.redirect(`/share/${token}?message=Notes%20deleted.`);
});

router.post('/share/:token/action-items/:action/:itemId?', (req, res) => {
    const { token, action, itemId } = req.params;
    const project = db.prepare('SELECT id FROM projects WHERE share_token = ?').get(token);
    if (!project) return res.redirect('/');

    try {
        if (action === 'add') {
            const { task, description, owner, priority } = req.body;
            db.prepare('INSERT INTO project_action_items (project_id, task, description, owner, priority) VALUES (?, ?, ?, ?, ?)')
              .run(project.id, task, description, owner, priority);
        } else if (action === 'update' && itemId) {
            const { status } = req.body;
            db.prepare('UPDATE project_action_items SET status = ? WHERE id = ?').run(status, itemId);
        } else if (action === 'delete' && itemId) {
            db.prepare('DELETE FROM project_action_items WHERE id = ?').run(itemId);
        }
    } catch (err) {
        console.error(`Error with action item '${action}':`, err);
    }
    res.redirect(`/share/${token}`);
});


// --- Original Dashboard Routes ---
router.get('/', async (req, res, next) => {
    try {
        const activeProjects = db.prepare('SELECT * FROM projects ORDER BY id').all();
        const onHoldProjects = db.prepare('SELECT * FROM on_hold_projects ORDER BY id').all();
        const parsingPromises = activeProjects.map(project => limit(() => parser.getParsedDataForProject(project)));
        const parsedProjectData = await Promise.all(parsingPromises);
        const averageScores = calculateCategoryAverages(parsedProjectData);
        res.render('dashboard', {
            pageTitle: 'Project Dashboard',
            activeProjectsData: parsedProjectData,
            averageScores,
            onHoldProjects
        });
    } catch (err) {
        next(err);
    }
});

router.get('/project/:id/score-history', (req, res, next) => {
    try {
        const projectId = req.params.id;
        const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
        if (!project) return res.status(404).render('404', { pageTitle: 'Project Not Found' });
        const scores = db.prepare('SELECT * FROM project_scores WHERE project_id = ? ORDER BY checked_at ASC').all(projectId);
        const actionItems = db.prepare('SELECT * FROM project_action_items WHERE project_id = ? ORDER BY created_at DESC').all(projectId);
        res.render('score-history', {
            pageTitle: `Details for ${project.custom_title || project.project_url}`,
            project,
            scores,
            actionItems,
            message: req.query.message,
            host: req.get('host'),
            protocol: req.protocol
        });
    } catch (err) {
        next(err);
    }
});

router.post('/project/notes/:projectId', (req, res) => {
    const { projectId } = req.params;
    const { notes } = req.body;
    try {
        db.prepare('UPDATE projects SET meeting_notes = ? WHERE id = ?').run(notes, projectId);
        res.redirect(`/project/${projectId}/score-history?message=Notes%20saved.`);
    } catch (err) {
        res.redirect(`/project/${projectId}/score-history?message=Error%20saving%20notes.`);
    }
});

router.post('/project/notes/:projectId/delete', (req, res) => {
    const { projectId } = req.params;
    try {
        db.prepare('UPDATE projects SET meeting_notes = NULL WHERE id = ?').run(projectId);
        res.redirect(`/project/${projectId}/score-history?message=Notes%20deleted.`);
    } catch (err) {
        res.redirect(`/project/${projectId}/score-history?message=Error%20deleting%20notes.`);
    }
});

router.post('/project/:projectId/action-items/add', (req, res) => {
    const { projectId } = req.params;
    const { task, description, owner, priority } = req.body;
    try {
        db.prepare('INSERT INTO project_action_items (project_id, task, description, owner, priority) VALUES (?, ?, ?, ?, ?)')
          .run(projectId, task, description, owner, priority);
    } catch (err) {
        console.error("Error adding action item:", err);
    }
    res.redirect(`/project/${projectId}/score-history`);
});

router.post('/project/:projectId/action-items/update/:itemId', (req, res) => {
    const { projectId, itemId } = req.params;
    const { status } = req.body;
    try {
        db.prepare('UPDATE project_action_items SET status = ? WHERE id = ?').run(status, itemId);
    } catch (err) {
        console.error("Error updating action item:", err);
    }
    res.redirect(`/project/${projectId}/score-history`);
});

router.post('/project/:projectId/action-items/delete/:itemId', (req, res) => {
    const { projectId, itemId } = req.params;
    try {
        db.prepare('DELETE FROM project_action_items WHERE id = ?').run(itemId);
    } catch (err) {
        console.error("Error deleting action item:", err);
    }
    res.redirect(`/project/${projectId}/score-history`);
});

module.exports = router;
