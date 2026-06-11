if (typeof ImageService === 'undefined') {
    window.ImageService = class ImageService {
        constructor(apiBaseUrl, provider = 'a1111', openaiApiKey = null, googleApiKey = null) {
            this.apiBaseUrl = apiBaseUrl; // e.g., 'http://127.0.0.1:7860' for Automatic1111, 'http://localhost:7801' for SwarmUI
            this.provider = provider; // 'a1111', 'openai', 'swarmui', or 'imagen4'
            this.openaiApiKey = openaiApiKey;
            this.googleApiKey = googleApiKey;

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

        // Set default settings for Imagen 4 Fast
        this.imagen4_aspect_ratio = "1:1";
        this.imagen4_output_format = "image/jpeg";
        this.imagen4_person_generation = "ALLOW_ADULT";

        // Kie.AI settings
        this.kieApiKey = null;
        this.kie_image_model = "gpt-image/1.5-text-to-image";
        this.kie_aspect_ratio = "1:1";
        this.kie_quality = "medium";
        this.kie_resolution = "1K";
        this.kie_output_format = "png";
        this.kie_reference_image_urls = [];

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

        // Imagen 4 Fast settings
        if (settings.imagen4_aspect_ratio !== undefined) this.imagen4_aspect_ratio = settings.imagen4_aspect_ratio;
        if (settings.imagen4_output_format !== undefined) this.imagen4_output_format = settings.imagen4_output_format;
        if (settings.imagen4_person_generation !== undefined) this.imagen4_person_generation = settings.imagen4_person_generation;

        // Kie.AI settings
        if (settings.kieApiKey !== undefined) this.kieApiKey = settings.kieApiKey;
        if (settings.kie_image_model !== undefined) this.kie_image_model = settings.kie_image_model;
        if (settings.kie_aspect_ratio !== undefined) this.kie_aspect_ratio = settings.kie_aspect_ratio;
        if (settings.kie_quality !== undefined) this.kie_quality = settings.kie_quality;
        if (settings.kie_resolution !== undefined) this.kie_resolution = settings.kie_resolution;
        if (settings.kie_output_format !== undefined) this.kie_output_format = settings.kie_output_format;

        // Provider settings
        if (settings.provider !== undefined) {
            this.provider = settings.provider;
            console.log(`ImageService provider changed to: ${this.provider}`);
        }
        if (settings.openaiApiKey !== undefined) {
            this.openaiApiKey = settings.openaiApiKey;
    }
    if (settings.googleApiKey !== undefined) {
            this.googleApiKey = settings.googleApiKey;
    }
    if (settings.apiBaseUrl !== undefined) {
        this.apiBaseUrl = settings.apiBaseUrl;
    }

        console.log('ImageService: Settings updated:', this.redactSecrets(settings));
    }

    redactSecrets(value) {
        if (!value || typeof value !== 'object') return value;
        if (Array.isArray(value)) return value.map((item) => this.redactSecrets(item));

        return Object.fromEntries(Object.entries(value).map(([key, item]) => {
            if (/apiKey|api_key|authorization|token|secret|password/i.test(key)) {
                return [key, item ? 'PRESENT' : 'MISSING'];
            }
            return [key, this.redactSecrets(item)];
        }));
    }

    async generateImage(prompt) {
        console.log(`Sending to Image Service (${this.provider}): ${prompt}`);

        if (this.provider === 'openai') {
            return await this.generateOpenAIImage(prompt);
        } else if (this.provider === 'swarmui') {
            return await this.generateSwarmUIImage(prompt);
        } else if (this.provider === 'imagen4') {
            return await this.generateImagen4Image(prompt);
        } else if (this.provider === 'kie') {
            return await this.generateKieImage(prompt);
        } else {
            return await this.generateA1111Image(prompt);
        }
    }

    getKieImageModelConfig(model) {
        const configs = {
            'bytedance/seedream': { fields: ['prompt', 'image_size', 'guidance_scale', 'seed'], imageSizeDefault: 'regular' },
            'bytedance/seedream-v4-text-to-image': { fields: ['prompt', 'image_size', 'image_resolution', 'max_images', 'seed', 'nsfw_checker'], imageSizeDefault: 'regular' },
            'bytedance/seedream-v4-edit': { fields: ['prompt', 'image_urls', 'image_size', 'image_resolution', 'max_images', 'seed', 'nsfw_checker'], imageField: 'image_urls', imageSizeDefault: 'regular' },
            'seedream/4.5-text-to-image': { fields: ['prompt', 'aspect_ratio', 'quality', 'nsfw_checker'], qualityDefault: 'basic', qualityValues: ['basic'] },
            'seedream/4.5-edit': { fields: ['prompt', 'image_urls', 'aspect_ratio', 'quality', 'nsfw_checker'], imageField: 'image_urls', qualityDefault: 'basic', qualityValues: ['basic'] },
            'seedream/5-lite-text-to-image': { fields: ['prompt', 'aspect_ratio', 'quality', 'nsfw_checker'], qualityDefault: 'basic', qualityValues: ['basic'] },
            'seedream/5-lite-image-to-image': { fields: ['prompt', 'image_urls', 'aspect_ratio', 'quality', 'nsfw_checker'], imageField: 'image_urls', qualityDefault: 'basic', qualityValues: ['basic'] },
            'nano-banana-2': { fields: ['prompt', 'image_input', 'aspect_ratio', 'resolution', 'output_format'], imageField: 'image_input', optionalImage: true },
            'google/imagen4-fast': { fields: ['prompt', 'negative_prompt', 'aspect_ratio', 'seed'] },
            'google/imagen4': { fields: ['prompt', 'negative_prompt', 'aspect_ratio', 'seed'] },
            'google/imagen4-ultra': { fields: ['prompt', 'negative_prompt', 'aspect_ratio', 'seed'] },
            'google/nano-banana': { fields: ['prompt', 'output_format', 'aspect_ratio', 'image_size', 'nsfw_checker'], imageSizeDefault: 'auto' },
            'google/nano-banana-edit': { fields: ['prompt', 'image_urls', 'output_format', 'aspect_ratio', 'image_size'], imageField: 'image_urls', imageSizeDefault: 'auto' },
            'nano-banana-pro': { fields: ['prompt', 'image_input', 'aspect_ratio', 'resolution', 'output_format'], imageField: 'image_input' },
            'flux-2/pro-text-to-image': { fields: ['prompt', 'aspect_ratio', 'resolution', 'nsfw_checker'] },
            'flux-2/pro-image-to-image': { fields: ['input_urls', 'prompt', 'aspect_ratio', 'resolution', 'nsfw_checker'], imageField: 'input_urls' },
            'flux-2/flex-text-to-image': { fields: ['prompt', 'aspect_ratio', 'resolution', 'nsfw_checker'] },
            'flux-2/flex-image-to-image': { fields: ['input_urls', 'prompt', 'aspect_ratio', 'resolution', 'nsfw_checker'], imageField: 'input_urls' },
            'grok-imagine/text-to-image': { fields: ['prompt', 'aspect_ratio', 'nsfw_checker', 'enable_pro'] },
            'grok-imagine/image-to-image': { fields: ['prompt', 'image_urls', 'nsfw_checker'], imageField: 'image_urls' },
            'gpt-image/1.5-text-to-image': { fields: ['prompt', 'aspect_ratio', 'quality'], qualityDefault: 'medium', qualityValues: ['medium'] },
            'gpt-image/1.5-image-to-image': { fields: ['input_urls', 'prompt', 'aspect_ratio', 'quality'], imageField: 'input_urls', qualityDefault: 'medium', qualityValues: ['medium'] },
            'gpt-image-2-text-to-image': { fields: ['prompt', 'aspect_ratio', 'resolution'] },
            'gpt-image-2-image-to-image': { fields: ['prompt', 'input_urls', 'aspect_ratio', 'resolution'], imageField: 'input_urls' },
            'ideogram/v3-text-to-image': { fields: ['prompt', 'rendering_speed', 'expand_prompt', 'image_size', 'negative_prompt'], imageSizeDefault: 'square_hd' },
            'ideogram/v3-edit': { fields: ['prompt', 'image_url', 'rendering_speed', 'expand_prompt'], imageField: 'image_url' },
            'ideogram/v3-remix': { fields: ['prompt', 'image_url', 'rendering_speed', 'expand_prompt', 'image_size', 'negative_prompt'], imageField: 'image_url', imageSizeDefault: 'square_hd' },
            'ideogram/character': { fields: ['prompt', 'reference_image_urls', 'rendering_speed', 'style', 'expand_prompt', 'num_images', 'image_size', 'negative_prompt'], imageField: 'reference_image_urls', optionalImage: true, imageSizeDefault: 'square_hd' },
            'ideogram/character-edit': { fields: ['prompt', 'image_url', 'reference_image_urls', 'rendering_speed', 'style', 'expand_prompt', 'num_images'], imageField: 'image_url', extraImageField: 'reference_image_urls' },
            'ideogram/character-remix': { fields: ['prompt', 'image_url', 'reference_image_urls', 'rendering_speed', 'style', 'expand_prompt', 'image_size', 'num_images', 'strength', 'negative_prompt'], imageField: 'image_url', extraImageField: 'reference_image_urls', imageSizeDefault: 'square_hd' },
            'qwen/text-to-image': { fields: ['prompt', 'image_size', 'num_inference_steps', 'seed', 'guidance_scale', 'enable_safety_checker', 'output_format', 'negative_prompt', 'acceleration', 'nsfw_checker'], imageSizeDefault: 'square_hd' },
            'qwen/image-to-image': { fields: ['prompt', 'image_url', 'strength', 'output_format', 'acceleration', 'negative_prompt', 'seed', 'num_inference_steps', 'guidance_scale', 'enable_safety_checker', 'nsfw_checker'], imageField: 'image_url' },
            'qwen/image-edit': { fields: ['prompt', 'image_url', 'acceleration', 'image_size', 'num_inference_steps', 'seed', 'guidance_scale', 'sync_mode', 'num_images', 'enable_safety_checker', 'output_format', 'negative_prompt'], imageField: 'image_url', imageSizeDefault: 'square_hd' },
            'qwen2/text-to-image': { fields: ['prompt', 'image_size', 'seed', 'output_format', 'nsfw_checker'], imageSizeDefault: 'square_hd' },
            'qwen2/image-edit': { fields: ['prompt', 'image_url', 'image_size', 'seed', 'output_format', 'nsfw_checker'], imageField: 'image_url', imageSizeDefault: 'square_hd' },
            'wan/2-7-image': { fields: ['prompt', 'input_urls', 'aspect_ratio', 'enable_sequential', 'resolution', 'thinking_mode', 'color_palette'], imageField: 'input_urls', optionalImage: true },
            'wan/2-7-image-pro': { fields: ['prompt', 'input_urls', 'aspect_ratio', 'enable_sequential', 'resolution', 'thinking_mode', 'color_palette'], imageField: 'input_urls', optionalImage: true },
            'z-image': { fields: ['prompt', 'aspect_ratio', 'nsfw_checker'] }
        };
        return configs[model] || configs['gpt-image/1.5-text-to-image'];
    }

    getReferenceImageCount() {
        return this.kie_reference_image_urls.length;
    }

    clearReferenceImages() {
        this.kie_reference_image_urls = [];
    }

    readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
            reader.readAsDataURL(file);
        });
    }

    async attachReferenceImages(files) {
        if (!this.kieApiKey) {
            throw new Error('Kie API key is required before attaching image references.');
        }

        const uploadedUrls = [];
        for (const file of files) {
            if (!file.type.startsWith('image/')) continue;
            if (file.size > 10 * 1024 * 1024) {
                throw new Error(`${file.name} is larger than Kie's 10MB image limit.`);
            }

            const base64Data = await this.readFileAsDataUrl(file);
            const response = await fetch('https://api.kie.ai/api/file-base64-upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.kieApiKey}`
                },
                body: JSON.stringify({
                    base64Data,
                    uploadPath: 'images/veilchat',
                    fileName: file.name
                })
            });

            const responseText = await response.text();
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (_) {
                data = { msg: responseText };
            }

            if (!response.ok || data.success === false) {
                throw new Error(data.msg || `Kie upload failed with status ${response.status}`);
            }

            const downloadUrl = data.data && data.data.downloadUrl;
            if (!downloadUrl) {
                throw new Error('Kie upload did not return a download URL.');
            }
            uploadedUrls.push(downloadUrl);
        }

        this.kie_reference_image_urls.push(...uploadedUrls);
        return uploadedUrls;
    }

    applyKieImageSources(input, config) {
        const refs = this.kie_reference_image_urls;
        if (config.imageField && refs.length === 0 && !config.optionalImage) {
            throw new Error('Attach an image before using this Kie image-editing model.');
        }
        if (!config.imageField || refs.length === 0) return;

        if (config.imageField === 'image_url') {
            input.image_url = refs[0];
        } else {
            input[config.imageField] = refs;
        }

        if (config.extraImageField && refs.length > 1) {
            input[config.extraImageField] = refs.slice(1);
        }
    }

    createKieImageInput(prompt, config) {
        const fields = new Set(config.fields);
        const input = { prompt: prompt.trim() };

        this.applyKieImageSources(input, config);

        if (fields.has('aspect_ratio')) input.aspect_ratio = this.kie_aspect_ratio || '1:1';
        if (fields.has('quality')) {
            const requestedQuality = this.kie_quality || config.qualityDefault;
            if (config.qualityValues && config.qualityValues.length) {
                input.quality = config.qualityValues.includes(requestedQuality)
                    ? requestedQuality
                    : config.qualityDefault;
            } else if (requestedQuality) {
                input.quality = requestedQuality;
            }
        }
        if (fields.has('resolution')) input.resolution = this.kie_resolution || '1K';
        if (fields.has('image_resolution')) input.image_resolution = this.kie_resolution || '1K';
        if (fields.has('output_format')) input.output_format = this.kie_output_format || 'png';
        if (fields.has('image_size') && config.imageSizeDefault) input.image_size = config.imageSizeDefault;
        if (fields.has('nsfw_checker')) input.nsfw_checker = true;
        if (fields.has('enable_safety_checker')) input.enable_safety_checker = true;
        if (fields.has('rendering_speed')) input.rendering_speed = 'BALANCED';
        if (fields.has('expand_prompt')) input.expand_prompt = true;
        if (fields.has('style')) input.style = 'AUTO';
        if (fields.has('num_images')) input.num_images = 1;
        if (fields.has('max_images')) input.max_images = 1;
        if (fields.has('enable_pro')) input.enable_pro = false;
        if (fields.has('enable_sequential')) input.enable_sequential = false;
        if (fields.has('thinking_mode')) input.thinking_mode = false;
        if (fields.has('strength')) input.strength = 0.8;

        return input;
    }

    extractKieTaskId(data) {
        return data && data.data && data.data.taskId ? data.data.taskId : null;
    }

    extractKieResultUrl(record) {
        const resultJson = record && record.data && record.data.resultJson;
        if (!resultJson && !(record && record.data)) return null;

        let parsed;
        try {
            parsed = typeof resultJson === 'string' ? JSON.parse(resultJson) : resultJson;
        } catch (error) {
            if (typeof resultJson === 'string' && /^https?:\/\//i.test(resultJson)) {
                return resultJson;
            }
            console.warn('Could not parse Kie resultJson:', resultJson, error);
            parsed = {};
        }

        const data = record && record.data ? record.data : {};
        const candidates = [
            data.resultUrls,
            data.result_urls,
            data.imageUrls,
            data.images,
            data.urls,
            data.files,
            data.response && data.response.resultUrls,
            data.response && data.response.imageUrls,
            parsed.resultUrls,
            parsed.result_urls,
            parsed.imageUrls,
            parsed.images,
            parsed.urls,
            parsed.files,
            parsed.data && parsed.data.resultUrls,
            parsed.data && parsed.data.imageUrls
        ];

        for (const candidate of candidates) {
            if (Array.isArray(candidate) && candidate.length) {
                const first = candidate[0];
                if (typeof first === 'string') return first;
                if (first && typeof first.url === 'string') return first.url;
            }
        }

        return data.url || data.imageUrl || parsed.url || parsed.imageUrl || null;
    }

    async pollKieTask(taskId) {
        const maxAttempts = 48;
        const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            if (attempt > 0) await delay(Math.min(2500 + attempt * 250, 6000));

            const response = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.kieApiKey}`
                }
            });

            const responseText = await response.text();
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (_) {
                data = { msg: responseText };
            }

            if (!response.ok) {
                throw new Error(data.msg || `Kie task polling failed with status ${response.status}`);
            }

            const state = String(data && data.data && (data.data.state || data.data.status || data.data.taskStatus) || '').toLowerCase();
            if (['success', 'succeeded', 'completed', 'complete', 'done'].includes(state)) return data;
            if (['failed', 'fail', 'error', 'cancelled', 'canceled'].includes(state)) {
                throw new Error((data.data && (data.data.failMsg || data.data.failCode)) || 'Kie image task failed.');
            }
        }

        throw new Error('Kie image task timed out before a result was ready.');
    }

    async generateKieImage(prompt) {
        if (!this.kieApiKey) {
            throw new Error('Kie API key is required for Kie image generation.');
        }

        const model = this.kie_image_model || 'gpt-image/1.5-text-to-image';
        const config = this.getKieImageModelConfig(model);
        const payload = {
            model,
            input: this.createKieImageInput(prompt, config)
        };

        const response = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.kieApiKey}`
            },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (_) {
            data = { msg: responseText };
        }

        if (!response.ok || (data.code && Number(data.code) !== 200)) {
            throw new Error(data.msg || `Kie image task failed with status ${response.status}`);
        }

        const taskId = this.extractKieTaskId(data);
        if (!taskId) {
            throw new Error('Kie did not return a taskId.');
        }

        const record = await this.pollKieTask(taskId);
        const imageUrl = this.extractKieResultUrl(record);
        if (!imageUrl) {
            throw new Error('Kie image task completed without an image URL.');
        }
        return imageUrl;
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

    async generateImagen4Image(prompt) {
        if (!this.googleApiKey) {
            console.error('Google API key not provided for Imagen 4 image generation');
            throw new Error('Google API key is required for Imagen 4 image generation');
        }

        // Use backend proxy to avoid CORS issues (Google API doesn't support direct browser calls)
        const proxyEndpoint = 'https://mcp-veil.veilstudio.io/api/imagen4/generate';

        try {
            const payload = {
                prompt: prompt.trim(),
                config: {
                    numberOfImages: 1,
                    outputMimeType: this.imagen4_output_format || "image/jpeg",
                    personGeneration: this.imagen4_person_generation || "ALLOW_ADULT",
                    aspectRatio: this.imagen4_aspect_ratio || "1:1"
                },
                apiKey: this.googleApiKey
            };

            console.log('Imagen 4 generation request:', { prompt: payload.prompt.substring(0, 100) + '...', config: payload.config });

            const response = await fetch(proxyEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => response.text());
                console.error('Imagen 4 API Error Response:', errorData);
                throw new Error(`Imagen 4 API request failed with status ${response.status}: ${JSON.stringify(errorData)}`);
            }

            const data = await response.json();
            console.log('Imagen 4 full response:', data);
            console.log('Response has predictions?', !!data.predictions);
            console.log('Predictions length:', data.predictions?.length);
            console.log('Full response keys:', Object.keys(data));

            // The :predict endpoint returns predictions array with bytesBase64Encoded
            if (data.predictions && data.predictions.length > 0) {
                const prediction = data.predictions[0];

                if (prediction.bytesBase64Encoded) {
                    console.log('Received base64 image data from Imagen 4.');
                    // Determine the MIME type from the output format setting
                    const mimeType = this.imagen4_output_format || 'image/jpeg';
                    return `data:${mimeType};base64,${prediction.bytesBase64Encoded}`;
                } else {
                    console.error('No image bytes received from Imagen 4:', data);
                    throw new Error('No image data received from Imagen 4 API');
                }
            } else {
                console.error('No predictions received from Imagen 4:', data);
                throw new Error('Invalid response format from Imagen 4 API');
            }
        } catch (error) {
            console.error('Error communicating with Imagen 4 Service:', error);
            throw error;
        }
    }
}
}
