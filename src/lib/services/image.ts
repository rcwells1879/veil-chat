import type { AppSettings, ImageProvider } from "../settings";

type KieConfig = {
  fields: string[];
  imageField?: string;
  extraImageField?: string;
  optionalImage?: boolean;
  imageSizeDefault?: string;
  qualityDefault?: string;
  qualityValues?: string[];
};

const KIE_IMAGE_CONFIGS: Record<string, KieConfig> = {
  "bytedance/seedream": { fields: ["prompt", "image_size", "guidance_scale", "seed"], imageSizeDefault: "regular" },
  "bytedance/seedream-v4-text-to-image": { fields: ["prompt", "image_size", "image_resolution", "max_images", "seed", "nsfw_checker"], imageSizeDefault: "regular" },
  "bytedance/seedream-v4-edit": { fields: ["prompt", "image_urls", "image_size", "image_resolution", "max_images", "seed", "nsfw_checker"], imageField: "image_urls", imageSizeDefault: "regular" },
  "seedream/4.5-text-to-image": { fields: ["prompt", "aspect_ratio", "quality", "nsfw_checker"], qualityDefault: "basic", qualityValues: ["basic"] },
  "seedream/4.5-edit": { fields: ["prompt", "image_urls", "aspect_ratio", "quality", "nsfw_checker"], imageField: "image_urls", qualityDefault: "basic", qualityValues: ["basic"] },
  "seedream/5-lite-text-to-image": { fields: ["prompt", "aspect_ratio", "quality", "nsfw_checker"], qualityDefault: "basic", qualityValues: ["basic"] },
  "seedream/5-lite-image-to-image": { fields: ["prompt", "image_urls", "aspect_ratio", "quality", "nsfw_checker"], imageField: "image_urls", qualityDefault: "basic", qualityValues: ["basic"] },
  "nano-banana-2": { fields: ["prompt", "image_input", "aspect_ratio", "resolution", "output_format"], imageField: "image_input", optionalImage: true },
  "google/imagen4-fast": { fields: ["prompt", "negative_prompt", "aspect_ratio", "seed"] },
  "google/imagen4": { fields: ["prompt", "negative_prompt", "aspect_ratio", "seed"] },
  "google/imagen4-ultra": { fields: ["prompt", "negative_prompt", "aspect_ratio", "seed"] },
  "google/nano-banana": { fields: ["prompt", "output_format", "aspect_ratio", "image_size", "nsfw_checker"], imageSizeDefault: "auto" },
  "google/nano-banana-edit": { fields: ["prompt", "image_urls", "output_format", "aspect_ratio", "image_size"], imageField: "image_urls", imageSizeDefault: "auto" },
  "nano-banana-pro": { fields: ["prompt", "image_input", "aspect_ratio", "resolution", "output_format"], imageField: "image_input" },
  "flux-2/pro-text-to-image": { fields: ["prompt", "aspect_ratio", "resolution", "nsfw_checker"] },
  "flux-2/pro-image-to-image": { fields: ["input_urls", "prompt", "aspect_ratio", "resolution", "nsfw_checker"], imageField: "input_urls" },
  "flux-2/flex-text-to-image": { fields: ["prompt", "aspect_ratio", "resolution", "nsfw_checker"] },
  "flux-2/flex-image-to-image": { fields: ["input_urls", "prompt", "aspect_ratio", "resolution", "nsfw_checker"], imageField: "input_urls" },
  "grok-imagine/text-to-image": { fields: ["prompt", "aspect_ratio", "nsfw_checker", "enable_pro"] },
  "grok-imagine/image-to-image": { fields: ["prompt", "image_urls", "nsfw_checker"], imageField: "image_urls" },
  "gpt-image/1.5-text-to-image": { fields: ["prompt", "aspect_ratio", "quality"], qualityDefault: "medium", qualityValues: ["medium"] },
  "gpt-image/1.5-image-to-image": { fields: ["input_urls", "prompt", "aspect_ratio", "quality"], imageField: "input_urls", qualityDefault: "medium", qualityValues: ["medium"] },
  "gpt-image-2-text-to-image": { fields: ["prompt", "aspect_ratio", "resolution"] },
  "gpt-image-2-image-to-image": { fields: ["prompt", "input_urls", "aspect_ratio", "resolution"], imageField: "input_urls" },
  "ideogram/v3-text-to-image": { fields: ["prompt", "rendering_speed", "expand_prompt", "image_size", "negative_prompt"], imageSizeDefault: "square_hd" },
  "ideogram/v3-edit": { fields: ["prompt", "image_url", "rendering_speed", "expand_prompt"], imageField: "image_url" },
  "ideogram/v3-remix": { fields: ["prompt", "image_url", "rendering_speed", "expand_prompt", "image_size", "negative_prompt"], imageField: "image_url", imageSizeDefault: "square_hd" },
  "ideogram/character": { fields: ["prompt", "reference_image_urls", "rendering_speed", "style", "expand_prompt", "num_images", "image_size", "negative_prompt"], imageField: "reference_image_urls", optionalImage: true, imageSizeDefault: "square_hd" },
  "ideogram/character-edit": { fields: ["prompt", "image_url", "reference_image_urls", "rendering_speed", "style", "expand_prompt", "num_images"], imageField: "image_url", extraImageField: "reference_image_urls" },
  "ideogram/character-remix": { fields: ["prompt", "image_url", "reference_image_urls", "rendering_speed", "style", "expand_prompt", "image_size", "num_images", "strength", "negative_prompt"], imageField: "image_url", extraImageField: "reference_image_urls", imageSizeDefault: "square_hd" },
  "qwen/text-to-image": { fields: ["prompt", "image_size", "num_inference_steps", "seed", "guidance_scale", "enable_safety_checker", "output_format", "negative_prompt", "acceleration", "nsfw_checker"], imageSizeDefault: "square_hd" },
  "qwen/image-to-image": { fields: ["prompt", "image_url", "strength", "output_format", "acceleration", "negative_prompt", "seed", "num_inference_steps", "guidance_scale", "enable_safety_checker", "nsfw_checker"], imageField: "image_url" },
  "qwen/image-edit": { fields: ["prompt", "image_url", "acceleration", "image_size", "num_inference_steps", "seed", "guidance_scale", "sync_mode", "num_images", "enable_safety_checker", "output_format", "negative_prompt"], imageField: "image_url", imageSizeDefault: "square_hd" },
  "qwen2/text-to-image": { fields: ["prompt", "image_size", "seed", "output_format", "nsfw_checker"], imageSizeDefault: "square_hd" },
  "qwen2/image-edit": { fields: ["prompt", "image_url", "image_size", "seed", "output_format", "nsfw_checker"], imageField: "image_url", imageSizeDefault: "square_hd" },
  "wan/2-7-image": { fields: ["prompt", "input_urls", "aspect_ratio", "enable_sequential", "resolution", "thinking_mode", "color_palette"], imageField: "input_urls", optionalImage: true },
  "wan/2-7-image-pro": { fields: ["prompt", "input_urls", "aspect_ratio", "enable_sequential", "resolution", "thinking_mode", "color_palette"], imageField: "input_urls", optionalImage: true },
  "z-image": { fields: ["prompt", "aspect_ratio", "nsfw_checker"] },
};

