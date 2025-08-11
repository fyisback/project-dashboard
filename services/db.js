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
    db = new Database(dbPath);
    console.log(`Successfully connected to SQLite database at: ${dbPath}`);
} catch (err) {
    console.error(`!!! FATAL ERROR connecting to database at ${dbPath}:`, err);
    process.exit(1);
}

function initializeDatabase() {
    console.log('Initializing database tables...');
    const initTransaction = db.transaction(() => {
        // Main project tables
        db.exec(`
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT, project_url TEXT NOT NULL UNIQUE, report_url TEXT,
                category TEXT NOT NULL, custom_title TEXT, status TEXT DEFAULT 'New scan available',
                meeting_notes TEXT, contact_person TEXT, ticketing_portal_url TEXT
            );
        `);
        db.exec(`
            CREATE TABLE IF NOT EXISTS on_hold_projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT, project_url TEXT NOT NULL UNIQUE, report_url TEXT,
                category TEXT NOT NULL, custom_title TEXT 
            );
        `);
        db.exec(`
            CREATE TABLE IF NOT EXISTS project_scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL, score INTEGER NOT NULL,
                scan_date TEXT NOT NULL, issues_html TEXT, checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );
        `);

        // Project-specific action items table
        db.exec(`
            CREATE TABLE IF NOT EXISTS project_action_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                task TEXT NOT NULL,
                description TEXT,
                owner TEXT,
                priority TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'To Do',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );
        `);

        // ✅ FIXED: Re-added the missing tables for the Weekly Hub page.
        db.exec(`
            CREATE TABLE IF NOT EXISTS action_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task TEXT NOT NULL,
                owner TEXT,
                priority TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'To Do',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        db.exec(`
            CREATE TABLE IF NOT EXISTS weekly_notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                note TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
    });

    try {
        initTransaction();
        console.log('Database tables checked/initialized successfully.');
    } catch (initError) {
        console.error("Error during database table initialization:", initError);
    }
}

initializeDatabase();
module.exports = db;
