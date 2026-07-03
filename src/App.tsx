import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUp,
  Brain,
  ChevronDown,
  FileText,
  FolderOpen,
  History,
  Image as ImageIcon,
  Leaf,
  Menu,
  Mic,
  Paperclip,
  Plus,
  Save,
  Search,
  Send,
  Settings,
  SlidersHorizontal,
  Sparkles,
  SquarePen,
  Trash2,
  UserRound,
  Volume2,
  Waves,
  X,
  Zap,
} from "lucide-react";
import { type ChangeEvent, type FormEvent, type ReactNode, useLayoutEffect, useRef, useState } from "react";

import { cleanAssistantText, markdownToHtml, type ChatMessage } from "./lib/format";
import { getKieImageModelControls, KIE_CHAT_MODELS, KIE_IMAGE_MODELS, type AppSettings, type SelectOption } from "./lib/settings";
import { useVeilChat } from "./lib/useVeilChat";
import "@fontsource/cormorant-garamond/500-italic.css";
import "./styles.css";

const personaTemplates = [
  {
    id: "teacher",
    name: "Teacher",
    prompt:
      "A patient, vivid teacher who explains complex topics with clear analogies, checks for understanding, and keeps the tone encouraging without becoming childish.",
  },
  {
    id: "creative",
    name: "Creative",
    prompt:
      "A sharp creative partner with a cinematic imagination, practical taste, and a bias toward original ideas over familiar tropes.",
  },
  {
    id: "analyst",
    name: "Analyst",
    prompt:
      "A careful analyst who surfaces tradeoffs, separates evidence from assumptions, and helps turn messy information into crisp decisions.",
  },
  {
    id: "friend",
    name: "Friend",
    prompt:
      "A grounded conversational companion who is warm, candid, funny in a dry way, and emotionally perceptive without being overbearing.",
  },
];

const navItems = [
  { id: "chat", label: "Chat", icon: SquarePen },
  { id: "persona", label: "Persona", icon: UserRound },
  { id: "settings", label: "Settings", icon: SlidersHorizontal },
  { id: "history", label: "History", icon: History },
] as const;

