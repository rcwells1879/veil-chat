import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import BaseExtractor from './base-extractor.js';

// Use stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

class PuppeteerExtractor extends BaseExtractor {
    constructor() {
        super();
        this.browser = null;
        this.browserPromise = null;
        this.timeout = 12000; // Reduced from 20s to 12s for faster failure detection
        this.inactivityTimer = null; // Track inactivity timer
    }

    /**
     * Get or create browser instance with anti-detection settings
     */
    async getBrowser() {
        if (this.browser && this.browser.isConnected()) {
            return this.browser;
        }

        // If browser is starting up, wait for it
        if (this.browserPromise) {
            return await this.browserPromise;
        }

        // Start new browser instance
        this.browserPromise = this._createBrowser();
        this.browser = await this.browserPromise;
        this.browserPromise = null;
        
        return this.browser;
    }

    async _createBrowser() {
        console.log('🤖 PuppeteerExtractor: Starting new browser instance...');
        
        console.log('🤖 PuppeteerExtractor: Attempting to launch browser...');
        
        // Set environment variable directly if not already set (fallback)
        if (!process.env.CHROME_PATH) {
            process.env.CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
            console.log('🤖 Environment CHROME_PATH not set, setting to default:', process.env.CHROME_PATH);
        }
        
        // Prioritize environment variable approach (matches user's working test)
        const possibleChromePaths = [
            process.env.CHROME_PATH,
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
        ].filter(Boolean);
        
        let chromePath = possibleChromePaths[0]; // Use environment variable first
        console.log('🤖 PuppeteerExtractor: Using Chrome path:', chromePath);
        
        const browser = await puppeteer.launch({
            headless: 'new',
            executablePath: chromePath,
            ignoreDefaultArgs: false, // Don't ignore default args
            env: {
                ...process.env,
                PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: 'true', // Force use of system Chrome
                PUPPETEER_EXECUTABLE_PATH: chromePath
            },
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-blink-features=AutomationControlled',
                '--exclude-switches=enable-automation',
                '--disable-extensions-except=', // Allow some extensions for realism
                '--disable-plugins-discovery',
                '--disable-default-apps',
                '--disable-sync',
                '--disable-translate',
                '--hide-scrollbars',
                '--mute-audio',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-component-update',
                '--disable-background-networking',
                '--disable-domain-reliability',
                '--disable-ipc-flooding-protection',
                '--password-store=basic',
                '--use-mock-keychain',
                '--disable-javascript-harmony-shipping',
                '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ],
            defaultViewport: {
                width: 1366,
                height: 768,
                deviceScaleFactor: 1,
                hasTouch: false,
                isLandscape: true,
                isMobile: false
            },
            timeout: 45000 // Increased browser launch timeout
        });

        // Set up inactivity timer - will be reset on each use
        this.resetInactivityTimer(browser);

        return browser;
    }

    /**
     * Reset inactivity timer - following Puppeteer best practices
     * Timer should reset on each browser use, not run from creation time
     */
    resetInactivityTimer(browser) {
        // Clear existing timer
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
        }
        
