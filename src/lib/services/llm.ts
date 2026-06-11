import type { AppSettings, KieReasoningLevel, LlmProvider } from "../settings";
import { SecurityValidator } from "./security";
import type { LLMMessage, LLMResponse } from "./types";

type KieFamily = "chat-completions" | "responses" | "claude" | "gemini-native";
type KieChatConfig = { family: KieFamily; endpoint: string; model?: string };

const DIRECT_PROVIDERS = new Set<LlmProvider>(["openai-direct", "anthropic-direct", "google-direct", "kie-direct"]);

const KIE_CHAT_MODELS: Record<string, KieChatConfig> = {
  "gpt-5-2": { family: "chat-completions", endpoint: "/gpt-5-2/v1/chat/completions" },
  "gpt-5-4": { family: "responses", endpoint: "/codex/v1/responses", model: "gpt-5-4" },
  "gpt-5-5": { family: "responses", endpoint: "/codex/v1/responses", model: "gpt-5-5" },
  "gpt-5-codex": { family: "responses", endpoint: "/api/v1/responses", model: "gpt-5-codex" },
  "gpt-5.1-codex": { family: "responses", endpoint: "/api/v1/responses", model: "gpt-5.1-codex" },
  "gpt-5.2-codex": { family: "responses", endpoint: "/api/v1/responses", model: "gpt-5.2-codex" },
  "gpt-5.3-codex": { family: "responses", endpoint: "/api/v1/responses", model: "gpt-5.3-codex" },
  "gpt-5.4-codex": { family: "responses", endpoint: "/api/v1/responses", model: "gpt-5.4-codex" },
  "claude-opus-4-7": { family: "claude", endpoint: "/claude/v1/messages", model: "claude-opus-4-7" },
  "claude-opus-4-8": { family: "claude", endpoint: "/claude/v1/messages", model: "claude-opus-4-8" },
  "claude-fable-5": { family: "claude", endpoint: "/claude/v1/messages", model: "claude-fable-5" },
  "claude-haiku-4-5": { family: "claude", endpoint: "/claude/v1/messages", model: "claude-haiku-4-5" },
  "claude-opus-4-5": { family: "claude", endpoint: "/claude/v1/messages", model: "claude-opus-4-5" },
  "claude-opus-4-6": { family: "claude", endpoint: "/claude/v1/messages", model: "claude-opus-4-6" },
  "claude-sonnet-4-5": { family: "claude", endpoint: "/claude/v1/messages", model: "claude-sonnet-4-5" },
  "claude-sonnet-4-6": { family: "claude", endpoint: "/claude/v1/messages", model: "claude-sonnet-4-6" },
  "gemini-2.5-pro": { family: "chat-completions", endpoint: "/gemini-2.5-pro/v1/chat/completions" },
  "gemini-3-pro": { family: "chat-completions", endpoint: "/gemini-3-pro/v1/chat/completions" },
  "gemini-3.1-pro": { family: "chat-completions", endpoint: "/gemini-3.1-pro/v1/chat/completions" },
  "gemini-2.5-flash": { family: "chat-completions", endpoint: "/gemini-2.5-flash/v1/chat/completions" },
  "gemini-3-flash": { family: "chat-completions", endpoint: "/gemini-3-flash/v1/chat/completions" },
  "gemini-3-5-flash-openai": { family: "chat-completions", endpoint: "/gemini-3-5-flash-openai/v1/chat/completions" },
  "gemini-3-5-flash-native": { family: "gemini-native", endpoint: "/gemini/v1/models/gemini-3-5-flash:streamGenerateContent" },
  "gemini-3-flash-v1beta-native": { family: "gemini-native", endpoint: "/gemini/v1/models/gemini-3-flash-v1betamodels:streamGenerateContent" },
};

export class LLMService {
  conversationHistory: LLMMessage[] = [];
  characterInitialized = false;

  private settings: AppSettings;
  private directApiEndpoint = "";
  private directModel = "";
  private directApiKey = "";
  private authHeader = "Authorization";
  private authValue = "";
  private kieModelConfig: KieChatConfig | null = null;

