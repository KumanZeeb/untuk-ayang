const { Router } = require("express")
const router = Router()

const {
    seriesAll,
    seriesUpdated,
    movieAll,
    newMovie,
    ongoingSeries,
    completedSeries,
    genres,
    detailGenres,
    searchAll,
    detailAllType,
    getVideoUrl,
    healthCheck  // Tambahkan ini jika ada di controller
} = require("../controllers/drakorkita");

// ===== MIDDLEWARE =====
// Middleware untuk logging requests
const requestLogger = (req, res, next) => {
    console.log(`🌐 [${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    console.log(`   Query:`, req.query);
    console.log(`   Params:`, req.params);
    next();
};

// Middleware untuk validasi query parameters
const validateQueryParams = (req, res, next) => {
    const { page } = req.query;
    
    if (page && (isNaN(page) || parseInt(page) < 1)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid page parameter. Page must be a positive number.',
            received: page
        });
    }
    
    next();
};

// Middleware untuk rate limiting (basic)
const requestCounter = {};
const rateLimiter = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowMs = 60000; // 1 minute window
    const maxRequests = 100; // 100 requests per minute
    
    if (!requestCounter[ip]) {
        requestCounter[ip] = [];
    }
    
    // Clean old requests
    requestCounter[ip] = requestCounter[ip].filter(time => now - time < windowMs);
    
    if (requestCounter[ip].length >= maxRequests) {
        return res.status(429).json({
            success: false,
            error: 'Too many requests. Please wait a minute.',
            retry_after: Math.ceil((requestCounter[ip][0] + windowMs - now) / 1000)
        });
    }
    
    requestCounter[ip].push(now);
    next();
};

// Apply global middleware
router.use(requestLogger);
router.use(rateLimiter);

// ===== ROUTES =====

// Root API endpoint
router.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Drakorkita API",
        version: "1.0.0",
        endpoints: {
            // Series
            series_all: {
                path: "/series",
                description: "Get all series with pagination",
                query_params: ["page"],
                example: "/series?page=1"
            },
            series_updated: {
                path: "/series/updated",
                description: "Get recently updated series",
                example: "/series/updated"
            },
            series_ongoing: {
                path: "/series/ongoing",
                description: "Get ongoing series",
                query_params: ["page"],
                example: "/series/ongoing?page=1"
            },
            series_completed: {
                path: "/series/completed",
                description: "Get completed series",
                query_params: ["page"],
                example: "/series/completed?page=1"
            },
            
            // Movies
            movie_all: {
                path: "/movie",
                description: "Get all movies with pagination",
                query_params: ["page"],
                example: "/movie?page=1"
            },
            movie_newest: {
                path: "/movie/newest",
                description: "Get newest movies",
                example: "/movie/newest"
            },
            
            // Genres
            genres_all: {
                path: "/genres",
                description: "Get all available genres",
                example: "/genres"
            },
            genre_detail: {
                path: "/genres/:genre",
                description: "Get content by specific genre",
                query_params: ["page"],
                example: "/genres/action?page=1"
            },
            
            // Search
            search: {
                path: "/search",
                description: "Search for content",
                query_params: ["s", "page"],
                example: "/search?s=avenger&page=1"
            },
            
            // Detail
            detail: {
                path: "/detail/:endpoint",
                description: "Get detailed information about a series/movie",
                example: "/detail/taxi-driver-2025-v1cy"
            },
            
            // Video
            video: {
                path: "/video/:endpoint",
                description: "Get video streaming URL",
                query_params: ["episode", "resolution"],
                example: "/video/taxi-driver-2025-v1cy?episode=0&resolution=0"
            },
            
            // Health
            health: {
                path: "/health",
                description: "API health check",
                example: "/health"
            }
        },
        documentation: "Visit /api for complete API documentation",
        base_url: process.env.DRAKORKITA_URL || "https://drakorkita.tv",
        note: "All endpoints support CORS and return JSON responses"
    });
});

// Health check endpoint
router.get("/health", async (req, res) => {
    try {
        if (healthCheck) {
            return await healthCheck(req, res);
        }
        
        res.json({
            success: true,
            message: "API is running",
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage()
        });
    } catch (error) {
        res.status(503).json({
            success: false,
            error: "Health check failed",
            message: error.message
        });
    }
});

// ===== MAIN ROUTES =====

// Series routes
router.get("/series", validateQueryParams, seriesAll);
router.get("/series/updated", seriesUpdated);
router.get("/series/ongoing", validateQueryParams, ongoingSeries);
router.get("/series/completed", validateQueryParams, completedSeries);

// Movie routes
router.get("/movie", validateQueryParams, movieAll);
router.get("/movie/newest", newMovie);

// Genre routes
router.get("/genres", genres);
router.get("/genres/:endpoint", validateQueryParams, detailGenres);

// Search route
router.get("/search", validateQueryParams, searchAll);

// Detail route
router.get("/detail/:endpoint", detailAllType);

// Video route
router.get("/video/:endpoint", getVideoUrl);

// ===== ALIAS ROUTES (untuk kompatibilitas) =====
router.get("/tv", validateQueryParams, seriesAll); // Alias untuk /series
router.get("/films", validateQueryParams, movieAll); // Alias untuk /movie
router.get("/find", validateQueryParams, searchAll); // Alias untuk /search
router.get("/watch/:endpoint", getVideoUrl); // Alias untuk /video

// ===== CATCH-ALL FOR INVALID ROUTES =====
router.use("*", (req, res) => {
    res.status(404).json({
        success: false,
        error: "Endpoint not found",
        requested_url: req.originalUrl,
        available_endpoints: "/api/drakorkita",
        suggestion: "Visit the root endpoint for available routes"
    });
});

// ===== ERROR HANDLING MIDDLEWARE =====
router.use((err, req, res, next) => {
    console.error("Route Error:", {
        message: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method
    });
    
    const statusCode = err.status || 500;
    const errorMessage = process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred'
        : err.message;
    
    res.status(statusCode).json({
        success: false,
        error: errorMessage,
        endpoint: req.originalUrl,
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

module.exports = router;
