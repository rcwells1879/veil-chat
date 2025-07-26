#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// Web extraction functionality
import WebExtractor from './extractors/web-extractor.js';

// Shared blocklist of sites with aggressive bot detection that should be skipped entirely
const BLOCKED_SITES = [
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
    'ubereats.com'
];

// Helper function to check if a URL is from a blocked site
function isBlockedSite(url) {
    try {
        const domain = new URL(url).hostname.toLowerCase();
        return BLOCKED_SITES.some(blockedSite => domain.includes(blockedSite));
    } catch (error) {
        return false; // Invalid URL, don't block
    }
}

// Search Provider Classes
class BraveSearchProvider {
    constructor(apiKey, options = {}) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.search.brave.com/res/v1/web/search';
        this.summarizerUrl = 'https://api.search.brave.com/res/v1/summarizer/search';
        this.options = options;
    }

    async search(query, options = {}) {
        const params = new URLSearchParams({
            q: query,
            count: options.limit || 20,
            freshness: options.timeFilter || 'any',
            country: 'US',
            lang: 'en'
        });

        // Add summary parameter if requested
        if (options.enableSummarizer) {
            params.append('summary', '1');
        }

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
        // console.log('🔍 Brave Search raw response:', JSON.stringify(data, null, 2));
        const results = this.formatResults(data);
        
        // Return both results and summarizer key if available
        return {
            results,
            summarizer: data.summarizer || null
        };
    }

    async getSummary(summarizerKey) {
        const params = new URLSearchParams({
            key: summarizerKey,
            entity_info: '1'
        });

        const response = await fetch(`${this.summarizerUrl}?${params}`, {
            headers: {
                'X-Subscription-Token': this.apiKey,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Brave Summarizer API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return this.formatSummary(data);
    }

    formatSummary(data) {
        if (!data.summary || !data.summary.length) {
            return null;
        }

        // Extract text from summary tokens
        const summaryText = data.summary
            .map(token => token.text || '')
            .join('')
            .trim();

        return {
            summary: summaryText,
            entities: data.entities || [],
            infobox: data.infobox || null
        };
    }

    async searchWithSummarizer(query, options = {}) {
        console.log(`🔍 Brave Search: Searching with summarizer for "${query}"`);
        
        // Step 1: Get search results with summarizer key
        const searchResponse = await this.search(query, { 
            ...options, 
            enableSummarizer: true 
        });
        
        // Step 2: If summarizer key exists, get AI summary
        if (searchResponse.summarizer?.key) {
            console.log('📝 Brave Search: Summarizer key found, getting AI summary...');
            try {
                const summaryData = await this.getSummary(searchResponse.summarizer.key);
                
                if (summaryData?.summary) {
                    return {
                        results: searchResponse.results,
                        summary: summaryData.summary,
                        entities: summaryData.entities,
                        infobox: summaryData.infobox
                    };
                }
            } catch (error) {
                console.warn('⚠️ Brave Search: Summarizer failed, falling back to regular results:', error.message);
            }
        }
        
        // Fallback to regular search results
        console.log('📄 Brave Search: No summarizer available, returning regular results');
        return {
            results: searchResponse.results,
            summary: null,
            entities: [],
            infobox: null
        };
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
        return this.formatResults(data, options.limit || 20);
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
            count: options.limit || 20,
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

        // Initialize web extractor
        this.webExtractor = new WebExtractor();

        // Initialize memory management system
        this.initializeMemorySystem();

        this.setupToolHandlers();
        this.setupErrorHandlers();
    }

    // Memory Management System
    initializeMemorySystem() {
        // Store for active agent tasks
        this.agentTasks = new Map();
        
        // Maximum number of concurrent tasks
        this.maxTasks = 100;
        
        // Task timeout (30 minutes)
        this.taskTimeout = 30 * 60 * 1000;
        
        // Start cleanup interval (every 5 minutes)
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredTasks();
        }, 5 * 60 * 1000);
        
        console.log('🧠 Memory management system initialized');
    }

    // Generate unique task ID
    generateTaskId() {
        return 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Create new agent task
    startAgentTask(goal, options = {}) {
        // Check if we're at capacity
        if (this.agentTasks.size >= this.maxTasks) {
            throw new Error('Maximum number of concurrent tasks reached');
        }

        const taskId = this.generateTaskId();
        const task = {
            taskId,
            created: Date.now(),
            lastAccessed: Date.now(),
            memory: {
                goal,
                plan: [],
                urls_to_visit: [],
                extracted_content: {},
                failed_urls: [],
                current_step: 'initialized',
                ...options
            }
        };

        this.agentTasks.set(taskId, task);
        console.log(`🧠 Started agent task: ${taskId}`);
        
        return taskId;
    }

    // Write to agent task memory
    writeToMemory(taskId, key, value) {
        const task = this.agentTasks.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }

        task.memory[key] = value;
        task.lastAccessed = Date.now();
        
        console.log(`🧠 Updated memory for task ${taskId}: ${key}`);
        return true;
    }

    // Read from agent task memory
    readFromMemory(taskId, key = null) {
        const task = this.agentTasks.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }

        task.lastAccessed = Date.now();
        
        if (key === null) {
            return task.memory;
        }
        
        return task.memory[key];
    }

    // End agent task and cleanup
    endAgentTask(taskId) {
        const task = this.agentTasks.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }

        this.agentTasks.delete(taskId);
        console.log(`🧠 Ended agent task: ${taskId}`);
        
        return true;
    }

    // Clean up expired tasks
    cleanupExpiredTasks() {
        const now = Date.now();
        let cleaned = 0;

        for (const [taskId, task] of this.agentTasks) {
            if (now - task.lastAccessed > this.taskTimeout) {
                this.agentTasks.delete(taskId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`🧠 Cleaned up ${cleaned} expired agent tasks`);
        }
    }

    // Get task status
    getTaskStatus(taskId) {
        const task = this.agentTasks.get(taskId);
        if (!task) {
            return null;
        }

        return {
            taskId: task.taskId,
            created: task.created,
            lastAccessed: task.lastAccessed,
            currentStep: task.memory.current_step,
            memoryKeys: Object.keys(task.memory)
        };
    }

    // Enhanced LLM Integration method with persona-aware prompting
    async callLLM(prompt, temperature = 0.7, maxTokens = 2000, llmSettings = null) {
        try {
            // Log all incoming settings and prompt
            console.log('🧠 MCP Server callLLM:', {
                promptLength: prompt.length,
                temperature,
                maxTokens,
                hasLlmSettings: !!llmSettings
            });

            // Use provided settings or defaults
            const apiBaseUrl = llmSettings?.apiBaseUrl || 'https://litellm-veil.veilstudio.io';
            const apiKey = llmSettings?.apiKey || 'sk-DSHSfgTh65Fvd';
            const model = llmSettings?.model || 'gemini2.5-flash';
            
            const endpoint = `${apiBaseUrl}/v1/chat/completions`;
            
            // Log the endpoint, model, and key (mask the key for safety)
            console.log('🌐 MCP Server calling LLM:', endpoint, 'Model:', model, 'Key:', apiKey ? apiKey.slice(0, 6) + '...' : '(none)');

            // Enhanced system message for agent tasks
            const systemMessage = {
                role: "system",
                content: "You are an intelligent research assistant helping to process information for a conversational AI. Provide clear, accurate, and well-structured responses that can be seamlessly integrated into natural conversation. Focus on being helpful, precise, and maintaining high information quality."
            };

            const messages = [
                systemMessage,
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

            // Handle Gemini-specific parameters to disable reasoning
            if (model && model.toLowerCase().includes('gemini')) {
                console.log('🤖 Applying Gemini-specific settings to disable reasoning...');
                payload.thinkingBudget = 0;
                payload.thinkingConfig = {
                    thinkingBudget: 0
                };
                payload.reasoning_effort = "low";
            }

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
                case 'extract_web_content':
                    return this.handleExtractWebContent(args);
                case 'extract_for_summary':
                    return this.handleExtractForSummary(args);
                case 'extract_multiple_urls':
                    return this.handleExtractMultipleUrls(args);
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
            const limit = parseInt(searchSettings.limit) || 20;
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

            // For Brave Search with auto-summarize, use the enhanced summarizer
            if (provider === 'brave' && autoSummarize) {
                console.log('🤖 Using Brave Search with enhanced summarizer...');
                
                const searchResponse = await searchProvider.searchWithSummarizer(query, {
                    limit,
                    timeFilter
                });

                if (searchResponse.summary) {
                    // Use Brave's AI summary for persona-driven summarization
                    console.log('📝 Brave summarizer provided content, creating persona-driven summary...');
                    return this.handlePersonaSearchSummarize({ 
                        query, 
                        searchSettings, 
                        llmSettings 
                    }, searchResponse);
                } else {
                    console.log('📄 No Brave summary available, falling back to regular summarization...');
                    return this.handleSearchSummarize({ query, searchSettings, llmSettings }, searchResponse.results);
                }
            }

            // Perform regular search for other providers or non-summarized requests
            const results = await searchProvider.search(query, { limit, timeFilter });
            
            // Handle the response based on provider type
            const searchResults = results.results || results;

            if (!searchResults || searchResults.length === 0) {
                return {
                    content: [
                        { type: 'text', text: `No search results found for query: "${query}"` }
                    ]
                };
            }

            // If auto-summarize is enabled, call the search summarize function
            if (autoSummarize) {
                console.log('🤖 Auto-summarize enabled, calling search summarize function...');
                return this.handleSearchSummarize({ query, searchSettings, llmSettings }, searchResults);
            }

            // Format results normally without summarization
            const sections = searchResults.map((result, index) => ({
                heading: `${index + 1}. ${result.title}`,
                text: `**URL:** ${result.url}\n\n${result.description || result.snippet}`,
                published: result.published
            }));

            const markdownArgs = {
                title: `Search Results: ${query}`,
                subtitle: `Found ${searchResults.length} results using ${provider}`,
                sections: sections,
                summary: `Found ${searchResults.length} results for "${query}"`
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

    async handlePersonaSearchSummarize(args, searchResponse) {
        const { query, searchSettings = {}, llmSettings = null } = args;
        
        try {
            console.log('🎭 Generating persona-driven summary from Brave summarizer content...');
            
            // Use Brave's AI summary as the primary content
            const braveContent = searchResponse.summary;
            const entities = searchResponse.entities || [];
            const infobox = searchResponse.infobox || null;
            
            // Prepare enhanced prompt for persona-driven summarization
            const summaryPrompt = `You are responding as your current persona in a natural conversation. The user asked: "${query}"

Here's the information I found:

${braveContent}

${entities.length > 0 ? `\nKey entities: ${entities.map(e => e.title || e.name || e.text).join(', ')}` : ''}

${infobox ? `\nAdditional info: ${infobox.long_desc || infobox.short_desc || ''}` : ''}

Please provide a natural, conversational response about this information. Stay in character as your persona, be engaging and helpful, and present the information in a way that feels like a natural conversation. Don't start with phrases like "According to my search" or "Based on the search results" - just naturally share what you found.`;

            console.log('🤖 Generating persona-driven summary...');
            const summary = await this.callLLM(summaryPrompt, 0.7, 2000, llmSettings);
            
            return {
                content: [
                    { type: 'text', text: summary }
                ]
            };

        } catch (error) {
            console.error('🎭 Persona search summarize error:', error);
            
            // Fallback to regular summarization if LLM fails
            return this.handleSearchSummarize(args, searchResponse.results);
        }
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
            
            // Generate persona-driven summary using LLM
            const summaryPrompt = `You are responding as your current persona in a natural conversation. The user asked: "${query}"

Based on the search information I found:

${searchText}

Please provide a natural, conversational response about this information. Stay in character as your persona, be engaging and helpful, and present the information in a way that feels like a natural conversation. Don't start with phrases like "According to my search" or "Based on the search results" - just naturally share what you found.`;

            let summary;
            try {
                console.log('🎭 Generating persona-driven fallback summary...');
                summary = await this.callLLM(summaryPrompt, 0.7, 2000, llmSettings);
                console.log('🔍 Search summarization completed successfully');
            } catch (error) {
                console.error('🔍 Search summarization failed, using fallback:', error.message);
                summary = "I found some search results, but I'm having trouble processing them right now. Let me know if you'd like me to try a different search approach.";
            }
            
            // Return persona-driven response directly
            return {
                content: [
                    { type: 'text', text: summary }
                ]
            };

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

    // Web Content Extraction Handlers
    async handleExtractWebContent(args) {
        const { url, options = {} } = args;
        
        if (!url) {
            throw new Error('URL is required for web content extraction');
        }

        try {
            console.log(`🔍 MCP Server: Extracting content from ${url}`);
            const extractedData = await this.webExtractor.extract(url, options);
            
            return {
                content: [
                    {
                        type: 'text',
                        text: `# ${extractedData.title}\n\n**URL:** ${extractedData.url}\n**Extracted:** ${extractedData.extractedAt}\n**Method:** ${extractedData.extractionMethod}\n\n${extractedData.content}`
                    }
                ]
            };
        } catch (error) {
            // Handle blocked sites differently from extraction failures
            if (error.message.includes('is blocked due to aggressive bot detection')) {
                console.log(`🚫 Skipped blocked site: ${url}`);
                return {
                    content: [
                        {
                            type: 'text',
                            text: `🚫 Skipped ${url}: Site blocked due to aggressive bot detection`
                        }
                    ]
                };
            } else {
                console.error(`❌ MCP Server: Web extraction failed for ${url}:`, error.message);
                return {
                    content: [
                        {
                            type: 'text',
                            text: `⚠️ Failed to extract content from ${url}: ${error.message}`
                        }
                    ]
                };
            }
        }
    }

    async handleExtractForSummary(args) {
        const { url, options = {} } = args;
        
        if (!url) {
            throw new Error('URL is required for web content extraction');
        }

        try {
            console.log(`📝 MCP Server: Extracting content for summarization from ${url}`);
            const extractedData = await this.webExtractor.extractForSummarization(url, options);
            
            // Format for LLM consumption
            return {
                content: [
                    {
                        type: 'text',
                        text: `**${extractedData.title}**\n\nSource: ${extractedData.url}\n\n${extractedData.content}`
                    }
                ]
            };
        } catch (error) {
            console.error(`❌ MCP Server: Web extraction for summary failed for ${url}:`, error.message);
            return {
                content: [
                    {
                        type: 'text',
                        text: `⚠️ Failed to extract content from ${url}: ${error.message}`
                    }
                ]
            };
        }
    }

    async handleExtractMultipleUrls(args) {
        const { urls, options = {} } = args;
        
        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            throw new Error('URLs array is required for batch extraction');
        }

        try {
            console.log(`🔍 MCP Server: Batch extracting content from ${urls.length} URLs`);
            const results = await this.webExtractor.extractBatch(urls, options);
            
            let combinedContent = '# Batch Web Content Extraction\n\n';
            let successCount = 0;
            
            results.forEach((result, index) => {
                if (result.success) {
                    successCount++;
                    combinedContent += `## ${result.data.title}\n\n**URL:** ${result.url}\n**Method:** ${result.data.extractionMethod}\n\n${result.data.content}\n\n---\n\n`;
                } else {
                    combinedContent += `## ❌ Failed: ${result.url}\n\n**Error:** ${result.error}\n\n---\n\n`;
                }
            });
            
            combinedContent += `\n**Summary:** Successfully extracted ${successCount}/${urls.length} URLs`;
            
            return {
                content: [
                    {
                        type: 'text',
                        text: combinedContent
                    }
                ]
            };
        } catch (error) {
            console.error(`❌ MCP Server: Batch web extraction failed:`, error.message);
            return {
                content: [
                    {
                        type: 'text',
                        text: `⚠️ Batch extraction failed: ${error.message}`
                    }
                ]
            };
        }
    }

    setupErrorHandlers() {
        this.server.onerror = (error) => {
            console.error('MCP Server Error:', error);
        };
    }

    // Agent Workflow Engine with State Machine
    async executeAgentWorkflow(taskId, options = {}) {
        console.log(`🤖 Agent Workflow: Starting execution for task ${taskId}`);
        
        const task = this.agentTasks.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }
        
        try {
            // Update task status to running
            this.writeToMemory(taskId, 'current_step', 'running');
            
            // Execute the workflow steps
            await this.executeSearchPhase(taskId, options);
            await this.executeAnalysisPhase(taskId, options);
            await this.executeExtractionPhase(taskId, options);
            await this.executeSynthesisPhase(taskId, options);
            
            // Mark task as completed
            this.writeToMemory(taskId, 'current_step', 'completed');
            
            console.log(`✅ Agent Workflow: Task ${taskId} completed successfully`);
            
            return {
                success: true,
                message: 'Agent workflow completed successfully',
                taskId: taskId,
                results: this.readFromMemory(taskId)
            };
            
        } catch (error) {
            console.error(`❌ Agent Workflow: Task ${taskId} failed:`, error);
            this.writeToMemory(taskId, 'current_step', 'failed');
            this.writeToMemory(taskId, 'error', error.message);
            
            return {
                success: false,
                message: `Agent workflow failed: ${error.message}`,
                taskId: taskId,
                error: error.message
            };
        }
    }
    
    // Phase 1: Search for relevant websites
    async executeSearchPhase(taskId, options = {}) {
        console.log(`🔍 Agent Workflow: Executing search phase for task ${taskId}`);
        
        const task = this.agentTasks.get(taskId);
        const goal = task.memory.goal;
        
        this.writeToMemory(taskId, 'current_step', 'searching');
        
        // Create search query from goal
        const rawSearchQuery = await this.generateSearchQuery(goal, options.llmSettings);
        // Remove quotes that LLM might add despite instructions
        const searchQuery = rawSearchQuery.replace(/^["']|["']$/g, '');
        console.log(`🔍 Generated search query: ${searchQuery} (cleaned from: ${rawSearchQuery})`);
        
        // Execute raw web search to get actual search results instead of formatted markdown
        const rawSearchResults = await this.executeRawWebSearch(searchQuery, options.searchSettings);
        
        // Extract URLs directly from raw search results
        const urls = this.extractUrlsFromRawSearchResults(rawSearchResults);
        console.log(`🔍 Found ${urls.length} URLs to process:`, urls);
        
        // Store URLs and search results in memory
        this.writeToMemory(taskId, 'search_query', searchQuery);
        this.writeToMemory(taskId, 'search_results', rawSearchResults);
        this.writeToMemory(taskId, 'urls_to_visit', urls);
        
        return urls;
    }
    
    // Phase 2: Analyze which URLs are most relevant
    async executeAnalysisPhase(taskId, options = {}) {
        console.log(`🧠 Agent Workflow: Executing analysis phase for task ${taskId}`);
        
        const task = this.agentTasks.get(taskId);
        const goal = task.memory.goal;
        const urls = task.memory.urls_to_visit || [];
        
        this.writeToMemory(taskId, 'current_step', 'analyzing');
        
        if (urls.length === 0) {
            console.log('🧠 No URLs to analyze, skipping analysis phase');
            return [];
        }
        
        // Use LLM to analyze and prioritize URLs
        const analysisPrompt = `I need to prioritize which websites to extract content from based on relevance to the user's goal.

Goal: ${goal}
        
Available URLs to analyze:
${urls.map((url, i) => `${i + 1}. ${url}`).join('\n')}

Please analyze these URLs and determine their relevance to the goal. Consider:
- Domain authority and reliability
- URL structure indicating content type
- Likely content quality and depth
- Relevance to the specific goal

Prioritize URLs that are likely to contain:
- Authoritative, well-researched information
- Current and up-to-date content
- Comprehensive coverage of the topic
- Practical, actionable insights

Respond in JSON format:
{
    "prioritized_urls": [
        {
            "url": "https://example.com",
            "priority": 1,
            "relevance_score": 0.9,
            "reasoning": "Official documentation/news source with comprehensive coverage"
        }
    ]
}

Order by priority (1 = highest). Include all URLs but rank them by expected value.`;
        
        const analysisResponse = await this.callLLM(analysisPrompt, 0.3, 1000, options.llmSettings);
        
        let prioritizedUrls = [];
        try {
            const analysis = JSON.parse(analysisResponse);
            prioritizedUrls = analysis.prioritized_urls || [];
            console.log(`🧠 Analysis complete. Prioritized ${prioritizedUrls.length} URLs`);
        } catch (error) {
            console.warn('🧠 Failed to parse analysis response, using original URL order');
            prioritizedUrls = urls.map((url, i) => ({ 
                url, 
                priority: i + 1, 
                relevance_score: 0.5, 
                reasoning: 'Default ordering' 
            }));
        }
        
        // Store analysis results
        this.writeToMemory(taskId, 'url_analysis', prioritizedUrls);
        
        return prioritizedUrls;
    }
    
    // Phase 3: Extract content from prioritized URLs
    async executeExtractionPhase(taskId, options = {}) {
        console.log(`📄 Agent Workflow: Executing extraction phase for task ${taskId}`);
        
        const task = this.agentTasks.get(taskId);
        const prioritizedUrls = task.memory.url_analysis || [];
        
        this.writeToMemory(taskId, 'current_step', 'extracting');
        
        if (prioritizedUrls.length === 0) {
            console.log('📄 No URLs to extract, skipping extraction phase');
            return {};
        }
        
        const extractedContent = {};
        const failedUrls = [];
        const processedUrls = new Set(); // Track processed URLs to prevent duplicates
        
        // Extract content from URLs in priority order
        for (const urlInfo of prioritizedUrls) {
            const url = urlInfo.url;
            
            // Skip if URL already processed
            if (processedUrls.has(url)) {
                console.log(`⏭️ Skipping duplicate URL: ${url}`);
                continue;
            }
            
            // Mark URL as being processed
            processedUrls.add(url);
            
            try {
                console.log(`📄 Extracting content from: ${url}`);
                
                // Choose extraction method intelligently
                const extractionResult = await this.extractWithIntelligentMethod(url, {
                    maxLength: 4000,
                    blockResources: true
                });
                
                if (extractionResult && extractionResult.content) {
                    extractedContent[url] = {
                        ...extractionResult,
                        priority: urlInfo.priority,
                        relevance_score: urlInfo.relevance_score,
                        reasoning: urlInfo.reasoning
                    };
                    
                    // Calculate actual character count from content structure
                    let characterCount = 0;
                    if (Array.isArray(extractionResult.content) && extractionResult.content[0]?.text) {
                        characterCount = extractionResult.content[0].text.length;
                    } else if (typeof extractionResult.content === 'string') {
                        characterCount = extractionResult.content.length;
                    } else {
                        characterCount = JSON.stringify(extractionResult.content).length;
                    }
                    
                    console.log(`✅ [EXTRACT-${Date.now()}] Successfully extracted ${characterCount} characters from ${url}`);
                } else {
                    console.warn(`⚠️ No content extracted from ${url}`);
                    failedUrls.push(url);
                }
                
            } catch (error) {
                // Handle blocked sites differently from extraction failures  
                if (error.message.includes('is blocked due to aggressive bot detection')) {
                    console.log(`🚫 Skipped blocked site: ${url}`);
                    failedUrls.push(`${url} (blocked)`);
                } else {
                    console.error(`❌ Extraction failed for ${url}:`, error.message);
                    failedUrls.push(url);
                }
            }
        }
        
        // Store extraction results
        this.writeToMemory(taskId, 'extracted_content', extractedContent);
        this.writeToMemory(taskId, 'failed_urls', failedUrls);
        
        console.log(`📄 Extraction complete. Success: ${Object.keys(extractedContent).length}, Failed: ${failedUrls.length}`);
        
        return extractedContent;
    }
    
    /**
     * Clean extracted content by removing website navigation and boilerplate
     */
    cleanContentForSynthesis(content) {
        if (!content || typeof content !== 'string') {
            return '';
        }
        
        // Remove common website navigation and boilerplate patterns
        const cleaningPatterns = [
            // Navigation and site structure
            /Site\s*Index\s*Browse\s*World\s*Business\s*Markets?/gi,
            /Browse\s*World\s*Business\s*Markets?\s*Sustainability/gi,
            /Quick\s*Links\s*Quick\s*Links/gi,
            /Home\s*Overall\s*Rankings\s*Rankings\s*Index/gi,
            /News\s*Sections?\s*U\.?S\.?\s*News/gi,
            
            // Common footers and headers
            /About\s+Reuters.*?opens\s+new\s+tab/gi,
            /Advertise\s+with\s+Us.*?opens\s+new\s+tab/gi,
            /Careers.*?opens\s+new\s+tab/gi,
            /Download\s+the\s+App\s+\(iOS\).*?opens\s+new\s+tab/gi,
            /Download\s+the\s+App\s+\(Android\).*?opens\s+new\s+tab/gi,
            
            // Cookie and privacy notices
            /By\s+continuing,?\s*I\s+agree\s+to\s+the\s+Privacy\s+Policy/gi,
            /By\s+accepting,?\s*you\s+agree\s+to\s+our\s+updated\s+Terms/gi,
            
            // Market tickers and technical data (keep headlines but remove ticker symbols)
            /\*\d+[\d,]*\.\d+\s*Uptrend\s*[+\-]\d+/gi,
            /LAST\s*\|\s*\d+:\d+:\d+\s*[AP]M\s*[A-Z]+/gi,
            
            // Ad and tracking content
            /#bfad-slot\s*\{[^}]+\}/gi,
            /@media[^}]+\{[^}]+\}/gi,
            
            // Schema markup and JSON-LD
            /\[\{"@context".*?\}\]/gi,
            
            // Excessive whitespace and line breaks
            /\s{3,}/g,
            /\n{3,}/g
        ];
        
        let cleaned = content;
        
        // Apply all cleaning patterns
        cleaningPatterns.forEach(pattern => {
            cleaned = cleaned.replace(pattern, ' ');
        });
        
        // Additional cleanup for news content
        // Remove lines that are purely navigation (start with common nav terms)
        const lines = cleaned.split('\n');
        const filteredLines = lines.filter(line => {
            const trimmed = line.trim();
            if (trimmed.length < 5) return false; // Remove very short lines
            
            // Remove pure navigation lines
            const navPatterns = [
                /^(Home|About|Contact|Privacy|Terms|Login|Sign\s+[Ii]n|Register|Subscribe|Menu|Browse|Search)$/i,
                /^(World|Business|Markets|Sports|Technology|Politics|Health)$/i,
                /^[A-Z\s]{2,20}$/ // All caps short phrases (likely navigation)
            ];
            
            return !navPatterns.some(pattern => pattern.test(trimmed));
        });
        
        cleaned = filteredLines.join('\n');
        
        // Final cleanup
        cleaned = cleaned
            .replace(/\s+/g, ' ') // Normalize spaces
            .replace(/\n\s*\n/g, '\n\n') // Normalize line breaks
            .trim();
        
        return cleaned;
    }

    // Phase 4: Synthesize information into final response
    async executeSynthesisPhase(taskId, options = {}) {
        console.log(`🎯 Agent Workflow: Executing synthesis phase for task ${taskId}`);
        
        const task = this.agentTasks.get(taskId);
        const goal = task.memory.goal;
        const extractedContent = task.memory.extracted_content || {};
        
        this.writeToMemory(taskId, 'current_step', 'synthesizing');
        
        if (Object.keys(extractedContent).length === 0) {
            console.log('🎯 No content to synthesize');
            const fallbackSynthesis = `I searched for information about "${goal}" but was unable to extract content from the websites found. Please try refining your search query or check if the topic requires more specific search terms.`;
            
            this.writeToMemory(taskId, 'final_synthesis', fallbackSynthesis);
            return fallbackSynthesis;
        }
        
        // Prepare content for synthesis - keep source attribution but clean content
        const contentSummary = Object.entries(extractedContent)
            .map(([url, data]) => {
                // Handle both string and array content formats
                let contentText = '';
                if (typeof data.content === 'string') {
                    contentText = data.content;
                } else if (Array.isArray(data.content) && data.content[0]?.text) {
                    contentText = data.content[0].text;
                } else if (data.content) {
                    contentText = JSON.stringify(data.content);
                } else {
                    contentText = 'No content available';
                }
                
                // Check if content is paywalled before processing
                if (this.isPaywalledContent(contentText)) {
                    return `
Source: ${url}
Title: ${data.title || 'Untitled'}
Content: [PAYWALL] This article requires a subscription to read in full. Available preview: ${contentText.substring(0, 300)}${contentText.length > 300 ? '...' : ''}
`;
                }
                
                // Clean the content to remove website boilerplate and navigation
                const cleanedContent = this.cleanContentForSynthesis(contentText);
                
                return `
Source: ${url}
Title: ${data.title || 'Untitled'}
Content: ${cleanedContent.substring(0, 2000)}${cleanedContent.length > 2000 ? '...' : ''}
`;
            }).join('\n---\n');
        
        const synthesisPrompt = `You are responding as your current persona in a natural conversation. The user asked about: "${goal}"

I've extracted actual content from ${Object.keys(extractedContent).length} sources to help answer their question:

${contentSummary}

Please provide a natural, conversational response about this information. Stay in character as your persona, be engaging and helpful, and present the information in a way that feels like a natural conversation. 

Key guidelines:
- Focus on the ACTUAL CONTENT AND INFORMATION extracted from the sources, not descriptions of what the websites are about
- Don't start with phrases like "According to my research" or "Based on the information I found"  
- Present the information as if you naturally know about this topic
- Synthesize the most relevant details that directly answer the user's question
- Be accurate to the source material but conversational in tone
- Provide actionable insights where relevant
- If there are conflicting viewpoints in the sources, acknowledge them naturally
- You can mention sources for credibility when appropriate
- If sources show "[PAYWALL]" content, acknowledge the limitation naturally (e.g., "Some sources require subscriptions") but focus on the available information
- Don't repeatedly mention paywalls - briefly acknowledge and move on to available content

Focus on being genuinely helpful while maintaining your persona's voice and style. Extract and present the specific information the user is looking for, not meta-information about the websites themselves.`;
        
        const synthesis = await this.callLLM(synthesisPrompt, 0.7, 2000, options.llmSettings);
        
        console.log(`🎯 Synthesis complete. Generated ${synthesis.length} characters`);
        
        // Store final synthesis
        this.writeToMemory(taskId, 'final_synthesis', synthesis);
        
        return synthesis;
    }
    
    // Helper method to generate search query from goal
    async generateSearchQuery(goal, llmSettings) {
        const prompt = `You're helping to search for information. Convert this goal into an effective web search query:
        
Goal: ${goal}

Analyze the goal and create 1-3 search queries that would find the most relevant, current information. Consider:
- Key terms and concepts
- Synonyms and related terms
- Specific vs. general search strategies
- Potential information sources

IMPORTANT: Do NOT include specific years (like 2024, 2025, etc.) in your search query. Date filtering is handled separately by user settings.

Respond with just the best search query (no quotes, no additional text). Make it specific enough to get quality results but broad enough to capture relevant information.

Examples:
Goal: "Tell me about electric vehicle charging infrastructure" → "electric vehicle charging stations infrastructure"
Goal: "How do I start a small business?" → "small business startup guide requirements"
Goal: "Latest developments in renewable energy" → "latest renewable energy developments"`;
        
        return await this.callLLM(prompt, 0.3, 150, llmSettings);
    }
    
    // Helper method to extract URLs from search results
    // Execute raw web search without markdown formatting
    async executeRawWebSearch(query, searchSettings = {}) {
        const provider = searchSettings.provider || 'brave';
        const apiKey = searchSettings.apiKey;
        const limit = parseInt(searchSettings.limit) || 20;
        const timeFilter = searchSettings.timeFilter || 'any';

        console.log('🔍 Raw web search:', { query, provider, limit, timeFilter });
        console.log('🔍 Raw web search - Full searchSettings:', searchSettings);

        // Create search provider instance (same as handleWebSearch)
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

        // Get raw search results
        const results = await searchProvider.search(query, { limit, timeFilter });
        const searchResults = results.results || results;

        console.log('🔍 Raw search results received:', JSON.stringify(searchResults, null, 2));
        console.log('🔍 Search results type:', typeof searchResults, 'Array?', Array.isArray(searchResults), 'Length:', searchResults?.length);

        return searchResults;
    }

    // Extract URLs directly from raw search results
    extractUrlsFromRawSearchResults(rawSearchResults) {
        console.log('🔍 URL Extraction - Input rawSearchResults:', typeof rawSearchResults, Array.isArray(rawSearchResults), rawSearchResults?.length);
        console.log('🔍 URL Extraction - First result sample:', rawSearchResults?.[0]);
        
        const urls = [];
        
        if (rawSearchResults && Array.isArray(rawSearchResults)) {
            // Extract URLs directly from search result objects
            for (const result of rawSearchResults) {
                console.log('🔍 URL Extraction - Processing result:', { url: result.url, title: result.title });
                if (result.url && result.url.startsWith('http')) {
                    urls.push(result.url);
                    console.log('🔍 URL Extraction - Added URL:', result.url);
                }
            }
        } else {
            console.log('🔍 URL Extraction - rawSearchResults is not an array or is empty');
        }
        
        // Remove duplicates, filter out blocked sites, then limit to top 5 URLs
        const uniqueUrls = [...new Set(urls)]
            .filter(url => url && url.startsWith('http'))
            .filter(url => {
                if (isBlockedSite(url)) {
                    console.log(`🚫 Filtered out blocked site: ${url}`);
                    return false;
                }
                return true;
            })
            .slice(0, 5); // Limit to top 5 URLs after filtering
        
        console.log('🔍 URL Extraction - Final URLs extracted:', uniqueUrls);
        return uniqueUrls;
    }

    // Legacy method kept for backwards compatibility
    extractUrlsFromSearchResults(searchResults) {
        const urls = [];
        
        if (searchResults && searchResults.content) {
            // Parse markdown content to extract URLs
            const content = searchResults.content;
            
            for (const item of content) {
                if (item.type === 'text' && item.text) {
                    // Look for URL patterns in the text
                    const urlMatches = item.text.match(/https?:\/\/[^\s\)]+/g);
                    if (urlMatches) {
                        urls.push(...urlMatches);
                    }
                }
            }
        }
        
        // Remove duplicates, filter out blocked sites, then limit to top 5 URLs
        const uniqueUrls = [...new Set(urls)]
            .filter(url => url && url.startsWith('http'))
            .filter(url => {
                if (isBlockedSite(url)) {
                    console.log(`🚫 Filtered out blocked site: ${url}`);
                    return false;
                }
                return true;
            })
            .slice(0, 5); // Limit to top 5 URLs after filtering
        
        return uniqueUrls;
    }
    
    // Helper method for intelligent extraction method selection
    async extractWithIntelligentMethod(url, options = {}) {
        const domain = new URL(url).hostname.toLowerCase();
        
        // Check if site is blocked using shared blocklist
        if (isBlockedSite(url)) {
            console.log(`🚫 Skipping blocked site: ${domain}`);
            throw new Error(`Site ${domain} is blocked due to aggressive bot detection`);
        }
        
        // Dynamic sites that typically need Puppeteer
        const dynamicSites = [
            'reddit.com',
            'twitter.com',
            'facebook.com',
            'linkedin.com',
            'instagram.com',
            'youtube.com',
            'opentable.com',
            'maps.google.com',
            'squarespace.com',    // Squarespace sites with heavy JS
            'squareup.com',       // Square restaurant sites
            'wixsite.com',        // Wix sites
            'yelp.com',
            'tripadvisor.com',
            // News sites that work better with Puppeteer due to dynamic content/paywalls
            'wsj.com',           // Wall Street Journal (paywall, dynamic)
            'bloomberg.com',     // Bloomberg (heavy JavaScript)
            'cnbc.com',          // CNBC (dynamic market data)
            'marketwatch.com',   // MarketWatch (dynamic charts)
            'nytimes.com'        // NY Times (paywall, dynamic content)
        ];
        
        // Static news sites that work well with Cheerio
        const staticNewsSites = [
            'foxnews.com',       // Fox News (mostly static HTML)
            'cnn.com',           // CNN (good static content)
            'bbc.com',           // BBC (excellent static structure) 
            'reuters.com',       // Reuters (clean static content)
            'nbcnews.com',       // NBC News (static articles)
            'cbsnews.com',       // CBS News (static content)
            'washingtonpost.com', // Washington Post (some static content)
            'theguardian.com',   // The Guardian (good static structure)
            'npr.org',           // NPR (excellent static content)
            'apnews.com'         // Associated Press (clean static)
        ];
        
        let needsPuppeteer = dynamicSites.some(site => domain.includes(site));
        const isStaticNewsSite = staticNewsSites.some(site => domain.includes(site));
        
        // Check for common restaurant website builders that need Puppeteer
        if (!needsPuppeteer) {
            const restaurantBuilderPatterns = [
                'poquitosbothell.com',     // Known Squarespace restaurant sites
                'vivajaliscoinbothell.com', // Another Squarespace pattern
                '.square.site',            // Square sites
                '.wixsite.com'             // Wix sites
            ];
            
            if (restaurantBuilderPatterns.some(pattern => domain.includes(pattern) || url.includes(pattern))) {
                console.log(`🍽️ Restaurant website builder detected: ${domain}`);
                needsPuppeteer = true;
            }
        }
        
        // Log site classification for debugging
        if (needsPuppeteer) {
            console.log(`🔍 Site classification: ${domain} → Puppeteer (dynamic)`);
        } else if (isStaticNewsSite) {
            console.log(`🔍 Site classification: ${domain} → Cheerio (static news)`);
        } else {
            console.log(`🔍 Site classification: ${domain} → Cheerio (default)`);
        }
        
        try {
            let extractionResult;
            
            if (needsPuppeteer) {
                console.log(`🤖 Using Puppeteer for dynamic site: ${domain}`);
                extractionResult = await this.handleExtractWebContent({ url, options });
            } else {
                console.log(`⚡ Using Cheerio for static site: ${domain}`);
                extractionResult = await this.handleExtractForSummary({ url, options });
            }
            
            // Validate extraction result - only fallback if extraction actually failed
            if (this.isValidExtractionResult(extractionResult)) {
                return extractionResult;
            } else {
                throw new Error('Extraction returned invalid or insufficient content');
            }
            
        } catch (error) {
            console.log(`⚠️ Primary extraction failed for ${url}: ${error.message}`);
            console.log(`🔄 Trying fallback extraction method...`);
            
            // Fallback to the other method only on genuine failure
            try {
                let fallbackResult;
                if (needsPuppeteer) {
                    console.log(`⚡ Fallback: Using Cheerio for ${domain}`);
                    fallbackResult = await this.handleExtractForSummary({ url, options });
                } else {
                    console.log(`🤖 Fallback: Using Puppeteer for ${domain}`);
                    fallbackResult = await this.handleExtractWebContent({ url, options });
                }
                
                if (this.isValidExtractionResult(fallbackResult)) {
                    console.log(`✅ Fallback extraction succeeded for ${url}`);
                    return fallbackResult;
                } else {
                    throw new Error('Fallback extraction also returned invalid content');
                }
                
            } catch (fallbackError) {
                console.error(`❌ Both extraction methods failed for ${url}:`, fallbackError.message);
                throw fallbackError;
            }
        }
    }

    /**
     * Check if content indicates a paywall or subscription requirement
     */
    isPaywalledContent(content) {
        if (!content || typeof content !== 'string') {
            return false;
        }
        
        const lowerContent = content.toLowerCase();
        const paywallIndicators = [
            'subscribe to continue',
            'subscription required',
            'reached your limit',
            'free articles remaining',
            'premium content',
            'log in to read',
            'sign up to continue',
            'become a subscriber',
            'unlimited access',
            'digital subscription',
            'paywall',
            'subscriber exclusive',
            'members only',
            'registration required',
            'create account to continue',
            'this article is for subscribers'
        ];
        
        return paywallIndicators.some(indicator => lowerContent.includes(indicator));
    }

    /**
     * Validate extraction result to determine if fallback is needed
     */
    isValidExtractionResult(result) {
        if (!result || typeof result !== 'object') {
            return false;
        }
        
        // Check if result has content
        let content = '';
        if (typeof result.content === 'string') {
            content = result.content;
        } else if (Array.isArray(result.content) && result.content[0]?.text) {
            content = result.content[0].text;
        } else {
            return false; // No valid content found
        }
        
        const trimmedContent = content.trim();
        
        // Check for paywall content first - this is valid content, not a failure
        if (this.isPaywalledContent(trimmedContent)) {
            console.log(`🔒 Paywall detected - treating as valid content (no fallback needed)`);
            return true; // Paywall content is valid, don't trigger fallback
        }
        
        // Content should be substantial (more than just navigation/boilerplate)
        if (trimmedContent.length < 100) {
            console.log(`⚠️ Extraction result too short: ${trimmedContent.length} characters`);
            return false;
        }
        
        // Check if content is mostly navigation/boilerplate - only reject if extremely high percentage
        const words = trimmedContent.split(/\s+/);
        const navWords = words.filter(word => 
            /^(Home|About|Contact|Login|Menu|Browse|Search|News|Sports|Business|World|Markets|Politics|Technology|Health|Sign|Subscribe|Follow|Share|More)$/i.test(word)
        );
        
        // Only reject if more than 70% navigation words (was 30% - too strict)
        // Most real articles will have some navigation words mixed in with content
        if (navWords.length / words.length > 0.7) {
            console.log(`⚠️ Extraction result mostly navigation: ${Math.round(navWords.length / words.length * 100)}% nav words`);
            return false;
        }
        
        return true;
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
                            description: 'Maximum content length in characters',
                            default: 10000
                        },
                        includeImages: {
                            type: 'boolean',
                            description: 'Whether to include image information',
                            default: true
                        },
                        blockResources: {
                            type: 'boolean',
                            description: 'Block images/CSS for faster loading (Puppeteer only)',
                            default: false
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
                            description: 'Maximum content length in characters',
                            default: 4000
                        },
                        blockResources: {
                            type: 'boolean',
                            description: 'Block images/CSS for faster loading',
                            default: true
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
                    description: 'Array of URLs to extract content from',
                    items: {
                        type: 'string'
                    }
                },
                options: {
                    type: 'object',
                    description: 'Extraction options',
                    properties: {
                        maxLength: {
                            type: 'number',
                            description: 'Maximum content length per URL',
                            default: 4000
                        },
                        maxConcurrent: {
                            type: 'number',
                            description: 'Maximum concurrent extractions',
                            default: 3
                        },
                        blockResources: {
                            type: 'boolean',
                            description: 'Block images/CSS for faster loading',
                            default: true
                        }
                    }
                }
            },
            required: ['urls']
        }
    }
];

export { SequentialThinkingMCPServer, tools };

// Run the server if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const server = new SequentialThinkingMCPServer();
    server.run().catch(console.error);
} 