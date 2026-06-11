import type { AppSettings } from "../settings";
import type { SearchResult } from "./types";

interface BraveResult {
  title?: string;
  url?: string;
  description?: string;
}

interface GoogleResult {
  title?: string;
  link?: string;
  snippet?: string;
}

export class SearchService {
  constructor(private settings: AppSettings) {}

  updateSettings(settings: AppSettings) {
    this.settings = settings;
  }

  async search(query: string): Promise<SearchResult[]> {
    if (!this.settings.searchEnabled) return [];
    if (this.settings.searchProvider === "google") return this.searchGoogle(query);
    return this.searchBrave(query);
  }

  formatResultsForContext(query: string, results: SearchResult[]) {
    if (!results.length) return "";
    const formatted = results
      .map((result, index) => `${index + 1}. ${result.title}\nURL: ${result.url}\nSnippet: ${result.snippet}`)
      .join("\n\n");
    return `[Web Search Results for "${query}"]\n${formatted}\n\nUse these search results when answering. Include relevant links from the result URLs.\n[End Web Search Results]\n\n`;
  }

  private async searchBrave(query: string): Promise<SearchResult[]> {
    if (!this.settings.braveSearchApiKey.trim()) {
      throw new Error("Add a Brave Search API key in Settings to use web search.");
    }

    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", this.limit().toString());

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": this.settings.braveSearchApiKey,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Brave search failed with status ${response.status}: ${text}`);
    }

    const data = await response.json() as { web?: { results?: BraveResult[] } };
    return (data.web?.results ?? []).slice(0, this.limit()).map((item) => ({
      title: item.title ?? "Untitled result",
      url: item.url ?? "",
      snippet: item.description ?? "",
      source: "brave" as const,
    })).filter((result) => result.url);
  }

  private async searchGoogle(query: string): Promise<SearchResult[]> {
    if (!this.settings.googleSearchApiKey.trim()) {
      throw new Error("Add a Google Custom Search API key in Settings to use Google search.");
    }
    if (!this.settings.googleSearchEngineId.trim()) {
      throw new Error("Add a Google Search Engine ID in Settings to use Google search.");
    }

    const url = new URL("https://www.googleapis.com/customsearch/v1");
    url.searchParams.set("key", this.settings.googleSearchApiKey);
    url.searchParams.set("cx", this.settings.googleSearchEngineId);
    url.searchParams.set("q", query);
    url.searchParams.set("num", Math.min(this.limit(), 10).toString());

    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Google search failed with status ${response.status}: ${text}`);
    }

    const data = await response.json() as { items?: GoogleResult[] };
    return (data.items ?? []).slice(0, this.limit()).map((item) => ({
      title: item.title ?? "Untitled result",
      url: item.link ?? "",
      snippet: item.snippet ?? "",
      source: "google" as const,
    })).filter((result) => result.url);
  }

  private limit() {
    const value = Number(this.settings.searchResultsLimit);
    if (!Number.isFinite(value)) return 10;
    return Math.min(10, Math.max(1, Math.round(value)));
  }
}