  private readonly chatTemperature = 0.4;
  private readonly chatMaxTokens: number | null = null;
  private readonly chatPresencePenalty = 0.5;
  private readonly chatFrequencyPenalty = 0.5;
  private readonly chatTopP: number | null = null;
  private readonly imagePromptTemperature = 0.5;
  private readonly imagePromptMaxTokens = 450;
  private readonly characterGenTemperature = 0.8;
  private readonly characterGenMaxTokens = 1200;

  constructor(settings: AppSettings, private readonly security = new SecurityValidator()) {
    this.settings = settings;
    this.conversationHistory = [{ role: "system", content: this.createBaseSystemPrompt() }];
    this.setupDirectProviderConfig();
    this.loadConversationHistory();
  }

  updateSettings(settings: AppSettings) {
    this.settings = settings;
    this.setupDirectProviderConfig();
  }

  createBaseSystemPrompt() {
    return `roleplay: You are my roleplay assistant. Invent a unique and interesting persona over the age of 21.
Give yourself a creative and surprising backstory. Do not tell me your backstory unless I ask you to tell me about yourself.
Maintain the same persona throughout our conversation unless I specifically ask you to create a new one. You have a randomly generated appearance.
You are humorous, engaging, likeable, and funny. Do not speak for me EVER. You have a witty sense of humor. Speak only from your perspective.
Do not use system prompts or system instructions in your responses. Do not describe yourself unless I ask you to.
You have the ability to send images to the user. If they ask for an image or a picture, remind them that they just have to say "show me" and you will send them an image.
Your name is the name of the persona you created. Keep your responses short and concise. Use plain conversational text.`;
  }

  saveConversationHistory() {
    try {
      localStorage.setItem(
        "llmConversationHistory",
        JSON.stringify({
          conversationHistory: this.conversationHistory,
          characterInitialized: this.characterInitialized,
          timestamp: Date.now(),
        })
      );
    } catch (error) {
      console.warn("Error saving conversation history:", error);
    }
  }

  loadConversationHistory() {
    try {
      const savedData = localStorage.getItem("llmConversationHistory");
      if (!savedData) return;
      const historyData = JSON.parse(savedData) as { conversationHistory?: LLMMessage[]; characterInitialized?: boolean };
      if (Array.isArray(historyData.conversationHistory)) {
        this.conversationHistory = this.sanitizeConversationHistory(historyData.conversationHistory);
        this.characterInitialized = Boolean(historyData.characterInitialized);
        this.saveConversationHistory();
      }
    } catch (error) {
      console.warn("Error loading conversation history:", error);
    }
  }

  clearConversationHistory() {
    this.conversationHistory = [{ role: "system", content: this.createBaseSystemPrompt() }];
    this.characterInitialized = false;
    localStorage.removeItem("llmConversationHistory");
    localStorage.removeItem("currentPersonaPrompt");
  }

  setCustomPersona(customPersonaPrompt: string, preserveHistory = false) {
    if (!preserveHistory) {
      this.conversationHistory = this.conversationHistory.filter((message) => !this.isPersonaInternalMessage(message));
    } else if (this.conversationHistory.some((message) => message.content?.includes("[CUSTOM PERSONA"))) {
      this.conversationHistory = this.conversationHistory.filter((message) => !message.content?.includes("[CUSTOM PERSONA"));
    }

    this.conversationHistory.push({
      role: "system",
      content: `[CUSTOM PERSONA - INTERNAL REFERENCE] ${customPersonaPrompt}`,
      hidden: true,
    });
    this.characterInitialized = false;
    this.saveConversationHistory();
  }

  resetPersona() {
    this.characterInitialized = false;
    this.conversationHistory = this.conversationHistory.filter((message) => !this.isPersonaInternalMessage(message));
    this.saveConversationHistory();
  }

  getCharacterProfile() {
    const profileMessage = this.conversationHistory.find((message) => message.content.includes("[INTERNAL CHARACTER PROFILE"));
    return profileMessage?.content ?? null;
  }