        // Set new timer for 10 minutes of actual inactivity
        this.inactivityTimer = setTimeout(() => {
            if (browser && browser.isConnected()) {
                console.log('🤖 PuppeteerExtractor: Closing browser due to actual inactivity');
                browser.close().catch(console.error);
                this.browser = null;
                this.inactivityTimer = null;
            }
        }, 10 * 60 * 1000); // 10 minutes of actual inactivity
    }

    /**
     * Extract content using Puppeteer for dynamic sites
     */
    async extractWithPuppeteer(url, options = {}) {
        console.log(`🤖 PuppeteerExtractor: Extracting ${url} with Puppeteer...`);
        
        let page = null;
        
        try {
            const browser = await this.getBrowser();
            
            // Reset inactivity timer on each use - following Puppeteer best practices
            this.resetInactivityTimer(browser);
            
            page = await browser.newPage();

            // Set timeout and configure page
            await page.setDefaultNavigationTimeout(this.timeout);
            await page.setDefaultTimeout(this.timeout);

            // Enhanced stealth configuration with more realistic headers
            await page.setExtraHTTPHeaders({
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'max-age=0',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1'
            });

            // Enhanced webdriver trace removal and fingerprint spoofing
            await page.evaluateOnNewDocument(() => {
                // Remove webdriver property
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                
                // Add realistic navigator properties
                Object.defineProperty(navigator, 'plugins', { 
                    get: () => ({
                        length: 5,
                        0: { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
                        1: { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
                        2: { name: 'Native Client', filename: 'internal-nacl-plugin' }
                    })
                });
                
                Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
                Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
                Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
                Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
                
                // Add Chrome runtime
                window.chrome = { 
                    runtime: {
                        onConnect: null,
                        onMessage: null
                    },
                    app: {
                        isInstalled: false
                    }
                };
                
                // Override permissions API
                Object.defineProperty(navigator, 'permissions', { 
                    get: () => ({ 
                        query: () => Promise.resolve({ state: 'granted' })
                    })
                });
                
                // Spoof canvas fingerprinting
                const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
                HTMLCanvasElement.prototype.toDataURL = function(...args) {
                    const context = this.getContext('2d');
                    if (context) {
                        context.fillStyle = 'rgba(0, 0, 0, 0.1)';
                        context.fillRect(0, 0, 1, 1);
                    }
                    return originalToDataURL.apply(this, args);
                };
                
                // Spoof WebGL fingerprinting
                const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
                WebGLRenderingContext.prototype.getParameter = function(parameter) {
                    if (parameter === 37445) return 'Intel Inc.';
                    if (parameter === 37446) return 'Intel(R) HD Graphics 620';
                    return originalGetParameter.apply(this, arguments);
                };
            });

            // Smart resource blocking
            if (options.blockResources) {
                await page.setRequestInterception(true);
                page.on('request', (req) => {
                    const resourceType = req.resourceType();
                    const url = req.url();
                    
                    // Block ads, trackers, and unnecessary resources
                    if (resourceType === 'image' && !url.includes('avatar') && !url.includes('profile')) {
                        req.abort();
                    } else if (['stylesheet', 'font'].includes(resourceType)) {
                        req.abort();
                    } else if (url.includes('doubleclick') || url.includes('googlesyndication') || url.includes('facebook.com/tr')) {
                        req.abort();
                    } else {
                        req.continue();
                    }
                });
            }

            // Navigate to page with enhanced retry logic
            console.log(`🤖 PuppeteerExtractor: Navigating to ${url}...`);
            let navigationAttempts = 0;
            const maxAttempts = 3;
            
            while (navigationAttempts < maxAttempts) {
                try {
                    // Try different wait strategies based on attempt - optimized for heavy JS sites
                    const waitStrategies = [
                        ['domcontentloaded'], // Start with fastest strategy for heavy sites
                        ['domcontentloaded', 'networkidle2'],
                        ['load'] // Most permissive fallback
                    ];
                    
                    const waitUntil = waitStrategies[navigationAttempts] || ['domcontentloaded'];
                    
                    await page.goto(url, { 
                        waitUntil: waitUntil,
                        timeout: this.timeout 
                    });
                    console.log(`🤖 PuppeteerExtractor: Successfully navigated to ${url} on attempt ${navigationAttempts + 1}`);
                    break;
                } catch (navError) {
                    navigationAttempts++;
                    console.log(`🤖 Navigation attempt ${navigationAttempts} failed:`, navError.message);
                    
                    // Check if it's a specific error we can handle
                    if (navError.message.includes('ERR_NAME_NOT_RESOLVED') || 
                        navError.message.includes('ERR_INTERNET_DISCONNECTED') ||
                        navError.message.includes('Navigation timeout') ||
                        navError.message.includes('timeout')) {
                        // Network connectivity issue or timeout - don't retry
                        console.log(`⚠️ PuppeteerExtractor: Unrecoverable navigation error detected, stopping retries`);
                        throw navError;
                    }
                    
                    if (navigationAttempts >= maxAttempts) throw navError;
                    
                    // Reduced delay: 1s, 2s instead of 2s, 4s, 6s for faster processing
                    const delay = navigationAttempts * 1000;
                    console.log(`🤖 PuppeteerExtractor: Waiting ${delay}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }

            // Advanced content loading strategy
            console.log(`🤖 PuppeteerExtractor: Waiting for dynamic content...`);
            
            // Give more time for heavily dynamic sites like Yelp/TripAdvisor with random delays
            const siteDomain = new URL(url).hostname.toLowerCase();
            const isProblematicSite = siteDomain.includes('yelp.com') || siteDomain.includes('tripadvisor.com');
            const baseWaitTime = isProblematicSite ? 7000 : 3000;
            const randomDelay = Math.random() * 2000; // Add 0-2 seconds random delay
            const waitTime = baseWaitTime + randomDelay;
            
            console.log(`🤖 PuppeteerExtractor: Waiting ${Math.round(waitTime)}ms for content to load...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            // Add human-like mouse movement
            if (isProblematicSite) {
                try {
                    await page.mouse.move(100 + Math.random() * 200, 100 + Math.random() * 200);
                    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
                    await page.mouse.move(300 + Math.random() * 200, 200 + Math.random() * 200);
                } catch (error) {
                    // Ignore mouse movement errors
                }
            }
            
            // Handle popups and overlays before content extraction
            await this.handlePopupsAndOverlays(page, url);
            
            // Handle lazy loading by scrolling (reduced iterations)
            await this.handleLazyLoading(page);
            
            // Wait for any final dynamic content (reduced)
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Platform-specific extraction logic
            const domain = new URL(url).hostname.toLowerCase();
            let extractedData = {};

            if (domain.includes('maps.google.com') || domain.includes('google.com/maps')) {
                extractedData = await this._extractGoogleMaps(page, url);
            } else if (domain.includes('yelp.com')) {
                extractedData = await this._extractYelp(page, url);
            } else if (domain.includes('tripadvisor.com')) {
                extractedData = await this._extractTripAdvisor(page, url);
            } else {
                // Use enhanced generic extraction for all other sites including Reddit
                extractedData = await this._extractGeneric(page, url);
            }

            // Add common metadata
            extractedData.url = url;
            extractedData.extractionMethod = 'puppeteer';
            extractedData.extractedAt = new Date().toISOString();

            // Truncate content if needed
            if (options.maxLength && extractedData.content && extractedData.content.length > options.maxLength) {
                extractedData.content = this.truncateIntelligently(extractedData.content, options.maxLength);
                extractedData.truncated = true;
            }

            console.log(`✅ PuppeteerExtractor: Successfully extracted ${extractedData.content?.length || 0} characters from ${url}`);
            return extractedData;

        } catch (error) {
            console.error(`❌ PuppeteerExtractor: Extraction failed for ${url}:`, error.message);
            throw error;
        } finally {
            if (page) {
                await page.close().catch(console.error);
            }
        }
    }

    /**
     * Extract Google Maps business information and reviews
     */
    async _extractGoogleMaps(page, url) {
        console.log('🗺️ PuppeteerExtractor: Extracting Google Maps data...');
        
        try {
            // Wait for business info to load
            await page.waitForSelector('[data-section-id="overview"]', { timeout: 10000 }).catch(() => {});
            
            const data = await page.evaluate(() => {
                const result = {
                    title: '',
                    content: '',
                    rating: '',
                    reviews: [],
                    address: '',
                    phone: '',
                    website: '',
                    hours: ''
                };

                // Business name
                const nameEl = document.querySelector('h1[data-attrid="title"]') || 
                             document.querySelector('.x3AX1-LfntMc-header-title-title') ||
                             document.querySelector('h1');
                if (nameEl) result.title = nameEl.textContent.trim();

                // Rating
                const ratingEl = document.querySelector('[data-value="Overall rating"]') ||
                               document.querySelector('.MW4etd');
                if (ratingEl) result.rating = ratingEl.textContent.trim();

                // Address
                const addressEl = document.querySelector('[data-item-id="address"]') ||
                                document.querySelector('.Z1hOCe');
                if (addressEl) result.address = addressEl.textContent.trim();

                // Phone
                const phoneEl = document.querySelector('[data-item-id*="phone"]') ||
                              document.querySelector('[data-value*="phone"]');
                if (phoneEl) result.phone = phoneEl.textContent.trim();

                // Website
                const websiteEl = document.querySelector('[data-item-id="authority"]') ||
                                document.querySelector('a[href*="://"]');
                if (websiteEl) result.website = websiteEl.href;

                // Reviews (first few visible ones)
                const reviewElements = document.querySelectorAll('[data-review-id]') ||
                                     document.querySelectorAll('.jftiEf');
                
                Array.from(reviewElements).slice(0, 5).forEach(review => {
                    const reviewText = review.querySelector('.wiI7pd')?.textContent?.trim() ||
                                     review.querySelector('.MyEned')?.textContent?.trim();
                    const reviewer = review.querySelector('.d4r55')?.textContent?.trim() ||
                                   review.querySelector('.NuIpR')?.textContent?.trim();
                    const rating = review.querySelector('[aria-label*="star"]')?.getAttribute('aria-label');
                    
                    if (reviewText) {
                        result.reviews.push({
                            text: reviewText,
                            author: reviewer || 'Anonymous',
                            rating: rating || ''
                        });
                    }
                });

                // Create content summary
                let content = `${result.title}\n\n`;
                if (result.rating) content += `Rating: ${result.rating}\n`;
                if (result.address) content += `Address: ${result.address}\n`;
                if (result.phone) content += `Phone: ${result.phone}\n`;
                if (result.website) content += `Website: ${result.website}\n\n`;
                
                if (result.reviews.length > 0) {
                    content += 'Recent Reviews:\n';
                    result.reviews.forEach((review, i) => {
                        content += `${i + 1}. ${review.author}: ${review.text}\n`;
                    });
                }

                result.content = content;
                return result;
            });

            return data;
        } catch (error) {
            console.error('Error extracting Google Maps data:', error);
            return { title: 'Google Maps Location', content: 'Unable to extract detailed information' };
        }
    }

    /**
     * Extract Yelp business information and reviews
     */
    async _extractYelp(page, url) {
        console.log('⭐ PuppeteerExtractor: Extracting Yelp data...');
        
        try {
            // Try multiple strategies to wait for Yelp content - focus on search results
            const yelpSelectors = [
                '[data-testid="serp-ia-card"]', // Search result cards
                '[class*="businessName"]',
                '[class*="search-result"]',
                '[data-testid*="business"]',
                'h3 a[href*="/biz/"]', // Business links
                '.regular-search-result',
                '[class*="searchResult"]',
                'h1',
                'main',
                'article'
            ];
            
            let contentFound = false;
            let workingSelector = null;
            
            for (const selector of yelpSelectors) {
                try {
                    await page.waitForSelector(selector, { timeout: 3000 });
                    console.log(`⭐ Found Yelp content with selector: ${selector}`);
                    contentFound = true;
                    workingSelector = selector;
                    break;
                } catch (e) {
                    console.log(`⭐ Selector ${selector} not found, trying next...`);
                }
            }
            
            if (!contentFound) {
                console.log('⭐ No specific Yelp selectors found, using generic extraction...');
                return await this._extractGeneric(page, url);
            }
            
            // Additional wait for dynamic content to load
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const data = await page.evaluate(() => {
                const result = {
                    title: '',
                    content: '',
                    rating: '',
                    reviews: [],
                    address: '',
                    phone: '',
                    website: ''
                };

                // Enhanced business name extraction with multiple fallbacks
                const nameSelectors = [
                    'h1',
                    '[data-testid*="business-name"]',
                    '[class*="businessName"]',
                    '[class*="name"]:not([class*="user"]):not([class*="review"])',
                    'h2',
                    'h3'
                ];
                
                for (const selector of nameSelectors) {
                    const nameEl = document.querySelector(selector);
                    if (nameEl && nameEl.textContent.trim().length > 2) {
                        result.title = nameEl.textContent.trim();
                        break;
                    }
                }

                // Enhanced rating extraction
                const ratingSelectors = [
                    '[data-testid="review-star-rating"]',
                    '[aria-label*="star"]',
                    '[class*="rating"]',
                    '[class*="star"]',
                    '.i-stars'
                ];
                
                for (const selector of ratingSelectors) {
                    const ratingEl = document.querySelector(selector);
                    if (ratingEl) {
                        result.rating = ratingEl.getAttribute('aria-label') || 
                                       ratingEl.getAttribute('title') ||
                                       ratingEl.textContent.trim();
                        if (result.rating) break;
                    }
                }

                // Enhanced address extraction
                const addressSelectors = [
                    '[data-testid="business-address"]',
                    'address',
                    '[class*="address"]',
                    '[data-testid*="address"]'
                ];
                
                for (const selector of addressSelectors) {
                    const addressEl = document.querySelector(selector);
                    if (addressEl && addressEl.textContent.trim()) {
                        result.address = addressEl.textContent.trim();
                        break;
                    }
                }

                // Phone extraction
                const phoneEl = document.querySelector('[href*="tel:"]');
                if (phoneEl) result.phone = phoneEl.textContent.trim();

                // Enhanced review extraction with multiple strategies
                const reviewSelectors = [
                    '[data-testid*="review"]',
                    '[class*="review"]',
                    'li[class*="review"]',
                    'div[class*="review"]'
                ];
                
                let reviewElements = [];
                for (const selector of reviewSelectors) {
                    reviewElements = document.querySelectorAll(selector);
                    if (reviewElements.length > 0) break;
                }
                
                Array.from(reviewElements).slice(0, 5).forEach(review => {
                    // Try multiple review text selectors
                    const reviewTextSelectors = [
                        '.raw__09f24__T4Ezm',
                        '[class*="comment"]',
                        '[class*="review-text"]',
                        '[class*="text"]',
                        'p',
                        'span'
                    ];
                    
                    let reviewText = '';
                    for (const textSelector of reviewTextSelectors) {
                        const textEl = review.querySelector(textSelector);
                        if (textEl && textEl.textContent.trim().length > 20) {
                            reviewText = textEl.textContent.trim();
                            break;
                        }
                    }
                    
                    // Try multiple reviewer name selectors
                    const reviewerSelectors = [
                        '[data-testid="user-name"]',
                        '[class*="user-name"]',
                        '[class*="author"]',
                        'a[href*="/user"]'
                    ];
                    
                    let reviewer = '';
                    for (const nameSelector of reviewerSelectors) {
                        const nameEl = review.querySelector(nameSelector);
                        if (nameEl && nameEl.textContent.trim()) {
                            reviewer = nameEl.textContent.trim();
                            break;
                        }
                    }
                    
                    if (reviewText) {
                        result.reviews.push({
                            text: reviewText,
                            author: reviewer || 'Anonymous'
                        });
                    }
                });

                // Fallback: get all text content if specific extraction fails
                if (!result.title && !result.content && reviewElements.length === 0) {
                    const mainContent = document.querySelector('main') || document.querySelector('body');
                    const allText = mainContent ? mainContent.textContent.trim() : '';
                    if (allText) {
                        result.title = 'Yelp Search Results';
                        result.content = allText.slice(0, 2000); // Limit content
                    }
                }

                // Create content summary
                let content = `${result.title}\n\n`;
                if (result.rating) content += `Rating: ${result.rating}\n`;
                if (result.address) content += `Address: ${result.address}\n`;
                if (result.phone) content += `Phone: ${result.phone}\n\n`;
                
                if (result.reviews.length > 0) {
                    content += 'Recent Reviews:\n';
                    result.reviews.forEach((review, i) => {
                        content += `${i + 1}. ${review.author}: ${review.text}\n`;
                    });
                } else if (!result.title && !result.rating && !result.address) {
                    // If no structured data found, include general page content
                    content = result.content || 'Unable to extract specific business information';
                }

                result.content = content;
                return result;
            });

            return data;
        } catch (error) {
            console.error('Error extracting Yelp data:', error);
            // Fallback to generic extraction
            try {
                return await this._extractGeneric(page, url);
            } catch (fallbackError) {
                return { title: 'Yelp Business', content: 'Unable to extract detailed information' };
            }
        }
    }

    /**
     * Extract TripAdvisor information and reviews
     */
    async _extractTripAdvisor(page, url) {
        console.log('✈️ PuppeteerExtractor: Extracting TripAdvisor data...');
        
        try {
            // Try multiple strategies to wait for TripAdvisor content
            const tripAdvisorSelectors = [
                'h1',
                '[data-test-target="POI_NAME"]',
                '[data-testid*="restaurant"]',
                '[class*="restaurant"]',
                '[class*="business"]',
                'main',
                'article',
                '.listContainer', // TripAdvisor list container
                '.restaurants-list' // Restaurant listings
            ];
            
            let contentFound = false;
            let workingSelector = null;
            
            for (const selector of tripAdvisorSelectors) {
                try {
                    await page.waitForSelector(selector, { timeout: 3000 });
                    console.log(`✈️ Found TripAdvisor content with selector: ${selector}`);
                    contentFound = true;
                    workingSelector = selector;
                    break;
                } catch (e) {
                    console.log(`✈️ Selector ${selector} not found, trying next...`);
                }
            }
            
            if (!contentFound) {
                console.log('✈️ No specific TripAdvisor selectors found, using generic extraction...');
                return await this._extractGeneric(page, url);
            }
            
            // Additional wait for dynamic content to load
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const data = await page.evaluate(() => {
                const result = {
                    title: '',
                    content: '',
                    rating: '',
                    reviews: [],
                    restaurants: [] // For restaurant listings
                };

                // Enhanced title extraction
                const titleSelectors = [
                    'h1',
                    '[data-test-target="POI_NAME"]',
                    '[class*="title"]',
                    'h2',
                    'h3'
                ];
                
                for (const selector of titleSelectors) {
                    const titleEl = document.querySelector(selector);
                    if (titleEl && titleEl.textContent.trim().length > 2) {
                        result.title = titleEl.textContent.trim();
                        break;
                    }
                }

                // Enhanced rating extraction
                const ratingSelectors = [
                    '[data-test-target="review-rating"]',
                    '.ui_bubble_rating',
                    '[class*="rating"]',
                    '[class*="star"]',
                    '[aria-label*="star"]'
                ];
                
                for (const selector of ratingSelectors) {
                    const ratingEl = document.querySelector(selector);
                    if (ratingEl) {
                        result.rating = ratingEl.getAttribute('alt') || 
                                       ratingEl.getAttribute('aria-label') ||
                                       ratingEl.textContent.trim();
                        if (result.rating) break;
                    }
                }

                // Enhanced review extraction
                const reviewSelectors = [
                    '[data-test-target="HR_CC_CARD"]',
                    '.review-container',
                    '[class*="review"]',
                    'div[data-test*="review"]'
                ];
                
                let reviewElements = [];
                for (const selector of reviewSelectors) {
                    reviewElements = document.querySelectorAll(selector);
                    if (reviewElements.length > 0) break;
                }
                
                Array.from(reviewElements).slice(0, 5).forEach(review => {
                    // Try multiple review text selectors
                    const reviewTextSelectors = [
                        '.partial_entry',
                        '.reviewText',
                        '[class*="review-text"]',
                        '[class*="text"]',
                        'p',
                        'span'
                    ];
                    
                    let reviewText = '';
                    for (const textSelector of reviewTextSelectors) {
                        const textEl = review.querySelector(textSelector);
                        if (textEl && textEl.textContent.trim().length > 20) {
                            reviewText = textEl.textContent.trim();
                            break;
                        }
                    }
                    
                    // Try multiple reviewer name selectors
                    const reviewerSelectors = [
                        '.username',
                        '[class*="username"]',
                        '[class*="author"]',
                        'a[href*="/Profile"]'
                    ];
                    
                    let reviewer = '';
                    for (const nameSelector of reviewerSelectors) {
                        const nameEl = review.querySelector(nameSelector);
                        if (nameEl && nameEl.textContent.trim()) {
                            reviewer = nameEl.textContent.trim();
                            break;
                        }
                    }
                    
                    if (reviewText) {
                        result.reviews.push({
                            text: reviewText,
                            author: reviewer || 'Anonymous'
                        });
                    }
                });

                // Extract restaurant listings if this is a search/list page
                const restaurantListSelectors = [
                    '[data-test*="restaurant"]',
                    '.restaurant',
                    '.listItem',
                    '[class*="restaurant"]'
                ];
                
                let restaurantElements = [];
                for (const selector of restaurantListSelectors) {
                    restaurantElements = document.querySelectorAll(selector);
                    if (restaurantElements.length > 0) break;
                }
                
                Array.from(restaurantElements).slice(0, 10).forEach(restaurant => {
                    const nameEl = restaurant.querySelector('h3, h2, [class*="name"], a[href*="/Restaurant_Review"]');
                    const ratingEl = restaurant.querySelector('[class*="rating"], [class*="star"]');
                    const priceEl = restaurant.querySelector('[class*="price"], [class*="cost"]');
                    const cuisineEl = restaurant.querySelector('[class*="cuisine"], [class*="category"]');
                    
                    if (nameEl && nameEl.textContent.trim()) {
                        const restaurantData = {
                            name: nameEl.textContent.trim(),
                            rating: ratingEl ? ratingEl.textContent.trim() : '',
                            price: priceEl ? priceEl.textContent.trim() : '',
                            cuisine: cuisineEl ? cuisineEl.textContent.trim() : ''
                        };
                        result.restaurants.push(restaurantData);
                    }
                });

                // Fallback: get all text content if specific extraction fails
                if (!result.title && result.reviews.length === 0 && result.restaurants.length === 0) {
                    const mainContent = document.querySelector('main') || document.querySelector('body');
                    const allText = mainContent ? mainContent.textContent.trim() : '';
                    if (allText) {
                        result.title = 'TripAdvisor Results';
                        result.content = allText.slice(0, 2000); // Limit content
                    }
                }

                // Create content summary
                let content = `${result.title}\n\n`;
                if (result.rating) content += `Rating: ${result.rating}\n\n`;
                
                if (result.restaurants.length > 0) {
                    content += 'Restaurants:\n';
                    result.restaurants.forEach((restaurant, i) => {
                        content += `${i + 1}. ${restaurant.name}`;
                        if (restaurant.cuisine) content += ` (${restaurant.cuisine})`;
                        if (restaurant.rating) content += ` - Rating: ${restaurant.rating}`;
                        if (restaurant.price) content += ` - Price: ${restaurant.price}`;
                        content += '\n';
                    });
                    content += '\n';
                }
                
                if (result.reviews.length > 0) {
                    content += 'Recent Reviews:\n';
                    result.reviews.forEach((review, i) => {
                        content += `${i + 1}. ${review.author}: ${review.text}\n`;
                    });
                } else if (!result.title && !result.rating && result.restaurants.length === 0) {
                    // If no structured data found, include general page content
                    content = result.content || 'Unable to extract specific information';
                }

                result.content = content;
                return result;
            });

            return data;
        } catch (error) {
            console.error('Error extracting TripAdvisor data:', error);
            // Fallback to generic extraction
            try {
                return await this._extractGeneric(page, url);
            } catch (fallbackError) {
                return { title: 'TripAdvisor Location', content: 'Unable to extract detailed information' };
            }
        }
    }

    /**
     * Extract Reddit post and comments
     */
    async _extractReddit(page, url) {
        console.log('🔴 PuppeteerExtractor: Extracting Reddit data...');
        
        try {
            // Wait for page to load and try multiple selectors for Reddit content
            console.log('🔴 Waiting for Reddit content to load...');
            
            // Try different selectors based on Reddit version
            const selectors = [
                '[data-testid="post-content"]',  // New Reddit
                '.Post',                         // New Reddit alternative
                '.thing',                        // Old Reddit
                'h1',                           // Fallback
                '.title'                        // Another fallback
            ];
            
            let contentFound = false;
            for (const selector of selectors) {
                try {
                    await page.waitForSelector(selector, { timeout: 5000 });
                    console.log(`🔴 Found Reddit content with selector: ${selector}`);
                    contentFound = true;
                    break;
                } catch (e) {
                    console.log(`🔴 Selector ${selector} not found, trying next...`);
                }
            }
            
            if (!contentFound) {
                console.log('🔴 No Reddit content selectors found, proceeding with extraction anyway...');
            }
            
            // Additional wait for dynamic content
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            const data = await page.evaluate(() => {
                const result = {
                    title: '',
                    content: '',
                    comments: [],
                    subreddit: '',
                    author: '',
                    score: ''
                };

                // Post title
                const titleEl = document.querySelector('h1') ||
                              document.querySelector('[data-testid="post-content"] h3') ||
                              document.querySelector('.title');
                if (titleEl) result.title = titleEl.textContent.trim();

                // Post content
                const contentEl = document.querySelector('[data-testid="post-content"] .md') ||
                                document.querySelector('.usertext-body .md');
                if (contentEl) result.content = contentEl.textContent.trim();

                // Subreddit
                const subredditEl = document.querySelector('[data-testid="subreddit-name"]') ||
                                  document.querySelector('.subreddit');
                if (subredditEl) result.subreddit = subredditEl.textContent.trim();

                // Comments (top level only)
                const commentElements = document.querySelectorAll('[data-testid="comment"]') ||
                                      document.querySelectorAll('.Comment');
                
                Array.from(commentElements).slice(0, 10).forEach(comment => {
                    const commentText = comment.querySelector('.md')?.textContent?.trim() ||
                                      comment.querySelector('p')?.textContent?.trim();
                    const commenter = comment.querySelector('[data-testid="comment_author_link"]')?.textContent?.trim() ||
                                    comment.querySelector('.author')?.textContent?.trim();
                    
                    if (commentText && commentText.length > 20) {
                        result.comments.push({
                            text: commentText,
                            author: commenter || 'Anonymous'
                        });
                    }
                });

                // Combine into content
                let fullContent = `${result.title}\n\n`;
                if (result.subreddit) fullContent += `Subreddit: ${result.subreddit}\n`;
                if (result.content) fullContent += `\nPost: ${result.content}\n\n`;
                
                if (result.comments.length > 0) {
                    fullContent += 'Top Comments:\n';
                    result.comments.forEach((comment, i) => {
                        fullContent += `${i + 1}. ${comment.author}: ${comment.text}\n\n`;
                    });
                }

                result.content = fullContent;
                return result;
            });

            return data;
        } catch (error) {
            console.error('Error extracting Reddit data:', error);
            return { title: 'Reddit Post', content: 'Unable to extract detailed information' };
        }
    }

    /**
     * Handle modals, overlays, and in-page popups that block content
     */
    async handlePopupsAndOverlays(page, url) {
        console.log('🤖 PuppeteerExtractor: Checking for modals and overlays...');
        
        try {
            const domain = new URL(url).hostname.toLowerCase();
            
            // Common overlay/modal close button selectors
            const closeButtonSelectors = [
                '[aria-label*="close"]',
                '[aria-label*="Close"]',
                '[data-testid*="close"]',
                '[class*="close"]',
                '[class*="Close"]',
                '.modal-close',
                '.overlay-close',
                'button[aria-label="Close"]',
                'button[title="Close"]',
                '[role="button"][aria-label*="close"]',
                '.close-button',
                '.dismiss-button',
                '[data-dismiss]'
            ];
            
            // Site-specific selectors
            if (domain.includes('yelp.com')) {
                // Yelp-specific modal/overlay selectors
                const yelpOverlaySelectors = [
                    '[data-testid*="login"]',
                    '[data-testid*="signup"]',
                    '[class*="login"]',
                    '[class*="signup"]',
                    '[class*="modal"]',
                    '[class*="overlay"]',
                    '[class*="dialog"]',
                    '.react-modal-overlay',
                    '[role="dialog"]',
                    '[aria-modal="true"]',
                    // Google sign-in specific
                    '[data-testid*="google"]',
                    '[class*="google"]',
                    'iframe[src*="google"]',
                    // Generic dismiss buttons (using XPath-like text matching via evaluate)
                    'button',
                    'a[role="button"]',
                    '[type="button"]'
                ];
                
                closeButtonSelectors.push(...yelpOverlaySelectors);
                console.log('⭐ Checking for Yelp login/signup modals...');
            }
            
            if (domain.includes('tripadvisor.com')) {
                // TripAdvisor-specific selectors
                const tripAdvisorOverlaySelectors = [
                    '[class*="modal"]',
                    '[class*="overlay"]',
                    '[class*="popup"]',
                    '[role="dialog"]',
                    '[aria-modal="true"]',
                    // Bot detection/CAPTCHA
                    '[class*="captcha"]',
                    '[class*="bot"]',
                    '[class*="challenge"]',
                    // Cookie/privacy notices
                    '[class*="cookie"]',
                    '[class*="privacy"]',
                    '[class*="consent"]'
                ];
                
                closeButtonSelectors.push(...tripAdvisorOverlaySelectors);
                console.log('✈️ Checking for TripAdvisor modals and bot detection...');
            }
            
            // Try to find and close any overlays/modals
            for (const selector of closeButtonSelectors) {
                try {
                    // Check if element exists without waiting too long
                    const element = await page.$(selector);
                    if (element) {
                        // Check if element is visible and clickable
                        const isVisible = await page.evaluate((el) => {
                            const rect = el.getBoundingClientRect();
                            const style = window.getComputedStyle(el);
                            return rect.width > 0 && rect.height > 0 && 
                                   style.display !== 'none' && 
                                   style.visibility !== 'hidden' &&
                                   style.opacity !== '0';
                        }, element);
                        
                        if (isVisible) {
                            console.log(`🤖 Found overlay element with selector: ${selector}, attempting to close...`);
                            await element.click();
                            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for overlay to close
                            console.log(`✅ Successfully closed overlay with selector: ${selector}`);
                            
                            // Try pressing Escape key as backup
                            await page.keyboard.press('Escape');
                            await new Promise(resolve => setTimeout(resolve, 500));
                            
                            break; // Exit after successfully closing one overlay
                        }
                    }
                } catch (error) {
                    // Continue to next selector if this one fails
                    console.log(`🤖 Selector ${selector} failed: ${error.message}`);
                    continue;
                }
            }
            
            // Additional strategy: find buttons with dismissive text content
            try {
                const dismissiveButtons = await page.evaluate(() => {
                    const dismissTexts = ['no thanks', 'skip', 'maybe later', 'close', 'dismiss', 'cancel', 'not now'];
                    const buttons = Array.from(document.querySelectorAll('button, a[role="button"], [type="button"]'));
                    
                    return buttons.filter(button => {
                        const text = button.textContent.toLowerCase().trim();
                        const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
                        return dismissTexts.some(dismissText => 
                            text.includes(dismissText) || ariaLabel.includes(dismissText)
                        );
                    });
                });
                
                for (const button of dismissiveButtons) {
                    try {
                        console.log('🤖 Found dismissive button, attempting to click...');
                        await button.click();
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        console.log('✅ Successfully clicked dismissive button');
                        break;
                    } catch (error) {
                        continue;
                    }
                }
            } catch (error) {
                // Ignore errors finding dismissive buttons
            }
            
            // Additional strategy: try pressing Escape key multiple times
            try {
                await page.keyboard.press('Escape');
                await new Promise(resolve => setTimeout(resolve, 500));
                await page.keyboard.press('Escape');
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                // Ignore keyboard errors
            }
            
            // Look for any remaining visible overlays and try to click outside them
            try {
                const hasVisibleOverlay = await page.evaluate(() => {
                    const overlays = document.querySelectorAll('[class*="modal"], [class*="overlay"], [role="dialog"], [aria-modal="true"]');
                    return Array.from(overlays).some(overlay => {
                        const rect = overlay.getBoundingClientRect();
                        const style = window.getComputedStyle(overlay);
                        return rect.width > 0 && rect.height > 0 && 
                               style.display !== 'none' && 
                               style.visibility !== 'hidden';
                    });
                });
                
                if (hasVisibleOverlay) {
                    console.log('🤖 Found persistent overlay, trying to click outside it...');
                    // Click in top-left corner to dismiss overlay
                    await page.click('body', { offset: { x: 10, y: 10 } });
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } catch (error) {
                // Ignore click errors
            }
            
        } catch (error) {
            console.log('🤖 PuppeteerExtractor: Overlay handling failed:', error.message);
        }
    }

    /**
     * Handle lazy loading by scrolling and waiting for content
     */
    async handleLazyLoading(page) {
        console.log('🤖 PuppeteerExtractor: Handling lazy loading...');
        
        try {
            // Get initial page height
            let previousHeight = await page.evaluate('document.body.scrollHeight');
            
            // Optimized scrolling for faster content loading
            for (let i = 0; i < 3; i++) {
                // Scroll to bottom
                await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
                
                // Reduced wait time for new content
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Check if page height changed (new content loaded)
                const newHeight = await page.evaluate('document.body.scrollHeight');
                
                if (newHeight === previousHeight) {
                    // No new content, we can stop
                    break;
                }
                
                previousHeight = newHeight;
            }
            
            // Scroll back to top
            await page.evaluate('window.scrollTo(0, 0)');
            await new Promise(resolve => setTimeout(resolve, 500));
            
        } catch (error) {
            console.log('🤖 PuppeteerExtractor: Lazy loading handling failed:', error.message);
        }
    }

    /**
     * Generic extraction for dynamic sites with enhanced content detection
     */
    async _extractGeneric(page, url) {
        console.log('🌐 PuppeteerExtractor: Extracting dynamic content...');
        
        try {
            const data = await page.evaluate(() => {
                const result = {
                    title: '',
                    content: '',
                    description: '',
                    metadata: {}
                };

                // Enhanced title extraction
                result.title = document.querySelector('h1')?.textContent?.trim() ||
                             document.querySelector('[data-testid*="title"]')?.textContent?.trim() ||
                             document.querySelector('.title')?.textContent?.trim() ||
                             document.title ||
                             'Untitled';

                // Enhanced description extraction
                const descEl = document.querySelector('meta[name="description"]') ||
                             document.querySelector('meta[property="og:description"]') ||
                             document.querySelector('[data-testid*="description"]');
                if (descEl) result.description = descEl.getAttribute('content') || descEl.textContent?.trim();

                // Enhanced content extraction with priority-based selectors
                // Restaurant/business listing specific selectors (highest priority)
                const contentSelectors = [
                    // Restaurant-specific content areas
                    '[class*="menu"]',
                    '[class*="hours"]', 
                    '[class*="contact"]',
                    '[class*="about"]',
                    '[class*="location"]',
                    '[class*="address"]',
                    
                    // Yelp/restaurant specific selectors
                    '[data-testid="serp-ia-card"]',
                    '[class*="search-result"]',
                    '[class*="business"]',
                    '[class*="restaurant"]',
                    'h3 a[href*="/biz/"]',
                    '.regular-search-result',
                    
                    // Semantic HTML5 elements
                    'article',
                    'main',
                    '[role="main"]',
                    
                    // Modern webapp selectors with data attributes
                    '[data-testid*="post-content"]',
                    '[data-testid*="content"]',
                    '[data-testid*="article"]',
                    
                    // News site specific selectors (based on common patterns)
                    '.story-body',                    // BBC, CNN
                    '.articleBody',                   // CNBC
                    '.story-content',                 // USNews  
                    '.InlineStory-container',         // CNBC inline stories
                    '.ArticleBody-articleBody',       // WSJ
                    '.story-text',                    // Various news sites
                    '.post-content-body',            // Forbes
                    '.entry-content',                // WordPress sites
                    '.article-content',              // Generic news
                    '.article-body',                 // Alternative article body
                    
                    // Content-specific selectors that avoid navigation
                    '.content:not(.nav):not(.menu):not(.header):not(.footer)',
                    '.main-content:not(.sidebar)',
                    '#content:not(#nav):not(#menu)',
                    '.post-content:not(.meta)',
                    '.text-content',
                    
                    // Reddit-specific
                    '[data-adclicklocation="media"]',
                    '[data-click-id="text"]',
                    '.Post',
                    '[data-testid="post-content"] .md',
                    
                    // Generic fallbacks (lowest priority)
                    '.content',
                    '.main-content', 
                    '#content'
                ];

                let content = '';
                let bestContent = '';
                let maxLength = 0;

                // Try each selector in priority order and take first good match
                // Following Puppeteer/Cheerio best practices for content selection
                for (const selector of contentSelectors) {
                    const elements = document.querySelectorAll(selector);
                    for (const el of elements) {
                        const text = el.textContent?.trim() || '';
                        
                        // Filter out navigation-heavy content
                        if (text.length > 100) {
                            // Check if content is mostly navigation by counting nav-like words
                            const words = text.split(/\s+/);
                            const navWords = words.filter(word => 
                                /^(Home|About|Contact|Login|Menu|Browse|Search|News|Sports|Business|World|Markets|Politics|Technology|Health|Sign|Subscribe|Follow|Share|More)$/i.test(word)
                            );
                            
                            // Skip if more than 20% navigation words
                            if (navWords.length / words.length > 0.2) {
                                continue;
                            }
                            
                            // Prefer longer, more substantial content
                            if (text.length > maxLength) {
                                maxLength = text.length;
                                bestContent = text;
                                
                                // If we found substantial content (>500 chars) from a high-priority selector, use it
                                if (text.length > 500 && contentSelectors.indexOf(selector) < 10) {
                                    break;
                                }
                            }
                        }
                    }
                    
                    // Break if we found good content from high-priority selector
                    if (bestContent.length > 500 && contentSelectors.indexOf(selector) < 5) {
                        break;
                    }
                }

                content = bestContent;

                // Fallback: collect all paragraphs and meaningful text
                if (!content || content.length < 100) {
                    const textElements = document.querySelectorAll('p, h2, h3, h4, h1, .comment, [data-testid*="comment"], div, span, a');
                    const texts = Array.from(textElements)
                        .map(el => el.textContent?.trim())
                        .filter(text => text && text.length > 10 && !text.match(/^(Advertisement|Cookie|Privacy|Skip|Sign|Log)/i))
                        .slice(0, 50); // Get more content for debugging
                    
                    content = texts.join('\n\n');
                }
                
                // Last resort: get ALL text content if still nothing
                if (!content || content.length < 50) {
                    const bodyText = document.body ? document.body.textContent.trim() : '';
                    if (bodyText && bodyText.length > 50) {
                        content = bodyText.slice(0, 2000); // Limit but capture something
                    }
                }

                // Extract metadata with restaurant-specific fields
                result.metadata = {
                    // Restaurant-specific metadata
                    phone: document.querySelector('a[href*="tel:"]')?.textContent?.trim() ||
                           document.querySelector('[class*="phone"]')?.textContent?.trim(),
                    
                    address: document.querySelector('[class*="address"]')?.textContent?.trim() ||
                            document.querySelector('address')?.textContent?.trim(),
                    
                    hours: document.querySelector('[class*="hours"]')?.textContent?.trim() ||
                           document.querySelector('[class*="open"]')?.textContent?.trim(),
                    
                    cuisine: document.querySelector('[class*="cuisine"]')?.textContent?.trim() ||
                            document.querySelector('[class*="category"]')?.textContent?.trim(),
                    
                    // General metadata
                    author: document.querySelector('[data-testid*="author"]')?.textContent?.trim() ||
                           document.querySelector('.author')?.textContent?.trim() ||
                           document.querySelector('[rel="author"]')?.textContent?.trim(),
                    
                    timestamp: document.querySelector('time')?.getAttribute('datetime') ||
                              document.querySelector('[data-testid*="timestamp"]')?.textContent?.trim(),
                    
                    score: document.querySelector('[data-testid*="score"]')?.textContent?.trim() ||
                          document.querySelector('.score')?.textContent?.trim()
                };

                // Append restaurant metadata to content if available
                if (result.metadata) {
                    const restaurantInfo = [];
                    
                    if (result.metadata.phone) {
                        restaurantInfo.push(`Phone: ${result.metadata.phone}`);
                    }
                    if (result.metadata.address) {
                        restaurantInfo.push(`Address: ${result.metadata.address}`);
                    }
                    if (result.metadata.hours) {
                        restaurantInfo.push(`Hours: ${result.metadata.hours}`);
                    }
                    if (result.metadata.cuisine) {
                        restaurantInfo.push(`Cuisine: ${result.metadata.cuisine}`);
                    }
                    
                    if (restaurantInfo.length > 0) {
                        content += '\n\n' + restaurantInfo.join('\n');
                    }
                }

                result.content = content;
                return result;
            });

            // Clean up the content
            if (data.content) {
                data.content = data.content
                    .replace(/\s+/g, ' ')
                    .replace(/\n\s*\n/g, '\n\n')
                    .trim();
            }

            return data;
        } catch (error) {
            console.error('Error extracting dynamic content:', error);
            return { title: 'Web Page', content: 'Unable to extract content' };
        }
    }

    /**
     * Close browser instance
     */
    async closeBrowser() {
        // Clear inactivity timer
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
            this.inactivityTimer = null;
        }
        
        if (this.browser && this.browser.isConnected()) {
            console.log('🤖 PuppeteerExtractor: Closing browser...');
            await this.browser.close();
            this.browser = null;
        }
    }
}

export default PuppeteerExtractor;