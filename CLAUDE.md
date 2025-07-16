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

VeilChat is a modern web-based chat interface with AI capabilities, built with vanilla JavaScript and Node.js. The application uses a **HTTP REST API architecture** for browser compatibility and mobile/PWA support.

### Frontend (Browser-based)
- **Single Page Application**: Main interface in `src/index.html`
- **Modular Service Architecture**: Core functionality split into specialized services
- **Mobile-First Design**: Responsive interface optimized for mobile devices
- **HTTP REST Communication**: Standard HTTP POST/GET requests using JavaScript Fetch API

### Backend (Node.js Servers)
- **Tool Server** (`src/server/mcp-server.js`): Contains reasoning tools and web extraction capabilities
- **HTTP REST API Server** (`src/server/mcp-http-server.js`): Express.js server providing REST endpoints
- **Server Orchestration** (`src/server/start-servers.js`): Unified server startup

### Communication Protocol
- **Client → Server**: HTTP REST API calls using JavaScript Fetch API
- **Server → Client**: JSON responses with standard HTTP status codes
- **Not MCP Protocol**: This is a custom REST API, not the official Model Context Protocol

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
- **TTS Interruption**: User input automatically stops TTS to prevent blocking
- **Selective TTS**: Search results and system messages can disable TTS to avoid delays

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

### APIClient (`src/js/mcpClient.js`)
- HTTP REST API client for server communication
- Enhanced reasoning capabilities through server tools
- Sequential thinking and problem breakdown
- Connection management with HTTP REST API server

## Key Features

### Server Tool Integration
The application includes sophisticated server tools for enhanced reasoning:
- **Break Down Problem**: Complex problem decomposition
- **Sequential Reasoning**: Step-by-step logical analysis
- **Step-by-Step Analysis**: Systematic topic analysis
- **Logical Chain**: Premise-to-conclusion reasoning chains

#### Web Search Integration
The server includes web search capabilities with multi-provider support:
- **Search Providers**: Brave Search, DuckDuckGo, Google Custom Search, Bing
- **Configurable API Keys**: User-provided API keys for different search services
- **Search Result Processing**: Automatic summarization and relevance filtering
- **Context Integration**: Search results automatically integrated into conversation context

**Search Settings Configuration**:
- **Search Provider**: Primary search service (Brave Search recommended)
- **API Key**: Provider-specific API key for search requests
- **Results Limit**: Maximum number of search results to retrieve (default: 10)
- **Auto-Summarize**: Enable automatic summarization of search results
- **Result Filtering**: Filter results by recency, relevance, or content type

**Search Tool Usage**:
- **web_search**: General web search with query and optional filters
- **search_recent**: Search for recent information (last 24 hours, week, month)
- **search_summarize**: Search and automatically summarize results for LLM context

#### Persona-Driven Search Design Philosophy

**Core Principle**: Search results should feel like natural conversation, not technical data dumps.

**Key Design Requirements**:
1. **Persona Integration**: All search responses must be delivered in the current persona's voice and character
2. **Natural Conversation Flow**: Eliminate technical preambles like "According to my search" or "Based on the search results"
3. **Contextual Awareness**: Search responses should consider the ongoing conversation context
4. **Content Over Metadata**: Focus on actual information content, not search result descriptions or website metadata

**Implementation Standards**:
- **Brave Search**: Uses Brave's AI Summarizer API for enhanced content synthesis, then processes through persona lens
- **Content Extraction**: When needed, extract actual webpage content rather than relying on search result snippets
- **LLM Processing**: All search content passes through persona-aware LLM processing for natural delivery
- **Fallback Handling**: Graceful degradation when advanced features (like summarizers) are unavailable

**Response Format Guidelines**:
- ✅ **Natural**: "Here's what's happening today: [actual headlines]"
- ❌ **Technical**: "Search Summary: Analyzed 5 results. Summary: The search results show..."
- ✅ **Contextual**: Responses that build on previous conversation
- ❌ **Generic**: One-size-fits-all technical summaries

**Future Web Tools**: Any new web search or content extraction tools should follow this persona-driven, conversational approach rather than returning raw technical data.

**Implementation Notes**:
- Search results are processed through the server's LLM integration
- Results are automatically formatted for optimal LLM consumption
- Search history is maintained for context continuity
- Rate limiting and API quota management handled automatically

#### Web Content Extraction
The server includes sophisticated web content extraction capabilities that intelligently choose the best extraction method based on the target website:

**Extraction Methods**:
- **Cheerio**: Fast static HTML parsing for news sites, blogs, documentation (preferred for speed)
- **Puppeteer**: Dynamic content extraction for JavaScript-heavy sites requiring interaction
- **Intelligent Detection**: Automatically selects the appropriate method based on domain patterns

