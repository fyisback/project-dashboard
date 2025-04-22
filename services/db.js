// services/db.js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = process.env.RENDER_DISK_MOUNT_PATH || path.resolve(__dirname, '../data');
const dbPath = path.join(dataDir, 'database.sqlite');

console.log(`Data directory determined as: ${dataDir}`);
console.log(`Database path determined as: ${dbPath}`);

if (!fs.existsSync(dataDir)) {
    console.log(`Data directory ${dataDir} not found. Creating...`);
    try {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log(`Data directory ${dataDir} created successfully.`);
    } catch (err) {
        console.error(`!!! FATAL ERROR: Could not create data directory ${dataDir}:`, err);
        process.exit(1);
    }
} else {
    console.log(`Data directory ${dataDir} already exists.`);
}

let db;
try {
    db = new Database(dbPath, { /* verbose: console.log */ });
    console.log(`Successfully connected to SQLite database at: ${dbPath}`);
} catch (err) {
    console.error(`!!! FATAL ERROR connecting to database at ${dbPath}:`, err);
    process.exit(1);
}

function initializeDatabase() {
    if (!db) {
        console.error("Database connection not established. Skipping initialization.");
        return;
    }
    console.log('Initializing database tables with categories: ThirdParty, NBM, NPPC...');
    try {
        const initTransaction = db.transaction(() => {
            // Зміни для таблиці projects
            db.exec(`
                CREATE TABLE IF NOT EXISTS projects (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_url TEXT NOT NULL UNIQUE,
                    report_url TEXT,
                    -- ОНОВЛЕНО ТУТ: Замінили 'Brand' на 'NPPC'
                    category TEXT NOT NULL CHECK(category IN ('NBM', 'ThirdParty', 'NPPC'))
                );
            `);
            // Зміни для таблиці on_hold_projects
            db.exec(`
                CREATE TABLE IF NOT EXISTS on_hold_projects (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_url TEXT NOT NULL UNIQUE,
                    report_url TEXT,
                    -- ОНОВЛЕНО ТУТ: Замінили 'Brand' на 'NPPC'
                    category TEXT NOT NULL CHECK(category IN ('NBM', 'ThirdParty', 'NPPC'))
                );
            `);
        });
        initTransaction();
        console.log('Database tables checked/initialized successfully.');
    } catch (initError) {
         console.error("Error during database table initialization:", initError);
    }
}


initializeDatabase();

module.exports = db;