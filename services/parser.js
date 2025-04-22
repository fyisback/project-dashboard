// services/parser.js
const axios = require('axios');
const cheerio = require('cheerio');

async function fetchData(url, retries = 3) {
    try {
        const { data } = await axios.get(url, { timeout: 5000 }); // Timeout 20 sec
        return data;
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
             console.error(`Timeout fetching data from ${url} after 20 seconds.`);
             return null;
        }
        if (error.response && error.response.status === 404 && retries > 0) {
            console.warn(`404 Error fetching data from <span class="math-inline">\{url\}\. Retrying \(</span>{retries} left)...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            return fetchData(url, retries - 1);
        } else {
            console.error(`Non-404 Error fetching data from ${url}: ${error.message}`);
            return null;
        }
    }
}

function parseProjectDetails(html, url) {
    // Структура для помилок/невдач
    const errorResult = {
        projectName: `<a href="${url}" target="_blank">Parse Error/Fetch Failed</a>`, // Посилання навіть при помилці
        score: 'N/A',
        parsedFields: ['', '', '', '', '', '', ''], // Завжди 7 порожніх полів за замовчуванням
        scanDate: 'Failed',
        success: false,
        scoreValue: 0
    };

    if (!html) {
        console.warn(`No HTML content received for URL: ${url}. Cannot parse.`);
        return { ...errorResult, projectName: `<a href="${url}" target="_blank">Fetch Failed</a>` };
    }

    try {
        const $ = cheerio.load(html);
        // Починаємо з результату за замовчуванням
        const result = { ...errorResult };

        // --- КЛЮЧОВА ЗМІНА: Отримуємо назву проекту з #active_project ЗАВЖДИ СПОЧАТКУ ---
        const actualProjectName = $('#active_project').text().trim() || 'Unknown Project Name';
        // Формуємо HTML-посилання для назви проекту
        result.projectName = `<a href="${url}" target="_blank">${actualProjectName}</a>`;
        // --- Кінець ключової зміни ---

        // Тепер пробуємо отримати решту даних з таблиці та інших елементів
        // *** Переконайтесь, що ці селектори правильні для ВАШИХ цільових сторінок ***
        const table = $('#workspaceSummary');
        const rows = table.find('tbody tr');
        const scanDateElement = $('#scanCompleteDate');

        if (rows.length > 0) {
            // Якщо таблиця існує, парсимо її дані
            const dataCells = $(rows[0]).find('th, td');
            const firstEightColumns = dataCells.slice(0, 8).map((i, el) => $(el).text().trim()).get();

            // Перезаписуємо значення score, parsedFields, scanDate з таблиці
            // Назву проекту (result.projectName) вже встановлено вище!
            result.score = firstEightColumns[1] || '0'; // Score з другої колонки
            result.parsedFields = Array.from({ length: 6 }, (_, i) => firstEightColumns[i + 2] || ''); // Поля 3-8
            result.scanDate = scanDateElement.text().trim() || 'N/A';
            result.success = true; // Позначаємо, що вдалося отримати дані з таблиці
            result.scoreValue = parseFloat(result.score?.replace('%', '')) || 0;

        } else {
            // Якщо таблиця не знайдена, логуємо попередження
            console.warn(`Table #workspaceSummary or rows not found for ${url}. Project name taken from #active_project.`);
            // Залишаємо значення за замовчуванням (N/A, Failed) для score, полів, дати
            // Статус success можна залишити false, або визначити на основі наявності #active_project
            result.success = ($('#active_project').length > 0); // Вважаємо успіхом, якщо хоча б назва є? (Опціонально)
        }
        return result; // Повертаємо об'єкт з даними

    } catch (parseError) {
        console.error(`Error parsing HTML for ${url}: ${parseError.message}`);
        // При помилці парсингу, повертаємо result, де назва вже встановлена як Parse Error/Fetch Failed
        // але все ще є посиланням
        result.projectName = `<a href="${url}" target="_blank">Parse Error</a>`;
        return result; // Повертаємо об'єкт помилки
    }
}

async function getParsedDataForProject(project) {
    const html = await fetchData(project.project_url);
    const parsedDetails = parseProjectDetails(html, project.project_url);

    const reportButton = project.report_url === 'https://example.com' || !project.report_url
        ? `<button disabled style="background-color: grey; color: white; border: none; padding: 5px 10px; cursor: not-allowed; border-radius: 4px;">Report</button>`
        : `<a href="${project.report_url}" target="_blank"><button style="background-color: #007bff; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 4px;">Report</button></a>`;

    const dashboardData = {
        projectName: parsedDetails.projectName,
        score: parsedDetails.score,
        success: parsedDetails.success,
        scoreValue: parsedDetails.scoreValue,
        ...parsedDetails.parsedFields.reduce((obj, val, idx) => {
            obj[`field${idx + 3}`] = val; // field3, field4, ..., field8
            return obj;
        }, {}),
        scanDate: parsedDetails.scanDate,
        reportButton: reportButton,
        category: project.category,
    };

    return dashboardData;
}

module.exports = { getParsedDataForProject };