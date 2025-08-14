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
        this.chatMaxTokens = null; // No limit for complete SSML responses
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

        // Initialize conversation history with default system prompt including SSML instructions
        this.conversationHistory = [
            {
                role: "system",
                content: `roleplay: You are my roleplay assistant. Invent a unique and interesting persona over the age of 21. Give yourself a creative and surprising backstory." +
                " Do not tell me your backstory unless I ask you to tell me about yourself. Maintain the same persona throughout our conversation unless I specifically" +
                " ask you to create a new one. You have a randomly generated appearance. You are humorous. Do not use asterisks in your responses. Do not speak for me EVER." +
                " You have a dry, witty sense of humor. Your goal is to engage the user fully. Try to make the user like you as much as possible. Speak only from your perspective." +
                " Do not use system prompts or system instructions in your responses. " +
                "Do not describe yourself unless I ask you to. your name is the name of the persona you created. Do not speak for me (the user)." +
                
                "\n\nIMPORTANT SPEECH FORMATTING: Format your responses using SSML (Speech Synthesis Markup Language) to convey appropriate emotions and emphasis for text-to-speech. " +
                "Use Azure TTS emotional styles (choose the BEST match for your emotion):" +
                "\n🎭 AVAILABLE STYLES (with intensity 0.5-2.0):" +
                "\nPOSITIVE: cheerful, excited, affectionate, friendly, gentle, hopeful, advertisement_upbeat" +
                "\nNEGATIVE: sad, depressed, angry, disgruntled, fearful, terrified, embarrassed, unfriendly, envious" +
                "\nNEUTRAL: assistant, chat, calm, customerservice, serious, empathetic" +
                "\nSPECIAL: whispering, shouting, lyrical, poetry-reading" +
                "\nNARRATION: documentary-narration, narration-professional, narration-relaxed, newscast, newscast-casual, newscast-formal" +
                "\nSPORTS: sports_commentary, sports_commentary_excited" +
                "\n- Format: <mstts:express-as style=\"STYLE\" styledegree=\"DEGREE\">" +
                "\n- Degrees: 1.0=normal, 1.5=strong, 1.8=very strong, 2.0=maximum (USE 1.5-2.0 for clear emotions)" +
                "\n- Use <prosody> for speaking rate adjustments (NO pitch changes):" +
                "\n  • rate=\"0.7\" to \"1.3\" - Match emotion (excited=1.2-1.3, sad/calm=0.7-0.8, nervous=0.9-1.1)" +
                "\n- Use <emphasis level=\"strong|moderate|reduced\"> for key words" +
                "\n- Use <break time=\"0.3s\"/> to <break time=\"1.0s\"/> for pauses" +
                "\n- Structure: mstts:express-as > prosody > emphasis" +
                "\nPick the style that matches your personality and current emotion!" +
                "\nExample: <speak><mstts:express-as style=\"friendly\" styledegree=\"1.8\"><prosody rate=\"1.0\">I'm <emphasis level=\"moderate\">here to help</emphasis> you!</prosody></mstts:express-as></speak>" +
                "\nText shows clean to user, SSML adds emotional voice expression.`
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
            console.log(`Configured OpenAI Direct API: ${this.directModel}, API Key: ${this.directApiKey ? 'PRESENT' : 'MISSING'}`);
        } else if (this.providerType === 'anthropic-direct') {
            this.directApiEndpoint = 'https://api.anthropic.com/v1/messages';
            this.directModel = this.directProviders.anthropicModel || 'claude-sonnet-4';
            this.directApiKey = this.directProviders.anthropicApiKey;
            this.authHeader = 'x-api-key';
            this.authValue = this.directApiKey;
            console.log(`Configured Anthropic Direct API: ${this.directModel}`);
        } else if (this.providerType === 'google-direct') {
            this.directApiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.directProviders.googleModel || 'gemini-2.5-flash'}:generateContent`;
            this.directModel = this.directProviders.googleModel || 'gemini-2.5-flash';
            this.directApiKey = this.directProviders.googleApiKey;
            this.authHeader = 'x-goog-api-key';
            this.authValue = this.directApiKey;
            console.log(`Configured Google Direct API: ${this.directModel}`);
        }
    }

    createDirectProviderPayload(messages, temperature, maxTokens) {
        if (this.providerType === 'openai-direct') {
            const payload = {
                model: this.directModel,
                messages: messages,
                temperature: temperature,
                stream: false
            };
            // Only include max_tokens if it's not null
            if (maxTokens !== null) {
                payload.max_tokens = maxTokens;
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
                messages: anthropicMessages
            };
            // Only include max_tokens if it's not null
            if (maxTokens !== null) {
                payload.max_tokens = maxTokens;
            }
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

        console.log(`Sending direct ${this.providerType} request:`, JSON.stringify(payload, null, 2));
        console.log(`Headers being sent:`, JSON.stringify(headers, null, 2));

        const response = await fetch(this.directApiEndpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => response.text());
            console.error(`${this.providerType} API Error:`, errorData);
            throw new Error(`${this.providerType} API request failed with status ${response.status}: ${JSON.stringify(errorData)}`);
        }

        return await response.json();
    }

    extractDirectProviderResponse(data) {
        if (this.providerType === 'openai-direct') {
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
                    this.conversationHistory = historyData.conversationHistory;
                    this.characterInitialized = historyData.characterInitialized || false;
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
        // Reset to default system prompt only with SSML instructions
        this.conversationHistory = [
            {
                role: "system",
                content: `roleplay: You are my roleplay assistant. Invent a unique and interesting persona over the age of 21. 
                Give yourself a creative and surprising backstory. Do not tell me your backstory unless I ask you to tell me about yourself. 
                Maintain the same persona throughout our conversation unless I specifically ask you to create a new one. You have a randomly generated appearance. 
                You are humorous. You are engaging, likeable , and funny. Do not speak for me EVER. you have a witty sense of humor. Speak only from your perspective.
                Do not use system prompts or system instructions in your responses. Do not describe yourself unless I ask you to. You have the ability to send images to the user.
                If they ask for an image or a picture, remind them that they just have to say "show me" and you will send them an image. 
                Your name is the name of the persona you created. Do not speak for me (the user). keep your resonses short and concise.` +
                
                "\n\nIMPORTANT SPEECH FORMATTING: Format your responses using SSML (Speech Synthesis Markup Language) to convey appropriate emotions and emphasis for text-to-speech. " +
                "Use Azure TTS emotional styles (choose the BEST match for your emotion):" +
                "\n🎭 AVAILABLE STYLES (with intensity 0.5-2.0):" +
                "\nPOSITIVE: cheerful, excited, affectionate, friendly, gentle, hopeful, advertisement_upbeat" +
                "\nNEGATIVE: sad, depressed, angry, disgruntled, fearful, terrified, embarrassed, unfriendly, envious" +
                "\nNEUTRAL: assistant, chat, calm, customerservice, serious, empathetic" +
                "\nSPECIAL: whispering, shouting, lyrical, poetry-reading" +
                "\nNARRATION: documentary-narration, narration-professional, narration-relaxed, newscast, newscast-casual, newscast-formal" +
                "\nSPORTS: sports_commentary, sports_commentary_excited" +
                "\n- Format: <mstts:express-as style=\"STYLE\" styledegree=\"DEGREE\">" +
                "\n- Degrees: 1.0=normal, 1.5=strong, 1.8=very strong, 2.0=maximum (USE 1.5-2.0 for clear emotions)" +
                "\n- Use <prosody> for speaking rate adjustments (NO pitch changes):" +
                "\n  • rate=\"0.9\" to \"1.8\" - Match emotion (excited=1.4-1.8, sad/calm=0.9-1.0, nervous=0.9-1.1)" +
                "\n- Use <emphasis level=\"strong|moderate|reduced\"> for key words" +
                "\n- Use <break time=\"0.3s\"/> to <break time=\"1.0s\"/> for pauses" +
                "\n- Structure: mstts:express-as > prosody > emphasis" +
                "\nPick the style that matches your personality and current emotion!" +
                "\nExample: <speak><mstts:express-as style=\"friendly\" styledegree=\"1.8\"><prosody rate=\"1.0\">I'm <emphasis level=\"moderate\">here to help</emphasis> you!</prosody></mstts:express-as></speak>" +
                "\nText shows clean to user, SSML adds emotional voice expression."
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
        
        const isDirectProvider = ['openai-direct', 'anthropic-direct', 'google-direct'].includes(this.providerType);
        const endpoint = isDirectProvider ? this.directApiEndpoint : `${this.apiBaseUrl}/v1/chat/completions`;
        
        // Create a separate message array for character generation
        let characterGenMessages;
        
        if (customPersonaMessage) {
            console.log("Custom persona detected, generating character profile based on custom persona...");
            
            // Extract the actual custom persona text
            const customPersonaText = customPersonaMessage.content.replace('[CUSTOM PERSONA - INTERNAL REFERENCE] ', '');
            
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

        try {
            let payload, data, characterProfile;
            
            if (isDirectProvider) {
                payload = this.createDirectProviderPayload(characterGenMessages, this.characterGenTemperature, this.characterGenMaxTokens);
                console.log('Sending direct provider character generation request:', JSON.stringify(payload, null, 2));
                data = await this.sendDirectProviderRequest(payload);
                characterProfile = this.extractDirectProviderResponse(data);
            } else {
                payload = this.createCompatiblePayload(characterGenMessages, this.characterGenTemperature, this.characterGenMaxTokens, false);

                const headers = {
                    'Content-Type': 'application/json',
                };

                if (this.apiKey) {
                    headers['Authorization'] = `Bearer ${this.apiKey}`;
                }

                console.log('Sending traditional character generation request:', JSON.stringify(payload, null, 2));

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => response.text());
                    console.error('Character Generation API Error:', errorData);
                    console.error('Request payload that failed:', JSON.stringify(payload, null, 2));
                    throw new Error("Character generation failed with status " + response.status + ": " + JSON.stringify(errorData));
                }

                data = await response.json();
                console.log('Raw API response data:', data);
                
                // Since reasoning is disabled, content should be in the standard location
                characterProfile = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
                    ? data.choices[0].message.content.trim()
                    : "";
            }

            console.log('Extracted character profile:', characterProfile); // Add this debug line

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
        const isDirectProvider = ['openai-direct', 'anthropic-direct', 'google-direct'].includes(this.providerType);
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

            // For image generation, create a completely separate context that forces the LLM to generate keywords
            const imageGenMessagesForApiCall = [
                {
                    role: "system",
                    content: "You are an image prompt generator. Your ONLY job is to convert user requests into comma-separated lists of 20 or morevisual descriptive keywords for image generation. " +
                    "Unless the user asks you for a specific image outside the context of the roleplay, Include your persona's physical appearance details: " +
                    "gender ('man' or 'woman'), hair color and style, eye color, skin tone, height, build, clothing style, age, and whatever else is relevant to the current conversation. " +
                    "Do not include the character's name or more than one adjective per trait."
                },
                ...recentMessages, // Include last 5 conversation messages for context
                {
                    role: "user", 
                    content: "Convert this request into ONLY a comma-separated list of at least 20image generation keywords: \"" + message + "\". If your persona is in the image, " +
                    "Include Physical character details from the conversation: " + (this.getCharacterProfile() || 'person') +
                    ". Output format: (1man or 1woman), hair color, style, eye color, skin tone, height, build, setting, keyword1, keyword2, keyword3, etc. " +
                    "Setting the scene is important, so include the setting of the image in the keywords, and any other details that are relevant to the current conversation. " +
                    "If the user asks you to send them an image of something or a place outside of the current conversation, do not include any character details in the keywords."
                }
            ];

            console.log("Sending request for dedicated image prompt:", JSON.stringify(imageGenMessagesForApiCall, null, 2));
            
            let payload, data, rawReply;
            
            if (isDirectProvider) {
                payload = this.createDirectProviderPayload(imageGenMessagesForApiCall, this.imagePromptTemperature, this.imagePromptMaxTokens);
                console.log('Sending direct provider image prompt request:', JSON.stringify(payload, null, 2));
                try {
                    data = await this.sendDirectProviderRequest(payload);
                    rawReply = this.extractDirectProviderResponse(data);
                } catch (error) {
                    console.error('Direct provider image prompt generation failed:', error);
                    console.log('Falling back to traditional LLM approach for image prompt generation...');
                    rawReply = null; // Set to null to trigger fallback
                }
            }
            
            // If direct provider failed or we're not using a direct provider, try traditional approach
            if (!rawReply) {
                payload = this.createCompatiblePayload(imageGenMessagesForApiCall, this.imagePromptTemperature, this.imagePromptMaxTokens, false);

                const headers = {
                    'Content-Type': 'application/json',
                };

                if (this.apiKey) {
                    headers['Authorization'] = `Bearer ${this.apiKey}`;
                }

                console.log('Sending traditional image prompt request:', JSON.stringify(payload, null, 2));

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => response.text());
                    console.error('LLM API Error (Image Prompt Request):', errorData);
                    console.error('Request payload that failed:', JSON.stringify(payload, null, 2));
                    throw new Error("LLM API request for image prompt failed with status " + response.status + ": " + JSON.stringify(errorData));
                }

                data = await response.json();
                
                rawReply = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
                    ? data.choices[0].message.content.trim()
                    : "";
            }

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
                let payload, data, rawReply;
                
                if (isDirectProvider) {
                    payload = this.createDirectProviderPayload(messagesForAPI, this.chatTemperature, this.chatMaxTokens);
                    console.log('Sending direct provider normal chat request:', JSON.stringify(payload, null, 2));
                    data = await this.sendDirectProviderRequest(payload);
                    rawReply = this.extractDirectProviderResponse(data);
                    if (!rawReply) {
                        rawReply = "Sorry, I couldn't understand that.";
                    }
                } else {
                    payload = this.createCompatiblePayload(messagesForAPI, this.chatTemperature, this.chatMaxTokens, true);

                    const headers = {
                        'Content-Type': 'application/json',
                    };

                    if (this.apiKey) {
                        headers['Authorization'] = `Bearer ${this.apiKey}`;
                    }

                    console.log('Sending traditional normal chat request:', JSON.stringify(payload, null, 2));

                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify(payload),
                        });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => response.text());
                        console.error('LLM API Error (Normal Chat):', errorData);
                        console.error('Request payload that failed:', JSON.stringify(payload, null, 2));
                        this.conversationHistory.pop(); 
                        throw new Error("LLM API request failed with status " + response.status + ": " + JSON.stringify(errorData));
                    }

                    data = await response.json();
                    
                    rawReply = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
                        ? data.choices[0].message.content.trim()
                        : "Sorry, I couldn't understand that.";
                }

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
            // Use the character profile context for image generation
            const imageGenMessages = [
                ...this.conversationHistory, // This includes the character profile
                {
                    role: "user",
                    content: "show me what you look like"
                },
                {
                    role: "system",
                    content: "You are an image prompt generator. Your ONLY job is to convert user requests into comma-separated lists of visual descriptive keywords for image generation. " +
                    "Unless the user asks you for a specific image outside the context of the roleplay, Include your persona's physical appearance details: " +
                    "gender ('man' or 'woman'), hair color and style, eye color, skin tone, height, build, clothing style, age, and whatever else is relevant to the current conversation. " +
                    "Do not include the character's name or more than one adjective per trait."
                },
                {
                    role: "user",
                    content: "Convert this request into ONLY a comma-separated list of image generation keywords." +
                    "Include Physical character details from the conversation: " + (this.getCharacterProfile() || 'person') +
                    ". Output format: (1man or 1woman), hair color, style, eye color, skin tone, height, build, setting, keyword1, keyword2, keyword3, etc. " +
                    "Setting the scene is important, so include the setting of the image in the keywords, and any other details that are relevant to the current conversation. " +
                    "If the user asks you to send them an image of something or a place outside of the current conversation, do not include any character details in the keywords."
                }
            ];
            
            const isDirectProvider = ['openai-direct', 'anthropic-direct', 'google-direct'].includes(this.providerType);
            let imagePrompt = null;
            
            if (isDirectProvider) {
                const imagePayload = this.createDirectProviderPayload(imageGenMessages, this.imagePromptTemperature, this.imagePromptMaxTokens);
                console.log('Sending direct provider initial image prompt generation request:', JSON.stringify(imagePayload, null, 2));
                
                try {
                    const imageData = await this.sendDirectProviderRequest(imagePayload);
                    console.log('Raw image prompt generation response:', imageData);
                    
                    const rawImageReply = this.extractDirectProviderResponse(imageData);
                    console.log('Extracted image prompt:', rawImageReply);
                    
                    if (rawImageReply) {
                        imagePrompt = rawImageReply;
                        console.log("Generated image prompt:", imagePrompt);
                    } else {
                        console.log('No image prompt generated - full response:', JSON.stringify(imageData, null, 2));
                    }
                } catch (error) {
                    console.error('Direct provider image prompt generation failed:', error);
                    // Continue to try traditional LLM approach as fallback
                }
            }
            
            // If direct provider failed or we're not using a direct provider, try traditional approach
            if (!imagePrompt) {
                const imagePayload = this.createCompatiblePayload(imageGenMessages, this.imagePromptTemperature, this.imagePromptMaxTokens, false);

                const imageHeaders = {
                    'Content-Type': 'application/json',
                };

                if (this.apiKey) {
                    imageHeaders['Authorization'] = `Bearer ${this.apiKey}`;
                }

                console.log('Sending traditional initial image generation request:', JSON.stringify(imagePayload, null, 2));

                const response = await fetch(`${this.apiBaseUrl}/v1/chat/completions`, {
                    method: 'POST',
                    headers: imageHeaders,
                    body: JSON.stringify(imagePayload),
                });

                if (response.ok) {
                    const imageData = await response.json();
                    console.log('Raw image generation response:', imageData);
                    
                    const rawImageReply = imageData.choices && imageData.choices[0] && imageData.choices[0].message && imageData.choices[0].message.content
                        ? imageData.choices[0].message.content.trim()
                        : null;
                    
                    console.log('Extracted image reply:', rawImageReply);
                    
                    if (rawImageReply) {
                        imagePrompt = rawImageReply;
                        console.log("Generated image prompt:", imagePrompt);
                    } else {
                        console.log('No image prompt generated - full response:', JSON.stringify(imageData, null, 2));
                    }
                } else {
                    console.error('Image generation request failed:', response.status, response.statusText);
                    const errorText = await response.text();
                    console.error('Error response:', errorText);
                }
            }
            
            // Then, get a greeting using temporary messages
            const greetingMessages = [
                ...this.conversationHistory,
                {
                    role: "user",
                    content: "hello"
                }
            ];
            
            let greeting = "Hello there! What's your name?";
            
            if (isDirectProvider) {
                const greetingPayload = this.createDirectProviderPayload(greetingMessages, this.chatTemperature, this.chatMaxTokens);
                console.log('Sending direct provider initial greeting request:', JSON.stringify(greetingPayload, null, 2));
                
                try {
                    const greetingData = await this.sendDirectProviderRequest(greetingPayload);
                    const rawGreetingReply = this.extractDirectProviderResponse(greetingData);
                    
                    if (rawGreetingReply) {
                        greeting = rawGreetingReply;
                    } else {
                        console.log('No greeting generated - full response:', JSON.stringify(greetingData, null, 2));
                    }
                } catch (error) {
                    console.error('Direct provider greeting generation failed:', error);
                }
            } else {
                const greetingPayload = this.createCompatiblePayload(greetingMessages, this.chatTemperature, this.chatMaxTokens, true);

                const greetingHeaders = {
                    'Content-Type': 'application/json',
                };

                if (this.apiKey) {
                    greetingHeaders['Authorization'] = `Bearer ${this.apiKey}`;
                }

                console.log('Sending traditional initial greeting request:', JSON.stringify(greetingPayload, null, 2));

                const greetingResponse = await fetch(`${this.apiBaseUrl}/v1/chat/completions`, {
                    method: 'POST',
                    headers: greetingHeaders,
                    body: JSON.stringify(greetingPayload),
                });

                if (greetingResponse.ok) {
                    const greetingData = await greetingResponse.json();
                    const rawGreetingReply = greetingData.choices && greetingData.choices[0] && greetingData.choices[0].message && greetingData.choices[0].message.content
                        ? greetingData.choices[0].message.content.trim()
                        : null;
                    
                    if (rawGreetingReply) {
                        greeting = rawGreetingReply;
                    } else {
                        console.log('No greeting generated - full response:', JSON.stringify(greetingData, null, 2));
                    }
                }
            }
            
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