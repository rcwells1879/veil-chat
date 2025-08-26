import BaseExtractor from './base-extractor.js';
import PuppeteerExtractor from './puppeteer-extractor.js';

class WebExtractor {
    constructor() {
        this.baseExtractor = new BaseExtractor();
        this.puppeteerExtractor = new PuppeteerExtractor();
        this.cache = new Map();
        this.cacheTimeout = 10 * 60 * 1000; // 10 minutes
    }

    /**
     * Main extraction method - automatically chooses best approach
     */
    async extract(url, options = {}) {
        console.log(`🔍 WebExtractor: Starting extraction for ${url}`);
        
        try {
            // Validate URL
            new URL(url);
            
            // Check cache first
            const cacheKey = `${url}_${JSON.stringify(options)}`;
            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    console.log(`📋 WebExtractor: Returning cached result for ${url}`);
                    return cached.data;
                } else {
                    this.cache.delete(cacheKey);
                }
            }

            // Note: Removed strict URL accessibility check as HEAD requests often fail
            // for sites that block bots, but full requests with proper headers work fine

            // Determine extraction method
            const method = this.baseExtractor.determineExtractionMethod(url);
            
            let extractedData;
            let usedFallback = false;
            
            try {
                if (method === 'puppeteer') {
                    extractedData = await this.puppeteerExtractor.extractWithPuppeteer(url, options);
                } else {
                    // Try Cheerio first for performance
                    extractedData = await this.baseExtractor.extractWithCheerio(url, options);
                    
                    // Check if content extraction was poor - fallback to Puppeteer
                    if (this._shouldFallbackToPuppeteer(extractedData)) {
                        console.log(`⚡ WebExtractor: Poor Cheerio extraction, falling back to Puppeteer for ${url}`);
                        extractedData = await this.puppeteerExtractor.extractWithPuppeteer(url, options);
                        usedFallback = true;
                    }
                }
            } catch (error) {
                // Don't fallback to Puppeteer for true connection timeouts - but do fallback for request timeouts
                if (error.message.includes('ETIMEDOUT') || error.message.includes('ECONNREFUSED')) {
                    console.log(`⚠️ WebExtractor: Connection timeout detected, skipping Puppeteer fallback for ${url}`);
                    throw error;
                }
                
                // For request timeouts (AbortError), still try Puppeteer as the site might need JS
                if (error.message.includes('Request timeout') || error.name === 'AbortError') {
                    console.log(`🔄 WebExtractor: Request timeout detected, trying Puppeteer fallback for ${url}`);
                    // Don't throw here, let it fall through to Puppeteer fallback
                }
                
                // If Cheerio fails and we haven't tried Puppeteer yet, try it as fallback
                if (method === 'cheerio' && !usedFallback) {
                    console.log(`⚡ WebExtractor: Cheerio failed, trying Puppeteer fallback for ${url}: ${error.message}`);
                    try {
                        extractedData = await this.puppeteerExtractor.extractWithPuppeteer(url, options);
                        usedFallback = true;
                    } catch (puppeteerError) {
                        // Both methods failed, throw the original error
                        throw error;
                    }
                } else {
                    throw error;
                }
            }

            // Clean and validate extracted data
            extractedData = this._cleanExtractedData(extractedData);
            
            // Cache the result
            this.cache.set(cacheKey, {
                data: extractedData,
                timestamp: Date.now()
            });
            
            // Clean old cache entries
            this._cleanCache();
            
