# VeilChat

A modern, feature-rich chat interface with AI capabilities, voice interaction, image generation, and enhanced reasoning through Model Context Protocol (MCP) integration.

![VeilChat Interface](https://img.shields.io/badge/VeilChat-Chat%20Interface-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node.js](https://img.shields.io/badge/Node.js-18.0.0+-brightgreen)

## 🌟 Features

### 🤖 AI Chat Capabilities
- **Multi-Provider LLM Support**: Compatible with LiteLLM, OpenAI, and other LLM providers
- **Conversation Memory**: Persistent chat history with automatic session management
- **Context-Aware Responses**: Intelligent conversation flow with character/persona support
- **Custom Personas**: Create and switch between different AI personalities

### 🎤 Voice Interaction
- **Speech-to-Text (STT)**: Voice input with automatic transcription
- **Text-to-Speech (TTS)**: AI responses read aloud with natural voice synthesis
- **Continuous Conversation**: Hands-free voice chat with auto-send functionality
- **Multiple Voice Options**: Choose from various voice personalities

### 🎨 Image Generation
- **AI Image Creation**: Generate images from text descriptions
- **Multi-Provider Support**: Automatic1111 (Stable Diffusion) and OpenAI DALL-E
- **Customizable Settings**: Adjust image size, quality, and generation parameters
- **Fullscreen Viewer**: Click images to view in fullscreen mode

### 📄 Document Context
- **Multi-Format Support**: PDF, DOCX, TXT, JSON, HTML, CSS, Markdown, and more
- **Document Analysis**: AI can reference and analyze attached documents
- **Context Integration**: Seamless document context in conversations
- **File Management**: Easy attachment and removal of documents

### 🧠 Enhanced Reasoning (MCP)
- **Sequential Thinking**: Step-by-step problem analysis and reasoning
- **Model Context Protocol**: Advanced reasoning capabilities through MCP integration
- **Problem Breakdown**: Complex problem decomposition into manageable steps
- **Logical Chains**: Create logical reasoning chains from premise to conclusion

### 📱 Mobile-First Design
- **Responsive Interface**: Optimized for mobile and desktop devices
- **Touch-Friendly**: Intuitive touch controls and gestures
- **Keyboard Optimization**: Smart keyboard handling for mobile devices
- **iOS Compatibility**: Full support for iOS Safari and mobile browsers

## 🚀 Quick Start

### Prerequisites
- Node.js 18.0.0 or higher
- Modern web browser with JavaScript enabled
- Optional: Local LLM server (LiteLLM, LM Studio, etc.)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/veilchat.git
   cd veilchat
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the application:**
   ```bash
   # Start both the chat interface and MCP server together
   npm run start:both
   ```

4. **Open your browser:**
   - **Chat Interface**: Navigate to `http://localhost:8080`
   - **MCP Server**: Runs on `http://localhost:3001` (automatically connected)

## ⚙️ Configuration

### LLM Provider Setup

VeilChat supports multiple LLM providers. Configure your preferred provider in the settings:

#### LiteLLM (Recommended)
```javascript
// Default configuration
Provider: "litellm"
API URL: "https://litellm-veil.veilstudio.io"
Model: "gemini2.5-flash"
API Key: 
```

#### OpenAI
```javascript
Provider: "openai"
API URL: "https://api.openai.com/v1"
Model: "gpt-4" or "gpt-3.5-turbo"
API Key: "your-openai-api-key"
```

#### Local LM Studio
```javascript
Provider: "lmstudio"
API URL: "http://localhost:1234/v1"
Model: "local-model-name"
API Key: null
```

### Image Generation Setup

#### Automatic1111 (Stable Diffusion)
```javascript
Provider: "a1111"
API URL: "http://localhost:7860"
// No API key required for local setup
```

#### OpenAI GPT-Image-1
```javascript
Provider: "openai"
API URL: "https://api.openai.com/v1"
API Key: "your-openai-api-key"
```

### Voice Settings

Configure voice interaction in the settings panel:
- **TTS Voice**: Choose from available system voices
- **STT Language**: Speech recognition language
- **Auto-Send Delay**: Time before voice input is automatically sent

## 🎯 Usage Guide

### Basic Chat
1. Type your message in the input field
2. Press Enter or click Send
3. The AI will respond with text and optionally voice

### Voice Chat
1. Click the microphone button 🎤
2. Speak your message clearly
3. The system will transcribe and send automatically
4. AI responses will be read aloud

### Image Generation
1. Type "Show me [description]" to generate images
2. Example: "Show me a beautiful sunset over mountains"
3. Click the generated image to view fullscreen

### Document Analysis
1. Click the attachment button 📎
2. Select documents (PDF, DOCX, TXT, etc.)
3. Ask questions about the documents
4. AI will reference the document content in responses

### Custom Personas
1. Open settings (☰)
2. Go to Persona section
3. Create a custom persona or use random generation
4. The AI will adopt the specified personality

## 🧠 MCP Server Integration

VeilChat includes a powerful Model Context Protocol (MCP) server that provides enhanced reasoning capabilities.

### Available MCP Tools

1. **Break Down Problem** - Analyze complex problems into sequential, manageable steps
2. **Sequential Reasoning** - Apply step-by-step logical reasoning to answer questions
3. **Step-by-Step Analysis** - Perform systematic analysis of topics or problems
4. **Logical Chain** - Create logical chains of reasoning from premise to conclusion

### MCP Server Setup

The MCP server is automatically started when you run `npm run start:both`. The server runs on `http://localhost:3001` and connects automatically to the chat interface.

To enable MCP features:
1. Open Settings (☰) in the chat interface
2. Enable "Sequential Thinking" in the MCP settings section
3. The MCP server will automatically connect and provide enhanced reasoning capabilities

### MCP Usage Examples

Simply include these keywords in your messages to trigger the corresponding MCP tools:

#### Break Down Problem
**Keywords**: `"break down"` or `"analyze step by step"`
- "Break down the problem of climate change"
- "Analyze step by step how to implement machine learning"

#### Sequential Reasoning  
**Keywords**: `"reason through"` or `"think step by step"`
- "Reason through why the sky is blue"
- "Think step by step about how photosynthesis works"

#### Step-by-Step Analysis
**Keywords**: `"analyze"` or `"examine"`
- "Analyze the benefits of renewable energy"
- "Examine the impact of social media on society"

#### Logical Chain
**Keywords**: `"logical chain"` or `"reasoning chain"`
- "Create a logical chain from fossil fuels to climate change"
- "Show me the reasoning chain from poverty to crime rates"

### MCP API Endpoints

When using the HTTP server, the following endpoints are available:

- `GET /api/mcp/health` - Health check
- `GET /api/mcp/tools` - List available tools
- `POST /api/mcp/call` - Call a specific tool

### Example API Usage

```javascript
// Get available tools
const tools = await fetch('/api/mcp/tools').then(r => r.json());

// Call a tool
const result = await fetch('/api/mcp/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        tool: 'break_down_problem',
        arguments: { problem: 'How to solve climate change?' }
    })
}).then(r => r.json());
```

### Tool Details

#### 1. Break Down Problem

Breaks complex problems into manageable steps.

**Parameters:**
- `problem` (required): The complex problem to break down
- `context` (optional): Additional context or background information

**Example:**
```javascript
await mcpClient.breakDownProblem(
    "How to implement a machine learning model for image classification?",
    "Working with a dataset of 10,000 images across 5 categories"
);
```

#### 2. Sequential Reasoning

Applies step-by-step logical reasoning to answer questions.

**Parameters:**
- `question` (required): The question to reason through
- `steps` (optional): Number of reasoning steps (default: 3)

**Example:**
```javascript
await mcpClient.sequentialReasoning(
    "Why do leaves change color in autumn?",
    4
);
```

#### 3. Step-by-Step Analysis

Performs systematic analysis of topics or problems.

**Parameters:**
- `topic` (required): The topic or problem to analyze
- `analysis_type` (optional): Type of analysis - 'general', 'technical', or 'creative' (default: 'general')

**Example:**
```javascript
await mcpClient.stepByStepAnalysis(
    "Blockchain technology",
    "technical"
);
```

#### 4. Logical Chain

Creates logical chains of reasoning from premise to conclusion.

**Parameters:**
- `premise` (required): The starting point or assumption
- `conclusion` (required): The desired conclusion or outcome
- `steps` (optional): Number of logical links (default: 4)

**Example:**
```javascript
await mcpClient.logicalChain(
    "Renewable energy is becoming cheaper",
    "Fossil fuels will be phased out",
    5
);
```

### MCP Configuration

#### Settings

The MCP server can be configured through the chat interface settings:

- **Enable Sequential Thinking**: Toggle MCP functionality on/off
- **MCP Server URL**: URL for the MCP HTTP server (default: http://localhost:3001)

#### Environment Variables

You can also configure the server using environment variables:

- `PORT`: HTTP server port (default: 3001)
- `NODE_ENV`: Environment mode (development/production)

### Adding New MCP Tools

To add a new sequential thinking tool:

1. Add the tool handler to `mcp-server.js`:
   ```javascript
   async handleNewTool(args) {
       // Your tool logic here
       return {
           content: [{ type: 'text', text: 'Tool result' }]
       };
   }
   ```

2. Add the tool to the switch statement in `setupToolHandlers()`

3. Add the tool definition to the `tools` array

4. Update the HTTP server routes in `mcp-http-server.js`

## 🏗️ Architecture

### Project Structure
```
veilchat/
├── index.html              # Main application interface
├── css/
│   └── style.css          # Application styling
├── js/
│   ├── main.js            # Core application logic
│   ├── llmService.js      # LLM provider integration
│   ├── voiceService.js    # Speech recognition and synthesis
│   ├── imageService.js    # Image generation services
│   ├── contextservice.js  # Document processing and context
│   └── mcpClient.js       # MCP protocol client
├── pages/
│   ├── user-settings.html # Settings panel
│   └── persona.html       # Persona creation interface
├── server/
│   ├── mcp-server.js      # MCP server implementation
│   ├── mcp-http-server.js # HTTP wrapper for MCP
│   └── start-servers.js   # Server startup script
└── package.json           # Dependencies and scripts
```

### Core Services

#### LLMService
- Manages conversation history and context
- Handles different LLM provider APIs
- Supports custom personas and character generation
- Provides conversation persistence

#### VoiceService
- Speech-to-text transcription
- Text-to-speech synthesis
- Continuous conversation support
- Voice selection and configuration

#### ImageService
- Multi-provider image generation
- Automatic1111 and OpenAI integration
- Customizable generation parameters
- Base64 image handling

#### ContextService
- Document processing and text extraction
- Multi-format file support (PDF, DOCX, etc.)
- Context integration with conversations
- Document management and preview

#### MCPClient
- Model Context Protocol integration
- Enhanced reasoning capabilities
- Tool execution and result handling
- Connection management

## 🔧 Development

### Available Scripts

```bash
# Start the main chat interface
npm start

# Start the MCP HTTP server
npm run start:http

# Start both chat interface and MCP server
npm run start:both

# Development mode with auto-reload
npm run dev

# Development mode for HTTP server
npm run dev:http
```

### Adding New Features

#### Custom LLM Provider
1. Add provider configuration in `llmService.js`
2. Implement provider-specific API calls
3. Update settings panel for provider selection

#### New Image Provider
1. Extend `imageService.js` with new provider class
2. Implement generation method
3. Add provider settings to configuration

#### Additional MCP Tools
1. Add tool handler to `mcp-server.js`
2. Update tool definitions and switch statements
3. Add HTTP server routes in `mcp-http-server.js`

### Browser Compatibility

- **Chrome/Chromium**: Full support
- **Firefox**: Full support
- **Safari**: Full support (including iOS)
- **Edge**: Full support
- **Mobile Browsers**: Optimized for mobile Safari and Chrome

## 🐛 Troubleshooting

### Common Issues

#### MCP Server Connection
- **Problem**: MCP server won't connect
- **Solution**: Ensure server is running on correct port (3001)
- **Check**: Verify MCP Server URL in settings

#### Voice Recognition Issues
- **Problem**: Speech recognition not working
- **Solution**: Check browser permissions for microphone access
- **Check**: Ensure HTTPS for production deployments

#### Image Generation Fails
- **Problem**: Images not generating
- **Solution**: Verify API keys and provider settings
- **Check**: Check network connectivity to image service

#### Document Upload Issues
- **Problem**: Documents not processing
- **Solution**: Check file size (max 10MB) and format support
- **Check**: Ensure PDF.js and Mammoth.js libraries are loaded

### Debug Mode

Enable debug logging by opening browser console and setting:
```javascript
localStorage.setItem('debugMode', 'true');
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/veilchat/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/veilchat/discussions)
- **Documentation**: [Wiki](https://github.com/yourusername/veilchat/wiki)

## 🙏 Acknowledgments

- **LiteLLM**: For multi-provider LLM support
- **PDF.js**: For PDF text extraction
- **Mammoth.js**: For DOCX text extraction
- **Model Context Protocol**: For enhanced reasoning capabilities
- **Web Speech API**: For voice interaction features

---

**VeilChat** - Where conversations come to life with AI intelligence, voice interaction, and enhanced reasoning capabilities. 