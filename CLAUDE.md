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

## Deployment Configuration

- CORS settings are handled in my Cloudflare tunnel dashboard 