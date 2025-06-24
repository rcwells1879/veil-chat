let isInitialized = false;

// Use both DOMContentLoaded and window.onload for better mobile compatibility
document.addEventListener('DOMContentLoaded', initializeApp);
window.addEventListener('load', initializeApp);

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

    // --- Mobile Viewport Height Fix - Enhanced for real mobile browsers ---
    function setChatContainerHeight() {
        const chatContainer = document.querySelector('.chat-container');
        if (chatContainer) {
            // Use visual viewport API if available (modern mobile browsers)
            if (window.visualViewport) {
                chatContainer.style.height = `${window.visualViewport.height}px`;
            } else {
                // Fallback for older browsers
                const vh = window.innerHeight * 0.01;
                chatContainer.style.setProperty('--vh', `${vh}px`);
                chatContainer.style.height = 'calc(var(--vh, 1vh) * 100)';
            }
        }
    }

    // Enhanced mobile event listeners
    window.addEventListener('resize', setChatContainerHeight);
    window.addEventListener('orientationchange', () => {
        setTimeout(setChatContainerHeight, 100); // Delay for mobile orientation change
    });
    
    // Visual viewport support for modern mobile browsers
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', setChatContainerHeight);
    }

    // Set initial height
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
        
        // Add both mouse and touch events
        element.addEventListener(eventType, handler, { passive: false });
        
        // Add touch-specific events for mobile
        if (eventType === 'click') {
            element.addEventListener('touchend', (e) => {
                e.preventDefault();
                handler(e);
            }, { passive: false });
        }
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

        hidePersonaPanel();
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
        welcomeElement.innerHTML = "Welcome to Veil".split('').map((char, i) => 
            `<span class="animated-letter" style="animation-delay: ${i * 0.1}s">${char}</span>`
        ).join('');
        
        // Enhanced mobile event handling for welcome message
        const handleWelcomeInteraction = async (e) => {
            e.preventDefault();
            e.stopPropagation();
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
            const html = await response.text();
            personaPanelContainer.innerHTML = html;

            const panel = personaPanelContainer.querySelector('.persona-panel');
            const textarea = personaPanelContainer.querySelector('#persona-prompt');
            
            if (textarea) {
                textarea.value = localStorage.getItem('draftPersonaPrompt') || '';
                textarea.addEventListener('input', () => localStorage.setItem('draftPersonaPrompt', textarea.value));
            }

            const createButton = personaPanelContainer.querySelector('#create-persona-button');
            const randomButton = personaPanelContainer.querySelector('#use-random-persona-button');
            const cancelButton = personaPanelContainer.querySelector('#cancel-persona-button');
            
            if (createButton) addMobileCompatibleEvent(createButton, 'click', () => createPersona(textarea.value));
            if (randomButton) addMobileCompatibleEvent(randomButton, 'click', () => createPersona(null));
            if (cancelButton) addMobileCompatibleEvent(cancelButton, 'click', hidePersonaPanel);
            
            personaPanelContainer.querySelectorAll('.example-button').forEach(button => {
                addMobileCompatibleEvent(button, 'click', () => {
                    const personaText = button.getAttribute('data-persona');
                    if (textarea) {
                        textarea.value = personaText;
                        localStorage.setItem('draftPersonaPrompt', personaText);
                    }
                });
            });

            addMobileCompatibleEvent(personaPanelContainer, 'click', (e) => {
                if (e.target === personaPanelContainer) hidePersonaPanel();
            });
            
            if (panel) {
                addMobileCompatibleEvent(panel, 'click', (e) => e.stopPropagation());
            }

        } catch (error) {
            console.error('Error loading persona panel:', error);
            personaPanelContainer.innerHTML = '<p>Error loading persona creator.</p>';
        }
    }
    
    function showPersonaPanel() { 
        personaPanelContainer.classList.add('visible'); 
        console.log('Persona panel shown');
    }
    
    function hidePersonaPanel() { 
        personaPanelContainer.classList.remove('visible'); 
        console.log('Persona panel hidden');
    }

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
        if (voiceService) voiceService.finalAutoSendDelay = parseInt(SETTINGS.micAutoSendDelay);
    }

    async function loadSettingsPanel() {
        try {
            const response = await fetch('user-settings.html');
            const html = await response.text();
            settingsPanelContainer.innerHTML = html;

            Object.keys(SETTINGS).forEach(key => {
                const elementId = settingsIdMap[key];
                if (!elementId) return;

                const element = settingsPanelContainer.querySelector(`#${elementId}`);
                if (element) {
                    if (element.type === 'checkbox') {
                        element.checked = SETTINGS[key];
                    } else {
                        element.value = SETTINGS[key];
                    }
                }
            });
            
            settingsPanelContainer.querySelectorAll('input, select').forEach(el => {
                el.addEventListener('input', saveAllSettings);
                el.addEventListener('change', saveAllSettings);
            });
            
            const saveButton = settingsPanelContainer.querySelector('#save-conversation-button');
            const loadButton = settingsPanelContainer.querySelector('#load-conversation-button');
            const loadInput = settingsPanelContainer.querySelector('#load-conversation-input');
            
            if (saveButton) addMobileCompatibleEvent(saveButton, 'click', saveConversationToFile);
            if (loadButton) addMobileCompatibleEvent(loadButton, 'click', () => { if (loadInput) loadInput.click(); });
            if (loadInput) loadInput.addEventListener('change', loadConversationFromFile);
            
            addMobileCompatibleEvent(settingsPanelContainer, 'click', (e) => {
                if (e.target === settingsPanelContainer) hideSettingsPanel();
            });
            
            const settingsPanel = settingsPanelContainer.querySelector('.settings-panel');
            if (settingsPanel) {
                addMobileCompatibleEvent(settingsPanel, 'click', (e) => e.stopPropagation());
            }

            setupImageControls();
            toggleModelIdentifierVisibility();

        } catch (error) {
            console.error('Error loading settings panel:', error);
            settingsPanelContainer.innerHTML = '<p>Error loading settings.</p>';
        }
    }

    function hideSettingsPanel() {
        saveAllSettings();
        settingsPanelContainer.classList.remove('visible');
    }

    function setupImageControls() {
        const header = settingsPanelContainer.querySelector('#image-controls-header');
        const content = settingsPanelContainer.querySelector('#image-controls-content');
        const providerSelect = settingsPanelContainer.querySelector('#image-provider');

        const toggleProviderUI = () => {
            const isOpenAI = providerSelect.value === 'openai';
            const a1111Settings = settingsPanelContainer.querySelector('.a1111-settings');
            const openaiSettings = settingsPanelContainer.querySelector('.openai-settings');
            const imageSizeItem = settingsPanelContainer.querySelector('#image-size-item');
            const imageApiUrlItem = settingsPanelContainer.querySelector('#image-api-url-item');
            const openaiApiKeyItem = settingsPanelContainer.querySelector('#openai-api-key-item');
            
            if (a1111Settings) a1111Settings.style.display = isOpenAI ? 'none' : 'block';
            if (openaiSettings) openaiSettings.style.display = isOpenAI ? 'block' : 'none';
            if (imageSizeItem) imageSizeItem.style.display = 'flex';
            if (imageApiUrlItem) imageApiUrlItem.style.display = isOpenAI ? 'none' : 'flex';
            if (openaiApiKeyItem) openaiApiKeyItem.style.display = isOpenAI ? 'flex' : 'none';
        };

        if (header) addMobileCompatibleEvent(header, 'click', () => content.classList.toggle('expanded'));
        if (providerSelect) providerSelect.addEventListener('change', toggleProviderUI);
        toggleProviderUI();
    }

    function toggleModelIdentifierVisibility() {
        const provider = settingsPanelContainer.querySelector('#llm-provider');
        const modelItem = settingsPanelContainer.querySelector('#model-identifier-item');
        const keyItem = settingsPanelContainer.querySelector('#api-key-item');
        
        if (provider && modelItem && keyItem) {
            const providerValue = provider.value;
            modelItem.style.display = providerValue === 'lmstudio' ? 'none' : 'flex';
            keyItem.style.display = providerValue === 'lmstudio' ? 'none' : 'flex';
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
        console.log('Settings button clicked/touched');
        
        if (!settingsPanelContainer.classList.contains('visible')) {
            if (!settingsPanelContainer.querySelector('.settings-panel')) {
                await loadSettingsPanel();
            }
            settingsPanelContainer.classList.add('visible');
        } else {
            hideSettingsPanel();
        }
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
        
        // Keep expanded while typing
        userInput.addEventListener('input', () => {
            if (userInput.value.trim() !== '') {
                inputArea.classList.add('expanded');
                userInput.classList.add('expanded');
            }
        });
        
        // Contract after sending message
        const originalHandleUserInput = handleUserInput;
        handleUserInput = async function() {
            await originalHandleUserInput();
            
            // Contract after sending and reset height
            setTimeout(() => {
                inputArea.classList.remove('expanded');
                userInput.classList.remove('expanded');
                userInput.style.height = '50px';
                console.log('Input contracted after sending');
            }, 100);
        };
    }

    // Call this function in your initializeApp function, after DOM elements are ready
    // Add this line after line ~125 where you set up other event listeners:
    setupInputExpansion();

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
                }
            }, 500);
        });
    }

    // Also call this in your initializeApp function:
    setupMobileInputExpansion();

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
        // Store the current scroll position
        const chatWindow = document.getElementById('chat-window');
        
        // Reset height to calculate the true content height
        userInput.style.height = 'auto';
        
        // Get the scroll height (the height needed to show all content)
        const scrollHeight = userInput.scrollHeight;
        
        // Set minimum height based on screen size
        const isMobile = window.innerWidth <= 768;
        const minHeight = isMobile ? 44 : 50;
        
        // Calculate new height (no maximum limit for now)
        const newHeight = Math.max(minHeight, scrollHeight);
        
        // Apply the new height
        userInput.style.height = newHeight + 'px';
        
        // Scroll chat window to bottom when input expands
        if (chatWindow) {
            chatWindow.scrollTop = chatWindow.scrollHeight;
        }
        
        console.log('Textarea resized to:', newHeight + 'px', 'Content scroll height:', scrollHeight + 'px');
    }
    
    // Add event listeners for auto-resize
    userInput.addEventListener('input', autoResize);
    userInput.addEventListener('paste', () => {
        // Small delay to allow paste content to be processed
        setTimeout(autoResize, 50);
    });
    
    // Handle Enter key behavior
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleUserInput();
        }
        // Allow Shift+Enter for new lines
        if (e.key === 'Enter' && e.shiftKey) {
            // Let the default behavior happen (new line)
            setTimeout(autoResize, 50);
        }
    });
    
    // Reset height when input is cleared
    userInput.addEventListener('blur', () => {
        if (userInput.value.trim() === '') {
            const isMobile = window.innerWidth <= 768;
            const minHeight = isMobile ? 44 : 50;
            userInput.style.height = minHeight + 'px';
            console.log('Reset height to minimum:', minHeight + 'px');
        }
    });
    
    // Handle window resize for responsive behavior
    window.addEventListener('resize', () => {
        setTimeout(autoResize, 100);
    });
    
    // Initial resize call
    setTimeout(() => {
        autoResize();
        console.log('Initial auto-resize completed');
    }, 200);
    
    console.log('Textarea auto-resize setup complete');
}

setupTextareaAutoResize();

    // Load saved persona on startup
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
                
                hideSettingsPanel();
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

window.onload = () => {
    const event = new Event('DOMContentLoaded', {
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(event);
};