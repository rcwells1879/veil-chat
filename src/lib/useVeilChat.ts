import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  AttachedDocument,
  LegacyContextService,
  LegacyImageService,
  LegacyLLMService,
  LegacyMCPClient,
  LegacyMCPResult,
  LegacyVoiceService,
} from "../types/legacy";
import { createImageMessage, createTextMessage, downloadJson, historyToMessages, keywordsHelp, type ChatMessage } from "./format";
import { exposeSettings, type AppSettings, persistSettings, readSettings, updateSetting } from "./settings";

type BusyMode = "idle" | "thinking" | "image" | "persona" | "search";
type View = "chat" | "persona" | "settings" | "history";
type LLMResponse = Awaited<ReturnType<LegacyLLMService["sendMessage"]>>;

interface ConversationFile {
  version?: string;
  savedAt?: string;
  personaPrompt?: string | null;
  llmServiceState?: {
    conversationHistory?: LegacyLLMService["conversationHistory"];
    characterInitialized?: boolean;
  };
  documentContext?: unknown;
}

const directProviders = (settings: AppSettings) => ({
  openaiModel: settings.openaiModelIdentifier,
  openaiApiKey: settings.openaiApiKey,
  anthropicModel: settings.anthropicModelIdentifier,
  anthropicApiKey: settings.anthropicApiKey,
  googleModel: settings.googleModelIdentifier,
  googleApiKey: settings.googleApiKey,
  kieModel: settings.kieModelIdentifier,
  kieApiKey: settings.kieApiKey,
  kieReasoningLevel: settings.kieReasoningLevel,
});

const imageApiUrl = (settings: AppSettings) =>
  settings.customImageProvider === "swarmui" ? settings.swarmuiApiUrl : settings.customImageApiUrl;

function ensureLegacyGlobals() {
  if (!window.securityValidator && window.SecurityValidator) {
    window.securityValidator = new window.SecurityValidator();
  }
}

function makeLLM(settings: AppSettings) {
  if (!window.LLMService) throw new Error("LLM service did not load.");
  return new window.LLMService(
    settings.customLlmApiUrl,
    settings.customLlmProvider,
    settings.customLlmModelIdentifier,
    settings.customLlmApiKey,
    directProviders(settings)
  );
}

function makeImageService(settings: AppSettings) {
  if (!window.ImageService) throw new Error("Image service did not load.");
  const service = new window.ImageService(imageApiUrl(settings), settings.customImageProvider, settings.openaiApiKey, settings.googleApiKey);
  service.updateSettings({
    width: Number(settings.imageWidth) || 1024,
    height: Number(settings.imageHeight) || 1536,
    steps: Number(settings.imageSteps) || 20,
    cfg_scale: Number(settings.imageCfgScale) || 1.4,
    sampler_name: settings.imageSampler,
    size: settings.imageSize,
    quality: settings.openaiQuality,
    output_format: settings.openaiOutputFormat,
    background: settings.openaiBackground,
    swarm_width: settings.swarmuiWidth,
    swarm_height: settings.swarmuiHeight,
    swarm_steps: settings.swarmuiSteps,
    swarm_cfg_scale: settings.swarmuiCfgScale,
    swarm_model: settings.swarmuiModel || null,
    swarm_sampler: settings.swarmuiSampler,
    imagen4_aspect_ratio: settings.imagen4AspectRatio,
    imagen4_output_format: settings.imagen4OutputFormat,
    imagen4_person_generation: settings.imagen4PersonGeneration,
    kieApiKey: settings.kieApiKey,
    kie_image_model: settings.kieImageModelIdentifier,
    kie_aspect_ratio: settings.kieImageAspectRatio,
    kie_quality: settings.kieImageQuality,
    kie_resolution: settings.kieImageResolution,
    kie_output_format: settings.kieImageOutputFormat,
    provider: settings.customImageProvider,
    openaiApiKey: settings.openaiApiKey,
    googleApiKey: settings.googleApiKey,
    apiBaseUrl: imageApiUrl(settings),
  });
  return service;
}

