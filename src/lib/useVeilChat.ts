import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createImageMessage, createTextMessage, downloadJson, historyToMessages, keywordsHelp, type ChatMessage } from "./format";
import { type AppSettings, persistSettings, readSettings, updateSetting } from "./settings";
import { BrowserVoiceService } from "./services/browserVoice";
import { DocumentContextService } from "./services/documentContext";
import { ImageService } from "./services/image";
import { LLMService } from "./services/llm";
import { SearchService } from "./services/search";
import { SecurityValidator } from "./services/security";
import type { AttachedDocument, LLMMessage, LLMResponse } from "./services/types";

type BusyMode = "idle" | "thinking" | "image" | "persona" | "search";
type View = "chat" | "persona" | "settings" | "history";

interface ConversationFile {
  version?: string;
  savedAt?: string;
  personaPrompt?: string | null;
  llmServiceState?: {
    conversationHistory?: LLMMessage[];
    characterInitialized?: boolean;
  };
  documentContext?: unknown;
}

function detectSearchKeywords(message: string) {
  const lower = message.toLowerCase();
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

  const securityRef = useRef(new SecurityValidator());
  const llmRef = useRef<LLMService | null>(null);
  const imageRef = useRef<ImageService | null>(null);
  const voiceRef = useRef<BrowserVoiceService | null>(null);
  const contextRef = useRef<DocumentContextService | null>(null);
  const searchRef = useRef<SearchService | null>(null);
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
    setImageReferencesCount(imageRef.current?.getReferenceImageCount() ?? 0);
  }, []);

  const rebuildServices = useCallback(
    (nextSettings: AppSettings) => {
      settingsRef.current = nextSettings;

      if (!llmRef.current) llmRef.current = new LLMService(nextSettings, securityRef.current);
      else llmRef.current.updateSettings(nextSettings);

      if (!imageRef.current) imageRef.current = new ImageService(nextSettings);
      else imageRef.current.updateSettings(nextSettings);

      if (!contextRef.current) contextRef.current = new DocumentContextService(securityRef.current);

      if (!searchRef.current) searchRef.current = new SearchService(nextSettings);
      else searchRef.current.updateSettings(nextSettings);

      if (!voiceRef.current) {
        voiceRef.current = new BrowserVoiceService(
          (text) => setInput(text),
          (error) => setNotice(`Voice input error: ${error}`),
          setIsListening
        );
      }

      voiceRef.current.setVoiceRate(nextSettings.voiceSpeed);
      voiceRef.current.setVoicePitch(nextSettings.voicePitch);
      voiceRef.current.setVoiceDropdownCallback((selectedVoice) => {
        setSettings((current) => updateSetting(current, "ttsVoice", selectedVoice));
      });
      document.documentElement.style.setProperty("--chat-font-size", `${nextSettings.fontSize}px`);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    rebuildServices(settings);
    if (!cancelled) {
      setMessages(historyToMessages(llmRef.current?.conversationHistory ?? []));
      refreshDocs();
    }

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
    rebuildServices(settings);
  }, [settings, rebuildServices]);

  const updateAppSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((current) => updateSetting(current, key, value));
  }, []);

  const performWebSearch = useCallback(async (query: string) => {
    const search = searchRef.current;
    if (!search) return "";
    const results = await search.search(query);
    if (!results.length) {
      setNotice("Search returned no results. Continuing with the chat model.");
      return "";
    }
    return search.formatResultsForContext(query, results);
  }, []);

  const validateInput = useCallback((value: string, type: "userMessage" | "imagePrompt" | "characterPrompt") => {
    return securityRef.current.validateUserInput(value, type);
  }, []);

  const sendMessage = useCallback(
    async (rawMessage?: string) => {
      if (busy !== "idle") return;
      const original = (rawMessage ?? input).trim();
      if (!original) return;

      if (voiceRef.current?.isRecognitionActive) voiceRef.current.stopSTT();
      if (voiceRef.current) voiceRef.current.accumulatedTranscript = "";

      const validation = validateInput(original, "userMessage");
      if (!validation.isValid) {
        securityRef.current.logSecurityEvent("INPUT_BLOCKED", {
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
          setImageReferencesCount(image.getReferenceImageCount());
          addMessage(imageUrl ? createImageMessage("assistant", imageUrl, prompt) : createTextMessage("assistant", "Image generation returned no image."), false);
          return;
        }

        let documentContext = context.getDocumentContext();
        if (settingsRef.current.searchEnabled && detectSearchKeywords(message)) {
          setBusy("search");
          try {
            documentContext += await performWebSearch(extractSearchQuery(message));
          } catch (error) {
            setNotice(`${error instanceof Error ? error.message : String(error)} Continuing with the chat model.`);
          }
        }

        setBusy("thinking");
        const response = await llm.sendMessage(message, documentContext, isImageRequest);
        if (response.type === "image_request") {
          setBusy("image");
          const imageUrl = await image.generateImage(response.prompt);
          setImageReferencesCount(image.getReferenceImageCount());
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
    [addMessage, busy, input, performWebSearch, validateInput]
  );

  const attachFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      if (!fileArray.length || !contextRef.current) return;

      const imageFiles = fileArray.filter((file) => file.type.startsWith("image/"));
      const documentFiles = fileArray.filter((file) => !file.type.startsWith("image/"));

      if (imageFiles.length) {
        try {
          if (!imageRef.current) {
            addMessage(createTextMessage("system", "Image references are not ready yet. Try again in a moment."), false);
          } else {
            const references = await imageRef.current.attachReferenceImages(imageFiles);
            setImageReferencesCount(imageRef.current.getReferenceImageCount());
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
      const failures = results.filter((result): result is { success: false; fileName: string; error: string } => !result.success);
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
    imageRef.current?.clearReferenceImages();
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
    imageRef.current?.clearReferenceImages();
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
        llmRef.current = new LLMService(settingsRef.current, securityRef.current);
        llmRef.current.clearConversationHistory();
        contextRef.current?.clearAllDocuments();
        imageRef.current?.clearReferenceImages();
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
        const profile = await llmRef.current.generateCharacterProfile();
        if (profile && voiceRef.current) {
          const selected = voiceRef.current.updateUserVoiceSetting(profile);
          if (selected) setSettings((current) => updateSetting(current, "ttsVoice", selected));
        }

        const initial = await llmRef.current.generateInitialPersonaContent();
        if (initial.imagePrompt && imageRef.current) {
          try {
            const imageUrl = await imageRef.current.generateImage(initial.imagePrompt);
            setImageReferencesCount(imageRef.current.getReferenceImageCount());
            if (imageUrl) addMessage(createImageMessage("assistant", imageUrl, "Persona appearance"), false);
          } catch (error) {
            addMessage(createTextMessage("system", `Persona image generation failed: ${error instanceof Error ? error.message : String(error)}`), false);
          }
        }
        if (initial.greeting) addMessage(createTextMessage("assistant", initial.greeting), true);
      } catch (error) {
        addMessage(createTextMessage("assistant", `Persona setup failed: ${error instanceof Error ? error.message : String(error)}`), false);
      } finally {
        setBusy("idle");
      }
    },
    [addMessage, busy, refreshDocs, validateInput]
  );

  const saveConversation = useCallback(() => {
    const savedAt = new Date().toISOString();
    setLastSavedAt(savedAt);
    downloadJson(`veil-conversation-${savedAt.slice(0, 10)}.json`, {
      version: "3.0-client-only",
      savedAt,
      personaPrompt: personaPrompt || null,
      llmServiceState: {
        conversationHistory: llmRef.current?.conversationHistory ?? [],
        characterInitialized: llmRef.current?.characterInitialized ?? false,
      },
      documentContext: contextRef.current?.exportContext() ?? null,
    });
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
          const validation = validateInput(message.content, message.role === "system" ? "characterPrompt" : "userMessage");
          return validation.isValid ? { ...message, content: validation.sanitizedInput } : { ...message, content: "[Message blocked by safety validation]" };
        });

        if (!llmRef.current) llmRef.current = new LLMService(settingsRef.current, securityRef.current);
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
    [refreshDocs, validateInput]
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
