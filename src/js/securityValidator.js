/**
 * Security Validator - Input validation and sanitization for VeilChat
 * Protects against prompt injection, XSS, and other security vulnerabilities
 */

if (typeof SecurityValidator === 'undefined') {
    window.SecurityValidator = class SecurityValidator {
        constructor() {
            // Prompt injection patterns to detect
            this.promptInjectionPatterns = [
                // Direct instruction attempts
                /ignore\s+(previous|all|above)\s+(instructions?|prompts?|commands?)/gi,
                /forget\s+(everything|all|previous)\s+(instructions?|prompts?)/gi,
                /new\s+(instructions?|prompts?|commands?)/gi,
                /system\s*:\s*[^.]+/gi,
                /assistant\s*:\s*[^.]+/gi,
                /human\s*:\s*[^.]+/gi,
                
                // System escape attempts
                /\[SYSTEM\]/gi,
                /\[\/SYSTEM\]/gi,
                /\[INSTRUCTION\]/gi,
                /\[\/INSTRUCTION\]/gi,
                /<\s*system\s*>/gi,
                /<\/\s*system\s*>/gi,
                
                // SSML/XML injection
                /<script[^>]*>/gi,
                /<\/script>/gi,
                /javascript\s*:/gi,
                /vbscript\s*:/gi,
                /data\s*:/gi,
                
                // Common injection techniques
                /\$\{[^}]*\}/g, // Template literal injection
                /\{\{[^}]*\}\}/g, // Handlebars/template injection
                /%[0-9a-f]{2}/gi, // URL encoding attempts
                /\\x[0-9a-f]{2}/gi, // Hex encoding
                /\\u[0-9a-f]{4}/gi, // Unicode escapes
                
                // Instruction override attempts
                /override\s+(previous|all)\s+(instructions?|settings?)/gi,
                /change\s+your\s+(personality|behavior|instructions?)/gi,
                /update\s+your\s+(system\s+)?(prompt|instructions?)/gi,
                
                // Jailbreak patterns
                /jailbreak/gi,
                /DAN\s+(mode|prompt)/gi,
                /developer\s+mode/gi,
                /unrestricted\s+mode/gi,
                
                // Prompt extraction attempts
                /what\s+(is|are)\s+your\s+(original\s+)?(instructions?|prompts?|system\s+prompts?)/gi,
                /show\s+me\s+your\s+(system\s+)?(prompt|instructions?)/gi,
                /repeat\s+your\s+(system\s+)?(prompt|instructions?)/gi,
                /print\s+your\s+(system\s+)?(prompt|instructions?)/gi
            ];
            
            // SSML injection patterns
            this.ssmlInjectionPatterns = [
                /<speak[^>]*>/gi,
                /<\/speak>/gi,
                /<voice[^>]*>/gi,
                /<\/voice>/gi,
                /<prosody[^>]*>/gi,
                /<\/prosody>/gi,
                /<emphasis[^>]*>/gi,
                /<\/emphasis>/gi,
                /<break[^>]*>/gi,
                /<mstts:express-as[^>]*>/gi,
                /<\/mstts:express-as>/gi,
                /<phoneme[^>]*>/gi,
                /<\/phoneme>/gi,
                /<sub[^>]*>/gi,
                /<\/sub>/gi,
                /<say-as[^>]*>/gi,
                /<\/say-as>/gi
            ];
            
            // Maximum input lengths
            this.maxLengths = {
                userMessage: 10000,
                searchQuery: 500,
                characterPrompt: 2000,
                mcpToolParam: 1000,
                url: 2000,
                attachedFile: 50000 // 50KB limit for individual file content
            };
            
            // Emoji-based injection patterns (2025 research shows malicious content in emoji)
            this.emojiInjectionPatterns = [
                // Hidden Unicode characters that could contain instructions
                /[\u200B-\u200D\uFEFF]/g, // Zero-width characters
                /[\u202A-\u202E]/g, // Text direction override
                /[\u2066-\u2069]/g, // Directional formatting
                /[\u061C]/g, // Arabic letter mark
                
                // Suspicious emoji sequences that might hide instructions
                /[\u{1F300}-\u{1F9FF}]{10,}/gu, // Long emoji sequences (potential hiding)
                /[\u{1F1E6}-\u{1F1FF}]{6,}/gu, // Multiple flag emojis (potential encoding)
                
                // Zero-width joiners used to hide content
                /[\u200D]{3,}/g, // Multiple zero-width joiners
                
                // Invisible or whitespace characters
                /[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/g,
                
                // Mathematical/technical unicode that could encode instructions
                /[\u2100-\u214F]{5,}/g, // Letterlike symbols
                /[\u2200-\u22FF]{5,}/g, // Mathematical operators
                /[\u2300-\u23FF]{5,}/g, // Miscellaneous technical
            ];
            
            // Safe URL patterns (allowlist approach)
            this.allowedDomains = [
                'wikipedia.org',
                'github.com',
                'stackoverflow.com',
                'reddit.com',
                'news.ycombinator.com',
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
                'techcrunch.com',
                'arstechnica.com',
                'wired.com',
                'medium.com',
                'dev.to'
            ];
            
            // Blocked URL patterns
            this.blockedPatterns = [
                /file:\/\//i,
                /ftp:\/\//i,
                /javascript:/i,
                /data:/i,
                /vbscript:/i,
                /localhost/i,
                /127\.0\.0\.1/i,
                /192\.168\./i,
                /10\./i,
                /172\.(1[6-9]|2[0-9]|3[0-1])\./i,
                /\.local$/i,
                /\.internal$/i
            ];
        }
        
        /**
         * Validate and sanitize user input for LLM processing
         */
        validateUserInput(input, type = 'userMessage') {
            const result = {
                isValid: true,
                sanitizedInput: input,
                violations: [],
                riskLevel: 'low'
            };
            
            // Check input length
            if (input.length > this.maxLengths[type]) {
                result.isValid = false;
                result.violations.push(`Input exceeds maximum length of ${this.maxLengths[type]} characters`);
                result.riskLevel = 'high';
                return result;
            }
            
            // Check for prompt injection patterns
            const injectionViolations = this.detectPromptInjection(input);
            if (injectionViolations.length > 0) {
                result.violations.push(...injectionViolations);
                result.riskLevel = 'high';
            }
            
            // Check for SSML injection if not in SSML context
            if (type !== 'ssml') {
                const ssmlViolations = this.detectSSMLInjection(input);
                if (ssmlViolations.length > 0) {
                    result.violations.push(...ssmlViolations);
                    result.riskLevel = 'medium';
                }
            }
            
            // Check for emoji-based injection
            const emojiViolations = this.detectEmojiInjection(input);
            if (emojiViolations.length > 0) {
                result.violations.push(...emojiViolations);
                result.riskLevel = 'medium';
            }
            
            // Check for code injection using comprehensive patterns
            const codeViolations = this.detectAllCodePatterns(input);
            if (codeViolations.length > 0) {
                result.violations.push(...codeViolations);
                result.riskLevel = 'high';
            }
            
            // Sanitize the input
            result.sanitizedInput = this.sanitizeInput(input, type);
            
            // Set overall validity based on risk level
            if (result.riskLevel === 'high') {
                result.isValid = false;
            }
            
            return result;
        }
        
        /**
         * Detect prompt injection attempts
         */
        detectPromptInjection(input) {
            const violations = [];
            
            for (const pattern of this.promptInjectionPatterns) {
                const matches = input.match(pattern);
                if (matches) {
                    violations.push(`Potential prompt injection detected: "${matches[0]}"`);
                }
            }
            
            return violations;
        }
        
        /**
         * Detect SSML injection attempts
         */
        detectSSMLInjection(input) {
            const violations = [];
            
            for (const pattern of this.ssmlInjectionPatterns) {
                const matches = input.match(pattern);
                if (matches) {
                    violations.push(`Potential SSML injection detected: "${matches[0]}"`);
                }
            }
            
            return violations;
        }
        
        /**
         * Detect emoji-based injection attempts
         */
        detectEmojiInjection(input) {
            const violations = [];
            
            for (const pattern of this.emojiInjectionPatterns) {
                const matches = input.match(pattern);
                if (matches) {
                    violations.push(`Potential emoji/Unicode injection detected: "${matches[0].substring(0, 20)}..."`);
                }
            }
            
            return violations;
        }
        
        /**
         * Sanitize input by removing/escaping dangerous content
         */
        sanitizeInput(input, type) {
            let sanitized = input;
            
            // Remove null bytes and control characters
            sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
            
            // Remove dangerous Unicode characters (emoji injection patterns)
            for (const pattern of this.emojiInjectionPatterns) {
                sanitized = sanitized.replace(pattern, '');
            }
            
            // If not in SSML context, escape HTML/XML tags
            if (type !== 'ssml') {
                sanitized = sanitized.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            }
            
            // Normalize whitespace
            sanitized = sanitized.replace(/\s+/g, ' ').trim();
            
            return sanitized;
        }
        
        /**
         * Validate attached file content for security risks
         */
        validateAttachedFileContent(content, fileName, fileType) {
            const result = {
                isValid: true,
                sanitizedContent: content,
                violations: [],
                riskLevel: 'low'
            };
            
            // Check content length
            if (content.length > this.maxLengths.attachedFile) {
                result.isValid = false;
                result.violations.push(`File content exceeds maximum length of ${this.maxLengths.attachedFile} characters`);
                result.riskLevel = 'high';
                return result;
            }
            
            // Check for code injection patterns using shared function
            const codeViolations = this.detectAllCodePatterns(content);
            if (codeViolations.length > 0) {
                result.violations.push(...codeViolations);
                result.riskLevel = 'high';
            }
            
            // Check for emoji injection
            const emojiViolations = this.detectEmojiInjection(content);
            if (emojiViolations.length > 0) {
                result.violations.push(...emojiViolations);
                result.riskLevel = 'medium';
            }
            
            // Additional file-specific checks
            const fileSpecificViolations = this.checkFileSpecificRisks(content, fileType);
            if (fileSpecificViolations.length > 0) {
                result.violations.push(...fileSpecificViolations);
                result.riskLevel = 'medium';
            }
            
            // Sanitize the file content for security
            result.sanitizedContent = this.sanitizeInput(content, 'attachedFile');
            
            return result;
        }
        
        /**
         * Comprehensive code pattern detection for both user input and file content
         */
        detectAllCodePatterns(content) {
            const violations = [];
            
            // Comprehensive code injection patterns
            const allCodePatterns = [
                // Python injection
                /import\s+os/gi,
                /os\.system\s*\(/gi,
                /subprocess\./gi,
                /eval\s*\(/gi,
                /exec\s*\(/gi,
                /__import__\s*\(/gi,
                /\.popen\s*\(/gi,
                
                // SQL injection
                /SELECT\s+.*FROM/gi,
                /INSERT\s+INTO/gi,
                /DELETE\s+FROM/gi,
                /DROP\s+TABLE/gi,
                /UNION\s+SELECT/gi,
                /UPDATE\s+.*SET/gi,
                
                // Shell/Bash injection
                /#!/gi,                           // Shebang
                /rm\s+-rf/gi,
                /del\s+.*\*/gi,
                /rmdir\s+.*\/s/gi,
                /;\s*rm\s+/gi,
                /&&\s*rm\s+/gi,
                /wget\s+http/gi,                  // Network requests
                /curl\s+http/gi,                  // Network requests  
                /wget\s+.*\|/gi,
                /curl\s+.*\|/gi,
                /bash\s+-c/gi,                    // Bash command execution
                /sh\s+-c/gi,                      // Shell command execution
                
                // JavaScript injection
                /javascript:/gi,
                /<script[^>]*>/gi,
                /document\.createElement/gi,
                /window\.location/gi,
                /document\.cookie/gi,
                /localStorage\./gi,
                /sessionStorage\./gi,
                
                // System calls
                /system\s*\(/gi,
                /popen\s*\(/gi,
                /fopen\s*\(/gi,
                /file_get_contents\s*\(/gi,
                /readfile\s*\(/gi,
                /curl_exec\s*\(/gi,
                /socket_create\s*\(/gi
            ];
            
            for (const pattern of allCodePatterns) {
                if (pattern.test(content)) {
                    violations.push('Code injection patterns detected');
                    break; // Only report once to avoid spam
                }
            }
            
            // Check for embedded scripts
            if (/<script[^>]*>/gi.test(content) || /javascript:/gi.test(content)) {
                violations.push('Potential script injection detected');
            }
            
            // Check for base64 encoded payloads
            const base64Pattern = /[a-zA-Z0-9+\/]{100,}={0,2}/g;
            const base64Matches = content.match(base64Pattern);
            if (base64Matches && base64Matches.length > 3) {
                violations.push('Multiple large base64 encoded blocks detected');
            }
            
            return violations;
        }
        
        /**
         * Check for file-type specific security risks
         */
        checkFileSpecificRisks(content, fileType) {
            const violations = [];
            
            // Check for embedded scripts in various file types
            if (['html', 'xml', 'docx'].includes(fileType)) {
                if (/<script[^>]*>/gi.test(content) || /javascript:/gi.test(content)) {
                    violations.push('Potential script injection in document');
                }
            }
            
            // Check for suspicious code patterns in code files
            if (['js', 'py', 'cpp', 'cs'].includes(fileType)) {
                const codePatterns = [
                    /eval\s*\(/gi,
                    /exec\s*\(/gi,
                    /system\s*\(/gi,
                    /\.popen\s*\(/gi,
                    /import\s+os/gi,
                    /subprocess/gi
                ];
                
                for (const pattern of codePatterns) {
                    if (pattern.test(content)) {
                        violations.push('Potentially dangerous code patterns detected');
                        break;
                    }
                }
            }
            
            // Check for base64 encoded payloads
            const base64Pattern = /[a-zA-Z0-9+\/]{100,}={0,2}/g;
            const base64Matches = content.match(base64Pattern);
            if (base64Matches && base64Matches.length > 3) {
                violations.push('Multiple large base64 encoded blocks detected');
            }
            
            return violations;
        }
        
        /**
         * Validate URLs for web extraction
         */
        validateURL(url) {
            const result = {
                isValid: true,
                violations: [],
                riskLevel: 'low'
            };
            
            try {
                const urlObj = new URL(url);
                
                // Check for blocked protocols
                if (!['http:', 'https:'].includes(urlObj.protocol)) {
                    result.isValid = false;
                    result.violations.push(`Blocked protocol: ${urlObj.protocol}`);
                    result.riskLevel = 'high';
                    return result;
                }
                
                // Check for blocked patterns
                for (const pattern of this.blockedPatterns) {
                    if (pattern.test(url)) {
                        result.isValid = false;
                        result.violations.push(`URL matches blocked pattern: ${pattern}`);
                        result.riskLevel = 'high';
                        return result;
                    }
                }
                
                // Check if domain is in allowlist (optional - can be configured)
                const domain = urlObj.hostname.toLowerCase();
                const isAllowedDomain = this.allowedDomains.some(allowed => 
                    domain === allowed || domain.endsWith('.' + allowed)
                );
                
                if (!isAllowedDomain) {
                    result.riskLevel = 'medium';
                    result.violations.push(`Domain not in allowlist: ${domain}`);
                    // Still allow but mark as medium risk for monitoring
                }
                
            } catch (error) {
                result.isValid = false;
                result.violations.push(`Invalid URL format: ${error.message}`);
                result.riskLevel = 'high';
            }
            
            return result;
        }
        
        /**
         * Validate MCP tool parameters
         */
        validateMCPParameters(toolName, parameters) {
            const result = {
                isValid: true,
                sanitizedParams: { ...parameters },
                violations: [],
                riskLevel: 'low'
            };
            
            // Validate each parameter
            for (const [key, value] of Object.entries(parameters)) {
                if (typeof value === 'string') {
                    const validation = this.validateUserInput(value, 'mcpToolParam');
                    if (!validation.isValid) {
                        result.isValid = false;
                        result.violations.push(`Parameter '${key}': ${validation.violations.join(', ')}`);
                        result.riskLevel = 'high';
                    } else {
                        result.sanitizedParams[key] = validation.sanitizedInput;
                        if (validation.riskLevel === 'medium') {
                            result.riskLevel = 'medium';
                        }
                    }
                }
                
                // Special validation for URLs
                if (key === 'url' || key === 'urls') {
                    const urls = Array.isArray(value) ? value : [value];
                    for (const url of urls) {
                        const urlValidation = this.validateURL(url);
                        if (!urlValidation.isValid) {
                            result.isValid = false;
                            result.violations.push(`URL validation failed: ${urlValidation.violations.join(', ')}`);
                            result.riskLevel = 'high';
                        }
                    }
                }
            }
            
            return result;
        }
        
        /**
         * Create a safe prompt template to prevent injection
         */
        createSafePromptTemplate(template, userInput) {
            const validation = this.validateUserInput(userInput);
            
            if (!validation.isValid) {
                throw new Error(`Input validation failed: ${validation.violations.join(', ')}`);
            }
            
            // Use parameterized approach to prevent injection
            const safeInput = validation.sanitizedInput;
            
            // Replace placeholder in template with sanitized input
            return template.replace('{{USER_INPUT}}', safeInput);
        }
        
        /**
         * Log security events for monitoring
         */
        logSecurityEvent(eventType, details) {
            const event = {
                timestamp: new Date().toISOString(),
                type: eventType,
                details: details,
                userAgent: navigator.userAgent,
                url: window.location.href
            };
            
            console.warn('🔒 Security Event:', event);
            
            // Store security events for audit (in production, send to server)
            const securityLog = JSON.parse(localStorage.getItem('securityLog') || '[]');
            securityLog.push(event);
            
            // Keep only last 100 events
            if (securityLog.length > 100) {
                securityLog.splice(0, securityLog.length - 100);
            }
            
            localStorage.setItem('securityLog', JSON.stringify(securityLog));
        }
        
        /**
         * Get security log for admin review
         */
        getSecurityLog() {
            return JSON.parse(localStorage.getItem('securityLog') || '[]');
        }
        
        /**
         * Clear security log
         */
        clearSecurityLog() {
            localStorage.removeItem('securityLog');
        }
    };
}

// Create global instance
window.securityValidator = new SecurityValidator();

console.log('🔒 SecurityValidator initialized');