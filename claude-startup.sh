#!/usr/bin/env bash

# Claude Code Startup Script
# Acknowledges global and local MD files and checks MCP server status

echo "🚀 Claude Code Startup Check"
echo "================================"

# Function to safely read file if it exists
read_file_if_exists() {
    local file_path="$1"
    local description="$2"
    
    if [[ -f "$file_path" ]]; then
        echo "📋 $description found: $file_path"
        echo "   Last modified: $(stat -c %y "$file_path" 2>/dev/null || stat -f %Sm "$file_path" 2>/dev/null)"
        return 0
    else
        echo "❌ $description not found: $file_path"
        return 1
    fi
}

# Check for global CLAUDE.md
echo "🌍 Checking Global Configuration..."
read_file_if_exists "/home/rwells/.claude/CLAUDE.md" "Global CLAUDE.md"

# Check for local project MD files
echo ""
echo "📁 Checking Project Configuration..."
read_file_if_exists "./CLAUDE.md" "Project CLAUDE.md"
read_file_if_exists "./CLAUDE.local.md" "Local project CLAUDE.local.md"

# Check MCP server status
echo ""
echo "🔧 Checking MCP Server Status..."
mcp_output=$(claude mcp list 2>&1)
if [[ $? -eq 0 ]]; then
    echo "✅ MCP servers checked:"
    echo "$mcp_output" | grep -E "(✓|✗)" | while IFS= read -r line; do
        if [[ "$line" =~ ✓ ]]; then
            echo "   ✅ $line"
        else
            echo "   ❌ $line"
        fi
    done
else
    echo "❌ Failed to check MCP servers: $mcp_output"
fi

# Output JSON context for Claude
echo ""
echo "📤 Context for Claude:"
cat << 'EOF'
{
  "context": "startup_check_complete",
  "message": "🎯 Startup check complete! Ready to use 'use context7' for up-to-date documentation. All configuration files have been acknowledged and MCP servers checked.",
  "reminder": "Remember to use 'use context7' prefix when you need current documentation from external sources."
}
EOF

echo ""
echo "🎉 Startup check complete!"
