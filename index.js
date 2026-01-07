const app = require('./api/index.js'); // Import dari api/index.js
const PORT = process.env.PORT || 3000;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`✅ Local server running on http://localhost:${PORT}`);
        console.log(`📚 API Documentation: http://localhost:${PORT}/api`);
        console.log(`🎬 Player: http://localhost:${PORT}/player`);
        console.log(`🎬 Example: http://localhost:${PORT}/player?endpoint=taxi-driver-2025-v1cy`);
        console.log(`🎬 Test: http://localhost:${PORT}/api/test-stream`);
    });
}

module.exports = app;