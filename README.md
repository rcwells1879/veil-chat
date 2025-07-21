# VeilChat

A sophisticated AI research and interaction platform featuring intelligent web search, content extraction, voice interaction, image generation, and advanced agent workflows powered by a custom HTTP REST API architecture.

![VeilChat Interface](https://img.shields.io/badge/VeilChat-AI%20Research%20Platform-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node.js](https://img.shields.io/badge/Node.js-18.0.0+-brightgreen)
![Architecture](https://img.shields.io/badge/Architecture-HTTP%20REST%20API-orange)

## 🌟 Core Features

### 🤖 AI Chat & Personas
- **Multi-Provider LLM Support**: LiteLLM (Gemini 2.5 Flash), OpenAI, LM Studio
- **Persona-Driven Conversations**: AI adopts custom personalities with consistent voice
- **Gender-Aware Voice Selection**: Automatic voice matching based on character profiles
- **Context-Aware Responses**: Intelligent conversation flow with persistent memory

### 🔍 Intelligent Research & Agent Workflows
- **Advanced Agent System**: Multi-phase research workflows with memory management
- **Web Content Extraction**: Intelligent extraction from 500+ platforms with anti-bot measures
- **Multi-Provider Search**: Brave Search (AI Summarizer), DuckDuckGo, Google, Bing
- **Persona-Driven Results**: All research delivered in natural, conversational style
- **Smart Fallback**: Graceful degradation when advanced features unavailable

### 🌐 Web Search Integration
- **Brave Search**: Primary provider with AI summarization API
- **DuckDuckGo**: Free instant answers and general search
- **Google Custom Search**: High-quality results with API key
- **Bing**: Microsoft Cognitive Services integration
- **Automatic Provider Selection**: Based on query type and availability

### 🎤 Professional Voice Services
- **Azure TTS Integration**: Professional-grade text-to-speech with 40+ voices
- **Web Speech API Fallback**: System voices for offline compatibility
- **Selective TTS**: Smart enablement for conversational content only
- **Voice Interruption**: User input automatically stops TTS playback
- **Continuous Conversation**: Hands-free voice interaction with auto-send

### 🎨 Image Generation
- **Multi-Provider Support**: Automatic1111 (Stable Diffusion), OpenAI GPT-Image-1
- **Persona Integration**: Character appearance generated from personality
- **Customizable Parameters**: Size, quality, steps, CFG scale, samplers
- **Fullscreen Viewer**: Click any image to view in immersive mode

### 📄 Document Context & Analysis
- **Universal Format Support**: PDF, DOCX, TXT, JSON, HTML, CSS, MD, XML, YAML, LOG
- **Intelligent Text Extraction**: PDF.js, Mammoth.js, and custom parsers
- **Context Integration**: Documents seamlessly referenced in conversations
- **File Management**: Drag-and-drop attachment with preview and removal

### 📱 Mobile-Optimized Design
- **Responsive Interface**: Touch-friendly controls, gesture support
- **iOS Safari Compatibility**: Full support for mobile Safari and PWA
- **Keyboard Optimization**: Smart keyboard handling, viewport management
- **Performance Optimized**: Efficient rendering, smart caching, resource management

## 🚀 Quick Start

### Prerequisites
- Node.js 18.0.0 or higher
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Optional: API keys for enhanced features

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/veil-chat.git
   cd veilchat
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the application:**
   ```bash
   # Start both chat interface and HTTP server (recommended)
   npm run start:both
   ```

4. **Open your browser:**
   - **Chat Interface**: `http://localhost:8080`
   - **HTTP API Server**: `http://localhost:3001`

### Development Mode

```bash
# Development with auto-reload
npm run dev              # Chat interface only
npm run dev:http         # HTTP server only

# Production deployment
npm run build           # Build optimized version
```

## 🏗️ Architecture

### HTTP REST API Design

**Important**: Despite historical naming, VeilChat uses a **custom HTTP REST API architecture**, not the official Model Context Protocol (MCP). This provides:

- **Browser Compatibility**: Standard HTTP requests work in all browsers
- **Mobile/PWA Support**: Native fetch API integration
- **Standard HTTP Methods**: POST/GET with proper status codes
- **JSON Request/Response**: Simple, universally supported format

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    VeilChat Platform                        │
├─────────────────────────────────────────────────────────────┤
│  Frontend (Browser)                                         │
│  ├── Single Page App (index.html)                           │
│  ├── Modular Services (LLM, Voice, Image, Context)          │
│  ├── Mobile-First Design                                    │
│  └── HTTP REST Communication                                │
├─────────────────────────────────────────────────────────────┤
│  Backend (Node.js)                                          │
│  ├── Tool Server (mcp-server.js)                            │
│  │   ├── Agent Workflows                                    │
│  │   ├── Memory Management                                  │
│  │   └── Web Search/Extraction                              │
│  ├── HTTP REST API (mcp-http-server.js)                     │
│  │   ├── Express.js Routes                                  │
│  │   ├── CORS Handling                                      │
│  │   └── JSON Request/Response                              │
│  └── Server Orchestration (start-servers.js)                │
└─────────────────────────────────────────────────────────────┘
```

### Project Structure

```
veilchat/
├── src/
│   ├── index.html             # Main application interface
│   ├── css/
│   │   └── style.css          # Responsive styling
│   ├── js/
│   │   ├── main.js            # Core application logic
│   │   ├── llmService.js      # Multi-provider LLM integration
│   │   ├── voiceService.js    # Speech recognition & synthesis
│   │   ├── azureTTSService.js # Azure TTS integration
│   │   ├── imageService.js    # Image generation services
│   │   ├── contextservice.js  # Document processing
│   │   └── mcpClient.js       # HTTP REST API client
│   ├── pages/
│   │   ├── user-settings.html # Settings configuration
│   │   └── persona.html       # Persona creation interface
│   └── server/
│       ├── mcp-server.js      # Agent workflows & tools
│       ├── mcp-http-server.js # Express.js HTTP server
│       ├── start-servers.js   # Server startup orchestration
│       └── extractors/        # Web content extraction
│           ├── web-extractor.js      # Extraction orchestrator
│           ├── base-extractor.js     # Cheerio-based extraction
│           └── puppeteer-extractor.js # Dynamic content extraction
├── package.json               # Dependencies & scripts
├── CLAUDE.md                  # Architecture documentation
└── README.md                  # This file
```

## 🤖 Agent Workflow System

### Overview

VeilChat's agent workflow system provides sophisticated research capabilities through a multi-phase process:

1. **Task Initialization**: Goal analysis and plan creation
2. **Web Search**: Multi-provider search with intelligent results
3. **Content Extraction**: Deep content analysis from discovered URLs
4. **Memory Management**: Persistent storage across workflow phases
5. **Final Synthesis**: Comprehensive response generation

### Agent Workflow Triggers

Use these keywords to activate the agent workflow:

```javascript
// Research-focused keywords
"research renewable energy"
"investigate climate change"
"find out about quantum computing"
"look into blockchain technology"
"gather information about AI ethics"
"what can you tell me about space exploration"
"learn about machine learning"
"search for information about cryptocurrency"
```

### Agent Memory System

Each agent task maintains isolated memory with:

- **Goal Tracking**: Original research objective
- **Search Query**: Optimized search terms
- **URLs Discovered**: Relevant sources found
- **Extracted Content**: Full text content from sources
- **Final Synthesis**: Comprehensive research summary

### Research Workflow Example

```
User: "research renewable energy trends"
│
├── 1. Task Analysis
│   ├── Goal: Research renewable energy trends
│   ├── Plan: Search → Extract → Analyze → Synthesize
│   └── Memory: Task created with unique ID
│
├── 2. Web Search
│   ├── Provider: Brave Search (AI Summarizer)
│   ├── Query: "renewable energy trends 2024"
│   └── Results: Top 10 relevant articles
│
├── 3. Content Extraction
│   ├── Method: Intelligent (Cheerio/Puppeteer)
│   ├── Sources: News sites, research papers, industry reports
│   └── Content: Full article text, structured data
│
├── 4. Memory Storage
│   ├── URLs: All discovered sources
│   ├── Content: Extracted text content
│   └── Metadata: Extraction timestamps, methods
│
└── 5. Final Synthesis
    ├── Analysis: Content analysis and summarization
    ├── Persona: Delivered in character voice
    └── Result: Comprehensive research summary
```

## 🌐 Web Search & Content Extraction

### Multi-Provider Search

#### Brave Search (Primary)
- **AI Summarizer**: Enhanced content synthesis
- **Real-time Results**: Fresh, relevant content
- **Privacy-Focused**: No user tracking
- **API Key Required**: For full functionality

#### DuckDuckGo
- **Free Tier**: No API key required
- **Instant Answers**: Quick fact retrieval
- **Privacy Protection**: Anonymous searching
- **Rate Limited**: Basic functionality

#### Google Custom Search (not tested)
- **High Quality**: Comprehensive results
- **API Integration**: Requires API key + Search Engine ID
- **Advanced Filtering**: Time, type, language filters
- **Commercial Use**: Suitable for production

#### Bing (not tested)
- **Microsoft Integration**: Cognitive Services
- **Comprehensive Results**: Web, news, images
- **API Key Required**: Microsoft Cognitive Services
- **Enterprise Ready**: Production-quality service

### Intelligent Content Extraction

#### Extraction Methods

1. **Cheerio (Fast)**: Static HTML parsing
   - **Best For**: News sites, blogs, documentation
   - **Performance**: Sub-second extraction
   - **Compatibility**: Most standard websites

2. **Puppeteer (Comprehensive)**: Dynamic content rendering
   - **Best For**: JavaScript-heavy sites, SPAs
   - **Features**: Anti-bot detection, stealth mode
   - **Performance**: 3-10 seconds per page

#### Platform-Specific Extractors

- **Google Maps**: Business info, reviews, ratings, contact details
- **Yelp**: Restaurant reviews, ratings, business information
- **TripAdvisor**: Travel reviews, ratings, location data
- **Reddit**: Post content, comments, discussion threads
- **News Sites**: Article text using Mozilla Readability
- **General Web**: Smart content detection and extraction

#### Performance Optimizations

- **Intelligent Method Selection**: Automatic Cheerio/Puppeteer choice
- **10-minute Caching**: Prevents duplicate extractions
- **Concurrent Limiting**: Maximum 3 simultaneous extractions
- **Resource Blocking**: Images, ads, trackers blocked in Puppeteer
- **Timeout Management**: 30-second maximum per extraction

## 🎤 Voice & TTS Integration

### Azure TTS Integration

Professional-grade text-to-speech with:

```javascript
// Available Azure Voices
US Female: Ava, Jenny, Emma, Sara, Aria, Ashley
US Male: Andrew, Brian, Guy, Jason, Tony
UK Female: Sonia, Libby, Olivia, Hollie
UK Male: Ryan, Alfie, Oliver
AU Female: Natasha, Freya
AU Male: William, Neil
CA: Clara (Female), Liam (Male)
```

### Voice Selection Logic

1. **Persona Analysis**: Character profile parsed for gender
2. **Automatic Selection**: Random voice from matching gender
3. **Fallback System**: Opposite gender if none available
4. **Manual Override**: User can select specific voice

### TTS Content Processing

- **Markdown Cleaning**: Removes formatting for natural speech
- **HTML Text Extraction**: Plain text from rendered HTML
- **Selective Enablement**: Only conversational content spoken
- **Interruption Handling**: User input stops TTS immediately

## ⚙️ Configuration

### Environment Variables

```bash
# Server Configuration
PORT=3001                    # HTTP server port
NODE_ENV=development         # Environment mode

# Chrome Path (for Puppeteer)
CHROME_PATH=/usr/bin/google-chrome
```

### LLM Provider Setup

#### LiteLLM (Recommended)
```javascript
{
  "provider": "litellm",
  "apiUrl": "https://litellm-veil.veilstudio.io",
  "model": "gemini2.5-flash",
  "apiKey": "your-api-key"
}
```

#### OpenAI
```javascript
{
  "provider": "openai", 
  "apiUrl": "https://api.openai.com/v1",
  "model": "gpt-4o",
  "apiKey": "your-openai-key"
}
```

#### Local LM Studio
```javascript
{
  "provider": "lmstudio",
  "apiUrl": "http://localhost:1234/v1", 
  "model": "local-model-name",
  "apiKey": null
}
```

### Search Provider Configuration

```javascript
{
  "searchProvider": "brave",           // brave, duckduckgo, google, bing
  "searchApiKey": "your-api-key",      // Required for Brave, Google, Bing
  "searchLimit": 10,                   // Results per search
  "searchAutoSummarize": true,         // Enable AI summarization
  "searchTimeFilter": "any"            // any, day, week, month
}
```

### Azure TTS Configuration

```javascript
{ 
  "azureApiKey": "your-azure-key",
  "azureRegion": "eastus",
  "ttsVoice": "Sonia",                 // Auto-selected based on persona
  "voiceSpeed": 1.0,                   // 0.5-2.0 range
  "voicePitch": 1.0                    // 0.5-2.0 range
}
```

## 🛠️ API Reference

### HTTP REST API Endpoints

#### Health Check
```javascript
GET /api/mcp/health
// Response: {"status": "ok", "message": "Server running"}
```

#### Available Tools
```javascript
GET /api/mcp/tools
// Response: {"tools": [...]} // List of available tools
```

#### Tool Execution
```javascript
POST /api/mcp/call
{
  "tool": "break_down_problem",
  "arguments": {
    "problem": "How to implement machine learning?",
    "context": "For a web application"
  },
  "llmSettings": {
    "apiBaseUrl": "https://api.openai.com/v1",
    "apiKey": "your-key",
    "model": "gpt-4"
  }
}
```

### Agent Workflow API

#### Start Agent Task
```javascript
POST /api/agent/start-task
{
  "goal": "research renewable energy trends",
  "options": {
    "searchSettings": {...},
    "llmSettings": {...}
  }
}
// Response: {"taskId": "uuid", "message": "Task started"}
```

#### Execute Workflow
```javascript
POST /api/agent/execute-workflow
{
  "taskId": "uuid",
  "options": {...}
}
// Response: {"success": true, "message": "Workflow completed"}
```

#### Read Agent Memory
```javascript
GET /api/agent/memory/read?taskId=uuid&key=final_synthesis
// Response: {"memory": {...}} // Task memory contents
```

### Available Tools

#### 1. Sequential Thinking Tools
- **break_down_problem**: Analyze complex problems into steps
- **sequential_reasoning**: Step-by-step logical reasoning
- **step_by_step_analysis**: Systematic topic analysis
- **logical_chain**: Create reasoning chains

#### 2. Web Search Tools
- **web_search**: General web search with provider selection
- **search_recent**: Recent information (24 hours)
- **search_summarize**: Search with automatic summarization

#### 3. Content Extraction Tools
- **extract_web_content**: Full content extraction
- **extract_for_summary**: Optimized for summarization
- **extract_multiple_urls**: Batch extraction from multiple sources

## 🎯 Usage Examples

### Basic Chat
```javascript
// Simple conversation
User: "Hello, how are you?"
AI: "I'm doing well! I'm [persona name], and I'm here to help..."

// With voice
User: *clicks microphone* "What's the weather like?"
AI: *responds with voice* "I'd be happy to help you check the weather..."
```

### Research Queries
```javascript
// Automatic agent workflow
User: "research artificial intelligence trends"
→ Triggers agent workflow
→ Searches multiple providers
→ Extracts content from top sources
→ Synthesizes comprehensive response

// Sequential thinking
User: "break down the problem of climate change"
→ Triggers break_down_problem tool
→ Analyzes problem systematically
→ Provides step-by-step breakdown
```

### Content Extraction
```javascript
// Direct URL extraction
User: "tell me about https://example.com/article"
→ Extracts article content
→ Summarizes in persona voice
→ Provides natural response

// Batch extraction
User: "compare these articles: [url1] [url2] [url3]"
→ Extracts content from all URLs
→ Analyzes and compares
→ Provides comparison summary
```

### Image Generation
```javascript
// Persona-based images
User: "show me what you look like"
→ Generates image based on character profile
→ Includes persona's physical characteristics
→ Displays in fullscreen viewer

// Custom images
User: "show me a sunset over mountains"
→ Generates custom image
→ No persona characteristics included
→ Optimized for requested content
```

## 🔧 Development

### Adding New Features

#### Custom Search Provider
1. **Add Provider Class** in `mcp-server.js`
2. **Implement Search Method** following existing patterns
3. **Update UI Settings** in user-settings.html
4. **Test Integration** with agent workflows

#### New Content Extractor
1. **Create Extractor Class** in `extractors/`
2. **Implement Platform Logic** for specific sites
3. **Add Domain Detection** in web-extractor.js
4. **Test Extraction Quality** and performance

#### Additional Voice Providers
1. **Extend Voice Service** in voiceService.js
2. **Add Provider Configuration** in settings
3. **Implement Voice Mapping** for persona integration
4. **Test Voice Quality** and responsiveness

### Performance Optimization

#### Caching Strategy
- **Web Content**: 10-minute cache for extracted content
- **Search Results**: Session-based caching
- **LLM Responses**: No caching (dynamic content)
- **Images**: Browser cache with proper headers

#### Resource Management
- **Concurrent Limiting**: Maximum 3 simultaneous extractions
- **Timeout Management**: 30-second maximum per operation
- **Memory Cleanup**: Automatic task cleanup after completion
- **Connection Pooling**: Reuse HTTP connections where possible

## 🐛 Troubleshooting

### Common Issues

#### Agent Workflow Problems
```javascript
// Issue: Agent workflow not triggering
// Solution: Check keyword detection in main.js
// Keywords: research, investigate, find out about, etc.

// Issue: Web extraction failing
// Solution: Check Chrome/Chromium installation for Puppeteer
// Verify: process.env.CHROME_PATH
```

#### Search Provider Issues
```javascript
// Issue: Search results empty
// Solution: Verify API keys and provider settings
// Check: Network connectivity, rate limits

// Issue: Brave Search not working
// Solution: Ensure valid API key and subscription
// Fallback: DuckDuckGo (no API key required)
```

#### Voice Service Problems
```javascript
// Issue: TTS not working
// Solution: Check Azure API key and region
// Fallback: Web Speech API (system voices)

// Issue: Voice selection not working
// Solution: Check persona gender detection
// Verify: Character profile includes gender information
```

### Debug Mode

Enable comprehensive logging:
```javascript
localStorage.setItem('debugMode', 'true');
// Enables detailed console logging for all services
```

### Performance Monitoring

Check performance metrics:
```javascript
// Agent workflow timing
console.log('Agent workflow completed in:', elapsed, 'ms');

// Content extraction performance
console.log('Extracted', pages.length, 'pages in', duration, 'ms');

// Memory usage
console.log('Task memory size:', JSON.stringify(memory).length, 'bytes');
```

## 📄 License

Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- **Follow Architecture**: Use HTTP REST API patterns, not MCP protocol
- **Persona Integration**: All features should work with persona system
- **Mobile Optimization**: Test on mobile devices and browsers
- **Performance**: Consider caching, timeouts, and resource management
- **Error Handling**: Implement graceful fallbacks and user feedback

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/veilchat/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/veilchat/discussions)
- **Documentation**: [CLAUDE.md](CLAUDE.md) for architecture details

## 🙏 Acknowledgments

- **LiteLLM**: Multi-provider LLM support
- **Azure Cognitive Services**: Professional TTS integration
- **PDF.js & Mammoth.js**: Document processing
- **Puppeteer**: Dynamic content extraction
- **Mozilla Readability**: Article content extraction
- **Brave Search**: AI-powered search and summarization
- **Web Speech API**: Voice interaction capabilities

---

**VeilChat** - The intelligent AI research platform where advanced agent workflows, natural voice interaction, and persona-driven conversations create a truly engaging experience.

*Built with modern web technologies and a privacy-first approach to AI interaction.*