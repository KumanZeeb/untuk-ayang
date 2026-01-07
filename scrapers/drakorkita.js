const cheerio = require("cheerio")

// Enhanced scraper dengan error handling dan validasi
class EnhancedScraper {
    constructor() {
        this.selectors = {
            // Container utama
            mainContainer: "main > div.container > div.row > div.col-lg-8 > div.row",
            cardItem: "div > div.card",
            
            // Item dalam card
            cardLink: "a",
            title: "a > div.bungkus > span.titit",
            time: "a > div.bungkus > span:first-child",
            eps: "a > div.bungkus > span.tagw > span",
            quality: "a > div.bungkus > span.titit > span:first-child",
            updatedAt: "a > div.bungkus > span.titit > span:last-child",
            thumbnail: "a > div.bungkus > img",
            
            // Pagination
            pagination: ".wp-pagenavi > span, .wp-pagenavi > a",
            
            // Genres
            genreList: ".genrez:first-child .cat-item a",
            
            // Detail page
            detailContainer: "div#sidebar_left",
            detailTitle: "div.animefull > div.bigcontent > div.infox > h1",
            detailTitleAlt: "div.animefull > div.bigcontent > div.infox > span.alter",
            detailSynopsis: "div.sinopsis > p",
            detailThumbnail: "div.animefull > div.bigcover > div.ime > img",
            detailGenres: "div.animefull > div.bigcontent > div.infox > div.gnr > p > a",
            detailPagination: "div.pagination > a:last-child"
        };
    }

    // Helper function untuk extract data dengan fallback
    extractText($, element, selector, fallback = '') {
        try {
            const result = $(element).find(selector).text().trim();
            return result || fallback;
        } catch (error) {
            console.warn(`Failed to extract text from selector: ${selector}`, error.message);
            return fallback;
        }
    }

    extractHtml($, element, selector, fallback = '') {
        try {
            const html = $(element).find(selector).html();
            if (!html) return fallback;
            
            // Bersihkan HTML dari tag yang tidak diinginkan
            const cleanText = html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '').trim();
            return cleanText || fallback;
        } catch (error) {
            console.warn(`Failed to extract HTML from selector: ${selector}`, error.message);
            return fallback;
        }
    }

    extractAttr($, element, selector, attribute, fallback = '') {
        try {
            const attr = $(element).find(selector).attr(attribute);
            return attr || fallback;
        } catch (error) {
            console.warn(`Failed to extract attribute ${attribute} from selector: ${selector}`, error.message);
            return fallback;
        }
    }

    // Extract endpoint dari URL
    extractEndpoint(url) {
        try {
            if (!url) return '';
            
            const detailIndex = url.indexOf("/detail/");
            if (detailIndex === -1) return '';
            
            return url.substring(detailIndex + 8).replace('/', '');
        } catch (error) {
            console.warn('Failed to extract endpoint from URL:', url);
            return '';
        }
    }

    // Extract pagination number
    extractPagination($) {
        try {
            const largestInt = [];
            
            $(this.selectors.pagination).each((i, e) => {
                const text = $(e).text().trim();
                const int = parseInt(text, 10);
                
                if (!isNaN(int) && int > 0) {
                    largestInt.push(int);
                }
            });
            
            return largestInt.length > 0 ? Math.max(...largestInt) : 1;
        } catch (error) {
            console.warn('Failed to extract pagination:', error.message);
            return 1;
        }
    }

    // Scrape data series/movies dari container
    scrapeItems($, container, type = 'series') {
        const datas = [];
        const selectors = this.selectors;
        
        try {
            $(container).find(selectors.cardItem).each((i, e) => {
                try {
                    const dataObject = {};
                    
                    // Extract title (handle HTML yang mengandung <br>)
                    const titleHtml = this.extractHtml($, e, selectors.title, '');
                    dataObject.title = titleHtml.split('<br>')[0]?.trim() || titleHtml;
                    
                    // Extract basic info
                    dataObject.time = this.extractText($, e, selectors.time, '');
                    dataObject.thumbnail = this.extractAttr($, e, selectors.thumbnail, 'src', '');
                    
                    // Extract endpoint
                    const link = this.extractAttr($, e, selectors.cardLink, 'href', '');
                    dataObject.endpoint = this.extractEndpoint(link);
                    
                    // Type-specific data
                    if (type === 'series' || type === 'ongoing' || type === 'completed') {
                        dataObject.eps = this.extractText($, e, selectors.eps, '');
                    }
                    
                    if (type === 'search' || type === 'genre') {
                        dataObject.quality = this.extractText($, e, selectors.quality, '');
                    }
                    
                    // Updated at (jika ada)
                    if (type === 'series' || type === 'movie' || type === 'ongoing' || type === 'completed' || type === 'search') {
                        const updatedText = this.extractText($, e, selectors.updatedAt, '');
                        if (updatedText) {
                            dataObject.updated_at = updatedText;
                        }
                    }
                    
                    // Hanya tambahkan jika ada endpoint
                    if (dataObject.endpoint) {
                        datas.push(dataObject);
                    }
                    
                } catch (itemError) {
                    console.warn(`Error scraping item ${i}:`, itemError.message);
                }
            });
        } catch (error) {
            console.error('Error in scrapeItems:', error.message);
        }
        
        return datas;
    }
}