function validateInput(input: string, type: string) {
  const validator = window.securityValidator;
  if (!validator) return { isValid: true, sanitizedInput: input, violations: [] as string[] };
  return validator.validateUserInput(input, type);
}

function detectSearchKeywords(message: string) {
  const lower = message.toLowerCase();
  const agentKeywords = ["research", "investigate", "find out about", "look into", "gather information about", "what can you tell me about", "learn about", "search for information about"];
  if (agentKeywords.some((keyword) => lower.includes(keyword))) return false;
  return ["search for ", "search the web for ", "look up ", "lookup ", "find me ", "web search "].some((keyword) => lower.includes(keyword));
}

function extractSearchQuery(message: string) {
  const patterns = [/search for (.+)/i, /search the web for (.+)/i, /look up (.+)/i, /lookup (.+)/i, /find me (.+)/i, /web search (.+)/i];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return message.trim();
}

function mcpText(result: LegacyMCPResult | null) {
  return result?.content?.[0]?.text ?? "";
}

function displayResponseContent(response: LLMResponse) {
  if (response.type === "image_request") return "";

  if (response.type === "error" && response.content.toLowerCase().includes("body stream already read")) {
    return "Error: Could not connect to the LLM. Check your provider settings and try again.";
  }

  return response.content;
}