**Platform-Specific Extractors**:
- **Google Maps**: Business information, reviews, ratings, contact details, address
- **Yelp**: Restaurant/business reviews, ratings, contact information, recent customer feedback
- **TripAdvisor**: Travel reviews, ratings, location information, visitor experiences
- **Reddit**: Post content, top comments, discussion threads (both old.reddit.com and new Reddit)
- **News Sites**: Article content using Mozilla Readability for clean text extraction

**Extraction Tools**:
- **extract_web_content**: Full content extraction with metadata, images, and complete article text
- **extract_for_summary**: Optimized extraction for LLM summarization (4000 character limit for faster processing)
- **extract_multiple_urls**: Batch extraction for comparing multiple sources or gathering comprehensive information

**Content Processing Features**:
- **Smart Content Detection**: Identifies main content vs navigation, ads, and boilerplate
- **Intelligent Truncation**: Preserves first and last paragraphs with middle content when limiting length
- **Anti-Bot Detection**: Uses puppeteer-stealth plugin to avoid anti-scraping measures
- **Performance Caching**: 10-minute cache for repeated requests to improve response times
- **Graceful Error Handling**: Fallback strategies and detailed error reporting for failed extractions

**Typical Use Cases**:
- **Follow-up Research**: "Tell me more about that CNN article" after a search result
- **Business Intelligence**: Extract reviews and ratings from business listings for recommendations
- **News Comparison**: Compare articles from multiple news sources for comprehensive coverage
- **Dynamic Content Access**: Get content from JavaScript-heavy sites that search APIs can't reach
- **Social Context**: Access full Reddit discussions or social media conversations

**Performance Considerations**:
- **Method Selection**: Cheerio (fast) used by default; Puppeteer (slower but comprehensive) for dynamic sites
- **Resource Management**: Puppeteer browser instances auto-close after 5 minutes of inactivity
- **Concurrent Limiting**: Batch extractions limited to 3 concurrent requests to avoid overwhelming servers
- **Content Optimization**: Automatic content length management based on intended use (summary vs analysis)

### Multi-Provider Support
- **LLM Providers**: LiteLLM (default), OpenAI, LM Studio
- **Image Providers**: Automatic1111, OpenAI DALL-E
- **Voice Providers**: System TTS voices
- **Search Providers**: Brave Search, DuckDuckGo, Google Custom Search, Bing

### Document Context
- Supports PDF, DOCX, TXT, JSON, HTML, CSS, Markdown, XML, YAML, LOG files
- Maximum file size: 10MB
- Automatic text extraction and context integration
- Document preview and management

## Configuration

### Default Settings
- **LLM Provider**: LiteLLM with Gemini 2.5 Flash
- **Image Provider**: OpenAI DALL-E
- **HTTP REST API Server**: http://localhost:3001
- **Chat Interface**: http://localhost:8080

### Environment Variables
- `PORT`: HTTP server port (default: 3001)
- `NODE_ENV`: Environment mode (development/production)

## Development Guidelines

### Architecture Type
**This is a HTTP REST API application, NOT a Model Context Protocol (MCP) implementation.**

### Documentation Sources to Reference

#### For Server-Side Development (`mcp-http-server.js`, `mcp-server.js`)
- **Express.js Official Documentation**: https://expressjs.com/en/guide/routing.html
- **Express.js Middleware**: https://expressjs.com/en/guide/using-middleware.html
- **HTTP REST API Best Practices**: https://www.freecodecamp.org/news/rest-api-design-best-practices-build-a-rest-api/
- **Node.js Best Practices**: https://github.com/goldbergyoni/nodebestpractices

#### For Client-Side Development (`mcpClient.js`, frontend services)
- **JavaScript Fetch API**: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
- **HTTP Methods and Status Codes**: https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods
- **JSON Handling**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON

#### Do NOT Reference
- ❌ Model Context Protocol (MCP) documentation
- ❌ JSON-RPC 2.0 specifications
- ❌ WebSocket documentation
- ❌ Standard MCP SDK examples
- ❌ MCP initialization handshake patterns

### File Organization
- **Core Logic**: `src/js/main.js` - Main application initialization and event handling
- **Services**: Individual service files for specific functionality
- **UI Components**: HTML templates in `src/pages/`
- **Styling**: All CSS in `src/css/style.css`
- **Server Code**: Node.js servers in `src/server/`