// Inisialisasi scraper
const scraper = new EnhancedScraper();

const scrapeSeries = async (req, response) => {
    try {
        const $ = cheerio.load(response.data);
        const container = $(scraper.selectors.mainContainer);
        
        if (container.length === 0) {
            throw new Error('Series container not found');
        }
        
        const datas = scraper.scrapeItems($, container, 'series');
        const pagination = scraper.extractPagination($);
        
        return {
            success: true,
            pagination: pagination,
            total_items: datas.length,
            datas: datas
        };
    } catch (error) {
        console.error('Error in scrapeSeries:', error.message);
        return {
            success: false,
            error: error.message,
            pagination: 1,
            datas: []
        };
    }
};

const scrapeSeriesUpdated = async (req, response) => {
    try {
        const $ = cheerio.load(response.data);
        const container = $(scraper.selectors.mainContainer).first();
        
        if (container.length === 0) {
            throw new Error('Updated series container not found');
        }
        
        const datas = scraper.scrapeItems($, container, 'series');
        
        return {
            success: true,
            total_items: datas.length,
            datas: datas
        };
    } catch (error) {
        console.error('Error in scrapeSeriesUpdated:', error.message);
        return {
            success: false,
            error: error.message,
            datas: []
        };
    }
};

const scrapeMovie = async (req, response) => {
    try {
        const $ = cheerio.load(response.data);
        const container = $(scraper.selectors.mainContainer);
        
        if (container.length === 0) {
            throw new Error('Movie container not found');
        }
        
        const datas = scraper.scrapeItems($, container, 'movie');
        const pagination = scraper.extractPagination($);
        
        return {
            success: true,
            pagination: pagination,
            total_items: datas.length,
            datas: datas
        };
    } catch (error) {
        console.error('Error in scrapeMovie:', error.message);
        return {
            success: false,
            error: error.message,
            pagination: 1,
            datas: []
        };
    }
};

const scrapeNewMovie = async (req, response) => {
    try {
        const $ = cheerio.load(response.data);
        const containers = $(scraper.selectors.mainContainer);
        
        if (containers.length < 2) {
            throw new Error('New movie container not found');
        }
        
        const container = containers.eq(1); // Container kedua untuk new movies
        const datas = scraper.scrapeItems($, container, 'movie');
        
        return {
            success: true,
            total_items: datas.length,
            datas: datas
        };
    } catch (error) {
        console.error('Error in scrapeNewMovie:', error.message);
        return {
            success: false,
            error: error.message,
            datas: []
        };
    }
};

