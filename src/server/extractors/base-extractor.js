import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

class BaseExtractor {
    constructor() {
        this.timeout = 30000; // 30 second default timeout
    }

    /**
     * Determine the best extraction method based on URL/domain
     */
    determineExtractionMethod(url) {
        try {
            const domain = new URL(url).hostname.toLowerCase();
            
            // Sites that require JavaScript/dynamic interaction
            const PUPPETEER_REQUIRED = [
                'maps.google.com',
                'google.com/maps',
                'yelp.com',
                'tripadvisor.com',
                'reddit.com',        // new Reddit
                'www.reddit.com',    // new Reddit
                'quora.com',         // Quora requires dynamic loading
                'facebook.com',
                'twitter.com',
                'instagram.com',
                'linkedin.com',
                'cnbc.com',          // CNBC has heavy JavaScript and dynamic loading
                'usnews.com',        // USNews uses dynamic content loading
                'wsj.com',           // Wall Street Journal has paywall and dynamic content
                'bloomberg.com',     // Bloomberg has complex JavaScript interactions
                'forbes.com',        // Forbes has dynamic ad loading and content
                'marketwatch.com',   // MarketWatch uses dynamic charts and content
                'cnet.com',          // CNET has dynamic product listings
                'techcrunch.com',    // TechCrunch has dynamic article loading
                'espn.com',          // ESPN has dynamic sports content
                'yahoo.com'          // Yahoo has complex dynamic layouts
            ];
            
            // Sites that work well with static HTML parsing
            const CHEERIO_PREFERRED = [
                'old.reddit.com',    // static Reddit
                'cnn.com',
                'bbc.com',
                'bbc.co.uk',
                'nbcnews.com',
                'cbsnews.com',
                'reuters.com',
                'npr.org',
                'nytimes.com',
                'washingtonpost.com',
                'theguardian.com',
                'medium.com',
                'wikipedia.org',
                'stackexchange.com',
                'stackoverflow.com'
            ];
            
            // Check for exact matches first
            if (PUPPETEER_REQUIRED.some(d => domain.includes(d))) {
                console.log(`🤖 BaseExtractor: ${domain} requires Puppeteer (dynamic content)`);
                return 'puppeteer';
            }
            
            if (CHEERIO_PREFERRED.some(d => domain.includes(d))) {
                console.log(`⚡ BaseExtractor: ${domain} optimized for Cheerio (static content)`);
                return 'cheerio';
            }
            
            // Default to Cheerio for better performance
            console.log(`⚡ BaseExtractor: ${domain} defaulting to Cheerio (assumed static)`);
            return 'cheerio';
            
        } catch (error) {
            console.warn(`BaseExtractor: Error parsing URL ${url}, defaulting to Cheerio:`, error.message);
            return 'cheerio';
        }
    }

    /**
     * Classify extracted content type
     */
    classifyContent(extractedData) {
        if (extractedData.reviews && extractedData.reviews.length > 0) {
            return 'reviews';
        }
        if (extractedData.comments && extractedData.comments.length > 0) {
            return 'discussion';
        }
        if (extractedData.title && extractedData.content && extractedData.content.length > 200) {
            return 'article';
        }
        return 'general';
    }

    /**
     * Extract content using Cheerio (static HTML)
     */
    async extractWithCheerio(url, options = {}) {
        console.log(`⚡ BaseExtractor: Extracting ${url} with Cheerio...`);
        
        const maxRetries = 3;
        let lastError = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`⚡ BaseExtractor: Attempt ${attempt}/${maxRetries} for ${url}`);
                
                // Create AbortController for proper timeout handling
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
                
