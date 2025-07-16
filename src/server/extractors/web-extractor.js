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

            // Check URL accessibility first
            const isAccessible = await this.baseExtractor.checkUrlAccessibility(url);
            if (!isAccessible) {
                throw new Error('URL is not accessible');
            }

            // Determine extraction method
            const method = this.baseExtractor.determineExtractionMethod(url);
            
            let extractedData;
            if (method === 'puppeteer') {
                extractedData = await this.puppeteerExtractor.extractWithPuppeteer(url, options);
            } else {
                extractedData = await this.baseExtractor.extractWithCheerio(url, options);
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