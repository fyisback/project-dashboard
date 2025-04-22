// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const dashboardRoutes = require('./routes/dashboard');
const adminRoutes = require('./routes/admin');
const db = require('./services/db'); // Імпортуємо для health check та перевірки при старті

const app = express();
const PORT = process.env.PORT || 3000;

// EJS Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files

// Routes
app.use('/', dashboardRoutes);
app.use('/admin', adminRoutes);

// Health Check endpoint for Render
app.get('/healthz', (req, res) => {
    try {
        db.prepare('SELECT 1').get(); // Quick DB check
        res.status(200).send('OK');
    } catch (dbError) {
        console.error('Health check failed due to DB error:', dbError.message);
        res.status(503).send('Service Unavailable - DB Error');
    }
});

// 404 Handler
app.use((req, res) => {
    res.status(404).render('404', { pageTitle: 'Page Not Found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error("Unhandled application error:", err.stack);
    const statusCode = err.status || 500;
    res.status(statusCode).render('error', {
        pageTitle: 'Server Error',
        error: process.env.NODE_ENV === 'production' ? { message: 'An unexpected error occurred.' } : err,
        statusCode: statusCode
     });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    // Verify DB connection on startup
    try {
        db.prepare('SELECT 1').get();
        console.log('Database connection verified successfully on startup.');
    } catch (dbError) {
        console.error('!!! DATABASE CONNECTION VERIFICATION FAILED ON STARTUP !!!:', dbError.message);
    }
});