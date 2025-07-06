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

## Architecture Overview

VeilChat is a modern web-based chat interface with AI capabilities, built with vanilla JavaScript and Node.js. The application consists of two main parts:

### Frontend (Browser-based)
- **Single Page Application**: Main interface in `src/index.html`
- **Modular Service Architecture**: Core functionality split into specialized services
- **Mobile-First Design**: Responsive interface optimized for mobile devices
- **Real-time Communication**: WebSocket and HTTP-based communication with servers

### Backend (Node.js Servers)
- **MCP Server** (`src/server/mcp-server.js`): Model Context Protocol server for enhanced reasoning
- **HTTP Server** (`src/server/mcp-http-server.js`): HTTP wrapper for MCP functionality
- **Server Orchestration** (`src/server/start-servers.js`): Unified server startup

## Core Services

### LLMService (`src/js/llmService.js`)
- Multi-provider LLM integration (LiteLLM, OpenAI, LM Studio)
- Conversation history management and persistence
- Custom persona and character generation
- Context-aware responses with document integration

### VoiceService (`src/js/voiceService.js`)
- Speech-to-text (STT) using Web Speech API
- Text-to-speech (TTS) with customizable voices
- Continuous conversation support
- Mobile-optimized voice interaction

### ImageService (`src/js/imageService.js`)
- Multi-provider image generation (Automatic1111, OpenAI DALL-E)
- Configurable generation parameters
- Base64 image handling and display
- Fullscreen image viewer

### ContextService (`src/js/contextservice.js`)
- Multi-format document processing (PDF, DOCX, TXT, JSON, HTML, CSS, MD)
- Document attachment and context integration
- Text extraction and preprocessing
- Document management with preview

### MCPClient (`src/js/mcpClient.js`)
- Model Context Protocol integration
- Enhanced reasoning capabilities through MCP tools
- Sequential thinking and problem breakdown
- Connection management with MCP server

## Key Features

### Model Context Protocol (MCP) Integration
The application includes sophisticated MCP integration for enhanced reasoning:
- **Break Down Problem**: Complex problem decomposition
- **Sequential Reasoning**: Step-by-step logical analysis
- **Step-by-Step Analysis**: Systematic topic analysis
- **Logical Chain**: Premise-to-conclusion reasoning chains

### Multi-Provider Support
- **LLM Providers**: LiteLLM (default), OpenAI, LM Studio
- **Image Providers**: Automatic1111, OpenAI DALL-E
- **Voice Providers**: System TTS voices

### Document Context
- Supports PDF, DOCX, TXT, JSON, HTML, CSS, Markdown, XML, YAML, LOG files
- Maximum file size: 10MB
- Automatic text extraction and context integration
- Document preview and management

## Configuration

### Default Settings
- **LLM Provider**: LiteLLM with Gemini 2.5 Flash
- **Image Provider**: OpenAI DALL-E
- **MCP Server**: http://localhost:3001
- **Chat Interface**: http://localhost:8080

### Environment Variables
- `PORT`: HTTP server port (default: 3001)
- `NODE_ENV`: Environment mode (development/production)

## Development Guidelines

### File Organization
- **Core Logic**: `src/js/main.js` - Main application initialization and event handling
- **Services**: Individual service files for specific functionality
- **UI Components**: HTML templates in `src/pages/`
- **Styling**: All CSS in `src/css/style.css`
- **Server Code**: Node.js servers in `src/server/`

### Adding New Features
1. **LLM Provider**: Extend `llmService.js` with new provider configuration
2. **Image Provider**: Add new provider class to `imageService.js`
3. **MCP Tools**: Add tool handlers to `mcp-server.js` and HTTP routes to `mcp-http-server.js`
4. **Voice Features**: Extend `voiceService.js` for new voice capabilities

### Mobile Optimization
- All touch events handled with `addMobileCompatibleEvent()` helper
- Responsive design with CSS Grid and Flexbox
- Optimized for iOS Safari and mobile browsers
- Touch-friendly UI elements and gesture support

## Testing

The application runs directly in the browser with live-server. Test by:
1. Starting the application with `npm run start:both`
2. Opening http://localhost:8080 in a browser
3. Testing core features: chat, voice, image generation, document upload
4. Verifying MCP integration with sequential thinking keywords

## Debugging

Enable debug logging in browser console:
```javascript
localStorage.setItem('debugMode', 'true');
```

Common debug areas:
- MCP server connection and tool execution
- LLM API calls and responses
- Voice service initialization and usage
- Document processing and context integration