export class ImageService {
  private settings: AppSettings;
  private swarmSessionId: string | null = null;
  private swarmSessionExpiry: number | null = null;
  private kieReferenceImageUrls: string[] = [];

  constructor(settings: AppSettings) {
    this.settings = settings;
  }

  updateSettings(settings: AppSettings) {
    this.settings = settings;
  }

  getReferenceImageCount() {
    return this.kieReferenceImageUrls.length;
  }

  clearReferenceImages() {
    this.kieReferenceImageUrls = [];
  }

  async attachReferenceImages(files: File[]) {
    if (!this.settings.kieApiKey) throw new Error("Kie API key is required before attaching image references.");

    const uploadedUrls: string[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} is larger than Kie's 10MB image limit.`);

      const base64Data = await this.readFileAsDataUrl(file);
      const response = await fetch("https://api.kie.ai/api/file-base64-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.settings.kieApiKey}`,
        },
        body: JSON.stringify({
          base64Data,
          uploadPath: "images/veilchat",
          fileName: file.name,
        }),
      });

      const data = await this.readJsonOrText(response);
      if (!response.ok || data.success === false) {
        throw new Error(data.msg || `Kie upload failed with status ${response.status}`);
      }

      const downloadUrl = data.data?.downloadUrl;
      if (!downloadUrl) throw new Error("Kie upload did not return a download URL.");
      uploadedUrls.push(downloadUrl);
    }

    this.kieReferenceImageUrls.push(...uploadedUrls);
    return uploadedUrls;
  }

  async generateImage(prompt: string): Promise<string | null> {
    switch (this.settings.customImageProvider) {
      case "openai":
        return this.generateOpenAIImage(prompt);
      case "swarmui":
        return this.generateSwarmUIImage(prompt);
      case "kie":
        return this.generateKieImage(prompt);
      case "a1111":
      default:
        return this.generateA1111Image(prompt);
    }
  }

  private apiBaseUrl(provider: ImageProvider = this.settings.customImageProvider) {
    return provider === "swarmui" ? this.settings.swarmuiApiUrl : this.settings.customImageApiUrl;
  }

  private processPromptWithQualityTags(prompt: string) {
    const qualityTags = "best quality, dynamic lighting";
    const userPrompt = prompt.trim();
    return userPrompt ? `${qualityTags}, ${userPrompt}` : qualityTags;
  }

  private createNegativePrompt() {
    return "young, underage, nsfw, child, big eyes, bad anatomy, worst quality, low quality, normal quality, jpeg artifacts, signature, camera, username, blurry";
  }

  private async generateOpenAIImage(prompt: string) {
    if (!this.settings.openaiApiKey) throw new Error("OpenAI API key is required for image generation.");

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.settings.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: prompt.trim(),
        n: 1,
        size: this.settings.imageSize || "auto",
        quality: this.settings.openaiQuality || "auto",
        output_format: this.settings.openaiOutputFormat || "png",
        background: this.settings.openaiBackground || "auto",
        moderation: "low",
      }),
    });

    if (!response.ok) await this.handleApiError(response, "OpenAI Image");
    const data = await response.json();
    const image = data.data?.[0];
    if (image?.b64_json) return `data:image/${this.settings.openaiOutputFormat || "png"};base64,${image.b64_json}`;
    throw new Error("No image data received from OpenAI API.");
  }

  private async generateA1111Image(prompt: string) {
    const response = await fetch(`${this.apiBaseUrl("a1111")}/sdapi/v1/txt2img`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        prompt: this.processPromptWithQualityTags(prompt),
        negative_prompt: this.createNegativePrompt(),
        width: Number(this.settings.imageWidth) || 1024,
        height: Number(this.settings.imageHeight) || 1536,
        steps: Number(this.settings.imageSteps) || 20,
        cfg_scale: Number(this.settings.imageCfgScale) || 1.4,
        sampler_name: this.settings.imageSampler || "Euler a",
        seed: -1,
        batch_count: 1,
        batch_size: 1,
        restore_faces: false,
        tiling: false,
        enable_hr: false,
        send_images: true,
        save_images: false,
      }),
    });

    if (!response.ok) await this.handleApiError(response, "Automatic1111");
    const data = await response.json();
    return data.images?.[0] ? `data:image/png;base64,${data.images[0]}` : null;
  }

  private async ensureSwarmSession() {
    const now = Date.now();
    if (this.swarmSessionId && this.swarmSessionExpiry && now < this.swarmSessionExpiry) return this.swarmSessionId;

    const response = await fetch(`${this.apiBaseUrl("swarmui")}/API/GetNewSession`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    if (!response.ok) await this.handleApiError(response, "SwarmUI Session");
    const data = await response.json();
    if (!data.session_id) throw new Error("Failed to obtain SwarmUI session.");
    this.swarmSessionId = data.session_id;
    this.swarmSessionExpiry = now + 30 * 60 * 1000;
    return this.swarmSessionId;
  }

  private async generateSwarmUIImage(prompt: string) {
    const payload: Record<string, unknown> = {
      session_id: await this.ensureSwarmSession(),
      prompt: this.processPromptWithQualityTags(prompt),
      negativeprompt: this.createNegativePrompt(),
      images: 1,
      width: this.settings.swarmuiWidth || 1024,
      height: this.settings.swarmuiHeight || 1024,
      steps: this.settings.swarmuiSteps || 20,
      cfgscale: this.settings.swarmuiCfgScale || 7.5,
      seed: -1,
    };
    if (this.settings.swarmuiModel.trim()) payload.model = this.settings.swarmuiModel.trim();

    let response = await fetch(`${this.apiBaseUrl("swarmui")}/API/GenerateText2Image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      if (text.includes("invalid_session_id") || response.status === 401) {
        this.swarmSessionId = null;
        this.swarmSessionExpiry = null;
        payload.session_id = await this.ensureSwarmSession();
        response = await fetch(`${this.apiBaseUrl("swarmui")}/API/GenerateText2Image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      if (!response.ok) throw new Error(`SwarmUI API request failed with status ${response.status}: ${text}`);
    }

    const data = await response.json();
    const imagePath = data.images?.[0];
    if (!imagePath) throw new Error(data.error ? `SwarmUI error: ${data.error}` : "No image data received from SwarmUI API.");
    return `${this.apiBaseUrl("swarmui")}/${imagePath}`;
  }

  private async generateKieImage(prompt: string) {
    if (!this.settings.kieApiKey) {
      const model = this.settings.kieImageModelIdentifier;
      if (model.startsWith("google/imagen4")) {
        throw new Error("Kie API key is required for Imagen models after removing the old Imagen backend proxy.");
      }
      throw new Error("Kie API key is required for Kie image generation.");
    }

    const model = this.settings.kieImageModelIdentifier || "gpt-image/1.5-text-to-image";
    const config = KIE_IMAGE_CONFIGS[model] ?? KIE_IMAGE_CONFIGS["gpt-image/1.5-text-to-image"];
    const response = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.settings.kieApiKey}`,
      },
      body: JSON.stringify({
        model,
        input: this.createKieImageInput(prompt, config),
      }),
    });

    const data = await this.readJsonOrText(response);
    if (!response.ok || (data.code && Number(data.code) !== 200)) {
      throw new Error(data.msg || `Kie image task failed with status ${response.status}`);
    }

    const taskId = data.data?.taskId;
    if (!taskId) throw new Error("Kie did not return a taskId.");
    const record = await this.pollKieTask(taskId);
    const imageUrl = this.extractKieResultUrl(record);
    if (!imageUrl) throw new Error("Kie image task completed without an image URL.");
    return imageUrl;
  }

  private createKieImageInput(prompt: string, config: KieConfig) {
    const fields = new Set(config.fields);
    const input: Record<string, unknown> = { prompt: prompt.trim() };
    this.applyKieImageSources(input, config);

    if (fields.has("aspect_ratio")) input.aspect_ratio = this.settings.kieImageAspectRatio || "1:1";
    if (fields.has("quality")) {
      const requested = this.settings.kieImageQuality || config.qualityDefault;
      input.quality = config.qualityValues?.length && requested ? (config.qualityValues.includes(requested) ? requested : config.qualityDefault) : requested;
    }
    if (fields.has("resolution")) input.resolution = this.settings.kieImageResolution || "1K";
    if (fields.has("image_resolution")) input.image_resolution = this.settings.kieImageResolution || "1K";
    if (fields.has("output_format")) input.output_format = this.settings.kieImageOutputFormat || "png";
    if (fields.has("image_size") && config.imageSizeDefault) input.image_size = config.imageSizeDefault;
    if (fields.has("nsfw_checker")) input.nsfw_checker = !this.settings.veilChatAfterDark;
    if (fields.has("enable_safety_checker")) input.enable_safety_checker = true;
    if (fields.has("rendering_speed")) input.rendering_speed = "BALANCED";
    if (fields.has("expand_prompt")) input.expand_prompt = true;
    if (fields.has("style")) input.style = "AUTO";
    if (fields.has("num_images")) input.num_images = 1;
    if (fields.has("max_images")) input.max_images = 1;
    if (fields.has("enable_pro")) input.enable_pro = false;
    if (fields.has("enable_sequential")) input.enable_sequential = false;
    if (fields.has("thinking_mode")) input.thinking_mode = false;
    if (fields.has("strength")) input.strength = 0.8;
    if (fields.has("negative_prompt")) input.negative_prompt = this.createNegativePrompt();
    if (fields.has("seed")) input.seed = -1;
    return input;
  }

  private applyKieImageSources(input: Record<string, unknown>, config: KieConfig) {
    if (config.imageField && !this.kieReferenceImageUrls.length && !config.optionalImage) {
      throw new Error("Attach an image before using this Kie image-editing model.");
    }
    if (!config.imageField || !this.kieReferenceImageUrls.length) return;

    if (config.imageField === "image_url") input.image_url = this.kieReferenceImageUrls[0];
    else input[config.imageField] = this.kieReferenceImageUrls;

    if (config.extraImageField && this.kieReferenceImageUrls.length > 1) {
      input[config.extraImageField] = this.kieReferenceImageUrls.slice(1);
    }
  }

  private async pollKieTask(taskId: string) {
    const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

    for (let attempt = 0; attempt < 48; attempt++) {
      if (attempt > 0) await delay(Math.min(2500 + attempt * 250, 6000));

      const response = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
        headers: { Authorization: `Bearer ${this.settings.kieApiKey}` },
      });
      const data = await this.readJsonOrText(response);
      if (!response.ok) throw new Error(data.msg || `Kie task polling failed with status ${response.status}`);

      const state = String(data.data?.state || data.data?.status || data.data?.taskStatus || "").toLowerCase();
      if (["success", "succeeded", "completed", "complete", "done"].includes(state)) return data;
      if (["failed", "fail", "error", "cancelled", "canceled"].includes(state)) {
        throw new Error(data.data?.failMsg || data.data?.failCode || "Kie image task failed.");
      }
    }

    throw new Error("Kie image task timed out before a result was ready.");
  }

  private extractKieResultUrl(record: Record<string, any>) {
    const resultJson = record?.data?.resultJson;
    let parsed: Record<string, any> = {};
    try {
      parsed = typeof resultJson === "string" ? JSON.parse(resultJson) : resultJson || {};
    } catch {
      if (typeof resultJson === "string" && /^https?:\/\//i.test(resultJson)) return resultJson;
    }

    const data = record?.data ?? {};
    const candidates = [
      data.resultUrls,
      data.result_urls,
      data.imageUrls,
      data.images,
      data.urls,
      data.files,
      data.response?.resultUrls,
      data.response?.imageUrls,
      parsed.resultUrls,
      parsed.result_urls,
      parsed.imageUrls,
      parsed.images,
      parsed.urls,
      parsed.files,
      parsed.data?.resultUrls,
      parsed.data?.imageUrls,
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate) && candidate.length) {
        const first = candidate[0];
        if (typeof first === "string") return first;
        if (first?.url) return first.url;
      }
    }

    return data.url || data.imageUrl || parsed.url || parsed.imageUrl || null;
  }

  private readFileAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
      reader.readAsDataURL(file);
    });
  }

  private async readJsonOrText(response: Response) {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return { msg: text };
    }
  }

  private async handleApiError(response: Response, provider: string): Promise<never> {
    const errorText = await response.text();
    throw new Error(`${provider} API request failed with status ${response.status}: ${errorText}`);
  }
}