  async generateCharacterProfile() {
    if (this.characterInitialized) return null;

    const customPersonaMessage = this.conversationHistory.find((message) => message.content?.includes("[CUSTOM PERSONA"));
    const hasCharacterProfile = this.conversationHistory.some((message) => message.content?.includes("[INTERNAL CHARACTER PROFILE"));
    if (hasCharacterProfile) {
      this.characterInitialized = true;
      this.saveConversationHistory();
      return this.getCharacterProfile();
    }

    const characterGenMessages: LLMMessage[] = customPersonaMessage
      ? this.createCustomPersonaMessages(customPersonaMessage)
      : [
          {
            role: "system",
            content: "You are a creative character generator. Create a unique roleplay character over the age of 18. Be creative and detailed.",
          },
          {
            role: "user",
            content:
              "Create a detailed character profile that includes: your name, age, gender, physical appearance (hair color, eye color, height, build, style), personality traits, any special abilities, backstory, and current circumstances. Write this as a third-person character description for internal reference. Be creative and unique. Make it comprehensive but concise - aim for 150-200 words.",
          },
        ];

    try {
      const characterProfile = await this.sendUniversalLLMRequest(characterGenMessages, this.characterGenTemperature, this.characterGenMaxTokens, false);
      if (characterProfile) {
        this.conversationHistory.push({
          role: "system",
          content: `[INTERNAL CHARACTER PROFILE - NOT FOR DISPLAY] ${characterProfile}`,
          hidden: true,
        });
      }
      this.characterInitialized = true;
      this.saveConversationHistory();
      return characterProfile || null;
    } catch (error) {
      this.characterInitialized = true;
      this.saveConversationHistory();
      throw error;
    }
  }

  async generateInitialPersonaContent() {
    try {
      const characterProfileMessage = this.conversationHistory.find((message) => message.role === "system" && message.content.includes("[INTERNAL CHARACTER PROFILE"));
      const characterDescription = characterProfileMessage?.content.replace("[INTERNAL CHARACTER PROFILE - NOT FOR DISPLAY] ", "") ?? "";
      let imagePrompt: string | null = null;

      if (characterDescription && !/sorry|couldn't understand/i.test(characterDescription)) {
        imagePrompt = await this.sendUniversalLLMRequest(
          [
            {
              role: "system",
              content:
                "You write rich image-generation prompts for character portraits. Preserve the character's identity, age, appearance, mood, clothing style, and setting. Respond with one detailed prompt only.",
            },
            {
              role: "user",
              content: `Create a detailed image prompt for the assistant persona described below. The image should show this adult character clearly, as a portrait or scene-setting introduction.\n\nCharacter profile:\n${characterDescription}\n\nInclude visible age, gender presentation, face, hair, eyes, build, clothing style, expression, pose, setting, lighting, camera framing, and mood. Do not use placeholders like "hair-color" or tiny stubs like "1woman". Respond with only the final image prompt.`,
            },
          ],
          this.imagePromptTemperature,
          this.imagePromptMaxTokens,
          true
        );
      }

      const greeting = await this.sendUniversalLLMRequest(
        [...this.conversationHistory, { role: "user", content: "hello" }],
        this.chatTemperature,
        this.chatMaxTokens,
        false
      );

      this.conversationHistory.push({ role: "user", content: "hello" }, { role: "assistant", content: greeting || "Hello there!" });
      this.saveConversationHistory();
      return { imagePrompt, greeting: greeting || "Hello there!" };
    } catch {
      return { imagePrompt: null, greeting: "Hello there!" };
    }
  }

