#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const parentDir = join(__dirname, '..');

console.log('🚀 Starting both servers...\n');

// Start MCP HTTP Server (port 3001)
const mcpServer = spawn('node', ['mcp-http-server.js'], {
    cwd: __dirname,
    stdio: 'pipe'
});

mcpServer.stdout.on('data', (data) => {
    console.log(`[MCP Server] ${data.toString().trim()}`);
});

mcpServer.stderr.on('data', (data) => {
    console.error(`[MCP Server Error] ${data.toString().trim()}`);
});

mcpServer.on('error', (error) => {
    console.error(`[MCP Server] Failed to start: ${error.message}`);
    process.exit(1);
});

// Start Live Server (port 8080) - use the one from parent directory
const liveServer = spawn('node', [join(parentDir, 'node_modules', 'live-server', 'live-server.js'), '.'], {
    cwd: parentDir,
    stdio: 'pipe'
});

liveServer.stdout.on('data', (data) => {
    console.log(`[Live Server] ${data.toString().trim()}`);
});

liveServer.stderr.on('data', (data) => {
    console.error(`[Live Server Error] ${data.toString().trim()}`);
});

liveServer.on('error', (error) => {
    console.error(`[Live Server] Failed to start: ${error.message}`);
    console.error('Make sure live-server is installed in the parent directory');
    mcpServer.kill();
    process.exit(1);
});

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down servers...');
    mcpServer.kill('SIGINT');
    liveServer.kill('SIGINT');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down servers...');
    mcpServer.kill('SIGTERM');
    liveServer.kill('SIGTERM');
    process.exit(0);
});

// Handle server process exits
mcpServer.on('close', (code) => {
    console.log(`[MCP Server] Process exited with code ${code}`);
    if (code !== 0) {
        liveServer.kill();
        process.exit(code);
    }
});

liveServer.on('close', (code) => {
    console.log(`[Live Server] Process exited with code ${code}`);
    if (code !== 0) {
        mcpServer.kill();
        process.exit(code);
    }
});

console.log('✅ Both servers are starting...');
console.log('📱 Web interface will be available at: http://localhost:8080');
console.log('🔧 MCP API will be available at: http://localhost:3001');
console.log('⏹️  Press Ctrl+C to stop both servers\n'); 