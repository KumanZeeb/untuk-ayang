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

const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
}

// Konfigurasi CORS Proxy Services
const corsProxyServices = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
    'https://api.codetabs.com/v1/proxy?quest=',
    'https://thingproxy.freeboard.io/fetch/',
    'https://cors-anywhere.herokuapp.com/'
];

// Utility functions untuk request dengan retry dan proxy fallback
class SmartRequest {
    constructor(maxRetries = 3) {
        this.maxRetries = maxRetries;
        this.currentProxyIndex = 0;
    }

    // Helper untuk encode URL
    encodeUrl(url) {
        return encodeURIComponent(url);
    }

    // Build URL dengan proxy service
    buildProxyUrl(url, proxyIndex) {
        const encodedUrl = this.encodeUrl(url);
        const proxyBase = corsProxyServices[proxyIndex];
        
        switch(proxyIndex) {
            case 0: // allorigins.win
                return `${proxyBase}${url}`;
            case 1: // corsproxy.io
                return `${proxyBase}${url}`;
            case 2: // codetabs.com
                return `${proxyBase}${url}`;
            case 3: // thingproxy
                return `${proxyBase}${url}`;
            case 4: // cors-anywhere
                return `${proxyBase}${url}`;
            default:
                return url;
        }
    }

    // Smart request dengan fallback system
    async smartRequest(url, options = {}, retryCount = 0) {
        const requestMethods = [
            // Method 1: Direct request (tanpa proxy)
            async () => {
                console.log(`Attempt ${retryCount + 1}: Direct request`);
                return await axios.get(url, { ...options, timeout: 10000 });
            },
            // Method 2-6: CORS Proxy Services
            ...corsProxyServices.map((_, index) => async () => {
                console.log(`Attempt ${retryCount + 1}: Using proxy service ${index + 1}`);
                const proxyUrl = this.buildProxyUrl(url, index);
                return await axios.get(proxyUrl, { 
                    ...options, 
                    timeout: 15000,
                    headers: {
                        ...options.headers,
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Accept-Encoding': 'gzip, deflate, br',
                    }
                });
            })
        ];

        // Coba semua method secara berurutan
        for (let i = 0; i < requestMethods.length; i++) {
            try {
                const response = await requestMethods[i]();
                if (response.status >= 200 && response.status < 300) {
                    console.log(`Success with method ${i === 0 ? 'direct' : `proxy ${i}`}`);
                    return response;
                }
            } catch (error) {
                // Jika bukan error 500, throw langsung
                if (error.response && error.response.status !== 500 && error.response.status !== 429) {
                    console.log(`Non-retryable error: ${error.response?.status || error.code}`);
                    throw error;
                }
                
                console.log(`Method ${i} failed: ${error.response?.status || error.code || error.message}`);
                
                // Tunggu sebentar sebelum mencoba method berikutnya
                if (i < requestMethods.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
                }
            }
        }

        // Jika semua gagal, coba retry
        if (retryCount < this.maxRetries) {
            console.log(`All methods failed, retrying... (${retryCount + 1}/${this.maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
            return this.smartRequest(url, options, retryCount + 1);
        }

        throw new Error('All request methods failed after retries');
    }
}

// Inisialisasi smart request
const smartRequest = new SmartRequest(3);

// Fungsi helper untuk semua endpoint
const makeRequest = async (url, req) => {
    try {
        return await smartRequest.smartRequest(url, { headers });
    } catch (error) {
        console.error(`Request failed for ${url}:`, error.message);
        throw error;
    }
};

const seriesAll = async (req, res) => {
    try {
        const { page = 1 } = req.query;
        const url = `${process.env.DRAKORKITA_URL}/all?media_type=tv&page=${page}`;
        
        const axiosRequest = await makeRequest(url, req);
        const datas = await scrapeSeries(req, axiosRequest);

        res.status(200).json({
            message: "success",
            page: parseInt(page),
            ...datas
        });
    } catch (e) {
        console.error('Error in seriesAll:', e.message);
        res.status(500).json({
            message: `Failed to fetch series: ${e.message}`,
            success: false
        });
    }
};

const seriesUpdated = async (req, res) => {
    try {
        const url = `${process.env.DRAKORKITA_URL}`;
        const axiosRequest = await makeRequest(url, req);
        const datas = await scrapeSeriesUpdated(req, axiosRequest);

        res.status(200).json({
            message: "success",
            datas
        });
    } catch (e) {
        console.error('Error in seriesUpdated:', e.message);
        res.status(500).json({
            message: `Failed to fetch updated series: ${e.message}`,
            success: false
        });
    }
};

const movieAll = async (req, res) => {
    try {
        const { page = 1 } = req.query;
        const url = `${process.env.DRAKORKITA_URL}/all?media_type=movie&page=${page}`;
        
        const axiosRequest = await makeRequest(url, req);
        const datas = await scrapeMovie(req, axiosRequest);

        res.status(200).json({
            message: "success",
            page: parseInt(page),
            ...datas
        });
    } catch (e) {
        console.error('Error in movieAll:', e.message);
        res.status(500).json({
            message: `Failed to fetch movies: ${e.message}`,
            success: false
        });
    }
};

const newMovie = async (req, res) => {
    try {
        const url = `${process.env.DRAKORKITA_URL}`;
        const axiosRequest = await makeRequest(url, req);
        const datas = await scrapeNewMovie(req, axiosRequest);

        res.status(200).json({
            message: "success",
            datas
        });
    } catch (e) {
        console.error('Error in newMovie:', e.message);
        res.status(500).json({
            message: `Failed to fetch new movies: ${e.message}`,
            success: false
        });
    }
};

const ongoingSeries = async (req, res) => {
    try {
        const { page = 1 } = req.query;
        const url = `${process.env.DRAKORKITA_URL}/all?status=returning&page=${page}`;
        
        const axiosRequest = await makeRequest(url, req);
        const datas = await scrapeOngoingSeries(req, axiosRequest);

        res.status(200).json({
            message: "success",
            page: parseInt(page),
            ...datas
        });
    } catch (e) {
        console.error('Error in ongoingSeries:', e.message);
        res.status(500).json({
            message: `Failed to fetch ongoing series: ${e.message}`,
            success: false
        });
    }
};

const completedSeries = async (req, res) => {
    try {
        const { page = 1 } = req.query;
        const url = `${process.env.DRAKORKITA_URL}/all?status=ended&page=${page}`;
        
        const axiosRequest = await makeRequest(url, req);
        const datas = await scrapeCompletedSeries(req, axiosRequest);

        res.status(200).json({
            message: "success",
            page: parseInt(page),
            ...datas
        });
    } catch (e) {
        console.error('Error in completedSeries:', e.message);
        res.status(500).json({
            message: `Failed to fetch completed series: ${e.message}`,
            success: false
        });
    }
};

const genres = async (req, res) => {
    try {
        const url = `${process.env.DRAKORKITA_URL}`;
        const axiosRequest = await makeRequest(url, req);
        const datas = await scrapeGenres(req, axiosRequest);

        res.status(200).json({
            message: "success",
            datas
        });
    } catch (e) {
        console.error('Error in genres:', e.message);
        res.status(500).json({
            message: `Failed to fetch genres: ${e.message}`,
            success: false
        });
    }
};

const detailGenres = async (req, res) => {
    try {
        const { page = 1 } = req.query;
        const { endpoint } = req.params;
        const url = `${process.env.DRAKORKITA_URL}/all?genre=${endpoint}&page=${page}`;
        
        const axiosRequest = await makeRequest(url, req);
        const datas = await scrapeDetailGenres({ page, endpoint }, axiosRequest);

        res.status(200).json({
            message: "success",
            page: parseInt(page),
            ...datas
        });
    } catch (e) {
        console.error('Error in detailGenres:', e.message);
        res.status(500).json({
            message: `Failed to fetch genre details: ${e.message}`,
            success: false
        });
    }
};

const searchAll = async (req, res) => {
    try {
        const { s, page = 1 } = req.query;
        const url = `${process.env.DRAKORKITA_URL}/all?q=${s}&page=${page}`;
        
        const axiosRequest = await makeRequest(url, req);
        const datas = await scrapeSearch(req, axiosRequest);

        res.status(200).json({
            message: "success",
            page: parseInt(page),
            keyword: s,
            ...datas
        });
    } catch (e) {
        console.error('Error in searchAll:', e.message);
        res.status(500).json({
            message: `Failed to search: ${e.message}`,
            success: false
        });
    }
};

const detailAllType = async (req, res) => {
    try {
        const { endpoint } = req.params;
        const url = `${process.env.DRAKORKITA_URL}/detail/${endpoint}`;
        
        const axiosRequest = await makeRequest(url, req);
        const data = await scrapeDetailAllType({ endpoint }, axiosRequest);

        res.status(200).json({
            message: "success",
            data
        });
    } catch (e) {
        console.error('Error in detailAllType:', e.message);
        res.status(500).json({
            message: `Failed to fetch details: ${e.message}`,
            success: false
        });
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
                error: 'Endpoint is required'
            });
        }
        
        // Konversi ke number
        const epNum = parseInt(episode) || 0;
        const resNum = parseInt(resolution) || 0;
        
        // Get detail data dengan smart request
        const url = `${process.env.DRAKORKITA_URL}/detail/${endpoint}`;
        const axiosResponse = await makeRequest(url, req);
        const $ = cheerio.load(axiosResponse.data);
        
        // Extract video URL logic
        const onclick = $("div.pagination > a").last().attr("onclick");
        if (!onclick) {
            return res.status(404).json({
                success: false,
                error: 'Video data not found'
            });
        }
        
        const movieIdAndTag = onclick.substring(onclick.indexOf("(") + 1, onclick.indexOf(")"));
        const movieId = movieIdAndTag.split(",")[0].replace(/^'|'$/g, '');
        const tag = movieIdAndTag.split(",")[1].replace(/^'|'$/g, '');
        
        // Get episode list dengan smart request
        const episodeUrl = `${process.env.DRAKORKITA_URL}/api/episode.php?movie_id=${movieId}&tag=${tag}`;
        const { data: { episode_lists } } = await makeRequest(episodeUrl, req);
        
        const $eps = cheerio.load(episode_lists);
        const episodes = $eps("p > a").get();
        
        // Validasi episode
        if (epNum >= episodes.length || epNum < 0) {
            return res.status(400).json({
                success: false,
                error: `Episode tidak valid. Tersedia ${episodes.length} episode`
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
        
        // Get video URL dengan smart request
        const serverUrl = `${process.env.DRAKORKITA_URL}/api/server.php?episode_id=${epsId}&tag=${epsTag}`;
        const { data: { data: { qua, server_id } } } = await makeRequest(serverUrl, req);
        
        const videoUrl = `${process.env.DRAKORKITA_URL}/api/video.php?id=${epsId}&qua=${qua}&server_id=${server_id}&tag=${epsTag}`;
        const { data: { file } } = await makeRequest(videoUrl, req);
        
        // Parse video URL
        const videoUrls = file.split(",");
        
        // Validasi resolution
        if (resNum >= videoUrls.length || resNum < 0) {
            return res.status(400).json({
                success: false,
                error: `Resolution tidak valid. Tersedia ${videoUrls.length} resolusi`
            });
        }
        
        const selectedUrl = videoUrls[resNum] || videoUrls[0];
        const finalVideoUrl = selectedUrl.substring(
            selectedUrl.indexOf("https"), 
            selectedUrl.length
        ).replace(/['"]/g, '').trim();
        
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
                }
            }
        });
        
    } catch (error) {
        console.error('Error in getVideoUrl:', error.message);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get video URL'
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
    getVideoUrl
};