### Adding New Features
1. **LLM Provider**: Extend `llmService.js` with new provider configuration
2. **Image Provider**: Add new provider class to `imageService.js`
3. **Server Tools**: Add tool handlers to `mcp-server.js` and HTTP routes to `mcp-http-server.js`
4. **Voice Features**: Extend `voiceService.js` for new voice capabilities
5. **Search Provider**: Add new search provider to server search handlers

#### Adding Search Providers
To add a new search provider to the server:

1. **Create Provider Class**: Add new provider class in `mcp-server.js`
   ```javascript
   class NewSearchProvider {
     constructor(apiKey, options = {}) {
       this.apiKey = apiKey;
       this.baseUrl = 'https://api.newsearchprovider.com';
       this.options = options;
     }
   
     async search(query, options = {}) {
       // Implementation specific to the provider
     }
   }
   ```

2. **Add to Search Handler**: Register in `handleWebSearch` method
   ```javascript
   case 'newsearch':
     provider = new NewSearchProvider(apiKey, searchSettings);
     break;
   ```

3. **Update UI Settings**: Add provider option to search settings dropdown
   ```html
   <option value="newsearch">New Search Provider</option>
   ```

4. **Configuration**: Add provider-specific settings to search settings section

**Search Provider Requirements**:
- Must implement `search(query, options)` method returning standardized results
- Should handle API key validation and error responses
- Must support basic filtering (time, type, relevance)
- Should include rate limiting and quota management

### Implementation Patterns

#### Server-Side HTTP REST API Pattern (Express.js)
```javascript
// Correct pattern for mcp-http-server.js
app.post('/api/mcp/call', async (req, res) => {
  try {
    const { tool, arguments: args } = req.body;
    const result = await this.mcpServer.handleTool(tool, args);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

#### Client-Side HTTP REST API Pattern (Fetch API)
```javascript
// Correct pattern for mcpClient.js
const response = await fetch('/api/mcp/call', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tool: 'web_search', arguments: args })
});
const result = await response.json();
```

#### Error Handling Pattern
```javascript
// Client-side error handling
try {
  const response = await fetch('/api/mcp/call', {...});
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const result = await response.json();
} catch (error) {
  console.error('API call failed:', error);
}
```

### Mobile Optimization
- All touch events handled with `addMobileCompatibleEvent()` helper
- Responsive design with CSS Grid and Flexbox
- Optimized for iOS Safari and mobile browsers
- Touch-friendly UI elements and gesture support

### Text-to-Speech (TTS) Guidelines
- **Avoid TTS for long content**: Search results, system messages, and lengthy responses should disable TTS using `addMessage(text, sender, false)`
- **Conversation history blocking**: TTS operations can block conversation history updates - always complete history updates before starting TTS
- **User interruption**: TTS automatically stops when user starts typing to prevent interface blocking
- **Implementation**: Use `voiceService.stopSpeaking()` to cancel active TTS, and `enableTTS` parameter in `addMessage()` for selective TTS

## Starting the Servers

### Best Practices
- The best way to start the servers is `npm run start:both` in the project root directory
- Use `Ctrl+C` to stop the servers

## Testing

The application runs directly in the browser with live-server. Test by:
1. Starting the application with `npm run start:both`
2. Opening http://localhost:8080 in a browser
3. Testing core features: chat, voice, image generation, document upload
4. Verifying server tool integration with sequential thinking keywords

## Debugging

Enable debug logging in browser console:
```javascript
localStorage.setItem('debugMode', 'true');
```

Common debug areas:
- HTTP REST API server connection and tool execution
- LLM API calls and responses
- Voice service initialization and usage
- Document processing and context integration

## IMPORTANT: Instructions for AI Coding Assistants

### Architecture Recognition
**This is a HTTP REST API application built with Express.js and consumed via JavaScript Fetch API.**

### What NOT to implement:
- ❌ JSON-RPC 2.0 message formats
- ❌ MCP initialization handshake (`initialize`/`initialized`)
- ❌ MCP notification systems
- ❌ WebSocket connections
- ❌ MCP transport protocols
- ❌ MCP-specific error handling patterns

### What TO implement:
- ✅ Standard HTTP REST API patterns
- ✅ Express.js middleware and routing
- ✅ JavaScript Fetch API requests
- ✅ Standard HTTP status codes (200, 404, 500, etc.)
- ✅ JSON request/response bodies
- ✅ Browser-compatible JavaScript

### Reference Documentation:
- **Server-side**: Express.js documentation and HTTP REST API best practices
- **Client-side**: MDN Fetch API and JavaScript documentation
- **NOT**: Model Context Protocol or JSON-RPC specifications

### Key Principle:
Focus on standard web technologies for maximum compatibility with browsers, PWAs, and mobile applications.
```