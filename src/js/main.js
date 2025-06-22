document.addEventListener('DOMContentLoaded', async () => {
    // --- DOM Elements ---
    const chatWindow = document.getElementById('chat-window');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const micButton = document.getElementById('mic-button');
    const settingsButton = document.getElementById('settings-button');
    const settingsPanelContainer = document.getElementById('settings-panel-container');
    const personaPanelContainer = document.createElement('div');
    personaPanelContainer.id = 'persona-panel-container';
    document.body.appendChild(personaPanelContainer);
    
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

    // --- Settings Configuration ---
    const SETTINGS = {
        // LLM
        customLlmProvider: localStorage.getItem('customLlmProvider') || 'litellm',
        customLlmApiUrl: (localStorage.getItem('customLlmApiUrl') || 'http://localhost:4000').replace(/\/$/, ""),
        customLlmModelIdentifier: localStorage.getItem('customLlmModelIdentifier') || 'ollama/technobyte/Cydonia-24B-v2.1:latest',
        customLlmApiKey: localStorage.getItem('customLlmApiKey') || 'sk-DSHSfgTh65Fvd',
        // Image
        customImageProvider: localStorage.getItem('customImageProvider') || 'a1111',
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
        micAutoSendDelay: localStorage.getItem('micAutoSendDelay') || '1000',
    };

    // --- Service Initialization ---
    let llmService = new LLMService(SETTINGS.customLlmApiUrl, SETTINGS.customLlmProvider, SETTINGS.customLlmModelIdentifier, SETTINGS.customLlmApiKey);
    let imageService = new ImageService(SETTINGS.customImageApiUrl, SETTINGS.customImageProvider, SETTINGS.customOpenAIImageApiKey);
    let voiceService = new VoiceService(handleSttResult, handleSttError, handleSttListeningState, handleSttAutoSend);

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

        if (textToSpeak && voiceService.isSynthesisSupported()) {
            try {
                await voiceService.speak(textToSpeak, SETTINGS.ttsVoice);
            } catch (error) {
                console.error("TTS Error:", error);
            }
        }
    }

    async function handleUserInput() {
        const messageText = userInput.value.trim();
        if (!messageText) return;

        addMessage(messageText, 'user');
        userInput.value = '';

        try {
            const llmResponse = await llmService.sendMessage(messageText);

            if (llmResponse.type === 'image_request' && llmResponse.prompt) {
                try {
                    const imageUrl = await imageService.generateImage(llmResponse.prompt);
                    if (imageUrl) {
                        addMessage({ type: 'image', url: imageUrl, alt: llmResponse.prompt }, 'llm');
                    } else {
                        addMessage({ text: "(Image generation failed)", type: 'error' }, 'llm');
                    }
                } catch (imageError) {
                    addMessage({ text: `(Image Error: ${imageError.message})`, type: 'error' }, 'llm');
                }
            } else if (llmResponse.type === 'text' && llmResponse.content) {
                addMessage(llmResponse.content, 'llm');
            } else if (llmResponse.type === 'error') {
                addMessage({ text: llmResponse.content, type: 'error' }, 'llm');
            } else {
                addMessage({ text: "(Received an unexpected response from the LLM)", type: 'error' }, 'llm');
            }
        } catch (error) {
            addMessage({ text: `Error: Could not connect to the LLM. ${error.message}`, type: 'error' }, 'llm');
        }
    }

    // --- Persona Management ---
    async function createPersona(customPrompt) {
        // Only clear conversation and reset state when actually creating a new persona
        chatWindow.innerHTML = '';
        currentPersonaPrompt = customPrompt;
        personaCreated = true;

        localStorage.removeItem('draftPersonaPrompt');
        if (customPrompt) {
            localStorage.setItem('currentPersonaPrompt', customPrompt);
        } else {
            localStorage.removeItem('currentPersonaPrompt');
        }

        // Clear conversation history and create new LLM service
        llmService = new LLMService(SETTINGS.customLlmApiUrl, SETTINGS.customLlmProvider, SETTINGS.customLlmModelIdentifier, SETTINGS.customLlmApiKey);
        llmService.clearConversationHistory();
        
        if (currentPersonaPrompt) {
            llmService.setCustomPersona(currentPersonaPrompt);
        }

        hidePersonaPanel();
        addWelcomeMessage();

        const successMessage = customPrompt ? 'Creating custom persona...' : 'Generating random persona...';
        addMessage(successMessage, 'llm');

        // Generate the persona character profile FIRST, then get image and greeting
        try {
            console.log("Generating character profile for new persona...");
            
            // Force character generation now (this will create the character profile)
            await llmService.generateCharacterProfile();
            
            console.log("Generating initial persona image and greeting...");
            const result = await llmService.generateInitialPersonaContent();
            
            if (result.imagePrompt) {
                // FIX: Use imageService.generateImage instead of just generateImage
                try {
                    const imageUrl = await imageService.generateImage(result.imagePrompt);
                    if (imageUrl) {
                        addMessage({ type: 'image', url: imageUrl, alt: "Character appearance" }, 'llm');
                    }
                } catch (imageError) {
                    console.error('Error generating persona image:', imageError);
                }
            }
            
            // The greeting is already in conversation history, but we still need to display it
            if (result.greeting) {
                console.log('Initial greeting generated and added to conversation history');
                // Display the greeting in the chat UI
                addMessage(result.greeting, 'llm');
            }
            
        } catch (error) {
            console.error('Error generating initial persona content:', error);
        }
    }

    function addWelcomeMessage() {
        const welcomeElement = document.createElement('div');
        welcomeElement.classList.add('message', 'welcome-message');
        welcomeElement.innerHTML = "Welcome to Veil".split('').map((char, i) => `<span class="animated-letter" style="animation-delay: ${i * 0.1}s">${char}</span>`).join('');
        
        welcomeElement.addEventListener('click', async () => {
            // DON'T clear anything here - just show the persona panel
            if (!personaPanelContainer.querySelector('.persona-panel')) {
                await loadPersonaPanel();
            }
            showPersonaPanel();
        });
        
        chatWindow.appendChild(welcomeElement);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    async function loadPersonaPanel() {
        try {
            const response = await fetch('persona.html');
            const html = await response.text();
            personaPanelContainer.innerHTML = html;

            const panel = personaPanelContainer.querySelector('.persona-panel');
            const textarea = personaPanelContainer.querySelector('#persona-prompt');
            
            textarea.value = localStorage.getItem('draftPersonaPrompt') || '';
            textarea.addEventListener('input', () => localStorage.setItem('draftPersonaPrompt', textarea.value));

            personaPanelContainer.querySelector('#create-persona-button').addEventListener('click', () => createPersona(textarea.value));
            personaPanelContainer.querySelector('#use-random-persona-button').addEventListener('click', () => createPersona(null));
            personaPanelContainer.querySelector('#cancel-persona-button').addEventListener('click', hidePersonaPanel);
            
            personaPanelContainer.querySelectorAll('.example-button').forEach(button => {
                button.addEventListener('click', () => {
                    const personaText = button.getAttribute('data-persona');
                    textarea.value = personaText;
                    localStorage.setItem('draftPersonaPrompt', personaText);
                });
            });

            personaPanelContainer.addEventListener('click', (e) => e.target === personaPanelContainer && hidePersonaPanel());
            panel.addEventListener('click', (e) => e.stopPropagation());

        } catch (error) {
            console.error('Error loading persona panel:', error);
            personaPanelContainer.innerHTML = '<p>Error loading persona creator.</p>';
        }
    }
    
    function showPersonaPanel() { personaPanelContainer.classList.add('visible'); }
    function hidePersonaPanel() { personaPanelContainer.classList.remove('visible'); }

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
        // OpenAI-specific settings
        openaiQuality: 'openai-quality',
        openaiOutputFormat: 'openai-output-format',
        openaiBackground: 'openai-background',
        ttsVoice: 'select-tts-voice',
        micAutoSendDelay: 'mic-auto-send-delay'
    };

    function saveAllSettings() {
        // Update the SETTINGS object by reading current values from the form.
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
        
        // Re-create services if critical settings changed
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
        
        // Update non-critical settings
        imageService.updateSettings({
            size: SETTINGS.imageSize,
            width: parseInt(SETTINGS.imageWidth),
            height: parseInt(SETTINGS.imageHeight),
            steps: parseInt(SETTINGS.imageSteps),
            cfg_scale: parseFloat(SETTINGS.imageCfgScale),
            sampler_name: SETTINGS.imageSampler,
            // OpenAI-specific settings
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

            // Populate settings from SETTINGS object using the map
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
            
            // Setup listeners for settings
            settingsPanelContainer.querySelectorAll('input, select').forEach(el => {
                el.addEventListener('input', saveAllSettings);
                el.addEventListener('change', saveAllSettings);
            });
            
            // ADD CONVERSATION EVENT LISTENERS HERE - AFTER THE HTML IS LOADED
            const saveButton = settingsPanelContainer.querySelector('#save-conversation-button');
            const loadButton = settingsPanelContainer.querySelector('#load-conversation-button');
            const loadInput = settingsPanelContainer.querySelector('#load-conversation-input');
            
            if (saveButton) {
                saveButton.addEventListener('click', saveConversationToFile);
            }
            
            if (loadButton) {
                loadButton.addEventListener('click', () => {
                    if (loadInput) {
                        loadInput.click();
                    }
                });
            }
            
            if (loadInput) {
                loadInput.addEventListener('change', loadConversationFromFile);
            }
            
            settingsPanelContainer.addEventListener('click', (e) => e.target === settingsPanelContainer && hideSettingsPanel());
            settingsPanelContainer.querySelector('.settings-panel').addEventListener('click', (e) => e.stopPropagation());

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
            settingsPanelContainer.querySelector('.a1111-settings').style.display = isOpenAI ? 'none' : 'block';
            settingsPanelContainer.querySelector('.openai-settings').style.display = isOpenAI ? 'block' : 'none';
            settingsPanelContainer.querySelector('#image-size-item').style.display = 'flex'; // Always show size
            settingsPanelContainer.querySelector('#image-api-url-item').style.display = isOpenAI ? 'none' : 'flex';
            settingsPanelContainer.querySelector('#openai-api-key-item').style.display = isOpenAI ? 'flex' : 'none';
        };

        header.addEventListener('click', () => content.classList.toggle('expanded'));
        providerSelect.addEventListener('change', toggleProviderUI);
        toggleProviderUI(); // Initial setup
    }

    function toggleModelIdentifierVisibility() {
        const provider = settingsPanelContainer.querySelector('#llm-provider').value;
        const modelItem = settingsPanelContainer.querySelector('#model-identifier-item');
        const keyItem = settingsPanelContainer.querySelector('#api-key-item');
        modelItem.style.display = provider === 'lmstudio' ? 'none' : 'flex';
        keyItem.style.display = provider === 'lmstudio' ? 'none' : 'flex';
    }

    // --- Voice Service Handlers ---
    function handleSttResult(text) { userInput.value = text; }
    function handleSttError(error) { console.error("STT Error:", error); isContinuousConversationActive = false; }
    function handleSttListeningState(isListening) {
        micButton.textContent = isListening ? '...' : '🎤';
        micButton.classList.toggle('listening', isListening);
    }
    async function handleSttAutoSend(text) {
        userInput.value = text;
        if (userInput.value.trim()) {
            const wasContinuous = isContinuousConversationActive;
            isContinuousConversationActive = false;
            await handleUserInput();
            isContinuousConversationActive = wasContinuous;
            if (isContinuousConversationActive) setTimeout(() => voiceService.startRecognition(), 750);
        } else if (isContinuousConversationActive) {
            setTimeout(() => voiceService.startRecognition(), 100);
        }
    }

    // --- Initial Setup ---
    sendButton.addEventListener('click', handleUserInput);
    userInput.addEventListener('keypress', (e) => e.key === 'Enter' && handleUserInput());
    fullScreenImageViewer.addEventListener('click', () => fullScreenImageViewer.style.display = 'none');
    
    settingsButton.addEventListener('click', async () => {
        if (!settingsPanelContainer.classList.contains('visible')) {
            if (!settingsPanelContainer.querySelector('.settings-panel')) {
                await loadSettingsPanel();
            }
            settingsPanelContainer.classList.add('visible');
        } else {
            hideSettingsPanel();
        }
    });

    if (voiceService.isRecognitionSupported()) {
        micButton.addEventListener('click', () => {
            isContinuousConversationActive = !voiceService.isRecognitionActive;
            if (isContinuousConversationActive) voiceService.startRecognition();
            else voiceService.stopRecognition();
        });
    } else {
        micButton.style.display = 'none';
    }

    // Load saved persona on startup (but DON'T clear conversation history)
    currentPersonaPrompt = localStorage.getItem('currentPersonaPrompt');
    if (currentPersonaPrompt) {
        personaCreated = true;
        
        // Only set the persona if we don't already have saved conversation history
        // If we have saved history, the persona is already there
        if (!LLMService.hasSavedConversation()) {
            llmService.setCustomPersona(currentPersonaPrompt);
            
            // Generate character profile and initial content for restored persona (only if no saved conversation)
            setTimeout(async () => {
                try {
                    console.log("Generating character profile for restored persona...");
                    await llmService.generateCharacterProfile();
                    
                    console.log("Generating initial content for restored persona...");
                    const personaContent = await llmService.generateInitialPersonaContent();
                    
                    // Generate image if we got a prompt
                    if (personaContent.imagePrompt) {
                        try {
                            // FIX: Use imageService.generateImage instead of just generateImage
                            const imageUrl = await imageService.generateImage(personaContent.imagePrompt);
                            if (imageUrl) {
                                addMessage({ type: 'image', url: imageUrl, alt: "Character appearance" }, 'llm');
                            }
                        } catch (imageError) {
                            console.error('Error generating persona image on startup:', imageError);
                        }
                    }
                    
                    // Add the greeting
                    if (personaContent.greeting) {
                        addMessage(personaContent.greeting, 'llm');
                    }
                    
                } catch (error) {
                    console.error('Error generating initial content on startup:', error);
                }
            }, 1000); // Small delay to let the UI finish loading
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
            }
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

                // Restore application state
                currentPersonaPrompt = loadedState.personaPrompt || null;
                llmService.conversationHistory = loadedState.llmServiceState.conversationHistory;
                llmService.characterInitialized = loadedState.llmServiceState.characterInitialized;

                // Update localStorage
                llmService.saveConversationHistory();
                if (currentPersonaPrompt) {
                    localStorage.setItem('currentPersonaPrompt', currentPersonaPrompt);
                } else {
                    localStorage.removeItem('currentPersonaPrompt');
                }

                // Clear the chat window first
                chatWindow.innerHTML = '';
                
                // Use the existing addWelcomeMessage function (which has the safe click handler)
                addWelcomeMessage();
                
                // Then render conversation history
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
        // DON'T clear chatWindow here - let the caller decide
        // chatWindow.innerHTML = '';
        
        history.forEach(message => {
            // Don't display system messages or messages explicitly marked as hidden
            if (message.role === 'system' || message.hidden) {
                return;
            }
            
            const sender = message.role === 'user' ? 'user' : 'llm';
            
            // Handle image messages which might be JSON strings
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
});