  async sendMessage(message: string, documentContext = "", generateImagePrompt = false): Promise<LLMResponse> {
    if (!this.characterInitialized) {
      try {
        await this.generateCharacterProfile();
      } catch (error) {
        console.warn("Failed to generate character profile, continuing anyway:", error);
      }
    }

    if (generateImagePrompt || message.toLowerCase().includes("show me")) {
      return this.createImagePromptResponse(message);
    }

    const fullMessage = documentContext ? `${documentContext}\n\nUser message: ${message}` : message;
    this.conversationHistory.push({ role: "user", content: message });
    this.saveConversationHistory();

    const messagesForApi = [...this.conversationHistory.slice(0, -1), { role: "user" as const, content: fullMessage }];
    try {
      const reply = await this.sendUniversalLLMRequest(messagesForApi, this.chatTemperature, this.chatMaxTokens, false);
      this.conversationHistory.push({ role: "assistant", content: reply });
      this.saveConversationHistory();
      return { type: "text", content: reply };
    } catch (error) {
      if (this.conversationHistory.at(-1)?.role === "user") this.conversationHistory.pop();
      this.saveConversationHistory();
      return { type: "error", content: `Error: Could not connect to the LLM. ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  private async createImagePromptResponse(message: string): Promise<LLMResponse> {
    const recentMessages = this.conversationHistory.filter((item) => item.role !== "system" && !item.hidden && !item.content.includes("[INTERNAL")).slice(-8);
    const characterProfile = this.cleanInternalProfile(this.getCharacterProfile() || "An adult assistant persona from the current chat.");
    const conversationContext = recentMessages.map((item) => `${item.role}: ${item.content}`).join("\n");
    const sceneRequest = this.extractImageSceneRequest(message);
    const rawReply = await this.sendUniversalLLMRequest(
      [
        {
          role: "system",
          content:
            "You write production-ready prompts for AI image generation. The image must depict the assistant persona the user is currently chatting with, not a generic person. Use the current chat as scene context. Respond with one detailed visual prompt only, no markdown and no explanation.",
        },
        {
          role: "user",
          content: `The user asked: "${message}"

Create an image prompt that shows the assistant persona in the context of the current chat.

Assistant persona profile:
${characterProfile}

Current conversation context:
${conversationContext || "The user is chatting directly with the assistant persona."}

Scene requested by the user:
${sceneRequest || "Show the assistant persona in a natural moment from the current conversation."}

Requirements:
- The main subject is the assistant persona from the profile above.
- Preserve the persona's described age, gender presentation, face, hair, eyes, build, style, mood, and setting.
- Include a coherent background and camera framing that fit the current conversation.
- Do not depict the user unless the user explicitly asks for that.
- Do not return short labels like "1woman" or "1woman, 34".
- Write 2-4 vivid sentences or a detailed comma-separated prompt with at least 35 visual words.

Respond with only the final image prompt.`,
        },
      ],
      this.imagePromptTemperature,
      this.imagePromptMaxTokens,
      true
    );
    const prompt = this.ensurePersonaImagePrompt(rawReply, message, characterProfile, conversationContext, sceneRequest);

    return prompt
      ? { type: "image_request", prompt }
      : { type: "text", content: "Sorry, I couldn't generate the image details. The LLM returned an empty response." };
  }

  private cleanInternalProfile(profile: string) {
    return profile
      .replace(/\[INTERNAL CHARACTER PROFILE - NOT FOR DISPLAY\]\s*/gi, "")
      .replace(/\[CUSTOM PERSONA - INTERNAL REFERENCE\]\s*/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private extractImageSceneRequest(message: string) {
    return message
      .replace(/\bshow me\b/gi, "")
      .replace(/\b(?:a|an|the)?\s*(?:picture|image|photo|portrait|drawing)\s+of\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private ensurePersonaImagePrompt(rawPrompt: string, message: string, characterProfile: string, conversationContext: string, sceneRequest: string) {
    const cleaned = this.stripSpeechMarkup(rawPrompt || "").trim();
    if (this.isDetailedImagePrompt(cleaned)) return cleaned;

    const profileSummary = characterProfile.slice(0, 900);
    const contextSummary = conversationContext ? conversationContext.slice(-700) : "A direct conversation between the user and the assistant persona.";
    const scene = sceneRequest || this.extractImageSceneRequest(message) || "a natural moment from the current conversation";

    return [
      "Create a detailed image of the assistant persona the user is currently talking to.",
      `Persona: ${profileSummary}`,
      `Scene: ${scene}.`,
      `Conversation context: ${contextSummary}`,
      "Show the assistant persona as the clear main subject, preserving their described adult age, gender presentation, face, hair, eyes, build, clothing style, expression, personality, and current setting.",
      "Use coherent background details, natural pose, cinematic lighting, realistic camera framing, high detail, and avoid depicting the user unless explicitly requested.",
    ].join(" ");
  }

  private isDetailedImagePrompt(prompt: string) {
    if (!prompt) return false;
    const words = prompt.split(/\s+/).filter(Boolean);
    const commaParts = prompt.split(",").map((part) => part.trim()).filter(Boolean);
    const placeholderPattern = /\b(?:hair-color|hair-style|eye-color|clothing-style|background-details|additional-descriptors)\b/i;
    const tinySubjectPattern = /^1(?:woman|man|girl|boy|person)(?:\s*,\s*\d{1,3})?[\s,.]*$/i;
    return words.length >= 35 && commaParts.length >= 6 && !placeholderPattern.test(prompt) && !tinySubjectPattern.test(prompt);
  }

  private createCustomPersonaMessages(customPersonaMessage: LLMMessage): LLMMessage[] {
    const customPersonaText = customPersonaMessage.content.replace("[CUSTOM PERSONA - INTERNAL REFERENCE] ", "");
    const validation = this.security.validateUserInput(customPersonaText, "characterPrompt");
    if (!validation.isValid) {
      this.security.logSecurityEvent("PERSONA_BLOCKED", {
        personaText: customPersonaText,
        violations: validation.violations,
        riskLevel: validation.riskLevel,
      });
      throw new Error(`Custom persona contains potentially unsafe content: ${validation.violations.join(", ")}`);
    }

    return [
      {
        role: "system",
        content: "You are a character creation assistant. You will be given custom persona instructions and must create a detailed character profile that follows those instructions exactly.",
      },
      {
        role: "user",
        content: `Create a detailed internal character profile based on these specific persona instructions: "${validation.sanitizedInput}"

Please create a character that follows these instructions and include:
- Your name, gender (man or woman), age, physical appearance (hair color, eye color, height, build, style)
- Personality traits that match the persona description
- Any special abilities or background mentioned
- Backstory and current circumstances that align with the persona
- Any other details that fit the persona requirements
- The setting: where this conversation is taking place

Make sure the character you create embodies and follows the persona instructions provided. Write this as a third-person character description for internal reference.`,
      },
    ];
  }

  private async sendUniversalLLMRequest(messages: LLMMessage[], temperature: number, maxTokens: number | null, isImagePrompt: boolean) {
    let responseText = "";

    if (this.isDirectProvider()) {
      const payload = this.createDirectProviderPayload(messages, temperature, maxTokens);
      const data = await this.sendDirectProviderRequest(payload);
      responseText = this.extractDirectProviderResponse(data);
    } else {
      const endpoint = `${this.settings.customLlmApiUrl.replace(/\/$/, "")}/v1/chat/completions`;
      const payload = this.createCompatiblePayload(messages, temperature, maxTokens, !isImagePrompt);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (this.settings.customLlmApiKey) headers.Authorization = `Bearer ${this.settings.customLlmApiKey}`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`LLM API request failed with status ${response.status}: ${text}`);
      }

      const data = await response.json();
      responseText = data.choices?.[0]?.message?.content?.trim() ?? "";
    }

    return this.stripSpeechMarkup(responseText || (isImagePrompt ? "" : "Sorry, I couldn't understand that."));
  }

  private setupDirectProviderConfig() {
    this.kieModelConfig = null;
    if (this.settings.customLlmProvider === "openai-direct") {
      this.directApiEndpoint = "https://api.openai.com/v1/chat/completions";
      this.directModel = this.settings.openaiModelIdentifier || "gpt-4.1-mini";
      this.directApiKey = this.settings.openaiApiKey;
      this.authHeader = "Authorization";
      this.authValue = `Bearer ${this.directApiKey}`;
    } else if (this.settings.customLlmProvider === "anthropic-direct") {
      this.directApiEndpoint = "https://api.anthropic.com/v1/messages";
      this.directModel = this.settings.anthropicModelIdentifier || "claude-sonnet-4";
      this.directApiKey = this.settings.anthropicApiKey;
      this.authHeader = "x-api-key";
      this.authValue = this.directApiKey;
    } else if (this.settings.customLlmProvider === "google-direct") {
      this.directModel = this.settings.googleModelIdentifier || "gemini-2.5-flash";
      this.directApiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.directModel}:generateContent`;
      this.directApiKey = this.settings.googleApiKey;
      this.authHeader = "x-goog-api-key";
      this.authValue = this.directApiKey;
    } else if (this.settings.customLlmProvider === "kie-direct") {
      const config = KIE_CHAT_MODELS[this.settings.kieModelIdentifier] ?? KIE_CHAT_MODELS["gpt-5-2"];
      this.kieModelConfig = config;
      this.directApiEndpoint = `https://api.kie.ai${config.endpoint}`;
      this.directModel = config.model || this.settings.kieModelIdentifier || "gpt-5-2";
      this.directApiKey = this.settings.kieApiKey;
      this.authHeader = "Authorization";
      this.authValue = `Bearer ${this.directApiKey}`;
    }
  }

  private createDirectProviderPayload(messages: LLMMessage[], temperature: number, maxTokens: number | null) {
    if (this.settings.customLlmProvider === "openai-direct") {
      const payload: Record<string, unknown> = {
        model: this.directModel,
        messages,
        stream: false,
      };
      const isGPT5Model = this.directModel.includes("gpt-5") || this.directModel.includes("5-mini") || this.directModel.includes("5-nano");
      const restrictedTempModels = ["o1", "o3", "4.1"];
      if (!isGPT5Model && !restrictedTempModels.some((restricted) => this.directModel.toLowerCase().includes(restricted))) payload.temperature = temperature;
      if (!isGPT5Model && maxTokens !== null) payload.max_tokens = maxTokens;
      if (this.directModel.toLowerCase().includes("gpt-oss")) {
        payload.reasoning = { exclude: true };
        payload.raw_cot = false;
      }
      return payload;
    }

    if (this.settings.customLlmProvider === "anthropic-direct") {
      return {
        model: this.directModel,
        temperature,
        system: messages.filter((message) => message.role === "system").map((message) => message.content).join("\n") || undefined,
        messages: messages.filter((message) => message.role !== "system"),
        max_tokens: maxTokens ?? 4096,
      };
    }

    if (this.settings.customLlmProvider === "google-direct") {
      return this.createGooglePayload(messages, temperature, maxTokens);
    }

    return this.createKieDirectPayload(messages, temperature, maxTokens);
  }

  private createGooglePayload(messages: LLMMessage[], temperature: number, maxTokens: number | null) {
    const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];
    let currentUserContent: string[] = [];

    for (const message of messages.filter((item) => item.role !== "system")) {
      if (message.role === "user") {
        currentUserContent.push(message.content);
      } else {
        if (currentUserContent.length) {
          contents.push({ role: "user", parts: [{ text: currentUserContent.join("\n\n") }] });
          currentUserContent = [];
        }
        contents.push({ role: "model", parts: [{ text: message.content }] });
      }
    }
    if (currentUserContent.length) contents.push({ role: "user", parts: [{ text: currentUserContent.join("\n\n") }] });

    const generationConfig: Record<string, unknown> = {
      temperature,
      thinkingConfig: { thinkingBudget: 0 },
    };
    if (maxTokens !== null) generationConfig.maxOutputTokens = maxTokens;

    const payload: Record<string, unknown> = { contents, generationConfig };
    const system = messages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n");
    if (system) payload.systemInstruction = { parts: [{ text: system }] };
    return payload;
  }

