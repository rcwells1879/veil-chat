class ImageService {
    constructor(apiBaseUrl, provider = 'a1111', openaiApiKey = null) {
        this.apiBaseUrl = apiBaseUrl; // e.g., 'http://127.0.0.1:7860' for Automatic1111
        this.provider = provider; // 'a1111' or 'openai'
        this.openaiApiKey = openaiApiKey;
        
        // Set default settings for A1111
        this.width = 1024;
        this.height = 1536;
        this.steps = 20;
        this.cfg_scale = 1.4;
        this.sampler_name = "Euler a";
        
        // Set default settings for OpenAI
        this.size = "1024x1024"; // OpenAI format
        
        console.log(`ImageService initialized. Provider: ${this.provider}`);
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
            const response = await fetch(openaiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.openaiApiKey}`
                },
                body: JSON.stringify({
                    model: "gpt-image-1",
                    prompt: prompt.trim(),
                    n: 1,
                    size: this.size || "1024x1024"
                    // Removed response_format parameter
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => response.text());
                console.error('OpenAI Image API Error Response:', errorData);
                throw new Error(`OpenAI Image API request failed with status ${response.status}: ${JSON.stringify(errorData)}`);
            }

            const data = await response.json();

            // Check for both b64_json and url formats in the response
            if (data.data && data.data.length > 0) {
                const imageData = data.data[0];
                
                if (imageData.b64_json) {
                    // If base64 data is provided
                    console.log('Received base64 image data from OpenAI.');
                    return `data:image/png;base64,${imageData.b64_json}`;
                } else if (imageData.url) {
                    // If URL is provided, fetch the image and convert to base64
                    console.log('Received image URL from OpenAI, converting to base64...');
                    try {
                        const imageResponse = await fetch(imageData.url);
                        if (!imageResponse.ok) {
                            throw new Error(`Failed to fetch image from URL: ${imageResponse.status}`);
                        }
                        const imageBlob = await imageResponse.blob();
                        return new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result);
                            reader.onerror = reject;
                            reader.readAsDataURL(imageBlob);
                        });
                    } catch (urlError) {
                        console.error('Error fetching image from URL:', urlError);
                        throw new Error(`Failed to fetch image from OpenAI URL: ${urlError.message}`);
                    }
                } else {
                    console.error('No image data or URL received from OpenAI:', data);
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
        // Add quality tags like in the Python version
        const qualityTags = "best quality, dynamic lighting";
        const userOrLlmPrompt = prompt.trim();
        const currentPrompt = userOrLlmPrompt 
            ? `${qualityTags}, ${userOrLlmPrompt}` 
            : qualityTags;

        try {
            const response = await fetch(`${this.apiBaseUrl}/sdapi/v1/txt2img`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: currentPrompt,
                    negative_prompt: "young, underage, nsfw, child, big eyes, bad anatomy, worst quality, low quality, normal quality, jpeg artifacts, signature, camera, username, blurry", 
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
            });

            if (!response.ok) {
                const errorData = await response.text(); 
                console.error('Automatic1111 API Error Response:', errorData);
                throw new Error(`Automatic1111 API request failed with status ${response.status}: ${errorData}`);
            }

            const data = await response.json();

            // A1111 returns images as base64 encoded strings in the 'images' array
            if (data.images && data.images.length > 0) {
                const base64Image = data.images[0];
                console.log('Received image data from Automatic1111.');
                return `data:image/png;base64,${base64Image}`;
            } else {
                console.error('No image data received from Automatic1111:', data);
                return null;
            }
        } catch (error) {
            console.error('Error communicating with Image Service (Automatic1111):', error);
            throw error;
        }
    }
}