// services/db.js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto'); // Додаємо модуль для генерації токенів

const dataDir = process.env.RENDER_DISK_MOUNT_PATH || path.resolve(__dirname, '../data');
const dbPath = path.join(dataDir, 'database.sqlite');

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

function initializeDatabase() {
    console.log('Initializing database tables...');
    const initTransaction = db.transaction(() => {
        // Створення таблиць (без змін)
        db.exec(`
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT, project_url TEXT NOT NULL UNIQUE, report_url TEXT,
                category TEXT NOT NULL, custom_title TEXT, status TEXT DEFAULT 'New scan available',
                meeting_notes TEXT, contact_person TEXT, ticketing_portal_url TEXT,
                share_token TEXT
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
        db.exec(`
            CREATE TABLE IF NOT EXISTS weekly_notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT, note TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        db.exec(`
            CREATE TABLE IF NOT EXISTS project_action_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL, task TEXT NOT NULL,
                description TEXT, owner TEXT, priority TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'To Do',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );
        `);
    });

    try {
        initTransaction();
        console.log('Database tables checked/initialized successfully.');
    } catch (initError) {
        console.error("Error during initial table creation:", initError);
    }

    // --- НОВИЙ БЛОК: Безпечна міграція бази даних ---
    try {
        // 1. Перевіряємо, чи існує колонка 'share_token'
        const columns = db.prepare("PRAGMA table_info(projects)").all();
        const hasShareTokenColumn = columns.some(col => col.name === 'share_token');

        if (!hasShareTokenColumn) {
            console.log("Migration needed: 'share_token' column not found. Adding it now...");
            
            const migrationTransaction = db.transaction(() => {
                // 2. Додаємо нову колонку, якщо її немає
                db.exec('ALTER TABLE projects ADD COLUMN share_token TEXT');
                console.log("Column 'share_token' added to 'projects' table.");

                // 3. Створюємо унікальний індекс для цієї колонки
                db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_share_token ON projects (share_token);');

                // 4. Отримуємо всі проєкти, у яких ще немає токена
                const projectsToUpdate = db.prepare('SELECT id FROM projects WHERE share_token IS NULL').all();
                
                if (projectsToUpdate.length > 0) {
                    console.log(`Found ${projectsToUpdate.length} existing projects to update with share tokens...`);
                    const updateStmt = db.prepare('UPDATE projects SET share_token = ? WHERE id = ?');
                    
                    // 5. Генеруємо та зберігаємо унікальний токен для кожного проєкту
                    for (const project of projectsToUpdate) {
                        const token = crypto.randomUUID();
                        updateStmt.run(token, project.id);
                    }
                    console.log("Successfully populated share tokens for existing projects.");
                }
            });

            migrationTransaction();
            console.log("Database migration completed successfully.");
        } else {
            console.log("'share_token' column already exists. No migration needed.");
        }
    } catch (migrationError) {
        console.error("Error during database migration:", migrationError);
    }
}

initializeDatabase();
module.exports = db;
