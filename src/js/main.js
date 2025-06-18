document.addEventListener('DOMContentLoaded', async () => {
    const chatWindow = document.getElementById('chat-window');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const micButton = document.getElementById('mic-button');
    const settingsButton = document.getElementById('settings-button');
    const settingsPanelContainer = document.getElementById('settings-panel-container');

    // Add persona panel container
    const personaPanelContainer = document.createElement('div');
    personaPanelContainer.id = 'persona-panel-container';
    document.body.appendChild(personaPanelContainer);

    // Add these variable declarations near the top with other variables
    let currentPersonaPrompt = null;
    let personaCreated = false;
    
    // --- Defaults for Local LiteLLM Setup ---
    const DEFAULT_LITELLM_API_URL = 'http://localhost:4000';
    const DEFAULT_LITELLM_PROVIDER = 'litellm';
    const DEFAULT_LITELLM_MODEL_ID = 'ollama/technobyte/Cydonia-24B-v2.1:latest';
    const DEFAULT_LITELLM_API_KEY = 'sk-DSHSfgTh65Fvd';

    const DEFAULT_IMAGE_API_URL = 'http://localhost:7860';
    const DEFAULT_IMAGE_PROVIDER = 'a1111'; // Add this line

    // --- Load from localStorage or use defaults ---
    let currentLlmProvider = localStorage.getItem('customLlmProvider') || DEFAULT_LITELLM_PROVIDER;
    let currentLlmApiUrl = localStorage.getItem('customLlmApiUrl') || DEFAULT_LITELLM_API_URL;
    let currentLlmModelIdentifier = localStorage.getItem('customLlmModelIdentifier') || DEFAULT_LITELLM_MODEL_ID;
    let currentLlmApiKey = localStorage.getItem('customLlmApiKey') || DEFAULT_LITELLM_API_KEY;
    let currentImageApiUrl = localStorage.getItem('customImageApiUrl') || DEFAULT_IMAGE_API_URL;
    let currentImageProvider = localStorage.getItem('customImageProvider') || DEFAULT_IMAGE_PROVIDER; // Add this line
    let currentOpenAIImageApiKey = localStorage.getItem('customOpenAIImageApiKey') || ''; // Add this line

    // Ensure URLs don't have trailing slashes when loaded from localStorage or defaults
    currentLlmApiUrl = currentLlmApiUrl.replace(/\/$/, "");
    currentImageApiUrl = currentImageApiUrl.replace(/\/$/, "");

    let llmService = new LLMService(currentLlmApiUrl, currentLlmProvider, currentLlmModelIdentifier, currentLlmApiKey);
    let imageService = new ImageService(currentImageApiUrl, currentImageProvider, currentOpenAIImageApiKey);

    let isContinuousConversationActive = false; 
    let isFirstInteraction = true;
    let voiceService;
    let isVoiceMode = false;
    let isListening = false;
    let currentTTSVoiceKeyword = 'Sonia';

    async function handleSttAutoSend(text) {
        userInput.value = text;
        console.log("Main.js: Auto-sending prompt:", `"${text}"`);

        if (userInput.value.trim()) {
            const wasContinuous = isContinuousConversationActive;
            isContinuousConversationActive = false;

            await handleUserInput();

            isContinuousConversationActive = wasContinuous;

            if (isContinuousConversationActive) {
                console.log("Main.js: Continuous conversation active, attempting to restart STT after TTS.");
                setTimeout(() => {
                    console.log(`Main.js: DEBUG: STT Restart Check: isContinuousConversationActive=${isContinuousConversationActive}, voiceService.isRecognitionActive=${voiceService.isRecognitionActive}`);
                    if (isContinuousConversationActive && !voiceService.isRecognitionActive) {
                        console.log("Main.js: Conditions met. Restarting STT now.");
                        voiceService.startRecognition();
                    } else {
                        let logMessage = "Main.js: Conditions NOT met to restart STT. ";
                        if (!isContinuousConversationActive) logMessage += "Continuous mode is OFF. ";
                        if (voiceService.isRecognitionActive) logMessage += "VoiceService is ALREADY active. ";
                        console.log(logMessage.trim());
                    }
                }, 750);
            } else {
                console.log("Main.js: Continuous conversation NOT active, STT will not restart automatically.");
            }
        } else { 
            if (isContinuousConversationActive) {
                console.log("Main.js: Auto-sent prompt was empty, but continuous mode is on. Restarting STT.");
                setTimeout(() => {
                    if (isContinuousConversationActive && !voiceService.isRecognitionActive) {
                        voiceService.startRecognition();
                    }
                }, 100); 
            }
        }
    }
    
    function handleSttResult(text) {
        userInput.value = text;
    }

    function handleSttError(error) {
        console.error("Main.js: STT Error:", error);
        isContinuousConversationActive = false; 
    }

    function handleSttListeningState(isListening) {
        if (isListening) {
            micButton.textContent = '...'; 
            micButton.classList.add('listening');
        } else {
            micButton.textContent = '🎤';
            micButton.classList.remove('listening');
        }
    }

    function setupPersonaAutoSave() {
        const personaPromptTextarea = personaPanelContainer.querySelector('#persona-prompt');
        if (personaPromptTextarea) {
            personaPromptTextarea.addEventListener('input', () => {
                localStorage.setItem('draftPersonaPrompt', personaPromptTextarea.value);
            });
        }
    }

    function setupPersonaClickToClose() {
        // Close when clicking on the overlay (not the panel itself)
        personaPanelContainer.addEventListener('click', (event) => {
            if (event.target === personaPanelContainer) {
                hidePersonaPanel();
            }
        });
        
        // Prevent clicks inside the panel from closing it
        const personaPanel = personaPanelContainer.querySelector('.persona-panel');
        if (personaPanel) {
            personaPanel.addEventListener('click', (event) => {
                event.stopPropagation();
            });
        }
    }

    function hidePersonaPanel() {
        personaPanelContainer.classList.remove('visible');
    }

    function showPersonaPanel() {
        personaPanelContainer.classList.add('visible');
    }

    async function loadPersonaPanel() {
        try {
            const response = await fetch('persona.html');
            if (!response.ok) {
                throw new Error(`Failed to load persona panel: ${response.statusText}`);
            }
            const html = await response.text();
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            const personaPanelElement = tempDiv.querySelector('.persona-panel');

            if (personaPanelElement) {
                personaPanelContainer.innerHTML = '';
                personaPanelContainer.appendChild(personaPanelElement);

                setupPersonaAutoSave();
                setupPersonaClickToClose();

                // Load draft text if it exists
                const personaPromptTextarea = personaPanelContainer.querySelector('#persona-prompt');
                const draftPersonaPrompt = localStorage.getItem('draftPersonaPrompt');
                if (draftPersonaPrompt && personaPromptTextarea) {
                    personaPromptTextarea.value = draftPersonaPrompt;
                }

                // Set up button event listeners
                const createPersonaButton = personaPanelContainer.querySelector('#create-persona-button');
                const useRandomPersonaButton = personaPanelContainer.querySelector('#use-random-persona-button');
                const cancelPersonaButton = personaPanelContainer.querySelector('#cancel-persona-button');

                if (createPersonaButton) {
                    createPersonaButton.addEventListener('click', () => {
                        const personaText = personaPromptTextarea ? personaPromptTextarea.value.trim() : '';
                        if (personaText) {
                            createPersona(personaText);
                        } else {
                            alert('Please enter a persona description.');
                        }
                    });
                }

                if (useRandomPersonaButton) {
                    useRandomPersonaButton.addEventListener('click', () => {
                        createPersona(null); // null means use random/default persona
                    });
                }

                if (cancelPersonaButton) {
                    cancelPersonaButton.addEventListener('click', hidePersonaPanel);
                }

                // Set up example button event listeners
                const exampleButtons = personaPanelContainer.querySelectorAll('.example-button');
                exampleButtons.forEach(button => {
                    button.addEventListener('click', () => {
                        const personaText = button.getAttribute('data-persona');
                        if (personaPromptTextarea && personaText) {
                            personaPromptTextarea.value = personaText;
                            localStorage.setItem('draftPersonaPrompt', personaText);
                        }
                    });
                });

            } else {
                console.error('Could not find .persona-panel in persona.html');
            }
        } catch (error) {
            console.error('Error loading persona panel:', error);
            personaPanelContainer.innerHTML = '<div class="persona-panel"><p>Error loading persona creator. Please try again.</p></div>';
        }
    }

    function createPersona(customPersonaPrompt) {
        // Clear the chat window completely
        chatWindow.innerHTML = '';
        
        // Set the custom persona prompt
        currentPersonaPrompt = customPersonaPrompt;
        personaCreated = true;

        // ALWAYS clear any existing persona from localStorage first
        localStorage.removeItem('currentPersonaPrompt');
        localStorage.removeItem('draftPersonaPrompt'); // Clear the draft

        // Only save custom persona to localStorage if it exists
        if (customPersonaPrompt) {
            localStorage.setItem('currentPersonaPrompt', customPersonaPrompt);
        }

        // Create completely new LLM service to ensure fresh start
        llmService = new LLMService(currentLlmApiUrl, currentLlmProvider, currentLlmModelIdentifier, currentLlmApiKey);
        
        // IMPORTANT: Clear conversation history for new persona (this also clears localStorage)
        llmService.clearConversationHistory();
        
        // If we have a custom persona, inject it into the conversation history
        if (currentPersonaPrompt) {
            llmService.setCustomPersona(currentPersonaPrompt);
        }
        // If currentPersonaPrompt is null, the LLM service will use default character generation

        hidePersonaPanel();
        
        // Re-add the welcome message first
        addWelcomeMessage();
        
        // Show success message
        const successMessage = document.createElement('div');
        successMessage.classList.add('message', 'llm-message');
        successMessage.textContent = customPersonaPrompt 
            ? 'Persona created successfully! You can now start chatting.' 
            : 'Random persona will be generated. You can now start chatting.';
        chatWindow.appendChild(successMessage);
        chatWindow.scrollTop = chatWindow.scrollHeight;

        console.log('Persona created:', customPersonaPrompt || 'Random persona (will be auto-generated)');
    }

    // Update the addWelcomeMessage function to always allow persona creation
    function addWelcomeMessage() {
        const welcomeElement = document.createElement('div');
        welcomeElement.classList.add('message', 'welcome-message');
        
        const welcomeText = "Welcome to Veil";
        const letterSpans = welcomeText.split('').map((char, index) => {
            if (char === ' ') {
                return ' ';
            }
            return `<span class="animated-letter" style="animation-delay: ${index * 0.1}s">${char}</span>`;
        }).join('');
        
        welcomeElement.innerHTML = letterSpans;
        
        // Add click event listener to the welcome message - ALWAYS allow persona creation
        welcomeElement.addEventListener('click', async () => {
            console.log('Welcome message clicked - opening persona creator');
            
            // Reset persona state to allow new character creation
            personaCreated = false;
            currentPersonaPrompt = null;
            
            // Clear any existing persona from localStorage
            localStorage.removeItem('currentPersonaPrompt');
            localStorage.removeItem('draftPersonaPrompt');
            
            // Reset the LLM service conversation history
            if (llmService) {
                // Create a fresh LLM service to clear all conversation history
                llmService = new LLMService(currentLlmApiUrl, currentLlmProvider, currentLlmModelIdentifier, currentLlmApiKey);
            }
            
            // Clear the chat window except for the welcome message
            const welcomeMessage = chatWindow.querySelector('.welcome-message');
            chatWindow.innerHTML = '';
            if (welcomeMessage) {
                chatWindow.appendChild(welcomeMessage);
            }
            
            // Load and show the persona panel
            if (!personaPanelContainer.querySelector('.persona-panel')) {
                await loadPersonaPanel();
            }
            showPersonaPanel();
        });
        
        chatWindow.appendChild(welcomeElement);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    voiceService = new VoiceService(handleSttResult, handleSttError, handleSttListeningState, handleSttAutoSend);

    const fullScreenImageViewer = document.createElement('div');
    fullScreenImageViewer.id = 'fullscreen-image-viewer';
    const fullScreenImage = document.createElement('img');
    fullScreenImage.id = 'fullscreen-image';
    fullScreenImageViewer.appendChild(fullScreenImage);
    document.body.appendChild(fullScreenImageViewer);

    fullScreenImageViewer.addEventListener('click', () => {
        fullScreenImageViewer.style.display = 'none';
    });

    if (voiceService.isRecognitionSupported()) {
        micButton.addEventListener('click', () => {
            if (!voiceService.isRecognitionActive) {
                console.log("Main.js: Mic button clicked to START listening.");
                isContinuousConversationActive = true; 
                voiceService.startRecognition();
            } else {
                console.log("Main.js: Mic button clicked to STOP listening.");
                isContinuousConversationActive = false; 
                voiceService.stopRecognition();
            }
        });
    } else {
        micButton.style.display = 'none';
    }

    function setupAutoSave() {
        const autoSaveElements = [
            'llm-provider',
            'llm-api-url', 
            'llm-model-identifier',
            'llm-api-key',
            'image-provider', // Add this line
            'image-api-url',
            'openai-image-api-key', // Add this line
            'image-size', // Add this line
            'image-width',
            'image-height', 
            'image-steps',
            'image-cfg-scale',
            'image-sampler',
            'select-tts-voice',
            'slider-font-size',
            'slider-tts-volume',
            'mic-auto-send-delay'
        ];
        
        autoSaveElements.forEach(elementId => {
            const element = settingsPanelContainer.querySelector(`#${elementId}`);
            if (element) {
                element.addEventListener('input', saveAllSettings);
                element.addEventListener('change', saveAllSettings);
            }
        });
    }

    function setupClickToClose() {
        // Close when clicking on the overlay (not the panel itself)
        settingsPanelContainer.addEventListener('click', (event) => {
            // Check if the click was on the overlay (container) and not the panel
            if (event.target === settingsPanelContainer) {
                hideSettingsPanel();
            }
        });
        
        // Prevent clicks inside the panel from closing it
        const settingsPanel = settingsPanelContainer.querySelector('.settings-panel');
        if (settingsPanel) {
            settingsPanel.addEventListener('click', (event) => {
                event.stopPropagation();
            });
        }
    }

    function saveAllSettings() {
        try {
            // Save LLM settings
            const llmProviderSelect = settingsPanelContainer.querySelector('#llm-provider');
            const llmApiUrlInput = settingsPanelContainer.querySelector('#llm-api-url');
            const llmModelIdentifierInput = settingsPanelContainer.querySelector('#llm-model-identifier');
            const llmApiKeyInput = settingsPanelContainer.querySelector('#llm-api-key');
            
            // Add image provider settings
            const imageProviderSelect = settingsPanelContainer.querySelector('#image-provider');
            const imageApiUrlInput = settingsPanelContainer.querySelector('#image-api-url');
            const openaiImageApiKeyInput = settingsPanelContainer.querySelector('#openai-image-api-key');
            
            if (llmProviderSelect && llmApiUrlInput && llmModelIdentifierInput) {
                let newLlmUrl = llmApiUrlInput.value.trim();
                const newLlmModelId = llmModelIdentifierInput.value.trim();
                const newLlmApiKey = llmApiKeyInput ? llmApiKeyInput.value.trim() : currentLlmApiKey;
                let newImageUrl = imageApiUrlInput ? imageApiUrlInput.value.trim() : currentImageApiUrl;
                const newImageProvider = imageProviderSelect.value;
                const newOpenAIImageApiKey = openaiImageApiKeyInput ? openaiImageApiKeyInput.value.trim() : currentOpenAIImageApiKey;
                
                if (newLlmUrl) newLlmUrl = newLlmUrl.replace(/\/$/, "");
                if (newImageUrl) newImageUrl = newImageUrl.replace(/\/$/, "");

                // Check if LLM settings actually changed
                const llmSettingsChanged = (
                    newLlmUrl !== currentLlmApiUrl ||
                    newLlmModelId !== currentLlmModelIdentifier ||
                    newLlmApiKey !== currentLlmApiKey ||
                    currentLlmProvider !== llmProviderSelect.value
                );

                // Check if image settings changed
                const imageSettingsChanged = (
                    newImageProvider !== currentImageProvider ||
                    newImageUrl !== currentImageApiUrl ||
                    newOpenAIImageApiKey !== currentOpenAIImageApiKey
                );
                
                if (newLlmUrl && llmSettingsChanged) {
                    // Store the old conversation history and persona before creating new service
                    const oldConversationHistory = llmService ? llmService.conversationHistory : null;
                    const oldCharacterInitialized = llmService ? llmService.characterInitialized : false;
                    
                    // Update current values
                    currentLlmApiUrl = newLlmUrl;
                    currentLlmModelIdentifier = newLlmModelId;
                    currentLlmApiKey = newLlmApiKey;

                    localStorage.setItem('customLlmProvider', currentLlmProvider);
                    localStorage.setItem('customLlmApiUrl', currentLlmApiUrl);
                    localStorage.setItem('customLlmModelIdentifier', currentLlmModelIdentifier);
                    localStorage.setItem('customLlmApiKey', currentLlmApiKey);

                    // Create new LLM service
                    llmService = new LLMService(currentLlmApiUrl, currentLlmProvider, currentLlmModelIdentifier, currentLlmApiKey);
                    
                    // Restore the conversation history and character state
                    if (oldConversationHistory && oldConversationHistory.length > 0) {
                        llmService.conversationHistory = [...oldConversationHistory];
                        llmService.characterInitialized = oldCharacterInitialized;
                        console.log('Conversation history preserved after settings change');
                    }
                    
                    // Re-apply custom persona if it exists
                    if (currentPersonaPrompt) {
                        llmService.setCustomPersona(currentPersonaPrompt);
                        console.log('Custom persona re-applied after settings change');
                    }
                }

                if (newImageUrl && newImageUrl !== currentImageApiUrl) {
                    currentImageApiUrl = newImageUrl;
                    localStorage.setItem('customImageApiUrl', currentImageApiUrl);
                    imageService = new ImageService(currentImageApiUrl, currentImageProvider, currentOpenAIImageApiKey);
                }
                
                // Handle image provider settings
                if (imageProviderSelect) {
                    const newImageProvider = imageProviderSelect.value;
                    let newImageUrl = imageApiUrlInput ? imageApiUrlInput.value.trim() : currentImageApiUrl;
                    const newOpenAIImageApiKey = openaiImageApiKeyInput ? openaiImageApiKeyInput.value.trim() : currentOpenAIImageApiKey;
                    
                    if (newImageUrl) newImageUrl = newImageUrl.replace(/\/$/, "");
                    
                    // Check if image settings changed
                    const imageSettingsChanged = (
                        newImageProvider !== currentImageProvider ||
                        newImageUrl !== currentImageApiUrl ||
                        newOpenAIImageApiKey !== currentOpenAIImageApiKey
                    );
                    
                    if (imageSettingsChanged) {
                        currentImageProvider = newImageProvider;
                        currentImageApiUrl = newImageUrl;
                        currentOpenAIImageApiKey = newOpenAIImageApiKey;
                        
                        localStorage.setItem('customImageProvider', currentImageProvider);
                        localStorage.setItem('customImageApiUrl', currentImageApiUrl);
                        localStorage.setItem('customOpenAIImageApiKey', currentOpenAIImageApiKey);
                        
                        // Create new image service with updated settings
                        imageService = new ImageService(currentImageApiUrl, currentImageProvider, currentOpenAIImageApiKey);
                    }
                }
            }
            
            // Save image generation settings
            const imageSize = settingsPanelContainer.querySelector('#image-size');
            const imageWidth = settingsPanelContainer.querySelector('#image-width');
            const imageHeight = settingsPanelContainer.querySelector('#image-height');
            const imageSteps = settingsPanelContainer.querySelector('#image-steps');
            const imageCfgScale = settingsPanelContainer.querySelector('#image-cfg-scale');
            const imageSampler = settingsPanelContainer.querySelector('#image-sampler');
            
            if (imageService) {
                const imageSettings = {};
                
                // OpenAI settings
                if (imageSize) {
                    imageSettings.size = imageSize.value;
                    localStorage.setItem('imageSize', imageSettings.size);
                }
                
                // A1111 settings
                if (imageWidth) {
                    imageSettings.width = parseInt(imageWidth.value);
                    localStorage.setItem('imageWidth', imageSettings.width.toString());
                }
                if (imageHeight) {
                    imageSettings.height = parseInt(imageHeight.value);
                    localStorage.setItem('imageHeight', imageSettings.height.toString());
                }
                if (imageSteps) {
                    imageSettings.steps = parseInt(imageSteps.value);
                    localStorage.setItem('imageSteps', imageSettings.steps.toString());
                }
                if (imageCfgScale) {
                    imageSettings.cfg_scale = parseFloat(imageCfgScale.value);
                    localStorage.setItem('imageCfgScale', imageSettings.cfg_scale.toString());
                }
                if (imageSampler) {
                    imageSettings.sampler_name = imageSampler.value;
                    localStorage.setItem('imageSampler', imageSettings.sampler_name);
                }
                
                // Update imageService with new settings
                imageService.updateSettings(imageSettings);
            }
            
            // Save TTS voice
            const selectTTSVoice = settingsPanelContainer.querySelector('#select-tts-voice');
            if (selectTTSVoice) {
                currentTTSVoiceKeyword = selectTTSVoice.value;
                localStorage.setItem('ttsVoice', currentTTSVoiceKeyword);
            }
            
            // Save other settings
            const micAutoSendDelayInput = settingsPanelContainer.querySelector('#mic-auto-send-delay');
            if (micAutoSendDelayInput && voiceService) {
                const delay = parseInt(micAutoSendDelayInput.value, 10);
                if (!isNaN(delay) && delay >= 500 && delay <= 10000) {
                    voiceService.finalAutoSendDelay = delay;
                    localStorage.setItem('micAutoSendDelay', delay.toString());
                }
            }
            
            console.log('Settings auto-saved successfully');
            
        } catch (error) {
            console.error('Error auto-saving settings:', error);
        }
    }

    function hideSettingsPanel() {
        saveAllSettings(); // Save one final time before closing
        settingsPanelContainer.classList.remove('visible');
    }

    async function loadSettingsPanel() {
        try {
            const response = await fetch('user-settings.html');
            if (!response.ok) {
                throw new Error(`Failed to load settings panel: ${response.statusText}`);
            }
            const html = await response.text();
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            const settingsPanelElement = tempDiv.querySelector('.settings-panel');

            if (settingsPanelElement) {
                settingsPanelContainer.innerHTML = '';
                settingsPanelContainer.appendChild(settingsPanelElement);

                // Remove old button event listeners since buttons are gone
                // Set up auto-save and click-to-close
                setupAutoSave();
                setupClickToClose();

                // Load saved values
                const selectTTSVoice = settingsPanelContainer.querySelector('#select-tts-voice');
                if (selectTTSVoice) {
                    const savedTTSVoice = localStorage.getItem('ttsVoice') || currentTTSVoiceKeyword;
                    selectTTSVoice.value = savedTTSVoice;
                    currentTTSVoiceKeyword = savedTTSVoice;
                }

                const fontSizeSlider = settingsPanelContainer.querySelector('#slider-font-size');
                const fontSizeValueDisplay = settingsPanelContainer.querySelector('#font-size-value');
                if (fontSizeSlider && fontSizeValueDisplay) {
                    fontSizeValueDisplay.textContent = `${fontSizeSlider.value}px`;
                    fontSizeSlider.addEventListener('input', (e) => {
                        fontSizeValueDisplay.textContent = `${e.target.value}px`;
                    });
                }

                const ttsVolumeSlider = settingsPanelContainer.querySelector('#slider-tts-volume');
                const ttsVolumeValueDisplay = settingsPanelContainer.querySelector('#tts-volume-value');
                if (ttsVolumeSlider && ttsVolumeValueDisplay) {
                    ttsVolumeValueDisplay.textContent = `${Math.round(ttsVolumeSlider.value * 100)}%`;
                    ttsVolumeSlider.addEventListener('input', (e) => {
                        ttsVolumeValueDisplay.textContent = `${Math.round(e.target.value * 100)}%`;
                    });
                }

                const micAutoSendDelayInput = settingsPanelContainer.querySelector('#mic-auto-send-delay');
                if (micAutoSendDelayInput && voiceService) {
                    const savedDelay = localStorage.getItem('micAutoSendDelay');
                    if (savedDelay) {
                        micAutoSendDelayInput.value = savedDelay;
                        voiceService.finalAutoSendDelay = parseInt(savedDelay, 10);
                    } else {
                        micAutoSendDelayInput.value = voiceService.finalAutoSendDelay;
                    }
                }

                const llmProviderSelect = settingsPanelContainer.querySelector('#llm-provider');
                const llmApiUrlInput = settingsPanelContainer.querySelector('#llm-api-url');
                const llmModelIdentifierInput = settingsPanelContainer.querySelector('#llm-model-identifier');
                const llmApiKeyInput = settingsPanelContainer.querySelector('#llm-api-key');
                const modelIdentifierItem = settingsPanelContainer.querySelector('#model-identifier-item');
                const apiKeyItem = settingsPanelContainer.querySelector('#api-key-item');
                const imageProviderSelect = settingsPanelContainer.querySelector('#image-provider');
                const imageApiUrlInput = settingsPanelContainer.querySelector('#image-api-url');
                const openaiImageApiKeyInput = settingsPanelContainer.querySelector('#openai-image-api-key');

                function toggleModelIdentifierVisibility() {
                    const provider = llmProviderSelect.value;
                    if (provider === 'lmstudio') {
                        llmApiUrlInput.placeholder = "e.g., http://localhost:1234/v1";
                        if (modelIdentifierItem) modelIdentifierItem.style.display = 'none';
                        if (llmModelIdentifierInput) llmModelIdentifierInput.placeholder = "Usually not needed for LMStudio";
                        if (apiKeyItem) apiKeyItem.style.display = 'none';
                    } else if (provider === 'ollama' || provider === 'litellm') {
                        llmApiUrlInput.placeholder = "e.g., http://localhost:4000";
                        if (modelIdentifierItem) modelIdentifierItem.style.display = 'flex';
                        if (llmModelIdentifierInput) llmModelIdentifierInput.placeholder = "e.g., ollama/cydonia-24b-v2.1:latest";
                        if (apiKeyItem) apiKeyItem.style.display = 'flex';
                    }
                }

                // Set initial values
                if (llmProviderSelect) {
                    llmProviderSelect.value = currentLlmProvider;
                    llmProviderSelect.addEventListener('change', () => {
                        currentLlmProvider = llmProviderSelect.value;
                        toggleModelIdentifierVisibility();
                    });
                }

                if (llmApiUrlInput) llmApiUrlInput.value = currentLlmApiUrl;
                if (llmModelIdentifierInput) llmModelIdentifierInput.value = currentLlmModelIdentifier;
                if (llmApiKeyInput) llmApiKeyInput.value = currentLlmApiKey;
                if (imageApiUrlInput) imageApiUrlInput.value = currentImageApiUrl;

                toggleModelIdentifierVisibility();
                setupImageControls();

            } else {
                console.error('Could not find .settings-panel in user-settings.html');
            }
        } catch (error) {
            console.error('Error loading settings panel:', error);
            settingsPanelContainer.innerHTML = '<p>Error loading settings. Please try again.</p>';
        }
    }

    settingsButton.addEventListener('click', async () => {
        if (!settingsPanelContainer.classList.contains('visible')) {
            if (!settingsPanelContainer.querySelector('.settings-panel')) {
                await loadSettingsPanel(); 
            }
            settingsPanelContainer.classList.add('visible');
        } else {
            settingsPanelContainer.classList.remove('visible');
        }
    });

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
                fullScreenImage.alt = img.alt;
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
            console.log("Main.js: Attempting to speak LLM response via TTS.");
            try {
                await voiceService.speak(textToSpeak, currentTTSVoiceKeyword);
                console.log("Main.js: TTS for LLM response likely finished.");
            } catch (error) {
                console.error("Main.js: Error during TTS speak:", error);
            }
        }
    }

    async function handleUserInput() {
        const messageText = userInput.value.trim();
        if (!messageText) {
            console.log("Main.js: handleUserInput called with empty messageText.");
            return;
        }

        await addMessage(messageText, 'user');
        userInput.value = '';

        try {
            const llmResponseDetails = await llmService.sendMessage(messageText);
            console.log("Main.js: Received from llmService.sendMessage:", llmResponseDetails); // For debugging

            if (llmResponseDetails.type === 'image_request' && llmResponseDetails.prompt) { // Changed from 'text_and_image_request'
                // This was the "show me" flow in llmService
                // if (llmResponseDetails.text_content) { // If llmService also sent introductory text
                //    await addMessage(llmResponseDetails.text_content, 'llm');
                // }
                try {
                    const imageUrl = await imageService.generateImage(llmResponseDetails.prompt);
                    if (imageUrl) {
                        await addMessage({ type: 'image', url: imageUrl, alt: llmResponseDetails.prompt }, 'llm');
                    } else {
                        await addMessage({ text: "(Image generation failed or no URL returned)", type: 'error' }, 'llm');
                    }
                } catch (imageError) {
                    console.error("Main.js: Error generating image:", imageError);
                    await addMessage({ text: `(Error generating image: ${imageError.message})`, type: 'error' }, 'llm');
                }
            } else if (llmResponseDetails.type === 'text' && llmResponseDetails.content) { // Changed from 'text_only' and 'text_content'
                await addMessage(llmResponseDetails.content, 'llm');
            } else if (llmResponseDetails.type === 'error') { // Added to handle explicit error type from llmService
                 await addMessage({ text: llmResponseDetails.content || "An unspecified error occurred in LLMService.", type: 'error' }, 'llm');
            }
             else {
                console.warn("Main.js: Received unknown or incomplete response type from LLMService:", llmResponseDetails);
                await addMessage({ text: "(Received an unexpected response format from the LLM)", type: 'error' }, 'llm');
            }

        } catch (error) {
            console.error("Main.js: Error in handleUserInput after llmService.sendMessage:", error);
            await addMessage({ text: `Error: Could not connect to the LLM. ${error.message}`, type: 'error' }, 'llm');
        }
    }

    sendButton.addEventListener('click', handleUserInput);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleUserInput();
        }
    });

    // Initial population of TTS voices if supported
    if (voiceService.isSynthesisSupported()) {
        // Check if the method exists before calling it
        if (typeof voiceService.populateVoiceList === 'function') {
            voiceService.populateVoiceList(document.getElementById('select-tts-voice'));
        } else {
            // Alternative: populate voices manually
            voiceService._populateVoiceList("DOMContentLoaded initialization");
        }
    } else {
        const ttsSettings = document.querySelectorAll('#select-tts-voice, #slider-tts-volume, #tts-volume-value');
        ttsSettings.forEach(el => {
            if (el && el.parentElement && el.parentElement.classList.contains('setting-item')) {
                el.parentElement.style.display = 'none';
            }
        });
    }

    // Add the welcome message after all initialization
    addWelcomeMessage();

    function setupImageControls() {
        const imageControlsHeader = settingsPanelContainer.querySelector('#image-controls-header');
        const imageControlsContent = settingsPanelContainer.querySelector('#image-controls-content');
        const imageProviderSelect = settingsPanelContainer.querySelector('#image-provider');
        
        if (imageControlsHeader && imageControlsContent) {
            // Function to toggle the expanded state
            const toggleExpanded = () => {
                const isExpanded = imageControlsContent.classList.contains('expanded');
                
                if (isExpanded) {
                    imageControlsContent.classList.remove('expanded');
                    imageControlsHeader.classList.remove('expanded');
                } else {
                    imageControlsContent.classList.add('expanded');
                    imageControlsHeader.classList.add('expanded');
                }
            };
            
            // Add click event for desktop
            imageControlsHeader.addEventListener('click', toggleExpanded);
            
            // Add touch events for mobile
            imageControlsHeader.addEventListener('touchstart', function(e) {
                // Prevent default to avoid double-firing with click events
                e.preventDefault();
            }, {passive: false});
            
            imageControlsHeader.addEventListener('touchend', function(e) {
                e.preventDefault();
                toggleExpanded();
            }, {passive: false});
            
            // Add provider change handler
            if (imageProviderSelect) {
                const toggleProviderSettings = () => {
                    const isOpenAI = imageProviderSelect.value === 'openai';
                    const a1111Settings = settingsPanelContainer.querySelectorAll('.a1111-settings');
                    const imageSizeItem = settingsPanelContainer.querySelector('#image-size-item');
                    const imageApiUrlItem = settingsPanelContainer.querySelector('#image-api-url-item');
                    const openaiApiKeyItem = settingsPanelContainer.querySelector('#openai-api-key-item');
                    
                    // Show/hide appropriate settings
                    a1111Settings.forEach(element => {
                        element.style.display = isOpenAI ? 'none' : 'block';
                    });
                    
                    if (imageSizeItem) imageSizeItem.style.display = isOpenAI ? 'flex' : 'none';
                    if (imageApiUrlItem) imageApiUrlItem.style.display = isOpenAI ? 'none' : 'flex';
                    if (openaiApiKeyItem) openaiApiKeyItem.style.display = isOpenAI ? 'flex' : 'none';
                    
                    // Update label
                    const imageApiUrlLabel = settingsPanelContainer.querySelector('#image-api-url-item label');
                    if (imageApiUrlLabel) {
                        imageApiUrlLabel.textContent = isOpenAI ? 'A1111 API URL' : 'A1111 API URL';
                    }
                };
                
                imageProviderSelect.addEventListener('change', toggleProviderSettings);
                
                // Set initial state
                imageProviderSelect.value = currentImageProvider;
                toggleProviderSettings();
            }
            
            // Load saved values from localStorage
            const savedImageSettings = {
                provider: localStorage.getItem('customImageProvider') || 'a1111',
                size: localStorage.getItem('imageSize') || '1024x1024',
                width: localStorage.getItem('imageWidth') || '1024',
                height: localStorage.getItem('imageHeight') || '1536',
                steps: localStorage.getItem('imageSteps') || '20',
                cfgScale: localStorage.getItem('imageCfgScale') || '1.4',
                sampler: localStorage.getItem('imageSampler') || 'Euler a'
            };
            
            // Set the values in the form
            if (imageProviderSelect) imageProviderSelect.value = savedImageSettings.provider;
            const imageSize = settingsPanelContainer.querySelector('#image-size');
            const imageWidth = settingsPanelContainer.querySelector('#image-width');
            const imageHeight = settingsPanelContainer.querySelector('#image-height');
            const imageSteps = settingsPanelContainer.querySelector('#image-steps');
            const imageCfgScale = settingsPanelContainer.querySelector('#image-cfg-scale');
            const imageSampler = settingsPanelContainer.querySelector('#image-sampler');
            const openaiImageApiKeyInput = settingsPanelContainer.querySelector('#openai-image-api-key');
            
            if (imageSize) imageSize.value = savedImageSettings.size;
            if (imageWidth) imageWidth.value = savedImageSettings.width;
            if (imageHeight) imageHeight.value = savedImageSettings.height;
            if (imageSteps) imageSteps.value = savedImageSettings.steps;
            if (imageCfgScale) imageCfgScale.value = savedImageSettings.cfgScale;
            if (imageSampler) imageSampler.value = savedImageSettings.sampler;
            if (openaiImageApiKeyInput) openaiImageApiKeyInput.value = currentOpenAIImageApiKey;
            
            // Update imageService with saved values
            if (imageService) {
                imageService.updateSettings({
                    provider: savedImageSettings.provider,
                    size: savedImageSettings.size,
                    width: parseInt(savedImageSettings.width),
                    height: parseInt(savedImageSettings.height),
                    steps: parseInt(savedImageSettings.steps),
                    cfg_scale: parseFloat(savedImageSettings.cfgScale),
                    sampler_name: savedImageSettings.sampler,
                    openaiApiKey: currentOpenAIImageApiKey
                });
            }
            
            // Add real-time update listeners for immediate effect
            function updateImageSettingsRealTime() {
                if (imageService && imageWidth && imageHeight && imageSteps && imageCfgScale && imageSampler) {
                    const settings = {
                        width: parseInt(imageWidth.value),
                        height: parseInt(imageHeight.value),
                        steps: parseInt(imageSteps.value),
                        cfg_scale: parseFloat(imageCfgScale.value),
                        sampler_name: imageSampler.value
                    };
                    imageService.updateSettings(settings);
                    console.log("Image settings updated in real-time:", settings);
                }
            }
            
            // Add event listeners for real-time updates
            if (imageWidth) imageWidth.addEventListener('input', updateImageSettingsRealTime);
            if (imageHeight) imageHeight.addEventListener('input', updateImageSettingsRealTime);
            if (imageSteps) imageSteps.addEventListener('input', updateImageSettingsRealTime);
            if (imageCfgScale) imageCfgScale.addEventListener('input', updateImageSettingsRealTime);
            if (imageSampler) imageSampler.addEventListener('change', updateImageSettingsRealTime);
        }
    }

    // Load saved persona on startup
    const savedPersonaPrompt = localStorage.getItem('currentPersonaPrompt');
    if (savedPersonaPrompt) {
        currentPersonaPrompt = savedPersonaPrompt;
        personaCreated = true;
        // Set the persona in the LLM service when it's created
        if (llmService) {
            llmService.setCustomPersona(currentPersonaPrompt);
        }
    }
});