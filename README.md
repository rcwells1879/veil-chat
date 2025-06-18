# LLM Chat Interface

This project is a web-based chat interface designed for roleplaying, allowing users to interact with a local LLM running on a LMstudio server and generate images using the Automatic1111 API. The interface is visually appealing with a dark mode theme.

## Features

- Chat with a local LLM
- Generate images based on prompts constructed by the LLM
- Dark mode styling for a modern look
- User-friendly chat interface

## Project Structure

```
llm-chat-interface
├── src
│   ├── index.html        # Main HTML document for the chat interface
│   ├── css
│   │   └── style.css     # Styles for the chat interface
│   ├── js
│   │   ├── main.js       # Entry point for JavaScript functionality
│   │   ├── llmService.js # Service for LLM communication
│   │   └── imageService.js # Service for image generation
├── package.json          # npm configuration file
└── README.md             # Project documentation
```

## Setup Instructions

1. Clone the repository:
   ```
   git clone <repository-url>
   cd llm-chat-interface
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the application:
   ```
   npm start
   ```

## Usage Guidelines

- Open the chat interface in your web browser.
- Type your messages in the input field and press enter to send.
- To request an image, simply ask the LLM, and it will generate a prompt for the Automatic1111 API.

## Connecting to Your Own API Endpoints

This application allows you to connect to your self-hosted instances of LMStudio (for language model responses) and Automatic1111 (for image generation) if they are accessible over the internet.

**Your Responsibilities:**

1.  **Run Local Services:**
    *   Ensure LMStudio server is running (typically `http://localhost:1234`).
    *   Ensure Automatic1111 Web UI is running with the API enabled: `python launch.py --api`.

2.  **Expose Services to the Internet:**
    You need to make your local `localhost` ports accessible via a public URL. Common methods include:
    *   **SSH Remote Port Forwarding:** If you have a public server with SSH access.
        *   Example for LMStudio (local port 1234 to public server port 8080):
            `ssh -N -R 8080:localhost:1234 your_user@your_public_server_ip`
        *   Example for A1111 (local port 7860 to public server port 8081):
            `ssh -N -R 8081:localhost:7860 your_user@your_public_server_ip`
        *   Your public server's SSH daemon (`sshd_config`) might need `GatewayPorts yes`.
        *   The URL for the app would be like `http://your_public_server_ip:8080/v1` for LMStudio.
    *   **Router Port Forwarding:** Configure your home router to forward specific external ports to your computer's local IP and the service ports. Your URL would use your public IP address. This method has security implications and may be affected by dynamic public IPs.
    *   **Tunneling Services:** Use services like `ngrok` or `cloudflared tunnel`.
        *   Example with `ngrok` for LMStudio: `ngrok http 1234`. Ngrok will provide a public URL.

3.  **Configure CORS (Cross-Origin Resource Sharing) - VERY IMPORTANT!**
    Your browser will block requests from this web app to your APIs unless your APIs explicitly allow it.
    *   **Automatic1111:** Start it with the `--cors-allow-origins` flag.
        *   For general use/testing: `python launch.py --api --cors-allow-origins="*"`
        *   For better security (replace `your-chat-app.com` with the actual domain where this chat interface is hosted):
            `python launch.py --api --cors-allow-origins="https://your-chat-app.com"`
    *   **LMStudio:** The built-in server is usually permissive with CORS. If you encounter issues, you might need to run LMStudio behind a reverse proxy (like Nginx or Caddy) that adds the necessary `Access-Control-Allow-Origin` headers.

4.  **HTTPS (Mixed Content Prevention):**
    If this chat application is hosted on an `https://` domain, your browser will block requests to `http://` API endpoints.
    *   You will need to ensure your exposed API endpoints are also `https://`.
    *   This typically involves using a reverse proxy (Nginx, Caddy, Traefik) with SSL certificates (e.g., from Let's Encrypt) in front of your exposed ports or using a tunneling service that provides HTTPS.

**Configuring in the Chat App:**

1.  Click the "☰" (settings) button in the chat interface.
2.  Enter your full public base URL for LMStudio (e.g., `https://my-tunnel.example.com/v1` or `http://my-public-ip:1234/v1`) into the "LMStudio API URL" field.
3.  Enter your full public base URL for Automatic1111 (e.g., `https://my-a1111-tunnel.example.com` or `http://my-public-ip:7860`) into the "A1111 API URL" field.
4.  Click "Save API Settings". The application will now attempt to use these new endpoints.

**Note:** Setting up secure and reliable public access to local services can be complex. Please ensure you understand the security implications of the method you choose.

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue for any suggestions or improvements.

## License

This project is licensed under the MIT License.