const scrapeOngoingSeries = async (req, response) => {
    try {
        const $ = cheerio.load(response.data);
        const container = $(scraper.selectors.mainContainer);
        
        if (container.length === 0) {
            throw new Error('Ongoing series container not found');
        }
        
        const datas = scraper.scrapeItems($, container, 'ongoing');
        const pagination = scraper.extractPagination($);
        
        return {
            success: true,
            pagination: pagination,
            total_items: datas.length,
            datas: datas
        };
    } catch (error) {
        console.error('Error in scrapeOngoingSeries:', error.message);
        return {
            success: false,
            error: error.message,
            pagination: 1,
            datas: []
        };
    }
};

const scrapeCompletedSeries = async (req, response) => {
    try {
        const $ = cheerio.load(response.data);
        const container = $(scraper.selectors.mainContainer);
        
        if (container.length === 0) {
            throw new Error('Completed series container not found');
        }
        
        const datas = scraper.scrapeItems($, container, 'completed');
        const pagination = scraper.extractPagination($);
        
        return {
            success: true,
            pagination: pagination,
            total_items: datas.length,
            datas: datas
        };
    } catch (error) {
        console.error('Error in scrapeCompletedSeries:', error.message);
        return {
            success: false,
            error: error.message,
            pagination: 1,
            datas: []
        };
    }
};

const scrapeGenres = async (req, response) => {
    try {
        const $ = cheerio.load(response.data);
        const genreElements = $(scraper.selectors.genreList);
        
        if (genreElements.length === 0) {
            throw new Error('Genre list not found');
        }
        
        const datas = [];
        genreElements.each((i, e) => {
            try {
                const genre = $(e).text().trim();
                if (genre) {
                    // Extract endpoint dari href jika ada
                    const href = $(e).attr('href') || '';
                    const endpointMatch = href.match(/genre=([^&]+)/);
                    const endpoint = endpointMatch ? endpointMatch[1] : genre.toLowerCase().replace(/\s+/g, '-');
                    
                    datas.push({
                        title: genre,
                        endpoint: endpoint
                    });
                }
            } catch (itemError) {
                console.warn(`Error scraping genre ${i}:`, itemError.message);
            }
        });
        
        return {
            success: true,
            total_genres: datas.length,
            datas: datas
        };
    } catch (error) {
        console.error('Error in scrapeGenres:', error.message);
        return {
            success: false,
            error: error.message,
            datas: []
        };
    }
};

const scrapeDetailGenres = async (req, response) => {
    try {
        const $ = cheerio.load(response.data);
        const items = $(".item-list a");
        
        if (items.length === 0) {
            throw new Error('Genre detail items not found');
        }
        
        const datas = [];
        items.each((i, e) => {
            try {
                const dataObject = {};
                
                // Extract data menggunakan scraper helper
                const titleHtml = scraper.extractHtml($, e, "div.bungkus > span.titit", '');
                dataObject.title = titleHtml.split('<br>')[0]?.trim() || titleHtml;
                
                dataObject.time = scraper.extractText($, e, "div.bungkus > span:first-child", '');
                dataObject.quality = scraper.extractText($, e, "div.bungkus > span.titit > span:first-child", '');
                dataObject.eps = scraper.extractText($, e, "div.bungkus > span.tagw > span", '').trim();
                dataObject.updated_at = scraper.extractText($, e, "div.bungkus > span.titit > span:last-child", '');
                dataObject.thumbnail = scraper.extractAttr($, e, "div.bungkus > img", 'src', '');
                
                // Extract endpoint
                const link = $(e).attr('href') || '';
                dataObject.endpoint = scraper.extractEndpoint(link);
                
                if (dataObject.endpoint) {
                    datas.push(dataObject);
                }
                
            } catch (itemError) {
                console.warn(`Error scraping genre item ${i}:`, itemError.message);
            }
        });
        
        const pagination = scraper.extractPagination($);
        
        return {
            success: true,
            pagination: pagination,
            total_items: datas.length,
            datas: datas
        };
    } catch (error) {
        console.error('Error in scrapeDetailGenres:', error.message);
        return {
            success: false,
            error: error.message,
            pagination: 1,
            datas: []
        };
    }
};

