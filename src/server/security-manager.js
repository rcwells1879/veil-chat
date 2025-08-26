/**
 * Server-Side Security Manager for VeilChat MCP Server
 * Handles URL validation, request sandboxing, and file system protection
 */

import fs from 'fs';
import path from 'path';

class SecurityManager {
    constructor() {
        // Enhanced blocklist combining existing bot detection + security domains
        this.blockedDomains = [
            // Original bot detection sites (from existing BLOCKED_SITES)
            'yelp.com',
            'tripadvisor.com', 
            'facebook.com',
            'twitter.com',
            'x.com',
            'linkedin.com',
            'instagram.com',
            'tiktok.com',
            'pinterest.com',
            'beeradvocate.com',
            'ubereats.com',
            
            // Security-sensitive domains
            'localhost',
            '127.0.0.1',
            '0.0.0.0',
            'internal',
            'local',
            'intranet',
            
            // Cloud metadata services (prevent SSRF)
            '169.254.169.254', // AWS metadata
            '169.254.169.253', // AWS metadata
            'metadata.google.internal', // GCP metadata
            '100.100.100.200', // Alibaba Cloud
            
            // Malicious/suspicious patterns
            'bit.ly',
            'tinyurl.com',
            't.co',
            'goo.gl',
            'ow.ly',
            'tiny.cc',
            'is.gd',
            'buff.ly'
        ];
        
        // Allowed domains (allowlist approach for high security)
        this.allowedDomains = [
            // News sources
            'bbc.com',
            'cnn.com', 
            'reuters.com',
            'npr.org',
            'theguardian.com',
            'washingtonpost.com',
            'nytimes.com',
            'wsj.com',
            'bloomberg.com',
            'cnbc.com',
            'foxnews.com',
            'nbcnews.com',
            'cbsnews.com',
            'apnews.com',
            
            // Educational/Reference
            'wikipedia.org',
            'github.com',
            'stackoverflow.com',
            'reddit.com',
            'news.ycombinator.com',
            'medium.com',
            'dev.to',
            
            // Tech/Documentation
            'techcrunch.com',
            'arstechnica.com',
            'wired.com',
            'docs.microsoft.com',
            'learn.microsoft.com',
            'developer.mozilla.org',
            'w3schools.com',
            
            // Academic/Research
            'arxiv.org',
            'scholar.google.com',
            'pubmed.ncbi.nlm.nih.gov',
            'nature.com',
            'science.org',
            'ieee.org'
        ];
        
        // Blocked URL patterns (regex)
        this.blockedPatterns = [
            /^file:\/\//i,
            /^ftp:\/\//i, 
            /^javascript:/i,
            /^data:/i,
            /^vbscript:/i,
            /^about:/i,
            /^chrome:/i,
            /^chrome-extension:/i,
            /^moz-extension:/i,
            /192\.168\./i, // Private networks
            /10\./i,       // Private networks
            /172\.(1[6-9]|2[0-9]|3[0-1])\./i, // Private networks
            /\.local$/i,
            /\.internal$/i,
            /\.intranet$/i,
            /localhost/i,
            /127\.0\.0\.1/i,
            /0\.0\.0\.0/i
        ];
        
        // Request limits for sandboxing
        this.requestLimits = {
            maxConcurrentRequests: 5,
            maxRequestsPerMinute: 20,
            maxContentLength: 1024 * 1024 * 5, // 5MB
            requestTimeout: 15000, // 15 seconds
            maxRedirects: 3
        };
        
        // Track active requests
        this.activeRequests = new Set();
        this.requestHistory = new Map(); // URL -> { count, lastReset }
        
        // File system protection
        this.readOnlyMode = true;
        this.allowedWritePaths = []; // No write access by default
        this.blockedFilePaths = [
            '/etc/',
            '/var/',
            '/usr/',
            '/sys/',
            '/proc/',
            '/boot/',
            '/dev/',
            'C:\\Windows\\',
            'C:\\Program Files\\',
            'C:\\Users\\',
            '~/.ssh/',
            '~/.aws/',
            '~/.config/'
        ];
    }
    
    /**
     * Legacy compatibility - replaces old isBlockedSite function
     */
    isBlockedSite(url) {
        try {
            const domain = new URL(url).hostname.toLowerCase();
            return this.isBlockedDomain(domain);
        } catch (error) {
            return false; // Invalid URL, don't block
        }
    }
    
    /**
     * Validate URL for web extraction
     */
    validateURL(url) {
        const result = {
            isValid: false,
            reason: '',
            riskLevel: 'high'
        };
        
        try {
            const urlObj = new URL(url);
            
            // Check protocol
            if (!['http:', 'https:'].includes(urlObj.protocol)) {
                result.reason = `Blocked protocol: ${urlObj.protocol}`;
                return result;
            }
            
            // Check against blocked patterns
            for (const pattern of this.blockedPatterns) {
                if (pattern.test(url)) {
                    result.reason = `URL matches blocked pattern: ${pattern}`;
                    return result;
                }
            }
            
            const hostname = urlObj.hostname.toLowerCase();
            
            // Check blocked domains
            if (this.isBlockedDomain(hostname)) {
                result.reason = `Blocked domain: ${hostname}`;
                return result;
            }
            
            // Check IP addresses (prevent SSRF)
            if (this.isIPAddress(hostname)) {
                result.reason = `Direct IP access blocked: ${hostname}`;
                return result;
            }
            
            // Check allowed domains (allowlist approach)
            if (!this.isAllowedDomain(hostname)) {
                result.reason = `Domain not in allowlist: ${hostname}`;
                result.riskLevel = 'medium';
                // Still allow but mark as medium risk
            } else {
                result.riskLevel = 'low';
            }
            
            result.isValid = true;
            return result;
            
        } catch (error) {
            result.reason = `Invalid URL format: ${error.message}`;
            return result;
        }
    }
    
