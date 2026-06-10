import { marked } from "marked";

import type { LegacyLLMMessage } from "../types/legacy";

export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  kind: "text" | "image";
  content: string;
  imageUrl?: string;
  alt?: string;
  timestamp: string;
}

export function createTextMessage(role: MessageRole, content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    kind: "text",
    content,
    timestamp: new Date().toISOString(),
  };
}

export function createImageMessage(role: MessageRole, imageUrl: string, alt = "Generated image"): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    kind: "image",
    content: alt,
    imageUrl,
    alt,
    timestamp: new Date().toISOString(),
  };
}

export function cleanAssistantText(text: string) {
  const source = text.trim();
  if (!source) return source;

  if (window.SSMLProcessor) {
    try {
      const processor = new window.SSMLProcessor();
      const result = processor.extractSSML(source);
      if (result.hasSSML) return stripMarkdownFence(result.cleanText);
    } catch {
      // Fall through to regex cleanup.
    }
  }

  const withoutSpeak = source.replace(/<speak[^>]*>[\s\S]*?<\/speak>/gi, "").trim();
  return stripMarkdownFence(withoutSpeak || source);
}

export function stripMarkdownFence(text: string) {
  const match = text.trim().match(/```(?:markdown)?\n?([\s\S]*?)\n?```/i);
  return match ? match[1].trim() : text.trim();
}

export function markdownToHtml(text: string) {
  return marked.parse(cleanAssistantText(text), { async: false }) as string;
}

export function historyToMessages(history: LegacyLLMMessage[]): ChatMessage[] {
  return history
    .filter((message) => message.role !== "system" && !message.hidden && message.content)
    .map((message) => {
      const role = message.role === "user" ? "user" : "assistant";
      try {
        const parsed = JSON.parse(message.content);
        if (parsed?.type === "image" && parsed.url) {
          return createImageMessage(role, parsed.url, parsed.alt ?? "Generated image");
        }
      } catch {
        // Not an image payload.
      }
      return createTextMessage(role, message.content);
    });
}

export function keywordsHelp() {
  return [
    "# VeilChat Shortcuts",
    "",
    "**Image generation**",
    '- `show me ...` asks the assistant to turn the conversation into an image prompt.',
    '- `xx ...` generates an image directly from your prompt.',
    "",
    "**Research and reasoning**",
    "- `search for ...`, `look up ...`, and `web search ...` use the configured search provider.",
    "- `research ...`, `investigate ...`, and `find out about ...` can use the MCP research workflow.",
    "- `break down ...`, `reason through ...`, and `analyze step by step ...` use sequential reasoning when MCP is enabled.",
    "",
    "**Files and voice**",
    "- Attach documents with the paperclip and ask questions against their content.",
    "- Use the microphone when speech recognition is available.",
  ].join("\n");
}

export function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
