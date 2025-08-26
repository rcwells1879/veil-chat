if (typeof ImageService === 'undefined') {
    window.ImageService = class ImageService {
        constructor(apiBaseUrl, provider = 'a1111', openaiApiKey = null) {
            this.apiBaseUrl = apiBaseUrl; // e.g., 'http://127.0.0.1:7860' for Automatic1111, 'http://localhost:7801' for SwarmUI
            this.provider = provider; // 'a1111', 'openai', or 'swarmui'
            this.openaiApiKey = openaiApiKey;
            
            // SwarmUI-specific properties
            this.swarmSessionId = null;
            this.swarmSessionExpiry = null;
        
        // Set default settings for A1111
        this.width = 1024;
        this.height = 1536;
        this.steps = 20;
        this.cfg_scale = 3.5;
        this.sampler_name = "Euler a";
        
        // Set default settings for OpenAI
        this.size = "auto"; // OpenAI format
        this.quality = "auto";
        this.output_format = "png";
        this.background = "auto";
        
        // Set default settings for SwarmUI
        this.swarm_width = 1024;
        this.swarm_height = 1024;
        this.swarm_steps = 20;
        this.swarm_cfg_scale = 7.5;
        this.swarm_model = null; // Auto-detect or user-specified
        this.swarm_sampler = "Euler a";
        
        console.log(`ImageService initialized. Provider: ${this.provider}`);
    }

    // --- CONSOLIDATED HELPER FUNCTIONS ---
    processPromptWithQualityTags(prompt) {
        const qualityTags = "best quality, dynamic lighting";
        const userOrLlmPrompt = prompt.trim();
        return userOrLlmPrompt 
            ? `${qualityTags}, ${userOrLlmPrompt}` 
            : qualityTags;
    }

    createNegativePrompt() {
        return "young, underage, nsfw, child, big eyes, bad anatomy, worst quality, low quality, normal quality, jpeg artifacts, signature, camera, username, blurry";
    }

    async handleAPIError(response, provider) {
        const errorData = await response.text();
        console.error(`${provider} API Error Response:`, errorData);
        throw new Error(`${provider} API request failed with status ${response.status}: ${errorData}`);
    }

    updateSettings(settings) {
        // A1111 settings
        if (settings.width !== undefined) this.width = settings.width;
        if (settings.height !== undefined) this.height = settings.height;
        if (settings.steps !== undefined) this.steps = settings.steps;
        if (settings.cfg_scale !== undefined) this.cfg_scale = settings.cfg_scale;
        if (settings.sampler_name !== undefined) this.sampler_name = settings.sampler_name;
        
        // OpenAI settings
        if (settings.size !== undefined) this.size = settings.size;
        if (settings.quality !== undefined) this.quality = settings.quality;
        if (settings.output_format !== undefined) this.output_format = settings.output_format;
        if (settings.background !== undefined) this.background = settings.background;
        
        // SwarmUI settings
        if (settings.swarm_width !== undefined) this.swarm_width = settings.swarm_width;
        if (settings.swarm_height !== undefined) this.swarm_height = settings.swarm_height;
        if (settings.swarm_steps !== undefined) this.swarm_steps = settings.swarm_steps;
        if (settings.swarm_cfg_scale !== undefined) this.swarm_cfg_scale = settings.swarm_cfg_scale;
        if (settings.swarm_model !== undefined) this.swarm_model = settings.swarm_model;
        if (settings.swarm_sampler !== undefined) this.swarm_sampler = settings.swarm_sampler;
        
        // Provider settings
        if (settings.provider !== undefined) {
            this.provider = settings.provider;
            console.log(`ImageService provider changed to: ${this.provider}`);
        }
        if (settings.openaiApiKey !== undefined) {
            this.openaiApiKey = settings.openaiApiKey;
    }
    if (settings.apiBaseUrl !== undefined) {
        this.apiBaseUrl = settings.apiBaseUrl;
    }
        
        console.log('ImageService: Settings updated:', settings);
    }

    async generateImage(prompt) {
        console.log(`Sending to Image Service (${this.provider}): ${prompt}`);
        
        if (this.provider === 'openai') {
            return await this.generateOpenAIImage(prompt);
        } else if (this.provider === 'swarmui') {
            return await this.generateSwarmUIImage(prompt);
        } else {
            return await this.generateA1111Image(prompt);
        }
    }

    async generateOpenAIImage(prompt) {
        if (!this.openaiApiKey) {
            console.error('OpenAI API key not provided for image generation');
            throw new Error('OpenAI API key is required for image generation');
        }

        const openaiEndpoint = 'https://api.openai.com/v1/images/generations';
        
        try {
            const payload = {
                model: "gpt-image-1",
                prompt: prompt.trim(),
                n: 1,
                size: this.size || "auto",
                quality: this.quality || "auto",
                output_format: this.output_format || "png",
                background: this.background || "auto",
                moderation: "low" // Set moderation level to low as requested
            };

            const response = await fetch(openaiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.openaiApiKey}`
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => response.text());
                console.error('OpenAI Image API Error Response:', errorData);
                throw new Error(`OpenAI Image API request failed with status ${response.status}: ${JSON.stringify(errorData)}`);
            }

            const data = await response.json();

            // gpt-image-1 always returns base64-encoded images
            if (data.data && data.data.length > 0) {
                const imageData = data.data[0];
                
                if (imageData.b64_json) {
                    console.log('Received base64 image data from OpenAI.');
                    return `data:image/${this.output_format || 'png'};base64,${imageData.b64_json}`;
                } else {
                    console.error('No base64 image data received from OpenAI:', data);
                    throw new Error('No image data received from OpenAI API');
                }
            } else {
                console.error('No image data received from OpenAI:', data);
                throw new Error('Invalid response format from OpenAI API');
            }
        } catch (error) {
            console.error('Error communicating with OpenAI Image Service:', error);
            throw error;
        }
    }

    async generateA1111Image(prompt) {
        const currentPrompt = this.processPromptWithQualityTags(prompt);

        try {
            const response = await fetch(`${this.apiBaseUrl}/sdapi/v1/txt2img`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: currentPrompt,
                    negative_prompt: this.createNegativePrompt(), 
                    width: this.width || 1024,
                    height: this.height || 1536,
                    steps: this.steps || 20,
                    cfg_scale: this.cfg_scale || 1.4,
                    sampler_name: this.sampler_name || "Euler a",
                    seed: -1,
                    batch_count: 1,
                    batch_size: 1,
                    restore_faces: false,
                    tiling: false,
                    enable_hr: false,
                    send_images: true,
                    save_images: false
                }),
                credentials: 'include'
            });

            if (!response.ok) {
                await this.handleAPIError(response, 'Automatic1111');
            }

            const data = await response.json();

            // A1111 returns images as base64 encoded strings in the 'images' array
            if (data.images && data.images.length > 0) {
                const base64Image = data.images[0];
                console.log('Received image data from Automatic1111.');
                return `data:image/png;base64,${base64Image}`;
            } else {
                console.error('No image data received from Automatic1111:', data);
                return null;            }
        } catch (error) {
            console.error('Error communicating with Image Service (Automatic1111):', error);
            throw error;
        }
    }

    async ensureSwarmSession() {
        // Check if we have a valid session that hasn't expired
        const now = Date.now();
        if (this.swarmSessionId && this.swarmSessionExpiry && now < this.swarmSessionExpiry) {
            console.log('Using existing SwarmUI session:', this.swarmSessionId);
            return this.swarmSessionId;
        }

        console.log('Getting new SwarmUI session...');
        try {
            const response = await fetch(`${this.apiBaseUrl}/API/GetNewSession`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({})
            });

            if (!response.ok) {
                await this.handleAPIError(response, 'SwarmUI Session');
            }

            const data = await response.json();
            
            if (data.session_id) {
                this.swarmSessionId = data.session_id;
                // Set session to expire in 30 minutes (SwarmUI default is usually longer, but this is safe)
                this.swarmSessionExpiry = now + (30 * 60 * 1000);
                console.log('New SwarmUI session obtained:', this.swarmSessionId);
                return this.swarmSessionId;
            } else {
                console.error('No session_id in SwarmUI response:', data);
                throw new Error('Failed to obtain SwarmUI session');
            }
        } catch (error) {
            console.error('Error getting SwarmUI session:', error);
            throw error;
        }
    }

    async generateSwarmUIImage(prompt) {
        const currentPrompt = this.processPromptWithQualityTags(prompt);

        try {
            // Ensure we have a valid session
            const sessionId = await this.ensureSwarmSession();

            const payload = {
                session_id: sessionId,
                prompt: currentPrompt,
                negativeprompt: this.createNegativePrompt(),
                images: 1,
                width: this.swarm_width || 1024,
                height: this.swarm_height || 1024,
                steps: this.swarm_steps || 20,
                cfgscale: this.swarm_cfg_scale || 7.5,
                seed: -1 // Random seed
            };

            // Add model if specified (don't send empty model parameter)
            if (this.swarm_model && this.swarm_model.trim() !== '') {
                payload.model = this.swarm_model;
            }

            console.log('SwarmUI generation payload:', payload);

            const response = await fetch(`${this.apiBaseUrl}/API/GenerateText2Image`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.text();
                
                // Check if it's a session error and retry once
                if (errorData.includes('invalid_session_id') || response.status === 401) {
                    console.log('Session invalid, getting new session and retrying...');
                    this.swarmSessionId = null;
                    this.swarmSessionExpiry = null;
                    
                    const newSessionId = await this.ensureSwarmSession();
                    payload.session_id = newSessionId;
                    
                    const retryResponse = await fetch(`${this.apiBaseUrl}/API/GenerateText2Image`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(payload)
                    });
                    
                    if (!retryResponse.ok) {
                        await this.handleAPIError(retryResponse, 'SwarmUI (retry)');
                    }
                    
                    const retryData = await retryResponse.json();
                    return this.processSwarmUIResponse(retryData);
                }
                
                await this.handleAPIError(response, 'SwarmUI');
            }

            const data = await response.json();
            return this.processSwarmUIResponse(data);

        } catch (error) {
            console.error('Error communicating with SwarmUI Service:', error);
            throw error;
        }
    }

    processSwarmUIResponse(data) {
        console.log('SwarmUI full response:', data);
        
        // SwarmUI returns {images: Array} format
        if (data && data.images && Array.isArray(data.images) && data.images.length > 0) {
            const imagePath = data.images[0];
            console.log('Received image path from SwarmUI:', imagePath);
            
            // SwarmUI returns relative paths that already include the correct path
            // Just prepend the base URL without additional path prefix
            const imageUrl = `${this.apiBaseUrl}/${imagePath}`;
            console.log('Constructed SwarmUI image URL:', imageUrl);
            
            return imageUrl;
        } else if (data && data.error) {
            console.error('SwarmUI returned error:', data.error);
            throw new Error(`SwarmUI error: ${data.error}`);
        } else {
            console.error('No image data received from SwarmUI:', data);
            throw new Error('No image data received from SwarmUI API');
        }
    }
}
}