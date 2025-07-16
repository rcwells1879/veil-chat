#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import { SequentialThinkingMCPServer } from './mcp-server.js';

class MCPHTTPServer {
    constructor(port = 3001) {
        this.port = port;
        this.app = express();
        this.mcpServer = new SequentialThinkingMCPServer();
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // CORS and JSON parsing
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static('..')); // Serve static files from parent directory
        
        // Security is handled by Cloudflare Access policies
        // No additional authentication middleware needed
    }

    setupRoutes() {
        // Health check endpoint
        this.app.get('/api/mcp/health', (req, res) => {
            res.json({ status: 'ok', message: 'MCP HTTP Server is running' });
        });

        // Get available tools
        this.app.get('/api/mcp/tools', (req, res) => {
            const tools = [
                {
                    name: 'break_down_problem',
                    description: 'Break down complex problems into sequential, manageable steps',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            problem: {
                                type: 'string',
                                description: 'The complex problem to break down'
                            },
                            context: {
                                type: 'string',
                                description: 'Additional context or background information'
                            }
                        },
                        required: ['problem']
                    }
                },
                {
                    name: 'sequential_reasoning',
                    description: 'Apply step-by-step logical reasoning to answer questions',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            question: {
                                type: 'string',
                                description: 'The question to reason through'
                            },
                            steps: {
                                type: 'number',
                                description: 'Number of reasoning steps (default: 3)',
                                default: 3
                            }
                        },
                        required: ['question']
                    }
                },
                {
                    name: 'step_by_step_analysis',
                    description: 'Perform systematic analysis of a topic or problem',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            topic: {
                                type: 'string',
                                description: 'The topic or problem to analyze'
                            },
                            analysis_type: {
                                type: 'string',
                                description: 'Type of analysis: general, technical, or creative',
                                enum: ['general', 'technical', 'creative'],
                                default: 'general'
                            }
                        },
                        required: ['topic']
                    }
                },
                {
                    name: 'logical_chain',
                    description: 'Create a logical chain of reasoning from premise to conclusion',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            premise: {
                                type: 'string',
                                description: 'The starting point or assumption'
                            },
                            conclusion: {
                                type: 'string',
                                description: 'The desired conclusion or outcome'
                            },
                            steps: {
                                type: 'number',
                                description: 'Number of logical links (default: 4)',
                                default: 4
                            }
                        },
                        required: ['premise', 'conclusion']
                    }
                },
                {
                    name: 'web_search',
                    description: 'Search the web using various search providers (Brave, DuckDuckGo, Google, Bing)',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: {
                                type: 'string',
                                description: 'The search query to execute'
                            },
                            searchSettings: {
                                type: 'object',
                                description: 'Search provider settings',
                                properties: {
                                    provider: {
                                        type: 'string',
                                        description: 'Search provider (brave, duckduckgo, google, bing)',
                                        enum: ['brave', 'duckduckgo', 'google', 'bing'],
                                        default: 'brave'
                                    },
                                    apiKey: {
                                        type: 'string',
                                        description: 'API key for the search provider'
                                    },
                                    limit: {
                                        type: 'number',
                                        description: 'Number of results to return (default: 10)',
                                        default: 10
                                    },
                                    timeFilter: {
                                        type: 'string',
                                        description: 'Time filter for results',
                                        enum: ['any', 'day', 'week', 'month'],
                                        default: 'any'
                                    },
                                    autoSummarize: {
                                        type: 'boolean',
                                        description: 'Whether to auto-summarize results',
                                        default: true
                                    }
                                }
                            }
                        },
                        required: ['query']
                    }
                },
                {
                    name: 'search_recent',
                    description: 'Search for recent information (last 24 hours)',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: {
                                type: 'string',
                                description: 'The search query to execute'
                            },
                            searchSettings: {
                                type: 'object',
                                description: 'Search provider settings',
                                properties: {
                                    provider: {
                                        type: 'string',
                                        description: 'Search provider (brave, duckduckgo, google, bing)',
                                        enum: ['brave', 'duckduckgo', 'google', 'bing'],
                                        default: 'brave'
                                    },
                                    apiKey: {
                                        type: 'string',
                                        description: 'API key for the search provider'
                                    },
                                    limit: {
                                        type: 'number',
                                        description: 'Number of results to return (default: 10)',
                                        default: 10
                                    }
                                }
                            }
                        },
                        required: ['query']
                    }
                },
                {
                    name: 'search_summarize',
                    description: 'Search the web and automatically summarize results for LLM context',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: {
                                type: 'string',
                                description: 'The search query to execute'
                            },
                            searchSettings: {
                                type: 'object',
                                description: 'Search provider settings',
                                properties: {
                                    provider: {
                                        type: 'string',
                                        description: 'Search provider (brave, duckduckgo, google, bing)',
                                        enum: ['brave', 'duckduckgo', 'google', 'bing'],
                                        default: 'brave'
                                    },
                                    apiKey: {
                                        type: 'string',
                                        description: 'API key for the search provider'
                                    },
                                    limit: {
                                        type: 'number',
                                        description: 'Number of results to return (default: 10)',
                                        default: 10
                                    },
                                    timeFilter: {
                                        type: 'string',
                                        description: 'Time filter for results',
                                        enum: ['any', 'day', 'week', 'month'],
                                        default: 'any'
                                    }
                                }
                            }
                        },
                        required: ['query']
                    }
                },
                {
                    name: 'extract_web_content',
                    description: 'Extract full content from a web page using intelligent method detection (Cheerio for static, Puppeteer for dynamic)',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            url: {
                                type: 'string',
                                description: 'The URL to extract content from'
                            },
                            options: {
                                type: 'object',
                                description: 'Extraction options',
                                properties: {
                                    maxLength: {
                                        type: 'number',
                                        description: 'Maximum content length'
                                    },
                                    includeImages: {
                                        type: 'boolean',
                                        description: 'Whether to include images'
                                    }
                                }
                            }
                        },
                        required: ['url']
                    }
                },
                {
                    name: 'extract_for_summary',
                    description: 'Extract web content optimized for LLM summarization (shorter, focused content)',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            url: {
                                type: 'string',
                                description: 'The URL to extract content from'
                            },
                            options: {
                                type: 'object',
                                description: 'Extraction options',
                                properties: {
                                    maxLength: {
                                        type: 'number',
                                        description: 'Maximum content length (default: 4000)',
                                        default: 4000
                                    }
                                }
                            }
                        },
                        required: ['url']
                    }
                },
                {
                    name: 'extract_multiple_urls',
                    description: 'Extract content from multiple URLs in batch (useful for comparing articles or gathering information from multiple sources)',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            urls: {
                                type: 'array',
                                items: {
                                    type: 'string'
                                },
                                description: 'Array of URLs to extract content from'
                            },
                            options: {
                                type: 'object',
                                description: 'Extraction options',
                                properties: {
                                    maxConcurrent: {
                                        type: 'number',
                                        description: 'Maximum concurrent extractions (default: 3)',
                                        default: 3
                                    },
                                    maxLength: {
                                        type: 'number',
                                        description: 'Maximum content length per URL'
                                    }
                                }
                            }
                        },
                        required: ['urls']
                    }
                }
            ];
            res.json({ tools });
        });

        // Call a tool
        this.app.post('/api/mcp/call', async (req, res) => {
            try {
                const { tool, arguments: args, llmSettings } = req.body;
                
                if (!tool) {
                    return res.status(400).json({ error: 'Tool name is required' });
                }

                let result;
                switch (tool) {
                    case 'break_down_problem':
                        result = await this.mcpServer.handleBreakDownProblem(args, llmSettings);
                        break;
                    case 'sequential_reasoning':
                        result = await this.mcpServer.handleSequentialReasoning(args, llmSettings);
                        break;
                    case 'step_by_step_analysis':
                        result = await this.mcpServer.handleStepByStepAnalysis(args, llmSettings);
                        break;
                    case 'logical_chain':
                        result = await this.mcpServer.handleLogicalChain(args, llmSettings);
                        break;
                    case 'web_search':
                        result = await this.mcpServer.handleWebSearch(args, llmSettings);
                        break;
                    case 'search_recent':
                        result = await this.mcpServer.handleSearchRecent(args, llmSettings);
                        break;
                    case 'search_summarize':
                        result = await this.mcpServer.handleSearchSummarize(args, llmSettings);
                        break;
                    case 'extract_web_content':
                        result = await this.mcpServer.handleExtractWebContent(args, llmSettings);
                        break;
                    case 'extract_for_summary':
                        result = await this.mcpServer.handleExtractForSummary(args, llmSettings);
                        break;
                    case 'extract_multiple_urls':
                        result = await this.mcpServer.handleExtractMultipleUrls(args, llmSettings);
                        break;
                    default:
                        return res.status(400).json({ error: `Unknown tool: ${tool}` });
                }

                res.json(result);
            } catch (error) {
                console.error('Tool call error:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Agent Memory Management Endpoints
        
        // Start new agent task
        this.app.post('/api/agent/start-task', async (req, res) => {
            try {
                const { goal, options } = req.body;
                
                if (!goal) {
                    return res.status(400).json({ error: 'Goal is required' });
                }

                const taskId = this.mcpServer.startAgentTask(goal, options || {});
                res.json({ taskId, message: 'Agent task started successfully' });
            } catch (error) {
                console.error('Start task error:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Write to agent task memory
        this.app.post('/api/agent/memory/write', async (req, res) => {
            try {
                const { taskId, key, value } = req.body;
                
                if (!taskId || !key) {
                    return res.status(400).json({ error: 'taskId and key are required' });
                }

                const result = this.mcpServer.writeToMemory(taskId, key, value);
                res.json({ success: result, message: 'Memory updated successfully' });
            } catch (error) {
                console.error('Write memory error:', error);
                if (error.message.includes('not found')) {
                    return res.status(404).json({ error: error.message });
                }
                res.status(500).json({ error: error.message });
            }
        });

        // Read from agent task memory
        this.app.get('/api/agent/memory/read', async (req, res) => {
            try {
                const { taskId, key } = req.query;
                
                if (!taskId) {
                    return res.status(400).json({ error: 'taskId is required' });
                }

                const memory = this.mcpServer.readFromMemory(taskId, key);
                res.json({ memory });
            } catch (error) {
                console.error('Read memory error:', error);
                if (error.message.includes('not found')) {
                    return res.status(404).json({ error: error.message });
                }
                res.status(500).json({ error: error.message });
            }
        });

        // End agent task
        this.app.delete('/api/agent/end-task', async (req, res) => {
            try {
                const { taskId } = req.body;
                
                if (!taskId) {
                    return res.status(400).json({ error: 'taskId is required' });
                }

                const result = this.mcpServer.endAgentTask(taskId);
                res.json({ success: result, message: 'Agent task ended successfully' });
            } catch (error) {
                console.error('End task error:', error);
                if (error.message.includes('not found')) {
                    return res.status(404).json({ error: error.message });
                }
                res.status(500).json({ error: error.message });
            }
        });

        // Get agent task status
        this.app.get('/api/agent/task-status', async (req, res) => {
            try {
                const { taskId } = req.query;
                
                if (!taskId) {
                    return res.status(400).json({ error: 'taskId is required' });
                }

                const status = this.mcpServer.getTaskStatus(taskId);
                if (!status) {
                    return res.status(404).json({ error: 'Task not found' });
                }
                
                res.json({ status });
            } catch (error) {
                console.error('Get task status error:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Execute agent workflow
        this.app.post('/api/agent/execute-workflow', async (req, res) => {
            try {
                const { taskId, options } = req.body;
                
                if (!taskId) {
                    return res.status(400).json({ error: 'taskId is required' });
                }

                const result = await this.mcpServer.executeAgentWorkflow(taskId, options || {});
                res.json(result);
            } catch (error) {
                console.error('Execute workflow error:', error);
                if (error.message.includes('not found')) {
                    return res.status(404).json({ error: error.message });
                }
                res.status(500).json({ error: error.message });
            }
        });

        // Serve the main chat interface
        this.app.get('/', (req, res) => {
            res.sendFile('index.html', { root: '.' });
        });

        // Error handling middleware
        this.app.use((error, req, res, next) => {
            console.error('Server error:', error);
            res.status(500).json({ error: 'Internal server error' });
        });
    }

    async start() {
        try {
            await new Promise((resolve, reject) => {
                this.server = this.app.listen(this.port, () => {
                    console.log(`MCP HTTP Server running on http://localhost:${this.port}`);
                    console.log(`Chat interface available at http://localhost:${this.port}`);
                    console.log(`API endpoints:`);
                    console.log(`  GET  /api/mcp/health - Health check`);
                    console.log(`  GET  /api/mcp/tools - List available tools`);
                    console.log(`  POST /api/mcp/call - Call a tool`);
                    resolve();
                });

                this.server.on('error', reject);
            });
        } catch (error) {
            console.error('Failed to start MCP HTTP Server:', error);
            throw error;
        }
    }

    stop() {
        if (this.server) {
            console.log('Shutting down server...');
            this.server.close(() => {
                console.log('MCP HTTP Server stopped');
                process.exit(0);
            });
            
            // Force close after 5 seconds if graceful shutdown fails
            setTimeout(() => {
                console.log('Forcing server shutdown...');
                process.exit(1);
            }, 5000);
        }
    }
}

// Run the server if this file is executed directly
if (import.meta.url.includes('mcp-http-server.js')) {
    // Set Chrome path environment variable for Windows (if not already set)
    if (!process.env.CHROME_PATH) {
        process.env.CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
        console.log('🤖 Setting CHROME_PATH:', process.env.CHROME_PATH);
    }
    
    const server = new MCPHTTPServer();
    server.start().catch(console.error);

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\nReceived SIGINT (Ctrl+C), shutting down gracefully...');
        server.stop();
    });

    // Handle other termination signals
    process.on('SIGTERM', () => {
        console.log('\nReceived SIGTERM, shutting down gracefully...');
        server.stop();
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
        console.error('Uncaught Exception:', error);
        server.stop();
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        server.stop();
    });
}

export { MCPHTTPServer }; 