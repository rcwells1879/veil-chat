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

### Key Technologies & Frameworks
- **Frontend**: Vanilla JavaScript (ES6+ modules)
- **Backend**: Express.js server with CORS support
- **PWA**: Full Progressive Web App implementation with service worker
- **MCP Integration**: Model Context Protocol for enhanced reasoning
- **Web Scraping**: Puppeteer + Cheerio with intelligent extraction
- **Security**: Input validation and sanitization layer
- **Offline Support**: LocalStorage-based persistence with queue sync

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

### Progressive Web App (PWA) Architecture

**IMPORTANT: VeilChat is a full-featured PWA with offline capabilities.**

#### Service Worker Implementation (`src/service-worker.js`)
- **Automatic cache versioning**: Uses `Date.now()` for cache names to force updates
- **Multi-tier caching**: Separate caches for static assets, API responses, and external CDN resources
- **Offline-first strategy**: Static assets served from cache, APIs fall back to network
- **Background sync**: Queued requests processed when connectivity returns

#### PWA Features
- **App Installation**: Custom install prompts with user-friendly experience
- **Offline Manager**: Full offline conversation history and settings persistence
- **Network Detection**: Real-time online/offline status with UI indicators
- **App Shortcuts**: Quick access to new chat and voice mode
- **Share Target**: Receive shared content from other apps

#### Troubleshooting PWA Issues
- Cache updates require version changes in service worker
- Install prompts only show on HTTPS or localhost
- Offline data stored in localStorage with Map-based structure
- Service worker updates may require hard refresh (Ctrl+Shift+R)

### Model Context Protocol (MCP) Integration

**IMPORTANT: MCP enables enhanced reasoning and tool usage through external servers.**

#### MCP Architecture (`src/js/mcpClient.js`, `src/server/mcp-server.js`)
- **Dual connection modes**: HTTP API for browsers, direct process spawning for Node.js
- **Sequential Thinking**: Advanced reasoning through step-by-step thought processes
- **Tool integration**: External tools and APIs accessible through MCP protocol
- **Server management**: Automatic server startup with `npm run start:both`

#### MCP Components
- **HTTP Server** (`src/server/mcp-http-server.js`): RESTful API bridge for browser clients
- **MCP Server** (`src/server/mcp-server.js`): Full MCP protocol implementation
- **Client Interface** (`src/js/mcpClient.js`): Browser-compatible MCP client

### Web Content Extraction System

**IMPORTANT: Intelligent web scraping with multi-method fallback strategies.**

#### Extractor Architecture (`src/server/extractors/`)
- **Base Extractor** (`base-extractor.js`): Core extraction logic and method selection
- **Puppeteer Extractor** (`puppeteer-extractor.js`): Dynamic content and JavaScript-heavy sites
- **Web Extractor** (`web-extractor.js`): Static content with Cheerio and Readability

#### Smart Content Detection
- **Domain-based routing**: Automatic selection of extraction method by domain
- **Fallback strategy**: Puppeteer → Cheerio → Basic fetch
- **Content optimization**: Mozilla Readability for article extraction
- **Performance**: Timeout controls and resource management

#### Supported Content Types
- **Dynamic sites**: Google Maps, Yelp, Reddit (new interface), Quora
- **Static content**: News articles, documentation, blogs
- **Social media**: Limited support with JavaScript execution
- **PDF/Documents**: Through appropriate extractor selection

### Security Architecture

**IMPORTANT: Multi-layer security with input validation and sanitization.**

#### Security Validator (`src/js/securityValidator.js`)
- **Prompt injection detection**: Comprehensive pattern matching for injection attempts
- **XSS prevention**: Script tag and JavaScript protocol filtering
- **Template injection**: Protection against template literal and expression attacks
- **Jailbreak detection**: Common AI jailbreak pattern recognition

#### Security Patterns Detected
- System instruction overrides and prompt manipulation
- SSML/XML injection attempts for TTS exploitation
- URL encoding and Unicode escape sequence abuse
- Developer mode and unrestricted access requests

#### Server Security (`src/server/security-manager.js`)
- **File access restrictions**: Blocked access to server files and node_modules
- **CORS configuration**: Managed through Cloudflare Zero Trust policies
- **Static file serving**: Limited to safe directories only

## Deployment Configuration

- CORS settings are handled in my Cloudflare tunnel dashboard 

## Best Practices

### Code Reusability and Function Management

**IMPORTANT: Always check existing services before creating new functions.**

#### Before Creating New Functions
1. **Survey existing services**: Check all files in `src/js/` for suitable existing methods
2. **Review service interfaces**: Look for compatible functions in these core services:
   - `llmService.js` - LLM API interactions and response processing
   - `voiceService.js` - Speech-to-text and text-to-speech functionality  
   - `imageService.js` - Image generation and processing
   - `contextservice.js` - Context management and conversation handling
   - `mcpClient.js` - Model Context Protocol integration
   - `securityValidator.js` - Input validation and sanitization
   - `azureTTSService.js` / `azureSTTService.js` - Azure speech services
   - `offlineManager.js` - Offline data persistence and sync
   - `ssmlProcessor.js` - Speech Synthesis Markup Language processing
   - `desktopInterface.js` - Desktop-specific UI and settings management

#### Function Reuse Guidelines
- **Extend existing services** rather than duplicating functionality
- **Use service methods** by importing or referencing existing instances
- **Maintain consistency** with established patterns and interfaces
- **Document dependencies** when calling methods from other services

#### Common Reusable Functions
- **API calls**: Use `llmService` methods for consistent request handling
- **Voice operations**: Use `voiceService` or Azure services for speech functionality
- **Security validation**: Always use `securityValidator` for input sanitization
- **Context management**: Use `contextservice` for conversation state
- **Offline operations**: Use `offlineManager` for data persistence

### External Tool Usage
- Always reference online documentation for external tools like Puppeteer or Cheerio before making changes to their services

### Development Workflow Considerations

#### Server Restart Requirements
After making changes to server-side components, restart is required:
- **MCP Server changes**: Restart with `npm run start:both` or `npm run dev:mcp`
- **HTTP Server changes**: Restart with `npm run start:http` or `npm run dev:http` 
- **Extractor changes**: Affects web content extraction functionality
- **Security changes**: Critical for input validation updates

#### Client Refresh Requirements  
For client-side changes, hard refresh may be needed:
- **Service Worker updates**: Require `Ctrl+Shift+R` (hard refresh)
- **PWA manifest changes**: May need app reinstallation
- **New static assets**: Service worker cache versioning handles automatically
- **Settings changes**: localStorage updates applied immediately

#### Key Dependencies
- **@modelcontextprotocol/sdk**: Core MCP integration (v0.4.0)
- **puppeteer-extra**: Enhanced web scraping with stealth plugin  
- **@mozilla/readability**: Content extraction from web articles
- **cheerio**: Server-side HTML manipulation and parsing
- **express**: HTTP server framework with CORS support