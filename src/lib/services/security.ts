import type { ValidationResult } from "./types";

type InputType = "userMessage" | "imagePrompt" | "characterPrompt" | "fileContent";

const LIMITS: Record<InputType, number> = {
  userMessage: 50_000,
  imagePrompt: 4_000,
  characterPrompt: 12_000,
  fileContent: 1_000_000,
};

const DANGEROUS_PATTERNS = [
  /<script\b[^>]*>[\s\S]*?<\/script>/gi,
  /javascript:/gi,
  /\bon\w+\s*=/gi,
  /<iframe\b/gi,
  /<object\b/gi,
  /<embed\b/gi,
  /\b(?:rm\s+-rf|del\s+\/[fq]|format\s+[a-z]:)\b/gi,
];

function stripControlCharacters(value: string) {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

function sanitize(value: string) {
  return stripControlCharacters(value).replace(/\r\n/g, "\n").trim();
}

export class SecurityValidator {
  validateUserInput(input: string, type: InputType = "userMessage"): ValidationResult {
    const limit = LIMITS[type] ?? LIMITS.userMessage;
    const sanitizedInput = sanitize(String(input ?? ""));
    const violations: string[] = [];

    if (sanitizedInput.length > limit) {
      violations.push(`Input is longer than ${limit.toLocaleString()} characters.`);
    }

    for (const pattern of DANGEROUS_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(sanitizedInput)) {
        violations.push("Input contains potentially unsafe markup or commands.");
        break;
      }
    }

    return {
      isValid: violations.length === 0,
      sanitizedInput: sanitizedInput.slice(0, limit),
      violations,
      riskLevel: violations.length ? "medium" : "low",
    };
  }

  validateAttachedFileContent(content: string, fileName: string, fileType: string): ValidationResult {
    const validation = this.validateUserInput(content, "fileContent");
    return {
      ...validation,
      sanitizedContent: validation.sanitizedInput,
      violations: validation.violations.map((violation) => `${fileName || fileType}: ${violation}`),
    };
  }

  logSecurityEvent(eventName: string, details: Record<string, unknown>) {
    try {
      const securityLog = JSON.parse(localStorage.getItem("securityLog") || "[]") as unknown[];
      securityLog.push({ eventName, details, timestamp: new Date().toISOString() });
      localStorage.setItem("securityLog", JSON.stringify(securityLog.slice(-100)));
    } catch (error) {
      console.warn("Security log failed:", error);
    }
  }
}