const scrapeSearch = async (req, response) => {
    try {
        const $ = cheerio.load(response.data);
        const container = $(scraper.selectors.mainContainer);
        
        if (container.length === 0) {
            throw new Error('Search results container not found');
        }
        
        const datas = scraper.scrapeItems($, container, 'search');
        const pagination = scraper.extractPagination($);
        
        return {
            success: true,
            pagination: pagination,
            total_items: datas.length,
            datas: datas
        };
    } catch (error) {
        console.error('Error in scrapeSearch:', error.message);
        return {
            success: false,
            error: error.message,
            pagination: 1,
            datas: []
        };
    }
};

const scrapeDetailAllType = async (req, response) => {
    const { endpoint } = req;
    
    try {
        const $ = cheerio.load(response.data);
        const container = $(scraper.selectors.detailContainer);
        
        if (container.length === 0) {
            throw new Error('Detail page container not found');
        }
        
        const data = {};
        const genres = [];
        
        // Extract basic info
        data.title = scraper.extractText($, container, scraper.selectors.detailTitle, '');
        data.title_alt = scraper.extractText($, container, scraper.selectors.detailTitleAlt, '');
        data.synopsis = scraper.extractText($, container, scraper.selectors.detailSynopsis, '');
        data.thumbnail = scraper.extractAttr($, container, scraper.selectors.detailThumbnail, 'src', '');
        
        // Extract genres
        $(scraper.selectors.detailGenres).each((i, e) => {
            try {
                const genre = $(e).text().trim();
                if (genre) {
                    genres.push({
                        title: genre,
                        endpoint: genre.toLowerCase().replace(/\s+/g, '-')
                    });
                }
            } catch (genreError) {
                console.warn(`Error scraping genre ${i}:`, genreError.message);
            }
        });
        
        data.genres = genres;
        
        // Extract episode data (basic info saja, video URL akan diambil di controller)
        // Note: Tidak membuat axios request di sini untuk menghindari recursive dependency
        const onclick = scraper.extractAttr($, container, scraper.selectors.detailPagination, 'onclick', '');
        
        if (onclick) {
            const movieIdAndTag = onclick.substring(onclick.indexOf("(") + 1, onclick.indexOf(")"));
            const movieId = movieIdAndTag.split(",")[0]?.replace(/^'|'$/g, '') || '';
            const tag = movieIdAndTag.split(",")[1]?.replace(/^'|'$/g, '') || '';
            
            data.movie_id = movieId;
            data.tag = tag;
        }
        
        // Info episode count (jika ada di page)
        const episodeCountText = $("div.episodelist, div.eps, span.episode-count").first().text();
        const episodeMatch = episodeCountText.match(/(\d+)/);
        data.total_episodes = episodeMatch ? parseInt(episodeMatch[1]) : 0;
        
        // Metadata tambahan
        data.endpoint = endpoint;
        data.scraped_at = new Date().toISOString();
        
        return {
            success: true,
            data: data
        };
        
    } catch (error) {
        console.error('Error in scrapeDetailAllType:', error.message);
        return {
            success: false,
            error: error.message,
            data: null
        };
    }
};

module.exports = {
    scrapeSeries,
    scrapeSeriesUpdated,
    scrapeMovie,
    scrapeNewMovie,
    scrapeOngoingSeries,
    scrapeCompletedSeries,
    scrapeGenres,
    scrapeDetailGenres,
    scrapeSearch,
    scrapeDetailAllType
};