export function useVeilChat() {
  const [settings, setSettings] = useState<AppSettings>(() => readSettings());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [documents, setDocuments] = useState<AttachedDocument[]>([]);
  const [imageReferencesCount, setImageReferencesCount] = useState(0);
  const [busy, setBusy] = useState<BusyMode>("idle");
  const [activeView, setActiveView] = useState<View>("chat");
  const [input, setInput] = useState("");
  const [notice, setNotice] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [personaPrompt, setPersonaPrompt] = useState(() => localStorage.getItem("currentPersonaPrompt") ?? "");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const llmRef = useRef<LegacyLLMService | null>(null);
  const imageRef = useRef<LegacyImageService | null>(null);
  const voiceRef = useRef<LegacyVoiceService | null>(null);
  const contextRef = useRef<LegacyContextService | null>(null);
  const mcpRef = useRef<LegacyMCPClient | null>(null);
  const settingsRef = useRef(settings);

  const addMessage = useCallback((message: ChatMessage, speak = false) => {
    setMessages((current) => [...current, message]);
    if (speak && message.role === "assistant" && message.kind === "text" && voiceRef.current?.isSynthesisSupported()) {
      voiceRef.current.speak(message.content, settingsRef.current.ttsVoice).catch((error) => {
        console.warn("TTS failed:", error);
      });
    }
  }, []);

  const refreshDocs = useCallback(() => {
    setDocuments(contextRef.current?.getAttachedDocuments() ?? []);
    setImageReferencesCount(imageRef.current?.getReferenceImageCount?.() ?? 0);
  }, []);

  const initializeMcp = useCallback(async (nextSettings: AppSettings) => {
    if (!nextSettings.mcpEnabled || !nextSettings.mcpServerUrl || !window.MCPClient) {
      mcpRef.current = null;
      return;
    }

    const existing = mcpRef.current;
    if (existing?.serverUrl === nextSettings.mcpServerUrl && existing.isConnected) {
      return;
    }

    const client = new window.MCPClient(nextSettings.mcpServerUrl);
    mcpRef.current = client;
    try {
      const connected = await client.connect();
      if (!connected) {
        setNotice("MCP server did not connect. Chat will continue without enhanced reasoning.");
      }
    } catch (error) {
      setNotice(`MCP connection failed: ${error instanceof Error ? error.message : String(error)}`);
      mcpRef.current = null;
    }
  }, []);

  const rebuildServices = useCallback(
    async (nextSettings: AppSettings, preserveHistory = true) => {
      ensureLegacyGlobals();
      settingsRef.current = nextSettings;
      exposeSettings(nextSettings);

      const previousHistory = llmRef.current?.conversationHistory;
      const previousInitialized = llmRef.current?.characterInitialized;

      llmRef.current = makeLLM(nextSettings);
      if (preserveHistory && previousHistory) {
        llmRef.current.conversationHistory = previousHistory;
        llmRef.current.characterInitialized = previousInitialized ?? false;
        llmRef.current.saveConversationHistory();
      }

      imageRef.current = makeImageService(nextSettings);

      if (!contextRef.current) {
        if (!window.ContextService) throw new Error("Context service did not load.");
        contextRef.current = new window.ContextService();
      }

      if (!voiceRef.current && window.VoiceService) {
        try {
          voiceRef.current = new window.VoiceService(
            (text) => setInput(text),
            (error) => setNotice(`Voice input error: ${error}`),
            setIsListening
          );
          window.voiceService = voiceRef.current;
        } catch (error) {
          console.warn("Voice service failed to initialize:", error);
        }
      }

      if (voiceRef.current) {
        voiceRef.current.setVoiceRate(nextSettings.voiceSpeed);
        voiceRef.current.setVoicePitch(nextSettings.voicePitch);
        voiceRef.current.setVoiceDropdownCallback?.((selectedVoice) => {
          setSettings((current) => updateSetting(current, "ttsVoice", selectedVoice));
        });
        if (nextSettings.azureApiKey.trim()) {
          voiceRef.current.setAzureConfig(nextSettings.azureApiKey, nextSettings.azureRegion);
        }
      }

      await initializeMcp(nextSettings);
      document.documentElement.style.setProperty("--chat-font-size", `${nextSettings.fontSize}px`);
    },
    [initializeMcp]
  );

  useEffect(() => {
    let cancelled = false;
    rebuildServices(settings, false)
      .then(() => {
        if (cancelled) return;
        setMessages(historyToMessages(llmRef.current?.conversationHistory ?? []));
        refreshDocs();
      })
      .catch((error) => setNotice(error instanceof Error ? error.message : String(error)));

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/veilchat/service-worker.js").catch((error) => console.warn("Service worker registration failed:", error));
      });
    }

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    persistSettings(settings);
    rebuildServices(settings, true).catch((error) => setNotice(error instanceof Error ? error.message : String(error)));
  }, [settings, rebuildServices]);

  const updateAppSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((current) => updateSetting(current, key, value));
  }, []);

  const performWebSearch = useCallback(
    async (query: string) => {
      const client = mcpRef.current;
      if (!client?.isConnected) return null;
      return client.callTool("web_search", {
        query,
        searchSettings: {
          provider: settingsRef.current.searchProvider,
          apiKey: settingsRef.current.searchApiKey,
          limit: Number(settingsRef.current.searchResultsLimit) || 10,
          timeFilter: settingsRef.current.searchTimeFilter,
          autoSummarize: settingsRef.current.searchAutoSummarize,
        },
      });
    },
    []
  );

  const sendMessage = useCallback(
    async (rawMessage?: string) => {
      if (busy !== "idle") return;
      const original = (rawMessage ?? input).trim();
      if (!original) return;

      if (voiceRef.current?.isRecognitionActive) {
        voiceRef.current.stopSTT();
      }
      if (voiceRef.current) voiceRef.current.accumulatedTranscript = "";

      const validation = validateInput(original, "userMessage");
      if (!validation.isValid) {
        window.securityValidator?.logSecurityEvent?.("INPUT_BLOCKED", {
          message: original,
          violations: validation.violations,
          riskLevel: validation.riskLevel,
        });
        addMessage(createTextMessage("system", "Your message was blocked by the safety filter. Please rephrase it."), false);
        return;
      }

      const message = validation.sanitizedInput;
      setInput("");

      if (message.toLowerCase().startsWith("/list")) {
        addMessage(createTextMessage("user", "/list"), false);
        addMessage(createTextMessage("assistant", keywordsHelp()), false);
        return;
      }

      const llm = llmRef.current;
      const image = imageRef.current;
      const context = contextRef.current;
      if (!llm || !image || !context) {
        addMessage(createTextMessage("system", "Services are still loading. Try again in a moment."), false);
        return;
      }

      addMessage(createTextMessage("user", message), false);
      const isImageRequest = message.toLowerCase().includes("show me");

      try {
        if (message.toLowerCase().startsWith("xx")) {
          const prompt = message.substring(2).trim();
          const imageValidation = validateInput(prompt, "imagePrompt");
          if (!prompt || !imageValidation.isValid) {
            addMessage(createTextMessage("system", "Please provide a safe image prompt after `xx`."), false);
            return;
          }
          setBusy("image");
          addMessage(createTextMessage("assistant", "Composing image..."), false);
          const imageUrl = await image.generateImage(imageValidation.sanitizedInput);
          addMessage(imageUrl ? createImageMessage("assistant", imageUrl, prompt) : createTextMessage("assistant", "Image generation returned no image."), false);
          return;
        }

        const documentContext = context.getDocumentContext();
        const conversationContext = llm.conversationHistory
          .map((item) => `${item.role}: ${typeof item.content === "string" ? item.content : JSON.stringify(item.content)}`)
          .join("\n");
        const fullContextForMcp = `${documentContext}\n\n${conversationContext}`;

        if (settingsRef.current.searchEnabled && detectSearchKeywords(message)) {
          setBusy("search");
          llm.conversationHistory.push({ role: "user", content: message });
          const result = await performWebSearch(extractSearchQuery(message));
          const text = mcpText(result);
          if (text) {
            addMessage(createTextMessage("assistant", text), false);
            llm.conversationHistory.push({ role: "assistant", content: text });
            llm.saveConversationHistory();
            return;
          }
          addMessage(createTextMessage("system", "Search did not return a result. Check search settings and MCP connectivity."), false);
        }

        if (mcpRef.current?.isConnected) {
          const result = await mcpRef.current.integrateWithChat(message, fullContextForMcp, llm);
          const text = mcpText(result);
          if (text && result?.isAgentResult) {
            addMessage(createTextMessage("assistant", text), true);
            llm.conversationHistory.push({ role: "user", content: message }, { role: "assistant", content: text });
            llm.saveConversationHistory();
            return;
          }
          if (text && !result?.needsLLMProcessing && !result?.fallback) {
            addMessage(createTextMessage("assistant", text), true);
            llm.conversationHistory.push({ role: "user", content: message }, { role: "assistant", content: text });
            llm.saveConversationHistory();
            return;
          }
          if (text && result?.fallback) {
            addMessage(createTextMessage("system", text), false);
          }
        }

        setBusy("thinking");
        const response = await llm.sendMessage(message, documentContext, isImageRequest);
        if (response.type === "image_request") {
          setBusy("image");
          const imageUrl = await image.generateImage(response.prompt);
          addMessage(imageUrl ? createImageMessage("assistant", imageUrl, "Generated image") : createTextMessage("assistant", "I could not generate the image this time."), false);
        } else {
          addMessage(createTextMessage("assistant", displayResponseContent(response)), response.type === "text");
        }
      } catch (error) {
        addMessage(createTextMessage("assistant", `Something went sideways: ${error instanceof Error ? error.message : String(error)}`), false);
      } finally {
        setBusy("idle");
      }
    },
    [addMessage, busy, input, performWebSearch]
  );

  const attachFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      if (!fileArray.length || !contextRef.current) return;

      const imageFiles = fileArray.filter((file) => file.type.startsWith("image/"));
      const documentFiles = fileArray.filter((file) => !file.type.startsWith("image/"));

      if (imageFiles.length) {
        try {
          if (!imageRef.current?.attachReferenceImages) {
            addMessage(createTextMessage("system", "Image references are not ready yet. Try again in a moment."), false);
          } else {
            const references = await imageRef.current.attachReferenceImages(imageFiles);
            setImageReferencesCount(imageRef.current.getReferenceImageCount?.() ?? references.length);
            addMessage(createTextMessage("system", `Attached ${references.length} image reference${references.length === 1 ? "" : "s"} for Kie image editing.`), false);
          }
        } catch (error) {
          addMessage(createTextMessage("system", `Image reference upload failed: ${error instanceof Error ? error.message : String(error)}`), false);
        }
      }

      if (!documentFiles.length) {
        refreshDocs();
        return;
      }

      const results = await contextRef.current.processFiles(documentFiles);
      refreshDocs();

      const successes = results.filter((result) => result.success).length;
      const failures = results.filter((result) => !result.success) as Array<{ success: false; fileName: string; error: string }>;
      if (successes) {
        addMessage(createTextMessage("system", `Attached ${successes} document${successes === 1 ? "" : "s"}: ${contextRef.current.getDocumentSummary()}`), false);
      }
      if (failures.length) {
        addMessage(createTextMessage("system", `Some files could not be attached:\n${failures.map((failure) => `${failure.fileName}: ${failure.error}`).join("\n")}`), false);
      }
    },
    [addMessage, refreshDocs]
  );

  const removeDocument = useCallback(
    (id: number) => {
      contextRef.current?.removeDocument(id);
      refreshDocs();
    },
    [refreshDocs]
  );

  const clearDocuments = useCallback(() => {
    contextRef.current?.clearAllDocuments();
    imageRef.current?.clearReferenceImages?.();
    setImageReferencesCount(0);
    refreshDocs();
  }, [refreshDocs]);

  const toggleVoice = useCallback(() => {
    if (!voiceRef.current?.isRecognitionSupported()) {
      setNotice("Speech recognition is not available in this browser.");
      return;
    }
    voiceRef.current.toggleSTT();
  }, []);

  const newConversation = useCallback(() => {
    llmRef.current?.clearConversationHistory();
    contextRef.current?.clearAllDocuments();
    imageRef.current?.clearReferenceImages?.();
    localStorage.removeItem("currentPersonaPrompt");
    setPersonaPrompt("");
    setMessages([]);
    setInput("");
    setImageReferencesCount(0);
    refreshDocs();
    setActiveView("chat");
  }, [refreshDocs]);

  const createPersona = useCallback(
    async (prompt?: string) => {
      if (busy !== "idle") return;
      const customPrompt = prompt?.trim() ?? "";
      const validation = customPrompt ? validateInput(customPrompt, "characterPrompt") : { isValid: true, sanitizedInput: "", violations: [] as string[] };
      if (!validation.isValid) {
        addMessage(createTextMessage("system", "That persona prompt was blocked by the safety filter. Please rephrase it."), false);
        return;
      }

      setBusy("persona");
      setMessages([]);
      setActiveView("chat");
      try {
        llmRef.current = makeLLM(settingsRef.current);
        llmRef.current.clearConversationHistory();
        contextRef.current?.clearAllDocuments();
        imageRef.current?.clearReferenceImages?.();
        setImageReferencesCount(0);
        refreshDocs();

        if (validation.sanitizedInput) {
          llmRef.current.setCustomPersona(validation.sanitizedInput);
          localStorage.setItem("currentPersonaPrompt", validation.sanitizedInput);
          setPersonaPrompt(validation.sanitizedInput);
        } else {
          localStorage.removeItem("currentPersonaPrompt");
          setPersonaPrompt("");
        }

        addMessage(createTextMessage("assistant", validation.sanitizedInput ? "Creating custom persona..." : "Generating random persona..."), false);
        await llmRef.current.generateCharacterProfile();
        const profile = llmRef.current.getCharacterProfile();
        if (profile && voiceRef.current?.updateUserVoiceSetting) {
          const selected = voiceRef.current.updateUserVoiceSetting(profile, settingsRef.current as unknown as Record<string, unknown>);
          if (selected) setSettings((current) => updateSetting(current, "ttsVoice", selected));
        }

        const initial = await llmRef.current.generateInitialPersonaContent();
        if (initial.imagePrompt && imageRef.current) {
          try {
            const imageUrl = await imageRef.current.generateImage(initial.imagePrompt);
            if (imageUrl) addMessage(createImageMessage("assistant", imageUrl, "Persona appearance"), false);
          } catch (error) {
            console.warn("Persona image generation failed:", error);
          }
        }
        if (initial.greeting) addMessage(createTextMessage("assistant", initial.greeting), true);
      } catch (error) {
        addMessage(createTextMessage("assistant", `Persona setup failed: ${error instanceof Error ? error.message : String(error)}`), false);
      } finally {
        setBusy("idle");
      }
    },
    [addMessage, busy, refreshDocs]
  );

  const saveConversation = useCallback(() => {
    const savedAt = new Date().toISOString();
    setLastSavedAt(savedAt);
    const payload = {
      version: "2.0-react-vite",
      savedAt,
      personaPrompt: personaPrompt || null,
      llmServiceState: {
        conversationHistory: llmRef.current?.conversationHistory ?? [],
        characterInitialized: llmRef.current?.characterInitialized ?? false,
      },
      documentContext: contextRef.current?.exportContext() ?? null,
    };
    downloadJson(`veil-conversation-${savedAt.slice(0, 10)}.json`, payload);
  }, [personaPrompt]);

  const loadConversation = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const payload = JSON.parse(text) as ConversationFile;
        const history = payload.llmServiceState?.conversationHistory;
        if (!history || !Array.isArray(history)) throw new Error("Invalid conversation file.");

        const sanitized = history.map((message) => {
          if (!message.content) return { ...message };
          const validation = validateInput(message.content, "userMessage");
          return validation.isValid ? { ...message, content: validation.sanitizedInput } : { ...message, content: "[Message blocked by safety validation]" };
        });

        if (!llmRef.current) llmRef.current = makeLLM(settingsRef.current);
        llmRef.current.conversationHistory = sanitized;
        llmRef.current.characterInitialized = Boolean(payload.llmServiceState?.characterInitialized);
        llmRef.current.saveConversationHistory();

        if (payload.documentContext && contextRef.current) {
          contextRef.current.importContext(payload.documentContext);
          refreshDocs();
        }

        const prompt = payload.personaPrompt ?? "";
        if (prompt) localStorage.setItem("currentPersonaPrompt", prompt);
        else localStorage.removeItem("currentPersonaPrompt");
        setPersonaPrompt(prompt);
        setMessages(historyToMessages(sanitized));
        setActiveView("chat");
        setNotice("Conversation loaded.");
      } catch (error) {
        setNotice(`Could not load conversation: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
    [refreshDocs]
  );

  const state = useMemo(
    () => ({
      activeView,
      busy,
      documents,
      imageReferencesCount,
      input,
      isListening,
      lastSavedAt,
      messages,
      notice,
      personaPrompt,
      settings,
      voiceAvailable: Boolean(voiceRef.current?.isRecognitionSupported()),
    }),
    [activeView, busy, documents, imageReferencesCount, input, isListening, lastSavedAt, messages, notice, personaPrompt, settings]
  );

  return {
    state,
    actions: {
      attachFiles,
      clearDocuments,
      createPersona,
      loadConversation,
      newConversation,
      removeDocument,
      saveConversation,
      sendMessage,
      setActiveView,
      setInput,
      setNotice,
      toggleVoice,
      updateAppSetting,
    },
  };
}