            console.log(`✅ WebExtractor: Successfully extracted content from ${url}`);
            return extractedData;
            
        } catch (error) {
            console.error(`❌ WebExtractor: Failed to extract from ${url}:`, error.message);
            throw error;
        }
    }

    /**
     * Extract content for summarization (optimized for LLM consumption)
     */
    async extractForSummarization(url, options = {}) {
        const defaultOptions = {
            maxLength: 4000, // Reasonable length for LLM processing
            includeImages: false, // Skip images for summarization
            blockResources: true // Faster loading for dynamic sites
        };
        
        return await this.extract(url, { ...defaultOptions, ...options });
    }

    /**
     * Extract content for detailed analysis (full content)
     */
    async extractForAnalysis(url, options = {}) {
        const defaultOptions = {
            maxLength: 10000, // More detailed content
            includeImages: true,
            blockResources: false
        };
        
        return await this.extract(url, { ...defaultOptions, ...options });
    }

    /**
     * Batch extract multiple URLs
     */
    async extractBatch(urls, options = {}) {
        console.log(`🔍 WebExtractor: Starting batch extraction for ${urls.length} URLs`);
        
        const results = [];
        const maxConcurrent = options.maxConcurrent || 3;
        
        // Process URLs in batches to avoid overwhelming the system
        for (let i = 0; i < urls.length; i += maxConcurrent) {
            const batch = urls.slice(i, i + maxConcurrent);
            const promises = batch.map(async (url) => {
                try {
                    const result = await this.extract(url, options);
                    return { url, success: true, data: result };
                } catch (error) {
                    console.error(`❌ WebExtractor: Batch extraction failed for ${url}:`, error.message);
                    return { url, success: false, error: error.message };
                }
            });
            
            const batchResults = await Promise.all(promises);
            results.push(...batchResults);
            
            // Small delay between batches to be respectful
            if (i + maxConcurrent < urls.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        console.log(`✅ WebExtractor: Batch extraction completed. ${results.filter(r => r.success).length}/${urls.length} successful`);
        return results;
    }

    /**
     * Get extraction statistics
     */
    getStats() {
        return {
            cacheSize: this.cache.size,
            cacheHitRate: this._calculateCacheHitRate(),
            availableMethods: ['cheerio', 'puppeteer']
        };
    }

    /**
     * Clear extraction cache
     */
    clearCache() {
        this.cache.clear();
        console.log('🧹 WebExtractor: Cache cleared');
    }

    /**
     * Check if we should fallback to Puppeteer based on content quality
     */
    _shouldFallbackToPuppeteer(extractedData) {
        if (!extractedData || !extractedData.content) {
            return true; // No content at all
        }
        
        const content = extractedData.content.trim();
        const contentLength = content.length;
        
        // Very short content suggests poor extraction
        if (contentLength < 100) {
            return true;
        }
        
        // Check for common signs of JavaScript-heavy sites that Cheerio can't handle
        const jsIndicators = [
            'Please enable JavaScript',
            'JavaScript is required',
            'This site requires JavaScript',
            'Enable JavaScript to view',
            'JavaScript must be enabled',
            'Your browser does not support JavaScript',
            'Please turn on JavaScript',
            'JavaScript disabled'
        ];
        
        if (jsIndicators.some(indicator => content.includes(indicator))) {
            return true;
        }
        
        // Check for mostly navigation/footer content (common with dynamic sites)
        const navigationWords = ['Home', 'About', 'Contact', 'Privacy', 'Terms', 'Login', 'Sign up', 'Menu'];
        const words = content.split(/\s+/).filter(w => w.length > 2);
        const navWordCount = words.filter(word => navigationWords.includes(word)).length;
        
        // If more than 30% of content is navigation words, likely poor extraction
        if (words.length > 0 && (navWordCount / words.length) > 0.3) {
            return true;
        }
        
        // Content seems reasonable
        return false;
    }

    /**
     * Clean and validate extracted data
     */
    _cleanExtractedData(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid extraction result');
        }

        // Ensure required fields exist
        data.title = data.title || 'Untitled';
        data.content = data.content || '';
        data.url = data.url || '';
        
        // Clean text content
        if (data.content) {
            data.content = this.baseExtractor.cleanText(data.content);
        }
        
        if (data.title) {
            data.title = this.baseExtractor.cleanText(data.title);
        }
        
        // Validate content length
        if (data.content.length < 10) {
            console.warn(`⚠️ WebExtractor: Very short content extracted (${data.content.length} chars)`);
        }
        
        return data;
    }

    /**
     * Clean old cache entries
     */
    _cleanCache() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.cacheTimeout) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Calculate cache hit rate (simple implementation)
     */
    _calculateCacheHitRate() {
        // This would need more sophisticated tracking in a real implementation
        return this.cache.size > 0 ? 0.3 : 0; // Placeholder
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        console.log('🧹 WebExtractor: Cleaning up resources...');
        await this.puppeteerExtractor.closeBrowser();
        this.clearCache();
    }
}

export default WebExtractor;