type ViewId = (typeof navItems)[number]["id"];

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function App() {
  const { state, actions } = useVeilChat();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadInputRef = useRef<HTMLInputElement>(null);

  const activeView = state.activeView as ViewId;
  const hasMessages = state.messages.length > 0;

  const handleFileAttach = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) actions.attachFiles(event.target.files);
    event.target.value = "";
  };

  const handleConversationLoad = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) actions.loadConversation(file);
    event.target.value = "";
  };

  return (
    <div className={cx("app-shell", sidebarCollapsed && "sidebar-collapsed", hasMessages && "has-messages", state.settings.chatBackdropEnabled && "backdrop-on")}>
      <div className="atmosphere" aria-hidden="true" />
      <input ref={fileInputRef} className="hidden-input" type="file" multiple accept=".txt,.js,.py,.json,.pdf,.docx,.html,.css,.md,.xml,.yaml,.yml,.log,.cpp,.h,.cs,image/png,image/jpeg,image/webp" onChange={handleFileAttach} />
      <input ref={loadInputRef} className="hidden-input" type="file" accept=".json,application/json" onChange={handleConversationLoad} />

      <aside className={cx("sidebar", mobileNavOpen && "is-open")}>
        <div className="brand-lockup">
          <div className="brand-copy">
            <strong>VeilChat</strong>
            <span>quiet AI studio</span>
          </div>
          <button
            className="sidebar-ghost-button"
            type="button"
            aria-label="Hide sidebar"
            title="Hide sidebar"
            onClick={() => {
              setMobileNavOpen(false);
              setSidebarCollapsed(true);
            }}
          >
            <X size={17} />
          </button>
        </div>

        <button className="new-chat-button" type="button" onClick={actions.newConversation}>
          <Plus size={17} />
          New Chat
        </button>

        <nav className="primary-nav" aria-label="VeilChat sections">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
            className={cx("nav-button", activeView === item.id && "is-active")}
                type="button"
                onClick={() => {
                  actions.setActiveView(item.id);
                  setMobileNavOpen(false);
                }}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="main-surface">
        {sidebarCollapsed && (
          <button className="sidebar-peek" type="button" aria-label="Show sidebar" title="Show sidebar" onClick={() => setSidebarCollapsed(false)}>
            <Menu size={19} />
          </button>
        )}

        <header className="mobile-topbar">
          <button
            className="icon-button"
            type="button"
            aria-label="Open navigation"
            title="Open navigation"
            onClick={() => {
              setSidebarCollapsed(false);
              setMobileNavOpen((open) => !open);
            }}
          >
            {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span>VeilChat</span>
          <button className="icon-button" type="button" aria-label="New chat" title="New chat" onClick={actions.newConversation}>
            <Plus size={20} />
          </button>
        </header>

        <AnimatePresence mode="wait">
          {activeView === "chat" && (
            <motion.section key="chat" className="view view-chat" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.28 }}>
              <ChatView
                busy={state.busy}
                documentsCount={state.documents.length}
                imageReferencesCount={state.imageReferencesCount}
                input={state.input}
                isListening={state.isListening}
                messages={state.messages}
                settings={state.settings}
                voiceAvailable={state.voiceAvailable}
                onAttach={() => fileInputRef.current?.click()}
                onImagePreview={setPreviewImage}
                onInput={actions.setInput}
                onSend={actions.sendMessage}
                onToggleBackdrop={() => actions.updateAppSetting("chatBackdropEnabled", !state.settings.chatBackdropEnabled)}
                onToggleVoice={actions.toggleVoice}
              />
            </motion.section>
          )}

          {activeView === "persona" && (
            <motion.section key="persona" className="view panel-view" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.28 }}>
              <PersonaView busy={state.busy} currentPrompt={state.personaPrompt} onCreate={actions.createPersona} />
            </motion.section>
          )}

          {activeView === "settings" && (
            <motion.section key="settings" className="view panel-view" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.28 }}>
              <SettingsView settings={state.settings} onChange={actions.updateAppSetting} />
            </motion.section>
          )}

          {activeView === "history" && (
            <motion.section key="history" className="view panel-view" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.28 }}>
              <HistoryView
                documents={state.documents}
                lastSavedAt={state.lastSavedAt}
                messagesCount={state.messages.length}
                onAttach={() => fileInputRef.current?.click()}
                onClearDocs={actions.clearDocuments}
                onLoad={() => loadInputRef.current?.click()}
                onNew={actions.newConversation}
                onRemoveDoc={actions.removeDocument}
                onSave={actions.saveConversation}
              />
            </motion.section>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {state.notice && (
            <motion.div className="notice" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}>
              <span>{state.notice}</span>
              <button type="button" onClick={() => actions.setNotice("")} aria-label="Dismiss notice">
                <X size={15} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {previewImage && (
          <motion.button className="image-lightbox" type="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPreviewImage(null)} aria-label="Close image preview">
            <img src={previewImage} alt="" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChatView(props: {
  busy: string;
  documentsCount: number;
  imageReferencesCount: number;
  input: string;
  isListening: boolean;
  messages: ChatMessage[];
  settings: AppSettings;
  voiceAvailable: boolean;
  onAttach: () => void;
  onImagePreview: (url: string) => void;
  onInput: (value: string) => void;
  onSend: (message?: string) => void;
  onToggleBackdrop: () => void;
  onToggleVoice: () => void;
}) {
  const empty = props.messages.length === 0;
  const composer = (
    <Composer
      busy={props.busy}
      documentsCount={props.documentsCount}
      imageReferencesCount={props.imageReferencesCount}
      input={props.input}
      initial={empty}
      isListening={props.isListening}
      settings={props.settings}
      showBackdrop={props.settings.chatBackdropEnabled}
      voiceAvailable={props.voiceAvailable}
      onAttach={props.onAttach}
      onInput={props.onInput}
      onSend={props.onSend}
      onToggleBackdrop={props.onToggleBackdrop}
      onToggleVoice={props.onToggleVoice}
    />
  );

  return (
    <div className={cx("chat-layout", empty && "is-empty")}>
      <div className="chat-canvas">
        {props.settings.chatBackdropEnabled && <div className="chat-backdrop-image" aria-hidden="true" />}
        {empty ? (
          <div className="empty-experience">
            <EmptyPrompt />
            {composer}
            <PromptSuggestions onPrompt={props.onSend} />
          </div>
        ) : (
          <div className="message-stream" role="log" aria-live="polite">
            {props.messages.map((message, index) => (
              <motion.div key={message.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: Math.min(index * 0.01, 0.08) }}>
                <MessageItem message={message} onImagePreview={props.onImagePreview} />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {!empty && composer}
    </div>
  );
}

function EmptyPrompt() {
  return (
    <div className="empty-prompt">
      <p className="eyebrow">veilchat</p>
      <h1>What are we making today?</h1>
      <p className="empty-copy">Begin anywhere.</p>
    </div>
  );
}

function PromptSuggestions({ onPrompt }: { onPrompt: (message?: string) => void }) {
  const prompts = ["Shape a strange idea", "Coastal oracle", "Creative sprint"];
  return (
    <div className="prompt-row">
      {prompts.map((prompt) => (
        <button key={prompt} type="button" onClick={() => onPrompt(prompt)}>
          {prompt}
        </button>
      ))}
    </div>
  );
}

function Composer(props: {
  busy: string;
  documentsCount: number;
  imageReferencesCount: number;
  input: string;
  initial: boolean;
  isListening: boolean;
  settings: AppSettings;
  showBackdrop: boolean;
  voiceAvailable: boolean;
  onAttach: () => void;
  onInput: (value: string) => void;
  onSend: (message?: string) => void;
  onToggleBackdrop: () => void;
  onToggleVoice: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [props.input]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    props.onSend();
  };

  const modelLabel = getComposerModelLabel(props.settings);
  const stateLabel = getComposerStateLabel(props);
  const statusTitle = [modelLabel, stateLabel, getComposerAttachmentLabel(props.documentsCount, props.imageReferencesCount)].filter(Boolean).join(" - ");

  if (props.initial) {
    return (
      <form className="composer composer-initial" onSubmit={submit}>
        <div className="composer-box">
          <textarea
            ref={textareaRef}
            id="user-input"
            value={props.input}
            placeholder="Ask VeilChat"
            rows={1}
            onChange={(event) => props.onInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                props.onSend();
              }
            }}
          />
          <div className="initial-composer-toolbar">
            <div className="initial-composer-tools">
              <button className="initial-composer-tool" type="button" aria-label="Attach documents" title="Attach documents" onClick={props.onAttach}>
                <Plus size={32} />
              </button>
              <button className={cx("initial-composer-tool initial-composer-accent", props.showBackdrop && "is-active")} type="button" aria-label="Toggle chat background" title="Toggle chat background" onClick={props.onToggleBackdrop}>
                <ImageIcon size={24} />
              </button>
            </div>
            <div className="initial-composer-status" title={statusTitle} aria-live="polite">
              <Zap size={24} />
              <span>{modelLabel}</span>
              <span>{stateLabel}</span>
            </div>
            <div className="initial-composer-actions">
              <button className={cx("initial-composer-tool", props.isListening && "is-live")} type="button" aria-label="Voice input" title="Voice input" onClick={props.onToggleVoice} disabled={!props.voiceAvailable}>
                <Mic size={31} />
              </button>
              <button className="initial-send-button" type="submit" disabled={!props.input.trim() || props.busy !== "idle"} aria-label="Send message" title="Send message">
                <ArrowUp size={34} />
              </button>
            </div>
          </div>
        </div>
      </form>
    );
  }

  return (
    <form className="composer" onSubmit={submit}>
      <div className="composer-meta">
        <span>{props.busy === "idle" ? "Ready" : props.busy}</span>
        {props.documentsCount > 0 && <span>{props.documentsCount} file{props.documentsCount === 1 ? "" : "s"} attached</span>}
        {props.imageReferencesCount > 0 && <span>{props.imageReferencesCount} image ref{props.imageReferencesCount === 1 ? "" : "s"}</span>}
      </div>
      <div className="composer-box">
        <button className="icon-button" type="button" aria-label="Attach documents" title="Attach documents" onClick={props.onAttach}>
          <Paperclip size={19} />
        </button>
        <textarea
          ref={textareaRef}
          id="user-input"
          value={props.input}
          placeholder="Ask anything, or just say Hi"
          rows={1}
          onChange={(event) => props.onInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              props.onSend();
            }
          }}
        />
        <div className="composer-actions">
          <button className={cx("icon-button", props.isListening && "is-live")} type="button" aria-label="Voice input" title="Voice input" onClick={props.onToggleVoice} disabled={!props.voiceAvailable}>
            <Mic size={19} />
          </button>
          <button className={cx("icon-button", props.showBackdrop && "is-active")} type="button" aria-label="Toggle chat background" title="Toggle chat background" onClick={props.onToggleBackdrop}>
            <ImageIcon size={19} />
          </button>
          <button className="send-button" type="submit" disabled={!props.input.trim() || props.busy !== "idle"} aria-label="Send message" title="Send message">
            <Send size={18} />
          </button>
        </div>
      </div>
    </form>
  );
}

function getComposerModelLabel(settings: AppSettings) {
  const raw =
    settings.customLlmProvider === "openai-direct"
      ? settings.openaiModelIdentifier
      : settings.customLlmProvider === "anthropic-direct"
        ? settings.anthropicModelIdentifier
        : settings.customLlmProvider === "google-direct"
          ? settings.googleModelIdentifier
          : settings.customLlmProvider === "kie-direct"
            ? settings.kieModelIdentifier
            : settings.customLlmModelIdentifier;

  const compact = (raw || "Model").split("/").pop() ?? raw;
  return compact
    .replace(/-/g, " ")
    .replace(/\bgpt\b/gi, "GPT")
    .replace(/\bai\b/gi, "AI")
    .replace(/\bclaude\b/gi, "Claude")
    .replace(/\bgemini\b/gi, "Gemini")
    .replace(/\bflash\b/gi, "Flash")
    .replace(/\bsonnet\b/gi, "Sonnet")
    .replace(/\bopus\b/gi, "Opus")
    .trim();
}

function getComposerStateLabel(props: {
  busy: string;
  documentsCount: number;
  imageReferencesCount: number;
  settings: AppSettings;
}) {
  const attachmentLabel = getComposerAttachmentLabel(props.documentsCount, props.imageReferencesCount);
  if (props.busy !== "idle") return props.busy;
  if (attachmentLabel) return attachmentLabel;
  if (props.settings.customLlmProvider === "kie-direct") {
    return props.settings.kieReasoningLevel === "off" ? "Reasoning off" : `${capitalizeLabel(props.settings.kieReasoningLevel)} reasoning`;
  }
  return "Ready";
}

function getComposerAttachmentLabel(documentsCount: number, imageReferencesCount: number) {
  const parts = [];
  if (documentsCount > 0) parts.push(`${documentsCount} file${documentsCount === 1 ? "" : "s"}`);
  if (imageReferencesCount > 0) parts.push(`${imageReferencesCount} image ref${imageReferencesCount === 1 ? "" : "s"}`);
  return parts.join(" + ");
}

function capitalizeLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function MessageItem({ message, onImagePreview }: { message: ChatMessage; onImagePreview: (url: string) => void }) {
  const isAssistant = message.role === "assistant";
  return (
    <article className={cx("message-item", `from-${message.role}`)}>
      <div className="message-avatar" aria-hidden="true">
        {message.role === "user" ? <UserRound size={16} /> : message.role === "system" ? <Leaf size={16} /> : <Sparkles size={16} />}
      </div>
      <div className="message-body">
        <span className="message-label">{message.role === "user" ? "You" : message.role === "system" ? "VeilChat" : "Assistant"}</span>
        {message.kind === "image" && message.imageUrl ? (
          <button className="generated-image" type="button" onClick={() => onImagePreview(message.imageUrl!)}>
            <img src={message.imageUrl} alt={message.alt ?? "Generated image"} />
          </button>
        ) : isAssistant ? (
          <div className="markdown" dangerouslySetInnerHTML={{ __html: markdownToHtml(message.content) }} />
        ) : (
          <p>{cleanAssistantText(message.content)}</p>
        )}
      </div>
    </article>
  );
}

function PersonaView({ busy, currentPrompt, onCreate }: { busy: string; currentPrompt: string; onCreate: (prompt?: string) => void }) {
  const [draft, setDraft] = useState(currentPrompt);
  return (
    <div className="panel-content">
      <PanelHeader icon={<UserRound size={20} />} kicker="persona" title="Shape the voice" />
      <div className="persona-grid">
        <section className="form-section">
          <label htmlFor="persona-prompt">Custom persona</label>
          <textarea id="persona-prompt" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Describe expertise, temperament, boundaries, humor, pace, and creative instincts..." rows={9} />
          <div className="button-row">
            <button className="primary-action" type="button" disabled={busy !== "idle"} onClick={() => onCreate(draft)}>
              <Sparkles size={17} />
              Create Persona
            </button>
            <button className="secondary-action" type="button" disabled={busy !== "idle"} onClick={() => onCreate()}>
              Random Persona
            </button>
          </div>
        </section>
        <section className="template-list" aria-label="Persona templates">
          {personaTemplates.map((template) => (
            <button key={template.id} type="button" onClick={() => setDraft(template.prompt)}>
              <strong>{template.name}</strong>
              <span>{template.prompt}</span>
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}

function SettingsView({ settings, onChange }: { settings: AppSettings; onChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void }) {
  return (
    <div className="panel-content settings-content">
      <PanelHeader icon={<Settings size={20} />} kicker="settings" title="Control room" />

      <SettingsSection icon={<Brain size={19} />} title="LLM Provider">
        <Field label="Provider">
          <select value={settings.customLlmProvider} onChange={(event) => onChange("customLlmProvider", event.target.value as AppSettings["customLlmProvider"])}>
            <option value="litellm">LiteLLM</option>
            <option value="lmstudio">LMStudio</option>
            <option value="ollama">Ollama</option>
            <option value="openai-direct">OpenAI Direct</option>
            <option value="anthropic-direct">Anthropic Direct</option>
            <option value="google-direct">Google AI Studio</option>
            <option value="kie-direct">Kie.AI</option>
          </select>
        </Field>
        {["litellm", "lmstudio", "ollama"].includes(settings.customLlmProvider) && (
          <>
            <Field label="API base URL">
              <input value={settings.customLlmApiUrl} onChange={(event) => onChange("customLlmApiUrl", event.target.value)} placeholder="http://localhost:4000" />
            </Field>
            <Field label="Model">
              <input value={settings.customLlmModelIdentifier} onChange={(event) => onChange("customLlmModelIdentifier", event.target.value)} placeholder="gemini2.5-flash" />
            </Field>
            <Field label="API key">
              <input type="password" value={settings.customLlmApiKey} onChange={(event) => onChange("customLlmApiKey", event.target.value)} />
            </Field>
          </>
        )}
        {settings.customLlmProvider === "openai-direct" && (
          <>
            <Field label="OpenAI model">
              <input value={settings.openaiModelIdentifier} onChange={(event) => onChange("openaiModelIdentifier", event.target.value)} />
            </Field>
            <Field label="OpenAI key">
              <input type="password" value={settings.openaiApiKey} onChange={(event) => onChange("openaiApiKey", event.target.value)} />
            </Field>
          </>
        )}
        {settings.customLlmProvider === "anthropic-direct" && (
          <>
            <Field label="Anthropic model">
              <input value={settings.anthropicModelIdentifier} onChange={(event) => onChange("anthropicModelIdentifier", event.target.value)} />
            </Field>
            <Field label="Anthropic key">
              <input type="password" value={settings.anthropicApiKey} onChange={(event) => onChange("anthropicApiKey", event.target.value)} />
            </Field>
          </>
        )}
        {settings.customLlmProvider === "google-direct" && (
          <>
            <Field label="Google model">
              <input value={settings.googleModelIdentifier} onChange={(event) => onChange("googleModelIdentifier", event.target.value)} />
            </Field>
            <Field label="Google key">
              <input type="password" value={settings.googleApiKey} onChange={(event) => onChange("googleApiKey", event.target.value)} />
            </Field>
          </>
        )}
        {settings.customLlmProvider === "kie-direct" && (
          <>
            <Field label="Kie model">
              <GroupedSelect value={settings.kieModelIdentifier} groups={KIE_CHAT_MODELS} onChange={(value) => onChange("kieModelIdentifier", value)} />
            </Field>
            <Field label="Kie key">
              <input type="password" value={settings.kieApiKey} onChange={(event) => onChange("kieApiKey", event.target.value)} />
            </Field>
            <Field label="Reasoning">
              <select value={settings.kieReasoningLevel} onChange={(event) => onChange("kieReasoningLevel", event.target.value as AppSettings["kieReasoningLevel"])}>
                <option value="high">High</option>
                <option value="low">Low</option>
                <option value="off">Off</option>
              </select>
            </Field>
          </>
        )}
      </SettingsSection>

      <SettingsSection icon={<ImageIcon size={19} />} title="Image Generation">
        <Field label="Provider">
          <select value={settings.customImageProvider} onChange={(event) => onChange("customImageProvider", event.target.value as AppSettings["customImageProvider"])}>
            <option value="openai">OpenAI GPT-image-1</option>
            <option value="kie">Kie.AI</option>
            <option value="a1111">Local A1111</option>
            <option value="swarmui">SwarmUI</option>
          </select>
        </Field>
        <ToggleField
          label="VeilChat After Dark"
          icon={<AgeGateIcon />}
          checked={settings.veilChatAfterDark}
          onChange={(value) => onChange("veilChatAfterDark", value)}
        />
        {settings.customImageProvider === "a1111" && <A1111Settings settings={settings} onChange={onChange} />}
        {settings.customImageProvider === "swarmui" && <SwarmSettings settings={settings} onChange={onChange} />}
        {settings.customImageProvider === "openai" && (
          <>
            <Field label="Size">
              <select value={settings.imageSize} onChange={(event) => onChange("imageSize", event.target.value)}>
                <option value="auto">Auto</option>
                <option value="1024x1024">Square</option>
                <option value="1536x1024">Landscape</option>
                <option value="1024x1536">Portrait</option>
              </select>
            </Field>
            <Field label="Quality">
              <select value={settings.openaiQuality} onChange={(event) => onChange("openaiQuality", event.target.value)}>
                <option value="auto">Auto</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </Field>
            <Field label="Output">
              <select value={settings.openaiOutputFormat} onChange={(event) => onChange("openaiOutputFormat", event.target.value)}>
                <option value="png">PNG</option>
                <option value="jpeg">JPEG</option>
                <option value="webp">WebP</option>
              </select>
            </Field>
          </>
        )}
        {settings.customImageProvider === "kie" && (
          <KieImageSettings settings={settings} onChange={onChange} />
        )}
      </SettingsSection>

      <SettingsSection icon={<Volume2 size={19} />} title="Voice">
        <Field label="TTS voice">
          <VoiceSelect value={settings.ttsVoice} onChange={(value) => onChange("ttsVoice", value)} />
        </Field>
        <Field label={`Speed ${settings.voiceSpeed.toFixed(1)}x`}>
          <input type="range" min="0.1" max="2" step="0.1" value={settings.voiceSpeed} onChange={(event) => onChange("voiceSpeed", Number(event.target.value))} />
        </Field>
        <Field label={`Pitch ${settings.voicePitch.toFixed(1)}`}>
          <input type="range" min="0.5" max="2" step="0.1" value={settings.voicePitch} onChange={(event) => onChange("voicePitch", Number(event.target.value))} />
        </Field>
      </SettingsSection>

      <SettingsSection icon={<Search size={19} />} title="Search">
        <ToggleField label="Enable search" checked={settings.searchEnabled} onChange={(value) => onChange("searchEnabled", value)} />
        <Field label="Search provider">
          <select value={settings.searchProvider} onChange={(event) => onChange("searchProvider", event.target.value as AppSettings["searchProvider"])}>
            <option value="brave">Brave</option>
            <option value="google">Google Custom Search</option>
          </select>
        </Field>
        {settings.searchProvider === "brave" && (
          <Field label="Brave key">
            <input type="password" value={settings.braveSearchApiKey} onChange={(event) => onChange("braveSearchApiKey", event.target.value)} />
          </Field>
        )}
        {settings.searchProvider === "google" && (
          <>
            <Field label="Google key">
              <input type="password" value={settings.googleSearchApiKey} onChange={(event) => onChange("googleSearchApiKey", event.target.value)} />
            </Field>
            <Field label="Engine ID">
              <input value={settings.googleSearchEngineId} onChange={(event) => onChange("googleSearchEngineId", event.target.value)} />
            </Field>
          </>
        )}
        <Field label="Result limit">
          <input type="number" min="1" max="10" value={settings.searchResultsLimit} onChange={(event) => onChange("searchResultsLimit", event.target.value)} />
        </Field>
      </SettingsSection>

      <SettingsSection icon={<Waves size={19} />} title="Interface">
        <ToggleField label="Background image" checked={settings.chatBackdropEnabled} onChange={(value) => onChange("chatBackdropEnabled", value)} />
        <Field label={`Text size ${settings.fontSize}px`}>
          <input type="range" min="12" max="22" value={settings.fontSize} onChange={(event) => onChange("fontSize", Number(event.target.value))} />
        </Field>
      </SettingsSection>
    </div>
  );
}

function KieImageSettings({ settings, onChange }: { settings: AppSettings; onChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void }) {
  const controls = getKieImageModelControls(settings.kieImageModelIdentifier);

  const updateModel = (value: string) => {
    const nextControls = getKieImageModelControls(value);
    onChange("kieImageModelIdentifier", value);
    syncSelectSetting("kieImageAspectRatio", settings.kieImageAspectRatio, nextControls.aspectRatios, nextControls.defaults.aspectRatio);
    syncSelectSetting("kieImageQuality", settings.kieImageQuality, nextControls.qualities, nextControls.defaults.quality);
    syncSelectSetting("kieImageResolution", settings.kieImageResolution, nextControls.resolutions, nextControls.defaults.resolution);
    syncSelectSetting("kieImageOutputFormat", settings.kieImageOutputFormat, nextControls.outputs, nextControls.defaults.outputFormat);
  };

  const syncSelectSetting = <K extends "kieImageAspectRatio" | "kieImageQuality" | "kieImageResolution" | "kieImageOutputFormat">(
    key: K,
    currentValue: AppSettings[K],
    options: readonly SelectOption[],
    fallback?: string
  ) => {
    if (!options.length || options.some((option) => option.value === currentValue)) return;
    onChange(key, (fallback ?? options[0].value) as AppSettings[K]);
  };

  return (
    <>
      <Field label="Kie image model">
        <GroupedSelect value={settings.kieImageModelIdentifier} groups={KIE_IMAGE_MODELS} onChange={updateModel} />
      </Field>
      <Field label="Kie key">
        <input type="password" value={settings.kieApiKey} onChange={(event) => onChange("kieApiKey", event.target.value)} />
      </Field>
      {controls.aspectRatios.length > 0 && (
        <Field label="Aspect">
          <select value={selectSettingValue(settings.kieImageAspectRatio, controls.aspectRatios, controls.defaults.aspectRatio)} onChange={(event) => onChange("kieImageAspectRatio", event.target.value)}>
            {controls.aspectRatios.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      )}
      {controls.qualities.length > 1 && (
        <Field label="Quality">
          <select value={selectSettingValue(settings.kieImageQuality, controls.qualities, controls.defaults.quality)} onChange={(event) => onChange("kieImageQuality", event.target.value)}>
            {controls.qualities.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      )}
      {controls.resolutions.length > 0 && (
        <Field label="Resolution">
          <select value={selectSettingValue(settings.kieImageResolution, controls.resolutions, controls.defaults.resolution)} onChange={(event) => onChange("kieImageResolution", event.target.value)}>
            {controls.resolutions.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      )}
      {controls.outputs.length > 0 && (
        <Field label="Output">
          <select value={selectSettingValue(settings.kieImageOutputFormat, controls.outputs, controls.defaults.outputFormat)} onChange={(event) => onChange("kieImageOutputFormat", event.target.value)}>
            {controls.outputs.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      )}
    </>
  );
}

function selectSettingValue(value: string, options: readonly SelectOption[], fallback?: string) {
  if (options.some((option) => option.value === value)) return value;
  return fallback ?? options[0]?.value ?? value;
}

function A1111Settings({ settings, onChange }: { settings: AppSettings; onChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void }) {
  return (
    <>
      <Field label="API URL">
        <input value={settings.customImageApiUrl} onChange={(event) => onChange("customImageApiUrl", event.target.value)} />
      </Field>
      <Field label="Width">
        <input type="number" value={settings.imageWidth} onChange={(event) => onChange("imageWidth", event.target.value)} />
      </Field>
      <Field label="Height">
        <input type="number" value={settings.imageHeight} onChange={(event) => onChange("imageHeight", event.target.value)} />
      </Field>
      <Field label="Steps">
        <input type="number" value={settings.imageSteps} onChange={(event) => onChange("imageSteps", event.target.value)} />
      </Field>
      <Field label="CFG">
        <input type="number" step="0.1" value={settings.imageCfgScale} onChange={(event) => onChange("imageCfgScale", event.target.value)} />
      </Field>
    </>
  );
}

function SwarmSettings({ settings, onChange }: { settings: AppSettings; onChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void }) {
  return (
    <>
      <Field label="API URL">
        <input value={settings.swarmuiApiUrl} onChange={(event) => onChange("swarmuiApiUrl", event.target.value)} />
      </Field>
      <Field label="Width">
        <input type="number" value={settings.swarmuiWidth} onChange={(event) => onChange("swarmuiWidth", Number(event.target.value))} />
      </Field>
      <Field label="Height">
        <input type="number" value={settings.swarmuiHeight} onChange={(event) => onChange("swarmuiHeight", Number(event.target.value))} />
      </Field>
      <Field label="Model">
        <input value={settings.swarmuiModel} onChange={(event) => onChange("swarmuiModel", event.target.value)} />
      </Field>
    </>
  );
}

function HistoryView(props: {
  documents: Array<{ id: number; name: string; preview: string; size: number; type: string }>;
  lastSavedAt: string | null;
  messagesCount: number;
  onAttach: () => void;
  onClearDocs: () => void;
  onLoad: () => void;
  onNew: () => void;
  onRemoveDoc: (id: number) => void;
  onSave: () => void;
}) {
  return (
    <div className="panel-content">
      <PanelHeader icon={<History size={20} />} kicker="memory" title="History and context" />
      <div className="history-actions">
        <button className="primary-action" type="button" onClick={props.onSave}>
          <Save size={17} />
          Save Conversation
        </button>
        <button className="secondary-action" type="button" onClick={props.onLoad}>
          <FolderOpen size={17} />
          Load Conversation
        </button>
        <button className="secondary-action" type="button" onClick={props.onNew}>
          <Trash2 size={17} />
          New Chat
        </button>
      </div>
      <div className="history-summary">
        <span>{props.messagesCount} visible messages</span>
        <span>{props.documents.length} attached documents</span>
        <span>{props.lastSavedAt ? `Saved ${new Date(props.lastSavedAt).toLocaleString()}` : "Not saved this session"}</span>
      </div>

      <section className="document-section">
        <div className="section-title-row">
          <h3>Attached Documents</h3>
          <div>
            <button className="mini-action" type="button" onClick={props.onAttach}>
              <Paperclip size={15} />
              Attach
            </button>
            <button className="mini-action" type="button" onClick={props.onClearDocs}>
              Clear
            </button>
          </div>
        </div>
        {props.documents.length ? (
          <div className="document-list">
            {props.documents.map((doc) => (
              <div className="document-item" key={doc.id}>
                <FileText size={17} />
                <div>
                  <strong>{doc.name}</strong>
                  <span>{doc.type} · {doc.preview}</span>
                </div>
                <button type="button" aria-label={`Remove ${doc.name}`} onClick={() => props.onRemoveDoc(doc.id)}>
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No documents attached.</p>
        )}
      </section>
    </div>
  );
}

function PanelHeader({ icon, kicker, title }: { icon: ReactNode; kicker: string; title: string }) {
  return (
    <header className="panel-header">
      <div className="panel-icon">{icon}</div>
      <div>
        <p className="eyebrow">{kicker}</p>
        <h2>{title}</h2>
      </div>
    </header>
  );
}

function SettingsSection({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <details className="settings-section" open>
      <summary>
        <span>{icon}</span>
        {title}
        <ChevronDown size={16} />
      </summary>
      <div className="settings-fields">{children}</div>
    </details>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function GroupedSelect({
  groups,
  onChange,
  value,
}: {
  groups: ReadonlyArray<{ group: string; value: string; label: string }>;
  onChange: (value: string) => void;
  value: string;
}) {
  const groupNames = Array.from(new Set(groups.map((item) => item.group)));
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      {groupNames.map((group) => (
        <optgroup label={group} key={group}>
          {groups
            .filter((item) => item.group === group)
            .map((item) => (
              <option value={item.value} key={item.value}>
                {item.label}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}

function ToggleField({ checked, icon, label, onChange }: { checked: boolean; icon?: ReactNode; label: string; onChange: (value: boolean) => void }) {
  return (
    <label className="toggle-field">
      <span className="toggle-label">
        {icon}
        {label}
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <i aria-hidden="true" />
    </label>
  );
}

function AgeGateIcon() {
  return (
    <span className="age-gate-icon" aria-hidden="true">
      18+
    </span>
  );
}

function VoiceSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const voices = ["AUTO", "Ava", "Jenny", "Emma", "Sara", "Aria", "Ashley", "Andrew", "Brian", "Guy", "Jason", "Tony", "Sonia", "Libby", "Olivia", "Hollie", "Ryan", "Alfie", "Oliver", "Natasha", "Freya", "William", "Neil", "Clara", "Liam"];
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      {voices.map((voice) => (
        <option value={voice} key={voice}>
          {voice === "AUTO" ? "Auto" : voice}
        </option>
      ))}
    </select>
  );
}
