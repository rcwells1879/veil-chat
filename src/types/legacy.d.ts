export {};

declare global {
  interface Window {
    SecurityValidator?: new () => LegacySecurityValidator;
    securityValidator?: LegacySecurityValidator;
    LLMService?: new (
      apiBaseUrl: string,
      providerType?: string,
      modelIdentifier?: string | null,
      apiKey?: string | null,
      directProviders?: Record<string, string>
    ) => LegacyLLMService;
    ImageService?: new (
      apiBaseUrl: string,
      provider?: string,
      openaiApiKey?: string | null,
      googleApiKey?: string | null
    ) => LegacyImageService;
    VoiceService?: new (
      sttResultCallback?: (text: string) => void,
      sttErrorCallback?: (error: string) => void,
      sttListeningStateCallback?: (isListening: boolean) => void
    ) => LegacyVoiceService;
    voiceService?: LegacyVoiceService | null;
    ContextService?: new () => LegacyContextService;
    MCPClient?: new (serverUrl?: string | null) => LegacyMCPClient;
    SETTINGS?: Record<string, unknown>;
    pdfjsLib?: unknown;
    mammoth?: unknown;
  }

  interface Navigator {
    standalone?: boolean;
  }
}

export interface LegacySecurityValidator {
  validateUserInput(input: string, type: string): {
    isValid: boolean;
    sanitizedInput: string;
    violations: string[];
    riskLevel?: string;
  };
  validateAttachedFileContent?: (
    content: string,
    fileName: string,
    fileType: string
  ) => {
    isValid: boolean;
    sanitizedContent: string;
    violations: string[];
    riskLevel?: string;
  };
  logSecurityEvent?: (eventName: string, details: Record<string, unknown>) => void;
}

export interface LegacyLLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
  hidden?: boolean;
  timestamp?: string;
}

export interface LegacyLLMService {
  apiBaseUrl: string;
  providerType: string;
  modelIdentifier: string | null;
  apiKey: string | null;
  directProviders?: Record<string, string>;
  conversationHistory: LegacyLLMMessage[];
  characterInitialized: boolean;
  sendMessage: (
    message: string,
    documentContext?: string,
    skipAddingUserMessage?: boolean
  ) => Promise<
    | { type: "image_request"; prompt: string }
    | { type: "text"; content: string }
    | { type: "error"; content: string }
  >;
  clearConversationHistory: () => void;
  saveConversationHistory: () => void;
  loadConversationHistory: () => void;
  setCustomPersona: (customPersonaPrompt: string, preserveHistory?: boolean) => void;
  resetPersona: () => void;
  generateCharacterProfile: () => Promise<void>;
  generateInitialPersonaContent: () => Promise<{ imagePrompt: string | null; greeting: string }>;
  getCharacterProfile: () => string | null;
  updateDirectProviders: (directProviders: Record<string, string>) => void;
}

export interface LegacyImageService {
  apiBaseUrl: string;
  provider: string;
  openaiApiKey?: string | null;
  googleApiKey?: string | null;
  updateSettings: (settings: Record<string, unknown>) => void;
  generateImage: (prompt: string) => Promise<string | null>;
  attachReferenceImages?: (files: File[]) => Promise<string[]>;
  clearReferenceImages?: () => void;
  getReferenceImageCount?: () => number;
}

export interface LegacyVoiceService {
  isRecognitionActive: boolean;
  accumulatedTranscript: string;
  isSynthesisSupported: () => boolean;
  isRecognitionSupported: () => boolean;
  speak: (text: string, preferredVoiceKeyword?: string) => Promise<void>;
  stopSpeaking: () => void;
  toggleSTT: () => boolean;
  stopSTT: () => string;
  setVoiceRate: (rate: number | string) => void;
  setVoicePitch: (pitch: number | string) => void;
  setAzureConfig: (apiKey: string, region: string) => void;
  setVoiceDropdownCallback?: (callback: (selectedVoice: string) => void) => void;
  updateUserVoiceSetting?: (characterProfile: string, settingsObject: Record<string, unknown>) => string | null;
}

export interface AttachedDocument {
  id: number;
  name: string;
  type: string;
  size: number;
  content: string;
  preview: string;
  addedAt: string;
  securityValidated?: boolean;
  originallyBlocked?: boolean;
}

export interface LegacyContextService {
  attachedDocuments: AttachedDocument[];
  processFiles: (files: File[]) => Promise<Array<{ success: true; document: AttachedDocument } | { success: false; fileName: string; error: string }>>;
  getAttachedDocuments: () => AttachedDocument[];
  getDocumentContext: () => string;
  getDocumentSummary: () => string;
  removeDocument: (documentId: number | string) => number;
  clearAllDocuments: () => void;
  exportContext: () => unknown;
  importContext: (contextData: unknown) => boolean;
}

export interface LegacyMCPClient {
  serverUrl: string;
  isConnected: boolean;
  connect: () => Promise<boolean>;
  callTool: (toolName: string, args: Record<string, unknown>) => Promise<LegacyMCPResult>;
  integrateWithChat: (
    message: string,
    context?: string,
    llmService?: LegacyLLMService | null
  ) => Promise<LegacyMCPResult | null>;
  extractUrlsFromMarkdown?: (text: string) => Array<{ url: string; text: string }>;
}

export interface LegacyMCPResult {
  content?: Array<{ type?: string; text: string }>;
  isAgentResult?: boolean;
  needsLLMProcessing?: boolean;
  fallback?: boolean;
  [key: string]: unknown;
}
