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
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static('.')); // Serve static files from current directory
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
                    default:
                        return res.status(400).json({ error: `Unknown tool: ${tool}` });
                }

                res.json(result);
            } catch (error) {
                console.error('Tool call error:', error);
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