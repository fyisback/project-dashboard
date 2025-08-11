// routes/dashboard.js
const express = require('express');
const router = express.Router();
const db = require('../services/db');
const parser = require('../services/parser');
const pLimit = require('p-limit').default;

const limit = pLimit(5);

// No changes to the main dashboard route '/' or calculateCategoryAverages
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
            averageScores: averageScores,
            onHoldProjects: onHoldProjects
        });
    } catch (err) {
        console.error("Error fetching data for dashboard:", err);
        next(err);
    }
});

router.get('/project/:id/score-history', (req, res, next) => {
    try {
        const projectId = req.params.id;
        const project = db.prepare('SELECT id, custom_title, project_url, meeting_notes FROM projects WHERE id = ?').get(projectId);

        if (!project) {
            return res.status(404).render('404', { pageTitle: 'Project Not Found' });
        }

        const scores = db.prepare('SELECT id, score, scan_date, checked_at, issues_html FROM project_scores WHERE project_id = ? ORDER BY checked_at ASC').all(projectId);
        const actionItems = db.prepare('SELECT * FROM project_action_items WHERE project_id = ? ORDER BY created_at DESC').all(projectId);

        res.render('score-history', {
            pageTitle: `Details for ${project.custom_title || project.project_url}`,
            project,
            scores,
            actionItems,
            message: req.query.message
        });
    } catch (err) {
        console.error(`Error fetching score history for project ID ${req.params.id}:`, err);
        next(err);
    }
});

router.post('/project/notes/:projectId', (req, res) => {
    const { projectId } = req.params;
    const { notes } = req.body;
    try {
        const stmt = db.prepare('UPDATE projects SET meeting_notes = ? WHERE id = ?');
        stmt.run(notes, projectId);
        res.redirect(`/project/${projectId}/score-history?message=Notes%20saved%20successfully.`);
    } catch (err) {
        console.error(`Error saving notes for project ID ${projectId}:`, err);
        res.redirect(`/project/${projectId}/score-history?message=Error%20saving%20notes.`);
    }
});

// UPDATED: The add route now handles the 'description' field.
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
