# VeilChat Developer Notes

## Commands

```bash
npm install
npm run dev
npm run type-check
npm run build
npm run preview
```

VeilChat is a client-only Vite/React app. Do not add or revive backend service scripts, MCP bridges, Azure speech scripts, local proxy servers, or Cloudflare tunnel management.

## Current Architecture

- `src/App.tsx`: React UI for chat, persona, settings, and history.
- `src/lib/useVeilChat.ts`: state orchestration and user workflows.
- `src/lib/settings.ts`: settings migration, persistence, and typed configuration.
- `src/lib/services/llm.ts`: chat, image-prompt generation, persona profile generation, and local conversation persistence.
- `src/lib/services/image.ts`: OpenAI, Kie.AI, A1111, and SwarmUI image generation.
- `src/lib/services/search.ts`: direct Brave and Google Custom Search adapters.
- `src/lib/services/documentContext.ts`: browser-side attachment extraction.
- `src/lib/services/browserVoice.ts`: browser Web Speech synthesis and recognition.
- `src/lib/services/security.ts`: lightweight client-side validation and audit logging.

## Product Rules

- Local history persists indefinitely in `localStorage` until New Chat or explicit import/clear behavior.
- API keys should remain in `sessionStorage` where possible.
- Browser voice is Web Speech only. Azure TTS/STT has intentionally been removed.
- Search is direct Brave or Google only. There is no MCP research workflow.
- Standalone Imagen proxy support has been removed. Imagen-style images should use Kie.AI image models.
- VeilChat After Dark is a manual image setting for testing. When enabled, Kie image models that accept `nsfw_checker` should receive `nsfw_checker: false`; otherwise they should receive `true`.
- The app may call direct browser APIs and user-configured local APIs; do not require a bundled backend server.

## Verification

Before handing off substantial changes, run:

```bash
npm run type-check
npm run build
```

For UI changes, also run `npm run dev` and smoke test `/veilchat/`.
