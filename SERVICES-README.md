# VeilChat Services Management

This document explains how to manage the VeilChat MCP-HTTP server and Cloudflare tunnel services.

## Quick Start

### Manual Control

```bash
# Start both services
./start-veil-services.sh

# Stop both services
./stop-veil-services.sh

# Or use the management script
./manage-veil-services.sh start
./manage-veil-services.sh stop
./manage-veil-services.sh restart
./manage-veil-services.sh status
```

### Service Management

The `manage-veil-services.sh` script provides easy control:

```bash
# Check if services are running
./manage-veil-services.sh status

# View recent logs
./manage-veil-services.sh logs

# Enable auto-start at login (already enabled)
./manage-veil-services.sh enable

# Disable auto-start at login
./manage-veil-services.sh disable
```

## Auto-Start Configuration

✅ **Auto-start is already enabled!**

The services will automatically start when you log in to macOS. This is managed by launchd using the configuration file:
- [~/Library/LaunchAgents/com.veilstudio.veilchat.plist](~/Library/LaunchAgents/com.veilstudio.veilchat.plist)

### Network Availability Checks

The startup script includes intelligent network checking to handle system restarts:
- **Waits for network connectivity** before starting services (up to 60 seconds)
- **Retries health checks** if services don't respond immediately
- **Logs all attempts** for troubleshooting

This ensures the Cloudflare tunnel can connect properly even when starting immediately after login.

### What Runs at Startup

1. **MCP-HTTP Server** - Runs on `http://localhost:3001`
   - Provides the `/api/imagen4/generate` endpoint for image generation
   - Provides MCP tools for web scraping and reasoning

2. **Cloudflare Tunnel** - Routes `https://mcp-veil.veilstudio.io` → `localhost:3001`
   - Enables secure public access to the local MCP server
   - Maintains 4 redundant connections to Cloudflare edge servers

## Service Endpoints

- **Local Health Check**: `http://localhost:3001/api/mcp/health`
- **Public Health Check**: `https://mcp-veil.veilstudio.io/api/mcp/health`
- **Imagen 4 Generation**: `https://mcp-veil.veilstudio.io/api/imagen4/generate`

## Logs

All service logs are stored in the `logs/` directory:

- `logs/startup.log` - Service startup and status messages
- `logs/mcp-server.log` - MCP-HTTP server output
- `logs/cloudflare-tunnel.log` - Cloudflare tunnel connection logs
- `logs/launchd-stdout.log` - launchd standard output
- `logs/launchd-stderr.log` - launchd error output

View logs with:
```bash
./manage-veil-services.sh logs

# Or view individual log files:
tail -f logs/startup.log
tail -f logs/mcp-server.log
tail -f logs/cloudflare-tunnel.log
```

## Troubleshooting

### Services not starting automatically

1. Check if launchd service is loaded:
   ```bash
   launchctl list | grep veilstudio
   ```

2. Manually load the service:
   ```bash
   launchctl load ~/Library/LaunchAgents/com.veilstudio.veilchat.plist
   ```

3. Check launchd logs:
   ```bash
   cat logs/launchd-stderr.log
   ```

### Services running but not responding

1. Check service status:
   ```bash
   ./manage-veil-services.sh status
   ```

2. Check logs for errors:
   ```bash
   ./manage-veil-services.sh logs
   ```

3. Restart services:
   ```bash
   ./manage-veil-services.sh restart
   ```

### Tunnel not connecting

1. Verify cloudflared is installed:
   ```bash
   which cloudflared
   # Should show: /opt/homebrew/bin/cloudflared
   ```

2. Test tunnel manually:
   ```bash
   cloudflared tunnel --config ~/.cloudflared/config.yml run veil-local-services-new
   ```

3. Check tunnel configuration:
   ```bash
   cat ~/.cloudflared/config.yml
   ```

## Files and Locations

### Service Scripts
- `start-veil-services.sh` - Starts both MCP server and tunnel
- `stop-veil-services.sh` - Stops both services
- `manage-veil-services.sh` - Management interface for all operations

### Configuration Files
- `~/.cloudflared/config.yml` - Cloudflare tunnel configuration
- `~/.cloudflared/70897c5c-3f98-4c40-bfdb-d1c4f9a5869b.json` - Tunnel credentials
- `~/Library/LaunchAgents/com.veilstudio.veilchat.plist` - launchd auto-start config

### Log Files
- `logs/` - All service logs

## Uninstalling Auto-Start

If you want to disable auto-start:

```bash
# Disable the service
./manage-veil-services.sh disable

# Or manually:
launchctl unload ~/Library/LaunchAgents/com.veilstudio.veilchat.plist

# To completely remove:
rm ~/Library/LaunchAgents/com.veilstudio.veilchat.plist
```

## Re-enabling After Restart

The services are configured to auto-start, so after a Mac restart:
1. Wait 30-60 seconds after login for services to initialize
2. Check status: `./manage-veil-services.sh status`
3. If not running, manually start: `./manage-veil-services.sh start`
