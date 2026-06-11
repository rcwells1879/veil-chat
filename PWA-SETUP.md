# VeilChat PWA Notes

VeilChat keeps a lightweight PWA setup:

- `public/manifest.json` defines app metadata and icons.
- `public/service-worker.js` caches the app shell, icons, and static assets under `/veilchat/`.
- `public/icons/` contains the install icons.
- The React app stores settings, local conversation history, and persona state in browser storage.

## Local Testing

```bash
npm run dev
```

Open the Vite URL, normally `http://127.0.0.1:5173/veilchat/`.

For production-style PWA testing:

```bash
npm run build
npm run preview
```

Then verify:

- The app loads at `/veilchat/`.
- Reloading keeps the latest conversation and persona.
- New Chat clears the local conversation.
- Install prompts/icons appear in Chromium-based browsers when served from a suitable origin.
- Cached static assets still load after a refresh.

Network-backed chat, search, and image APIs still require connectivity unless the selected local provider is available.
