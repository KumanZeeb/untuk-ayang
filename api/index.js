// api/index.js (VERSI DIPERBAIKI)
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();

// Perbaiki path untuk Vercel
const isVercel = process.env.VERCEL || process.env.NOW_REGION;

// Middleware dengan config lebih baik
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'User-Agent'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files - handle berbagai kemungkinan path
const publicPath = path.join(__dirname, '..', 'public');
try {
    app.use(express.static(publicPath));
    console.log(`Serving static files from: ${publicPath}`);
} catch (err) {
    console.warn(`Cannot find public folder at: ${publicPath}`);
}

// Import routes dengan error handling
let drakorkitaRoutes;
try {
    drakorkitaRoutes = require('./routes/drakorkita');
    console.log('Drakorkita routes loaded successfully');
} catch (err) {
    console.error('Failed to load drakorkita routes:', err.message);
    // Fallback routes
    drakorkitaRoutes = express.Router();
    drakorkitaRoutes.get('*', (req, res) => {
        res.status(503).json({
            success: false,
            error: 'Routes module not loaded',
            message: err.message
        });
    });
}

// Routes dengan prefix yang konsisten
app.use('/api/drakorkita', drakorkitaRoutes);

// Health check endpoint (penting untuk Vercel)
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'API is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        baseUrl: process.env.DRAKORKITA_URL || 'Not set'
    });
});

// Home route
app.get('/api', (req, res) => {
    res.json({
        success: true,
        message: 'Drakorkita Scraper API',
        version: '1.0.0',
        base_url: process.env.VERCEL_URL || req.protocol + '://' + req.get('host'),
        endpoints: {
            series_all: '/api/drakorkita/series?page=1',
            series_updated: '/api/drakorkita/series/updated',
            movie_all: '/api/drakorkita/movie?page=1',
            search: '/api/drakorkita/search?s=keyword&page=1',
            detail: '/api/drakorkita/detail/:endpoint',
            genres: '/api/drakorkita/genres',
            video: '/api/drakorkita/video/:endpoint',
            player: '/api/player?endpoint=series-endpoint',
            test: '/api/test-stream'
        }
    });
});

// Root redirect to API docs
app.get('/', (req, res) => {
    res.redirect('/api');
});

