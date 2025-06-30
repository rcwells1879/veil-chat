#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// Sequential Thinking MCP Server
class SequentialThinkingMCPServer {
    constructor() {
        this.server = new Server(
            {
                name: 'sequential-thinking-mcp-server',
                version: '1.0.0',
            },
            {
                capabilities: {
                    tools: {
                        listChanged: () => Promise.resolve(),
                    },
                },
            }
        );

        this.setupToolHandlers();
        this.setupErrorHandlers();
    }

    // LLM Integration method
    async callLLM(prompt, temperature = 0.7, maxTokens = 2000, llmSettings = null) {
        try {
            // Use provided settings or defaults
            const apiBaseUrl = llmSettings?.apiBaseUrl || 'https://litellm-veil.veilstudio.io';
            const apiKey = llmSettings?.apiKey || 'sk-DSHSfgTh65Fvd';
            const model = llmSettings?.model || 'gemini2.5-flash';
            
            const endpoint = `${apiBaseUrl}/v1/chat/completions`;
            
            const messages = [
                {
                    role: "system",
                    content: "You are a helpful assistant that provides detailed, practical analysis and insights. Be specific, actionable, and thorough in your responses."
                },
                {
                    role: "user",
                    content: prompt
                }
            ];

            const payload = {
                model: model,
                messages: messages,
                temperature: temperature,
                max_tokens: maxTokens,
                stream: false
            };

            const headers = {
                'Content-Type': 'application/json',
            };

            if (apiKey) {
                headers['Authorization'] = `Bearer ${apiKey}`;
            }

            console.log('🌐 MCP Server calling LLM:', endpoint);
            console.log('🌐 MCP Server payload:', JSON.stringify(payload, null, 2));

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('🌐 MCP Server LLM API error:', response.status, errorText);
                throw new Error(`LLM API request failed with status ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            console.log('🌐 MCP Server LLM response:', JSON.stringify(data, null, 2));
            
            // Handle different response structures
            let content = null;
            if (data.choices && data.choices[0] && data.choices[0].message) {
                content = data.choices[0].message.content;
            } else if (data.choices && data.choices[0] && data.choices[0].text) {
                content = data.choices[0].text;
            } else if (data.content) {
                content = data.content;
            } else if (data.response) {
                content = data.response;
            }
            
            // Check if content is null or empty
            if (!content) {
                console.error('🌐 MCP Server LLM returned null/empty content:', data);
                if (data.choices && data.choices[0] && data.choices[0].finish_reason === 'length') {
                    return "Response was truncated due to token limit. Please try with a shorter prompt or increase token limit.";
                }
                return "Unable to generate response - LLM returned empty content";
            }
            
            if (typeof content === 'string') {
                return content.trim();
            } else {
                console.error('🌐 MCP Server unexpected LLM response structure:', data);
                return "Unable to generate response - unexpected response format";
            }

        } catch (error) {
            console.error('🌐 MCP Server LLM call failed:', error);
            return "Unable to generate response due to an error: " + error.message;
        }
    }

    setupToolHandlers() {
        // Tool: Break down complex problems into sequential steps
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;

            switch (name) {
                case 'break_down_problem':
                    return this.handleBreakDownProblem(args);
                case 'sequential_reasoning':
                    return this.handleSequentialReasoning(args);
                case 'step_by_step_analysis':
                    return this.handleStepByStepAnalysis(args);
                case 'logical_chain':
                    return this.handleLogicalChain(args);
                case 'format_markdown':
                    return this.handleFormatMarkdown(args);
                default:
                    throw new Error(`Unknown tool: ${name}`);
            }
        });
    }

    async handleFormatMarkdown(args) {
        // Accepts either a string or a structured object
        // Returns a well-formatted Markdown string
        if (typeof args === 'string') {
            // If it's just a string, return as a Markdown paragraph
            return {
                content: [
                    { type: 'text', text: args }
                ]
            };
        }
        // If it's an object, format as Markdown
        let md = '';
        if (args.title) {
            md += `# ${args.title}\n\n`;
        }
        if (args.subtitle) {
            md += `## ${args.subtitle}\n\n`;
        }
        if (args.sections && Array.isArray(args.sections)) {
            for (const section of args.sections) {
                if (section.heading) {
                    md += `### ${section.heading}\n`;
                }
                if (section.text) {
                    md += `${section.text}\n`;
                }
                if (section.bullets && Array.isArray(section.bullets)) {
                    for (const bullet of section.bullets) {
                        md += `- ${bullet}\n`;
                    }
                }
                if (section.code) {
                    md += `\n\`\`\`${section.codeLang || ''}\n${section.code}\n\`\`\`\n`;
                }
                md += '\n';
            }
        }
        if (args.summary) {
            md += `**Summary:** ${args.summary}\n`;
        }
        return {
            content: [
                { type: 'text', text: md.trim() }
            ]
        };
    }

    async handleBreakDownProblem(args, llmSettings = null) {
        const { problem, context = '' } = args;
        
        if (!problem) {
            throw new Error('Problem description is required');
        }

        const stepNames = [
            'Problem Analysis',
            'Context Gathering', 
            'Solution Planning',
            'Implementation Steps',
            'Verification'
        ];

        // Generate content for each step using LLM
        const sections = await Promise.all(stepNames.map(async (stepName, index) => {
            const prompt = `Analyze this problem: "${problem}"

Focus on this specific step: ${stepName}

Please provide:
1. A clear explanation of what this step involves for this specific problem
2. Key considerations and factors to think about
3. Specific questions or areas to investigate
4. Practical insights relevant to this problem

Be specific, actionable, and thorough. Keep your response focused and concise (2-3 sentences).`;

            const llmResponse = await this.callLLM(prompt, 0.7, 2000, llmSettings);
            
            return {
                heading: `${index + 1}. ${stepName}`,
                text: llmResponse
            };
        }));

        const markdownArgs = {
            title: `Problem Breakdown: ${problem}`,
            sections: sections,
            summary: 'Choose the most critical step to focus on first.'
        };

        return this.handleFormatMarkdown(markdownArgs);
    }

    async handleSequentialReasoning(args, llmSettings = null) {
        const { question, steps = 3 } = args;
        
        if (!question) {
            throw new Error('Question is required');
        }

        // Generate reasoning steps using LLM
        const sections = await Promise.all(Array.from({ length: steps }, async (_, i) => {
            const stepNumber = i + 1;
            
            const prompt = `Apply step-by-step reasoning to answer this question: "${question}"

This is step ${stepNumber} of ${steps} in the reasoning process.

For this step, please:
1. Identify what logical reasoning should be applied at this stage
2. Consider what information or analysis is needed
3. Explain how this step builds on previous reasoning or sets up the next step
4. Provide specific insights relevant to the question

Be logical, clear, and focused. Keep your response concise (2-3 sentences).`;

            const llmResponse = await this.callLLM(prompt, 0.7, 2000, llmSettings);
            
            return {
                heading: `Step ${stepNumber}`,
                text: llmResponse
            };
        }));

        const markdownArgs = {
            title: `Sequential Reasoning: ${question}`,
            sections: sections,
            summary: 'Based on this step-by-step analysis, we can now formulate a comprehensive answer.'
        };

        return this.handleFormatMarkdown(markdownArgs);
    }

    async handleStepByStepAnalysis(args, llmSettings = null) {
        const { topic, analysis_type = 'general' } = args;
        
        if (!topic) {
            throw new Error('Topic is required');
        }

        const analysisSteps = {
            'general': [
                'Define the scope and boundaries',
                'Identify key components',
                'Analyze relationships between components',
                'Evaluate strengths and weaknesses',
                'Formulate conclusions and recommendations'
            ],
            'technical': [
                'Understand the technical requirements',
                'Identify potential solutions',
                'Evaluate trade-offs and constraints',
                'Design the implementation approach',
                'Plan testing and validation'
            ],
            'creative': [
                'Explore different perspectives',
                'Generate multiple ideas',
                'Evaluate creative potential',
                'Refine and develop concepts',
                'Plan execution strategy'
            ]
        };

        const steps = analysisSteps[analysis_type] || analysisSteps['general'];
        
        // Generate analysis using LLM
        const sections = await Promise.all(steps.map(async (step, index) => {
            const prompt = `Perform a ${analysis_type} analysis of: "${topic}"

Focus on this specific step: ${step}

Please provide:
1. A clear explanation of what this step involves for this specific topic
2. Key considerations and factors to analyze
3. Specific questions or areas to investigate
4. Practical insights and actionable points

Be specific, thorough, and relevant to the topic. Keep your response focused and concise (2-3 sentences).`;

            const llmResponse = await this.callLLM(prompt, 0.7, 2000, llmSettings);
            
            return {
                heading: `${index + 1}. ${step}`,
                text: llmResponse
            };
        }));

        const markdownArgs = {
            title: `${analysis_type.charAt(0).toUpperCase() + analysis_type.slice(1)} Analysis: ${topic}`,
            sections: sections,
            summary: 'This systematic approach ensures comprehensive understanding and actionable insights.'
        };

        return this.handleFormatMarkdown(markdownArgs);
    }

    async handleLogicalChain(args, llmSettings = null) {
        const { premise, conclusion, steps = 4 } = args;
        
        if (!premise || !conclusion) {
            throw new Error('Both premise and conclusion are required');
        }

        // Generate logical chain using LLM
        const sections = await Promise.all(Array.from({ length: steps }, async (_, i) => {
            const stepNumber = i + 1;
            
            const prompt = `Create a logical chain from premise to conclusion.

Premise: "${premise}"
Conclusion: "${conclusion}"

This is link ${stepNumber} of ${steps} in the logical chain.

For this link, please:
1. Identify the logical connection that should be made at this stage
2. Explain how this step bridges the gap between premise and conclusion
3. Provide specific reasoning that connects the previous step to the next
4. Ensure the logic flows naturally toward the conclusion

Be logical, clear, and focused. Keep your response concise (2-3 sentences).`;

            const llmResponse = await this.callLLM(prompt, 0.7, 2000, llmSettings);
            
            return {
                heading: `Link ${stepNumber}`,
                text: llmResponse
            };
        }));

        const markdownArgs = {
            title: `Logical Chain: ${premise} → ${conclusion}`,
            sections: sections,
            summary: 'This chain demonstrates how each step logically leads to the next, building a coherent argument.'
        };

        return this.handleFormatMarkdown(markdownArgs);
    }

    // Helper methods for generating content
    generateConsideration(problem, step) {
        const considerations = {
            'Problem Analysis': `What are the root causes and underlying factors of "${problem}"?`,
            'Context Gathering': `What information about "${problem}" is needed to understand the full scope?`,
            'Solution Planning': `What are the most effective approaches to solve "${problem}"?`,
            'Implementation Steps': `What specific actions need to be taken to address "${problem}"?`,
            'Verification': `How will we know the solution for "${problem}" is working?`
        };
        
        // Extract the step name from the markdown format
        const stepMatch = step.match(/\*\*(.*?)\*\*/);
        const stepName = stepMatch ? stepMatch[1] : step.split(':')[0]?.trim();
        
        return considerations[stepName] || `Consider the implications and requirements for "${problem}"`;
    }

    generateReasoningStep(question, stepNumber) {
        const stepTypes = [
            'Identify the key concepts and variables involved',
            'Analyze the relationships and dependencies',
            'Evaluate potential approaches and their implications',
            'Synthesize information to form a coherent understanding'
        ];
        return stepTypes[stepNumber - 1] || 'Apply logical reasoning to advance understanding';
    }

    generateAnalysisDetail(topic, step) {
        const details = {
            'Define the scope and boundaries': `Clarify what aspects of "${topic}" are most relevant and important`,
            'Identify key components': `Break down "${topic}" into its fundamental parts and elements`,
            'Analyze relationships between components': `Understand how different aspects of "${topic}" interact and influence each other`,
            'Evaluate strengths and weaknesses': `Assess the positive and negative aspects of "${topic}"`,
            'Formulate conclusions and recommendations': `Based on the analysis, provide actionable insights about "${topic}"`
        };
        return details[step] || `Apply systematic thinking to understand "${topic}" in relation to ${step.toLowerCase()}`;
    }

    generateLogicalLink(premise, conclusion, stepNumber, totalSteps) {
        const progress = stepNumber / totalSteps;
        const intermediateSteps = [
            'Establish foundational understanding',
            'Identify connecting principles',
            'Apply logical reasoning',
            'Reach intermediate conclusions'
        ];
        return intermediateSteps[stepNumber - 1] || `Bridge the gap between premise and conclusion through logical progression`;
    }

    setupErrorHandlers() {
        this.server.onerror = (error) => {
            console.error('MCP Server Error:', error);
        };
    }

    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('Sequential Thinking MCP Server started');
    }
}

// Tool definitions for the MCP server
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
        name: 'format_markdown',
        description: 'Format structured data or text as high-quality Markdown for visually appealing output',
        inputSchema: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Main title for the document' },
                subtitle: { type: 'string', description: 'Optional subtitle' },
                sections: {
                    type: 'array',
                    description: 'Sections of the document',
                    items: {
                        type: 'object',
                        properties: {
                            heading: { type: 'string', description: 'Section heading' },
                            text: { type: 'string', description: 'Section text' },
                            bullets: {
                                type: 'array',
                                description: 'Bullet points',
                                items: { type: 'string' }
                            },
                            code: { type: 'string', description: 'Code block' },
                            codeLang: { type: 'string', description: 'Code language for syntax highlighting' }
                        }
                    }
                },
                summary: { type: 'string', description: 'Summary or conclusion' }
            }
        }
    }
];

export { SequentialThinkingMCPServer, tools };

// Run the server if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const server = new SequentialThinkingMCPServer();
    server.run().catch(console.error);
} 