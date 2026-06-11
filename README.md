# VeilChat

VeilChat is a client-side Vite/React chat studio for custom personas, local chat history, browser voice, document attachments, direct LLM APIs, direct search APIs, and image generation.

## Features

- Direct chat providers: OpenAI-compatible local endpoints, LMStudio, Ollama, OpenAI, Anthropic, Google AI Studio, and Kie.AI.
- Image providers: OpenAI image generation, Kie.AI image models, Automatic1111, and SwarmUI.
- Image testing: VeilChat After Dark toggles Kie model `nsfw_checker` payloads from `true` to `false` for models that accept that field.
- Persona generation: custom or random personas with generated profile, greeting, and optional appearance image.
- Local memory: latest conversation and persona persist in `localStorage` until New Chat; conversations can still be exported/imported as JSON.
- Attachments: browser-side text, JSON, Markdown, HTML, CSS, PDF, DOCX, YAML, XML, and code-file text extraction.
- Search: direct Brave Search API and Google Custom Search JSON API integration.
- Voice: browser-native speech synthesis and speech recognition only.

## Development

```bash
npm install
npm run dev
```

The app runs at the Vite URL shown in the terminal, normally `http://127.0.0.1:5173/veilchat/`.

```bash
npm run type-check
npm run build
npm run preview
```

## Architecture

- `src/App.tsx` renders the shell, chat, persona, settings, and history views.
- `src/lib/useVeilChat.ts` owns app state and coordinates services.
- `src/lib/services/` contains typed frontend-only services for LLM calls, image generation, search, browser voice, document context, and validation.
- `src/lib/settings.ts` reads, migrates, and persists settings. Secret values are stored in `sessionStorage` where possible.

There is no bundled backend server, MCP bridge, Cloudflare tunnel, Azure speech implementation, or proxy service. API calls are made directly from the browser or to user-configured local services.

## Search Setup

Brave search uses `https://api.search.brave.com/res/v1/web/search` with `X-Subscription-Token`.

Google search uses `https://www.googleapis.com/customsearch/v1` and requires a Google API key plus Programmable Search Engine ID.

Direct browser API keys are acceptable for this personal/local app, but do not publish keys in public deployments.

## Image Notes

Standalone Imagen proxy support was removed. To use Imagen-style models, select Kie.AI as the image provider and choose one of the Google/Imagen Kie image models.
