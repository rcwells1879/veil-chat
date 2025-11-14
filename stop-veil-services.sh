#!/bin/bash

# VeilChat Services Stop Script
# Stops both MCP-HTTP server and Cloudflare tunnel

LOG_DIR="/Users/rwells/veilstudio/veil-chat/logs"
STARTUP_LOG="$LOG_DIR/startup.log"

echo "$(date): Stopping VeilChat services..." | tee -a "$STARTUP_LOG"

# Stop MCP-HTTP server
echo "$(date): Stopping MCP-HTTP server..." | tee -a "$STARTUP_LOG"
pkill -f "node.*mcp-http-server.js"

# Stop Cloudflare tunnel
echo "$(date): Stopping Cloudflare tunnel..." | tee -a "$STARTUP_LOG"
pkill -f "cloudflared tunnel"

# Wait for processes to terminate
sleep 2

# Verify services are stopped
if pgrep -f "node.*mcp-http-server.js" > /dev/null; then
    echo "$(date): ⚠️  MCP-HTTP server is still running" | tee -a "$STARTUP_LOG"
else
    echo "$(date): ✅ MCP-HTTP server stopped" | tee -a "$STARTUP_LOG"
fi

if pgrep -f "cloudflared tunnel" > /dev/null; then
    echo "$(date): ⚠️  Cloudflare tunnel is still running" | tee -a "$STARTUP_LOG"
else
    echo "$(date): ✅ Cloudflare tunnel stopped" | tee -a "$STARTUP_LOG"
fi

echo "$(date): VeilChat services stopped" | tee -a "$STARTUP_LOG"
