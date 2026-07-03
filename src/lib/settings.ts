export type LlmProvider = "litellm" | "lmstudio" | "ollama" | "openai-direct" | "anthropic-direct" | "google-direct" | "kie-direct";
export type ImageProvider = "a1111" | "swarmui" | "openai" | "kie";
export type KieReasoningLevel = "high" | "low" | "off";
export type SearchProvider = "brave" | "google";

export const KIE_CHAT_MODELS = [
  { group: "GPT", value: "gpt-5-2", label: "GPT 5.2" },
  { group: "GPT", value: "gpt-5-4", label: "GPT 5.4 Response" },
  { group: "GPT", value: "gpt-5-5", label: "GPT 5.5 Response" },
  { group: "Codex", value: "gpt-5-codex", label: "GPT Codex 5" },
  { group: "Codex", value: "gpt-5.1-codex", label: "GPT Codex 5.1" },
  { group: "Codex", value: "gpt-5.2-codex", label: "GPT Codex 5.2" },
  { group: "Codex", value: "gpt-5.3-codex", label: "GPT Codex 5.3" },
  { group: "Codex", value: "gpt-5.4-codex", label: "GPT Codex 5.4" },
  { group: "Claude", value: "claude-opus-4-7", label: "Claude Opus 4.7" },
  { group: "Claude", value: "claude-opus-4-8", label: "Claude Opus 4.8" },
  { group: "Claude", value: "claude-fable-5", label: "Claude Fable 5" },
  { group: "Claude", value: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
  { group: "Claude", value: "claude-opus-4-5", label: "Claude Opus 4.5" },
  { group: "Claude", value: "claude-opus-4-6", label: "Claude Opus 4.6" },
  { group: "Claude", value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
  { group: "Claude", value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { group: "Gemini", value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { group: "Gemini", value: "gemini-3-pro", label: "Gemini 3 Pro" },
  { group: "Gemini", value: "gemini-3.1-pro", label: "Gemini 3.1 Pro" },
  { group: "Gemini", value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { group: "Gemini", value: "gemini-3-flash", label: "Gemini 3 Flash" },
  { group: "Gemini", value: "gemini-3-5-flash-openai", label: "Gemini 3.5 Flash OpenAI" },
  { group: "Gemini", value: "gemini-3-5-flash-native", label: "Gemini 3.5 Flash Native" },
  { group: "Gemini", value: "gemini-3-flash-v1beta-native", label: "Gemini 3 Flash Native" },
] as const;

export const KIE_IMAGE_MODELS = [
  { group: "Seedream", value: "bytedance/seedream", label: "Seedream 3.0 Text" },
  { group: "Seedream", value: "bytedance/seedream-v4-text-to-image", label: "Seedream 4.0 Text" },
  { group: "Seedream", value: "bytedance/seedream-v4-edit", label: "Seedream 4.0 Edit" },
  { group: "Seedream", value: "seedream/4.5-text-to-image", label: "Seedream 4.5 Text" },
  { group: "Seedream", value: "seedream/4.5-edit", label: "Seedream 4.5 Edit" },
  { group: "Seedream", value: "seedream/5-lite-text-to-image", label: "Seedream 5 Lite Text" },
  { group: "Seedream", value: "seedream/5-lite-image-to-image", label: "Seedream 5 Lite Image" },
  { group: "Google", value: "nano-banana-2", label: "Nano Banana 2" },
  { group: "Google", value: "google/imagen4-fast", label: "Imagen 4 Fast" },
  { group: "Google", value: "google/imagen4", label: "Imagen 4" },
  { group: "Google", value: "google/imagen4-ultra", label: "Imagen 4 Ultra" },
  { group: "Google", value: "google/nano-banana", label: "Nano Banana" },
  { group: "Google", value: "google/nano-banana-edit", label: "Nano Banana Edit" },
  { group: "Google", value: "nano-banana-pro", label: "Nano Banana Pro Image" },
  { group: "Flux", value: "flux-2/pro-text-to-image", label: "Flux 2 Pro Text" },
  { group: "Flux", value: "flux-2/pro-image-to-image", label: "Flux 2 Pro Image" },
  { group: "Flux", value: "flux-2/flex-text-to-image", label: "Flux 2 Flex Text" },
  { group: "Flux", value: "flux-2/flex-image-to-image", label: "Flux 2 Flex Image" },
  { group: "Grok", value: "grok-imagine/text-to-image", label: "Grok Imagine Text" },
  { group: "Grok", value: "grok-imagine/image-to-image", label: "Grok Imagine Image" },
  { group: "GPT Image", value: "gpt-image/1.5-text-to-image", label: "GPT Image 1.5 Text" },
  { group: "GPT Image", value: "gpt-image/1.5-image-to-image", label: "GPT Image 1.5 Image" },
  { group: "GPT Image", value: "gpt-image-2-text-to-image", label: "GPT Image 2 Text" },
  { group: "GPT Image", value: "gpt-image-2-image-to-image", label: "GPT Image 2 Image" },
  { group: "Ideogram", value: "ideogram/v3-text-to-image", label: "Ideogram V3 Text" },
  { group: "Ideogram", value: "ideogram/v3-edit", label: "Ideogram V3 Edit" },
  { group: "Ideogram", value: "ideogram/v3-remix", label: "Ideogram V3 Remix" },
  { group: "Ideogram", value: "ideogram/character", label: "Ideogram Character" },
  { group: "Ideogram", value: "ideogram/character-edit", label: "Ideogram Character Edit" },
  { group: "Ideogram", value: "ideogram/character-remix", label: "Ideogram Character Remix" },
  { group: "Qwen", value: "qwen/text-to-image", label: "Qwen Text" },
  { group: "Qwen", value: "qwen/image-to-image", label: "Qwen Image" },
  { group: "Qwen", value: "qwen/image-edit", label: "Qwen Edit" },
  { group: "Qwen", value: "qwen2/text-to-image", label: "Qwen2 Text" },
  { group: "Qwen", value: "qwen2/image-edit", label: "Qwen2 Edit" },
  { group: "Wan", value: "wan/2-7-image", label: "Wan 2.7 Image (Gen/Edit)" },
  { group: "Wan", value: "wan/2-7-image-pro", label: "Wan 2.7 Image Pro (Gen/Edit)" },
  { group: "Z", value: "z-image", label: "Z-Image" },
] as const;

const KIE_IMAGE_MODEL_ALIASES: Record<string, string> = {
  "wan-2-7-image": "wan/2-7-image",
  "wan/2.7-image": "wan/2-7-image",
  "wan-2.7-image": "wan/2-7-image",
  "wan/2-7-image-standard": "wan/2-7-image",
  "wan-2-7-image-pro": "wan/2-7-image-pro",
  "wan/2.7-image-pro": "wan/2-7-image-pro",
  "wan-2.7-image-pro": "wan/2-7-image-pro",
};

export function normalizeKieImageModelIdentifier(model: string) {
  const trimmed = model.trim();
  return KIE_IMAGE_MODEL_ALIASES[trimmed.toLowerCase()] ?? trimmed;
}

export type SelectOption = { value: string; label: string };

export interface KieImageModelControls {
  aspectRatios: readonly SelectOption[];
  qualities: readonly SelectOption[];
  resolutions: readonly SelectOption[];
  outputs: readonly SelectOption[];
  defaults: {
    aspectRatio?: string;
    quality?: string;
    resolution?: string;
    outputFormat?: string;
  };
}

const STANDARD_ASPECT_RATIOS = [
  { value: "1:1", label: "1:1" },
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "4:3", label: "4:3" },
  { value: "3:4", label: "3:4" },
  { value: "3:2", label: "3:2" },
  { value: "2:3", label: "2:3" },
  { value: "auto", label: "Auto" },
] as const;

const WAN_ASPECT_RATIOS = [
  { value: "1:1", label: "1:1" },
  { value: "3:4", label: "3:4" },
  { value: "4:3", label: "4:3" },
  { value: "1:8", label: "1:8" },
  { value: "8:1", label: "8:1" },
  { value: "9:16", label: "9:16" },
  { value: "16:9", label: "16:9" },
  { value: "21:9", label: "21:9" },
] as const;

const KIE_RESOLUTIONS = [
  { value: "1K", label: "1K" },
  { value: "2K", label: "2K" },
  { value: "4K", label: "4K" },
] as const;

const WAN_RESOLUTIONS = [
  { value: "1K", label: "1K" },
  { value: "2K", label: "2K" },
] as const;

const KIE_OUTPUTS = [
  { value: "png", label: "PNG" },
  { value: "jpg", label: "JPG" },
] as const;

const EMPTY_OPTIONS: readonly SelectOption[] = [];

const ASPECT_RATIO_MODELS = new Set([
  "seedream/4.5-text-to-image",
  "seedream/4.5-edit",
  "seedream/5-lite-text-to-image",
  "seedream/5-lite-image-to-image",
  "nano-banana-2",
  "google/imagen4-fast",
  "google/imagen4",
  "google/imagen4-ultra",
  "google/nano-banana",
  "google/nano-banana-edit",
  "nano-banana-pro",
  "flux-2/pro-text-to-image",
  "flux-2/pro-image-to-image",
  "flux-2/flex-text-to-image",
  "flux-2/flex-image-to-image",
  "grok-imagine/text-to-image",
  "gpt-image/1.5-text-to-image",
  "gpt-image/1.5-image-to-image",
  "gpt-image-2-text-to-image",
  "gpt-image-2-image-to-image",
  "z-image",
]);

const RESOLUTION_MODELS = new Set([
  "bytedance/seedream-v4-text-to-image",
  "bytedance/seedream-v4-edit",
  "nano-banana-2",
  "nano-banana-pro",
  "flux-2/pro-text-to-image",
  "flux-2/pro-image-to-image",
  "flux-2/flex-text-to-image",
  "flux-2/flex-image-to-image",
  "gpt-image-2-text-to-image",
  "gpt-image-2-image-to-image",
]);

const OUTPUT_MODELS = new Set([
  "nano-banana-2",
  "google/nano-banana",
  "google/nano-banana-edit",
  "nano-banana-pro",
  "qwen/text-to-image",
  "qwen/image-to-image",
  "qwen/image-edit",
  "qwen2/text-to-image",
  "qwen2/image-edit",
]);

export function getKieImageModelControls(model: string): KieImageModelControls {
  const normalizedModel = normalizeKieImageModelIdentifier(model);

  if (normalizedModel === "wan/2-7-image" || normalizedModel === "wan/2-7-image-pro") {
    return {
      aspectRatios: WAN_ASPECT_RATIOS,
      qualities: EMPTY_OPTIONS,
      resolutions: normalizedModel === "wan/2-7-image-pro" ? KIE_RESOLUTIONS : WAN_RESOLUTIONS,
      outputs: EMPTY_OPTIONS,
      defaults: {
        aspectRatio: "1:1",
        resolution: "2K",
      },
    };
  }

  return {
    aspectRatios: ASPECT_RATIO_MODELS.has(normalizedModel) ? STANDARD_ASPECT_RATIOS : EMPTY_OPTIONS,
    qualities: EMPTY_OPTIONS,
    resolutions: RESOLUTION_MODELS.has(normalizedModel) ? KIE_RESOLUTIONS : EMPTY_OPTIONS,
    outputs: OUTPUT_MODELS.has(normalizedModel) ? KIE_OUTPUTS : EMPTY_OPTIONS,
    defaults: {
      aspectRatio: "1:1",
      resolution: "1K",
      outputFormat: "png",
    },
  };
}

export interface AppSettings {
  customLlmProvider: LlmProvider;
  customLlmApiUrl: string;
  customLlmModelIdentifier: string;
  customLlmApiKey: string;
  openaiModelIdentifier: string;
  openaiApiKey: string;
  anthropicModelIdentifier: string;
  anthropicApiKey: string;
  googleModelIdentifier: string;
  googleApiKey: string;
  kieModelIdentifier: string;
  kieApiKey: string;
  kieReasoningLevel: KieReasoningLevel;
  customImageProvider: ImageProvider;
  customImageApiUrl: string;
  imageSize: string;
  imageWidth: string;
  imageHeight: string;
  imageSteps: string;
  imageCfgScale: string;
  imageSampler: string;
  openaiQuality: string;
  openaiOutputFormat: string;
  openaiBackground: string;
  swarmuiApiUrl: string;
  swarmuiWidth: number;
  swarmuiHeight: number;
  swarmuiSteps: number;
  swarmuiCfgScale: number;
  swarmuiModel: string;
  swarmuiSampler: string;
  kieImageModelIdentifier: string;
  kieImageAspectRatio: string;
  kieImageQuality: string;
  kieImageResolution: string;
  kieImageOutputFormat: string;
  veilChatAfterDark: boolean;
  ttsVoice: string;
  voiceSpeed: number;
  voicePitch: number;
  fontSize: number;
  searchEnabled: boolean;
  searchProvider: SearchProvider;
  braveSearchApiKey: string;
  googleSearchApiKey: string;
  googleSearchEngineId: string;
  searchResultsLimit: string;
  chatBackdropEnabled: boolean;
}

const API_KEY_SETTING_KEYS = new Set([
  "customLlmApiKey",
  "openaiApiKey",
  "anthropicApiKey",
  "googleApiKey",
  "kieApiKey",
  "braveSearchApiKey",
  "googleSearchApiKey",
]);

const LEGACY_SETTING_KEYS = [
  "azureApiKey",
  "azure-api-key",
  "azureRegion",
  "mcpEnabled",
  "mcpServerUrl",
  "searchApiKey",
  "searchAutoSummarize",
  "searchTimeFilter",
  "imagen4AspectRatio",
  "imagen4OutputFormat",
  "imagen4PersonGeneration",
];

const get = (key: string, fallback = "") => localStorage.getItem(key) ?? fallback;
const getApiKey = (key: string, fallback = "") => localStorage.getItem(key) ?? sessionStorage.getItem(key) ?? fallback;
const getNumber = (key: string, fallback: number) => {
  const raw = localStorage.getItem(key);
  if (raw === null || raw.trim() === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
};
const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const getBool = (key: string, fallback = false) => {
  const value = localStorage.getItem(key);
  return value === null ? fallback : value === "true";
};
const getSearchProvider = () => {
  const provider = get("searchProvider", "brave");
  return provider === "google" ? "google" : "brave";
};

function migrateLegacySettings() {
  for (const key of API_KEY_SETTING_KEYS) {
    const sessionValue = sessionStorage.getItem(key);
    if (sessionValue && !localStorage.getItem(key)) {
      localStorage.setItem(key, sessionValue);
    }
    sessionStorage.removeItem(key);
  }

  const oldImageProvider = localStorage.getItem("customImageProvider");
  if (oldImageProvider === "imagen4") {
    localStorage.setItem("customImageProvider", "kie");
    if (!localStorage.getItem("kieImageModelIdentifier")) {
      localStorage.setItem("kieImageModelIdentifier", "google/imagen4-fast");
    }
  }

  const legacySearchKey = sessionStorage.getItem("searchApiKey") ?? localStorage.getItem("searchApiKey");
  if (legacySearchKey) {
    const targetKey = getSearchProvider() === "google" ? "googleSearchApiKey" : "braveSearchApiKey";
    if (!sessionStorage.getItem(targetKey) && !localStorage.getItem(targetKey)) {
      localStorage.setItem(targetKey, legacySearchKey);
    }
  }

  for (const key of LEGACY_SETTING_KEYS) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
}

export function readSettings(): AppSettings {
  migrateLegacySettings();

  return {
    customLlmProvider: get("customLlmProvider", "litellm") as LlmProvider,
    customLlmApiUrl: get("customLlmApiUrl").replace(/\/$/, ""),
    customLlmModelIdentifier: get("customLlmModelIdentifier", "gemini2.5-flash"),
    customLlmApiKey: getApiKey("customLlmApiKey"),
    openaiModelIdentifier: get("openaiModelIdentifier", "gpt-4.1-mini"),
    openaiApiKey: getApiKey("openaiApiKey"),
    anthropicModelIdentifier: get("anthropicModelIdentifier", "claude-sonnet-4"),
    anthropicApiKey: getApiKey("anthropicApiKey"),
    googleModelIdentifier: get("googleModelIdentifier", "gemini-2.5-flash"),
    googleApiKey: getApiKey("googleApiKey"),
    kieModelIdentifier: get("kieModelIdentifier", "gpt-5-2"),
    kieApiKey: getApiKey("kieApiKey"),
    kieReasoningLevel: get("kieReasoningLevel", "high") as KieReasoningLevel,
    customImageProvider: get("customImageProvider", "openai") as ImageProvider,
    customImageApiUrl: get("customImageApiUrl").replace(/\/$/, ""),
    imageSize: get("imageSize", "auto"),
    imageWidth: get("imageWidth", "1024"),
    imageHeight: get("imageHeight", "1536"),
    imageSteps: get("imageSteps", "20"),
    imageCfgScale: get("imageCfgScale", "1.4"),
    imageSampler: get("imageSampler", "Euler a"),
    openaiQuality: get("openaiQuality", "auto"),
    openaiOutputFormat: get("openaiOutputFormat", "png"),
    openaiBackground: get("openaiBackground", "auto"),
    swarmuiApiUrl: get("swarmuiApiUrl", "http://localhost:7801"),
    swarmuiWidth: getNumber("swarmuiWidth", 1024),
    swarmuiHeight: getNumber("swarmuiHeight", 1024),
    swarmuiSteps: getNumber("swarmuiSteps", 20),
    swarmuiCfgScale: getNumber("swarmuiCfgScale", 7.5),
    swarmuiModel: get("swarmuiModel"),
    swarmuiSampler: get("swarmuiSampler", "Euler a"),
    kieImageModelIdentifier: normalizeKieImageModelIdentifier(get("kieImageModelIdentifier", "gpt-image/1.5-text-to-image")),
    kieImageAspectRatio: get("kieImageAspectRatio", "1:1"),
    kieImageQuality: get("kieImageQuality", "medium"),
    kieImageResolution: get("kieImageResolution", "1K"),
    kieImageOutputFormat: get("kieImageOutputFormat", "png"),
    veilChatAfterDark: getBool("veilChatAfterDark"),
    ttsVoice: get("ttsVoice", "Sonia"),
    voiceSpeed: getNumber("voiceSpeed", 1),
    voicePitch: getNumber("voicePitch", 1),
    fontSize: clampNumber(getNumber("fontSize", 16), 12, 22),
    searchEnabled: getBool("searchEnabled"),
    searchProvider: getSearchProvider(),
    braveSearchApiKey: getApiKey("braveSearchApiKey"),
    googleSearchApiKey: getApiKey("googleSearchApiKey"),
    googleSearchEngineId: get("googleSearchEngineId"),
    searchResultsLimit: get("searchResultsLimit", "10"),
    chatBackdropEnabled: getBool("chatBackdropEnabled", true),
  };
}

export function persistSettings(settings: AppSettings) {
  Object.entries(settings).forEach(([key, value]) => {
    if (API_KEY_SETTING_KEYS.has(key)) {
      if (value) localStorage.setItem(key, String(value));
      else localStorage.removeItem(key);
      sessionStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, String(value));
  });
}

export function updateSetting<K extends keyof AppSettings>(settings: AppSettings, key: K, value: AppSettings[K]): AppSettings {
  const next = key === "fontSize"
    ? { ...settings, fontSize: clampNumber(Number(value), 12, 22) }
    : key === "kieImageModelIdentifier"
      ? { ...settings, kieImageModelIdentifier: normalizeKieImageModelIdentifier(String(value)) }
      : { ...settings, [key]: value };
  persistSettings(next);
  return next;
}