// Player routes - lebih robust
app.get('/api/player', (req, res) => {
    try {
        const { endpoint } = req.query;
        
        if (!endpoint) {
            // Show form jika tidak ada endpoint
            return res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Drakorkita Player</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    * { box-sizing: border-box; }
                    body { margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; }
                    .container { max-width: 600px; margin: 50px auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    h1 { color: #333; margin-bottom: 10px; }
                    p { color: #666; margin-bottom: 20px; }
                    .form-group { margin-bottom: 20px; }
                    label { display: block; margin-bottom: 5px; color: #555; font-weight: 500; }
                    input { width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 6px; font-size: 16px; transition: border-color 0.3s; }
                    input:focus { outline: none; border-color: #007bff; }
                    button { background: #007bff; color: white; border: none; padding: 12px 24px; border-radius: 6px; font-size: 16px; cursor: pointer; transition: background 0.3s; }
                    button:hover { background: #0056b3; }
                    .example { margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 6px; }
                    .example a { color: #007bff; text-decoration: none; }
                    .example a:hover { text-decoration: underline; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🎬 Drakorkita Player</h1>
                    <p>Enter series endpoint from search results</p>
                    
                    <form action="/api/player" method="GET">
                        <div class="form-group">
                            <label for="endpoint">Series Endpoint:</label>
                            <input type="text" id="endpoint" name="endpoint" 
                                   placeholder="e.g., taxi-driver-2025-v1cy" 
                                   required>
                        </div>
                        <button type="submit">Open Player</button>
                    </form>
                    
                    <div class="example">
                        <p><strong>Examples:</strong></p>
                        <ul>
                            <li><a href="/api/player?endpoint=taxi-driver-2025-v1cy">Taxi Driver 3</a></li>
                            <li><a href="/api/test-stream">Test Player</a></li>
                            <li><a href="/api">API Documentation</a></li>
                        </ul>
                    </div>
                </div>
            </body>
            </html>
            `);
        }
        
        // Redirect ke player.html dengan endpoint
        res.redirect(`/player.html?endpoint=${encodeURIComponent(endpoint)}`);
    } catch (error) {
        console.error('Player route error:', error);
        res.status(500).send('Internal server error');
    }
});

// Test stream dengan parameter
app.get('/api/test-stream', (req, res) => {
    const { endpoint } = req.query;
    const testEndpoint = endpoint || 'taxi-driver-2025-v1cy';
    res.redirect(`/api/player?endpoint=${testEndpoint}`);
});

// Direct player route
app.get('/player', (req, res) => {
    try {
        const { endpoint } = req.query;
        const playerPath = path.join(__dirname, '..', 'public', 'player.html');
        
        if (endpoint) {
            // Jika ada endpoint, serve player.html dengan query string
            res.redirect(`/player.html?endpoint=${encodeURIComponent(endpoint)}`);
        } else {
            // Jika tidak ada endpoint, serve player.html biasa
            res.sendFile(playerPath, (err) => {
                if (err) {
                    console.error('Error sending player.html:', err);
                    res.status(404).send('Player page not found');
                }
            });
        }
    } catch (error) {
        console.error('Player route error:', error);
        res.status(500).send('Internal server error');
    }
});

// Static route untuk player.html
app.get('/player.html', (req, res) => {
    try {
        const playerPath = path.join(__dirname, '..', 'public', 'player.html');
        res.sendFile(playerPath, (err) => {
            if (err) {
                console.error('Cannot find player.html:', err);
                res.status(404).send(`
                    <h1>Player Not Found</h1>
                    <p>Make sure player.html exists in the public folder.</p>
                    <a href="/api/player">Go back to player form</a>
                `);
            }
        });
    } catch (error) {
        console.error('Error serving player.html:', error);
        res.status(500).send('Internal server error');
    }
});

// Stream route (alias untuk player)
app.get('/api/stream', (req, res) => {
    const { endpoint } = req.query;
    if (endpoint) {
        res.redirect(`/api/player?endpoint=${endpoint}`);
    } else {
        res.redirect('/api/player');
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('🚨 API Error:', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method
    });
    
    res.status(err.status || 500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
        request_id: req.id || Date.now(),
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use('*', (req, res) => {
    console.log(`404: ${req.method} ${req.originalUrl}`);
    
    if (req.url.startsWith('/api')) {
        res.status(404).json({
            success: false,
            error: 'API endpoint not found',
            requested_url: req.originalUrl,
            available_endpoints: '/api'
        });
    } else {
        res.status(404).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>404 - Page Not Found</title>
                <style>
                    body { margin: 0; padding: 40px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f8f9fa; }
                    .container { max-width: 600px; margin: 0 auto; text-align: center; }
                    h1 { color: #dc3545; font-size: 48px; margin-bottom: 20px; }
                    p { color: #666; font-size: 18px; margin-bottom: 30px; }
                    .links { display: flex; gap: 15px; justify-content: center; }
                    a { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 6px; transition: background 0.3s; }
                    a:hover { background: #0056b3; }
                    .secondary { background: #6c757d; }
                    .secondary:hover { background: #545b62; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>404</h1>
                    <p>The page you're looking for doesn't exist.</p>
                    <div class="links">
                        <a href="/api">API Documentation</a>
                        <a href="/api/player" class="secondary">Player</a>
                    </div>
                </div>
            </body>
            </html>
        `);
    }
});

// Untuk local development
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`
        🚀 Server is running!
        📍 Local: http://localhost:${PORT}
        📍 API: http://localhost:${PORT}/api
        🎬 Player: http://localhost:${PORT}/api/player
        
        🌐 Environment: ${process.env.NODE_ENV || 'development'}
        🔗 Base URL: ${process.env.DRAKORKITA_URL || 'Not set'}
        `);
    });
}

module.exports = app;
