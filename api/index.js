// api/index.js (UNTUK VERCEL)
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Import routes
const drakorkitaRoutes = require('../routes/drakorkita');

// Routes
app.use('/api/drakorkita', drakorkitaRoutes);

// Home route
app.get('/api', (req, res) => {
    res.json({
        message: 'Drakorkita Scraper API',
        endpoints: {
            series: '/api/drakorkita/series',
            movies: '/api/drakorkita/movie',
            search: '/api/drakorkita/search?s=keyword',
            detail: '/api/drakorkita/detail/:endpoint',
            genres: '/api/drakorkita/genres',
            video: '/api/drakorkita/video/:endpoint',
            player: '/api/player?endpoint=series-endpoint'
        }
    });
});

// Root redirect to API docs
app.get('/', (req, res) => {
    res.redirect('/api');
});

// Player route
app.get('/api/player', (req, res) => {
    const { endpoint } = req.query;
    
    if (endpoint) {
        res.redirect(`/player.html?endpoint=${endpoint}`);
    } else {
        res.sendFile(path.join(__dirname, '../public', 'player.html'));
    }
});

// Stream route
app.get('/api/stream', (req, res) => {
    const { endpoint } = req.query;
    
    if (!endpoint) {
        return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Stream Player</title>
            <style>
                body { margin: 20px; font-family: Arial; }
                .container { max-width: 600px; margin: 0 auto; }
                input { padding: 10px; width: 300px; margin: 10px; }
                button { padding: 10px 20px; background: #007bff; color: white; border: none; cursor: pointer; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Enter Series Endpoint</h1>
                <p>Get endpoint from search API results</p>
                <form action="/api/stream" method="GET">
                    <input type="text" name="endpoint" placeholder="e.g., taxi-driver-2025-v1cy" required>
                    <button type="submit">Open Player</button>
                </form>
                <p>Or try: <a href="/api/player?endpoint=taxi-driver-2025-v1cy">Taxi Driver 3</a></p>
            </div>
        </body>
        </html>
        `);
    }
    
    res.redirect(`/api/player?endpoint=${endpoint}`);
});

app.get('/api/test-stream', (req, res) => {
    const endpoint = 'taxi-driver-2025-v1cy';
    res.redirect(`/api/player?endpoint=${endpoint}`);
});

app.get('/player', (req, res) => {
    const { endpoint } = req.query;
    if (endpoint) {
        res.redirect(`/player.html?endpoint=${endpoint}`);
    } else {
        res.sendFile(path.join(__dirname, '../public', 'player.html'));
    }
});

// Error handling
app.use((err, req, res, next) => {
    console.error('API Error:', err.stack);
    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message
    });
});

// 404 handler
app.use('*', (req, res) => {
    if (req.url.startsWith('/api')) {
        res.status(404).json({
            success: false,
            error: 'API endpoint not found'
        });
    } else {
        res.status(404).send(`
            <h1>404 - Page Not Found</h1>
            <p><a href="/api">Go to API Documentation</a></p>
            <p><a href="/player">Go to Player</a></p>
        `);
    }
});

module.exports = app;