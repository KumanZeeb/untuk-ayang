const axios = require("axios")
const cheerio = require('cheerio');
const {
    scrapeSeries,
    scrapeSeriesUpdated,
    scrapeMovie,
    scrapeNewMovie,
    scrapeOngoingSeries,
    scrapeCompletedSeries,
    scrapeGenres,
    scrapeDetailGenres,
    scrapeSearch,
    scrapeDetailAllType,
} = require('../scrapers/drakorkita')

// Enhanced Headers untuk menyerupai browser asli
const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Cache-Control": "max-age=0",
    "sec-ch-ua": '"Chromium";v="120", "Google Chrome";v="120", "Not?A_Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"'
};

// Konfigurasi CORS Proxy Services yang benar
const corsProxyServices = [
    {
        name: 'allorigins',
        buildUrl: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
    },
    {
        name: 'corsproxy',
        buildUrl: (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`
    },
    {
        name: 'codetabs',
        buildUrl: (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
    },
    {
        name: 'thingproxy',
        buildUrl: (url) => `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(url)}`
    },
    {
        name: 'corsanywhere',
        buildUrl: (url) => `https://cors-anywhere.herokuapp.com/${url}`
    }
];

// Utility functions untuk request dengan retry dan proxy fallback
class SmartRequest {
    constructor(maxRetries = 3) {
        this.maxRetries = maxRetries;
        this.requestTimeout = 30000; // 30 detik untuk direct
        this.proxyTimeout = 20000; // 20 detik untuk proxy
        this.requestCount = 0;
    }

    // Helper untuk delay
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Enhanced request dengan better error handling
    async enhancedRequest(url, options, requestType = 'direct') {
        this.requestCount++;
        const requestId = `req-${this.requestCount}-${requestType}`;
        
        console.log(`[${requestId}] Starting ${requestType} request to:`, 
                   url.length > 100 ? url.substring(0, 100) + '...' : url);
        
        try {
            const config = {
                ...options,
                timeout: requestType === 'direct' ? this.requestTimeout : this.proxyTimeout,
                validateStatus: function (status) {
                    return status >= 200 && status < 500; // Terima semua kecuali 500+
                },
                maxRedirects: 5,
                responseType: 'text',
                responseEncoding: 'utf-8'
            };
            
            const startTime = Date.now();
            const response = await axios.get(url, config);
            const duration = Date.now() - startTime;
            
            console.log(`[${requestId}] ${requestType} succeeded in ${duration}ms - Status: ${response.status}`);
            
            // Validasi response
            if (!response.data) {
                throw new Error(`Empty response from ${requestType}`);
            }
            
            return response;
            
        } catch (error) {
            const errorInfo = {
                type: requestType,
                url: url.length > 100 ? url.substring(0, 100) + '...' : url,
                code: error.code,
                status: error.response?.status,
                message: error.message
            };
            
            console.log(`[${requestId}] ${requestType} failed:`, errorInfo);
            
            // Re-throw dengan info lebih jelas
            const enhancedError = new Error(
                `${requestType} request failed: ${error.message}`
            );
            enhancedError.originalError = error;
            enhancedError.requestInfo = errorInfo;
            throw enhancedError;
        }
    }

