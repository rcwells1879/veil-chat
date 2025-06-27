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

    // Mobile debugging - log more details
    console.log('Mobile debug - User agent:', navigator.userAgent);
    console.log('Mobile debug - Screen size:', window.screen.width + 'x' + window.screen.height);
    console.log('Mobile debug - Viewport size:', window.innerWidth + 'x' + window.innerHeight);
    console.log('Mobile debug - Touch support:', 'ontouchstart' in window);
    
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
    // Comment out or remove these lines:
    /*
    window.addEventListener('resize', setChatContainerHeight);
    window.addEventListener('orientationchange', () => {
        setTimeout(setChatContainerHeight, 100);
    });

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', setChatContainerHeight);
    }
    */

    // Set initial height once
    setChatContainerHeight();

    // --- Settings Configuration ---
    const SETTINGS = {
        // LLM
        customLlmProvider: localStorage.getItem('customLlmProvider') || 'litellm',
        customLlmApiUrl: (localStorage.getItem('customLlmApiUrl') || 'https://litellm-veil.veilstudio.io').replace(/\/$/, ""),
        customLlmModelIdentifier: localStorage.getItem('customLlmModelIdentifier') || 'gemini2.5-flash',
        customLlmApiKey: localStorage.getItem('customLlmApiKey') || 'sk-DSHSfgTh65Fvd',
        // Image
        customImageProvider: localStorage.getItem('customImageProvider') || 'openai',
        customImageApiUrl: (localStorage.getItem('customImageApiUrl') || 'http://localhost:7860').replace(/\/$/, ""),
        customOpenAIImageApiKey: localStorage.getItem('customOpenAIImageApiKey') || '',
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
        // Voice & UI
        ttsVoice: localStorage.getItem('ttsVoice') || 'Sonia',
    };

    // --- Service Initialization ---
    let llmService = new LLMService(SETTINGS.customLlmApiUrl, SETTINGS.customLlmProvider, SETTINGS.customLlmModelIdentifier, SETTINGS.customLlmApiKey);
    let imageService = new ImageService(SETTINGS.customImageApiUrl, SETTINGS.customImageProvider, SETTINGS.customOpenAIImageApiKey);
    let voiceService;
    try {
        voiceService = new VoiceService(handleSttResult, handleSttError, handleSttListeningState, handleSttAutoSend);
    } catch (error) {
        console.warn('VoiceService failed to initialize:', error);
        voiceService = null;
    }
    
    const contextService = new ContextService();
    
    if (voiceService) {
        voiceService.finalAutoSendDelay = 500;
    }

    // --- Core Functions ---
    async function addMessage(message, sender) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${sender}-message`);
        let textToSpeak = null;

        if (typeof message === 'string') {
            messageElement.textContent = message;
            if (sender === 'llm') textToSpeak = message;
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
            messageElement.textContent = message.text;
            if (sender === 'llm') textToSpeak = message.text;
        }

        chatWindow.appendChild(messageElement);
        chatWindow.scrollTop = chatWindow.scrollHeight;

        if (textToSpeak && voiceService && voiceService.isSynthesisSupported()) {
            try {
                await voiceService.speak(textToSpeak, SETTINGS.ttsVoice);
            } catch (error) {
                console.error("TTS Error:", error);
            }
        }
    }

    async function handleUserInput() {
        const message = userInput.value.trim();
        if (!message) return;

        userInput.value = '';
        
        // Reset textarea height after clearing content
        const isMobile = window.innerWidth <= 768;
        const minHeight = isMobile ? 44 : 50;
        userInput.style.height = minHeight + 'px';
        
        // Contract the input expansion after sending
        const inputArea = document.querySelector('.input-area');
        if (inputArea) {
            inputArea.classList.remove('expanded');
            userInput.classList.remove('expanded');
        }
        
        addMessage(message, 'user');

        const documentContext = contextService.getDocumentContext();
        const response = await llmService.sendMessage(message, documentContext);
        
        if (response.type === 'image_request') {
            console.log("Image request detected, generating image...");
            try {
                const imageDataUrl = await imageService.generateImage(response.prompt);
                if (imageDataUrl) {
                    await addMessage({ type: 'image', url: imageDataUrl, alt: "Generated Image" }, 'llm');
                } else {
                    await addMessage("I tried to create an image for you, but the generation failed.", 'llm');
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

    // --- Enhanced Mobile Event Handling ---
    function addMobileCompatibleEvent(element, eventType, handler) {
        if (!element) return;
        // Modern browsers handle touch-to-click translation well.
        // The 'setTimeout(0)' trick in the panel handlers is the robust way
        // to deal with any residual "ghost click" issues.
        // This simplified function prevents the previous double-firing of events.
        element.addEventListener(eventType, handler, { passive: false });
    }

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

        llmService = new LLMService(SETTINGS.customLlmApiUrl, SETTINGS.customLlmProvider, SETTINGS.customLlmModelIdentifier, SETTINGS.customLlmApiKey);
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
                addMessage(result.greeting, 'llm');
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
            const response = await fetch('persona.html');
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
                // const cancelButton = personaPanelContainer.querySelector('#cancel-persona-button'); // Button removed from HTML

                if (createButton) addMobileCompatibleEvent(createButton, 'click', () => createPersona(textarea.value));
                if (randomButton) addMobileCompatibleEvent(randomButton, 'click', () => createPersona(null));
                // if (cancelButton) addMobileCompatibleEvent(cancelButton, 'click', closePersonaPanel); // Logic for removed button

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

    // The following 'if' block is redundant and is the cause of the flickering.
    // It is being replaced by a more robust event listener later in the file.
    /*
    // --- Attach open/close logic to settings and persona buttons ---
    if (settingsButton) {
        settingsButton.onclick = showSettingsPanel;
    }
    */

    // Persona panel open logic should be attached to wherever you open persona (e.g., a button or menu)
    // Example: document.getElementById('open-persona-btn').onclick = showPersonaPanel;
    // --- Close panels on ESC key ---
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeSettingsPanel();
            closePersonaPanel();
        }
    });

    // --- Settings Management ---
    const settingsIdMap = {
        customLlmProvider: 'llm-provider',
        customLlmApiUrl: 'llm-api-url',
        customLlmModelIdentifier: 'llm-model-identifier',
        customLlmApiKey: 'llm-api-key',
        customImageProvider: 'image-provider',
        customImageApiUrl: 'image-api-url',
        customOpenAIImageApiKey: 'openai-image-api-key',
        imageSize: 'image-size',
        imageWidth: 'image-width',
        imageHeight: 'image-height',
        imageSteps: 'image-steps',
        imageCfgScale: 'image-cfg-scale',
        imageSampler: 'image-sampler',
        openaiQuality: 'openai-quality',
        openaiOutputFormat: 'openai-output-format',
        openaiBackground: 'openai-background',
        ttsVoice: 'select-tts-voice'
    };

    function saveAllSettings() {
        Object.keys(SETTINGS).forEach(key => {
            const elementId = settingsIdMap[key];
            if (!elementId) return;

            const element = settingsPanelContainer.querySelector(`#${elementId}`);
            if (element) {
                const value = element.type === 'checkbox' ? element.checked : element.value;
                localStorage.setItem(key, value);
                SETTINGS[key] = value;
            }
        });
        
        const llmSettingsChanged = SETTINGS.customLlmApiUrl !== llmService.apiBaseUrl || SETTINGS.customLlmModelIdentifier !== llmService.modelIdentifier || SETTINGS.customLlmApiKey !== llmService.apiKey || SETTINGS.customLlmProvider !== llmService.providerType;
        const imageSettingsChanged = SETTINGS.customImageApiUrl !== imageService.apiBaseUrl || SETTINGS.customImageProvider !== imageService.provider || SETTINGS.customOpenAIImageApiKey !== imageService.openaiApiKey;

        if (llmSettingsChanged) {
            const oldHistory = llmService.conversationHistory;
            const oldInitialized = llmService.characterInitialized;
            llmService = new LLMService(SETTINGS.customLlmApiUrl, SETTINGS.customLlmProvider, SETTINGS.customLlmModelIdentifier, SETTINGS.customLlmApiKey);
            llmService.conversationHistory = oldHistory;
            llmService.characterInitialized = oldInitialized;
            llmService.saveConversationHistory();
            if (currentPersonaPrompt) {
                llmService.setCustomPersona(currentPersonaPrompt, true);
            }
        }
        if (imageSettingsChanged) {
            imageService = new ImageService(SETTINGS.customImageApiUrl, SETTINGS.customImageProvider, SETTINGS.customOpenAIImageApiKey);
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
        });
        if (voiceService) {
            voiceService.finalAutoSendDelay = parseInt(SETTINGS.sttFinalTimeout, 10);
        }
    }

    function setupImageControls() {
        const container = settingsPanelContainer;
        if (!container) return;

        const imageProviderSelect = container.querySelector('#image-provider');
        const a1111Settings = container.querySelector('.a1111-settings');
        const openaiSettings = container.querySelector('.openai-settings');

        function toggleProviderSettings() {
            if (!imageProviderSelect || !a1111Settings || !openaiSettings) return;
            
            const provider = imageProviderSelect.value;

            if (provider === 'openai') {
                openaiSettings.style.display = 'block';
                a1111Settings.style.display = 'none';
            } else { // a1111
                openaiSettings.style.display = 'none';
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

        function toggleVisibility() {
            if (!llmProviderSelect || !modelIdentifierItem) return;
            const provider = llmProviderSelect.value;
            // LMStudio uses a path, not a model identifier from a list
            if (provider === 'lmstudio') {
                modelIdentifierItem.style.display = 'none';
            } else {
                modelIdentifierItem.style.display = 'flex';
            }
        }

        if (llmProviderSelect) {
            llmProviderSelect.addEventListener('change', toggleVisibility);
            toggleVisibility(); // Initial call to set state
        }
    }


    async function loadSettingsPanel() {
        console.log('%c[DEBUG] LOAD_SETTINGS_PANEL called.', 'color: red; font-weight: bold;');
        try {
            const response = await fetch('user-settings.html');
            if (!response.ok) throw new Error(`Failed to load user-settings.html: ${response.statusText}`);
            const html = await response.text();

            // Parse the fetched HTML and extract only the .settings-panel element
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const panelElement = doc.querySelector('.settings-panel');

            if (panelElement) {
                settingsPanelContainer.innerHTML = ''; // Clear any previous content
                // Clone the node to ensure it's fully part of the main document
                settingsPanelContainer.appendChild(panelElement.cloneNode(true));

                // Re-run setup for the newly added elements
                Object.keys(SETTINGS).forEach(key => {
                    const elementId = settingsIdMap[key];
                    if (!elementId) return;
                    const element = settingsPanelContainer.querySelector(`#${elementId}`);
                    if (element) {
                        element.value = SETTINGS[key];
                    }
                });

                settingsPanelContainer.querySelectorAll('input, select').forEach(el => {
                    el.addEventListener('change', saveAllSettings);
                });

                const saveButton = settingsPanelContainer.querySelector('#save-conversation-button');
                const loadButton = settingsPanelContainer.querySelector('#load-conversation-button');
                const loadInput = settingsPanelContainer.querySelector('#load-conversation-input');

                if (saveButton) addMobileCompatibleEvent(saveButton, 'click', saveConversationToFile);
                if (loadButton) addMobileCompatibleEvent(loadButton, 'click', () => loadInput.click());
                if (loadInput) loadInput.addEventListener('change', loadConversationFromFile);

                setupImageControls();
                toggleModelIdentifierVisibility();
            } else {
                throw new Error('.settings-panel element not found in user-settings.html');
            }

        } catch (error) {
            console.error('Error loading settings panel:', error);
            settingsPanelContainer.innerHTML = `<p style="color:red; text-align:center;">Error: Could not load settings.</p>`;
        }
    }

    // --- Voice Service Handlers ---
    function handleSttResult(text) { userInput.value = text; }
    function handleSttError(error) { console.error("STT Error:", error); isContinuousConversationActive = false; }
    function handleSttListeningState(isListening) {
        if (micButton) {
            micButton.textContent = isListening ? '...' : '🎤';
            micButton.classList.toggle('listening', isListening);
        }
    }
    async function handleSttAutoSend(text) {
        userInput.value = text;
        await handleUserInput();
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
            <div class="attached-docs-header">
                <span>📎 ${docs.length} document(s) attached</span>
                <button class="clear-docs-btn" onclick="clearAllDocuments()">Clear All</button>
            </div>
            <div class="attached-docs-list">
                ${docs.map(doc => `
                    <div class="attached-doc-item">
                        <span class="doc-name" title="${doc.name}">${doc.name}</span>
                        <button class="remove-doc-btn" onclick="removeDocument('${doc.id}')" title="Remove">×</button>
                    </div>
                `).join('')}
            </div>
        `;
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
            console.log('%c[DEBUG] Panel already exists. Not reloading.', 'color: green;');
        }
        showSettingsPanel();
    });

    if (micButton && voiceService && voiceService.isRecognitionSupported()) {
        addMobileCompatibleEvent(micButton, 'click', (e) => {
            e.preventDefault();
            console.log('Mic button clicked/touched');
            isContinuousConversationActive = !voiceService.isRecognitionActive;
            if (isContinuousConversationActive) voiceService.startRecognition();
            else voiceService.stopRecognition();
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
            if (!inputArea.classList.contains('expanded')) {
                inputArea.classList.add('expanded');
                userInput.classList.add('expanded');
                userInput.focus();
                console.log('Input expanded on click');
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
                    userInput.style.height = '50px';
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
            const isMobile = window.innerWidth <= 768;
            const minHeight = isMobile ? 44 : 50;
            
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
        userInput.addEventListener('input', autoResize);
        userInput.addEventListener('paste', () => {
            setTimeout(autoResize, 50);
        });
        
        // Handle Enter key behavior
        userInput.addEventListener('keydown', (e) => {
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
                const isMobile = window.innerWidth <= 768;
                const minHeight = isMobile ? 44 : 50;
                userInput.style.height = minHeight + 'px';
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
                        addMessage(personaContent.greeting, 'llm');
                    }
                    
                } catch (error) {
                    console.error('Error generating initial content on startup:', error);
                }
            }, 1000);
        }
    }

    addWelcomeMessage();

    if (LLMService.hasSavedConversation()) {
        addMessage('(Previous conversation restored - context preserved)', 'llm');
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

                currentPersonaPrompt = loadedState.personaPrompt || null;
                llmService.conversationHistory = loadedState.llmServiceState.conversationHistory;
                llmService.characterInitialized = loadedState.llmServiceState.characterInitialized;

                if (loadedState.documentContext) {
                    const imported = contextService.importContext(loadedState.documentContext);
                    if (imported) {
                        updateAttachedDocsDisplay();
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
                        addMessage(contentObj, sender);
                        return;
                    }
                } catch (e) { /* Not a JSON object, treat as string */ }
            }
            
            addMessage(message.content, sender);
        });
    }

    console.log('App initialization complete');
}