  private createKieDirectPayload(messages: LLMMessage[], temperature: number, maxTokens: number | null) {
    const config = this.kieModelConfig ?? KIE_CHAT_MODELS["gpt-5-2"];
    const reasoningLevel = this.getKieReasoningLevel();

    if (config.family === "responses") {
      const payload: Record<string, unknown> = {
        model: config.model,
        stream: false,
        input: this.createKieResponsesInput(messages),
      };
      if (reasoningLevel !== "off") payload.reasoning = { effort: reasoningLevel };
      return payload;
    }

    if (config.family === "claude") {
      const system = messages.filter((message) => message.role === "system").map((message) => this.normalizeTextContent(message.content)).filter(Boolean).join("\n\n");
      const payload: Record<string, unknown> = {
        model: config.model,
        stream: false,
        messages: this.createKieChatMessages(messages.filter((message) => message.role !== "system")),
        max_tokens: maxTokens ?? 4096,
        thinkingFlag: reasoningLevel !== "off",
      };
      if (system) payload.system = system;
      if (temperature !== undefined && temperature !== null) payload.temperature = temperature;
      return payload;
    }

    if (config.family === "gemini-native") {
      const generationConfig: Record<string, unknown> = {};
      if (temperature !== undefined && temperature !== null) generationConfig.temperature = temperature;
      if (maxTokens !== null) generationConfig.maxOutputTokens = maxTokens;
      generationConfig.thinkingConfig = reasoningLevel === "off" ? { includeThoughts: false } : { includeThoughts: false, thinkingLevel: reasoningLevel };

      const payload: Record<string, unknown> = {
        stream: false,
        contents: this.createKieGeminiContents(messages),
        generationConfig,
      };
      const system = messages.filter((message) => message.role === "system").map((message) => this.normalizeTextContent(message.content)).filter(Boolean).join("\n\n");
      if (system) payload.systemInstruction = { parts: [{ text: system }] };
      return payload;
    }

    const payload: Record<string, unknown> = {
      messages: this.createKieChatMessages(messages),
      stream: false,
    };
    if (reasoningLevel !== "off") payload.reasoning_effort = reasoningLevel;
    return payload;
  }

