// services/parser.js
const axios = require('axios');
const cheerio = require('cheerio');
const db = require('./db');

async function fetchData(url, retries = 3) {
    try {
        const { data } = await axios.get(url, { timeout: 20000 });
        return data;
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            console.error(`Timeout fetching data from ${url}.`);
            return null;
        }
        console.error(`Error fetching data from ${url}: ${error.message}`);
        return null;
    }
}

function parseProjectDetails(html, url) {
    const errorResult = {
        score: 'N/A',
        parsedFields: ['', '', '', '', '', ''],
        scanDate: 'Failed',
        success: false,
        scoreValue: 0,
        issuesHtml: null
    };

    if (!html) return errorResult;

    try {
        const $ = cheerio.load(html);
        const result = { ...errorResult };

        const table = $('#workspaceSummary');
        const rows = table.find('tbody tr');
        if (rows.length > 0) {
            const dataCells = $(rows[0]).find('th, td');
            const firstEightColumns = dataCells.slice(0, 8).map((i, el) => $(el).text().trim()).get();
            result.score = firstEightColumns[1] || '0';
            result.parsedFields = Array.from({ length: 6 }, (_, i) => firstEightColumns[i + 2] || '');
            result.scanDate = $('#scanCompleteDate').text().trim() || 'N/A';
            result.success = true;
            result.scoreValue = parseFloat(result.score?.replace('%', '')) || 0;
        }

        const issuesTable = $('#accessibilityIssues');
        if (issuesTable.length > 0) {
            // --- ✅ FIXED: Make all links in the table absolute ---
            const baseUrl = new URL(url).origin; // Gets "https://nestle-axemonitor.dequecloud.com"
            issuesTable.find('a').each((i, el) => {
                const link = $(el);
                const href = link.attr('href');
                // If the link starts with a '/', it's a relative link
                if (href && href.startsWith('/')) {
                    // Prepend the base URL to make it a full, working link
                    link.attr('href', `${baseUrl}${href}`);
                }
            });
            // --- End of fix ---

            result.issuesHtml = $.html(issuesTable);
        }

        return result;

    } catch (parseError) {
        console.error(`Error parsing HTML for ${url}: ${parseError.message}`);
        return errorResult;
    }
}

async function getParsedDataForProject(project) {
    if (!project || !project.project_url) {
        return { ...project, success: false, score: 'N/A', scanDate: 'Invalid Project' };
    }

    const html = await fetchData(project.project_url);
    const parsedDetails = parseProjectDetails(html, project.project_url);

    if (parsedDetails.success && parsedDetails.scanDate !== 'N/A') {
        try {
            const lastScan = db.prepare('SELECT scan_date FROM project_scores WHERE project_id = ? ORDER BY checked_at DESC LIMIT 1').get(project.id);

            if (!lastScan || lastScan.scan_date !== parsedDetails.scanDate) {
                console.log(`New scan found for project ${project.id}. Saving score and issues.`);
                const stmt = db.prepare(
                    'INSERT INTO project_scores (project_id, score, scan_date, issues_html) VALUES (?, ?, ?, ?)'
                );
                stmt.run(project.id, parsedDetails.scoreValue, parsedDetails.scanDate, parsedDetails.issuesHtml);
            }
        } catch (dbError) {
            console.error(`Database error for project ${project.id}:`, dbError);
        }
    }

    const reportButton = project.report_url === 'https://example.com' || !project.report_url
        ? `<button disabled style="background-color: #e9ecef; color: #6c757d; border: 1px solid #ced4da; padding: 5px 10px; cursor: not-allowed; border-radius: 4px;">Report</button>`
        : `<a href="${project.report_url}" target="_blank"><button style="background-color: #007bff; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 4px;">Report</button></a>`;

    const finalData = {
        ...project,
        ...parsedDetails,
        reportButton: reportButton,
        ...parsedDetails.parsedFields.reduce((obj, val, idx) => {
            obj[`field${idx + 3}`] = val;
            return obj;
        }, {}),
    };

    return finalData;
}

module.exports = { getParsedDataForProject };
