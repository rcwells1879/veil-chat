if (typeof MCPClient === 'undefined') {
    window.MCPClient = class MCPClient {
        constructor(serverUrl = null) {
            this.serverUrl = serverUrl || localStorage.getItem('mcpServerUrl') || 'http://localhost:3001';
            this.isConnected = false;
            this.tools = [];
            this.serverProcess = null;
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
        async integrateWithChat(message, context = '') {
            if (!this.isConnected) {
                console.log('❌ MCP Client not connected');
                return null;
            }

            console.log('🔍 MCP Client checking message for keywords:', message);
            // Check if the message contains keywords that suggest sequential thinking
            const lowerMessage = message.toLowerCase();
            
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
    }
} 