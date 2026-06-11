export type LLMRole = "system" | "user" | "assistant";

export interface LLMMessage {
  role: LLMRole;
  content: string;
  hidden?: boolean;
  timestamp?: string;
}

export type LLMResponse =
  | { type: "image_request"; prompt: string }
  | { type: "text"; content: string }
  | { type: "error"; content: string };

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

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: "brave" | "google";
}

export interface ValidationResult {
  isValid: boolean;
  sanitizedInput: string;
  sanitizedContent?: string;
  violations: string[];
  riskLevel?: string;
}
