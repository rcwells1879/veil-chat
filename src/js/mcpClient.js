if (typeof MCPClient === 'undefined') {
    window.MCPClient = class MCPClient {
        constructor(serverUrl = null) {
            this.serverUrl = serverUrl || localStorage.getItem('mcpServerUrl') || this.getDefaultServerUrl();
            this.isConnected = false;
            this.tools = [];
            this.serverProcess = null;
        }

        getDefaultServerUrl() {
            // Default to empty string - users must configure their own MCP server
            console.log('MCP Client: No default server configured');
            return '';
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
            
            // 🔒 SECURITY: Validate MCP tool parameters
            if (window.securityValidator) {
                const validation = window.securityValidator.validateMCPParameters(toolName, args);
                if (!validation.isValid) {
                    console.warn('🔒 Security: MCP tool parameters blocked:', validation.violations);
                    window.securityValidator.logSecurityEvent('MCP_PARAMS_BLOCKED', {
                        toolName: toolName,
                        args: args,
                        violations: validation.violations,
                        riskLevel: validation.riskLevel
                    });
                    throw new Error(`Tool parameters validation failed: ${validation.violations.join(', ')}`);
                }
                // Use sanitized parameters
                args = validation.sanitizedParams;
                console.log('🔒 Security: MCP parameters validated and sanitized');
            }
            
            // Get LLM settings from localStorage - support both traditional and direct providers
            const provider = localStorage.getItem('customLlmProvider') || 'litellm';
            
            let llmSettings;
            if (provider === 'openai-direct') {
                llmSettings = {
                    provider: 'openai-direct',
                    apiBaseUrl: 'https://api.openai.com/v1/chat/completions',
                    apiKey: localStorage.getItem('openaiApiKey'),
                    model: localStorage.getItem('openaiModelIdentifier') || 'gpt-4.1-mini'
                };
            } else if (provider === 'anthropic-direct') {
                llmSettings = {
                    provider: 'anthropic-direct',
                    apiBaseUrl: 'https://api.anthropic.com/v1/messages',
                    apiKey: localStorage.getItem('anthropicApiKey'),
                    model: localStorage.getItem('anthropicModelIdentifier') || 'claude-sonnet-4'
                };
            } else if (provider === 'google-direct') {
                const googleModel = localStorage.getItem('googleModelIdentifier') || 'gemini-2.5-flash';
                llmSettings = {
                    provider: 'google-direct',
                    apiBaseUrl: `https://generativelanguage.googleapis.com/v1beta/models/${googleModel}:generateContent`,
                    apiKey: localStorage.getItem('googleApiKey'),
                    model: googleModel
                };
            } else {
                // Traditional providers (litellm, lmstudio, ollama)
                llmSettings = {
                    provider: provider,
                    apiBaseUrl: localStorage.getItem('customLlmApiUrl') || '',
                    apiKey: localStorage.getItem('customLlmApiKey') || '',
                    model: localStorage.getItem('customLlmModelIdentifier') || 'gemini2.5-flash'
                };
            }
            
            console.log('🌐 MCP Client using LLM settings:', { ...llmSettings, apiKey: llmSettings.apiKey ? 'PRESENT' : 'MISSING' });
            
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

        // Agent Workflow Methods
        async startAgentTask(goal, options = {}, context = '') {
            console.log('🤖 MCP Client: Starting agent task with goal:', goal);
            
            try {
                const requestBody = {
                    goal: goal,
                    options: {
                        ...options,
                        searchSettings: this.getSearchSettings(),
                        llmSettings: this.getLLMSettings()
                    }
                };
                
                // Include context if provided
                if (context && context.trim().length > 0) {
                    requestBody.context = context;
                    console.log('📄 Adding context to agent task:', context.length, 'characters');
                }
                
                const response = await fetch(`${this.serverUrl}/api/agent/start-task`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const result = await response.json();
                console.log('🤖 Agent task started:', result);
                return result;
            } catch (error) {
                console.error('❌ Failed to start agent task:', error);
                throw error;
            }
        }

        async executeAgentWorkflow(taskId, options = {}) {
            console.log('🚀 MCP Client: Executing agent workflow for task:', taskId);
            
            try {
                const response = await fetch(`${this.serverUrl}/api/agent/execute-workflow`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        taskId: taskId,
                        options: {
                            ...options,
                            searchSettings: this.getSearchSettings(),
                            llmSettings: this.getLLMSettings()
                        }
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const result = await response.json();
                console.log('🎯 Agent workflow completed:', result);
                return result;
            } catch (error) {
                console.error('❌ Agent workflow execution failed:', error);
                throw error;
            }
        }

        async getAgentTaskStatus(taskId) {
            try {
                const response = await fetch(`${this.serverUrl}/api/agent/task-status?taskId=${taskId}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const result = await response.json();
                return result.status;
            } catch (error) {
                console.error('❌ Failed to get agent task status:', error);
                throw error;
            }
        }

        async readAgentMemory(taskId, key = null) {
            try {
                let url = `${this.serverUrl}/api/agent/memory/read?taskId=${taskId}`;
                if (key) {
                    url += `&key=${encodeURIComponent(key)}`;
                }

                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const result = await response.json();
                return result.memory;
            } catch (error) {
                console.error('❌ Failed to read agent memory:', error);
                throw error;
            }
        }

        async endAgentTask(taskId) {
            try {
                const response = await fetch(`${this.serverUrl}/api/agent/end-task`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        taskId: taskId
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const result = await response.json();
                console.log('🏁 Agent task ended:', result);
                return result;
            } catch (error) {
                console.error('❌ Failed to end agent task:', error);
                throw error;
            }
        }

        // Helper methods for agent workflow
        getSearchSettings() {
            const settings = {
                provider: localStorage.getItem('searchProvider') || 'brave',
                apiKey: localStorage.getItem('searchApiKey') || '',
                limit: parseInt(localStorage.getItem('searchLimit')) || 10,
                timeFilter: localStorage.getItem('searchTimeFilter') || 'any',
                autoSummarize: localStorage.getItem('searchAutoSummarize') !== 'false' // Used for basic search, overridden for research
            };
            console.log('🔍 MCPClient: Search settings:', settings);
            return settings;
        }

        getLLMSettings() {
            // Get provider type from localStorage - support both traditional and direct providers
            const provider = localStorage.getItem('customLlmProvider') || 'litellm';
            
            let llmSettings;
            if (provider === 'openai-direct') {
                llmSettings = {
                    provider: 'openai-direct',
                    apiBaseUrl: 'https://api.openai.com/v1/chat/completions',
                    apiKey: localStorage.getItem('openaiApiKey'),
                    model: localStorage.getItem('openaiModelIdentifier') || 'gpt-4.1-mini'
                };
            } else if (provider === 'anthropic-direct') {
                llmSettings = {
                    provider: 'anthropic-direct',
                    apiBaseUrl: 'https://api.anthropic.com/v1/messages',
                    apiKey: localStorage.getItem('anthropicApiKey'),
                    model: localStorage.getItem('anthropicModelIdentifier') || 'claude-sonnet-4'
                };
            } else if (provider === 'google-direct') {
                const googleModel = localStorage.getItem('googleModelIdentifier') || 'gemini-2.5-flash';
                llmSettings = {
                    provider: 'google-direct',
                    apiBaseUrl: `https://generativelanguage.googleapis.com/v1beta/models/${googleModel}:generateContent`,
                    apiKey: localStorage.getItem('googleApiKey'),
                    model: googleModel
                };
            } else {
                // Traditional providers (litellm, lmstudio, ollama)
                llmSettings = {
                    provider: provider,
                    apiBaseUrl: localStorage.getItem('customLlmApiUrl') || '',
                    apiKey: localStorage.getItem('customLlmApiKey') || '',
                    model: localStorage.getItem('customLlmModelIdentifier') || 'gemini2.5-flash'
                };
            }
            
            return llmSettings;
        }

        // Execute a complete research workflow
        async executeResearchWorkflow(goal, options = {}, context = '') {
            console.log('🔬 Starting complete research workflow for goal:', goal);
            if (context && context.trim().length > 0) {
                console.log('📄 Including document context in workflow:', context.length, 'characters');
            }
            
            try {
                // Step 1: Start the agent task with context
                const taskResult = await this.startAgentTask(goal, options, context);
                const taskId = taskResult.taskId;
                
                console.log('📋 Task created with ID:', taskId);
                
                // Step 2: Execute the workflow
                const workflowResult = await this.executeAgentWorkflow(taskId, options);
                
                if (workflowResult.success) {
                    // Step 3: Get the final results
                    const finalResults = await this.readAgentMemory(taskId);
                    
                    // Step 4: Clean up the task
                    await this.endAgentTask(taskId);
                    
                    console.log('✅ Research workflow completed successfully');
                    
                    return {
                        success: true,
                        goal: goal,
                        synthesis: finalResults.final_synthesis,
                        searchQuery: finalResults.search_query,
                        urlsFound: finalResults.urls_to_visit?.length || 0,
                        extractedContent: Object.keys(finalResults.extracted_content || {}).length,
                        taskId: taskId
                    };
                } else {
                    console.error('❌ Workflow execution failed:', workflowResult.message);
                    await this.endAgentTask(taskId);
                    
                    return {
                        success: false,
                        error: workflowResult.message,
                        taskId: taskId
                    };
                }
                
            } catch (error) {
                console.error('❌ Research workflow failed:', error);
                return {
                    success: false,
                    error: error.message
                };
            }
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
            
            // Check for agent workflow keywords first (research, investigate, find out about)
            const agentResult = await this.handleAgentWorkflowRequests(message, context);
            if (agentResult) {
                return agentResult;
            }
            
            // Check for web extraction keywords
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

        // Handle agent workflow requests
        async handleAgentWorkflowRequests(message, context = '') {
            const lowerMessage = message.toLowerCase();
            
            // Agent workflow trigger keywords
            const agentKeywords = [
                'research',
                'investigate',
                'find out about',
                'look into',
                'gather information about',
                'what can you tell me about',
                'I want to know about',
                'learn about',
                'find information about',
                'search for information about'
            ];
            
            const hasAgentKeyword = agentKeywords.some(keyword => lowerMessage.includes(keyword));
            
            // Additional patterns that indicate comprehensive research needs
            const needsResearch = 
                lowerMessage.includes('latest') ||
                lowerMessage.includes('current') ||
                lowerMessage.includes('recent') ||
                lowerMessage.includes('comprehensive') ||
                lowerMessage.includes('detailed') ||
                (lowerMessage.includes('what') && (lowerMessage.includes('happening') || lowerMessage.includes('new'))) ||
                (lowerMessage.includes('tell me') && lowerMessage.length > 30); // Longer requests likely need research
            
            if (hasAgentKeyword || needsResearch) {
                console.log('🤖 Detected agent workflow request');
                
                try {
                    // Execute the research workflow - override autoSummarize to false for research
                    // Research should always extract full content, not just summarize search results
                    const result = await this.executeResearchWorkflow(message, { 
                        searchSettings: {
                            ...this.getSearchSettings(),
                            autoSummarize: false // Always extract full content for research
                        }
                    }, context);
                    
                    if (result.success) {
                        console.log('✅ Agent workflow completed successfully');
                        
                        // Return the synthesis in a format the chat interface expects
                        return {
                            content: [{
                                type: 'text',
                                text: result.synthesis
                            }],
                            isAgentResult: true,
                            metadata: {
                                searchQuery: result.searchQuery,
                                urlsFound: result.urlsFound,
                                extractedContent: result.extractedContent,
                                taskId: result.taskId
                            }
                        };
                    } else {
                        console.error('❌ Agent workflow failed:', result.error);
                        
                        // Return a fallback message
                        return {
                            content: [{
                                type: 'text',
                                text: `I tried to research that for you, but encountered an issue: ${result.error}. Let me try to help with what I know.`
                            }],
                            isAgentResult: false,
                            fallback: true
                        };
                    }
                    
                } catch (error) {
                    console.error('❌ Agent workflow exception:', error);
                    
                    // Return null so the normal LLM processing continues
                    return null;
                }
            }
            
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