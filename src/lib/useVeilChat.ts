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

export interface RecentConversationSummary {
  id: string;
  title: string;
  subtitle: string;
  updatedAt: string;
  messageCount: number;
}

interface RecentConversationRecord extends RecentConversationSummary {
  personaPrompt?: string | null;
  llmServiceState: {
    conversationHistory: LLMMessage[];
    characterInitialized: boolean;
  };
  documentContext?: unknown;
  messages?: ChatMessage[];
}

const RECENT_CONVERSATIONS_KEY = "veilchatRecentConversations";
const CURRENT_CONVERSATION_ID_KEY = "veilchatCurrentConversationId";
const MAX_RECENT_CONVERSATIONS = 12;

function createConversationId() {
  return crypto.randomUUID();
}

function getStoredConversationId() {
  const savedId = localStorage.getItem(CURRENT_CONVERSATION_ID_KEY);
  if (savedId) return savedId;
  const nextId = createConversationId();
  localStorage.setItem(CURRENT_CONVERSATION_ID_KEY, nextId);
  return nextId;
}

function readRecentConversationRecords(): RecentConversationRecord[] {
  try {
    const raw = localStorage.getItem(RECENT_CONVERSATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((record): record is RecentConversationRecord =>
      Boolean(record?.id && record?.title && record?.updatedAt && Array.isArray(record?.llmServiceState?.conversationHistory))
    );
  } catch {
    return [];
  }
}

function writeRecentConversationRecords(records: RecentConversationRecord[]) {
  const limited = records.slice(0, MAX_RECENT_CONVERSATIONS);
  try {
    localStorage.setItem(RECENT_CONVERSATIONS_KEY, JSON.stringify(limited));
  } catch {
    const withoutDocuments = limited.map((record) => ({ ...record, documentContext: null }));
    localStorage.setItem(RECENT_CONVERSATIONS_KEY, JSON.stringify(withoutDocuments));
  }
}

function summarizeRecentConversations(records: RecentConversationRecord[]): RecentConversationSummary[] {
  return records.map(({ id, title, subtitle, updatedAt, messageCount }) => ({ id, title, subtitle, updatedAt, messageCount }));
}

function createConversationTitle(history: LLMMessage[], visibleMessages: ChatMessage[], personaPrompt: string) {
  const firstUserMessage = history.find((message) => message.role === "user" && message.content.trim())?.content
    ?? visibleMessages.find((message) => message.role === "user" && message.content.trim())?.content
    ?? personaPrompt
    ?? "";
  const cleaned = firstUserMessage
    .replace(/^xx\b/i, "")
    .replace(/\bshow me\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "New chat";
  return cleaned.length > 38 ? `${cleaned.slice(0, 35).trim()}...` : cleaned;
}

function formatRecentConversationDate(date: Date) {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.round((startOfToday - startOfDate) / 86400000);
  if (dayDiff === 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function createConversationFingerprint(history: LLMMessage[], visibleMessages: ChatMessage[], documents: AttachedDocument[] = []) {
  return JSON.stringify({
    history: history.map((message) => [message.role, message.content, Boolean(message.hidden)]),
    visible: visibleMessages.map((message) => [message.role, message.kind, message.content, message.imageUrl ?? ""]),
    documents: documents.map((document) => [document.id, document.name, document.size, document.addedAt]),
  });
}

function preserveStoredConversationAsRecent(conversationId: string) {
  try {
    const savedData = localStorage.getItem("llmConversationHistory");
    if (!savedData) return summarizeRecentConversations(readRecentConversationRecords());
    const parsed = JSON.parse(savedData) as { conversationHistory?: LLMMessage[]; characterInitialized?: boolean; timestamp?: number };
    const history = Array.isArray(parsed.conversationHistory) ? parsed.conversationHistory : [];
    const visibleMessages = historyToMessages(history);
    if (!visibleMessages.length) return summarizeRecentConversations(readRecentConversationRecords());

    const records = readRecentConversationRecords();
    if (records.some((record) => record.id === conversationId)) return summarizeRecentConversations(records);

    const updatedAt = parsed.timestamp ? new Date(parsed.timestamp).toISOString() : new Date().toISOString();
    const record: RecentConversationRecord = {
      id: conversationId,
      title: createConversationTitle(history, visibleMessages, localStorage.getItem("currentPersonaPrompt") ?? ""),
      subtitle: formatRecentConversationDate(new Date(updatedAt)),
      updatedAt,
      messageCount: visibleMessages.length,
      personaPrompt: localStorage.getItem("currentPersonaPrompt"),
      llmServiceState: {
        conversationHistory: history,
        characterInitialized: Boolean(parsed.characterInitialized),
      },
      documentContext: null,
      messages: visibleMessages,
    };
    const nextRecords = [record, ...records];
    writeRecentConversationRecords(nextRecords);
    return summarizeRecentConversations(nextRecords);
  } catch {
    return summarizeRecentConversations(readRecentConversationRecords());
  }
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
  const [recentConversations, setRecentConversations] = useState<RecentConversationSummary[]>(() => summarizeRecentConversations(readRecentConversationRecords()));

  const securityRef = useRef(new SecurityValidator());
  const llmRef = useRef<LLMService | null>(null);
  const imageRef = useRef<ImageService | null>(null);
  const voiceRef = useRef<BrowserVoiceService | null>(null);
  const contextRef = useRef<DocumentContextService | null>(null);
  const searchRef = useRef<SearchService | null>(null);
  const settingsRef = useRef(settings);
  const currentConversationIdRef = useRef(getStoredConversationId());

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

  const startNewConversationId = useCallback(() => {
    const nextId = createConversationId();
    currentConversationIdRef.current = nextId;
    localStorage.setItem(CURRENT_CONVERSATION_ID_KEY, nextId);
    return nextId;
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
      setRecentConversations(preserveStoredConversationAsRecent(currentConversationIdRef.current));
      llmRef.current?.clearConversationHistory();
      localStorage.removeItem("currentPersonaPrompt");
      setPersonaPrompt("");
      startNewConversationId();
      setMessages([]);
      refreshDocs();
    }

    let refreshing = false;
    const handleControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    const registerServiceWorker = () => {
      if (!("serviceWorker" in navigator)) return;

      navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
      navigator.serviceWorker
        .register("/veilchat/service-worker.js", { updateViaCache: "none" })
        .then((registration) => {
          registration.update().catch((error) => console.warn("Service worker update check failed:", error));
          if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });

          registration.addEventListener("updatefound", () => {
            const nextWorker = registration.installing;
            if (!nextWorker) return;
            nextWorker.addEventListener("statechange", () => {
              if (nextWorker.state === "installed" && navigator.serviceWorker.controller) {
                nextWorker.postMessage({ type: "SKIP_WAITING" });
              }
            });
          });
        })
        .catch((error) => console.warn("Service worker registration failed:", error));
    };

    if (document.readyState === "complete") {
      registerServiceWorker();
    } else {
      window.addEventListener("load", registerServiceWorker);
    }

    return () => {
      cancelled = true;
      window.removeEventListener("load", registerServiceWorker);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      }
    };
  }, []);

  useEffect(() => {
    persistSettings(settings);
    rebuildServices(settings);
  }, [settings, rebuildServices]);

  useEffect(() => {
    const llm = llmRef.current;
    if (!llm || !messages.length) return;

    const history = llm.conversationHistory;
    const records = readRecentConversationRecords();
    const existing = records.find((record) => record.id === currentConversationIdRef.current);
    const existingMessages = existing?.messages ?? historyToMessages(existing?.llmServiceState.conversationHistory ?? []);
    const existingFingerprint = existing ? createConversationFingerprint(existing.llmServiceState.conversationHistory, existingMessages, documents) : "";
    const currentFingerprint = createConversationFingerprint(history, messages, documents);
    const updatedAt = existing && existingFingerprint === currentFingerprint ? existing.updatedAt : new Date().toISOString();
    const updatedDate = new Date(updatedAt);
    const record: RecentConversationRecord = {
      id: currentConversationIdRef.current,
      title: createConversationTitle(history, messages, personaPrompt),
      subtitle: formatRecentConversationDate(updatedDate),
      updatedAt,
      messageCount: messages.length,
      personaPrompt: personaPrompt || null,
      llmServiceState: {
        conversationHistory: history,
        characterInitialized: llm.characterInitialized,
      },
      documentContext: contextRef.current?.exportContext() ?? null,
      messages,
    };
    const nextRecords = [record, ...records.filter((item) => item.id !== record.id)];
    writeRecentConversationRecords(nextRecords);
    setRecentConversations(summarizeRecentConversations(nextRecords));
  }, [documents, messages, personaPrompt]);

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
    startNewConversationId();
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
  }, [refreshDocs, startNewConversationId]);

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
      startNewConversationId();
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
    [addMessage, busy, refreshDocs, startNewConversationId, validateInput]
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

        startNewConversationId();
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
    [refreshDocs, startNewConversationId, validateInput]
  );

  const loadRecentConversation = useCallback(
    (id: string) => {
      try {
        const record = readRecentConversationRecords().find((item) => item.id === id);
        if (!record) {
          setNotice("That chat is no longer available.");
          setRecentConversations(summarizeRecentConversations(readRecentConversationRecords()));
          return;
        }

        currentConversationIdRef.current = record.id;
        localStorage.setItem(CURRENT_CONVERSATION_ID_KEY, record.id);
        if (!llmRef.current) llmRef.current = new LLMService(settingsRef.current, securityRef.current);
        llmRef.current.conversationHistory = record.llmServiceState.conversationHistory;
        llmRef.current.characterInitialized = Boolean(record.llmServiceState.characterInitialized);
        llmRef.current.saveConversationHistory();

        contextRef.current?.clearAllDocuments();
        if (record.documentContext) contextRef.current?.importContext(record.documentContext);
        imageRef.current?.clearReferenceImages();
        setImageReferencesCount(0);
        refreshDocs();

        const prompt = record.personaPrompt ?? "";
        if (prompt) localStorage.setItem("currentPersonaPrompt", prompt);
        else localStorage.removeItem("currentPersonaPrompt");
        setPersonaPrompt(prompt);
        setMessages(record.messages?.length ? record.messages : historyToMessages(record.llmServiceState.conversationHistory));
        setInput("");
        setActiveView("chat");
      } catch (error) {
        setNotice(`Could not load chat: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
    [refreshDocs]
  );

  const deleteRecentConversation = useCallback(
    (id: string) => {
      const nextRecords = readRecentConversationRecords().filter((record) => record.id !== id);
      writeRecentConversationRecords(nextRecords);
      setRecentConversations(summarizeRecentConversations(nextRecords));

      if (id !== currentConversationIdRef.current) return;
      startNewConversationId();
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
    },
    [refreshDocs, startNewConversationId]
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
      recentConversations,
      settings,
      voiceAvailable: Boolean(voiceRef.current?.isRecognitionSupported()),
    }),
    [activeView, busy, documents, imageReferencesCount, input, isListening, lastSavedAt, messages, notice, personaPrompt, recentConversations, settings]
  );

  return {
    state,
    actions: {
      attachFiles,
      clearDocuments,
      createPersona,
      deleteRecentConversation,
      loadConversation,
      loadRecentConversation,
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
