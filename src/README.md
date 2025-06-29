# Sequential Thinking MCP Server

A simple Model Context Protocol (MCP) server that provides enhanced reasoning capabilities through sequential thinking tools. This server can be integrated with your chat interface to provide step-by-step analysis, problem breakdown, and logical reasoning.

## Features

### Available Tools

1. **Break Down Problem** - Analyze complex problems into sequential, manageable steps
2. **Sequential Reasoning** - Apply step-by-step logical reasoning to answer questions
3. **Step-by-Step Analysis** - Perform systematic analysis of topics or problems
4. **Logical Chain** - Create logical chains of reasoning from premise to conclusion

### Usage Examples

- "Break down the problem of climate change"
- "Reason through why the sky is blue"
- "Analyze the benefits of renewable energy"
- "Create a logical chain from fossil fuels to climate change"

## Installation

### Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn package manager

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the MCP HTTP server:**
   ```bash
   npm run start:http
   ```
   
   This will start the server on `http://localhost:3001`

3. **Or start the raw MCP server (for direct MCP protocol usage):**
   ```bash
   npm start
   ```

## Integration with Chat Interface

### Method 1: HTTP Server (Recommended)

1. Start the HTTP server:
   ```bash
   npm run start:http
   ```

2. Open your chat interface at `http://localhost:3001`

3. Go to Settings (☰) and enable "Sequential Thinking" in the MCP settings section

4. The MCP server will automatically connect and provide enhanced reasoning capabilities

### Method 2: Direct Integration

If you want to integrate the MCP client directly into your existing chat interface:

1. Include the MCP client script:
   ```html
   <script src="js/mcpClient.js"></script>
   ```

2. Initialize the MCP client in your application:
   ```javascript
   const mcpClient = new MCPClient();
   await mcpClient.connect();
   ```

3. Use the integration helper:
   ```javascript
   const result = await mcpClient.integrateWithChat(userMessage);
   if (result) {
       // MCP handled the message
       displayMessage(result.content[0].text);
   }
   ```

## API Endpoints

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

## Tool Details

### 1. Break Down Problem

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

### 2. Sequential Reasoning

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

### 3. Step-by-Step Analysis

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

### 4. Logical Chain

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

## Configuration

### Settings

The MCP server can be configured through the chat interface settings:

- **Enable Sequential Thinking**: Toggle MCP functionality on/off
- **MCP Server URL**: URL for the MCP HTTP server (default: http://localhost:3001)

### Environment Variables

You can also configure the server using environment variables:

- `PORT`: HTTP server port (default: 3001)
- `NODE_ENV`: Environment mode (development/production)

## Development

### Project Structure

```
├── mcp-server.js          # Main MCP server implementation
├── mcp-http-server.js     # HTTP wrapper for browser integration
├── js/
│   └── mcpClient.js       # Browser client for MCP integration
├── package.json           # Dependencies and scripts
└── README.md             # This file
```

### Scripts

- `npm start` - Start the raw MCP server
- `npm run start:http` - Start the HTTP server
- `npm run dev` - Start the raw MCP server in watch mode
- `npm run dev:http` - Start the HTTP server in watch mode

### Adding New Tools

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

## Troubleshooting

### Common Issues

1. **MCP Server won't start:**
   - Check that Node.js 18+ is installed
   - Verify all dependencies are installed with `npm install`
   - Check the console for error messages

2. **Chat interface can't connect to MCP:**
   - Ensure the HTTP server is running on the correct port
   - Check that the MCP Server URL in settings is correct
   - Verify CORS settings if accessing from a different domain

3. **Tools not responding:**
   - Check the browser console for JavaScript errors
   - Verify the MCP client is properly initialized
   - Check that the MCP server is running and accessible

### Debug Mode

Enable debug logging by setting the environment variable:
```bash
DEBUG=mcp:* npm run start:http
```

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions:
- Check the troubleshooting section above
- Review the console logs for error messages
- Open an issue on the GitHub repository 