    // Smart request dengan fallback system yang lebih baik
    async smartRequest(targetUrl, customOptions = {}) {
        const requestId = `smart-${Date.now()}`;
        console.log(`[${requestId}] Starting smart request for:`, targetUrl);
        
        const defaultOptions = {
            headers: headers,
            timeout: this.requestTimeout
        };
        
        const options = { ...defaultOptions, ...customOptions };
        
        let lastError = null;
        let successfulMethod = null;
        
        // Coba direct request pertama
        try {
            console.log(`[${requestId}] Attempt 1: Direct request`);
            const response = await this.enhancedRequest(targetUrl, options, 'direct');
            
            // Validasi response data
            if (response.data && response.status === 200) {
                console.log(`[${requestId}] ✅ Direct request successful`);
                return response;
            }
            
        } catch (directError) {
            lastError = directError;
            console.log(`[${requestId}] Direct request failed:`, directError.message);
            
            // Coba dengan proxy services secara berurutan
            for (let i = 0; i < corsProxyServices.length; i++) {
                const proxy = corsProxyServices[i];
                
                try {
                    console.log(`[${requestId}] Attempt ${i + 2}: Proxy ${proxy.name}`);
                    
                    // Tunggu sebentar sebelum mencoba proxy berikutnya
                    if (i > 0) {
                        await this.delay(1000);
                    }
                    
                    const proxyUrl = proxy.buildUrl(targetUrl);
                    const proxyOptions = {
                        ...options,
                        headers: {
                            ...options.headers,
                            'Accept': '*/*',
                            'Accept-Encoding': 'gzip, deflate, br'
                        }
                    };
                    
                    const response = await this.enhancedRequest(proxyUrl, proxyOptions, `proxy-${proxy.name}`);
                    
                    // Validasi proxy response
                    if (response.data && response.status === 200) {
                        successfulMethod = proxy.name;
                        console.log(`[${requestId}] ✅ Proxy ${proxy.name} successful`);
                        return response;
                    }
                    
                } catch (proxyError) {
                    lastError = proxyError;
                    console.log(`[${requestId}] Proxy ${proxy.name} failed:`, proxyError.message);
                }
            }
        }
        
        // Jika semua gagal, coba retry dengan exponential backoff
        for (let retry = 1; retry <= this.maxRetries; retry++) {
            try {
                console.log(`[${requestId}] Retry ${retry}/${this.maxRetries}`);
                
                // Exponential backoff: 2s, 4s, 8s
                const delayMs = 2000 * Math.pow(2, retry - 1);
                await this.delay(delayMs);
                
                // Untuk retry, coba langsung ke target
                const response = await this.enhancedRequest(targetUrl, options, `retry-${retry}`);
                
                if (response.data && response.status === 200) {
                    console.log(`[${requestId}] ✅ Retry ${retry} successful`);
                    return response;
                }
                
            } catch (retryError) {
                lastError = retryError;
                console.log(`[${requestId}] Retry ${retry} failed:`, retryError.message);
            }
        }
        
        // Jika semua gagal
        const finalError = new Error(
            `All request methods failed after ${this.maxRetries} retries. ` +
            `Last error: ${lastError?.message || 'Unknown'}`
        );
        finalError.lastError = lastError;
        finalError.requestId = requestId;
        finalError.targetUrl = targetUrl;
        
        console.error(`[${requestId}] ❌ All methods failed:`, finalError.message);
        throw finalError;
    }
}

// Inisialisasi smart request
const smartRequest = new SmartRequest(3);

// Fungsi helper untuk semua endpoint dengan enhanced error handling
const makeRequest = async (url, req) => {
    const requestInfo = {
        url: url,
        endpoint: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
    };
    
    console.log(`🌐 Making request:`, requestInfo);
    
    try {
        // Tambahkan referer header jika tersedia
        const enhancedHeaders = {
            ...headers,
            'Referer': process.env.DRAKORKITA_URL || 'https://drakorkita.tv',
            'Origin': process.env.DRAKORKITA_URL || 'https://drakorkita.tv'
        };
        
        const response = await smartRequest.smartRequest(url, { headers: enhancedHeaders });
        
        console.log(`✅ Request successful for: ${url}`);
        return response;
        
    } catch (error) {
        console.error(`❌ Request failed for ${url}:`, {
            message: error.message,
            url: url,
            originalError: error.originalError?.message
        });
        
        // Enhanced error dengan kategori
        const enhancedError = new Error(
            `Failed to fetch data from ${new URL(url).hostname}. ` +
            `Please try again later or use a different endpoint.`
        );
        
        enhancedError.statusCode = 
            error.originalError?.response?.status || 
            error.code === 'ECONNABORTED' ? 408 : 500;
            
        enhancedError.isTimeout = error.code === 'ECONNABORTED';
        enhancedError.isNetworkError = ['ENOTFOUND', 'ECONNREFUSED'].includes(error.code);
        
        throw enhancedError;
    }
};

// Helper untuk handle response
const handleSuccessResponse = (res, data, additionalInfo = {}) => {
    res.status(200).json({
        success: true,
        message: "Request successful",
        timestamp: new Date().toISOString(),
        ...data,
        ...additionalInfo
    });
};

