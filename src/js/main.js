let isInitialized = false;

// --- Simplified and reliable initialization ---
// This ensures initializeApp runs exactly once when the document is ready.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp(); // DOM is already ready
}

async function initializeApp() {
    if (isInitialized) return;
    isInitialized = true;

    // Add a small delay for mobile browsers to fully render DOM
    await new Promise(resolve => setTimeout(resolve, 100));

    // --- DOM Elements ---
    const chatWindow = document.getElementById('chat-window');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const micButton = document.getElementById('mic-button');
    const settingsButton = document.getElementById('settings-button');
    const settingsPanelContainer = document.getElementById('settings-panel-container');
    
    // Check if essential elements exist
    if (!chatWindow || !userInput || !sendButton || !settingsButton) {
        console.error('Critical DOM elements missing!', {
            chatWindow: !!chatWindow,
            userInput: !!userInput, 
            sendButton: !!sendButton,
            settingsButton: !!settingsButton
        });
        return;
    }

    // Mobile debugging for development only
    if (localStorage.getItem('debugMode') === 'true') {
        console.log('Mobile debug - User agent:', navigator.userAgent);
        console.log('Mobile debug - Screen size:', window.screen.width + 'x' + window.screen.height);
        console.log('Mobile debug - Viewport size:', window.innerWidth + 'x' + window.innerHeight);
        console.log('Mobile debug - Touch support:', 'ontouchstart' in window);
    }
    
    const personaPanelContainer = document.createElement('div');
    personaPanelContainer.id = 'persona-panel-container';
    document.body.appendChild(personaPanelContainer);
    
    // Get the existing attach button from HTML
    const attachButton = document.getElementById('attach-button');
    if (attachButton) {
        attachButton.title = 'Attach Documents';
    }
    
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'file-input';
    fileInput.multiple = true;
    fileInput.style.display = 'none';
    fileInput.accept = '.txt,.js,.py,.json,.pdf,.docx,.html,.css,.md,.xml,.yaml,.yml,.log,.cpp,.h,.cs';
    
    const attachedDocsContainer = document.getElementById('attached-docs-container') || document.createElement('div');
    if (!document.getElementById('attached-docs-container')) {
        attachedDocsContainer.id = 'attached-docs-container';
        const inputArea = document.querySelector('.input-area');
        if (inputArea && inputArea.parentNode) {
            inputArea.parentNode.insertBefore(attachedDocsContainer, inputArea.nextSibling);
        }
    }
    
    document.body.appendChild(fileInput);
    
    const fullScreenImageViewer = document.createElement('div');
    fullScreenImageViewer.id = 'fullscreen-image-viewer';
    const fullScreenImage = document.createElement('img');
    fullScreenImage.id = 'fullscreen-image';
    fullScreenImageViewer.appendChild(fullScreenImage);
    document.body.appendChild(fullScreenImageViewer);

    // --- App State ---
    let currentPersonaPrompt = null;
    let personaCreated = false;
    let isContinuousConversationActive = false;

    // --- PWA Installation Handling ---
    let installPromptEvent = null;
    
    // Listen for PWA install availability
    window.addEventListener('pwaInstallAvailable', (e) => {
        installPromptEvent = e.detail;
        showInstallButton();
    });
    
    function showInstallButton() {
        // Only show if not already installed and prompt is available
        if (!window.matchMedia('(display-mode: standalone)').matches && installPromptEvent) {
            const installButton = document.createElement('button');
            installButton.id = 'pwa-install-button';
            installButton.innerHTML = '📱 Install App';
            installButton.className = 'install-button';
            installButton.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: #4CAF50;
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 12px;
                cursor: pointer;
                z-index: 1000;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            `;
            
            installButton.addEventListener('click', async () => {
                if (installPromptEvent) {
                    installPromptEvent.prompt();
                    const { outcome } = await installPromptEvent.userChoice;
                    console.log('PWA install outcome:', outcome);
                    if (outcome === 'accepted') {
                        installButton.remove();
                    }
                    installPromptEvent = null;
                }
            });
            
            // Only add if not already present
            if (!document.getElementById('pwa-install-button')) {
                document.body.appendChild(installButton);
                
                // Auto-hide after 10 seconds
                setTimeout(() => {
                    if (installButton.parentNode) {
                        installButton.style.opacity = '0.7';
                    }
                }, 10000);
            }
        }
    }
    
    // Detect if running as PWA
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                  window.navigator.standalone === true;
    
    if (isPWA) {
        console.log('Running as PWA - adding pwa-mode class');
        document.body.classList.add('pwa-mode');
        console.log('Body classes after PWA detection:', document.body.className);
    } else {
        console.log('Not running as PWA - regular web app mode');
    }

    // --- MCP Client Integration ---
    let mcpClient = null;
    let mcpEnabled = localStorage.getItem('mcpEnabled') === 'true';

    async function initializeMCPClient() {
        if (!mcpEnabled) return;
        
        try {
            mcpClient = new MCPClient(SETTINGS.mcpServerUrl);
            const connected = await mcpClient.connect();
            if (connected) {
                console.log('MCP Client: Successfully connected');
            } else {
                console.warn('MCP Client: Failed to connect');
                await addMessage('⚠️ Sequential Thinking MCP Server connection failed', 'system');
            }
        } catch (error) {
            console.error('MCP Client: Initialization error:', error);
            await addMessage('❌ Sequential Thinking MCP Server error: ' + error.message, 'system');
        }
    }

    // --- Mobile Viewport Height Fix - Disable for keyboard compatibility ---
    function setChatContainerHeight() {
        const chatContainer = document.querySelector('.chat-container');
        if (chatContainer) {
            // Don't adjust height dynamically to prevent keyboard issues
            // Just ensure it uses the standard viewport height
            chatContainer.style.height = '100vh';
            
            // Remove any CSS variable adjustments that cause resizing
            chatContainer.style.removeProperty('--vh');
        }
    }

    // Disable the viewport resize listeners that cause the gap issue

    // Set initial height once
    setChatContainerHeight();

    // --- Settings Configuration ---
    const SETTINGS = {
        // LLM
        customLlmProvider: localStorage.getItem('customLlmProvider') || 'litellm',
        customLlmApiUrl: (localStorage.getItem('customLlmApiUrl') || '').replace(/\/$/, ""),
        customLlmModelIdentifier: localStorage.getItem('customLlmModelIdentifier') || 'gemini2.5-flash',
        customLlmApiKey: localStorage.getItem('customLlmApiKey') || '',
        // Direct API Providers
        openaiModelIdentifier: localStorage.getItem('openaiModelIdentifier') || 'gpt-4.1-mini',
        openaiApiKey: localStorage.getItem('openaiApiKey') || '',
        anthropicModelIdentifier: localStorage.getItem('anthropicModelIdentifier') || 'claude-sonnet-4',
        anthropicApiKey: localStorage.getItem('anthropicApiKey') || '',
        googleModelIdentifier: localStorage.getItem('googleModelIdentifier') || 'gemini-2.5-flash',
        googleApiKey: localStorage.getItem('googleApiKey') || '',
        // Image
        customImageProvider: localStorage.getItem('customImageProvider') || 'openai',
        customImageApiUrl: (localStorage.getItem('customImageApiUrl') || '').replace(/\/$/, ""),
        imageSize: localStorage.getItem('imageSize') || 'auto',
        imageWidth: localStorage.getItem('imageWidth') || '1024',
        imageHeight: localStorage.getItem('imageHeight') || '1536',
        imageSteps: localStorage.getItem('imageSteps') || '20',
        imageCfgScale: localStorage.getItem('imageCfgScale') || '1.4',
        imageSampler: localStorage.getItem('imageSampler') || 'Euler a',
        // OpenAI-specific settings
        openaiQuality: localStorage.getItem('openaiQuality') || 'auto',
        openaiOutputFormat: localStorage.getItem('openaiOutputFormat') || 'png',
        openaiBackground: localStorage.getItem('openaiBackground') || 'auto',
        // SwarmUI
        swarmuiApiUrl: localStorage.getItem('swarmuiApiUrl') || 'http://localhost:7801',
        swarmuiWidth: parseInt(localStorage.getItem('swarmuiWidth') || '1024'),
        swarmuiHeight: parseInt(localStorage.getItem('swarmuiHeight') || '1024'),
        swarmuiSteps: parseInt(localStorage.getItem('swarmuiSteps') || '20'),
        swarmuiCfgScale: parseFloat(localStorage.getItem('swarmuiCfgScale') || '7.5'),
        swarmuiModel: localStorage.getItem('swarmuiModel') || '',
        swarmuiSampler: localStorage.getItem('swarmuiSampler') || 'Euler a',
        // Voice & UI
        ttsVoice: localStorage.getItem('ttsVoice') || 'Sonia',
        voiceSpeed: parseFloat(localStorage.getItem('voiceSpeed')) || 1.0,
        voicePitch: parseFloat(localStorage.getItem('voicePitch')) || 1.0,
        azureApiKey: (() => {
            const camelCase = localStorage.getItem('azureApiKey');
            const kebabCase = localStorage.getItem('azure-api-key'); 
            console.log('🔍 Azure key initialization:', {camelCase, kebabCase});
            return camelCase || kebabCase || '';
        })(),
        azureRegion: localStorage.getItem('azureRegion') || 'eastus',
        // UI
        fontSize: parseInt(localStorage.getItem('fontSize') || '16'),
        // MCP
        mcpEnabled: mcpEnabled,
        mcpServerUrl: localStorage.getItem('mcpServerUrl') || '',
        // Search
        searchEnabled: localStorage.getItem('searchEnabled') === 'true',
        searchProvider: localStorage.getItem('searchProvider') || 'brave',
        searchApiKey: localStorage.getItem('searchApiKey') || '',
        searchResultsLimit: localStorage.getItem('searchResultsLimit') || '10',
        searchAutoSummarize: localStorage.getItem('searchAutoSummarize') !== 'false',
        searchTimeFilter: localStorage.getItem('searchTimeFilter') || 'any',
    };

    // --- Service Initialization ---
    let llmService = new LLMService(
        SETTINGS.customLlmApiUrl, 
        SETTINGS.customLlmProvider, 
        SETTINGS.customLlmModelIdentifier, 
        SETTINGS.customLlmApiKey,
        {
            openaiModel: SETTINGS.openaiModelIdentifier,
            openaiApiKey: SETTINGS.openaiApiKey,
            anthropicModel: SETTINGS.anthropicModelIdentifier,
            anthropicApiKey: SETTINGS.anthropicApiKey,
            googleModel: SETTINGS.googleModelIdentifier,
            googleApiKey: SETTINGS.googleApiKey
        }
    );
    let imageService = new ImageService(
        SETTINGS.customImageProvider === 'swarmui' ? SETTINGS.swarmuiApiUrl : SETTINGS.customImageApiUrl, 
        SETTINGS.customImageProvider, 
        SETTINGS.openaiApiKey
    );
    let voiceService;
    try {
        voiceService = new VoiceService(handleSttResult, handleSttError, handleSttListeningState);
        // Make voiceService available globally for persona voice integration
        window.voiceService = voiceService;
    } catch (error) {
        console.warn('VoiceService failed to initialize:', error);
        voiceService = null;
    }
    
    // Make SETTINGS available globally for voice setting updates
    window.SETTINGS = SETTINGS;
    
    const contextService = new ContextService();
    
    if (voiceService) {
        voiceService.setVoiceRate(SETTINGS.voiceSpeed);
        voiceService.setVoicePitch(SETTINGS.voicePitch);
        
        // Set callback for updating voice dropdown when persona voice is selected
        voiceService.setVoiceDropdownCallback(updateVoiceDropdown);
        
        // Initialize Azure TTS if API key is provided
        if (SETTINGS.azureApiKey && SETTINGS.azureApiKey.trim()) {
            voiceService.setAzureConfig(SETTINGS.azureApiKey, SETTINGS.azureRegion);
        }
    }

    // Initialize MCP Client
    await initializeMCPClient();
    
    // Apply initial font size from settings
    applyFontSize(SETTINGS.fontSize);

    // --- Service Reinitialization ---
    // Ensure all services are properly configured with current settings
    async function reinitializeServicesWithCurrentSettings() {
        console.log('🔧 Reinitializing services with current settings...');
        
        // Check if ImageService needs reinitialization based on provider
        const currentImageApiUrl = imageService.apiBaseUrl;
        const expectedImageApiUrl = SETTINGS.customImageProvider === 'swarmui' ? SETTINGS.swarmuiApiUrl : SETTINGS.customImageApiUrl;
        
        console.log('🔧 Image provider check:', {
            provider: SETTINGS.customImageProvider,
            currentApiUrl: currentImageApiUrl,
            expectedApiUrl: expectedImageApiUrl,
            swarmuiApiUrl: SETTINGS.swarmuiApiUrl,
            customImageApiUrl: SETTINGS.customImageApiUrl
        });
        
        if (currentImageApiUrl !== expectedImageApiUrl || 
            imageService.provider !== SETTINGS.customImageProvider) {
            
            console.log('🔧 Image settings need reinitialization - recreating ImageService...');
            imageService = new ImageService(
                expectedImageApiUrl,
                SETTINGS.customImageProvider, 
                SETTINGS.openaiApiKey
            );
            console.log('🔧 ImageService reinitialized with:', {
                provider: SETTINGS.customImageProvider,
                apiUrl: expectedImageApiUrl
            });
        }
        
        // Always update ImageService settings to ensure all parameters are current
        imageService.updateSettings({
            // A1111 settings
            width: parseInt(SETTINGS.imageWidth) || 1024,
            height: parseInt(SETTINGS.imageHeight) || 1536,
            steps: parseInt(SETTINGS.imageSteps) || 20,
            cfg_scale: parseFloat(SETTINGS.imageCfgScale) || 1.4,
            sampler_name: SETTINGS.imageSampler || 'Euler a',
            
            // OpenAI settings
            size: SETTINGS.imageSize || 'auto',
            quality: SETTINGS.openaiQuality || 'auto',
            output_format: SETTINGS.openaiOutputFormat || 'png',
            background: SETTINGS.openaiBackground || 'auto',
            
            // SwarmUI settings - this is the critical part that was missing!
            swarm_width: parseInt(SETTINGS.swarmuiWidth) || 1024,
            swarm_height: parseInt(SETTINGS.swarmuiHeight) || 1024,
            swarm_steps: parseInt(SETTINGS.swarmuiSteps) || 20,
            swarm_cfg_scale: parseFloat(SETTINGS.swarmuiCfgScale) || 7.5,
            swarm_model: SETTINGS.swarmuiModel || null,
            swarm_sampler: SETTINGS.swarmuiSampler || 'Euler a',
            
            // Provider and API settings
            provider: SETTINGS.customImageProvider,
            openaiApiKey: SETTINGS.openaiApiKey,
            apiBaseUrl: expectedImageApiUrl
        });
        
        console.log('🔧 ImageService settings updated with current values:', {
            provider: SETTINGS.customImageProvider,
            swarmWidth: SETTINGS.swarmuiWidth,
            swarmHeight: SETTINGS.swarmuiHeight,
            swarmSteps: SETTINGS.swarmuiSteps,
            swarmCfgScale: SETTINGS.swarmuiCfgScale,
            swarmModel: SETTINGS.swarmuiModel,
            swarmSampler: SETTINGS.swarmuiSampler
        });
        
        // Check if LLMService needs reinitialization
        if (llmService.apiBaseUrl !== SETTINGS.customLlmApiUrl || 
            llmService.providerType !== SETTINGS.customLlmProvider ||
            llmService.modelIdentifier !== SETTINGS.customLlmModelIdentifier) {
            
            console.log('🔧 LLM settings need reinitialization - recreating LLMService...');
            llmService = new LLMService(
                SETTINGS.customLlmApiUrl, 
                SETTINGS.customLlmProvider, 
                SETTINGS.customLlmModelIdentifier, 
                SETTINGS.customLlmApiKey,
                {
                    openaiModel: SETTINGS.openaiModelIdentifier,
                    openaiApiKey: SETTINGS.openaiApiKey,
                    anthropicModel: SETTINGS.anthropicModelIdentifier,
                    anthropicApiKey: SETTINGS.anthropicApiKey,
                    googleModel: SETTINGS.googleModelIdentifier,
                    googleApiKey: SETTINGS.googleApiKey
                }
            );
            console.log('🔧 LLMService reinitialized');
        }
        
        // Update voice service settings
        if (voiceService) {
            voiceService.setVoiceRate(SETTINGS.voiceSpeed);
            voiceService.setVoicePitch(SETTINGS.voicePitch);
            
            if (SETTINGS.azureApiKey && SETTINGS.azureApiKey.trim()) {
                voiceService.setAzureConfig(SETTINGS.azureApiKey, SETTINGS.azureRegion);
            }
        }
        
        // Check if MCP client needs reinitialization
        const needsMCPReinit = !mcpClient || 
                              (mcpClient && mcpClient.serverUrl !== SETTINGS.mcpServerUrl) ||
                              (SETTINGS.mcpEnabled && !mcpClient);
        
        if (needsMCPReinit && SETTINGS.mcpEnabled && SETTINGS.mcpServerUrl) {
            console.log('🔧 MCP settings need reinitialization:', {
                enabled: SETTINGS.mcpEnabled,
                serverUrl: SETTINGS.mcpServerUrl,
                currentUrl: mcpClient ? mcpClient.serverUrl : 'none'
            });
            
            // Update the global mcpEnabled variable
            mcpEnabled = SETTINGS.mcpEnabled;
            
            // Reinitialize MCP client with current settings
            await initializeMCPClient();
        } else if (!SETTINGS.mcpEnabled) {
            console.log('🔧 MCP disabled in settings');
            mcpClient = null;
        }
        
        console.log('🔧 All services reinitialized with current settings');
    }
    
    // Run service reinitialization to ensure everything is properly configured
    await reinitializeServicesWithCurrentSettings();
    
    // --- Initial Settings Loading ---
    // Load settings into UI elements if settings panel is loaded
    function loadInitialSettingsToUI() {
        // This ensures that when the settings panel is opened later, 
        // it will have the correct values from localStorage
        console.log('🔧 Preparing initial settings for UI loading...');
        
        // Settings will be loaded into UI elements when the settings panel is opened
        // by loadAllSettings() function, but we ensure the SETTINGS object is current
        console.log('🔧 Current SETTINGS object ready:', {
            imageProvider: SETTINGS.customImageProvider,
            swarmuiApiUrl: SETTINGS.swarmuiApiUrl,
            customImageApiUrl: SETTINGS.customImageApiUrl,
            llmProvider: SETTINGS.customLlmProvider
        });
    }
    
    loadInitialSettingsToUI();

    // --- Proactive Settings Panel Loading ---
    // Load mobile settings panel immediately to support desktop sync
    async function ensureSettingsPanelLoaded() {
        const panelExists = settingsPanelContainer.querySelector('.settings-panel');
        if (!panelExists) {
            console.log('🔧 Proactively loading mobile settings panel for desktop sync...');
            try {
                await loadSettingsPanel();
                console.log('🔧 Mobile settings panel loaded successfully');
                
                // Verify panel was actually loaded
                const verifyPanel = settingsPanelContainer.querySelector('.settings-panel');
                if (verifyPanel) {
                    console.log('✅ Settings panel verification passed');
                } else {
                    console.error('❌ Settings panel failed verification - panel not found after load');
                }
            } catch (error) {
                console.error('🔧 Failed to load mobile settings panel:', error);
                // Don't rethrow to avoid breaking app initialization
            }
        } else {
            console.log('🔧 Mobile settings panel already exists');
        }
    }
    
    // Settings panel will be loaded after settingsIdMap is defined

    // --- Universal Font Size Management (Mobile + Desktop) ---
    function applyFontSize(fontSize) {
        const size = parseInt(fontSize);
        
        // Apply font size to both mobile and desktop chat windows
        const mobileChat = document.getElementById('chat-window');
        const desktopChat = document.getElementById('desktop-chat-window');
        
        if (mobileChat) {
            mobileChat.style.fontSize = size + 'px';
        }
        
        if (desktopChat) {
            desktopChat.style.fontSize = size + 'px';
        }
        
        // Apply to all existing messages in both interfaces
        const messages = document.querySelectorAll('.message');
        messages.forEach(message => {
            message.style.fontSize = size + 'px';
        });
        
        // Set CSS custom property for future messages
        document.documentElement.style.setProperty('--chat-font-size', size + 'px');
        
        console.log('🎨 Font size applied to all interfaces:', size + 'px');
    }

    // --- Universal Helper Functions (Mobile + Desktop) ---
    function updateVoiceDropdown(selectedVoice) {
        // Update both mobile and desktop voice dropdowns
        const mobileVoiceDropdown = document.getElementById('select-tts-voice');
        const desktopVoiceDropdown = document.getElementById('desktop-tts-voice');
        
        if (mobileVoiceDropdown) {
            mobileVoiceDropdown.value = selectedVoice;
            console.log(`Mobile voice dropdown updated to: ${selectedVoice}`);
        }
        
        if (desktopVoiceDropdown) {
            desktopVoiceDropdown.value = selectedVoice;
            console.log(`Desktop voice dropdown updated to: ${selectedVoice}`);
        }
        
        // Update the SETTINGS object to keep it in sync
        SETTINGS.ttsVoice = selectedVoice;
        
        if (!mobileVoiceDropdown && !desktopVoiceDropdown) {
            console.warn('No voice dropdowns found, cannot update UI');
        }
    }

    // --- Core Functions ---
    async function addMessage(message, sender, enableTTS = true) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${sender}-message`);
        let textToSpeak = null;
        let displayText = null;

        // Initialize SSML processor if available
        let ssmlProcessor = null;
        if (typeof SSMLProcessor !== 'undefined') {
            ssmlProcessor = new SSMLProcessor();
        }

        if (typeof message === 'string') {
            // Handle SSML processing for LLM messages
            if (sender === 'llm' && ssmlProcessor) {
                const ssmlResult = ssmlProcessor.extractSSML(message);
                if (ssmlResult.hasSSML) {
                    // Use SSML for TTS, clean text for display
                    textToSpeak = message; // Full SSML for TTS
                    displayText = ssmlResult.cleanText; // Clean text for display
                    
                    // Log SSML processing for debugging
                    ssmlProcessor.logSSMLForDebugging(ssmlResult.ssml, displayText, 'Main.js - addMessage');
                    
                    // SSML detected and processed for TTS
                } else {
                    // No SSML, use original text for both
                    textToSpeak = message;
                    displayText = message;
                }
            } else {
                // Non-LLM message or no SSML processor
                textToSpeak = message;
                displayText = message;
            }

            if (sender === 'llm' && window.marked) {
                const cleanMessage = stripMarkdownCodeBlock(displayText);
                const htmlContent = marked.parse(cleanMessage);
                messageElement.innerHTML = htmlContent;
            } else {
                messageElement.textContent = displayText;
            }
        } else if (message.type === 'image' && message.url) {
            const img = document.createElement('img');
            img.src = message.url;
            img.alt = message.alt || "Generated Image";
            img.style.cursor = 'pointer';
            img.addEventListener('click', (event) => {
                event.stopPropagation();
                fullScreenImage.src = img.src;
                fullScreenImageViewer.style.display = 'flex';
            });
            messageElement.appendChild(img);
        } else if (message.text) {
            // Handle SSML processing for text objects from LLM
            if (sender === 'llm' && ssmlProcessor) {
                const ssmlResult = ssmlProcessor.extractSSML(message.text);
                if (ssmlResult.hasSSML) {
                    textToSpeak = message.text; // Full SSML for TTS
                    displayText = ssmlResult.cleanText; // Clean text for display
                    
                    ssmlProcessor.logSSMLForDebugging(ssmlResult.ssml, displayText, 'Main.js - addMessage (text object)');
                } else {
                    textToSpeak = message.text;
                    displayText = message.text;
                }
            } else {
                textToSpeak = message.text;
                displayText = message.text;
            }

            if (sender === 'llm' && window.marked) {
                const cleanMessage = stripMarkdownCodeBlock(displayText);
                const htmlContent = marked.parse(cleanMessage);
                messageElement.innerHTML = htmlContent;
            } else {
                messageElement.textContent = displayText;
            }
        }

        chatWindow.appendChild(messageElement);
        chatWindow.scrollTop = chatWindow.scrollHeight;

        // Only enable TTS for LLM messages, never for user messages
        if (enableTTS && sender === 'llm' && textToSpeak && voiceService && voiceService.isSynthesisSupported()) {
            try {
                console.log('🎤 Starting TTS for LLM message');
                console.log(`🎤 Voice selection - Using: ${SETTINGS.ttsVoice}`);
                
                // Pass the original text (which may contain SSML) to voice service
                // The voice service will handle SSML detection and processing
                await voiceService.speak(textToSpeak, SETTINGS.ttsVoice);
                // TTS completed
            } catch (error) {
                console.error("TTS Error:", error);
            }
        } else if (sender === 'user' && textToSpeak) {
            // TTS skipped for user message
        } else if (!enableTTS && textToSpeak) {
            // TTS disabled for this message
        }
    }

    // --- Keywords List Function ---
    function generateKeywordsList() {
        return `# VeilChat Available Keywords

## 🖼️ Image Generation
- **"show me [description]"** - Generate images based on your description
  - Example: "show me a sunset over mountains"
  - Example: "show me what you look like" (generates persona image)
- **"xx [prompt]"** - Direct image generation (bypasses AI, faster)
  - Example: "xx beautiful landscape, mountains, sunset"
  - Example: "xx woman, silver hair, fantasy art"

## 🔬 Agent Research Workflow
*Comprehensive research with web search and content extraction*
- **"research [topic]"** - Full research workflow
- **"investigate [topic]"** - Same as research
- **"find out about [topic]"** - Same as research  
- **"look into [topic]"** - Same as research
- **"gather information about [topic]"** - Same as research
- **"what can you tell me about [topic]"** - Same as research
- **"learn about [topic]"** - Same as research
- **"find information about [topic]"** - Same as research
- **"search for information about [topic]"** - Same as research

*Research trigger words (can be combined with any topic):*
- **"latest [topic]"** - Research recent information
- **"current [topic]"** - Research current state
- **"recent [topic]"** - Research recent developments
- **"comprehensive [topic]"** - Research in-depth
- **"detailed [topic]"** - Research thoroughly

## 🧠 Sequential Thinking Tools
- **"break down [problem]"** - Analyze complex problems step-by-step
- **"analyze step by step [topic]"** - Same as break down
  - Example: "break down the problem of climate change"

## 🔍 Basic Web Search
*Quick search without comprehensive research*
- **"search [query]"** - Basic web search
- **"look up [query]"** - Basic web search  
- **"find [query]"** - Basic web search
  - Example: "search for Python tutorials"

## 💡 Usage Tips
- You can combine keywords with any topic
- Research workflows provide more comprehensive results than basic search
- Image generation works with detailed descriptions
- All features work with voice input when microphone is enabled

Type **"/list"** anytime to see this help again.`;
    }

    // --- Search Functions ---
    function detectSearchKeywords(message) {
        const lowerMessage = message.toLowerCase();
        
        // Agent workflow keywords that should NOT trigger basic search
        const agentKeywords = [
            'research',
            'investigate', 
            'find out about',
            'look into',
            'gather information about',
            'what can you tell me about',
            'learn about',
            'search for information about'
        ];
        
        // If message contains agent keywords, don't use basic search
        const hasAgentKeyword = agentKeywords.some(keyword => lowerMessage.includes(keyword));
        if (hasAgentKeyword) {
            return false;
        }
        
        // Specific basic search keywords (refined to avoid conflicts)
        const searchKeywords = [
            'search for',
            'search the web for',
            'look up',
            'lookup',
            'find me',
            'web search'
        ];
        
        return searchKeywords.some(keyword => lowerMessage.includes(keyword));
    }

    function extractSearchQuery(message) {
        const lowerMessage = message.toLowerCase();
        
        // Patterns to extract search queries (matching refined detectSearchKeywords)
        const patterns = [
            /search for (.+)/i,
            /search the web for (.+)/i,
            /look up (.+)/i,
            /lookup (.+)/i,
            /find me (.+)/i,
            /web search (.+)/i
        ];
        
        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
        
        // Fallback: if no pattern matches, return the whole message
        return message.trim();
    }

    async function performWebSearch(query) {
        if (!mcpClient || !mcpClient.isConnected) {
            console.log('⚠️ MCP Client not available for search');
            return null;
        }

        try {
            console.log('🔍 Performing web search for:', query);
            
            const searchSettings = {
                provider: SETTINGS.searchProvider,
                apiKey: SETTINGS.searchApiKey,
                limit: parseInt(SETTINGS.searchResultsLimit),
                timeFilter: SETTINGS.searchTimeFilter,
                autoSummarize: SETTINGS.searchAutoSummarize
            };

            const searchResult = await mcpClient.callTool('web_search', {
                query: query,
                searchSettings: searchSettings
            });

            console.log('✅ Search completed:', searchResult);
            return searchResult;
        } catch (error) {
            console.error('❌ Web search failed:', error);
            return null;
        }
    }

    async function handleUserInput() {
        // Stop STT if active
        if (voiceService && voiceService.isRecognitionActive) {
            const transcript = voiceService.stopSTT();
            console.log('STT stopped by send button, final transcript:', transcript);
        }
        
        // Clear voice service accumulated transcript when sending
        if (voiceService) {
            voiceService.accumulatedTranscript = "";
        }
        
        const message = userInput.value.trim();
        if (!message) return;

        // 🔒 SECURITY: Validate user input before processing
        const validation = window.securityValidator.validateUserInput(message, 'userMessage');
        if (!validation.isValid) {
            console.warn('🔒 Security: User input blocked due to validation failure:', validation.violations);
            window.securityValidator.logSecurityEvent('INPUT_BLOCKED', {
                message: message,
                violations: validation.violations,
                riskLevel: validation.riskLevel
            });
            
            addMessage('⚠️ Your message contains potentially unsafe content and was blocked for security reasons. Please rephrase your request.', 'system');
            return;
        }
        
        // Use sanitized input for processing
        const sanitizedMessage = validation.sanitizedInput;
        console.log('🔒 Security: Input validated and sanitized');
        
        // Update the display message to show sanitized version
        userInput.value = sanitizedMessage;

        // Check for /list command first
        if (sanitizedMessage.toLowerCase().startsWith('/list')) {
            userInput.value = '';
            
            // Reset textarea height after clearing content
            const minHeight = 44;
            userInput.style.height = minHeight + 'px';
            
            // Contract the input expansion after sending
            const inputArea = document.querySelector('.input-area');
            if (inputArea) {
                inputArea.classList.remove('expanded');
                userInput.classList.remove('expanded');
            }
            
            // Add user message to show they asked for the list
            addMessage('/list', 'user');
            
            // Display the keywords list
            addMessage(generateKeywordsList(), 'llm');
            return;
        }

        // Check for "xx" direct image prompt
        if (sanitizedMessage.toLowerCase().startsWith('xx')) {
            // Extract image prompt (remove "xx" and trim) - validate the image prompt too
            const imagePrompt = sanitizedMessage.substring(2).trim();
            
            // 🔒 SECURITY: Validate image prompt
            const imageValidation = window.securityValidator.validateUserInput(imagePrompt, 'imagePrompt');
            if (!imageValidation.isValid) {
                console.warn('🔒 Security: Image prompt blocked:', imageValidation.violations);
                addMessage('⚠️ Your image prompt contains potentially unsafe content. Please rephrase your request.', 'system');
                return;
            }
            
            if (!imagePrompt) {
                addMessage('Please provide an image prompt after "xx"', 'system');
                return;
            }
            
            userInput.value = '';
            
            // Reset textarea height after clearing content
            const minHeight = 44;
            userInput.style.height = minHeight + 'px';
            
            // Contract the input expansion after sending
            const inputArea = document.querySelector('.input-area');
            if (inputArea) {
                inputArea.classList.remove('expanded');
                userInput.classList.remove('expanded');
            }
            
            // Display user message in chat
            addMessage(sanitizedMessage, 'user');
            
            // Generate image directly (async, no LLM involved)
            try {
                addMessage('Generating image...', 'llm', false);
                const imageUrl = await imageService.generateImage(imagePrompt);
                if (imageUrl) {
                    addMessage({ type: 'image', url: imageUrl, alt: imagePrompt }, 'llm');
                } else {
                    addMessage('Image generation failed. Please check your settings.', 'llm');
                }
            } catch (error) {
                console.error('Direct image generation error:', error);
                addMessage(`Image generation error: ${error.message}`, 'llm');
            }
            
            return; // Exit early - don't process through LLM
        }

        userInput.value = '';
        
        // Reset textarea height after clearing content
        const minHeight = 44;
        userInput.style.height = minHeight + 'px';
        
        // Contract the input expansion after sending
        const inputArea = document.querySelector('.input-area');
        if (inputArea) {
            inputArea.classList.remove('expanded');
            userInput.classList.remove('expanded');
        }
        
        // Check if this is a "show me" image request - if so, don't add to conversation history
        const isImageRequest = sanitizedMessage.toLowerCase().includes("show me");
        addMessage(sanitizedMessage, 'user'); // Always show user message in chat
        if (isImageRequest) {
            console.log('📸 Image request detected - excluding from conversation history:', sanitizedMessage);
        }

        // Prepare conversation context for MCP
        const conversationContext = llmService.conversationHistory
            .map(msg => {
                const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
                return `${msg.role}: ${content}`;
            })
            .join('\n');

        // Check for search keywords FIRST (basic search has priority)
        if (SETTINGS.searchEnabled && detectSearchKeywords(sanitizedMessage)) {
            console.log('🔍 Search keywords detected in message');
            
            // Add user message to conversation history immediately for search
            if (llmService) {
                llmService.conversationHistory.push({
                    role: "user",
                    content: sanitizedMessage
                });
                console.log('📝 User message added to conversation history for search:', sanitizedMessage);
            }
            
            const searchQuery = extractSearchQuery(sanitizedMessage);
            console.log('📝 Extracted search query:', searchQuery);
            
            const searchResult = await performWebSearch(searchQuery);
            
            if (searchResult && searchResult.content && searchResult.content[0]) {
                console.log('✅ Search result received, displaying to user');
                await addMessage(searchResult.content[0].text, 'llm', false); // Disable TTS for search results
                
                // Add search result to conversation history
                if (llmService) {
                    llmService.conversationHistory.push({
                        role: "assistant",
                        content: searchResult.content[0].text
                    });
                    llmService.saveConversationHistory();
                    console.log('🔍 Search result added to conversation history');
                    
                    // Add subtle suggestion for deeper exploration (only if auto-summarize is disabled)
                    const autoSummarize = localStorage.getItem('search-auto-summarize') === 'true';
                    if (!autoSummarize && mcpClient && mcpClient.isConnected) {
                        // Check if there are URLs in the search results
                        const urls = mcpClient.extractUrlsFromMarkdown(searchResult.content[0].text);
                        if (urls.length > 0) {
                            console.log('💡 Adding subtle suggestion for web extraction');
                            setTimeout(() => {
                                addMessage('💡 *Tip: You can ask me to "tell me more about" any of these articles for detailed information.*', 'system', false);
                            }, 1000); // Small delay to let search results display first
                        }
                    }
                }
                return; // Don't proceed with normal LLM processing
            } else {
                console.log('❌ Search failed, proceeding with normal LLM processing');
                await addMessage('🔍 Search failed. Please check your search settings and try again.', 'system');
            }
        }

        // Check if MCP client should handle this message (AFTER basic search check)
        if (mcpClient && mcpClient.isConnected) {
            console.log('🔍 MCP Client is connected, checking if message should be handled...');
            try {
                const mcpResult = await mcpClient.integrateWithChat(sanitizedMessage, conversationContext, llmService);
                if (mcpResult && mcpResult.content && mcpResult.content[0]) {
                    console.log('✅ MCP handled the message');
                    
                    // Handle different result types
                    if (mcpResult.isAgentResult) {
                        // Agent workflow result - display directly with TTS enabled for synthesized content
                        await addMessage(mcpResult.content[0].text, 'llm', true);
                        console.log('🤖 Agent workflow result displayed');
                        
                        // Add to conversation history
                        if (llmService) {
                            llmService.conversationHistory.push({
                                role: "user",
                                content: sanitizedMessage
                            });
                            llmService.conversationHistory.push({
                                role: "assistant", 
                                content: mcpResult.content[0].text
                            });
                            llmService.saveConversationHistory();
                            console.log('🤖 Agent result added to conversation history');
                        }
                        return; // Exit early - agent handled everything
                    } else if (mcpResult.needsLLMProcessing) {
                        // Web extraction result - needs LLM processing
                        console.log('🔄 MCP result needs LLM processing');
                        let documentContext = mcpResult.content[0].text;
                        console.log('📄 Document context length:', documentContext.length);
                        // Continue to LLM processing below
                    } else if (mcpResult.fallback) {
                        // Agent workflow failed - continue with normal LLM
                        console.log('⚠️ Agent workflow failed, continuing with normal LLM');
                        await addMessage(mcpResult.content[0].text, 'system', false);
                        // Continue to normal LLM processing
                    } else {
                        // Regular MCP tool result (sequential thinking, etc.)
                        await addMessage(mcpResult.content[0].text, 'llm');
                        console.log('🔧 MCP tool result displayed');
                        
                        // Add to conversation history
                        if (llmService) {
                            llmService.conversationHistory.push({
                                role: "user",
                                content: sanitizedMessage
                            });
                            llmService.conversationHistory.push({
                                role: "assistant",
                                content: mcpResult.content[0].text
                            });
                            llmService.saveConversationHistory();
                            console.log('🔧 MCP tool result added to conversation history');
                        }
                        return; // Exit early
                    }
                }
            } catch (error) {
                console.error('❌ MCP Integration error:', error);
                console.log('⚠️ Continuing with normal LLM processing due to MCP error');
            }
        }

        console.log('🤖 Processing with normal LLM flow');
        // Processing with normal LLM flow
        
        const documentContext = contextService.getDocumentContext();
        // Skip adding user message for image requests, allow for normal messages
        const skipAddingUserMessage = isImageRequest;
        const response = await llmService.sendMessage(sanitizedMessage, documentContext, skipAddingUserMessage);
        
        if (response.type === 'image_request') {
            console.log("Image request detected, generating image...");
            try {
                const imageDataUrl = await imageService.generateImage(response.prompt);
                if (imageDataUrl) {
                    await addMessage({ type: 'image', url: imageDataUrl, alt: "Generated Image" }, 'llm');
                } else {
                    await addMessage("I wasn't able to generate an image this time. Please try again.", 'llm');
                }
            } catch (error) {
                console.error('Image generation failed:', error);
                await addMessage(`I tried to create an image for you, but something went wrong: ${error.message}`, 'llm');
            }
        } else if (response.type === 'text') {
            await addMessage(response.content, 'llm');
        } else if (response.type === 'error') {
            await addMessage(response.content, 'llm');
        }
    }



    function clearConversation() {
        chatWindow.innerHTML = '';
        if (llmService) {
            llmService.clearConversationHistory();
        }
        contextService.clearAllDocuments();
        updateAttachedDocsDisplay();
        currentPersonaPrompt = null;
        localStorage.removeItem('currentPersonaPrompt');
        localStorage.removeItem('draftPersonaPrompt');
        addWelcomeMessage();
    }

    function setPersonaInput(prompt) {
        const textarea = personaPanelContainer.querySelector('#persona-prompt');
        if (textarea) {
            textarea.value = prompt || '';
        }
    }

    // --- Universal Event Handling (Mobile + Desktop) ---
    function addUniversalEvent(element, eventType, handler) {
        if (!element) return;
        // Modern browsers handle touch-to-click translation well.
        // This function works for both mobile and desktop interfaces
        // by using passive: false to allow preventDefault when needed.
        element.addEventListener(eventType, handler, { passive: false });
    }
    
    // Alias for backward compatibility
    const addMobileCompatibleEvent = addUniversalEvent;

    // --- Persona Management ---
    async function createPersona(customPrompt) {
        chatWindow.innerHTML = '';
        currentPersonaPrompt = customPrompt;
        personaCreated = true;

        localStorage.removeItem('draftPersonaPrompt');
        if (customPrompt) {
            localStorage.setItem('currentPersonaPrompt', customPrompt);
        } else {
            localStorage.removeItem('currentPersonaPrompt');
        }

        llmService = new LLMService(
            SETTINGS.customLlmApiUrl, 
            SETTINGS.customLlmProvider, 
            SETTINGS.customLlmModelIdentifier, 
            SETTINGS.customLlmApiKey,
            {
                openaiModel: SETTINGS.openaiModelIdentifier,
                openaiApiKey: SETTINGS.openaiApiKey,
                anthropicModel: SETTINGS.anthropicModelIdentifier,
                anthropicApiKey: SETTINGS.anthropicApiKey,
                googleModel: SETTINGS.googleModelIdentifier,
                googleApiKey: SETTINGS.googleApiKey
            }
        );
        llmService.clearConversationHistory();
        
        contextService.clearAllDocuments();
        updateAttachedDocsDisplay();
        
        if (currentPersonaPrompt) {
            llmService.setCustomPersona(currentPersonaPrompt);
        }

        closePersonaPanel(); // Corrected function name from hidePersonaPanel
        addWelcomeMessage();

        const successMessage = customPrompt ? 'Creating custom persona...' : 'Generating random persona...';
        addMessage(successMessage, 'llm');

        try {
            console.log("Generating character profile for new persona...");
            await llmService.generateCharacterProfile();
            
            console.log("Generating initial persona image and greeting...");
            const result = await llmService.generateInitialPersonaContent();
            
            if (result.imagePrompt) {
                try {
                    const imageUrl = await imageService.generateImage(result.imagePrompt);
                    if (imageUrl) {
                        addMessage({ type: 'image', url: imageUrl, alt: "Character appearance" }, 'llm');
                    }
                } catch (imageError) {
                    console.error('Error generating persona image:', imageError);
                }
            }
            
            if (result.greeting) {
                console.log('Initial greeting generated and added to conversation history');
                
                // Check if mobile device for autoplay handling
                const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || 
                                 window.innerWidth <= 768;
                
                if (isMobile) {
                    // Mobile: Add greeting without auto-TTS due to autoplay restrictions
                    console.log('Mobile: Adding greeting without auto-TTS due to autoplay restrictions');
                    addMessage(result.greeting, 'llm', false); // false = disable TTS
                    
                    // Show prompt for user to enable audio
                    setTimeout(() => {
                        addMessage('(Tap anywhere to enable voice responses)', 'system', false);
                    }, 1000);
                    
                    // Enable TTS on user interaction
                    const enableTTSOnTouch = () => {
                        console.log('Mobile: Enabling TTS after user interaction');
                        document.removeEventListener('touchstart', enableTTSOnTouch);
                        document.removeEventListener('click', enableTTSOnTouch);
                        
                        // Remove the prompt message
                        const systemMessages = chatWindow.querySelectorAll('.message');
                        systemMessages.forEach(msg => {
                            if (msg.textContent.includes('Tap anywhere to enable')) {
                                msg.remove();
                            }
                        });
                        
                        // Re-speak the greeting now that audio is unlocked
                        if (voiceService && voiceService.isSynthesisSupported()) {
                            voiceService.speak(result.greeting, SETTINGS.ttsVoice);
                        }
                    };
                    
                    document.addEventListener('touchstart', enableTTSOnTouch, { once: true });
                    document.addEventListener('click', enableTTSOnTouch, { once: true });
                    
                } else {
                    // Desktop: Normal TTS behavior
                    addMessage(result.greeting, 'llm');
                }
            }
            
        } catch (error) {
            console.error('Error generating initial persona content:', error);
        }
    }

    function addWelcomeMessage() {
        const welcomeElement = document.createElement('div');
        welcomeElement.classList.add('message', 'welcome-message');
        welcomeElement.innerHTML = "VeilChat".split('').map((char, i) => 
            `<span class="animated-letter" style="animation-delay: ${i * 0.1}s">${char}</span>`
        ).join('');
        
        // Enhanced mobile event handling for welcome message
        const handleWelcomeInteraction = async (e) => {
            e.preventDefault();
            e.stopPropagation(); // PREVENTS the event from bubbling to the overlay
            console.log('Welcome message clicked/touched');
            
            if (!personaPanelContainer.querySelector('.persona-panel')) {
                await loadPersonaPanel();
            }
            showPersonaPanel();
        };
        
        // Add multiple event types for better mobile compatibility
        addMobileCompatibleEvent(welcomeElement, 'click', handleWelcomeInteraction);
        
        chatWindow.appendChild(welcomeElement);
        chatWindow.scrollTop = chatWindow.scrollHeight;
        
        console.log('Welcome message added to chat window');
    }

    async function loadPersonaPanel() {
        try {
            const response = await fetch('pages/persona.html');
            if (!response.ok) throw new Error(`Failed to load persona.html: ${response.statusText}`);
            const html = await response.text();

            // Parse the fetched HTML and extract only the .persona-panel element
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const panelElement = doc.querySelector('.persona-panel');

            if (panelElement) {
                personaPanelContainer.innerHTML = ''; // Clear previous content
                // Clone the node to ensure it's fully part of the main document
                personaPanelContainer.appendChild(panelElement.cloneNode(true));

                // Re-run setup for the newly added elements
                const textarea = personaPanelContainer.querySelector('#persona-prompt');
                if (textarea) {
                    textarea.value = localStorage.getItem('draftPersonaPrompt') || '';
                    textarea.addEventListener('input', (e) => localStorage.setItem('draftPersonaPrompt', e.target.value));
                }

                const createButton = personaPanelContainer.querySelector('#create-persona-button');
                const randomButton = personaPanelContainer.querySelector('#use-random-persona-button');

                if (createButton) addMobileCompatibleEvent(createButton, 'click', () => createPersona(textarea.value));
                if (randomButton) addMobileCompatibleEvent(randomButton, 'click', () => createPersona(null));

            } else {
                throw new Error('.persona-panel element not found in persona.html');
            }

        } catch (error) {
            console.error('Error loading persona panel:', error);
            personaPanelContainer.innerHTML = `<p style="color:red; text-align:center;">Error: Could not load persona creator.</p>`;
        }
    }

    // --- Sliding Panel Overlay Logic ---
    function createOverlay() {
        let overlay = document.querySelector('.overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'overlay';
            document.body.appendChild(overlay);
        }
        overlay.classList.remove('hidden');
        return overlay;
    }
    function removeOverlay() {
        const overlay = document.querySelector('.overlay');
        if (overlay) overlay.classList.add('hidden');
        setTimeout(() => {
            if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }, 300);
    }
    // --- Settings Panel Slide Up ---
    function showSettingsPanel() {
        console.log(`%c[${new Date().toLocaleTimeString()}] SHOW settings panel triggered.`, 'color: lightblue; font-weight: bold;');
        const panel = document.querySelector('#settings-panel-container .settings-panel');
        if (!panel) {
            console.warn('showSettingsPanel called, but no panel element found.');
            return;
        }
        const overlay = createOverlay();
        panel.classList.add('open');
        document.body.classList.add('panel-open');
        // Delay attaching the close handler to prevent the same click/touch event
        // that opened the panel from immediately closing it.
        setTimeout(() => {
            console.log(`%c[${new Date().toLocaleTimeString()}] ATTACHING close-on-click to overlay.`, 'color: gray;');
            overlay.onclick = function(e) {
                console.log(`%c[${new Date().toLocaleTimeString()}] OVERLAY clicked. Target:`, 'color: orange;', e.target);
                if (e.target === overlay) {
                    console.log(`%c[${new Date().toLocaleTimeString()}] Click was on overlay itself. Closing panel.`, 'color: orange; font-weight: bold;');
                    closeSettingsPanel();
                }
            };
        }, 0);
    }
    function closeSettingsPanel() {
        console.log(`%c[${new Date().toLocaleTimeString()}] CLOSE settings panel triggered.`, 'color: red; font-weight: bold;');
        console.trace("Call stack for closeSettingsPanel:"); // This will show what called the function.
        
        // Apply all settings before closing panel to ensure everything is saved
        // Settings now save automatically - no manual save needed
        
        const panel = document.querySelector('#settings-panel-container .settings-panel');
        if (!panel) {
            console.warn('closeSettingsPanel called, but no panel element found.');
            return;
        }
        panel.classList.remove('open');
        document.body.classList.remove('panel-open');
        removeOverlay();
    }
    // --- Persona Panel Slide Down ---
    function showPersonaPanel() {
        const panel = document.querySelector('#persona-panel-container .persona-panel');
        if (!panel) return;
        const overlay = createOverlay();
        panel.classList.add('open');
        document.body.classList.add('panel-open'); // ADD THIS
        // Delay attaching the close handler for the same reason as above.
        setTimeout(() => {
            overlay.onclick = function(e) {
                if (e.target === overlay) closePersonaPanel();
            };
        }, 0);
    }
    function closePersonaPanel() {
        const panel = document.querySelector('#persona-panel-container .persona-panel');
        if (!panel) return;
        panel.classList.remove('open');
        document.body.classList.remove('panel-open'); // ADD THIS
        removeOverlay();
    }


    // Persona panel open logic should be attached to wherever you open persona (e.g., a button or menu)
    // Example: document.getElementById('open-persona-btn').onclick = showPersonaPanel;
    // --- Close panels on ESC key and clear input on double ESC ---
    let lastEscapeTime = 0;
    const doubleEscapeDelay = 500; // 500ms window for double ESC
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const currentTime = Date.now();
            
            // Always close panels first
            closeSettingsPanel();
            closePersonaPanel();
            
            // Check for double ESC to clear input
            if (currentTime - lastEscapeTime < doubleEscapeDelay) {
                // Double ESC detected - clear input box
                if (userInput) {
                    userInput.value = '';
                    userInput.style.height = '44px'; // Reset height
                    console.log('Double ESC: Input box cleared');
                }
                lastEscapeTime = 0; // Reset to prevent triple ESC issues
            } else {
                // Single ESC - just update timestamp
                lastEscapeTime = currentTime;
            }
        }
    });

    // --- Universal Settings Management (Mobile + Desktop) ---
    const settingsIdMap = {
        // Mobile IDs (primary)
        customLlmProvider: 'llm-provider',
        customLlmApiUrl: 'llm-api-url',
        customLlmModelIdentifier: 'llm-model-identifier',
        customLlmApiKey: 'llm-api-key',
        openaiModelIdentifier: 'openai-model-identifier',
        openaiApiKey: 'openai-api-key',
        anthropicModelIdentifier: 'anthropic-model-identifier',
        anthropicApiKey: 'anthropic-api-key',
        googleModelIdentifier: 'google-model-identifier',
        googleApiKey: 'google-api-key',
        customImageProvider: 'image-provider',
        customImageApiUrl: 'image-api-url',
        imageSize: 'image-size',
        imageWidth: 'image-width',
        imageHeight: 'image-height',
        imageSteps: 'image-steps',
        imageCfgScale: 'image-cfg-scale',
        imageSampler: 'image-sampler',
        openaiQuality: 'openai-quality',
        openaiOutputFormat: 'openai-output-format',
        openaiBackground: 'openai-background',
        swarmuiApiUrl: 'swarmui-api-url',
        swarmuiWidth: 'swarmui-width',
        swarmuiHeight: 'swarmui-height',
        swarmuiSteps: 'swarmui-steps',
        swarmuiCfgScale: 'swarmui-cfg-scale',
        swarmuiModel: 'swarmui-model',
        swarmuiSampler: 'swarmui-sampler',
        ttsVoice: 'select-tts-voice',
        voiceSpeed: 'slider-voice-speed',
        voicePitch: 'slider-voice-pitch',
        azureApiKey: 'azure-api-key',
        azureRegion: 'azure-region',
        mcpEnabled: 'mcp-enabled',
        mcpServerUrl: 'mcp-server-url',
        searchEnabled: 'search-enabled',
        searchProvider: 'search-provider',
        searchApiKey: 'search-api-key',
        searchResultsLimit: 'search-results-limit',
        searchAutoSummarize: 'search-auto-summarize',
        searchTimeFilter: 'search-time-filter',
        fontSize: 'slider-font-size'
    };
    
    // Desktop element mapping for dual sync
    const desktopSettingsIdMap = {
        // Font Settings
        fontSize: 'desktop-font-size',
        
        // LLM Provider Settings  
        customLlmProvider: 'desktop-llm-provider',
        customLlmApiUrl: 'desktop-llm-api-url',
        customLlmModelIdentifier: 'desktop-llm-model',
        customLlmApiKey: 'desktop-llm-api-key',
        
        // Direct API Provider Settings
        openaiModelIdentifier: 'desktop-openai-model-identifier',
        openaiApiKey: 'desktop-openai-api-key',
        anthropicModelIdentifier: 'desktop-anthropic-model-identifier',
        anthropicApiKey: 'desktop-anthropic-api-key',
        googleModelIdentifier: 'desktop-google-model-identifier',
        googleApiKey: 'desktop-google-api-key',
        
        // Voice Settings
        ttsVoice: 'desktop-tts-voice',
        voiceSpeed: 'desktop-voice-speed',
        voicePitch: 'desktop-voice-pitch',
        azureApiKey: 'azure-api-key-desktop',
        azureRegion: 'desktop-azure-region',
        
        // MCP Settings
        mcpEnabled: 'desktop-mcp-enabled',
        mcpServerUrl: 'desktop-mcp-url',
        
        // Web Search Settings
        searchEnabled: 'desktop-search-enabled',
        searchProvider: 'desktop-search-provider',
        searchApiKey: 'desktop-search-api-key',
        searchResultsLimit: 'desktop-search-results-limit',
        searchAutoSummarize: 'desktop-search-auto-summarize',
        searchTimeFilter: 'desktop-search-time-filter',
        
        // Image Generation Settings
        customImageProvider: 'desktop-image-provider',
        
        // A1111 Settings
        customImageApiUrl: 'desktop-image-api-url',
        imageWidth: 'desktop-image-width',
        imageHeight: 'desktop-image-height',
        imageSteps: 'desktop-image-steps',
        imageCfgScale: 'desktop-image-cfg-scale',
        imageSampler: 'desktop-image-sampler',
        
        // SwarmUI Settings
        swarmuiApiUrl: 'desktop-swarmui-api-url',
        swarmuiWidth: 'desktop-swarmui-width',
        swarmuiHeight: 'desktop-swarmui-height',
        swarmuiSteps: 'desktop-swarmui-steps',
        swarmuiCfgScale: 'desktop-swarmui-cfg-scale',
        swarmuiModel: 'desktop-swarmui-model',
        swarmuiSampler: 'desktop-swarmui-sampler',
        
        // OpenAI Image Settings
        imageSize: 'desktop-image-size',
        openaiQuality: 'desktop-openai-quality',
        openaiOutputFormat: 'desktop-openai-output-format',
        openaiBackground: 'desktop-openai-background'
    };

    // --- Load Settings Panel Now That Mappings Are Defined ---
    // This ensures mobile settings panel is available for desktop sync
    async function initializeSettingsPanel() {
        await ensureSettingsPanelLoaded();
    }
    
    // Execute immediately but don't block the rest of initialization
    initializeSettingsPanel().catch(error => {
        console.error('Settings panel initialization failed:', error);
    });

    function saveAllSettings() {
        console.log('🔧 saveAllSettings: Starting to save settings...');
        Object.keys(SETTINGS).forEach(key => {
            const mobileElementId = settingsIdMap[key];
            const desktopElementId = desktopSettingsIdMap[key];
            
            let element = null;
            let sourceInterface = '';
            
            // Try mobile element first
            if (mobileElementId && settingsPanelContainer) {
                element = settingsPanelContainer.querySelector(`#${mobileElementId}`);
                if (element) sourceInterface = 'mobile';
            }
            
            // If not found in mobile, try desktop
            if (!element && desktopElementId) {
                element = document.getElementById(desktopElementId);
                if (element) sourceInterface = 'desktop';
            }

            if (element) {
                const value = element.type === 'checkbox' ? element.checked : element.value;
                localStorage.setItem(key, value);
                SETTINGS[key] = value;
                
                console.log(`🔧 saveAllSettings (${sourceInterface}): ${key} = ${value ? (key.includes('ApiKey') ? 'PRESENT' : value) : 'EMPTY'}`);
                
                // Sync to the other interface if available
                if (sourceInterface === 'mobile' && desktopElementId) {
                    const desktopElement = document.getElementById(desktopElementId);
                    if (desktopElement) {
                        if (desktopElement.type === 'checkbox') {
                            desktopElement.checked = element.checked;
                        } else {
                            desktopElement.value = element.value;
                        }
                    }
                } else if (sourceInterface === 'desktop' && mobileElementId && settingsPanelContainer) {
                    const mobileElement = settingsPanelContainer.querySelector(`#${mobileElementId}`);
                    if (mobileElement) {
                        if (mobileElement.type === 'checkbox') {
                            mobileElement.checked = element.checked;
                        } else {
                            mobileElement.value = element.value;
                        }
                    }
                }
            }
        });
        
        // Apply font size to all interfaces
        if (SETTINGS.fontSize) {
            applyFontSize(SETTINGS.fontSize);
        }
        
        const llmSettingsChanged = SETTINGS.customLlmApiUrl !== llmService.apiBaseUrl || 
                                   SETTINGS.customLlmModelIdentifier !== llmService.modelIdentifier || 
                                   SETTINGS.customLlmApiKey !== llmService.apiKey || 
                                   SETTINGS.customLlmProvider !== llmService.providerType ||
                                   SETTINGS.openaiModelIdentifier !== (llmService.directProviders && llmService.directProviders.openaiModel) ||
                                   SETTINGS.openaiApiKey !== (llmService.directProviders && llmService.directProviders.openaiApiKey) ||
                                   SETTINGS.anthropicModelIdentifier !== (llmService.directProviders && llmService.directProviders.anthropicModel) ||
                                   SETTINGS.anthropicApiKey !== (llmService.directProviders && llmService.directProviders.anthropicApiKey) ||
                                   SETTINGS.googleModelIdentifier !== (llmService.directProviders && llmService.directProviders.googleModel) ||
                                   SETTINGS.googleApiKey !== (llmService.directProviders && llmService.directProviders.googleApiKey);
        const imageSettingsChanged = SETTINGS.customImageApiUrl !== imageService.apiBaseUrl || 
                                      SETTINGS.customImageProvider !== imageService.provider || 
                                      SETTINGS.openaiApiKey !== imageService.openaiApiKey ||
                                      (SETTINGS.customImageProvider === 'swarmui' && SETTINGS.swarmuiApiUrl !== imageService.apiBaseUrl);
        const mcpSettingsChanged = SETTINGS.mcpEnabled !== mcpEnabled || 
                                   (mcpClient && mcpClient.serverUrl !== SETTINGS.mcpServerUrl);

        if (llmSettingsChanged) {
            console.log('🔧 saveAllSettings: LLM settings changed, recreating LLMService...');
            console.log('🔧 Provider:', SETTINGS.customLlmProvider);
            console.log('🔧 Direct providers config:', {
                openaiModel: SETTINGS.openaiModelIdentifier,
                openaiApiKey: SETTINGS.openaiApiKey ? 'PRESENT' : 'MISSING',
                anthropicModel: SETTINGS.anthropicModelIdentifier,
                anthropicApiKey: SETTINGS.anthropicApiKey ? 'PRESENT' : 'MISSING',
                googleModel: SETTINGS.googleModelIdentifier,
                googleApiKey: SETTINGS.googleApiKey ? 'PRESENT' : 'MISSING'
            });
            
            const oldHistory = llmService.conversationHistory;
            const oldInitialized = llmService.characterInitialized;
            llmService = new LLMService(
                SETTINGS.customLlmApiUrl, 
                SETTINGS.customLlmProvider, 
                SETTINGS.customLlmModelIdentifier, 
                SETTINGS.customLlmApiKey,
                {
                    openaiModel: SETTINGS.openaiModelIdentifier,
                    openaiApiKey: SETTINGS.openaiApiKey,
                    anthropicModel: SETTINGS.anthropicModelIdentifier,
                    anthropicApiKey: SETTINGS.anthropicApiKey,
                    googleModel: SETTINGS.googleModelIdentifier,
                    googleApiKey: SETTINGS.googleApiKey
                }
            );
            llmService.conversationHistory = oldHistory;
            llmService.characterInitialized = oldInitialized;
            llmService.saveConversationHistory();
            if (currentPersonaPrompt) {
                llmService.setCustomPersona(currentPersonaPrompt, true);
            }
        } else {
            // Even if LLMService doesn't need to be recreated, update direct provider configs
            llmService.updateDirectProviders({
                openaiModel: SETTINGS.openaiModelIdentifier,
                openaiApiKey: SETTINGS.openaiApiKey,
                anthropicModel: SETTINGS.anthropicModelIdentifier,
                anthropicApiKey: SETTINGS.anthropicApiKey,
                googleModel: SETTINGS.googleModelIdentifier,
                googleApiKey: SETTINGS.googleApiKey
            });
        }
        if (imageSettingsChanged) {
            imageService = new ImageService(
                SETTINGS.customImageProvider === 'swarmui' ? SETTINGS.swarmuiApiUrl : SETTINGS.customImageApiUrl, 
                SETTINGS.customImageProvider, 
                SETTINGS.openaiApiKey
            );
        }
        
        // Handle MCP settings changes
        if (mcpSettingsChanged) {
            mcpEnabled = SETTINGS.mcpEnabled;
            if (mcpEnabled) {
                // Reinitialize MCP client if enabled
                initializeMCPClient();
            } else {
                // Disconnect MCP client if disabled
                if (mcpClient) {
                    mcpClient.disconnect();
                    mcpClient = null;
                }
            }
        }
        
        imageService.updateSettings({
            size: SETTINGS.imageSize,
            width: parseInt(SETTINGS.imageWidth),
            height: parseInt(SETTINGS.imageHeight),
            steps: parseInt(SETTINGS.imageSteps),
            cfg_scale: parseFloat(SETTINGS.imageCfgScale),
            sampler_name: SETTINGS.imageSampler,
            quality: SETTINGS.openaiQuality,
            output_format: SETTINGS.openaiOutputFormat,
            background: SETTINGS.openaiBackground,
            openaiApiKey: SETTINGS.openaiApiKey,
            swarm_width: parseInt(SETTINGS.swarmuiWidth),
            swarm_height: parseInt(SETTINGS.swarmuiHeight),
            swarm_steps: parseInt(SETTINGS.swarmuiSteps),
            swarm_cfg_scale: parseFloat(SETTINGS.swarmuiCfgScale),
            swarm_model: SETTINGS.swarmuiModel,
            swarm_sampler: SETTINGS.swarmuiSampler
        });
        if (voiceService) {
            voiceService.setVoiceRate(SETTINGS.voiceSpeed);
            voiceService.setVoicePitch(SETTINGS.voicePitch);
            
            // Initialize Azure TTS if API key is provided
            if (SETTINGS.azureApiKey && SETTINGS.azureApiKey.trim()) {
                voiceService.setAzureConfig(SETTINGS.azureApiKey, SETTINGS.azureRegion);
            }
        }
    }

    // --- Universal Settings Loading (Mobile + Desktop) ---
    function setupMobileSettingsHandlers() {
        if (!settingsPanelContainer) return;
        
        console.log('📱 Setting up mobile settings handlers...');
        
        // Load settings from localStorage into mobile interface
        Object.keys(settingsIdMap).forEach(settingsKey => {
            const mobileId = settingsIdMap[settingsKey];
            const element = settingsPanelContainer.querySelector(`#${mobileId}`);
            
            if (element) {
                let value = localStorage.getItem(settingsKey);
                
                // Special handling for Azure API key fallback
                if (settingsKey === 'azureApiKey' && (!value || value === '')) {
                    value = localStorage.getItem('azure-api-key') || '';
                }
                
                // Load value into element
                if (element.type === 'checkbox') {
                    element.checked = value === 'true' || value === true;
                } else if (element.type === 'range') {
                    element.value = value || element.defaultValue || '1';
                } else {
                    element.value = value || '';
                }
                
                // Setup save handlers
                const saveHandler = () => {
                    const currentValue = element.type === 'checkbox' ? element.checked : element.value;
                    localStorage.setItem(settingsKey, currentValue);
                    if (window.SETTINGS) {
                        window.SETTINGS[settingsKey] = currentValue;
                    }
                    console.log(`💾 Mobile saved: ${settingsKey} = ${currentValue ? (settingsKey.includes('ApiKey') ? 'PRESENT' : currentValue) : 'EMPTY'}`);
                };
                
                element.addEventListener('change', saveHandler);
                element.addEventListener('input', saveHandler);
            }
        });
    }

    function loadAllSettings() {
        console.log('🔧 loadAllSettings: Loading settings to all interfaces...');
        
        Object.keys(SETTINGS).forEach(key => {
            const mobileElementId = settingsIdMap[key];
            const desktopElementId = desktopSettingsIdMap[key];
            const storedValue = SETTINGS[key];
            
            // Load into mobile interface
            if (mobileElementId && settingsPanelContainer) {
                const mobileElement = settingsPanelContainer.querySelector(`#${mobileElementId}`);
                if (mobileElement) {
                    if (mobileElement.type === 'checkbox') {
                        mobileElement.checked = storedValue === true || storedValue === 'true';
                    } else {
                        mobileElement.value = storedValue;
                    }
                }
            }
            
            // Load into desktop interface
            if (desktopElementId) {
                const desktopElement = document.getElementById(desktopElementId);
                if (desktopElement) {
                    if (desktopElement.type === 'checkbox') {
                        desktopElement.checked = storedValue === true || storedValue === 'true';
                    } else {
                        desktopElement.value = storedValue;
                    }
                    
                    // Trigger any display updates for sliders
                    if (desktopElement.type === 'range') {
                        desktopElement.dispatchEvent(new Event('input'));
                    }
                }
            }
        });
        
        // Apply font size to all interfaces
        applyFontSize(SETTINGS.fontSize);
        
        console.log('🔧 loadAllSettings: Settings loaded to all available interfaces');
    }

    function setupImageControls() {
        const container = settingsPanelContainer;
        if (!container) return;

        const imageProviderSelect = container.querySelector('#image-provider');
        const a1111Settings = container.querySelector('.a1111-settings');
        const openaiSettings = container.querySelector('.openai-settings');
        const swarmuiSettings = container.querySelector('.swarmui-settings');

        function toggleProviderSettings() {
            if (!imageProviderSelect || !a1111Settings || !openaiSettings || !swarmuiSettings) return;
            
            const provider = imageProviderSelect.value;

            // Hide all settings first
            a1111Settings.style.display = 'none';
            openaiSettings.style.display = 'none';
            swarmuiSettings.style.display = 'none';

            // Show the selected provider's settings
            if (provider === 'openai') {
                openaiSettings.style.display = 'block';
            } else if (provider === 'swarmui') {
                swarmuiSettings.style.display = 'block';
            } else { // a1111
                a1111Settings.style.display = 'block';
            }
        }

        if (imageProviderSelect) {
            imageProviderSelect.addEventListener('change', toggleProviderSettings);
            toggleProviderSettings(); // Initial call to set the correct state on load
        }
    }

    function toggleModelIdentifierVisibility() {
        const container = settingsPanelContainer;
        if (!container) return;

        const llmProviderSelect = container.querySelector('#llm-provider');
        const modelIdentifierItem = container.querySelector('#model-identifier-item');
        const apiKeyItem = container.querySelector('#api-key-item');
        const llmApiUrlItem = container.querySelector('#llm-api-url').parentElement;
        
        // Direct provider settings
        const openaiDirectSettings = container.querySelector('.openai-direct-settings');
        const anthropicDirectSettings = container.querySelector('.anthropic-direct-settings');
        const googleDirectSettings = container.querySelector('.google-direct-settings');

        function toggleVisibility() {
            if (!llmProviderSelect) return;
            const provider = llmProviderSelect.value;
            
            // Hide all direct provider settings first
            if (openaiDirectSettings) openaiDirectSettings.style.display = 'none';
            if (anthropicDirectSettings) anthropicDirectSettings.style.display = 'none';
            if (googleDirectSettings) googleDirectSettings.style.display = 'none';
            
            // Handle traditional provider settings visibility
            if (provider === 'openai-direct') {
                // Hide traditional settings, show OpenAI direct settings
                if (modelIdentifierItem) modelIdentifierItem.style.display = 'none';
                if (apiKeyItem) apiKeyItem.style.display = 'none';
                if (llmApiUrlItem) llmApiUrlItem.style.display = 'none';
                if (openaiDirectSettings) openaiDirectSettings.style.display = 'block';
            } else if (provider === 'anthropic-direct') {
                // Hide traditional settings, show Anthropic direct settings
                if (modelIdentifierItem) modelIdentifierItem.style.display = 'none';
                if (apiKeyItem) apiKeyItem.style.display = 'none';
                if (llmApiUrlItem) llmApiUrlItem.style.display = 'none';
                if (anthropicDirectSettings) anthropicDirectSettings.style.display = 'block';
            } else if (provider === 'google-direct') {
                // Hide traditional settings, show Google direct settings
                if (modelIdentifierItem) modelIdentifierItem.style.display = 'none';
                if (apiKeyItem) apiKeyItem.style.display = 'none';
                if (llmApiUrlItem) llmApiUrlItem.style.display = 'none';
                if (googleDirectSettings) googleDirectSettings.style.display = 'block';
            } else {
                // Traditional providers - show traditional settings
                if (llmApiUrlItem) llmApiUrlItem.style.display = 'flex';
                if (apiKeyItem) apiKeyItem.style.display = 'flex';
                
                // LMStudio uses a path, not a model identifier from a list
                if (provider === 'lmstudio') {
                    if (modelIdentifierItem) modelIdentifierItem.style.display = 'none';
                } else {
                    if (modelIdentifierItem) modelIdentifierItem.style.display = 'flex';
                }
            }
        }

        if (llmProviderSelect) {
            llmProviderSelect.addEventListener('change', toggleVisibility);
            toggleVisibility(); // Initial call to set state
        }
    }


    async function loadSettingsPanel() {
        try {
            const response = await fetch('pages/user-settings.html');
            if (!response.ok) throw new Error(`Failed to load user-settings.html: ${response.statusText}`);
            const html = await response.text();

            // Parse the fetched HTML and extract only the .settings-panel element
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const panelElement = doc.querySelector('.settings-panel');

            if (panelElement) {
                settingsPanelContainer.innerHTML = ''; // Clear previous content
                // Clone the node to ensure it's fully part of the main document
                settingsPanelContainer.appendChild(panelElement.cloneNode(true));

                // Initialize all settings values from localStorage
                Object.keys(SETTINGS).forEach(key => {
                    const elementId = settingsIdMap[key];
                    if (!elementId) return;

                    const element = settingsPanelContainer.querySelector(`#${elementId}`);
                    if (element) {
                        if (element.type === 'checkbox') {
                            element.checked = SETTINGS[key] === true || SETTINGS[key] === 'true';
                        } else {
                            element.value = SETTINGS[key];
                        }
                    }
                });


                // Re-run setup for the newly added elements
                setupImageControls();
                toggleModelIdentifierVisibility();

                // Setup simple localStorage-based mobile settings
                setupMobileSettingsHandlers();

                // Add specific event listeners for voice sliders to update display values
                const voiceSpeedSlider = settingsPanelContainer.querySelector('#slider-voice-speed');
                const voiceSpeedValue = settingsPanelContainer.querySelector('#voice-speed-value');
                const voicePitchSlider = settingsPanelContainer.querySelector('#slider-voice-pitch');
                const voicePitchValue = settingsPanelContainer.querySelector('#voice-pitch-value');

                if (voiceSpeedSlider && voiceSpeedValue) {
                    voiceSpeedSlider.addEventListener('input', () => {
                        voiceSpeedValue.textContent = voiceSpeedSlider.value + 'x';
                    });
                }

                if (voicePitchSlider && voicePitchValue) {
                    voicePitchSlider.addEventListener('input', () => {
                        voicePitchValue.textContent = voicePitchSlider.value;
                    });
                }
                
                // Font Size slider functionality
                const fontSizeSlider = settingsPanelContainer.querySelector('#slider-font-size');
                const fontSizeValue = settingsPanelContainer.querySelector('#font-size-value');
                
                if (fontSizeSlider && fontSizeValue) {
                    // Apply current font size on load
                    applyFontSize(fontSizeSlider.value);
                    fontSizeValue.textContent = fontSizeSlider.value + 'px';
                    
                    fontSizeSlider.addEventListener('input', () => {
                        const fontSize = fontSizeSlider.value;
                        fontSizeValue.textContent = fontSize + 'px';
                        applyFontSize(fontSize);
                        
                        // Save to localStorage immediately for font size changes
                        localStorage.setItem('fontSize', fontSize);
                        SETTINGS.fontSize = parseInt(fontSize);
                    });
                }


                // Add event listeners for save/load conversation buttons
                const saveButton = settingsPanelContainer.querySelector('#save-conversation-button');
                const loadButton = settingsPanelContainer.querySelector('#load-conversation-button');
                const loadInput = settingsPanelContainer.querySelector('#load-conversation-input');

                if (saveButton) addMobileCompatibleEvent(saveButton, 'click', saveConversationToFile);
                if (loadButton) addMobileCompatibleEvent(loadButton, 'click', () => loadInput.click());
                if (loadInput) loadInput.addEventListener('change', loadConversationFromFile);

            } else {
                throw new Error('.settings-panel element not found in user-settings.html');
            }

        } catch (error) {
            console.error('Error loading settings panel:', error);
            settingsPanelContainer.innerHTML = `
                <div style="color: red; text-align: center; padding: 20px; background: rgba(255,0,0,0.1); border-radius: 8px; margin: 20px;">
                    <h3>Settings Loading Error</h3>
                    <p>Could not load settings panel: ${error.message}</p>
                    <p style="font-size: 12px; opacity: 0.8;">Check console for details</p>
                </div>`;
        }
    }

    // Function to sync settings from localStorage to desktop elements
    function syncSettingsToDesktop() {
        if (!window.desktopInterface) {
            console.log('Desktop interface not available, skipping sync');
            return;
        }
        
        console.log('=== Starting Desktop Settings Sync ===');
        console.log('Current SETTINGS object:', SETTINGS);
        
        // Debug localStorage keys for Azure
        console.log('Azure debugging:');
        console.log('  localStorage.azureApiKey:', localStorage.getItem('azureApiKey'));
        console.log('  localStorage.azureAPIKey:', localStorage.getItem('azureAPIKey'));
        console.log('  localStorage["azure-api-key"]:', localStorage.getItem('azure-api-key'));
        console.log('  SETTINGS.azureApiKey:', SETTINGS.azureApiKey);
        
        let syncCount = 0;
        let missingElements = 0;
        
        // Sync each setting from localStorage to its corresponding desktop element
        Object.keys(desktopSettingsIdMap).forEach(settingKey => {
            const desktopElementId = desktopSettingsIdMap[settingKey];
            const desktopElement = document.getElementById(desktopElementId);
            const value = SETTINGS[settingKey];
            
            console.log(`Checking ${settingKey}: value="${value}", element=${!!desktopElement}`);
            
            if (desktopElement && value !== undefined && value !== null && value !== '') {
                if (desktopElement.type === 'checkbox') {
                    desktopElement.checked = (value === true || value === 'true');
                    console.log(`✅ Synced checkbox ${settingKey} = ${desktopElement.checked}`);
                } else if (desktopElement.type === 'range') {
                    desktopElement.value = value;
                    // Trigger display update for range sliders
                    const displayElement = document.getElementById(desktopElementId + '-value');
                    if (displayElement) {
                        if (settingKey === 'fontSize') {
                            displayElement.textContent = value + 'px';
                        } else if (settingKey === 'voiceSpeed') {
                            displayElement.textContent = value + 'x';
                        } else if (settingKey === 'voicePitch') {
                            displayElement.textContent = value;
                        }
                    }
                    console.log(`✅ Synced range ${settingKey} = ${value}`);
                } else {
                    desktopElement.value = value;
                    console.log(`✅ Synced input ${settingKey} = "${value}"`);
                }
                syncCount++;
            } else if (!desktopElement) {
                console.warn(`❌ Desktop element not found: ${desktopElementId}`);
                missingElements++;
            } else if (value === undefined || value === null || value === '') {
                console.log(`⚠️  Empty value for ${settingKey}: "${value}"`);
            }
        });

        console.log(`Synced ${syncCount} settings, ${missingElements} elements missing`);

        // Trigger provider-specific section visibility updates
        const providerElement = document.getElementById('desktop-llm-provider');
        if (providerElement && window.desktopInterface) {
            console.log(`Updating provider sections for: ${providerElement.value}`);
            window.desktopInterface.toggleProviderSections(providerElement.value);
        }

        const imageProviderElement = document.getElementById('desktop-image-provider');
        if (imageProviderElement && window.desktopInterface) {
            console.log(`Updating image provider sections for: ${imageProviderElement.value}`);
            window.desktopInterface.toggleImageProviderSections(imageProviderElement.value);
        }
        
        console.log('=== Desktop Settings Sync Completed ===');
    }

    // Make the sync function available globally for desktop interface
    window.syncSettingsToDesktop = syncSettingsToDesktop;

    // --- Voice Service Handlers ---
    function handleSttResult(text) { 
        userInput.value = text; 
        // Trigger auto-resize manually since direct value assignment doesn't fire 'input' event
        const autoResizeEvent = new Event('input');
        userInput.dispatchEvent(autoResizeEvent);
    }
    function handleSttError(error) { console.error("STT Error:", error); isContinuousConversationActive = false; }
    function handleSttListeningState(isListening) {
        if (micButton) {
            micButton.textContent = isListening ? '🎤' : '🎤';
            micButton.classList.toggle('recording', isListening);
        }
        
        // Expand/contract input area based on STT state
        const inputArea = document.querySelector('.input-area');
        if (inputArea && userInput) {
            if (isListening) {
                // Expand input area when STT starts (same as click/focus behavior)
                inputArea.classList.add('expanded');
                userInput.classList.add('expanded');
                userInput.focus(); // Also focus to show cursor and enable text editing
                console.log('Input expanded for STT');
            } else {
                // Contract input area when STT stops (only if input is empty)
                if (userInput.value.trim() === '') {
                    inputArea.classList.remove('expanded');
                    userInput.classList.remove('expanded');
                    userInput.style.height = '44px'; // Reset height
                    console.log('Input contracted after STT');
                }
                // If input has content, leave it expanded so user can see/edit
            }
        }
    }

    // --- Document Attachment Functions ---
    async function handleFileAttachment(event) {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        console.log('Files selected:', files.map(f => f.name));

        try {
            const results = await contextService.processFiles(files);
            
            let successCount = 0;
            let errorMessages = [];

            results.forEach(result => {
                if (result.success) {
                    successCount++;
                } else {
                    errorMessages.push(`${result.fileName}: ${result.error}`);
                }
            });

            updateAttachedDocsDisplay();

            if (successCount > 0) {
                const successMessage = `📎 Attached ${successCount} document(s): ${contextService.getDocumentSummary()}`;
                await addMessage(successMessage, 'system');
                console.log('Successfully attached documents:', contextService.getAttachedDocuments());
            }

            if (errorMessages.length > 0) {
                const errorMessage = `❌ Failed to attach some documents:\n${errorMessages.join('\n')}`;
                await addMessage(errorMessage, 'system');
            }

        } catch (error) {
            console.error('File attachment error:', error);
            await addMessage(`❌ Error processing files: ${error.message}`, 'system');
        }

        fileInput.value = '';
    }

    function updateAttachedDocsDisplay() {
        const docs = contextService.getAttachedDocuments();
        
        if (docs.length === 0) {
            attachedDocsContainer.style.display = 'none';
            return;
        }

        attachedDocsContainer.style.display = 'block';
        attachedDocsContainer.innerHTML = `
            <div class="attached-docs-list">
                ${docs.map(doc => `
                    <div class="attached-doc-item">
                        <span class="doc-name" title="${doc.name}">${doc.name}</span>
                        <button class="remove-doc-btn" data-doc-id="${doc.id}" title="Remove">×</button>
                    </div>
                `).join('')}
            </div>
        `;

        // Attach event listeners to the remove buttons
        attachedDocsContainer.querySelectorAll('.remove-doc-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const docId = btn.getAttribute('data-doc-id');
                removeDocument(docId);
            });
        });
    }

    function removeDocument(documentId) {
        contextService.removeDocument(documentId);
        updateAttachedDocsDisplay();
    }

    function clearAllDocuments() {
        contextService.clearAllDocuments();
        updateAttachedDocsDisplay();
    }

    window.removeDocument = removeDocument;
    window.clearAllDocuments = clearAllDocuments;
    
    // Add SSML style guide access for debugging
    window.printSSMLStyles = () => {
        if (typeof SSMLProcessor !== 'undefined') {
            const processor = new SSMLProcessor();
            processor.printStyleGuide();
        } else {
            console.error('SSML Processor not available');
        }
    };

    // --- Enhanced Event Listeners for Mobile ---
    addMobileCompatibleEvent(sendButton, 'click', handleUserInput);
    
    addMobileCompatibleEvent(fullScreenImageViewer, 'click', () => {
        fullScreenImageViewer.style.display = 'none';
    });
    
    if (attachButton) {
        addMobileCompatibleEvent(attachButton, 'click', (e) => {
            e.preventDefault();
            console.log('Attach button clicked/touched');
            fileInput.click();
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', handleFileAttachment);
    }
    
    addMobileCompatibleEvent(settingsButton, 'click', async (e) => {
        e.preventDefault();
        e.stopPropagation(); // PREVENTS the event from bubbling to the overlay
        console.log('Settings button clicked/touched');
        
        const panelExists = settingsPanelContainer.querySelector('.settings-panel');
        console.log(`%c[DEBUG] Checking for panel... Panel exists? ${!!panelExists}`, 'color: purple;');

        if (!panelExists) {
            console.log('%c[DEBUG] Panel does NOT exist. Loading now...', 'color: orange;');
            await loadSettingsPanel();
        } else {
            console.log('%c[DEBUG] Panel already exists. Reloading settings from localStorage.', 'color: green;');
            // Reload mobile settings from localStorage when reopening panel
            if (typeof setupMobileSettingsHandlers === 'function') {
                setupMobileSettingsHandlers();
            }
        }
        showSettingsPanel();
    });

    if (micButton && voiceService && voiceService.isRecognitionSupported()) {
        addMobileCompatibleEvent(micButton, 'click', (e) => {
            e.preventDefault();
            console.log('Mic button clicked/touched - toggling STT');
            voiceService.toggleSTT();
        });
    } else if (micButton) {
        micButton.style.display = 'none';
    }

    // --- Input Expansion Functionality ---
    function setupInputExpansion() {
        const inputArea = document.querySelector('.input-area');
        const userInput = document.getElementById('user-input');
        
        if (!inputArea || !userInput) return;
        
        // Expand on focus/click
        userInput.addEventListener('focus', () => {
            inputArea.classList.add('expanded');
            userInput.classList.add('expanded');
            console.log('Input expanded');
        });
        
        userInput.addEventListener('click', () => {
            console.log('Click event fired! Input area expanded:', inputArea.classList.contains('expanded'));
            console.log('Body has pwa-mode class:', document.body.classList.contains('pwa-mode'));
            
            if (!inputArea.classList.contains('expanded')) {
                inputArea.classList.add('expanded');
                userInput.classList.add('expanded');
                userInput.focus();
                console.log('Input expanded on click - classes added');
                console.log('Input area classes:', inputArea.className);
                console.log('User input classes:', userInput.className);
                
                // Force a style recalculation to ensure PWA styles apply
                setTimeout(() => {
                    inputArea.style.display = 'flex'; // Trigger reflow
                    console.log('Forced style recalculation');
                }, 10);
            } else {
                console.log('Input was already expanded');
            }
        });
        
        // Contract when clicking outside or on specific conditions
        document.addEventListener('click', (e) => {
            // Don't contract if clicking on input, send button, or if input has content
            if (e.target === userInput || 
                e.target === document.getElementById('send-button') ||
                userInput.value.trim() !== '') {
                return;
            }
            
            // Contract the input
            inputArea.classList.remove('expanded');
            userInput.classList.remove('expanded');
            console.log('Input contracted');
        });
        
        // Also contract on blur, but only if input is empty
        userInput.addEventListener('blur', (e) => {
            // Small delay to allow for send button click
            setTimeout(() => {
                if (userInput.value.trim() === '' && 
                    document.activeElement !== userInput) {
                    inputArea.classList.remove('expanded');
                    userInput.classList.remove('expanded');
                    // Reset height when contracting
                    userInput.style.height = '44px';
                    console.log('Input contracted on blur');
                }
            }, 150);
        });
    }

    // Call this function in your initializeApp function, after DOM elements are ready
    setupInputExpansion();

    // Call mobile and textarea setup functions ONCE.
    setupMobileInputExpansion();
    setupTextareaAutoResize();

    // --- Mobile Touch Enhancement for Input Expansion ---
    function setupMobileInputExpansion() {
        const inputArea = document.querySelector('.input-area');
        const userInput = document.getElementById('user-input');
        
        if (!inputArea || !userInput) return;
        
        // Handle touch events for better mobile experience
        userInput.addEventListener('touchstart', (e) => {
            if (!inputArea.classList.contains('expanded')) {
                e.preventDefault(); // Prevent double-tap zoom
                inputArea.classList.add('expanded');
                userInput.classList.add('expanded');
                userInput.focus();
                console.log('Input expanded on touch');
            }
        }, { passive: false });
        
        // Handle orientation changes
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                if (inputArea.classList.contains('expanded')) {
                    userInput.focus();
                    // Recalculate textarea height after orientation change
                    const autoResizeEvent = new Event('input');
                    userInput.dispatchEvent(autoResizeEvent);
                }
            }, 500);
        });
    }

    // --- Auto-resize Textarea Functionality ---
    function setupTextareaAutoResize() {
        const userInput = document.getElementById('user-input');
        
        if (!userInput) {
            console.error('User input element not found for auto-resize setup');
            return;
        }
        
        console.log('Setting up textarea auto-resize for element:', userInput.tagName);
        
        // Auto-resize function
        function autoResize() {
            // Reset height to calculate the true content height
            userInput.style.height = 'auto';
            
            // Get the scroll height (the height needed to show all content)
            const scrollHeight = userInput.scrollHeight;
            
            // Set minimum height based on screen size
            const minHeight = 44;
            
            // Calculate new height
            const newHeight = Math.max(minHeight, scrollHeight);
            
            // Apply the new height
            userInput.style.height = newHeight + 'px';
            
            // Scroll chat window to bottom when input expands
            const chatWindow = document.getElementById('chat-window');
            if (chatWindow) {
                chatWindow.scrollTop = chatWindow.scrollHeight;
            }
            
            console.log('Textarea resized to:', newHeight + 'px');
        }
        
        // Add event listeners for auto-resize
        userInput.addEventListener('input', (e) => {
            // Speech is already stopped by focus/touchstart events
            autoResize();
        });
        
        // Stop TTS on multiple interaction types with debugging  
        userInput.addEventListener('touchstart', (e) => {
            console.log('TouchStart: Event fired! voiceService available:', !!window.voiceService);
            if (window.voiceService && window.voiceService.stopSpeaking) {
                console.log('TouchStart: Calling stopSpeaking()');
                window.voiceService.stopSpeaking();
            } else {
                console.log('TouchStart: voiceService.stopSpeaking not available');
            }
        }, { passive: true });
        
        userInput.addEventListener('mousedown', (e) => {
            if (window.voiceService && window.voiceService.stopSpeaking) {
                window.voiceService.stopSpeaking();
            } else {
                console.log('MouseDown: voiceService.stopSpeaking not available');
            }
        });
        
        userInput.addEventListener('focus', (e) => {
            if (window.voiceService && window.voiceService.stopSpeaking) {
                window.voiceService.stopSpeaking();
            } else {
                console.log('Focus: voiceService.stopSpeaking not available');
            }
        });
        userInput.addEventListener('paste', () => {
            setTimeout(autoResize, 50);
        });
        
        // Handle Enter key behavior
        userInput.addEventListener('keydown', (e) => {
            // Speech is already stopped by focus/touchstart events
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleUserInput();
            }
            if (e.key === 'Enter' && e.shiftKey) {
                setTimeout(autoResize, 10);
            }
        });
        
        // Reset height when input is cleared
        userInput.addEventListener('blur', () => {
            if (userInput.value.trim() === '') {
                userInput.style.height = '44px';
            }
        });
        
        // Handle window resize for responsive behavior
        window.addEventListener('resize', () => {
            setTimeout(autoResize, 100);
        });
        
        // Initial resize call
        setTimeout(autoResize, 100);
    }

    // --- Load saved persona on startup ---
    currentPersonaPrompt = localStorage.getItem('currentPersonaPrompt');
    if (currentPersonaPrompt) {
        personaCreated = true;
        
        if (!LLMService.hasSavedConversation()) {
            llmService.setCustomPersona(currentPersonaPrompt);
            
            setTimeout(async () => {
                try {
                    console.log("Generating character profile for restored persona...");
                    await llmService.generateCharacterProfile();
                    
                    console.log("Generating initial content for restored persona...");
                    const personaContent = await llmService.generateInitialPersonaContent();
                    
                    if (personaContent.imagePrompt) {
                        try {
                            const imageUrl = await imageService.generateImage(personaContent.imagePrompt);
                            if (imageUrl) {
                                addMessage({ type: 'image', url: imageUrl, alt: "Character appearance" }, 'llm');
                            }
                        } catch (imageError) {
                            console.error('Error generating persona image on startup:', imageError);
                        }
                    }
                    
                    if (personaContent.greeting) {
                        // Check if mobile device for autoplay handling
                        const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || 
                                         window.innerWidth <= 768;
                        
                        if (isMobile) {
                            // Mobile: Add greeting without auto-TTS due to autoplay restrictions
                            console.log('Mobile: Adding restored greeting without auto-TTS due to autoplay restrictions');
                            addMessage(personaContent.greeting, 'llm', false); // false = disable TTS
                            
                            setTimeout(() => {
                                addMessage('(Tap anywhere to enable voice responses)', 'system', false);
                            }, 1000);
                            
                            // Enable TTS on user interaction
                            const enableTTSOnTouch = () => {
                                console.log('Mobile: Enabling TTS after user interaction for restored persona');
                                document.removeEventListener('touchstart', enableTTSOnTouch);
                                document.removeEventListener('click', enableTTSOnTouch);
                                
                                // Remove the prompt
                                const systemMessages = chatWindow.querySelectorAll('.message');
                                systemMessages.forEach(msg => {
                                    if (msg.textContent.includes('Tap anywhere to enable')) {
                                        msg.remove();
                                    }
                                });
                                
                                // Re-speak the greeting
                                if (voiceService && voiceService.isSynthesisSupported()) {
                                    voiceService.speak(personaContent.greeting, SETTINGS.ttsVoice);
                                }
                            };
                            
                            document.addEventListener('touchstart', enableTTSOnTouch, { once: true });
                            document.addEventListener('click', enableTTSOnTouch, { once: true });
                            
                        } else {
                            // Desktop: Normal TTS behavior
                            addMessage(personaContent.greeting, 'llm');
                        }
                    }
                    
                } catch (error) {
                    console.error('Error generating initial content on startup:', error);
                }
            }, 1000);
        }
    }

    addWelcomeMessage();

    if (LLMService.hasSavedConversation()) {
        console.log('Full conversation history loaded:', llmService.conversationHistory.length, 'messages');
    }

    // --- Conversation save/load functions ---
    function saveConversationToFile() {
        const conversationState = {
            version: "1.0",
            savedAt: new Date().toISOString(),
            personaPrompt: currentPersonaPrompt,
            llmServiceState: {
                conversationHistory: llmService.conversationHistory,
                characterInitialized: llmService.characterInitialized
            },
            documentContext: contextService.exportContext()
        };

        const jsonString = JSON.stringify(conversationState, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().slice(0, 10);
        a.download = `veil-conversation-${date}.json`;
        document.body.appendChild(a);
        a.click();

        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log("Conversation saved to file.");
    }

    function loadConversationFromFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const loadedState = JSON.parse(e.target.result);

                if (!loadedState.llmServiceState || !loadedState.llmServiceState.conversationHistory) {
                    throw new Error("Invalid conversation file format.");
                }

                // 🔒 SECURITY: Validate and sanitize loaded conversation history
                const originalHistory = loadedState.llmServiceState.conversationHistory;
                const sanitizedHistory = [];
                let blockedMessages = 0;
                
                for (const message of originalHistory) {
                    if (message && message.content) {
                        // Validate message content using SecurityValidator
                        const validation = window.securityValidator.validateUserInput(
                            message.content, 
                            'userMessage'
                        );
                        
                        if (!validation.isValid) {
                            console.warn('🔒 Security: Blocked malicious content in loaded conversation:', validation.violations);
                            window.securityValidator.logSecurityEvent('CONVERSATION_LOAD_BLOCKED', {
                                messageRole: message.role,
                                violations: validation.violations,
                                riskLevel: validation.riskLevel
                            });
                            blockedMessages++;
                            
                            // Replace with sanitized placeholder
                            sanitizedHistory.push({
                                role: message.role,
                                content: '[Message blocked for security - contained potentially malicious content]',
                                timestamp: message.timestamp || new Date().toISOString()
                            });
                        } else {
                            // Use sanitized content
                            sanitizedHistory.push({
                                ...message,
                                content: validation.sanitizedInput
                            });
                        }
                    } else {
                        // Keep non-content messages as-is (but still copy to avoid reference issues)
                        sanitizedHistory.push({...message});
                    }
                }

                if (blockedMessages > 0) {
                    console.warn(`🔒 Security: ${blockedMessages} messages blocked during conversation load`);
                    addMessage(`⚠️ Security notice: ${blockedMessages} messages were blocked for containing potentially malicious content.`, 'system');
                }

                // Validate persona prompt if present
                let sanitizedPersonaPrompt = loadedState.personaPrompt || null;
                if (sanitizedPersonaPrompt) {
                    const personaValidation = window.securityValidator.validateUserInput(
                        sanitizedPersonaPrompt, 
                        'characterPrompt'
                    );
                    
                    if (!personaValidation.isValid) {
                        console.warn('🔒 Security: Blocked malicious persona prompt in loaded conversation');
                        window.securityValidator.logSecurityEvent('PERSONA_LOAD_BLOCKED', {
                            violations: personaValidation.violations,
                            riskLevel: personaValidation.riskLevel
                        });
                        sanitizedPersonaPrompt = null;
                        addMessage('⚠️ Security notice: Persona prompt was blocked for containing potentially malicious content.', 'system');
                    } else {
                        sanitizedPersonaPrompt = personaValidation.sanitizedInput;
                    }
                }

                currentPersonaPrompt = sanitizedPersonaPrompt;
                llmService.conversationHistory = sanitizedHistory;
                llmService.characterInitialized = loadedState.llmServiceState.characterInitialized;

                if (loadedState.documentContext) {
                    const imported = contextService.importContext(loadedState.documentContext);
                    if (imported) {
                        updateAttachedDocsDisplay();
                        
                        // Check if any documents were blocked and notify user
                        const blockedDocs = contextService.attachedDocuments.filter(doc => doc.originallyBlocked);
                        if (blockedDocs.length > 0) {
                            addMessage(`⚠️ Security notice: ${blockedDocs.length} document(s) were blocked for containing potentially malicious content.`, 'system');
                        }
                    }
                }

                llmService.saveConversationHistory();
                if (currentPersonaPrompt) {
                    localStorage.setItem('currentPersonaPrompt', currentPersonaPrompt);
                } else {
                    localStorage.removeItem('currentPersonaPrompt');
                }

                chatWindow.innerHTML = '';
                addWelcomeMessage();
                renderConversation(llmService.conversationHistory);
                
                closeSettingsPanel(); // Corrected from hideSettingsPanel, which is not defined
                addMessage("(Conversation loaded successfully)", 'llm');

            } catch (error) {
                console.error("Failed to load or parse conversation file:", error);
                addMessage(`(Error: Could not load file. ${error.message})`, 'llm');
            }
        };
        reader.readAsText(file);
        event.target.value = null;
    }

    function renderConversation(history) {
        history.forEach(message => {
            if (message.role === 'system' || message.hidden) {
                return;
            }
            
            const sender = message.role === 'user' ? 'user' : 'llm';
            
            if (typeof message.content === 'string' && message.content.startsWith('{')) {
                try {
                    const contentObj = JSON.parse(message.content);
                    if (contentObj.type === 'image') {
                        addMessage(contentObj, sender, false); // Disable TTS for loaded conversations
                        return;
                    }
                } catch (e) { /* Not a JSON object, treat as string */ }
            }
            
            // Always render LLM messages as Markdown, but disable TTS for loaded conversations
            if (sender === 'llm' && window.marked) {
                addMessage(message.content, 'llm', false); // Disable TTS for loaded conversations
            } else {
                addMessage(message.content, sender, false); // Disable TTS for loaded conversations
            }
        });
    }

    // Expose functions globally for desktop interface
    window.createPersona = createPersona;
    window.clearConversation = clearConversation;
    window.saveAllSettings = saveAllSettings;
    window.loadAllSettings = loadAllSettings;
    window.applyFontSize = applyFontSize;
    window.updateVoiceDropdown = updateVoiceDropdown;
    window.addUniversalEvent = addUniversalEvent;
    window.closeSettingsPanel = closeSettingsPanel;
    window.saveConversationToFile = saveConversationToFile;
    window.loadConversationFromFile = loadConversationFromFile;
    
    console.log('App initialization complete');
}

// Add this helper function near the top or above addMessage
function stripMarkdownCodeBlock(text) {
    text = text.trim();
    const codeBlockRegex = /^```(?:markdown)?\n([\s\S]*?)\n```$/i;
    const match = text.match(codeBlockRegex);
    if (match) {
        return match[1];
    }
    return text;
}