    /**
     * Check if domain is blocked
     */
    isBlockedDomain(hostname) {
        return this.blockedDomains.some(blocked => 
            hostname === blocked || hostname.endsWith('.' + blocked)
        );
    }
    
    /**
     * Check if domain is in allowlist
     */
    isAllowedDomain(hostname) {
        return this.allowedDomains.some(allowed => 
            hostname === allowed || hostname.endsWith('.' + allowed)
        );
    }
    
    /**
     * Check if hostname is an IP address
     */
    isIPAddress(hostname) {
        // IPv4 pattern
        const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
        // IPv6 pattern (simplified)
        const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
        
        return ipv4Pattern.test(hostname) || ipv6Pattern.test(hostname);
    }
    
    /**
     * Check request rate limits
     */
    checkRateLimit(url) {
        const now = Date.now();
        const minute = 60 * 1000;
        
        if (!this.requestHistory.has(url)) {
            this.requestHistory.set(url, { count: 1, lastReset: now });
            return { allowed: true };
        }
        
        const history = this.requestHistory.get(url);
        
        // Reset counter if a minute has passed
        if (now - history.lastReset > minute) {
            history.count = 1;
            history.lastReset = now;
            return { allowed: true };
        }
        
        // Check if under limit
        if (history.count < this.requestLimits.maxRequestsPerMinute) {
            history.count++;
            return { allowed: true };
        }
        
        return { 
            allowed: false, 
            reason: 'Rate limit exceeded',
            retryAfter: minute - (now - history.lastReset)
        };
    }
    
    /**
     * Check concurrent request limits
     */
    checkConcurrentLimit() {
        if (this.activeRequests.size >= this.requestLimits.maxConcurrentRequests) {
            return {
                allowed: false,
                reason: 'Too many concurrent requests'
            };
        }
        
        return { allowed: true };
    }
    
    /**
     * Register an active request
     */
    registerRequest(requestId) {
        this.activeRequests.add(requestId);
        
        // Auto-cleanup after timeout
        setTimeout(() => {
            this.activeRequests.delete(requestId);
        }, this.requestLimits.requestTimeout + 5000);
    }
    
    /**
     * Unregister a completed request
     */
    unregisterRequest(requestId) {
        this.activeRequests.delete(requestId);
    }
    
    /**
     * Block file system write operations
     */
    blockFileSystemWrites() {
        // Override fs methods to prevent writes while preserving in-memory operations
        const originalWriteFile = fs.writeFile;
        const originalWriteFileSync = fs.writeFileSync;
        const originalCreateWriteStream = fs.createWriteStream;
        const originalMkdir = fs.mkdir;
        const originalMkdirSync = fs.mkdirSync;
        
        fs.writeFile = (...args) => {
            const callback = args[args.length - 1];
            if (typeof callback === 'function') {
                callback(new Error('🔒 File writes are blocked for security'));
            }
        };
        
        fs.writeFileSync = () => {
            throw new Error('🔒 Synchronous file writes are blocked for security');
        };
        
        fs.createWriteStream = () => {
            throw new Error('🔒 Write streams are blocked for security');
        };
        
        fs.mkdir = (...args) => {
            const callback = args[args.length - 1];
            if (typeof callback === 'function') {
                callback(new Error('🔒 Directory creation is blocked for security'));
            }
        };
        
        fs.mkdirSync = () => {
            throw new Error('🔒 Synchronous directory creation is blocked for security');
        };
        
        console.log('🔒 File system write operations have been blocked');
    }
    
    /**
     * Create sandboxed request configuration
     */
    createSandboxedRequestConfig(url) {
        return {
            url: url,
            timeout: this.requestLimits.requestTimeout,
            maxRedirects: this.requestLimits.maxRedirects,
            maxContentLength: this.requestLimits.maxContentLength,
            validateStatus: (status) => status >= 200 && status < 400,
            headers: {
                'User-Agent': 'VeilChat-Bot/1.0 (Security-Sandboxed)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'DNT': '1',
                'Connection': 'keep-alive'
            }
        };
    }
    
    /**
     * Get security statistics
     */
    getSecurityStats() {
        return {
            activeRequests: this.activeRequests.size,
            totalDomainHistory: this.requestHistory.size,
            blockedDomains: this.blockedDomains.length,
            allowedDomains: this.allowedDomains.length,
            readOnlyMode: this.readOnlyMode,
            limits: this.requestLimits
        };
    }
    
    /**
     * Log security events
     */
    logSecurityEvent(eventType, details) {
        const event = {
            timestamp: new Date().toISOString(),
            type: eventType,
            details: details,
            serverInstance: 'mcp-server'
        };
        
        console.warn('🔒 Server Security Event:', event);
    }
}

export default SecurityManager;