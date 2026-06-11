import { SecurityValidator } from "./security";
import type { AttachedDocument } from "./types";

interface PdfPage {
  getTextContent: () => Promise<{ items: Array<{ str: string }> }>;
}

interface PdfDocument {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
}

interface PdfJsLib {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (data: Uint8Array) => { promise: Promise<PdfDocument> };
}

interface MammothLib {
  extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
}

declare global {
  interface Window {
    pdfjsLib?: PdfJsLib;
    mammoth?: MammothLib;
  }
}

type ProcessResult = { success: true; document: AttachedDocument } | { success: false; fileName: string; error: string };

export class DocumentContextService {
  private readonly maxFileSize = 10 * 1024 * 1024;
  private readonly security: SecurityValidator;
  private attachedDocuments: AttachedDocument[] = [];

  private readonly supportedTypes: Record<string, string> = {
    "text/plain": "txt",
    "application/json": "json",
    "text/javascript": "js",
    "application/javascript": "js",
    "text/x-python": "py",
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/html": "html",
    "text/css": "css",
    "text/markdown": "md",
    "application/xml": "xml",
    "text/xml": "xml",
    "application/x-yaml": "yaml",
    "text/yaml": "yaml",
  };

  private readonly extensionMap: Record<string, string> = {
    txt: "txt",
    js: "js",
    py: "py",
    json: "json",
    pdf: "pdf",
    docx: "docx",
    cpp: "cpp",
    h: "cpp",
    cs: "cs",
    html: "html",
    css: "css",
    md: "md",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    log: "txt",
  };

  constructor(security = new SecurityValidator()) {
    this.security = security;
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }
  }

  async processFiles(files: File[]): Promise<ProcessResult[]> {
    const results: ProcessResult[] = [];

    for (const file of files) {
      try {
        if (file.size > this.maxFileSize) {
          throw new Error(`File ${file.name} is too large (max 10MB).`);
        }

        const fileType = this.getFileType(file);
        if (!fileType) {
          throw new Error(`File type not supported: ${file.name}`);
        }

        const extractedText = await this.extractText(file, fileType);
        const validation = this.security.validateAttachedFileContent(extractedText, file.name, fileType);
        if (!validation.isValid) {
          this.security.logSecurityEvent("FILE_CONTENT_BLOCKED", {
            fileName: file.name,
            fileType,
            violations: validation.violations,
            riskLevel: validation.riskLevel,
          });
          throw new Error(`File contains potentially unsafe content: ${validation.violations.join(", ")}`);
        }

        const content = validation.sanitizedContent ?? validation.sanitizedInput;
        const document: AttachedDocument = {
          id: Date.now() + Math.random(),
          name: file.name,
          type: fileType,
          size: file.size,
          content,
          preview: this.generatePreview(content),
          addedAt: new Date().toISOString(),
          securityValidated: true,
        };

        this.attachedDocuments.push(document);
        results.push({ success: true, document });
      } catch (error) {
        results.push({
          success: false,
          fileName: file.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  getAttachedDocuments() {
    return [...this.attachedDocuments];
  }

  getDocumentContext() {
    if (!this.attachedDocuments.length) return "";
    const contextParts = this.attachedDocuments.map((doc) => `--- Document: ${doc.name} ---\n${doc.content}\n--- End of ${doc.name} ---\n`);
    return `[Document Context - The following documents have been provided for reference]\n\n${contextParts.join("\n")}\n[End of Document Context]\n\n`;
  }

  getDocumentSummary() {
    if (!this.attachedDocuments.length) return "No documents attached";
    const totalSize = this.attachedDocuments.reduce((sum, doc) => sum + doc.size, 0);
    const types = Array.from(new Set(this.attachedDocuments.map((doc) => doc.type)));
    return `${this.attachedDocuments.length} document(s) | ${this.formatFileSize(totalSize)} | Types: ${types.join(", ")}`;
  }

  removeDocument(documentId: number | string) {
    const id = Number(documentId);
    this.attachedDocuments = this.attachedDocuments.filter((doc) => doc.id !== id);
    return this.attachedDocuments.length;
  }

  clearAllDocuments() {
    this.attachedDocuments = [];
  }

  exportContext() {
    return {
      version: "1.0",
      documents: this.attachedDocuments,
      exportedAt: new Date().toISOString(),
    };
  }

  importContext(contextData: unknown) {
    if (!contextData || typeof contextData !== "object" || !("documents" in contextData)) return false;
    const documents = (contextData as { documents?: unknown }).documents;
    if (!Array.isArray(documents)) return false;

    this.attachedDocuments = documents
      .filter((doc): doc is AttachedDocument => Boolean(doc && typeof doc === "object" && "content" in doc))
      .map((doc) => {
        const validation = this.security.validateAttachedFileContent(doc.content, doc.name || "imported-document", doc.type || "unknown");
        return {
          ...doc,
          content: validation.isValid ? validation.sanitizedContent ?? validation.sanitizedInput : "[Document content blocked for security]",
          securityValidated: validation.isValid,
          originallyBlocked: !validation.isValid,
        };
      });
    return true;
  }

  private getFileType(file: File) {
    if (this.supportedTypes[file.type]) return this.supportedTypes[file.type];
    const extension = file.name.toLowerCase().split(".").pop() || "";
    return this.extensionMap[extension] || null;
  }

  private async extractText(file: File, fileType: string) {
    switch (fileType) {
      case "pdf":
        return this.extractPdfText(file);
      case "docx":
        return this.extractDocxText(file);
      case "json":
        return this.extractJsonText(file);
      default:
        return this.extractPlainText(file);
    }
  }

  private async extractPdfText(file: File) {
    if (!window.pdfjsLib) throw new Error("PDF.js library not loaded. Cannot extract PDF text.");
    const buffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument(new Uint8Array(buffer)).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str).join(" "));
    }
    return pages.join("\n\n").trim();
  }

  private async extractDocxText(file: File) {
    if (!window.mammoth) throw new Error("Mammoth.js library not loaded. Cannot extract DOCX text.");
    const arrayBuffer = await file.arrayBuffer();
    const result = await window.mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  private async extractPlainText(file: File) {
    return file.text();
  }

  private async extractJsonText(file: File) {
    const text = await file.text();
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      throw new Error("Invalid JSON file.");
    }
  }

  private generatePreview(content: string, maxLength = 150) {
    if (!content) return "Empty file";
    const preview = content.trim().slice(0, maxLength);
    return preview.length < content.length ? `${preview}...` : preview;
  }

  private formatFileSize(bytes: number) {
    if (bytes === 0) return "0 Bytes";
    const units = ["Bytes", "KB", "MB", "GB"];
    const index = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Number((bytes / 1024 ** index).toFixed(2))} ${units[index]}`;
  }
}
