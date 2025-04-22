// routes/dashboard.js
const express = require('express');
const router = express.Router();
const db = require('../services/db');
const parser = require('../services/parser');
const pLimit = require('p-limit').default;

const limit = pLimit(5); // Limit concurrency

function calculateCategoryAverages(parsedData) {
    const categories = ['NBM', 'ThirdParty', 'NPPC'];
    const categoryScores = categories.reduce((acc, category) => {
        acc[category] = { sum: 0, count: 0 };
        return acc;
    }, {});
    let totalSum = 0;
    let totalCount = 0;

    parsedData.forEach(data => {
        if (data.success && categories.includes(data.category)) {
            categoryScores[data.category].sum += data.scoreValue;
            categoryScores[data.category].count += 1;
            totalSum += data.scoreValue;
            totalCount += 1;
        }
    });

    const averages = Object.entries(categoryScores).map(([category, { sum, count }]) => ({
        category, average: count > 0 ? (sum / count).toFixed(2) : 'N/A',
    }));
    averages.unshift({
        category: 'Total', average: totalCount > 0 ? (totalSum / totalCount).toFixed(2) : 'N/A',
    });
    return averages;
}

router.get('/', async (req, res, next) => {
    try {
        const activeProjects = db.prepare('SELECT * FROM projects ORDER BY category, id').all();
        const onHoldProjects = db.prepare('SELECT * FROM on_hold_projects ORDER BY category, id').all();

        const parsingPromises = activeProjects.map(project => limit(() => parser.getParsedDataForProject(project)));

        console.log(`Starting parsing for ${activeProjects.length} projects...`);
        const parsedProjectData = await Promise.all(parsingPromises);
        console.log('Parsing completed.');

        const averageScores = calculateCategoryAverages(parsedProjectData);

        res.render('dashboard', {
            pageTitle: 'Project Dashboard',
            activeProjectsData: parsedProjectData,
            averageScores: averageScores,
            onHoldProjects: onHoldProjects
        });
    } catch (err) {
        console.error("Error fetching data for dashboard:", err);
        next(err); // Pass error to the error handler
    }
});

module.exports = router;