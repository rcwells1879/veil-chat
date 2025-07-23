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
        this.timeout = 20000; // 20 seconds for complex sites like Bloomberg, CNBC
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
                '--disable-extensions',
                '--disable-plugins',
                '--disable-images', // Speed up by not loading images
                '--disable-javascript-harmony-shipping',
                '--disable-ipc-flooding-protection',
                '--enable-automation',
                '--password-store=basic',
                '--use-mock-keychain',
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

        // Close browser after 5 minutes of inactivity to save resources
        setTimeout(() => {
            if (browser && browser.isConnected()) {
                console.log('🤖 PuppeteerExtractor: Closing browser due to inactivity');
                browser.close().catch(console.error);
            }
        }, 5 * 60 * 1000);

        return browser;
    }

    /**
     * Extract content using Puppeteer for dynamic sites
     */
    async extractWithPuppeteer(url, options = {}) {
        console.log(`🤖 PuppeteerExtractor: Extracting ${url} with Puppeteer...`);
        
        let page = null;
        
        try {
            const browser = await this.getBrowser();
            page = await browser.newPage();

            // Set timeout and configure page
            await page.setDefaultNavigationTimeout(this.timeout);
            await page.setDefaultTimeout(this.timeout);

            // Enhanced stealth configuration
            await page.setExtraHTTPHeaders({
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            });

            // Remove webdriver traces
            await page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
                window.chrome = { runtime: {} };
                Object.defineProperty(navigator, 'permissions', { get: () => ({ query: () => ({ state: 'granted' }) }) });
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
                        navError.message.includes('ERR_INTERNET_DISCONNECTED')) {
                        // Network connectivity issue - don't retry
                        throw navError;
                    }
                    
                    if (navigationAttempts >= maxAttempts) throw navError;
                    
                    // Progressive delay: 2s, 4s, 6s
                    const delay = navigationAttempts * 2000;
                    console.log(`🤖 PuppeteerExtractor: Waiting ${delay}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }

            // Advanced content loading strategy
            console.log(`🤖 PuppeteerExtractor: Waiting for dynamic content...`);
            
            // Reduced wait times for faster extraction
            await new Promise(resolve => setTimeout(resolve, 2000));
            
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
            // Wait for business info
            await page.waitForSelector('h1', { timeout: 10000 });
            
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

                // Business name
                const nameEl = document.querySelector('h1');
                if (nameEl) result.title = nameEl.textContent.trim();

                // Rating
                const ratingEl = document.querySelector('[data-testid="review-star-rating"]') ||
                               document.querySelector('.i-stars');
                if (ratingEl) result.rating = ratingEl.getAttribute('aria-label') || ratingEl.textContent.trim();

                // Address
                const addressEl = document.querySelector('[data-testid="business-address"]') ||
                                document.querySelector('address');
                if (addressEl) result.address = addressEl.textContent.trim();

                // Phone
                const phoneEl = document.querySelector('[href*="tel:"]');
                if (phoneEl) result.phone = phoneEl.textContent.trim();

                // Reviews
                const reviewElements = document.querySelectorAll('[data-testid*="review"]') ||
                                     document.querySelectorAll('.review');
                
                Array.from(reviewElements).slice(0, 5).forEach(review => {
                    const reviewText = review.querySelector('.raw__09f24__T4Ezm')?.textContent?.trim() ||
                                     review.querySelector('.comment')?.textContent?.trim();
                    const reviewer = review.querySelector('[data-testid="user-name"]')?.textContent?.trim() ||
                                   review.querySelector('.user-name')?.textContent?.trim();
                    
                    if (reviewText) {
                        result.reviews.push({
                            text: reviewText,
                            author: reviewer || 'Anonymous'
                        });
                    }
                });

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
                }

                result.content = content;
                return result;
            });

            return data;
        } catch (error) {
            console.error('Error extracting Yelp data:', error);
            return { title: 'Yelp Business', content: 'Unable to extract detailed information' };
        }
    }

    /**
     * Extract TripAdvisor information and reviews
     */
    async _extractTripAdvisor(page, url) {
        console.log('✈️ PuppeteerExtractor: Extracting TripAdvisor data...');
        
        try {
            await page.waitForSelector('h1', { timeout: 10000 });
            
            const data = await page.evaluate(() => {
                const result = {
                    title: '',
                    content: '',
                    rating: '',
                    reviews: []
                };

                // Title
                const titleEl = document.querySelector('h1') ||
                              document.querySelector('[data-test-target="POI_NAME"]');
                if (titleEl) result.title = titleEl.textContent.trim();

                // Rating
                const ratingEl = document.querySelector('[data-test-target="review-rating"]') ||
                               document.querySelector('.ui_bubble_rating');
                if (ratingEl) result.rating = ratingEl.getAttribute('alt') || ratingEl.textContent.trim();

                // Reviews
                const reviewElements = document.querySelectorAll('[data-test-target="HR_CC_CARD"]') ||
                                     document.querySelectorAll('.review-container');
                
                Array.from(reviewElements).slice(0, 5).forEach(review => {
                    const reviewText = review.querySelector('.partial_entry')?.textContent?.trim() ||
                                     review.querySelector('.reviewText')?.textContent?.trim();
                    const reviewer = review.querySelector('.username')?.textContent?.trim();
                    
                    if (reviewText) {
                        result.reviews.push({
                            text: reviewText,
                            author: reviewer || 'Anonymous'
                        });
                    }
                });

                // Create content
                let content = `${result.title}\n\n`;
                if (result.rating) content += `Rating: ${result.rating}\n\n`;
                
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
            console.error('Error extracting TripAdvisor data:', error);
            return { title: 'TripAdvisor Location', content: 'Unable to extract detailed information' };
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
                // Following Puppeteer best practices for page evaluation
                const contentSelectors = [
                    // Semantic HTML5 elements (highest priority)
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
                    const textElements = document.querySelectorAll('p, h2, h3, h4, .comment, [data-testid*="comment"]');
                    const texts = Array.from(textElements)
                        .map(el => el.textContent?.trim())
                        .filter(text => text && text.length > 30 && !text.match(/^(Advertisement|Cookie|Privacy)/i))
                        .slice(0, 20); // Limit to prevent too much content
                    
                    content = texts.join('\n\n');
                }

                // Extract metadata
                result.metadata = {
                    author: document.querySelector('[data-testid*="author"]')?.textContent?.trim() ||
                           document.querySelector('.author')?.textContent?.trim() ||
                           document.querySelector('[rel="author"]')?.textContent?.trim(),
                    
                    timestamp: document.querySelector('time')?.getAttribute('datetime') ||
                              document.querySelector('[data-testid*="timestamp"]')?.textContent?.trim(),
                    
                    score: document.querySelector('[data-testid*="score"]')?.textContent?.trim() ||
                          document.querySelector('.score')?.textContent?.trim()
                };

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
        if (this.browser && this.browser.isConnected()) {
            console.log('🤖 PuppeteerExtractor: Closing browser...');
            await this.browser.close();
            this.browser = null;
        }
    }
}

export default PuppeteerExtractor;