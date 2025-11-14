#!/bin/bash

# VeilChat Services Management Script
# Manages auto-start configuration and service control

PLIST_FILE="$HOME/Library/LaunchAgents/com.veilstudio.veilchat.plist"
PROJECT_DIR="/Users/rwells/veilstudio/veil-chat"

show_usage() {
    echo "VeilChat Services Management"
    echo ""
    echo "Usage: $0 {start|stop|restart|status|enable|disable|logs}"
    echo ""
    echo "Commands:"
    echo "  start    - Start services manually"
    echo "  stop     - Stop services"
    echo "  restart  - Restart services"
    echo "  status   - Check service status"
    echo "  enable   - Enable auto-start at login"
    echo "  disable  - Disable auto-start at login"
    echo "  logs     - Show recent logs"
    echo ""
}

check_status() {
    echo "Checking VeilChat services status..."
    echo ""

    # Check MCP server
    if pgrep -f "node.*mcp-http-server.js" > /dev/null; then
        MCP_PID=$(pgrep -f "node.*mcp-http-server.js")
        echo "✅ MCP-HTTP Server: Running (PID: $MCP_PID)"
    else
        echo "❌ MCP-HTTP Server: Not running"
    fi

    # Check Cloudflare tunnel
    if pgrep -f "cloudflared tunnel" > /dev/null; then
        TUNNEL_PID=$(pgrep -f "cloudflared tunnel")
        echo "✅ Cloudflare Tunnel: Running (PID: $TUNNEL_PID)"
    else
        echo "❌ Cloudflare Tunnel: Not running"
    fi

    # Check launchd service
    echo ""
    if launchctl list | grep -q "com.veilstudio.veilchat"; then
        echo "✅ Auto-start: Enabled"
    else
        echo "❌ Auto-start: Disabled"
    fi

    # Test endpoints
    echo ""
    echo "Testing endpoints..."
    if curl -s http://localhost:3001/api/mcp/health > /dev/null 2>&1; then
        echo "✅ Local endpoint: http://localhost:3001 - Healthy"
    else
        echo "❌ Local endpoint: http://localhost:3001 - Not responding"
    fi

    if curl -s https://mcp-veil.veilstudio.io/api/mcp/health > /dev/null 2>&1; then
        echo "✅ Public endpoint: https://mcp-veil.veilstudio.io - Healthy"
    else
        echo "❌ Public endpoint: https://mcp-veil.veilstudio.io - Not responding"
    fi
}

show_logs() {
    echo "Recent logs from VeilChat services:"
    echo ""
    echo "=== Startup Log ==="
    tail -20 "$PROJECT_DIR/logs/startup.log" 2>/dev/null || echo "No startup logs found"
    echo ""
    echo "=== MCP Server Log ==="
    tail -20 "$PROJECT_DIR/logs/mcp-server.log" 2>/dev/null || echo "No MCP server logs found"
    echo ""
    echo "=== Cloudflare Tunnel Log ==="
    tail -20 "$PROJECT_DIR/logs/cloudflare-tunnel.log" 2>/dev/null || echo "No tunnel logs found"
}

case "$1" in
    start)
        echo "Starting VeilChat services..."
        "$PROJECT_DIR/start-veil-services.sh"
        ;;
    stop)
        echo "Stopping VeilChat services..."
        "$PROJECT_DIR/stop-veil-services.sh"
        ;;
    restart)
        echo "Restarting VeilChat services..."
        "$PROJECT_DIR/stop-veil-services.sh"
        sleep 3
        "$PROJECT_DIR/start-veil-services.sh"
        ;;
    status)
        check_status
        ;;
    enable)
        echo "Enabling auto-start at login..."
        launchctl load "$PLIST_FILE" 2>/dev/null
        if launchctl list | grep -q "com.veilstudio.veilchat"; then
            echo "✅ Auto-start enabled"
        else
            echo "❌ Failed to enable auto-start"
        fi
        ;;
    disable)
        echo "Disabling auto-start at login..."
        launchctl unload "$PLIST_FILE" 2>/dev/null
        if launchctl list | grep -q "com.veilstudio.veilchat"; then
            echo "❌ Failed to disable auto-start"
        else
            echo "✅ Auto-start disabled"
        fi
        ;;
    logs)
        show_logs
        ;;
    *)
        show_usage
        exit 1
        ;;
esac
