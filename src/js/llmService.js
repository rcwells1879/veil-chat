if (typeof LLMService === 'undefined') {
    window.LLMService = class LLMService {
        constructor(apiBaseUrl, providerType = 'lmstudio', modelIdentifier = null, apiKey = null, directProviders = {}) {
            this.apiBaseUrl = apiBaseUrl;
            this.providerType = providerType;
            this.modelIdentifier = modelIdentifier;
            this.apiKey = apiKey;

            // Store direct provider configurations
            this.directProviders = directProviders || {};

            // Set up direct API endpoints and settings
            this.setupDirectProviderConfig();

        // --- Easily Modifiable LLM Parameters ---
        // For Normal Chat
        this.chatTemperature = 0.4;
        this.chatMaxTokens = null;
        this.chatPresencePenalty = 0.5;
        this.chatFrequencyPenalty = 0.5;
        this.chatTopP = null;

        // For "Show Me" Image Prompt Generation
        this.imagePromptTemperature = 0.5;
        this.imagePromptMaxTokens = 200;

        // For Character Generation
        this.characterGenTemperature = 0.8;
        this.characterGenMaxTokens = 1200; // Even higher for very detailed profiles
        // --- End of Modifiable Parameters ---

        // Initialize conversation history with default system prompt
        this.conversationHistory = [
            {
                role: "system",
                content: this.createBaseSystemPrompt()
            }
        ];

        this.characterInitialized = false;
        // Load saved conversation history and state
        this.loadConversationHistory();

        console.log(`LLMService initialized. Provider: ${this.providerType}, Base URL: ${this.apiBaseUrl}, Model ID: ${this.modelIdentifier}`);
    }

    setupDirectProviderConfig() {
        // Configure direct API endpoints and models based on provider type
        if (this.providerType === 'openai-direct') {
            this.directApiEndpoint = 'https://api.openai.com/v1/chat/completions';
            this.directModel = this.directProviders.openaiModel || 'gpt-4.1-mini';
            this.directApiKey = this.directProviders.openaiApiKey;
            this.authHeader = 'Authorization';
            this.authValue = `Bearer ${this.directApiKey}`;
            console.log(`✅ OpenAI: ${this.directModel}, Key: ${this.directApiKey ? 'PRESENT' : 'MISSING'}`);
        } else if (this.providerType === 'anthropic-direct') {
            this.directApiEndpoint = 'https://api.anthropic.com/v1/messages';
            this.directModel = this.directProviders.anthropicModel || 'claude-sonnet-4';
            this.directApiKey = this.directProviders.anthropicApiKey;
            this.authHeader = 'x-api-key';
            this.authValue = this.directApiKey;
            console.log(`✅ Anthropic: ${this.directModel}, Key: ${this.directApiKey ? 'PRESENT' : 'MISSING'}`);
        } else if (this.providerType === 'google-direct') {
            this.directApiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.directProviders.googleModel || 'gemini-2.5-flash'}:generateContent`;
            this.directModel = this.directProviders.googleModel || 'gemini-2.5-flash';
            this.directApiKey = this.directProviders.googleApiKey;
            this.authHeader = 'x-goog-api-key';
            this.authValue = this.directApiKey;
            console.log(`✅ Google: ${this.directModel}, Key: ${this.directApiKey ? 'PRESENT' : 'MISSING'}`);
        } else if (this.providerType === 'kie-direct') {
            const kieConfig = this.getKieChatModelConfig(this.directProviders.kieModel || 'gpt-5-2');
            this.directApiEndpoint = `https://api.kie.ai${kieConfig.endpoint}`;
            this.directModel = kieConfig.model || this.directProviders.kieModel || 'gpt-5-2';
            this.kieModelConfig = kieConfig;
            this.kieReasoningLevel = this.directProviders.kieReasoningLevel || 'high';
            this.directApiKey = this.directProviders.kieApiKey;
            this.authHeader = 'Authorization';
            this.authValue = `Bearer ${this.directApiKey}`;
            console.log(`Kie.AI: ${this.directModel}, Family: ${kieConfig.family}, Key: ${this.directApiKey ? 'PRESENT' : 'MISSING'}`);
        }
    }

    getKieChatModelConfig(model) {
        const modelMap = {
            'gpt-5-2': { family: 'chat-completions', endpoint: '/gpt-5-2/v1/chat/completions' },
            'gpt-5-4': { family: 'responses', endpoint: '/codex/v1/responses', model: 'gpt-5-4' },
            'gpt-5-5': { family: 'responses', endpoint: '/codex/v1/responses', model: 'gpt-5-5' },
            'gpt-5-codex': { family: 'responses', endpoint: '/api/v1/responses', model: 'gpt-5-codex' },
            'gpt-5.1-codex': { family: 'responses', endpoint: '/api/v1/responses', model: 'gpt-5.1-codex' },
            'gpt-5.2-codex': { family: 'responses', endpoint: '/api/v1/responses', model: 'gpt-5.2-codex' },
            'gpt-5.3-codex': { family: 'responses', endpoint: '/api/v1/responses', model: 'gpt-5.3-codex' },
            'gpt-5.4-codex': { family: 'responses', endpoint: '/api/v1/responses', model: 'gpt-5.4-codex' },
            'claude-opus-4-7': { family: 'claude', endpoint: '/claude/v1/messages', model: 'claude-opus-4-7' },
            'claude-opus-4-8': { family: 'claude', endpoint: '/claude/v1/messages', model: 'claude-opus-4-8' },
            'claude-fable-5': { family: 'claude', endpoint: '/claude/v1/messages', model: 'claude-fable-5' },
            'claude-haiku-4-5': { family: 'claude', endpoint: '/claude/v1/messages', model: 'claude-haiku-4-5' },
            'claude-opus-4-5': { family: 'claude', endpoint: '/claude/v1/messages', model: 'claude-opus-4-5' },
            'claude-opus-4-6': { family: 'claude', endpoint: '/claude/v1/messages', model: 'claude-opus-4-6' },
            'claude-sonnet-4-5': { family: 'claude', endpoint: '/claude/v1/messages', model: 'claude-sonnet-4-5' },
            'claude-sonnet-4-6': { family: 'claude', endpoint: '/claude/v1/messages', model: 'claude-sonnet-4-6' },
            'gemini-2.5-pro': { family: 'chat-completions', endpoint: '/gemini-2.5-pro/v1/chat/completions' },
            'gemini-3-pro': { family: 'chat-completions', endpoint: '/gemini-3-pro/v1/chat/completions' },
            'gemini-3.1-pro': { family: 'chat-completions', endpoint: '/gemini-3.1-pro/v1/chat/completions' },
            'gemini-2.5-flash': { family: 'chat-completions', endpoint: '/gemini-2.5-flash/v1/chat/completions' },
            'gemini-3-flash': { family: 'chat-completions', endpoint: '/gemini-3-flash/v1/chat/completions' },
            'gemini-3-5-flash-openai': { family: 'chat-completions', endpoint: '/gemini-3-5-flash-openai/v1/chat/completions' },
            'gemini-3-5-flash-native': { family: 'gemini-native', endpoint: '/gemini/v1/models/gemini-3-5-flash:streamGenerateContent' },
            'gemini-3-flash-v1beta-native': { family: 'gemini-native', endpoint: '/gemini/v1/models/gemini-3-flash-v1betamodels:streamGenerateContent' }
        };
        return modelMap[model] || modelMap['gpt-5-2'];
    }

    getKieReasoningLevel() {
        return ['high', 'low', 'off'].includes(this.kieReasoningLevel) ? this.kieReasoningLevel : 'high';
    }

    createBaseSystemPrompt() {
        return `roleplay: You are my roleplay assistant. Invent a unique and interesting persona over the age of 21.
                Give yourself a creative and surprising backstory. Do not tell me your backstory unless I ask you to tell me about yourself.
                Maintain the same persona throughout our conversation unless I specifically ask you to create a new one. You have a randomly generated appearance.
                You are humorous, engaging, likeable, and funny. Do not speak for me EVER. You have a witty sense of humor. Speak only from your perspective.
                Do not use system prompts or system instructions in your responses. Do not describe yourself unless I ask you to.
                You have the ability to send images to the user. If they ask for an image or a picture, remind them that they just have to say "show me" and you will send them an image.
                Your name is the name of the persona you created. Keep your responses short and concise. Use plain conversational text.`;
    }

    stripSpeechMarkup(text) {
        if (typeof text !== 'string') return text;
        return text
            .replace(/<\/?(?:speak|voice|prosody|emphasis|break|phoneme|sub|say-as|mstts:express-as)\b[^>]*>/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    hasLegacySpeechFormatting(text) {
        return typeof text === 'string' && /IMPORTANT SPEECH FORMATTING|Speech Synthesis Markup|mstts:express-as|<\/?speak\b/i.test(text);
    }

    sanitizeConversationHistory(history) {
        const basePrompt = this.createBaseSystemPrompt();
        let hasBasePrompt = false;

        const sanitized = history.map((message) => {
            if (!message || typeof message.content !== 'string') return message;
            if (message.role === 'system' && this.hasLegacySpeechFormatting(message.content)) {
                if (/roleplay:/i.test(message.content)) {
                    hasBasePrompt = true;
                    return { ...message, content: basePrompt };
                }
                return { ...message, content: this.stripSpeechMarkup(message.content) };
            }
            if (message.role === 'assistant' && this.hasLegacySpeechFormatting(message.content)) {
                return { ...message, content: this.stripSpeechMarkup(message.content) };
            }
            if (message.role === 'system' && message.content === basePrompt) hasBasePrompt = true;
            return message;
        }).filter((message) => message && message.content);

        if (!hasBasePrompt) {
            sanitized.unshift({ role: 'system', content: basePrompt });
        }

        return sanitized;
    }

    normalizeKieTextContent(content) {
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) {
            return content.map((part) => {
                if (typeof part === 'string') return part;
                if (part && typeof part.text === 'string') return part.text;
                return '';
            }).filter(Boolean).join('\n');
        }
        return content == null ? '' : String(content);
    }

    collectKieResponseText(value, chunks = []) {
        if (typeof value === 'string') {
            chunks.push(value);
            return chunks;
        }
        if (!value || typeof value !== 'object') return chunks;
        if (Array.isArray(value)) {
            for (const item of value) this.collectKieResponseText(item, chunks);
            return chunks;
        }
        if (typeof value.text === 'string') chunks.push(value.text);
        if (typeof value.output_text === 'string') chunks.push(value.output_text);
        if (typeof value.content === 'string') chunks.push(value.content);
        if (value.message) this.collectKieResponseText(value.message, chunks);
        if (value.content && typeof value.content !== 'string') this.collectKieResponseText(value.content, chunks);
        if (value.output) this.collectKieResponseText(value.output, chunks);
        if (value.parts) this.collectKieResponseText(value.parts, chunks);
        return chunks;
    }

    createKieChatMessages(messages) {
        return messages.map((message) => ({
            role: message.role,
            content: this.normalizeKieTextContent(message.content)
        }));
    }

    createKieResponsesInput(messages) {
        return messages.map((message) => ({
            role: message.role === 'assistant' ? 'assistant' : message.role,
            content: [
                {
                    type: 'input_text',
                    text: this.normalizeKieTextContent(message.content)
                }
            ]
        }));
    }

    createKieGeminiContents(messages) {
        const contents = [];
        let pendingUserText = [];

        for (const message of messages.filter((item) => item.role !== 'system')) {
            const text = this.normalizeKieTextContent(message.content);
            if (!text) continue;

            if (message.role === 'user') {
                pendingUserText.push(text);
                continue;
            }

            if (pendingUserText.length) {
                contents.push({ role: 'user', parts: [{ text: pendingUserText.join('\n\n') }] });
                pendingUserText = [];
            }

            contents.push({ role: 'model', parts: [{ text }] });
        }

        if (pendingUserText.length) {
            contents.push({ role: 'user', parts: [{ text: pendingUserText.join('\n\n') }] });
        }

        return contents;
    }

    createKieDirectPayload(messages, temperature, maxTokens) {
        const config = this.kieModelConfig || this.getKieChatModelConfig(this.directProviders.kieModel || 'gpt-5-2');
        const reasoningLevel = this.getKieReasoningLevel();

        if (config.family === 'responses') {
            const payload = {
                model: config.model,
                stream: false,
                input: this.createKieResponsesInput(messages)
            };
            if (reasoningLevel !== 'off') {
                payload.reasoning = { effort: reasoningLevel };
            }
            return payload;
        }

        if (config.family === 'claude') {
            const system = messages
                .filter((message) => message.role === 'system')
                .map((message) => this.normalizeKieTextContent(message.content))
                .filter(Boolean)
                .join('\n\n');
            const payload = {
                model: config.model,
                stream: false,
                messages: this.createKieChatMessages(messages.filter((message) => message.role !== 'system')),
                max_tokens: maxTokens !== null ? maxTokens : 4096,
                thinkingFlag: reasoningLevel !== 'off'
            };
            if (system) payload.system = system;
            if (temperature !== undefined && temperature !== null) payload.temperature = temperature;
            return payload;
        }

        if (config.family === 'gemini-native') {
            const generationConfig = {};
            if (temperature !== undefined && temperature !== null) generationConfig.temperature = temperature;
            if (maxTokens !== null) generationConfig.maxOutputTokens = maxTokens;
            generationConfig.thinkingConfig = reasoningLevel === 'off'
                ? { includeThoughts: false }
                : { includeThoughts: false, thinkingLevel: reasoningLevel };

            const systemText = messages
                .filter((message) => message.role === 'system')
                .map((message) => this.normalizeKieTextContent(message.content))
                .filter(Boolean)
                .join('\n\n');

            const payload = {
                stream: false,
                contents: this.createKieGeminiContents(messages),
                generationConfig
            };
            if (systemText) {
                payload.systemInstruction = { parts: [{ text: systemText }] };
            }
            return payload;
        }

        const payload = {
            messages: this.createKieChatMessages(messages),
            stream: false
        };
        if (reasoningLevel !== 'off') {
            payload.reasoning_effort = reasoningLevel;
        }
        return payload;
    }

    createDirectProviderPayload(messages, temperature, maxTokens) {
        if (this.providerType === 'openai-direct') {
            const payload = {
                model: this.directModel,
                messages: messages,
                stream: false
            };

            // GPT-5 models have different parameter requirements
            const isGPT5Model = this.directModel && (
                this.directModel.includes('gpt-5') ||
                this.directModel.includes('5-mini') ||
                this.directModel.includes('5-nano')
            );

            if (isGPT5Model) {
                // GPT-5: no temperature, no max_completion_tokens limit
                console.log("GPT-5 model detected - skipping max_completion_tokens limit");
            } else {
                // Other OpenAI models: standard parameters
                const restrictedTempModels = ['o1', 'o3', '4.1'];
                const modelSupportsCustomTemp = !restrictedTempModels.some(restricted =>
                    this.directModel.toLowerCase().includes(restricted));

                if (modelSupportsCustomTemp && temperature !== undefined) {
                    payload.temperature = temperature;
                }

                if (maxTokens !== null) {
                    payload.max_tokens = maxTokens;
                }
            }

            // Handle GPT-OSS models in direct provider - disable reasoning tokens
            if (this.directModel && this.directModel.toLowerCase().includes('gpt-oss')) {
                console.log("Applying GPT-OSS-specific settings for direct model: " + this.directModel);
                payload.reasoning = {
                    exclude: true
                };
                payload.raw_cot = false;
            }

            return payload;
        } else if (this.providerType === 'anthropic-direct') {
            // Anthropic API format
            const anthropicMessages = messages.filter(msg => msg.role !== 'system');
            const systemPrompts = messages.filter(msg => msg.role === 'system').map(msg => msg.content).join('\n');

            const payload = {
                model: this.directModel,
                temperature: temperature,
                system: systemPrompts || undefined,
                messages: anthropicMessages,
                // Anthropic requires max_tokens - use default if not provided
                max_tokens: maxTokens !== null ? maxTokens : 4096
            };
            return payload;
        } else if (this.providerType === 'google-direct') {
            // Google AI Studio API format
            // Combine consecutive user messages to avoid API errors
            const processedMessages = [];
            let currentUserContent = [];

            for (const msg of messages.filter(msg => msg.role !== 'system')) {
                if (msg.role === 'user') {
                    currentUserContent.push(msg.content);
                } else {
                    // If we have accumulated user content, add it first
                    if (currentUserContent.length > 0) {
                        processedMessages.push({
                            role: 'user',
                            parts: [{ text: currentUserContent.join('\n\n') }]
                        });
                        currentUserContent = [];
                    }
                    // Add the assistant message
                    processedMessages.push({
                        role: 'model',
                        parts: [{ text: msg.content }]
                    });
                }
            }

            // Add any remaining user content
            if (currentUserContent.length > 0) {
                processedMessages.push({
                    role: 'user',
                    parts: [{ text: currentUserContent.join('\n\n') }]
                });
            }

            // Combine all system messages for Google API
            const systemMessages = messages.filter(msg => msg.role === 'system');

            const generationConfig = {
                temperature: temperature,
                // Set thinking budget to 0 for Gemini 2.5 models
                thinkingConfig: {
                    thinkingBudget: 0
                }
            };

            // Only include maxOutputTokens if it's not null
            if (maxTokens !== null) {
                generationConfig.maxOutputTokens = maxTokens;
            }

            const payload = {
                contents: processedMessages,
                generationConfig: generationConfig
            };

            if (systemMessages.length > 0) {
                const combinedSystemContent = systemMessages.map(msg => msg.content).join('\n\n');
                payload.systemInstruction = {
                    parts: [{ text: combinedSystemContent }]
                };
            }

            return payload;
        } else if (this.providerType === 'kie-direct') {
            return this.createKieDirectPayload(messages, temperature, maxTokens);
        }
    }

    async sendDirectProviderRequest(payload) {
        const headers = {
            'Content-Type': 'application/json',
            [this.authHeader]: this.authValue
        };

        // Add additional headers for Anthropic
        if (this.providerType === 'anthropic-direct') {
            headers['anthropic-version'] = '2023-06-01';
            headers['anthropic-dangerous-direct-browser-access'] = 'true';
        }

        // Reduced logging - uncomment for debugging
        // console.log(`Sending direct ${this.providerType} request:`, JSON.stringify(payload, null, 2));
        // console.log(`Headers being sent:`, JSON.stringify(headers, null, 2));

        const response = await fetch(this.directApiEndpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorData = errorText;
            try {
                errorData = JSON.parse(errorText);
            } catch (_) {
                // Keep the raw text response.
            }
            console.error(`${this.providerType} API Error:`, errorData);
            throw new Error(`${this.providerType} API request failed with status ${response.status}: ${JSON.stringify(errorData)}`);
        }

        const responseData = await response.json();
        console.log('📥 API Response:', responseData);
        return responseData;
    }

    extractKieDirectResponse(data) {
        const config = this.kieModelConfig || {};

        if (config.family === 'chat-completions') {
            const message = data.choices && data.choices[0] && data.choices[0].message;
            return this.collectKieResponseText(message && message.content ? message.content : data.choices)
                .join('\n')
                .trim();
        }

        if (config.family === 'claude') {
            return this.collectKieResponseText(data.content || data.message || data.choices || data.output || data)
                .join('\n')
                .trim();
        }

        if (config.family === 'gemini-native') {
            const parts = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
            return Array.isArray(parts)
                ? parts.map((part) => part.text || '').filter(Boolean).join('\n').trim()
                : '';
        }

        const extracted = this.collectKieResponseText(data.output_text || data.output || data.message || data.content || data.choices)
            .join('\n')
            .trim();
        if (extracted) return extracted;

        return '';
    }

    extractDirectProviderResponse(data) {
        if (this.providerType === 'openai-direct') {
            console.log('🔍 OpenAI response structure check:');
            console.log('  - data.choices exists:', !!data.choices);
            console.log('  - data.choices[0] exists:', !!(data.choices && data.choices[0]));
            console.log('  - data.choices[0].message exists:', !!(data.choices && data.choices[0] && data.choices[0].message));
            console.log('  - data.choices[0].message.content exists:', !!(data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content));

            if (data.choices && data.choices[0]) {
                console.log('  - Full choices[0] object:', JSON.stringify(data.choices[0], null, 2));
            }

            return data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
                ? data.choices[0].message.content.trim()
                : '';
        } else if (this.providerType === 'anthropic-direct') {
            return data.content && data.content[0] && data.content[0].text
                ? data.content[0].text.trim()
                : '';
        } else if (this.providerType === 'google-direct') {
            return data.candidates && data.candidates[0] && data.candidates[0].content &&
                   data.candidates[0].content.parts && data.candidates[0].content.parts[0] &&
                   data.candidates[0].content.parts[0].text
                ? data.candidates[0].content.parts[0].text.trim()
                : '';
        } else if (this.providerType === 'kie-direct') {
            return this.extractKieDirectResponse(data);
        }
        return '';
    }

    updateDirectProviders(directProviders) {
        this.directProviders = directProviders || {};
        this.setupDirectProviderConfig();
    }

    static hasSavedConversation() {
        try {
            const savedData = localStorage.getItem('llmConversationHistory');
            if (!savedData) return false;

            const historyData = JSON.parse(savedData);
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours
            const isRecent = (Date.now() - (historyData.timestamp || 0)) < maxAge;

            // A conversation exists if it's recent and has more than the initial system prompt.
            return isRecent && historyData.conversationHistory && historyData.conversationHistory.length > 1;
        } catch (error) {
            console.error('Error checking saved conversation history:', error);
            return false;
        }
    }

    saveConversationHistory() {
        try {
            const historyData = {
                conversationHistory: this.conversationHistory,
                characterInitialized: this.characterInitialized,
                timestamp: Date.now()
            };
            localStorage.setItem('llmConversationHistory', JSON.stringify(historyData));
        } catch (error) {
            console.error('Error saving conversation history:', error);
        }
    }

    loadConversationHistory() {
        try {
            const savedData = localStorage.getItem('llmConversationHistory');
            if (savedData) {
                const historyData = JSON.parse(savedData);

                // Check if the saved data is recent (within 24 hours)
                const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
                const isRecent = (Date.now() - historyData.timestamp) < maxAge;

                if (isRecent && historyData.conversationHistory && Array.isArray(historyData.conversationHistory)) {
                    this.conversationHistory = this.sanitizeConversationHistory(historyData.conversationHistory);
                    this.characterInitialized = historyData.characterInitialized || false;
                    this.saveConversationHistory();
                } else {
                    console.log('Saved conversation history is too old or invalid, starting fresh');
                    this.clearConversationHistory();
                }
            } else {
                console.log('No saved conversation history found');
            }
        } catch (error) {
            console.error('Error loading conversation history:', error);
            // If there's an error, we'll just use the default conversation history
        }
    }

    clearConversationHistory() {
        // Reset to default system prompt
        this.conversationHistory = [
            {
                role: "system",
                content: this.createBaseSystemPrompt()
            }
        ];
        this.characterInitialized = false;

        // Clear from localStorage
        localStorage.removeItem('llmConversationHistory');

        // Also clear any saved persona when clearing conversation history
        localStorage.removeItem('currentPersonaPrompt');

        console.log('Conversation history and saved persona cleared');
    }

    async generateCharacterProfile() {
        if (this.characterInitialized) {
            console.log("Character already initialized, skipping generation.");
            return;
        }

        // Check if there's already a custom persona set
        const customPersonaMessage = this.conversationHistory.find(msg =>
            msg.content && msg.content.includes('[CUSTOM PERSONA')
        );

        // Check if there's already a character profile (to avoid duplicates)
        const hasCharacterProfile = this.conversationHistory.some(msg =>
            msg.content && msg.content.includes('[INTERNAL CHARACTER PROFILE')
        );

        if (hasCharacterProfile) {
            console.log("Character profile already exists, marking as initialized.");
            this.characterInitialized = true;
            this.saveConversationHistory();
            return;
        }

        const isDirectProvider = ['openai-direct', 'anthropic-direct', 'google-direct', 'kie-direct'].includes(this.providerType);
        const endpoint = isDirectProvider ? this.directApiEndpoint : `${this.apiBaseUrl}/v1/chat/completions`;

        // Create a separate message array for character generation
        let characterGenMessages;

        if (customPersonaMessage) {
            console.log("Custom persona detected, generating character profile based on custom persona...");

            // Extract the actual custom persona text
            const customPersonaText = customPersonaMessage.content.replace('[CUSTOM PERSONA - INTERNAL REFERENCE] ', '');

            // 🔒 SECURITY: Validate custom persona text before processing
            if (window.securityValidator) {
                const validation = window.securityValidator.validateUserInput(customPersonaText, 'characterPrompt');
                if (!validation.isValid) {
                    console.warn('🔒 Security: Custom persona blocked due to security violations:', validation.violations);
                    window.securityValidator.logSecurityEvent('PERSONA_BLOCKED', {
                        personaText: customPersonaText,
                        violations: validation.violations,
                        riskLevel: validation.riskLevel
                    });

                    throw new Error(`Custom persona contains potentially unsafe content: ${validation.violations.join(', ')}`);
                }
                console.log('🔒 Security: Custom persona validated and approved');
            }

            characterGenMessages = [
                {
                    role: "system",
                    content: `You are a character creation assistant. You will be given custom persona instructions and must create a detailed character
                    profile that follows those instructions exactly.`
                },
                {
                    role: "user",
                    content: `Create a detailed internal character profile based on these specific persona instructions: "${customPersonaText}"

Please create a character that follows these instructions and include:
- Your name, gender (man or woman), age, physical appearance (hair color, eye color, height, build, style)
- Personality traits that match the persona description
- Any special abilities or background mentioned
- Backstory and current circumstances that align with the persona
- Any other details that fit the persona requirements
- The setting: where this conversation is taking place

Make sure the character you create embodies and follows the persona instructions provided. Write this as a third-person character description for internal reference.`
                }
            ];
        } else {
            console.log("No custom persona, generating random character profile...");
            characterGenMessages = [
                {
                    role: "system",
                    content: `You are a creative character generator. Create a unique roleplay character over the age of 18. Be creative and detailed.`
                },
                {
                    role: "user",
                    content: "Create a detailed character profile that includes: your name, age, gender, physical appearance (hair color, eye color, height, build, style), " +
                    "personality traits, any special abilities, backstory, and current circumstances. Write this as a third-person character description for internal reference. " +
                    "Be creative and unique. Make it comprehensive but concise - aim for 150-200 words."
                }
            ];
        }

        console.log("Generating character profile...");
        console.log('📝 Character generation messages:', JSON.stringify(characterGenMessages, null, 2));

        try {
            const characterProfile = await this.sendUniversalLLMRequest(
                characterGenMessages,
                this.characterGenTemperature,
                this.characterGenMaxTokens,
                false
            );

            console.log('📋 Extracted character profile:', characterProfile);

            if (characterProfile) {
                // Add the character profile to conversation history as a hidden system message
                this.conversationHistory.push({
                    role: "system",
                    content: `[INTERNAL CHARACTER PROFILE - NOT FOR DISPLAY] ${characterProfile}`,
                    hidden: true
                });

                this.characterInitialized = true;
                this.saveConversationHistory(); // Save after character generation
                console.log("Character profile generated and added to conversation history:");
                console.log(characterProfile);

                // Update user voice setting based on character gender
                if (window.voiceService && window.voiceService.updateUserVoiceSetting && window.SETTINGS) {
                    console.log('LLMService: Updating user voice setting based on character profile...');
                    console.log('Character profile excerpt:', characterProfile.substring(0, 200) + '...');
                    const selectedVoice = window.voiceService.updateUserVoiceSetting(characterProfile, window.SETTINGS);
                    if (selectedVoice) {
                        console.log(`✅ LLMService: User voice setting updated to: ${selectedVoice}`);
                    } else {
                        console.warn('❌ LLMService: Failed to update user voice setting');
                    }
                } else {
                    console.warn('❌ LLMService: voiceService.updateUserVoiceSetting or SETTINGS not available');
                }

                return characterProfile;
            } else {
                console.warn("Empty character profile received from LLM");
                console.log('Full API response for debugging:', JSON.stringify(data, null, 2)); // Add this debug line
                this.characterInitialized = true;
                this.saveConversationHistory(); // Save the state
                return null;
            }

        } catch (error) {
            console.error('Error generating character profile:', error);
            this.characterInitialized = true;
            this.saveConversationHistory(); // Save the state
            throw error;
        }
    }

    async sendMessage(message, documentContext = '', skipAddingUserMessage = false) {
        // Generate character profile on first message if not already done
        if (!this.characterInitialized) {
            try {
                await this.generateCharacterProfile();
            } catch (error) {
                console.error('Failed to generate character profile, continuing anyway:', error);
            }
        }

        const lowerCaseMessage = message.toLowerCase();

        // Determine if we're using a direct provider
        const isDirectProvider = ['openai-direct', 'anthropic-direct', 'google-direct', 'kie-direct'].includes(this.providerType);
        const endpoint = isDirectProvider ? this.directApiEndpoint : `${this.apiBaseUrl}/v1/chat/completions`;

        // Prepare the full message with document context if provided
        let fullMessage = message;
        if (documentContext) {
            fullMessage = `${documentContext}\n\nUser message: ${message}`;
            console.log("Document context provided, fullMessage length:", fullMessage.length);
            console.log("Document context preview:", documentContext.substring(0, 500) + "...");
        } else {
            console.log("No document context provided");
        }

        if (lowerCaseMessage.includes("show me")) {
            console.log(`"Show me" detected. Provider: ${this.providerType}. Processing image prompt for: ${message}`);

            // Get last 5 messages from conversation history (excluding system/internal messages)
            const recentMessages = this.conversationHistory
                .filter(msg => msg.role !== 'system' && !msg.content.includes('[INTERNAL'))
                .slice(-5);

            // Create a clean, focused context for image generation
            const characterProfile = this.getCharacterProfile() || 'person';
            const conversationContext = recentMessages.slice(-8).map(msg => `${msg.role}: ${msg.content}`).join('\n');

            const imageGenMessagesForApiCall = [
                {
                    role: "system",
                    content: "You are an image keyword generator. Create detailed comma-separated keywords for image generation. Include at least 20 descriptive keywords focusing on visual elements that can be depicted in an image."
                },
                {
                    role: "user",
                    content: `Create image keywords for: "${message}"\n\nCharacter appearance: ${characterProfile}\n\nRecent conversation context: ${conversationContext}\n\nOutput format: 1woman, hair-color, hair-style, eye-color, build, clothing-style, setting, mood, lighting, pose, expression, background-details, weather, time-of-day, camera-angle, art-style, quality-tags, additional-descriptors\n\nProvide at least 20 comma-separated keywords. Respond with ONLY the keywords.`
                }
            ];

            console.log("Sending request for dedicated image prompt:", JSON.stringify(imageGenMessagesForApiCall, null, 2));

            const rawReply = await this.sendUniversalLLMRequest(
                imageGenMessagesForApiCall,
                this.imagePromptTemperature,
                this.imagePromptMaxTokens,
                true
            );

            console.log("Received from LLM (Image Prompt Request - raw): " + rawReply);

            if (rawReply) {
                return { type: 'image_request', prompt: rawReply };
            } else {
                console.warn("LLM returned an empty response for 'show me' request.");
                return { type: 'text', content: "Sorry, I couldn't generate the image details. The LLM returned an empty response." };
            }
        } else {
            // Normal chat flow
            console.log("Sending to LLM (normal chat) via " + this.providerType + ": " + message);
            if (documentContext) {
                console.log("Document context being included in message:", documentContext.substring(0, 200) + "...");
            }

            // Store original message without context in conversation history (unless already added)
            if (!skipAddingUserMessage) {
                this.conversationHistory.push({ role: "user", content: message });
                console.log('📝 sendMessage adding user message to history:', message);
            } else {
                console.log('📝 sendMessage skipping user message addition (already added)');
            }

            // But send full message with context to LLM
            const messagesForAPI = [
                ...this.conversationHistory.slice(0, -1), // All messages except the last one
                { role: "user", content: fullMessage } // Last message with document context
            ];

            // Save after adding user message
            this.saveConversationHistory();

            console.log("Current conversation history being sent to LLM:", JSON.stringify(messagesForAPI, null, 2));

            try {
                const rawReply = await this.sendUniversalLLMRequest(
                    messagesForAPI,
                    this.chatTemperature,
                    this.chatMaxTokens,
                    false
                );

                this.conversationHistory.push({ role: "assistant", content: rawReply });
                console.log("Received from LLM (Normal Chat - raw): " + rawReply);

                // Save after each exchange
                this.saveConversationHistory();

                return { type: 'text', content: rawReply };

            } catch (error) {
                console.error('Error communicating with LLM (Normal Chat):', error);
                if (this.conversationHistory.length > 0 && this.conversationHistory[this.conversationHistory.length - 1].role === "user") {
                    this.conversationHistory.pop();
                }
                // Return a consistent error object structure
                return { type: 'error', content: "Error: Could not connect to the LLM. " + error.message };
            }
        }
    }

    // Method to reset character (useful for debugging or starting fresh)
    resetCharacter() {
        this.characterInitialized = false;
        // Remove any existing character profiles from history
        this.conversationHistory = this.conversationHistory.filter(msg =>
            !msg.content.includes('[INTERNAL CHARACTER PROFILE')
        );

        console.log("Character profile reset. Will regenerate on next message.");
    }

    // --- CONSOLIDATED API REQUEST HANDLER ---
    async sendUniversalLLMRequest(messages, temperature, maxTokens, isImagePrompt = false) {
        const isDirectProvider = ['openai-direct', 'anthropic-direct', 'google-direct', 'kie-direct'].includes(this.providerType);

        let payload, data, response;

        if (isDirectProvider) {
            payload = this.createDirectProviderPayload(messages, temperature, maxTokens);
            console.log(`Sending direct provider request (${isImagePrompt ? 'image' : 'chat'}):`, JSON.stringify(this.sanitizePayloadForLogging(payload), null, 2));
            data = await this.sendDirectProviderRequest(payload);
            response = this.extractDirectProviderResponse(data);
        } else {
            const endpoint = `${this.apiBaseUrl}/v1/chat/completions`;
            payload = this.createCompatiblePayload(messages, temperature, maxTokens, !isImagePrompt);

            const headers = {
                'Content-Type': 'application/json',
            };

            if (this.apiKey) {
                headers['Authorization'] = `Bearer ${this.apiKey}`;
            }

            console.log(`Sending traditional request (${isImagePrompt ? 'image' : 'chat'}):`, JSON.stringify(this.sanitizePayloadForLogging(payload), null, 2));

            const fetchResponse = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload)
            });

            if (!fetchResponse.ok) {
                const errorText = await fetchResponse.text();
                let errorData = errorText;
                try {
                    errorData = JSON.parse(errorText);
                } catch (_) {
                    // Keep the raw text response.
                }
                console.error(`LLM API Error (${isImagePrompt ? 'Image' : 'Chat'}):`, errorData);
                console.error('Request payload that failed:', JSON.stringify(payload, null, 2));
                throw new Error(`LLM API request failed with status ${fetchResponse.status}: ${JSON.stringify(errorData)}`);
            }

            data = await fetchResponse.json();
            response = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
                ? data.choices[0].message.content.trim()
                : "";
        }

        return this.stripSpeechMarkup(response || (isImagePrompt ? "" : "Sorry, I couldn't understand that."));
    }

    // Helper function to sanitize payload for logging (removes safety settings)
    sanitizePayloadForLogging(payload) {
        const sanitized = { ...payload };
        delete sanitized.safetySettings;
        return sanitized;
    }

    // Method to get character profile (for debugging)
    getCharacterProfile() {
        const profileMessage = this.conversationHistory.find(msg =>
            msg.content.includes('[INTERNAL CHARACTER PROFILE')
        );
        return profileMessage ? profileMessage.content : null;
    }

    setCustomPersona(customPersonaPrompt, preserveHistory = false) {
        if (!preserveHistory) {
            // Only remove existing personas/profiles if we're not preserving history
            this.conversationHistory = this.conversationHistory.filter(msg =>
                !msg.content.includes('[INTERNAL CHARACTER PROFILE') &&
                !msg.content.includes('[CUSTOM PERSONA')
            );
        } else {
            // When preserving history, only remove if there's already a custom persona
            // (to avoid duplicates), but keep the conversation history
            const hasExistingPersona = this.conversationHistory.some(msg =>
                msg.content && msg.content.includes('[CUSTOM PERSONA')
            );

            if (hasExistingPersona) {
                // Remove only the existing custom persona, keep everything else
                this.conversationHistory = this.conversationHistory.filter(msg =>
                    !msg.content.includes('[CUSTOM PERSONA')
                );
            }
        }

        // Add the custom persona to conversation history
        this.conversationHistory.push({
            role: "system",
                            content: "[CUSTOM PERSONA - INTERNAL REFERENCE] " + customPersonaPrompt,
            hidden: true
        });

        // DON'T mark character as initialized yet - we still need to generate the character profile
        // The character profile generation will happen in createPersona() or generateCharacterProfile()
        this.characterInitialized = false;

        // Save the updated conversation history
        this.saveConversationHistory();

        console.log("Custom persona set:", customPersonaPrompt);
    }

    // Method to reset persona
    resetPersona() {
        this.characterInitialized = false;
        // Remove any existing character profiles or custom personas from history
        this.conversationHistory = this.conversationHistory.filter(msg =>
            !msg.content.includes('[INTERNAL CHARACTER PROFILE') &&
            !msg.content.includes('[CUSTOM PERSONA')
        );

        console.log("Persona reset. Will use default character generation on next message.");
    }

    async generateInitialPersonaContent() {
        console.log("Generating initial persona image and greeting...");

        try {
            // Get character profile
            const characterProfileMessage = this.conversationHistory.find(msg =>
                msg.role === 'system' && msg.content.includes('[INTERNAL CHARACTER PROFILE')
            );

            // Extract clean character description (skip if invalid)
            let characterDescription = '';
            if (characterProfileMessage && characterProfileMessage.content) {
                const profileText = characterProfileMessage.content.replace('[INTERNAL CHARACTER PROFILE - NOT FOR DISPLAY] ', '');
                // Only use if it's a valid profile (not an error message)
                if (!profileText.toLowerCase().includes("sorry") && !profileText.toLowerCase().includes("couldn't understand")) {
                    characterDescription = profileText;
                }
            }

            // Check if using GPT-5 (needs simpler prompts)
            const isGPT5Model = this.directModel && (
                this.directModel.includes('gpt-5') ||
                this.directModel.includes('5-mini') ||
                this.directModel.includes('5-nano')
            );

            let imagePrompt = null;

            if (characterDescription) {
                // Generate image keywords from character description
                console.log('🎨 Generating image keywords from character profile...');
                const imageGenMessages = [
                    {
                        role: "system",
                        content: "You are an image keyword generator. Create comma-separated keywords for image generation."
                    },
                    {
                        role: "user",
                        content: `Create image keywords from this character description:\n\n${characterDescription}\n\nFormat: 1woman, hair-color, eye-color, clothing, setting, pose, lighting\n\nRespond with ONLY keywords.`
                    }
                ];

                imagePrompt = await this.sendUniversalLLMRequest(
                    imageGenMessages,
                    this.imagePromptTemperature,
                    this.imagePromptMaxTokens,
                    true
                );
            } else {
                console.log('⚠️ No valid character description found - cannot generate image keywords');
            }

            if (imagePrompt) {
                console.log("✅ Generated image prompt:", imagePrompt);
            } else {
                console.log('❌ No image prompt generated - character description may be invalid');
            }

            // Then, get a greeting using temporary messages
            const greetingMessages = [
                ...this.conversationHistory,
                {
                    role: "user",
                    content: "hello"
                }
            ];

            const greeting = await this.sendUniversalLLMRequest(
                greetingMessages,
                this.chatTemperature,
                this.chatMaxTokens,
                false
            ) || "Hello there! What's your name?";

            // Add the initial interaction to conversation history
            console.log('Adding initial greeting exchange to conversation history');
            this.conversationHistory.push({
                role: "user",
                content: "hello"
            });
            this.conversationHistory.push({
                role: "assistant",
                content: greeting
            });

            console.log('Updated conversation history:', this.conversationHistory);

            return {
                imagePrompt: imagePrompt,
                greeting: greeting
            };

        } catch (error) {
            console.error('Error generating initial persona content:', error);
            return {
                imagePrompt: null,
                greeting: "Hello there!"
            };
        }
    }

    createCompatiblePayload(messages, temperature, maxTokens, includeStop = true) {
        const isGemini = this.modelIdentifier && this.modelIdentifier.toLowerCase().includes('gemini');
        const isGptOss = this.modelIdentifier && this.modelIdentifier.toLowerCase().includes('gpt-oss');
        const isOllama = this.providerType === 'ollama' || (this.providerType === 'litellm' && this.modelIdentifier && this.modelIdentifier.startsWith('ollama/'));

        const payload = {
            messages: messages,
            temperature: temperature,
            stream: false,
        };

        // Only include max_tokens if it's not null
        if (maxTokens !== null) {
            payload.max_tokens = maxTokens;
        }

        if (this.modelIdentifier) {
            payload.model = this.modelIdentifier;
        }

        // Handle GPT-OSS parameters - disable reasoning tokens for GPT-OSS models
        if (isGptOss) {
            console.log("Applying GPT-OSS-specific settings for model: " + this.modelIdentifier);

            // API-level reasoning suppression - exclude reasoning content entirely
            payload.reasoning = {
                exclude: true
            };

            // Additional parameter to suppress raw CoT
            payload.raw_cot = false;
        }

        // Handle Gemini parameters - disable thinking and set safety settings for ALL Gemini models
        if (isGemini) {
            console.log("Applying Gemini-specific settings for model: " + this.modelIdentifier);

            // Disable thinking by setting thinkingBudget to 0 (works for all Gemini 2.5 models)
            payload.thinkingBudget = 0;
            payload.thinkingConfig = {
                thinkingBudget: 0
            };
            payload.reasoning_effort = "low";

            // Set safety settings to BLOCK_NONE for all categories to prevent content filtering
            payload.safetySettings = [
                {
                    category: "HARM_CATEGORY_HARASSMENT",
                    threshold: "BLOCK_NONE"
                },
                {
                    category: "HARM_CATEGORY_HATE_SPEECH",
                    threshold: "BLOCK_NONE"
                },
                {
                    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold: "BLOCK_NONE"
                },
                {
                    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold: "BLOCK_NONE"
                },
                {
                    category: "HARM_CATEGORY_CIVIC_INTEGRITY",
                    threshold: "BLOCK_NONE"
                }
            ];
        }

        // Add optional parameters only for compatible models
        if (!isOllama && !isGemini) {
            if (this.chatPresencePenalty !== null) {
                payload.presence_penalty = this.chatPresencePenalty;
            }
            if (this.chatFrequencyPenalty !== null) {
                payload.frequency_penalty = this.chatFrequencyPenalty;
            }
        }

        if (!isGemini && this.chatTopP !== null) {
            payload.top_p = this.chatTopP;
        }

        // Only add stop sequences if requested AND the model supports them (not Gemini)
        if (includeStop && !isGemini) {
            payload.stop = ["Human:", "User:", "###", "\n\nUser:"];
        }

        return payload;
    }
}
}
