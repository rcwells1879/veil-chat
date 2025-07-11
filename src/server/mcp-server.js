#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// Search Provider Classes
class BraveSearchProvider {
    constructor(apiKey, options = {}) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.search.brave.com/res/v1/web/search';
        this.options = options;
    }

    async search(query, options = {}) {
        const params = new URLSearchParams({
            q: query,
            count: options.limit || 10,
            freshness: options.timeFilter || 'any',
            country: 'US',
            lang: 'en'
        });

        const response = await fetch(`${this.baseUrl}?${params}`, {
            headers: {
                'X-Subscription-Token': this.apiKey,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Brave Search API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return this.formatResults(data);
    }

    formatResults(data) {
        if (!data.web || !data.web.results) return [];
        
        return data.web.results.map(result => ({
            title: result.title,
            url: result.url,
            description: result.description,
            snippet: result.description,
            published: result.age || null
        }));
    }
}

class DuckDuckGoSearchProvider {
    constructor(apiKey, options = {}) {
        this.apiKey = apiKey; // DuckDuckGo doesn't require API key for basic search
        this.baseUrl = 'https://api.duckduckgo.com/';
        this.options = options;
    }

    async search(query, options = {}) {
        // DuckDuckGo instant answer API - free but limited
        const params = new URLSearchParams({
            q: query,
            format: 'json',
            no_html: '1',
            skip_disambig: '1'
        });

        const response = await fetch(`${this.baseUrl}?${params}`);
        
        if (!response.ok) {
            throw new Error(`DuckDuckGo API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return this.formatResults(data, options.limit || 10);
    }

    formatResults(data, limit) {
        const results = [];
        
        // Add abstract if available
        if (data.Abstract && data.AbstractText) {
            results.push({
                title: data.Heading || 'Direct Answer',
                url: data.AbstractURL || '',
                description: data.AbstractText,
                snippet: data.AbstractText,
                published: null
            });
        }

        // Add related topics
        if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
            data.RelatedTopics.slice(0, limit - results.length).forEach(topic => {
                if (topic.Text && topic.FirstURL) {
                    results.push({
                        title: topic.Text.split(' - ')[0] || 'Related Topic',
                        url: topic.FirstURL,
                        description: topic.Text,
                        snippet: topic.Text,
                        published: null
                    });
                }
            });
        }

        return results.slice(0, limit);
    }
}

class GoogleSearchProvider {
    constructor(apiKey, options = {}) {
        this.apiKey = apiKey;
        this.cx = options.cx || options.searchEngineId; // Custom Search Engine ID
        this.baseUrl = 'https://www.googleapis.com/customsearch/v1';
        this.options = options;
    }

    async search(query, options = {}) {
        if (!this.cx) {
            throw new Error('Google Custom Search requires a Custom Search Engine ID (cx)');
        }

        const params = new URLSearchParams({
            key: this.apiKey,
            cx: this.cx,
            q: query,
            num: Math.min(options.limit || 10, 10), // Google API max is 10
            dateRestrict: this.getDateRestrict(options.timeFilter)
        });

        const response = await fetch(`${this.baseUrl}?${params}`);
        
        if (!response.ok) {
            throw new Error(`Google Search API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return this.formatResults(data);
    }

    getDateRestrict(timeFilter) {
        switch (timeFilter) {
            case 'day': return 'd1';
            case 'week': return 'w1';
            case 'month': return 'm1';
            default: return '';
        }
    }

    formatResults(data) {
        if (!data.items) return [];
        
        return data.items.map(item => ({
            title: item.title,
            url: item.link,
            description: item.snippet,
            snippet: item.snippet,
            published: item.pagemap?.metatags?.[0]?.['article:published_time'] || null
        }));
    }
}

class BingSearchProvider {
    constructor(apiKey, options = {}) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.bing.microsoft.com/v7.0/search';
        this.options = options;
    }

    async search(query, options = {}) {
        const params = new URLSearchParams({
            q: query,
            count: options.limit || 10,
            freshness: this.getFreshness(options.timeFilter),
            mkt: 'en-US'
        });

        const response = await fetch(`${this.baseUrl}?${params}`, {
            headers: {
                'Ocp-Apim-Subscription-Key': this.apiKey,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Bing Search API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return this.formatResults(data);
    }

    getFreshness(timeFilter) {
        switch (timeFilter) {
            case 'day': return 'Day';
            case 'week': return 'Week';
            case 'month': return 'Month';
            default: return '';
        }
    }

    formatResults(data) {
        if (!data.webPages || !data.webPages.value) return [];
        
        return data.webPages.value.map(result => ({
            title: result.name,
            url: result.url,
            description: result.snippet,
            snippet: result.snippet,
            published: result.dateLastCrawled || null
        }));
    }
}

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
            // Log all incoming settings and prompt
            console.log('callLLM called with:', {
                prompt,
                temperature,
                maxTokens,
                llmSettings
            });

            // Use provided settings or defaults
            const apiBaseUrl = llmSettings?.apiBaseUrl || 'https://litellm-veil.veilstudio.io';
            const apiKey = llmSettings?.apiKey || 'sk-DSHSfgTh65Fvd';
            const model = llmSettings?.model || 'gemini2.5-flash';
            
            const endpoint = `${apiBaseUrl}/v1/chat/completions`;
            
            // Log the endpoint, model, and key (mask the key for safety)
            console.log('🌐 MCP Server calling LLM:', endpoint, 'Model:', model, 'Key:', apiKey ? apiKey.slice(0, 6) + '...' : '(none)');

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
            throw error;
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
                case 'web_search':
                    return this.handleWebSearch(args);
                case 'search_recent':
                    return this.handleSearchRecent(args);
                case 'search_summarize':
                    return this.handleSearchSummarize(args);
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

    async handleWebSearch(args) {
        const { query, searchSettings = {}, llmSettings = null } = args;
        
        if (!query) {
            throw new Error('Search query is required');
        }

        try {
            // Get search provider and settings
            const provider = searchSettings.provider || 'brave';
            const apiKey = searchSettings.apiKey;
            const limit = parseInt(searchSettings.limit) || 10;
            const timeFilter = searchSettings.timeFilter || 'any';
            const autoSummarize = searchSettings.autoSummarize !== false;

            console.log('🔍 Web search:', { query, provider, limit, timeFilter, autoSummarize });

            // Create search provider instance
            let searchProvider;
            switch (provider) {
                case 'brave':
                    if (!apiKey) throw new Error('Brave Search requires an API key');
                    searchProvider = new BraveSearchProvider(apiKey, searchSettings);
                    break;
                case 'duckduckgo':
                    searchProvider = new DuckDuckGoSearchProvider(apiKey, searchSettings);
                    break;
                case 'google':
                    if (!apiKey) throw new Error('Google Search requires an API key');
                    searchProvider = new GoogleSearchProvider(apiKey, searchSettings);
                    break;
                case 'bing':
                    if (!apiKey) throw new Error('Bing Search requires an API key');
                    searchProvider = new BingSearchProvider(apiKey, searchSettings);
                    break;
                default:
                    throw new Error(`Unknown search provider: ${provider}`);
            }

            // Perform search
            const results = await searchProvider.search(query, { limit, timeFilter });
            
            if (!results || results.length === 0) {
                return {
                    content: [
                        { type: 'text', text: `No search results found for query: "${query}"` }
                    ]
                };
            }

            // If auto-summarize is enabled, call the search summarize function
            if (autoSummarize) {
                console.log('🤖 Auto-summarize enabled, calling search summarize function...');
                return this.handleSearchSummarize({ query, searchSettings, llmSettings }, results);
            }

            // Format results normally without summarization
            const sections = results.map((result, index) => ({
                heading: `${index + 1}. ${result.title}`,
                text: `**URL:** ${result.url}\n\n${result.description || result.snippet}`,
                published: result.published
            }));

            const markdownArgs = {
                title: `Search Results: ${query}`,
                subtitle: `Found ${results.length} results using ${provider}`,
                sections: sections,
                summary: `Found ${results.length} results for "${query}"`
            };

            return this.handleFormatMarkdown(markdownArgs);

        } catch (error) {
            console.error('🔍 Search error:', error);
            return {
                content: [
                    { type: 'text', text: `Search failed: ${error.message}` }
                ]
            };
        }
    }

    async handleSearchRecent(args) {
        const { query, searchSettings = {}, llmSettings = null } = args;
        
        // Force recent time filter
        const recentSettings = {
            ...searchSettings,
            timeFilter: 'day' // Default to last 24 hours
        };

        return this.handleWebSearch({
            query,
            searchSettings: recentSettings,
            llmSettings
        });
    }

    async handleSearchSummarize(args, providedResults = null) {
        const { query, searchSettings = {}, llmSettings = null } = args;
        
        try {
            let searchText;
            
            // If results are provided, use them directly
            if (providedResults) {
                // Format provided results for summarization
                searchText = providedResults.map((result, index) => 
                    `${index + 1}. ${result.title}\nURL: ${result.url}\n${result.description || result.snippet}\n`
                ).join('\n');
            } else {
                // Otherwise, perform the search first
                const searchResult = await this.handleWebSearch({
                    query,
                    searchSettings: { ...searchSettings, autoSummarize: false },
                    llmSettings
                });

                // Extract search results text
                searchText = searchResult.content[0].text;
            }
            
            // Generate summary using LLM
            const summaryPrompt = `Analyze and summarize these search results for the query: "${query}"

${searchText}

Please provide:
1. A concise summary of the key findings
2. Main themes and trends identified
3. Most relevant and credible sources
4. Any conflicting information or different perspectives
5. Actionable insights based on the results

Focus on accuracy, relevance, and practical value.`;

            let summary;
            try {
                summary = await this.callLLM(summaryPrompt, 0.7, 2000, llmSettings);
                console.log('🔍 Search summarization completed successfully');
            } catch (error) {
                console.error('🔍 Search summarization failed, using fallback:', error.message);
                summary = "Search summarization failed due to response length limits. Here are the raw search results instead.";
            }
            
            const markdownArgs = {
                title: `Search Summary: ${query}`,
                subtitle: `Analyzed ${searchSettings.limit || 10} results`,
                sections: [
                    {
                        heading: 'Summary',
                        text: summary
                    },
                    {
                        heading: 'Raw Results',
                        text: searchText
                    }
                ],
                summary: 'Search results have been analyzed and summarized for easy consumption.'
            };

            return this.handleFormatMarkdown(markdownArgs);

        } catch (error) {
            console.error('🔍 Search summarize error:', error);
            return {
                content: [
                    { type: 'text', text: `Search summarization failed: ${error.message}` }
                ]
            };
        }
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
    }
];

export { SequentialThinkingMCPServer, tools };

// Run the server if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const server = new SequentialThinkingMCPServer();
    server.run().catch(console.error);
} 