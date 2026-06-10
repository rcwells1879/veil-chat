export type LlmProvider = "litellm" | "lmstudio" | "ollama" | "openai-direct" | "anthropic-direct" | "google-direct";
export type ImageProvider = "a1111" | "swarmui" | "openai" | "imagen4";

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

const get = (key: string, fallback = "") => localStorage.getItem(key) ?? fallback;
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
    customLlmApiKey: get("customLlmApiKey"),
    openaiModelIdentifier: get("openaiModelIdentifier", "gpt-4.1-mini"),
    openaiApiKey: get("openaiApiKey"),
    anthropicModelIdentifier: get("anthropicModelIdentifier", "claude-sonnet-4"),
    anthropicApiKey: get("anthropicApiKey"),
    googleModelIdentifier: get("googleModelIdentifier", "gemini-2.5-flash"),
    googleApiKey: get("googleApiKey"),
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
    ttsVoice: get("ttsVoice", "Sonia"),
    voiceSpeed: getNumber("voiceSpeed", 1),
    voicePitch: getNumber("voicePitch", 1),
    azureApiKey: get("azureApiKey") || get("azure-api-key"),
    azureRegion: get("azureRegion", "eastus"),
    fontSize: getNumber("fontSize", 16),
    mcpEnabled: getBool("mcpEnabled"),
    mcpServerUrl: get("mcpServerUrl"),
    searchEnabled: getBool("searchEnabled"),
    searchProvider: get("searchProvider", "brave"),
    searchApiKey: get("searchApiKey"),
    searchResultsLimit: get("searchResultsLimit", "10"),
    searchAutoSummarize: getBool("searchAutoSummarize", true),
    searchTimeFilter: get("searchTimeFilter", "any"),
    chatBackdropEnabled: getBool("chatBackdropEnabled", true),
  };
}

export function persistSettings(settings: AppSettings) {
  Object.entries(settings).forEach(([key, value]) => {
    localStorage.setItem(key, String(value));
  });
  localStorage.setItem("azure-api-key", settings.azureApiKey);
  window.SETTINGS = { ...settings };
}

export function updateSetting<K extends keyof AppSettings>(settings: AppSettings, key: K, value: AppSettings[K]): AppSettings {
  const next = { ...settings, [key]: value };
  persistSettings(next);
  return next;
}
