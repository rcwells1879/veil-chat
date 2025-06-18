// lmstudio-proxy.js
const http = require('http');
const httpProxy = require('http-proxy');

const LMSTUDIO_TARGET = 'http://localhost:1234'; // Your actual LMStudio address
const PROXY_PORT = 5001; // Choose an unused port for this proxy

const proxy = httpProxy.createProxyServer({});

const server = http.createServer((req, res) => {
    // Get the origin from the request headers
    const origin = req.headers.origin;
    console.log(`Received request from origin: ${origin}`);
    console.log(`Method: ${req.method}, URL: ${req.url}`);

    // Allow both www and non-www versions of veilstudio.io
    const allowedOrigins = [
        'https://veilstudio.io',
        'https://www.veilstudio.io'
    ];

    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        console.log(`Allowing origin: ${origin}`);
    } else {
        console.log(`Blocking origin: ${origin}`);
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Respond to preflight OPTIONS requests
    if (req.method === 'OPTIONS') {
        console.log('Handling OPTIONS preflight request');
        res.writeHead(204); // No Content
        res.end();
        return;
    }

    // Proxy other requests to LMStudio
    console.log(`Proxying ${req.method} request to ${LMSTUDIO_TARGET}${req.url}`);
    proxy.web(req, res, { target: LMSTUDIO_TARGET, changeOrigin: true }, (err) => {
        console.error('Proxy error:', err);
        res.writeHead(502);
        res.end("Proxy error");
    });
});

console.log(`Starting CORS proxy for LMStudio on port ${PROXY_PORT}`);
console.log(`Forwarding to ${LMSTUDIO_TARGET}`);
console.log(`Allowing origins: https://veilstudio.io and https://www.veilstudio.io`);
server.listen(PROXY_PORT, () => {
    console.log(`Proxy server is running on port ${PROXY_PORT}`);
});