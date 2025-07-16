if (typeof MCPClient === 'undefined') {
    window.MCPClient = class MCPClient {
        constructor(serverUrl = null) {
            this.serverUrl = serverUrl || localStorage.getItem('mcpServerUrl') || this.getDefaultServerUrl();
            this.isConnected = false;
            this.tools = [];
            this.serverProcess = null;
        }

        getDefaultServerUrl() {
            // Auto-detect the correct MCP server URL based on current domain
            const currentHost = window.location.hostname;
            const currentProtocol = window.location.protocol;
            
            // If running on localhost, use local MCP server
            if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
                return 'http://localhost:3001';
            }
            
            // If running on hosted domain, use Cloudflare tunnel URL
            if (currentHost.includes('veilstudio.io')) {
                return 'https://mcp-veil.veilstudio.io';
            }
            
            // Default fallback
            return 'http://localhost:3001';
        }

        async connect() {
            try {
                // For browser-based usage, we'll use a WebSocket or HTTP approach
                // since we can't directly spawn Node.js processes in the browser
                console.log('MCP Client: Attempting to connect to server...');
                
                // Check if we're in a browser environment
                if (typeof window !== 'undefined') {
                    // Browser environment - use HTTP API approach
                    await this.connectViaHTTP();
                } else {
                    // Node.js environment - use direct process spawning
                    await this.connectViaProcess();
                }
                
                this.isConnected = true;
                console.log('MCP Client: Successfully connected');
                return true;
            } catch (error) {
                console.error('MCP Client: Connection failed:', error);
                this.isConnected = false;
                return false;
            }
        }

        async connectViaHTTP() {
            // For browser usage, we'll assume the MCP server exposes an HTTP API
            // This is a simplified approach - in production you'd want proper MCP over HTTP
            const response = await fetch(`${this.serverUrl}/api/mcp/tools`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.tools = data.tools || [];
        }

        async connectViaProcess() {
            // Node.js environment - spawn the MCP server process
            const { spawn } = require('child_process');
            
            this.serverProcess = spawn('node', ['server/mcp-server.js'], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            // Set up communication with the server
            this.serverProcess.stdout.on('data', (data) => {
                console.log('MCP Server output:', data.toString());
            });

            this.serverProcess.stderr.on('data', (data) => {
                console.error('MCP Server error:', data.toString());
            });

            // Wait for server to be ready
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('MCP Server connection timeout'));
                }, 5000);

                this.serverProcess.stdout.once('data', () => {
                    clearTimeout(timeout);
                    resolve();
                });
            });
        }

        async callTool(toolName, args) {
            if (!this.isConnected) {
                throw new Error('MCP Client not connected');
            }

            try {
                if (typeof window !== 'undefined') {
                    // Browser environment - use HTTP API
                    return await this.callToolViaHTTP(toolName, args);
                } else {
                    // Node.js environment - use direct process communication
                    return await this.callToolViaProcess(toolName, args);
                }
            } catch (error) {
                console.error(`MCP Client: Error calling tool ${toolName}:`, error);
                throw error;
            }
        }

        async callToolViaHTTP(toolName, args) {
            console.log('🌐 MCP Client calling tool:', toolName, 'with args:', args);
            
            // Get LLM settings from localStorage
            const llmSettings = {
                apiBaseUrl: localStorage.getItem('customLlmApiUrl') || 'https://litellm-veil.veilstudio.io',
                apiKey: localStorage.getItem('customLlmApiKey') || 'sk-DSHSfgTh65Fvd',
                model: localStorage.getItem('customLlmModelIdentifier') || 'gemini2.5-flash'
            };
            
            const response = await fetch(`${this.serverUrl}/api/mcp/call`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    tool: toolName,
                    arguments: args,
                    llmSettings: llmSettings
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('🌐 MCP Server response:', result);
            return result;
        }

        async callToolViaProcess(toolName, args) {
            // Send request to the MCP server process
            const request = {
                jsonrpc: '2.0',
                id: Date.now(),
                method: 'tools/call',
                params: {
                    name: toolName,
                    arguments: args
                }
            };

            this.serverProcess.stdin.write(JSON.stringify(request) + '\n');

            // Wait for response
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Tool call timeout'));
                }, 10000);

                const responseHandler = (data) => {
                    try {
                        const response = JSON.parse(data.toString());
                        if (response.id === request.id) {
                            clearTimeout(timeout);
                            this.serverProcess.stdout.removeListener('data', responseHandler);
                            resolve(response.result);
                        }
                    } catch (error) {
                        // Not a JSON response, continue listening
                    }
                };

                this.serverProcess.stdout.on('data', responseHandler);
            });
        }

        async breakDownProblem(problem, context = '') {
            return await this.callTool('break_down_problem', { problem, context });
        }

        async sequentialReasoning(question, steps = 3) {
            return await this.callTool('sequential_reasoning', { question, steps });
        }

        async stepByStepAnalysis(topic, analysisType = 'general') {
            return await this.callTool('step_by_step_analysis', { topic, analysis_type: analysisType });
        }

        async logicalChain(premise, conclusion, steps = 4) {
            return await this.callTool('logical_chain', { premise, conclusion, steps });
        }

        // Web extraction helper methods
        async extractWebContent(url, options = {}) {
            return await this.callTool('extract_web_content', { url, options });
        }

        async extractForSummary(url, options = {}) {
            return await this.callTool('extract_for_summary', { url, options });
        }

        async extractMultipleUrls(urls, options = {}) {
            return await this.callTool('extract_multiple_urls', { urls, options });
        }

        // URL detection and extraction utilities
        extractUrlsFromText(text) {
            const urlRegex = /https?:\/\/[^\s\)]+/g;
            return text.match(urlRegex) || [];
        }

        extractUrlsFromMarkdown(markdownText) {
            // Extract URLs from markdown links [text](url)
            const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
            const urls = [];
            let match;
            
            while ((match = markdownLinkRegex.exec(markdownText)) !== null) {
                urls.push({
                    text: match[1],
                    url: match[2]
                });
            }
            
            // Also extract plain URLs
            const plainUrls = this.extractUrlsFromText(markdownText);
            plainUrls.forEach(url => {
                if (!urls.some(item => item.url === url)) {
                    urls.push({
                        text: url,
                        url: url
                    });
                }
            });
            
            return urls;
        }

        findUrlsInConversationHistory(llmService, searchTerms = []) {
            if (!llmService || !llmService.conversationHistory) {
                return [];
            }

            const urls = [];
            const recentMessages = llmService.conversationHistory.slice(-10); // Look at last 10 messages
            
            for (const message of recentMessages) {
                if (message.role === 'assistant') {
                    const extractedUrls = this.extractUrlsFromMarkdown(message.content);
                    extractedUrls.forEach(item => {
                        // Add context about which search produced this URL
                        urls.push({
                            ...item,
                            context: message.content.substring(0, 100) + '...',
                            messageIndex: llmService.conversationHistory.indexOf(message)
                        });
                    });
                }
            }
            
            return urls;
        }

        // Smart URL matching for user requests
        matchUrlToRequest(userMessage, availableUrls) {
            const lowerMessage = userMessage.toLowerCase();
            
            // Look for ordinal references (first, second, #1, #2, etc.)
            const ordinalMatches = [
                /(?:the\s+)?first|#1|1st/i,
                /(?:the\s+)?second|#2|2nd/i,
                /(?:the\s+)?third|#3|3rd/i,
                /(?:the\s+)?fourth|#4|4th/i,
                /(?:the\s+)?fifth|#5|5th/i
            ];
            
            for (let i = 0; i < ordinalMatches.length && i < availableUrls.length; i++) {
                if (ordinalMatches[i].test(lowerMessage)) {
                    return availableUrls[i];
                }
            }
            
            // Look for keywords that match the URL text or domain
            for (const urlItem of availableUrls) {
                const urlText = urlItem.text.toLowerCase();
                const domain = urlItem.url.toLowerCase();
                
                // Check if message contains words from the URL text
                const urlWords = urlText.split(/\s+/).filter(word => word.length > 3);
                for (const word of urlWords) {
                    if (lowerMessage.includes(word.toLowerCase())) {
                        return urlItem;
                    }
                }
                
                // Check for domain mentions (e.g., "the BBC article", "Wikipedia page")
                if (domain.includes('bbc') && lowerMessage.includes('bbc')) return urlItem;
                if (domain.includes('wikipedia') && lowerMessage.includes('wikipedia')) return urlItem;
                if (domain.includes('cnn') && lowerMessage.includes('cnn')) return urlItem;
                if (domain.includes('reddit') && lowerMessage.includes('reddit')) return urlItem;
                if (domain.includes('github') && lowerMessage.includes('github')) return urlItem;
                // Add more domain mappings as needed
            }
            
            return null;
        }

        getAvailableTools() {
            return this.tools.map(tool => ({
                name: tool.name,
                description: tool.description
            }));
        }

        disconnect() {
            this.isConnected = false;
            if (this.serverProcess) {
                this.serverProcess.kill();
                this.serverProcess = null;
            }
            console.log('MCP Client: Disconnected');
        }

        // Integration helper for the chat interface
        async integrateWithChat(message, context = '', llmService = null) {
            if (!this.isConnected) {
                console.log('❌ MCP Client not connected');
                return null;
            }

            console.log('🔍 MCP Client checking message for keywords:', message);
            const lowerMessage = message.toLowerCase();
            
            // Check for web extraction keywords first
            const webExtractionResult = await this.handleWebExtractionRequests(message, llmService);
            if (webExtractionResult) {
                return webExtractionResult;
            }
            
            // Check for sequential thinking keywords
            if (lowerMessage.includes('break down') || lowerMessage.includes('analyze step by step')) {
                console.log('✅ Detected "break down" keyword, calling breakDownProblem');
                return await this.breakDownProblem(message, context);
            }
            
            if (lowerMessage.includes('reason through') || lowerMessage.includes('think step by step')) {
                console.log('✅ Detected "reason through" keyword, calling sequentialReasoning');
                return await this.sequentialReasoning(message, context);
            }
            
            if (lowerMessage.includes('analyze') || lowerMessage.includes('examine')) {
                console.log('✅ Detected "analyze" keyword, calling stepByStepAnalysis');
                return await this.stepByStepAnalysis(message, context);
            }
            
            if (lowerMessage.includes('logical chain') || lowerMessage.includes('reasoning chain')) {
                console.log('✅ Detected "logical chain" keyword, calling logicalChain');
                // Extract premise and conclusion from the message
                const parts = message.split(/\s+(?:to|→|leads to|results in)\s+/i);
                if (parts.length >= 2) {
                    return await this.logicalChain(parts[0], parts[1], context);
                }
            }

            console.log('❌ No MCP keywords detected in message');
            return null;
        }

        // Handle web extraction requests intelligently
        async handleWebExtractionRequests(message, llmService) {
            const lowerMessage = message.toLowerCase();
            
            // Check for direct URL in message - PRIORITY: always use direct URL if found
            const directUrls = this.extractUrlsFromText(message);
            if (directUrls.length > 0) {
                console.log('✅ Found direct URL(s) in message:', directUrls);
                console.log('🔍 Using direct URL, skipping conversation history matching');
                
                // Determine extraction type based on keywords
                let result;
                if (lowerMessage.includes('extract') || lowerMessage.includes('get content') || lowerMessage.includes('full details')) {
                    console.log('✅ Detected extract content request for direct URL');
                    result = await this.extractWebContent(directUrls[0]);
                } else {
                    // Default to summary extraction for any direct URL request
                    console.log('✅ Using summary extraction for direct URL');
                    result = await this.extractForSummary(directUrls[0]);
                }
                
                // Mark for LLM processing so main.js knows to send through LLM
                if (result && result.content) {
                    result.needsLLMProcessing = true;
                    result.originalUrl = directUrls[0];
                }
                return result;
            }
            
            // Check for extraction keywords that might reference previous search results
            const extractionKeywords = [
                'tell me more about',
                'more details about',
                'more information about',
                'get more details',
                'extract content from',
                'summarize',
                'what does',
                'dive deeper',
                'more info',
                'full article',
                'read more'
            ];
            
            const hasExtractionKeyword = extractionKeywords.some(keyword => lowerMessage.includes(keyword));
            
            if (hasExtractionKeyword) {
                console.log('✅ Detected web extraction keywords');
                
                // Find URLs from recent conversation history
                const availableUrls = this.findUrlsInConversationHistory(llmService);
                console.log('📚 Found URLs in conversation history:', availableUrls.length);
                
                if (availableUrls.length > 0) {
                    // Try to match the user's request to a specific URL
                    const matchedUrl = this.matchUrlToRequest(message, availableUrls);
                    
                    if (matchedUrl) {
                        console.log('✅ Matched user request to URL:', matchedUrl.url);
                        
                        // Determine extraction type based on keywords
                        let result;
                        if (lowerMessage.includes('summarize') || lowerMessage.includes('summary') || lowerMessage.includes('tell me about')) {
                            result = await this.extractForSummary(matchedUrl.url);
                        } else {
                            result = await this.extractWebContent(matchedUrl.url);
                        }
                        
                        // Mark for LLM processing
                        if (result && result.content) {
                            result.needsLLMProcessing = true;
                            result.originalUrl = matchedUrl.url;
                        }
                        return result;
                    } else if (availableUrls.length === 1) {
                        // If there's only one URL in recent history, assume that's what they want
                        console.log('✅ Single URL in history, using that:', availableUrls[0].url);
                        const result = await this.extractForSummary(availableUrls[0].url);
                        
                        // Mark for LLM processing
                        if (result && result.content) {
                            result.needsLLMProcessing = true;
                            result.originalUrl = availableUrls[0].url;
                        }
                        return result;
                    } else {
                        // Multiple URLs but no clear match - could enhance this with LLM disambiguation
                        console.log('⚠️ Multiple URLs available but no clear match');
                        // For now, return null and let normal LLM handle it
                    }
                }
            }
            
            // Check for batch extraction requests
            if (lowerMessage.includes('compare') && (lowerMessage.includes('article') || lowerMessage.includes('url') || lowerMessage.includes('link'))) {
                const availableUrls = this.findUrlsInConversationHistory(llmService);
                if (availableUrls.length >= 2) {
                    console.log('✅ Detected compare request, using multiple URLs');
                    const urls = availableUrls.slice(0, 3).map(item => item.url); // Limit to 3 for performance
                    const result = await this.extractMultipleUrls(urls);
                    
                    // Mark for LLM processing
                    if (result && result.content) {
                        result.needsLLMProcessing = true;
                        result.originalUrl = urls.join(', ');
                    }
                    return result;
                }
            }
            
            return null; // No web extraction needed
        }
    }
} 