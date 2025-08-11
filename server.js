// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const dashboardRoutes = require('./routes/dashboard');
const adminRoutes = require('./routes/admin');
const weeklyRoutes = require('./routes/weekly'); // <-- Add this
const db = require('./services/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/', dashboardRoutes);
app.use('/admin', adminRoutes);
app.use('/weekly', weeklyRoutes); // <-- Add this

app.get('/healthz', (req, res) => {
    try {
        db.prepare('SELECT 1').get();
        res.status(200).send('OK');
    } catch (dbError) {
        res.status(503).send('Service Unavailable');
    }
});

app.use((req, res) => {
    res.status(404).render('404', { pageTitle: 'Page Not Found' });
});

app.use((err, req, res, next) => {
    console.error("Unhandled application error:", err.stack);
    res.status(500).render('error', { pageTitle: 'Server Error', error: err });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
