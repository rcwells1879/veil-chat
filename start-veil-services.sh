#!/bin/bash

# VeilChat Services Startup Script
# Starts both MCP-HTTP server and Cloudflare tunnel

# Set the project directory
PROJECT_DIR="/Users/rwells/veilstudio/veil-chat"
LOG_DIR="$PROJECT_DIR/logs"

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Set log files
MCP_LOG="$LOG_DIR/mcp-server.log"
TUNNEL_LOG="$LOG_DIR/cloudflare-tunnel.log"
STARTUP_LOG="$LOG_DIR/startup.log"

# Log startup
echo "$(date): Starting VeilChat services..." | tee -a "$STARTUP_LOG"

# Kill any existing processes first
echo "$(date): Stopping any existing services..." | tee -a "$STARTUP_LOG"
pkill -f "node.*mcp-http-server.js" 2>/dev/null
pkill -f "cloudflared tunnel" 2>/dev/null
sleep 2

# Start MCP-HTTP server directly (bypassing start-servers.js wrapper to avoid signal handling issues)
echo "$(date): Starting MCP-HTTP server..." | tee -a "$STARTUP_LOG"
cd "$PROJECT_DIR"
export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
nohup node src/server/mcp-http-server.js > "$MCP_LOG" 2>&1 &
MCP_PID=$!
disown
echo "$(date): MCP-HTTP server started with PID $MCP_PID" | tee -a "$STARTUP_LOG"

# Wait for MCP server to be ready
echo "$(date): Waiting for MCP server to initialize..." | tee -a "$STARTUP_LOG"
sleep 5

# Start Cloudflare tunnel
echo "$(date): Starting Cloudflare tunnel..." | tee -a "$STARTUP_LOG"
nohup /opt/homebrew/bin/cloudflared tunnel --config ~/.cloudflared/config.yml run veil-local-services-new > "$TUNNEL_LOG" 2>&1 &
TUNNEL_PID=$!
disown
echo "$(date): Cloudflare tunnel started with PID $TUNNEL_PID" | tee -a "$STARTUP_LOG"

# Wait for tunnel to connect
sleep 5

# Verify services are running
echo "$(date): Verifying services..." | tee -a "$STARTUP_LOG"

# Check if MCP server is responding
if curl -s http://localhost:3001/api/mcp/health > /dev/null 2>&1; then
    echo "$(date): ✅ MCP-HTTP server is running and healthy" | tee -a "$STARTUP_LOG"
else
    echo "$(date): ❌ MCP-HTTP server health check failed" | tee -a "$STARTUP_LOG"
fi

# Check if tunnel is connected
if curl -s https://mcp-veil.veilstudio.io/api/mcp/health > /dev/null 2>&1; then
    echo "$(date): ✅ Cloudflare tunnel is connected and routing correctly" | tee -a "$STARTUP_LOG"
else
    echo "$(date): ⚠️  Cloudflare tunnel may still be connecting..." | tee -a "$STARTUP_LOG"
fi

echo "$(date): VeilChat services startup complete" | tee -a "$STARTUP_LOG"
echo "$(date): MCP Server PID: $MCP_PID" | tee -a "$STARTUP_LOG"
echo "$(date): Tunnel PID: $TUNNEL_PID" | tee -a "$STARTUP_LOG"
echo "$(date): Logs available at: $LOG_DIR" | tee -a "$STARTUP_LOG"
