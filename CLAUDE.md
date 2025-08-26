# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Starting the Application
```bash
# Start both chat interface and MCP server (recommended)
npm run start:both

# Start only the chat interface
npm start

# Start only the MCP HTTP server
npm run start:http

# Start only the MCP server
npm run start:mcp
```

### Development Mode
```bash
# Development mode with auto-reload for chat interface
npm run dev

# Development mode for HTTP server with auto-reload
npm run dev:http

# Development mode for MCP server with auto-reload
npm run dev:mcp
```

### Build
```bash
npm run build
```

## WSL and Windows Compatibility

### Command Execution Guidelines
- When working across Windows and WSL environments, use PowerShell for Windows-specific commands
- Ensure PowerShell commands are formatted correctly for the Windows environment
- Do not run bash commands directly in PowerShell; use the appropriate shell for each command

## Architecture Overview

VeilChat is a modern web-based chat interface with AI capabilities, built with vanilla JavaScript and Node.js. The application uses a **HTTP REST API architecture** for browser compatibility and mobile/PWA support.

### Settings Synchronization Architecture

**IMPORTANT: VeilChat uses a simple localStorage-based settings synchronization system.**

#### Design Principle
- **Single Source of Truth**: localStorage is the authoritative source for all settings
- **No Complex Syncing**: Each interface (mobile/desktop) independently loads from and saves to localStorage
- **Automatic Updates**: Settings are reloaded each time an interface is opened
- **Immediate Persistence**: All changes save to localStorage instantly on input/change events

#### Implementation
```javascript
// Mobile settings: src/js/main.js setupMobileSettingsHandlers()
// Desktop settings: src/js/desktopInterface.js setupDesktopSettingsHandlers()

// Pattern for each interface:
1. Load from localStorage on panel open
2. Save to localStorage on every input/change event
3. Update global SETTINGS object for service reconfiguration
```

#### Key Files
- **Mobile Settings**: `src/js/main.js` - `setupMobileSettingsHandlers()`
- **Desktop Settings**: `src/js/desktopInterface.js` - `setupDesktopSettingsHandlers()` 
- **Settings UI**: `src/pages/user-settings.html` (mobile), `src/index.html` (desktop)
- **ID Mappings**: `settingsIdMap` (mobile), `desktopSettingsIdMap` (desktop)

#### Benefits
- **Reliable**: No complex bidirectional sync to break
- **Fast**: Direct localStorage access with no intermediary logic
- **Maintainable**: Simple load/save pattern is easy to debug
- **Scalable**: Adding new settings requires minimal code changes

### Text-to-Speech (TTS) Architecture

**IMPORTANT: TTS is entirely client-side - no server-side audio processing exists.**

#### Azure TTS Implementation (`src/js/azureTTSService.js`)
- **Direct API calls**: Makes HTTPS requests directly to `https://{region}.tts.speech.microsoft.com/`
- **Audio element tracking**: Uses `this.activeAudioElements` Set to track created Audio elements
- **Memory management**: Audio elements are NOT added to DOM, only tracked in memory
- **Stopping mechanism**: Uses tracked elements, not `document.querySelectorAll('audio')`

#### Voice Service (`src/js/voiceService.js`)
- **Fallback strategy**: Azure TTS → Web Speech API → Silent failure
- **Settings sync**: Keeps voice rate/pitch synchronized between Azure and Web Speech
- **Gender detection**: Auto-selects voices based on persona gender markers

#### Troubleshooting TTS Issues
- Audio elements created by `new Audio()` are NOT in the DOM
- Use `azureTTS.activeAudioElements` to debug active audio
- PWA mode requires special handling for autoplay restrictions
- Check Azure API key/region configuration in user settings

#### Common TTS Problems
1. **"Can't find audio elements"**: Audio elements aren't in DOM, check `activeAudioElements` Set
2. **TTS not stopping**: Ensure `stopSpeaking()` uses tracked elements, not DOM queries
3. **Mobile autoplay**: Requires user interaction before first TTS playback
4. **Voice not found**: Check Azure voice mapping in `mapVoiceKeywordToAzure()`

## Deployment Configuration

- CORS settings are handled in my Cloudflare tunnel dashboard 

## Best Practices

### External Tool Usage
- Always reference online documentation for external tools like Puppeteer or Cheerio before making changes to their services