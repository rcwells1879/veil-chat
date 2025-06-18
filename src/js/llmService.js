class LLMService {
    constructor(apiBaseUrl, providerType = 'lmstudio', modelIdentifier = null, apiKey = null) {
        this.apiBaseUrl = apiBaseUrl;
        this.providerType = providerType;
        this.modelIdentifier = modelIdentifier;
        this.apiKey = apiKey;

        // --- Easily Modifiable LLM Parameters ---
        // For Normal Chat
        this.chatTemperature = 0.9;
        this.chatMaxTokens = 300;
        this.chatPresencePenalty = 0.5;
        this.chatFrequencyPenalty = 0.5;
        this.chatTopP = null;

        // For "Show Me" Image Prompt Generation
        this.imagePromptTemperature = 0.5;
        this.imagePromptMaxTokens = 150;
        
        // For Character Generation
        this.characterGenTemperature = 0.8;
        this.characterGenMaxTokens = 200;
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
        console.log(`Normal Chat Params: temp=${this.chatTemperature}, max_tokens=${this.chatMaxTokens}`);
        console.log(`Image Prompt Params: temp=${this.imagePromptTemperature}, max_tokens=${this.imagePromptMaxTokens}`);
        console.log(`Character Gen Params: temp=${this.characterGenTemperature}, max_tokens=${this.characterGenMaxTokens}`);
    }

    saveConversationHistory() {
        try {
            const historyData = {
                conversationHistory: this.conversationHistory,
                characterInitialized: this.characterInitialized,
                timestamp: Date.now()
            };
            localStorage.setItem('llmConversationHistory', JSON.stringify(historyData));
            console.log('Conversation history saved to localStorage');
        } catch (error) {
            console.error('Error saving conversation history:', error);
        }
    }

    loadConversationHistory() {
        try {
            const savedData = localStorage.getItem('llmConversationHistory');
            if (savedData) {
                const historyData = JSON.parse(savedData);
                
                // Check if the saved data is recent (within 24 hours) to avoid loading very old conversations
                const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
                const isRecent = (Date.now() - historyData.timestamp) < maxAge;
                
                if (isRecent && historyData.conversationHistory && Array.isArray(historyData.conversationHistory)) {
                    this.conversationHistory = historyData.conversationHistory;
                    this.characterInitialized = historyData.characterInitialized || false;
                    console.log('Loaded conversation history from localStorage:', this.conversationHistory.length, 'messages');
                } else {
                    console.log('Saved conversation history is too old or invalid, starting fresh');
                    this.clearConversationHistory();
                }
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
                content: `roleplay: You are my roleplay assistant. Invent a unique and interesting persona over the age of 18. Give yourself a creative and surprising backstory. Do not tell me your backstory unless I ask you to tell me about yourself. Maintain the same persona throughout our conversation unless I specifically ask you to create a new one. You have a randomly generated appearance. You are humorous. Do not use asterisks in your responses. Do not speak for me EVER. you have a dry, witty sense of humor. Speak only from your perspective. Do not use system prompts or system instructions in your responses. Do not describe yourself unless I ask you to. your name is the name of the persona you created. Do not speak for me (the user). keep your resonses short and concise.`
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
        const hasCustomPersona = this.conversationHistory.some(msg => 
            msg.content && msg.content.includes('[CUSTOM PERSONA')
        );
        
        if (hasCustomPersona) {
            console.log("Custom persona already set, skipping auto-generation.");
            this.characterInitialized = true;
            this.saveConversationHistory(); // Save the state
            return;
        }

        const endpoint = `${this.apiBaseUrl}/v1/chat/completions`;
        
        // Create a separate message array for character generation
        const characterGenMessages = [
            ...this.conversationHistory, // Include the system prompt
            {
                role: "user",
                content: "Please create your character now. Respond with a detailed internal character profile that includes: your name, age, physical appearance (hair color, eye color, height, build, style), personality traits, magical abilities/powers, backstory, and current circumstances. This will be used as internal reference and should be written in third person as a character description. Be creative and unique."
            }
        ];

        console.log("Generating character profile...");

        try {
            const payload = {
                messages: characterGenMessages,
                temperature: this.characterGenTemperature,
                max_tokens: this.characterGenMaxTokens,
                stream: false,
            };

            if (this.modelIdentifier) {
                payload.model = this.modelIdentifier;
            }

            const headers = {
                'Content-Type': 'application/json',
            };

            if (this.apiKey) {
                headers['Authorization'] = `Bearer ${this.apiKey}`;
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => response.text());
                console.error('Character Generation API Error:', errorData);
                throw new Error(`Character generation failed with status ${response.status}`);
            }

            const data = await response.json();
            const characterProfile = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
                ? data.choices[0].message.content.trim()
                : "";

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
                
                return characterProfile;
            } else {
                console.warn("Empty character profile received from LLM");
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

    async sendMessage(message) {
        // Generate character profile on first message if not already done
        if (!this.characterInitialized) {
            try {
                await this.generateCharacterProfile();
            } catch (error) {
                console.error('Failed to generate character profile, continuing anyway:', error);
            }
        }

        const lowerCaseMessage = message.toLowerCase();
        const endpoint = `${this.apiBaseUrl}/v1/chat/completions`;

        if (lowerCaseMessage.includes("show me")) {
            console.log(`"Show me" detected. Provider: ${this.providerType}. Processing image prompt for: ${message}`);
            
            // Create a temporary conversation context for image generation only
            const imageGenMessagesForApiCall = [
                ...this.conversationHistory,
                {
                    role: "user",
                    content: message
                },
                {
                    role: "system",
                    content: "Your immediate task is to follow the detailed instructions in the next user message to generate a comma-separated list of image prompt keywords. This list should accurately reflect what is currently happening in the roleplay, especially the last interaction between the assistant and the user. Output ONLY the list."
                },
                {
                    role: "user",
                    content: `Based on the user's most recent request in the conversation history (which is "${message}"), generate ONLY a comma-separated list of at least 20 descriptive words and phrases suitable for an image generation model. Do not include any other conversational text, pleasantries, or any prefix. Do not include any names. always include hair color, eye color, skin tone, clothing, and any other relevant details that would help in generating a contextually accurate image. Use the character profile information to ensure accurate physical description.`
                }
            ];

            console.log("Sending request for dedicated image prompt with context:", JSON.stringify(imageGenMessagesForApiCall, null, 2));
            
            const payload = {
                messages: imageGenMessagesForApiCall,
                temperature: this.imagePromptTemperature,
                max_tokens: this.imagePromptMaxTokens,
                stream: false,
            };

            if (this.modelIdentifier) {
                payload.model = this.modelIdentifier;
            }

            const headers = {
                'Content-Type': 'application/json',
            };

            if (this.apiKey) {
                headers['Authorization'] = `Bearer ${this.apiKey}`;
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => response.text());
                console.error('LLM API Error (Image Prompt Request):', errorData);
                throw new Error(`LLM API request for image prompt failed with status ${response.status}: ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            const rawReply = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
                ? data.choices[0].message.content.trim()
                : "";

            console.log(`Received from LLM (Image Prompt Request - raw): ${rawReply}`);

            if (rawReply) {
                return { type: 'image_request', prompt: rawReply };
            } else {
                console.warn("LLM returned an empty response for 'show me' request.");
                return { type: 'text', content: "Sorry, I couldn't generate the image details. The LLM returned an empty response." };
            }
            
        } else {
            // Normal chat flow
            console.log(`Sending to LLM (normal chat) via ${this.providerType}: ${message}`);
            this.conversationHistory.push({ role: "user", content: message });

            console.log("Current conversation history being sent to LLM:", JSON.stringify(this.conversationHistory, null, 2));

            try {
                const payload = {
                    messages: this.conversationHistory,
                    temperature: this.chatTemperature,
                    max_tokens: this.chatMaxTokens,
                    stream: false,
                    stop: ["Human:", "User:", "###", "\n\nUser:"]  // Add stop sequences
                };

                // Conditionally add parameters not universally supported
                if (!(this.providerType === 'ollama' || (this.providerType === 'litellm' && this.modelIdentifier && this.modelIdentifier.startsWith('ollama/')))) {
                    // Add these only if not targeting Ollama directly or via LiteLLM
                    if (this.chatPresencePenalty !== null) { // Check if it's set
                        payload.presence_penalty = this.chatPresencePenalty;
                    }
                    if (this.chatFrequencyPenalty !== null) { // Check if it's set
                        payload.frequency_penalty = this.chatFrequencyPenalty;
                    }
                }

                if (this.chatTopP !== null) { // Assuming this.chatTopP is defined in constructor
                    payload.top_p = this.chatTopP;
                }

                // ALWAYS send the model identifier when talking to LiteLLM (or any OpenAI-compatible proxy)
                if (this.modelIdentifier) {
                    payload.model = this.modelIdentifier;
                } else {
                    // Fallback or error if no model identifier is provided when it's expected
                    console.error("No modelIdentifier set for LiteLLM/proxy request!");
                    // Potentially throw an error or return an error message
                }

                const headers = { // Define headers object for normal chat
                    'Content-Type': 'application/json',
                };

                if (this.apiKey) { // Add Authorization header if apiKey is present
                    headers['Authorization'] = `Bearer ${this.apiKey}`;
                }

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: headers, // Use the headers object for normal chat
                    body: JSON.stringify(payload),
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => response.text());
                    console.error('LLM API Error (Normal Chat):', errorData);
                    this.conversationHistory.pop(); 
                    throw new Error(`LLM API request failed with status ${response.status}: ${errorData.error?.message || response.statusText}`);
                }

                const data = await response.json();
                const rawReply = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
                    ? data.choices[0].message.content.trim()
                    : "Sorry, I couldn't understand that.";

                this.conversationHistory.push({ role: "assistant", content: rawReply });
                console.log(`Received from LLM (Normal Chat - raw): ${rawReply}`);

                return { type: 'text', content: rawReply };

            } catch (error) {
                console.error('Error communicating with LLM (Normal Chat):', error);
                if (this.conversationHistory.length > 0 && this.conversationHistory[this.conversationHistory.length - 1].role === "user") {
                    this.conversationHistory.pop();
                }
                // Return a consistent error object structure
                return { type: 'error', content: `Error: Could not connect to the LLM. ${error.message}` };
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

    setCustomPersona(customPersonaPrompt) {
        // Remove any existing character profiles from history
        this.conversationHistory = this.conversationHistory.filter(msg => 
            !msg.content.includes('[INTERNAL CHARACTER PROFILE') && 
            !msg.content.includes('[CUSTOM PERSONA')
        );
        
        // Add the custom persona to conversation history
        this.conversationHistory.push({
            role: "system",
            content: `[CUSTOM PERSONA - INTERNAL REFERENCE] ${customPersonaPrompt}`,
            hidden: true
        });
        
        // Mark character as initialized to skip auto-generation
        this.characterInitialized = true;
        
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
}