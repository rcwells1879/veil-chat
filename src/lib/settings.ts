export type LlmProvider = "litellm" | "lmstudio" | "ollama" | "openai-direct" | "anthropic-direct" | "google-direct" | "kie-direct";
export type ImageProvider = "a1111" | "swarmui" | "openai" | "imagen4" | "kie";
export type KieReasoningLevel = "high" | "low" | "off";

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
  { group: "Wan", value: "wan/2-7-image", label: "Wan 2.7 Image" },
  { group: "Wan", value: "wan/2-7-image-pro", label: "Wan 2.7 Image Pro" },
  { group: "Z", value: "z-image", label: "Z-Image" },
] as const;

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
  imagen4AspectRatio: string;
  imagen4OutputFormat: string;
  imagen4PersonGeneration: string;
  kieImageModelIdentifier: string;
  kieImageAspectRatio: string;
  kieImageQuality: string;
  kieImageResolution: string;
  kieImageOutputFormat: string;
  ttsVoice: string;
  voiceSpeed: number;
  voicePitch: number;
  azureApiKey: string;
  azureRegion: string;
  fontSize: number;
  mcpEnabled: boolean;
  mcpServerUrl: string;
  searchEnabled: boolean;
  searchProvider: string;
  searchApiKey: string;
  searchResultsLimit: string;
  searchAutoSummarize: boolean;
  searchTimeFilter: string;
  chatBackdropEnabled: boolean;
}

const SECRET_SETTING_KEYS = new Set([
  "customLlmApiKey",
  "openaiApiKey",
  "anthropicApiKey",
  "googleApiKey",
  "kieApiKey",
  "azureApiKey",
  "azure-api-key",
  "searchApiKey",
]);

const get = (key: string, fallback = "") => localStorage.getItem(key) ?? fallback;
const getSecret = (key: string, fallback = "") => sessionStorage.getItem(key) ?? localStorage.getItem(key) ?? fallback;
const getNumber = (key: string, fallback: number) => {
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) ? value : fallback;
};
const getBool = (key: string, fallback = false) => {
  const value = localStorage.getItem(key);
  return value === null ? fallback : value === "true";
};

export function readSettings(): AppSettings {
  return {
    customLlmProvider: get("customLlmProvider", "litellm") as LlmProvider,
    customLlmApiUrl: get("customLlmApiUrl").replace(/\/$/, ""),
    customLlmModelIdentifier: get("customLlmModelIdentifier", "gemini2.5-flash"),
    customLlmApiKey: getSecret("customLlmApiKey"),
    openaiModelIdentifier: get("openaiModelIdentifier", "gpt-4.1-mini"),
    openaiApiKey: getSecret("openaiApiKey"),
    anthropicModelIdentifier: get("anthropicModelIdentifier", "claude-sonnet-4"),
    anthropicApiKey: getSecret("anthropicApiKey"),
    googleModelIdentifier: get("googleModelIdentifier", "gemini-2.5-flash"),
    googleApiKey: getSecret("googleApiKey"),
    kieModelIdentifier: get("kieModelIdentifier", "gpt-5-2"),
    kieApiKey: getSecret("kieApiKey"),
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
    imagen4AspectRatio: get("imagen4AspectRatio", "1:1"),
    imagen4OutputFormat: get("imagen4OutputFormat", "image/jpeg"),
    imagen4PersonGeneration: get("imagen4PersonGeneration", "ALLOW_ADULT"),
    kieImageModelIdentifier: get("kieImageModelIdentifier", "gpt-image/1.5-text-to-image"),
    kieImageAspectRatio: get("kieImageAspectRatio", "1:1"),
    kieImageQuality: get("kieImageQuality", "medium"),
    kieImageResolution: get("kieImageResolution", "1K"),
    kieImageOutputFormat: get("kieImageOutputFormat", "png"),
    ttsVoice: get("ttsVoice", "Sonia"),
    voiceSpeed: getNumber("voiceSpeed", 1),
    voicePitch: getNumber("voicePitch", 1),
    azureApiKey: getSecret("azureApiKey") || getSecret("azure-api-key"),
    azureRegion: get("azureRegion", "eastus"),
    fontSize: getNumber("fontSize", 16),
    mcpEnabled: getBool("mcpEnabled"),
    mcpServerUrl: get("mcpServerUrl"),
    searchEnabled: getBool("searchEnabled"),
    searchProvider: get("searchProvider", "brave"),
    searchApiKey: getSecret("searchApiKey"),
    searchResultsLimit: get("searchResultsLimit", "10"),
    searchAutoSummarize: getBool("searchAutoSummarize", true),
    searchTimeFilter: get("searchTimeFilter", "any"),
    chatBackdropEnabled: getBool("chatBackdropEnabled", true),
  };
}

export function persistSettings(settings: AppSettings) {
  Object.entries(settings).forEach(([key, value]) => {
    if (SECRET_SETTING_KEYS.has(key)) {
      if (value) sessionStorage.setItem(key, String(value));
      else sessionStorage.removeItem(key);
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, String(value));
  });
  if (settings.azureApiKey) sessionStorage.setItem("azure-api-key", settings.azureApiKey);
  else sessionStorage.removeItem("azure-api-key");
  localStorage.removeItem("azure-api-key");
  exposeSettings(settings);
}

export function exposeSettings(settings: AppSettings) {
  window.SETTINGS = Object.fromEntries(Object.entries(settings).map(([key, value]) => [
    key,
    SECRET_SETTING_KEYS.has(key) ? "" : value,
  ]));
}

export function updateSetting<K extends keyof AppSettings>(settings: AppSettings, key: K, value: AppSettings[K]): AppSettings {
  const next = { ...settings, [key]: value };
  persistSettings(next);
  return next;
}