                const response = await fetch(url, {
                    signal: controller.signal,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Accept-Encoding': 'gzip, deflate',
                        'Connection': 'keep-alive',
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    }
                });
                
                clearTimeout(timeoutId); // Clear timeout if request completes

                if (!response.ok) {
                    // Don't retry for client errors (4xx), only server errors (5xx) and network issues
                    if (response.status >= 400 && response.status < 500) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    throw new Error(`HTTP ${response.status}: ${response.statusText} (will retry)`);
                }

                const html = await response.text();
                const $ = cheerio.load(html);

                // Try Mozilla Readability first for articles
                let readabilityResult = null;
                try {
                    const dom = new JSDOM(html, { 
                        url,
                        resources: "usable",
                        runScripts: "outside-only",
                        pretendToBeVisual: false,
                        // Disable CSS parsing to avoid CSS errors
                        features: {
                            FetchExternalResources: false,
                            ProcessExternalResources: false,
                            SkipExternalResources: true
                        }
                    });
                    const reader = new Readability(dom.window.document);
                    readabilityResult = reader.parse();
                } catch (error) {
                    console.warn('BaseExtractor: Readability parsing failed:', error.message);
                }

                // Extract basic information
                const extractedData = {
                    url: url,
                    title: readabilityResult?.title || 
                           $('h1').first().text().trim() || 
                           $('title').text().trim() ||
                           'Untitled',
                    
                    content: readabilityResult?.textContent || 
                            this.extractMainContent($) ||
                            '',
                    
                    author: readabilityResult?.byline ||
                           $('[rel="author"]').text().trim() ||
                           $('.author').text().trim() ||
                           $('meta[name="author"]').attr('content') ||
                           '',
                    
                    publishDate: $('time').attr('datetime') ||
                               $('meta[property="article:published_time"]').attr('content') ||
                               $('meta[name="date"]').attr('content') ||
                               '',
                    
                    description: $('meta[name="description"]').attr('content') ||
                               $('meta[property="og:description"]').attr('content') ||
                               '',
                    
                    images: options.includeImages ? this.extractImages($) : [],
                    
                    extractionMethod: 'cheerio',
                    extractedAt: new Date().toISOString()
                };

                // Truncate content if needed
                if (options.maxLength && extractedData.content.length > options.maxLength) {
                    extractedData.content = this.truncateIntelligently(extractedData.content, options.maxLength);
                    extractedData.truncated = true;
                }

                console.log(`✅ BaseExtractor: Successfully extracted ${extractedData.content.length} characters from ${url}`);
                return extractedData;

            } catch (error) {
                lastError = error;
                console.error(`❌ BaseExtractor: Attempt ${attempt} failed for ${url}:`, error.message);
                
                // Handle AbortError from timeout
                if (error.name === 'AbortError') {
                    console.log(`⚠️ BaseExtractor: Request timeout for ${url}`);
                    error.message = 'Request timeout (8 seconds)';
                }
                
                // Don't retry for client errors (4xx) or connection timeouts
                if (error.message.includes('HTTP 4')) {
                    break;
                }
                
                // Don't retry connection timeouts - site is likely unresponsive
                if (error.message.includes('ETIMEDOUT') || error.message.includes('ECONNREFUSED') || error.message.includes('timeout')) {
                    console.log(`⚠️ BaseExtractor: Connection timeout detected, skipping retries for ${url}`);
                    break;
                }
                
                // Wait before retrying (exponential backoff) - reduced delays for faster processing
                if (attempt < maxRetries) {
                    const delay = Math.pow(2, attempt) * 500; // 1s, 2s instead of 2s, 4s, 8s
                    console.log(`⚡ BaseExtractor: Waiting ${delay}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        // All attempts failed
        console.error(`❌ BaseExtractor: All ${maxRetries} attempts failed for ${url}`);
        throw lastError;
    }

    /**
     * Extract main content from page using various selectors
     */
    extractMainContent($) {
        const contentSelectors = [
            'article',
            '.content',
            '.post-content',
            '.entry-content', 
            '.article-content',
            '.story-body',
            '.post-body',
            'main',
            '#content',
            '.main-content'
        ];

        for (const selector of contentSelectors) {
            const content = $(selector).text().trim();
            if (content && content.length > 100) {
                return content;
            }
        }

        // Fallback: get all paragraph text
        const paragraphs = $('p').map((i, el) => $(el).text().trim()).get();
        return paragraphs.filter(p => p.length > 20).join('\n\n');
    }

    /**
     * Extract image URLs from page
     */
    extractImages($) {
        const images = [];
        
        // Main content images
        $('article img, .content img, main img').each((i, img) => {
            const src = $(img).attr('src');
            const alt = $(img).attr('alt') || '';
            
            if (src && !src.startsWith('data:')) {
                images.push({
                    url: src,
                    alt: alt,
                    type: 'content'
                });
            }
        });

        // Featured/hero images
        const featuredImg = $('meta[property="og:image"]').attr('content');
        if (featuredImg) {
            images.unshift({
                url: featuredImg,
                alt: 'Featured image',
                type: 'featured'
            });
        }

        return images.slice(0, 10); // Limit to 10 images
    }

    /**
     * Intelligently truncate content preserving important sections
     */
    truncateIntelligently(content, maxLength) {
        if (content.length <= maxLength) {
            return content;
        }

        // Try to preserve first and last paragraphs
        const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
        
        if (paragraphs.length <= 1) {
            return content.substring(0, maxLength - 3) + '...';
        }

        const firstParagraph = paragraphs[0];
        const lastParagraph = paragraphs[paragraphs.length - 1];
        
        let result = firstParagraph;
        let remaining = maxLength - firstParagraph.length - lastParagraph.length - 20; // Buffer for ellipsis

        if (remaining > 100) {
            // Add middle content
            const middleContent = paragraphs.slice(1, -1).join('\n\n');
            if (middleContent.length <= remaining) {
                result += '\n\n' + middleContent + '\n\n' + lastParagraph;
            } else {
                result += '\n\n' + middleContent.substring(0, remaining - 10) + '...\n\n' + lastParagraph;
            }
        } else {
            // Just first paragraph with truncation
            if (result.length > maxLength - 3) {
                result = result.substring(0, maxLength - 3) + '...';
            }
        }

        return result;
    }

    /**
     * Clean and normalize text content
     */
    cleanText(text) {
        return text
            .replace(/\s+/g, ' ')  // Normalize whitespace
            .replace(/\n\s*\n/g, '\n\n')  // Normalize line breaks
            .trim();
    }

    /**
     * Check if URL is accessible
     */
    async checkUrlAccessibility(url) {
        try {
            const response = await fetch(url, { 
                method: 'HEAD',
                timeout: 5000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }
}

export default BaseExtractor;