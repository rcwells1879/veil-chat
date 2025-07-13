if (typeof LLMService === 'undefined') {
    window.LLMService = class LLMService {
        constructor(apiBaseUrl, providerType = 'lmstudio', modelIdentifier = null, apiKey = null) {
            this.apiBaseUrl = apiBaseUrl;
            this.providerType = providerType;
            this.modelIdentifier = modelIdentifier;
        this.apiKey = apiKey;

        // --- Easily Modifiable LLM Parameters ---
        // For Normal Chat
        this.chatTemperature = 0.4;
        this.chatMaxTokens = 800;
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
                content: `roleplay: You are my roleplay assistant. Invent a unique and interesting persona over the age of 18. Give yourself a creative and surprising backstory. Do not tell me your backstory unless I ask you to tell me about yourself. Maintain the same persona throughout our conversation unless I specifically ask you to create a new one. You have a randomly generated appearance. You are humorous. Do not use asterisks in your responses. Do not speak for me EVER. you have a dry, witty sense of humor. Speak only from your perspective. Do not use system prompts or system instructions in your responses. Do not describe yourself unless I ask you to. your name is the name of the persona you created. Do not speak for me (the user). keep your resonses short and concise.`
            }
        ];
        
        this.characterInitialized = false;
        
        // Load saved conversation history and state
        this.loadConversationHistory();
        
        console.log(`LLMService initialized. Provider: ${this.providerType}, Base URL: ${this.apiBaseUrl}, Model ID: ${this.modelIdentifier}`);
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
        // Reset to default system prompt only
        this.conversationHistory = [
            {
                role: "system",
                content: `roleplay: You are my roleplay assistant. Invent a unique and interesting persona over the age of 18. 
                Give yourself a creative and surprising backstory. Do not tell me your backstory unless I ask you to tell me about yourself. 
                Maintain the same persona throughout our conversation unless I specifically ask you to create a new one. You have a randomly generated appearance. 
                You are humorous. Do not use asterisks in your responses. Do not speak for me EVER. you have a dry, witty sense of humor. Speak only from your perspective.
                Do not use system prompts or system instructions in your responses. Do not describe yourself unless I ask you to. You have the ability to send images to the user.
                If they ask for an image or a picture, remind them that they just have to say "show me" and you will send them an image. 
                Your name is the name of the persona you created. Do not speak for me (the user). keep your resonses short and concise.`
            }
        ];
        this.characterInitialized = false;
        
        // Clear from localStorage
        localStorage.removeItem('llmConversationHistory');
        
        // Also clear any saved persona when clearing conversation history
        localStorage.removeItem('currentPersonaPrompt');
        
        // Clear persona voice when clearing conversation history
        if (window.voiceService && window.voiceService.clearPersonaVoice) {
            window.voiceService.clearPersonaVoice();
            console.log("LLMService: Cleared persona voice on conversation history clear");
        }
        
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
        
        const endpoint = `${this.apiBaseUrl}/v1/chat/completions`;
        
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
- Your name, age, physical appearance (hair color, eye color, height, build, style)
- Personality traits that match the persona description
- Any special abilities or background mentioned
- Backstory and current circumstances that align with the persona
- Any other details that fit the persona requirements

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
                    content: "Create a detailed character profile that includes: your name, age, gender, physical appearance (hair color, eye color, height, build, style), personality traits, any special abilities, backstory, and current circumstances. Write this as a third-person character description for internal reference. Be creative and unique. Make it comprehensive but concise - aim for 150-200 words."
                }
            ];
        }

        console.log("Generating character profile...");

        try {
            const payload = this.createCompatiblePayload(characterGenMessages, this.characterGenTemperature, this.characterGenMaxTokens, false);

            const headers = {
                'Content-Type': 'application/json',
            };

            if (this.apiKey) {
                headers['Authorization'] = `Bearer ${this.apiKey}`;
            }

            console.log('Sending character generation request:', JSON.stringify(payload, null, 2));

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload),
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => response.text());
                console.error('Character Generation API Error:', errorData);
                console.error('Request payload that failed:', JSON.stringify(payload, null, 2));
                console.error('Request headers:', headers);
                throw new Error("Character generation failed with status " + response.status + ": " + JSON.stringify(errorData));
            }

            const data = await response.json();
            console.log('Raw API response data:', data);
            
            // Since reasoning is disabled, content should be in the standard location
            const characterProfile = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
                ? data.choices[0].message.content.trim()
                : "";

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
                
                // Set persona voice based on character gender
                if (window.voiceService && window.voiceService.setPersonaVoice) {
                    console.log('LLMService: Setting persona voice based on character profile...');
                    console.log('Character profile excerpt:', characterProfile.substring(0, 200) + '...');
                    const selectedVoice = window.voiceService.setPersonaVoice(characterProfile);
                    if (selectedVoice) {
                        console.log(`✅ LLMService: Persona voice automatically selected: ${selectedVoice}`);
                    } else {
                        console.warn('❌ LLMService: Failed to select persona voice');
                    }
                } else {
                    console.warn('❌ LLMService: voiceService.setPersonaVoice not available');
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
        const endpoint = `${this.apiBaseUrl}/v1/chat/completions`;        // Prepare the full message with document context if provided
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
            
            // For image generation, create a completely separate context that forces the LLM to generate keywords
            const imageGenMessagesForApiCall = [
                {
                    role: "system",
                                    content: "You are an image prompt generator. Your ONLY job is to convert user requests into comma-separated lists of visual descriptive keywords for image generation. " +
                    "Unless the user asks you for a specific image outside the context of the roleplay, Include the character's physical appearance details: " +
                    "gender, hair color and style, eye color, skin tone, height, build, clothing style, age, and whatever else is relevant to the current conversation. " +
                    "Do not include the character's name or more than one adjective per trait."
                },
                {
                    role: "user", 
                    content: "Convert this request into ONLY a comma-separated list of image generation keywords: \"" + message + "\". If your persona is in the image, " +
                    "Include Physical character details from the conversation: " + (this.getCharacterProfile() || 'person') + ". Output format: keyword1, keyword2, keyword3, etc. " +
                    "Setting the scene is important, so include the setting of the image in the keywords, and any other details that are relevant to the current conversation. " +
                    "If the user asks you to send them an image of something or a place outside of the current conversation, do not include any character details in the keywords."
                }
            ];

            console.log("Sending request for dedicated image prompt:", JSON.stringify(imageGenMessagesForApiCall, null, 2));
            
            const payload = this.createCompatiblePayload(imageGenMessagesForApiCall, this.imagePromptTemperature, this.imagePromptMaxTokens, false);

            const headers = {
                'Content-Type': 'application/json',
            };

            if (this.apiKey) {
                headers['Authorization'] = `Bearer ${this.apiKey}`;
            }

            console.log('Sending image prompt request:', JSON.stringify(payload, null, 2));

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload),
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => response.text());
                console.error('LLM API Error (Image Prompt Request):', errorData);
                console.error('Request payload that failed:', JSON.stringify(payload, null, 2));
                throw new Error("LLM API request for image prompt failed with status " + response.status + ": " + JSON.stringify(errorData));
            }

            const data = await response.json();
            
            const rawReply = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
                ? data.choices[0].message.content.trim()
                : "";

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
                const payload = this.createCompatiblePayload(messagesForAPI, this.chatTemperature, this.chatMaxTokens, true);

                const headers = {
                    'Content-Type': 'application/json',
                };

                if (this.apiKey) {
                    headers['Authorization'] = `Bearer ${this.apiKey}`;
                }

                console.log('Sending normal chat request:', JSON.stringify(payload, null, 2));

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(payload),
                    credentials: 'include'
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => response.text());
                    console.error('LLM API Error (Normal Chat):', errorData);
                    console.error('Request payload that failed:', JSON.stringify(payload, null, 2));
                    this.conversationHistory.pop(); 
                    throw new Error("LLM API request failed with status " + response.status + ": " + JSON.stringify(errorData));
                }

                const data = await response.json();
                
                const rawReply = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
                    ? data.choices[0].message.content.trim()
                    : "Sorry, I couldn't understand that.";

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
        
        // Clear persona voice when resetting character
        if (window.voiceService && window.voiceService.clearPersonaVoice) {
            window.voiceService.clearPersonaVoice();
            console.log("LLMService: Cleared persona voice on character reset");
        }
        
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
        
        // Clear any existing persona voice since we're setting a new persona
        if (window.voiceService && window.voiceService.clearPersonaVoice) {
            window.voiceService.clearPersonaVoice();
            console.log("LLMService: Cleared existing persona voice for new custom persona");
        }
        
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
        
        // Clear persona voice when resetting persona
        if (window.voiceService && window.voiceService.clearPersonaVoice) {
            window.voiceService.clearPersonaVoice();
            console.log("LLMService: Cleared persona voice on persona reset");
        }
        
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
                                    content: "Generate a comma-separated list of image prompt keywords based on the character profile. " +
                    "Output ONLY the comma-separated list."
                },
                {
                    role: "user",
                                    content: "Based on the character profile above, create a comma-separated list of visual keywords for image generation. " +
                    "Include the character's physical appearance details: gender, hair color and style, eye color, skin tone, height, build, clothing style, age"
                }
            ];
            
            const imagePayload = this.createCompatiblePayload(imageGenMessages, this.imagePromptTemperature, this.imagePromptMaxTokens, false);

            const imageHeaders = {
                'Content-Type': 'application/json',
            };

            if (this.apiKey) {
                imageHeaders['Authorization'] = `Bearer ${this.apiKey}`;
            }

            console.log('Sending initial image generation request:', JSON.stringify(imagePayload, null, 2));

            const response = await fetch(`${this.apiBaseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: imageHeaders,
                body: JSON.stringify(imagePayload),
                credentials: 'include'
            });

            let imagePrompt = null;
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
            
            // Then, get a greeting using temporary messages
            const greetingMessages = [
                ...this.conversationHistory,
                {
                    role: "user",
                    content: "hello"
                }
            ];
            
            const greetingPayload = this.createCompatiblePayload(greetingMessages, this.chatTemperature, this.chatMaxTokens, true);

            const greetingHeaders = {
                'Content-Type': 'application/json',
            };

            if (this.apiKey) {
                greetingHeaders['Authorization'] = `Bearer ${this.apiKey}`;
            }

            console.log('Sending initial greeting request:', JSON.stringify(greetingPayload, null, 2));

            const greetingResponse = await fetch(`${this.apiBaseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: greetingHeaders,
                body: JSON.stringify(greetingPayload),
                credentials: 'include'
            });

            let greeting = "Hello there! What's your name?";
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
            max_tokens: maxTokens,
            stream: false,
        };

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
        }        return payload;
    }
}
}