// Helper untuk handle error
const handleErrorResponse = (res, endpoint, error) => {
    console.error(`🚨 Error in ${endpoint}:`, {
        message: error.message,
        endpoint: endpoint,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    
    const statusCode = error.statusCode || 500;
    const errorMessage = process.env.NODE_ENV === 'production' 
        ? getFriendlyErrorMessage(error)
        : error.message;
    
    res.status(statusCode).json({
        success: false,
        error: errorMessage,
        endpoint: endpoint,
        timestamp: new Date().toISOString(),
        retry_suggestion: "Please try again in a few moments"
    });
};

// Helper untuk user-friendly error messages
const getFriendlyErrorMessage = (error) => {
    if (error.isTimeout) {
        return "Request timeout. The server is taking too long to respond.";
    }
    if (error.isNetworkError) {
        return "Network error. Please check your internet connection.";
    }
    if (error.message.includes('404')) {
        return "Content not found. The requested resource may have been removed.";
    }
    if (error.message.includes('403') || error.message.includes('401')) {
        return "Access denied. The server refused the request.";
    }
    if (error.message.includes('429')) {
        return "Too many requests. Please wait a moment before trying again.";
    }
    return "An error occurred while processing your request. Please try again.";
};

// ===== ENDPOINT CONTROLLERS =====

const seriesAll = async (req, res) => {
    try {
        const { page = 1 } = req.query;
        const url = `${process.env.DRAKORKITA_URL}/all?media_type=tv&page=${page}`;
        
        console.log(`📺 Fetching series page ${page}`);
        const axiosRequest = await makeRequest(url, req);
        const datas = await scrapeSeries(req, axiosRequest);

        handleSuccessResponse(res, datas, {
            page: parseInt(page),
            total_pages: datas.total_pages || 1
        });
        
    } catch (e) {
        handleErrorResponse(res, 'seriesAll', e);
    }
};

const seriesUpdated = async (req, res) => {
    try {
        const url = `${process.env.DRAKORKITA_URL}`;
        
        console.log(`🔄 Fetching updated series`);
        const axiosRequest = await makeRequest(url, req);
        const datas = await scrapeSeriesUpdated(req, axiosRequest);

        handleSuccessResponse(res, { datas });
        
    } catch (e) {
        handleErrorResponse(res, 'seriesUpdated', e);
    }
};

const movieAll = async (req, res) => {
    try {
        const { page = 1 } = req.query;
        const url = `${process.env.DRAKORKITA_URL}/all?media_type=movie&page=${page}`;
        
        console.log(`🎬 Fetching movies page ${page}`);
        const axiosRequest = await makeRequest(url, req);
        const datas = await scrapeMovie(req, axiosRequest);

        handleSuccessResponse(res, datas, {
            page: parseInt(page),
            total_pages: datas.total_pages || 1
        });
        
    } catch (e) {
        handleErrorResponse(res, 'movieAll', e);
    }
};

const newMovie = async (req, res) => {
    try {
        const url = `${process.env.DRAKORKITA_URL}`;
        
        console.log(`🎥 Fetching new movies`);
        const axiosRequest = await makeRequest(url, req);
        const datas = await scrapeNewMovie(req, axiosRequest);

        handleSuccessResponse(res, { datas });
        
    } catch (e) {
        handleErrorResponse(res, 'newMovie', e);
    }
};

const ongoingSeries = async (req, res) => {
    try {
        const { page = 1 } = req.query;
        const url = `${process.env.DRAKORKITA_URL}/all?status=returning&page=${page}`;
        
        console.log(`▶️ Fetching ongoing series page ${page}`);
        const axiosRequest = await makeRequest(url, req);
        const datas = await scrapeOngoingSeries(req, axiosRequest);

        handleSuccessResponse(res, datas, {
            page: parseInt(page),
            total_pages: datas.total_pages || 1
        });
        
    } catch (e) {
        handleErrorResponse(res, 'ongoingSeries', e);
    }
};

const completedSeries = async (req, res) => {
    try {
        const { page = 1 } = req.query;
        const url = `${process.env.DRAKORKITA_URL}/all?status=ended&page=${page}`;
        
        console.log(`✅ Fetching completed series page ${page}`);
        const axiosRequest = await makeRequest(url, req);
        const datas = await scrapeCompletedSeries(req, axiosRequest);

        handleSuccessResponse(res, datas, {
            page: parseInt(page),
            total_pages: datas.total_pages || 1
        });
        
    } catch (e) {
        handleErrorResponse(res, 'completedSeries', e);
    }
};

const genres = async (req, res) => {
    try {
        const url = `${process.env.DRAKORKITA_URL}`;
        
        console.log(`🏷️ Fetching genres`);
        const axiosRequest = await makeRequest(url, req);
        const datas = await scrapeGenres(req, axiosRequest);

        handleSuccessResponse(res, { datas });
        
    } catch (e) {
        handleErrorResponse(res, 'genres', e);
    }
};

const detailGenres = async (req, res) => {
    try {
        const { page = 1 } = req.query;
        const { endpoint } = req.params;
        const url = `${process.env.DRAKORKITA_URL}/all?genre=${endpoint}&page=${page}`;
        
        console.log(`🔍 Fetching genre: ${endpoint}, page: ${page}`);
        const axiosRequest = await makeRequest(url, req);
        const datas = await scrapeDetailGenres({ page, endpoint }, axiosRequest);

        handleSuccessResponse(res, datas, {
            page: parseInt(page),
            genre: endpoint,
            total_pages: datas.total_pages || 1
        });
        
    } catch (e) {
        handleErrorResponse(res, 'detailGenres', e);
    }
};

const searchAll = async (req, res) => {
    try {
        const { s, page = 1 } = req.query;
        const url = `${process.env.DRAKORKITA_URL}/all?q=${s}&page=${page}`;
        
        console.log(`🔎 Searching: "${s}", page: ${page}`);
        const axiosRequest = await makeRequest(url, req);
        const datas = await scrapeSearch(req, axiosRequest);

        handleSuccessResponse(res, datas, {
            page: parseInt(page),
            keyword: s,
            total_results: datas.total_results || 0,
            total_pages: datas.total_pages || 1
        });
        
    } catch (e) {
        handleErrorResponse(res, 'searchAll', e);
    }
};

const detailAllType = async (req, res) => {
    try {
        const { endpoint } = req.params;
        const url = `${process.env.DRAKORKITA_URL}/detail/${endpoint}`;
        
        console.log(`📄 Fetching details for: ${endpoint}`);
        const axiosRequest = await makeRequest(url, req);
        const data = await scrapeDetailAllType({ endpoint }, axiosRequest);

        handleSuccessResponse(res, { data });
        
    } catch (e) {
        handleErrorResponse(res, 'detailAllType', e);
    }
};

const getVideoUrl = async (req, res) => {
    try {
        const { endpoint } = req.params;
        const { episode = 0, resolution = 0 } = req.query;
        
        // Validasi parameter
        if (!endpoint) {
            return res.status(400).json({
                success: false,
                error: 'Endpoint is required',
                suggestion: 'Provide a valid series endpoint'
            });
        }
        
        // Konversi ke number
        const epNum = parseInt(episode) || 0;
        const resNum = parseInt(resolution) || 0;
        
        console.log(`🎥 Getting video for: ${endpoint}, episode: ${epNum + 1}`);
        
        // Get detail data
        const detailUrl = `${process.env.DRAKORKITA_URL}/detail/${endpoint}`;
        console.log(`🔗 Detail URL: ${detailUrl}`);
        
        const detailResponse = await makeRequest(detailUrl, req);
        const $ = cheerio.load(detailResponse.data);
        
        // Extract video URL logic
        const onclick = $("div.pagination > a").last().attr("onclick");
        if (!onclick) {
            return res.status(404).json({
                success: false,
                error: 'Video data not found',
                suggestion: 'This series may not have video content available'
            });
        }
        
        const movieIdAndTag = onclick.substring(onclick.indexOf("(") + 1, onclick.indexOf(")"));
        const movieId = movieIdAndTag.split(",")[0].replace(/^'|'$/g, '');
        const tag = movieIdAndTag.split(",")[1].replace(/^'|'$/g, '');
        
        console.log(`🎬 Movie ID: ${movieId}, Tag: ${tag}`);
        
        // Get episode list
        const episodeUrl = `${process.env.DRAKORKITA_URL}/api/episode.php?movie_id=${movieId}&tag=${tag}`;
        const episodeResponse = await makeRequest(episodeUrl, req);
        
        if (!episodeResponse.data || !episodeResponse.data.episode_lists) {
            throw new Error('Invalid episode data format');
        }
        
        const $eps = cheerio.load(episodeResponse.data.episode_lists);
        const episodes = $eps("p > a").get();
        
        if (episodes.length === 0) {
            throw new Error('No episodes available');
        }
        
        // Validasi episode
        if (epNum >= episodes.length || epNum < 0) {
            return res.status(400).json({
                success: false,
                error: `Invalid episode number`,
                available_episodes: episodes.length,
                requested_episode: epNum + 1
            });
        }
        
        // Get selected episode
        const selectedEpisode = episodes[epNum];
        const epsWrap = $(selectedEpisode).attr('onclick');
        if (!epsWrap) {
            return res.status(404).json({
                success: false,
                error: 'Episode data not found'
            });
        }
        
        const epsIdAndTag = epsWrap.substring(epsWrap.indexOf("(") + 1, epsWrap.indexOf(")"));
        const epsId = epsIdAndTag.split(",")[0].replace(/^'|'$/g, '');
        const epsTag = epsIdAndTag.split(",")[1].replace(/^'|'$/g, '');
        
        console.log(`🎯 Episode ID: ${epsId}, Episode Tag: ${epsTag}`);
        
        // Get server info
        const serverUrl = `${process.env.DRAKORKITA_URL}/api/server.php?episode_id=${epsId}&tag=${epsTag}`;
        const serverResponse = await makeRequest(serverUrl, req);
        
        if (!serverResponse.data || !serverResponse.data.data) {
            throw new Error('Invalid server response');
        }
        
        const { qua, server_id } = serverResponse.data.data;
        
        // Get video URL
        const videoUrl = `${process.env.DRAKORKITA_URL}/api/video.php?id=${epsId}&qua=${qua}&server_id=${server_id}&tag=${epsTag}`;
        const videoResponse = await makeRequest(videoUrl, req);
        
        if (!videoResponse.data || !videoResponse.data.file) {
            throw new Error('Invalid video response');
        }
        
        const fileData = videoResponse.data.file;
        const videoUrls = Array.isArray(fileData) ? fileData : fileData.split(",");
        
        if (videoUrls.length === 0) {
            throw new Error('No video URLs found');
        }
        
        // Validasi resolution
        if (resNum >= videoUrls.length || resNum < 0) {
            return res.status(400).json({
                success: false,
                error: `Invalid resolution`,
                available_resolutions: videoUrls.length,
                requested_resolution: resNum
            });
        }
        
        const selectedUrl = videoUrls[resNum] || videoUrls[0];
        let finalVideoUrl = selectedUrl;
        
        // Extract clean URL
        if (typeof selectedUrl === 'string') {
            const httpsIndex = selectedUrl.indexOf('https');
            if (httpsIndex !== -1) {
                finalVideoUrl = selectedUrl.substring(httpsIndex)
                    .replace(/['"]/g, '')
                    .split(' ')[0]
                    .trim();
            }
        }
        
        console.log(`✅ Successfully got video URL for ${endpoint}`);
        
        res.status(200).json({
            success: true,
            data: {
                episode: epNum + 1,
                total_episodes: episodes.length,
                resolution: resNum,
                total_resolutions: videoUrls.length,
                video_url: finalVideoUrl,
                headers_required: {
                    referer: process.env.DRAKORKITA_URL,
                    origin: process.env.DRAKORKITA_URL,
                    'user-agent': headers['User-Agent']
                },
                metadata: {
                    endpoint: endpoint,
                    movie_id: movieId,
                    episode_id: epsId,
                    quality: qua,
                    server_id: server_id
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Error in getVideoUrl:', error.message);
        
        res.status(500).json({
            success: false,
            error: 'Failed to get video URL',
            message: process.env.NODE_ENV === 'production' 
                ? 'Unable to retrieve video. Please try another episode or series.'
                : error.message,
            endpoint: req.params.endpoint
        });
    }
};

// Health check endpoint
const healthCheck = async (req, res) => {
    try {
        const url = process.env.DRAKORKITA_URL || 'https://drakorkita.tv';
        await makeRequest(url, req);
        
        res.status(200).json({
            success: true,
            message: 'API is healthy and connected to source',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            proxies_available: corsProxyServices.length,
            smart_request_count: smartRequest.requestCount
        });
    } catch (error) {
        res.status(503).json({
            success: false,
            message: 'API health check failed',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
};

module.exports = {
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
    healthCheck
};