  private async sendDirectProviderRequest(payload: Record<string, unknown>) {
    if (!this.directApiKey) throw new Error(`${this.settings.customLlmProvider} API key is required.`);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      [this.authHeader]: this.authValue,
    };
    if (this.settings.customLlmProvider === "anthropic-direct") {
      headers["anthropic-version"] = "2023-06-01";
      headers["anthropic-dangerous-direct-browser-access"] = "true";
    }

    const response = await fetch(this.directApiEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${this.settings.customLlmProvider} API request failed with status ${response.status}: ${text}`);
    }

    return response.json();
  }

  private createCompatiblePayload(messages: LLMMessage[], temperature: number, maxTokens: number | null, includeStop = true) {
    const model = this.settings.customLlmModelIdentifier;
    const isGemini = model.toLowerCase().includes("gemini");
    const isGptOss = model.toLowerCase().includes("gpt-oss");
    const isOllama = this.settings.customLlmProvider === "ollama" || (this.settings.customLlmProvider === "litellm" && model.startsWith("ollama/"));
    const payload: Record<string, unknown> = {
      messages,
      temperature,
      stream: false,
      model,
    };
    if (maxTokens !== null) payload.max_tokens = maxTokens;
    if (isGptOss) {
      payload.reasoning = { exclude: true };
      payload.raw_cot = false;
    }
    if (isGemini) {
      payload.thinkingBudget = 0;
      payload.thinkingConfig = { thinkingBudget: 0 };
      payload.reasoning_effort = "low";
      payload.safetySettings = [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_NONE" },
      ];
    }
    if (!isOllama && !isGemini) {
      payload.presence_penalty = this.chatPresencePenalty;
      payload.frequency_penalty = this.chatFrequencyPenalty;
    }
    if (!isGemini && this.chatTopP !== null) payload.top_p = this.chatTopP;
    if (includeStop && !isGemini) payload.stop = ["Human:", "User:", "###", "\n\nUser:"];
    return payload;
  }

  private extractDirectProviderResponse(data: any) {
    if (this.settings.customLlmProvider === "openai-direct") return data.choices?.[0]?.message?.content?.trim() ?? "";
    if (this.settings.customLlmProvider === "anthropic-direct") return data.content?.[0]?.text?.trim() ?? "";
    if (this.settings.customLlmProvider === "google-direct") return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    return this.extractKieDirectResponse(data);
  }

  private extractKieDirectResponse(data: any) {
    const config = this.kieModelConfig;
    if (config?.family === "chat-completions") {
      const message = data.choices?.[0]?.message;
      return this.collectResponseText(message?.content ?? data.choices).join("\n").trim();
    }
    if (config?.family === "claude") return this.collectResponseText(data.content || data.message || data.choices || data.output || data).join("\n").trim();
    if (config?.family === "gemini-native") {
      const parts = data.candidates?.[0]?.content?.parts;
      return Array.isArray(parts) ? parts.map((part) => part.text || "").filter(Boolean).join("\n").trim() : "";
    }
    return this.collectResponseText(data.output_text || data.output || data.message || data.content || data.choices).join("\n").trim();
  }

  private createKieChatMessages(messages: LLMMessage[]) {
    return messages.map((message) => ({ role: message.role, content: this.normalizeTextContent(message.content) }));
  }

  private createKieResponsesInput(messages: LLMMessage[]) {
    return messages.map((message) => ({
      role: message.role === "assistant" ? "assistant" : message.role,
      content: [{ type: "input_text", text: this.normalizeTextContent(message.content) }],
    }));
  }

  private createKieGeminiContents(messages: LLMMessage[]) {
    const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];
    let pendingUserText: string[] = [];
    for (const message of messages.filter((item) => item.role !== "system")) {
      const text = this.normalizeTextContent(message.content);
      if (!text) continue;
      if (message.role === "user") {
        pendingUserText.push(text);
        continue;
      }
      if (pendingUserText.length) {
        contents.push({ role: "user", parts: [{ text: pendingUserText.join("\n\n") }] });
        pendingUserText = [];
      }
      contents.push({ role: "model", parts: [{ text }] });
    }
    if (pendingUserText.length) contents.push({ role: "user", parts: [{ text: pendingUserText.join("\n\n") }] });
    return contents;
  }

  private collectResponseText(value: any, chunks: string[] = []) {
    if (typeof value === "string") {
      chunks.push(value);
      return chunks;
    }
    if (!value || typeof value !== "object") return chunks;
    if (Array.isArray(value)) {
      value.forEach((item) => this.collectResponseText(item, chunks));
      return chunks;
    }
    if (typeof value.text === "string") chunks.push(value.text);
    if (typeof value.output_text === "string") chunks.push(value.output_text);
    if (typeof value.content === "string") chunks.push(value.content);
    if (value.message) this.collectResponseText(value.message, chunks);
    if (value.content && typeof value.content !== "string") this.collectResponseText(value.content, chunks);
    if (value.output) this.collectResponseText(value.output, chunks);
    if (value.parts) this.collectResponseText(value.parts, chunks);
    return chunks;
  }

  private normalizeTextContent(content: unknown): string {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content.map((part) => (typeof part === "string" ? part : part?.text ?? "")).filter(Boolean).join("\n");
    }
    return content == null ? "" : String(content);
  }

  private getKieReasoningLevel(): KieReasoningLevel {
    return ["high", "low", "off"].includes(this.settings.kieReasoningLevel) ? this.settings.kieReasoningLevel : "high";
  }

  private isDirectProvider() {
    return DIRECT_PROVIDERS.has(this.settings.customLlmProvider);
  }

  private sanitizeConversationHistory(history: LLMMessage[]) {
    const basePrompt = this.createBaseSystemPrompt();
    let hasBasePrompt = false;
    const sanitized = history
      .map((message) => {
        if (!message?.content) return message;
        if (message.role === "system" && message.content === basePrompt) hasBasePrompt = true;
        if (this.hasLegacySpeechFormatting(message.content)) {
          if (message.role === "system" && /roleplay:/i.test(message.content)) {
            hasBasePrompt = true;
            return { ...message, content: basePrompt };
          }
          return { ...message, content: this.stripSpeechMarkup(message.content) };
        }
        return message;
      })
      .filter((message): message is LLMMessage => Boolean(message?.content));
    if (!hasBasePrompt) sanitized.unshift({ role: "system", content: basePrompt });
    return sanitized;
  }

  private stripSpeechMarkup(text: string) {
    return text.replace(/<\/?(?:speak|voice|prosody|emphasis|break|phoneme|sub|say-as|mstts:express-as)\b[^>]*>/gi, " ").replace(/\s+/g, " ").trim();
  }

  private hasLegacySpeechFormatting(text: string) {
    return /IMPORTANT SPEECH FORMATTING|Speech Synthesis Markup|mstts:express-as|<\/?speak\b/i.test(text);
  }

  private isPersonaInternalMessage(message: LLMMessage) {
    return message.content.includes("[INTERNAL CHARACTER PROFILE") || message.content.includes("[CUSTOM PERSONA");
  }
}
