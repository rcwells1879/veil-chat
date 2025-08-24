// Desktop Interface Management
// Handles navigation, settings synchronization, and desktop-specific functionality

class DesktopInterface {
    constructor() {
        this.currentView = 'chat';
        this.isDesktop = window.innerWidth >= 1024;
        this.settingsSync = new Map();
        this.initialized = false;
        
        // Desktop settings ID mapping
        this.desktopSettingsIdMap = {
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
            azureApiKey: 'desktop-azure-api-key',
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
        
        this.init();
    }

    async init() {
        if (!this.isDesktop || this.initialized) return;
        
        this.setupNavigation();
        this.setupDesktopChat();
        this.handleResize();
        
        // Load settings from localStorage immediately
        this.loadSettingsFromStorage();
        
        // Initialize mobile settings panel first
        await this.initializeMobileSettings();
        
        // Then setup sync
        this.setupSettingsSync();
        this.setupPersonaSync();
        
        this.initialized = true;
        console.log('Desktop interface initialized');
    }

    async initializeMobileSettings() {
        // The mobile settings panel should already be loaded by main.js proactively
        // Just verify it exists - no complex waiting needed
        const panelExists = document.querySelector('#settings-panel-container .settings-panel');
        if (panelExists) {
            console.log('✅ Mobile settings panel already available for desktop sync');
        } else {
            console.log('⚠️ Mobile settings panel not yet loaded - desktop will use localStorage directly');
        }
    }

    setupNavigation() {
        const chatNav = document.getElementById('desktop-chat-nav');
        const personaNav = document.getElementById('desktop-persona-nav');
        const settingsNav = document.getElementById('desktop-settings-nav');

        const chat = document.querySelector('.desktop-chat');
        const settings = document.querySelector('.desktop-settings');
        const persona = document.querySelector('.desktop-persona');

        // Navigation click handlers
        chatNav?.addEventListener('click', () => this.switchView('chat'));
        personaNav?.addEventListener('click', () => this.switchView('persona'));
        settingsNav?.addEventListener('click', () => this.switchView('settings'));

    }

    switchView(view) {
        // Auto-save settings if leaving the settings view
        if (this.currentView === 'settings' && view !== 'settings') {
            if (window.saveAllSettings && typeof window.saveAllSettings === 'function') {
                // Settings save automatically - no manual save needed
                this.showNotification('Settings saved automatically');
            }
        }

        // Remove active class from all nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        // Hide all content areas
        const contentAreas = [
            '.desktop-chat', 
            '.desktop-settings',
            '.desktop-persona'
        ];
        
        contentAreas.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) element.style.display = 'none';
        });

        // Show selected view and activate nav
        switch(view) {
            case 'settings':
                document.querySelector('.desktop-settings').style.display = 'block';
                document.getElementById('desktop-settings-nav').classList.add('active');
                this.currentView = 'settings';
                // Setup handlers when settings panel is opened
                this.setupDesktopSettingsHandlers();
                break;
            case 'persona':
                document.querySelector('.desktop-persona').style.display = 'block';
                document.getElementById('desktop-persona-nav').classList.add('active');
                this.currentView = 'persona';
                break;
            default:
                // Default to chat view
                document.querySelector('.desktop-chat').style.display = 'flex';
                document.getElementById('desktop-chat-nav').classList.add('active');
                this.currentView = 'chat';
        }

        // Add fade-in animation
        const activeContent = document.querySelector(
            this.currentView === 'chat' ? '.desktop-chat' :
            this.currentView === 'settings' ? '.desktop-settings' :
            '.desktop-persona'
        );
        if (activeContent) {
            activeContent.classList.add('fade-in');
            setTimeout(() => activeContent.classList.remove('fade-in'), 500);
        }
    }


    setupSettingsSync() {
        // Desktop interface uses purely localStorage-based settings
        // No complex mobile-to-desktop syncing needed - both use same localStorage keys
        this.setupDesktopSettingsHandlers();

        // Setup conversation buttons
        const saveConvButton = document.getElementById('desktop-save-conversation');
        const loadConvButton = document.getElementById('desktop-load-conversation');
        
        if (saveConvButton) {
            saveConvButton.addEventListener('click', () => {
                const mobileButton = document.getElementById('save-conversation-button');
                if (mobileButton) mobileButton.click();
            });
        }
        
        if (loadConvButton) {
            loadConvButton.addEventListener('click', () => {
                const mobileButton = document.getElementById('load-conversation-button');
                if (mobileButton) mobileButton.click();
            });
        }
    }



    setupDesktopSettingsHandlers() {
        
        // Load all settings from localStorage when settings panel is opened
        this.loadSettingsFromLocalStorage();
        
        // Setup save handlers for all desktop settings elements
        Object.keys(this.desktopSettingsIdMap).forEach(settingsKey => {
            const desktopId = this.desktopSettingsIdMap[settingsKey];
            const element = document.getElementById(desktopId);
            
            
            if (element) {
                
                // Save on change
                element.addEventListener('change', () => {
                    this.saveSettingToLocalStorage(settingsKey, element);
                    this.updateSettingsDisplay(desktopId);
                    
                    // Handle provider-specific section visibility
                    if (desktopId === 'desktop-llm-provider') {
                        this.toggleProviderSections(element.value);
                    } else if (desktopId === 'desktop-image-provider') {
                        this.toggleImageProviderSections(element.value);
                    }
                });
                
                // Save on input (for real-time saving)
                element.addEventListener('input', () => {
                    this.saveSettingToLocalStorage(settingsKey, element);
                    this.updateSettingsDisplay(desktopId);
                });
            }
        });
    }

    loadSettingsFromLocalStorage() {
        
        Object.keys(this.desktopSettingsIdMap).forEach(settingsKey => {
            const desktopId = this.desktopSettingsIdMap[settingsKey];
            const element = document.getElementById(desktopId);
            
            if (element) {
                let value = localStorage.getItem(settingsKey);
                
                // Special handling for Azure API key fallback
                if (settingsKey === 'azureApiKey' && (!value || value === '')) {
                    value = localStorage.getItem('azure-api-key') || '';
                }
                
                if (element.type === 'checkbox') {
                    element.checked = value === 'true' || value === true;
                } else if (element.type === 'range') {
                    element.value = value || element.defaultValue || '1';
                    // Trigger display update for ranges
                    element.dispatchEvent(new Event('input'));
                } else {
                    element.value = value || '';
                }
                
            }
        });
        
        // Update provider sections after loading
        const llmProviderElement = document.getElementById('desktop-llm-provider');
        if (llmProviderElement && llmProviderElement.value) {
            this.toggleProviderSections(llmProviderElement.value);
        }
        
        // Update image provider sections after loading
        const imageProviderElement = document.getElementById('desktop-image-provider');
        if (imageProviderElement && imageProviderElement.value) {
            this.toggleImageProviderSections(imageProviderElement.value);
        }
    }

    saveSettingToLocalStorage(settingsKey, element) {
        const value = element.type === 'checkbox' ? element.checked : element.value;
        localStorage.setItem(settingsKey, value);
        
        // Update global SETTINGS object if available
        if (window.SETTINGS) {
            window.SETTINGS[settingsKey] = value;
        }
        
        // Smart service reinitialization based on element type and setting importance
        if (window.smartServiceReinit && typeof window.smartServiceReinit === 'function') {
            window.smartServiceReinit(settingsKey, element.type);
        }
    }

    syncSettingsToDesktop() {
        // Simply reload from localStorage - no complex mobile-to-desktop sync needed
        this.loadSettingsFromLocalStorage();
    }


    updateSettingsDisplay(elementId) {
        // Update range slider displays
        if (elementId === 'desktop-font-size') {
            const slider = document.getElementById(elementId);
            const display = document.getElementById('desktop-font-size-value');
            if (slider && display) {
                display.textContent = slider.value + 'px';
            }
        } else if (elementId === 'desktop-voice-speed') {
            const slider = document.getElementById(elementId);
            const display = document.getElementById('desktop-voice-speed-value');
            if (slider && display) {
                display.textContent = slider.value + 'x';
            }
        } else if (elementId === 'desktop-voice-pitch') {
            const slider = document.getElementById(elementId);
            const display = document.getElementById('desktop-voice-pitch-value');
            if (slider && display) {
                display.textContent = slider.value;
            }
        }
    }

    toggleProviderSections(provider) {
        console.log(`=== Desktop toggleProviderSections called for: ${provider} ===`);
        
        // Get standard desktop setting elements
        const apiUrlItem = document.getElementById('desktop-llm-api-url')?.parentElement;
        const modelItem = document.getElementById('desktop-llm-model')?.parentElement;
        const apiKeyItem = document.getElementById('desktop-llm-api-key')?.parentElement;
        
        console.log('Standard elements found:', {
            apiUrlItem: !!apiUrlItem,
            modelItem: !!modelItem,
            apiKeyItem: !!apiKeyItem
        });
        
        // Hide all direct API sections first
        const sections = ['desktop-openai-direct-settings', 'desktop-anthropic-direct-settings', 'desktop-google-direct-settings'];
        sections.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            console.log(`Section ${sectionId}: found=${!!section}`);
            if (section) {
                section.style.display = 'none';
                console.log(`Hidden section: ${sectionId}`);
            }
        });

        if (provider === 'openai-direct') {
            console.log('Setting up OpenAI direct provider...');
            // Hide standard settings, show OpenAI direct settings
            if (modelItem) {
                modelItem.style.display = 'none';
                console.log('Hidden standard model item');
            }
            if (apiKeyItem) {
                apiKeyItem.style.display = 'none';
                console.log('Hidden standard API key item');
            }
            if (apiUrlItem) {
                apiUrlItem.style.display = 'none';
                console.log('Hidden standard API URL item');
            }
            const section = document.getElementById('desktop-openai-direct-settings');
            if (section) {
                section.style.display = 'block';
                // Remove any debug styling
                section.style.background = '';
                section.style.backgroundColor = '';
                console.log('✅ Shown OpenAI direct settings section');
            } else {
                console.error('❌ OpenAI direct settings section not found!');
            }
        } else if (provider === 'anthropic-direct') {
            console.log('Setting up Anthropic direct provider...');
            // Hide standard settings, show Anthropic direct settings
            if (modelItem) modelItem.style.display = 'none';
            if (apiKeyItem) apiKeyItem.style.display = 'none';
            if (apiUrlItem) apiUrlItem.style.display = 'none';
            const section = document.getElementById('desktop-anthropic-direct-settings');
            if (section) {
                section.style.display = 'block';
                console.log('✅ Shown Anthropic direct settings section');
            } else {
                console.error('❌ Anthropic direct settings section not found!');
            }
        } else if (provider === 'google-direct') {
            console.log('Setting up Google direct provider...');
            // Hide standard settings, show Google direct settings
            if (modelItem) modelItem.style.display = 'none';
            if (apiKeyItem) apiKeyItem.style.display = 'none';
            if (apiUrlItem) apiUrlItem.style.display = 'none';
            const section = document.getElementById('desktop-google-direct-settings');
            if (section) {
                section.style.display = 'block';
                console.log('✅ Shown Google direct settings section');
            } else {
                console.error('❌ Google direct settings section not found!');
            }
        } else {
            console.log(`Setting up traditional provider: ${provider}`);
            // Traditional providers (litellm, lmstudio, ollama) - show standard settings
            if (apiUrlItem) {
                apiUrlItem.style.display = 'flex';
                console.log('Shown standard API URL item');
            }
            if (apiKeyItem) {
                apiKeyItem.style.display = 'flex';
                console.log('Shown standard API key item');
            }
            if (modelItem) {
                modelItem.style.display = 'flex';
                console.log('Shown standard model item');
            }
        }
        
        console.log(`=== Desktop provider sections update completed for: ${provider} ===`);
    }

    toggleImageProviderSections(provider) {
        // Hide all image provider sections
        const sections = ['desktop-a1111-settings', 'desktop-swarmui-settings', 'desktop-openai-settings'];
        sections.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section) {
                section.style.display = 'none';
            }
        });

        // Show relevant section based on provider
        let targetSection = null;
        if (provider === 'a1111') {
            targetSection = 'desktop-a1111-settings';
        } else if (provider === 'swarmui') {
            targetSection = 'desktop-swarmui-settings';
        } else if (provider === 'openai') {
            targetSection = 'desktop-openai-settings';
        }

        if (targetSection) {
            const section = document.getElementById(targetSection);
            if (section) {
                section.style.display = 'block';
                // Re-setup event handlers for newly visible elements
                this.setupEventHandlersForSection(targetSection);
            }
        }
    }

    setupEventHandlersForSection(sectionId) {
        // Setup event handlers for elements within a specific section
        const section = document.getElementById(sectionId);
        if (!section) return;

        // Find all input elements within this section
        const inputs = section.querySelectorAll('input, select, textarea');
        
        inputs.forEach(element => {
            const elementId = element.id;
            
            // Find the corresponding settings key
            let settingsKey = null;
            Object.entries(this.desktopSettingsIdMap).forEach(([key, id]) => {
                if (id === elementId) {
                    settingsKey = key;
                }
            });
            
            if (settingsKey) {
                // Remove any existing listeners to prevent duplicates
                const newElement = element.cloneNode(true);
                element.parentNode.replaceChild(newElement, element);
                
                // Add fresh event listeners
                newElement.addEventListener('change', () => {
                    this.saveSettingToLocalStorage(settingsKey, newElement);
                    this.updateSettingsDisplay(elementId);
                });
                
                newElement.addEventListener('input', () => {
                    this.saveSettingToLocalStorage(settingsKey, newElement);
                    this.updateSettingsDisplay(elementId);
                });
                
                // Load current value from localStorage
                const currentValue = localStorage.getItem(settingsKey);
                if (currentValue && newElement.value !== currentValue) {
                    if (newElement.type === 'checkbox') {
                        newElement.checked = currentValue === 'true';
                    } else {
                        newElement.value = currentValue;
                    }
                }
            }
        });
    }

    setupPersonaSync() {
        const createButton = document.getElementById('desktop-create-persona');
        const randomButton = document.getElementById('desktop-use-random-persona');
        const clearButton = document.getElementById('desktop-clear-persona');
        
        // Remove any existing event listeners to prevent duplicates
        if (createButton && !createButton.hasDesktopListener) {
            createButton.hasDesktopListener = true;
            createButton.addEventListener('click', async () => {
                const name = document.getElementById('desktop-persona-name').value;
                let prompt = document.getElementById('desktop-persona-prompt').value;
                
                if (!prompt) {
                    this.showNotification('Please enter a persona description');
                    return;
                }
                
                // 🔒 SECURITY: Validate persona prompt before processing (same as mobile interface)
                if (window.securityValidator) {
                    const validation = window.securityValidator.validateUserInput(prompt, 'characterPrompt');
                    if (!validation.isValid) {
                        console.warn('🔒 Security: Desktop persona prompt blocked due to validation failure:', validation.violations);
                        window.securityValidator.logSecurityEvent('DESKTOP_PERSONA_BLOCKED', {
                            prompt: prompt,
                            violations: validation.violations,
                            riskLevel: validation.riskLevel,
                            source: 'desktop-persona-creation'
                        });
                        
                        this.showNotification('⚠️ Your persona description contains potentially unsafe content and was blocked for security reasons. Please rephrase your persona.');
                        return; // Block the persona creation
                    }
                    
                    console.log('🔒 Security: Desktop persona prompt validated and sanitized');
                    // Use sanitized prompt for persona creation
                    const sanitizedPrompt = validation.sanitizedInput;
                    
                    if (sanitizedPrompt !== prompt) {
                        this.showNotification('Persona description was sanitized for security');
                        // Update the UI to show sanitized version
                        document.getElementById('desktop-persona-prompt').value = sanitizedPrompt;
                    }
                    
                    // Continue with sanitized prompt
                    prompt = sanitizedPrompt;
                } else {
                    console.warn('🔒 Security: SecurityValidator not available for persona validation');
                }
                
                // Wait for main.js to be loaded and initialize
                let attempts = 0;
                const maxAttempts = 50;
                
                const waitForMainJS = () => {
                    return new Promise((resolve) => {
                        const checkForFunction = () => {
                            if (window.initializeApp && typeof window.createPersona === 'function') {
                                resolve(true);
                            } else if (attempts < maxAttempts) {
                                attempts++;
                                setTimeout(checkForFunction, 100);
                            } else {
                                resolve(false);
                            }
                        };
                        checkForFunction();
                    });
                };
                
                const isReady = await waitForMainJS();
                if (isReady && window.createPersona) {
                    window.createPersona(prompt);
                    this.showNotification(`Custom persona created successfully!`);
                    this.switchView('chat');
                } else {
                    this.showNotification('Error: Persona system not ready. Please try again.');
                }
            });
        }
        
        if (randomButton && !randomButton.hasDesktopListener) {
            randomButton.hasDesktopListener = true;
            randomButton.addEventListener('click', async () => {
                // Wait for main.js persona system
                let attempts = 0;
                const maxAttempts = 50;
                
                const waitForMainJS = () => {
                    return new Promise((resolve) => {
                        const checkForFunction = () => {
                            if (window.createPersona && typeof window.createPersona === 'function') {
                                resolve(true);
                            } else if (attempts < maxAttempts) {
                                attempts++;
                                setTimeout(checkForFunction, 100);
                            } else {
                                resolve(false);
                            }
                        };
                        checkForFunction();
                    });
                };
                
                const isReady = await waitForMainJS();
                if (isReady && window.createPersona) {
                    window.createPersona(null); // null for random persona
                    this.showNotification('Random persona activated!');
                    this.switchView('chat');
                } else {
                    this.showNotification('Error: Persona system not ready. Please try again.');
                }
            });
        }
        
        if (clearButton && !clearButton.hasDesktopListener) {
            clearButton.hasDesktopListener = true;
            clearButton.addEventListener('click', () => {
                // Clear the UI fields
                document.getElementById('desktop-persona-name').value = '';
                document.getElementById('desktop-persona-prompt').value = '';
                
                // Clear persona in main.js
                if (window.clearConversation && typeof window.clearConversation === 'function') {
                    window.clearConversation();
                    this.showNotification('Persona cleared');
                } else {
                    this.showNotification('Persona cleared from UI');
                }
            });
        }

        // Setup template buttons
        document.querySelectorAll('[data-persona]').forEach(button => {
            button.addEventListener('click', () => {
                const personaType = button.dataset.persona;
                this.applyPersonaTemplate(personaType);
            });
        });
    }

    applyPersonaTemplate(type) {
        const templates = {
            teacher: {
                name: 'AI Teacher',
                prompt: 'You are a knowledgeable and patient teacher. Explain concepts clearly, provide examples, ask questions to check understanding, and encourage learning through discovery.'
            },
            assistant: {
                name: 'Professional Assistant', 
                prompt: 'You are a highly efficient and professional assistant. Provide clear, concise answers, help with task management, and maintain a friendly but business-appropriate tone.'
            },
            friend: {
                name: 'Friendly Companion',
                prompt: 'You are a warm, supportive friend who listens well, offers encouragement, and engages in natural, casual conversation with empathy and humor.'
            },
            expert: {
                name: 'Domain Expert',
                prompt: 'You are a subject matter expert with deep knowledge. Provide authoritative, detailed information, cite relevant sources when possible, and explain complex topics thoroughly.'
            },
            creative: {
                name: 'Creative Partner',
                prompt: 'You are a creative collaborator who thinks outside the box, generates innovative ideas, helps with brainstorming, and approaches problems with artistic flair.'
            },
            analyst: {
                name: 'Data Analyst',
                prompt: 'You are an analytical thinker who breaks down complex problems, provides data-driven insights, creates structured analyses, and presents findings clearly.'
            }
        };

        const template = templates[type];
        if (template) {
            document.getElementById('desktop-persona-name').value = template.name;
            document.getElementById('desktop-persona-prompt').value = template.prompt;
            this.showNotification(`${template.name} template applied`);
        }
    }


    setupDesktopChat() {
        const desktopInput = document.getElementById('desktop-user-input');
        const desktopSendButton = document.getElementById('desktop-send-button');
        const desktopSTTButton = document.getElementById('desktop-stt-button');
        const desktopAttachButton = document.getElementById('desktop-attach-files-button');
        const mobileInput = document.getElementById('user-input');
        const mobileSendButton = document.getElementById('send-button');

        if (desktopInput && desktopSendButton && mobileInput && mobileSendButton) {
            // Auto-resize desktop textarea and sync to mobile
            desktopInput.addEventListener('input', () => {
                desktopInput.style.height = 'auto';
                desktopInput.style.height = Math.min(desktopInput.scrollHeight, 200) + 'px';
                // Sync desktop input to mobile input
                mobileInput.value = desktopInput.value;
            });

            // Handle desktop send button
            desktopSendButton.addEventListener('click', () => {
                this.sendMessage();
            });

            // Handle Enter key (without Shift)
            desktopInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });

            // Handle desktop STT button
            if (desktopSTTButton) {
                desktopSTTButton.addEventListener('click', () => {
                    this.toggleDesktopSTT();
                });
            }

            // Handle desktop attach files button
            if (desktopAttachButton) {
                desktopAttachButton.addEventListener('click', () => {
                    this.triggerFileAttachment();
                });
            }

            // Note: Chat sync handled by addMessage() in main.js - no separate sync needed
            
            // Setup STT button state sync
            this.setupSTTStateSync();
        }
    }

    sendMessage() {
        const desktopInput = document.getElementById('desktop-user-input');
        const mobileInput = document.getElementById('user-input');
        
        if (desktopInput && mobileInput) {
            const message = desktopInput.value.trim();
            if (message) {
                // 🔒 SECURITY: Validate user input before processing (same as mobile interface)
                if (window.securityValidator) {
                    const validation = window.securityValidator.validateUserInput(message, 'userMessage');
                    if (!validation.isValid) {
                        console.warn('🔒 Security: Desktop user input blocked due to validation failure:', validation.violations);
                        window.securityValidator.logSecurityEvent('DESKTOP_INPUT_BLOCKED', {
                            message: message,
                            violations: validation.violations,
                            riskLevel: validation.riskLevel,
                            source: 'desktop-interface'
                        });
                        
                        this.showNotification('⚠️ Your message contains potentially unsafe content and was blocked for security reasons. Please rephrase your request.');
                        return; // Block the message from being sent
                    }
                    
                    // Use sanitized input for processing
                    const sanitizedMessage = validation.sanitizedInput;
                    console.log('🔒 Security: Desktop input validated and sanitized');
                    
                    // Copy sanitized message to mobile input and trigger send
                    mobileInput.value = sanitizedMessage;
                    desktopInput.value = '';
                    desktopInput.style.height = 'auto';
                    
                    // Update desktop input to show sanitized version temporarily
                    if (sanitizedMessage !== message) {
                        this.showNotification('Input was sanitized for security');
                    }
                } else {
                    console.warn('🔒 Security: SecurityValidator not available - sending without validation');
                    // Fallback: copy original message if validator not available
                    mobileInput.value = message;
                    desktopInput.value = '';
                    desktopInput.style.height = 'auto';
                }
                
                // Trigger mobile send button
                const mobileSendButton = document.getElementById('send-button');
                if (mobileSendButton) {
                    mobileSendButton.click();
                }
            }
        }
    }


    handleResize() {
        window.addEventListener('resize', () => {
            const wasDesktop = this.isDesktop;
            this.isDesktop = window.innerWidth >= 1024;
            
            if (wasDesktop !== this.isDesktop) {
                // Switched between mobile and desktop
                if (this.isDesktop) {
                    this.init();
                }
            }
        });
    }

    loadSettingsFromStorage() {
        // Use the universal settings loading function from main.js
        if (window.loadAllSettings && typeof window.loadAllSettings === 'function') {
            console.log('Desktop: Using universal loadAllSettings function');
            window.loadAllSettings();
        } else {
            console.warn('Desktop: Universal loadAllSettings not available, settings will load when main.js initializes');
        }
    }



    toggleDesktopSTT() {
        // Use the existing mobile mic button functionality
        const mobileMicButton = document.getElementById('mic-button');
        if (mobileMicButton) {
            console.log('Desktop: Triggering mobile mic button');
            mobileMicButton.click();
        } else {
            this.showNotification('Voice input not available');
        }
    }

    triggerFileAttachment() {
        // Use the existing mobile attach button functionality  
        const mobileAttachButton = document.getElementById('attach-button');
        if (mobileAttachButton) {
            console.log('Desktop: Triggering mobile attach button');
            mobileAttachButton.click();
        } else {
            this.showNotification('File attachment not available');
        }
    }

    setupSTTStateSync() {
        // Check VoiceService state periodically and sync desktop button
        const desktopSTTButton = document.getElementById('desktop-stt-button');
        const desktopInput = document.getElementById('desktop-user-input');
        const mobileInput = document.getElementById('user-input');
        
        if (!desktopSTTButton || !desktopInput || !mobileInput) return;

        // Sync button visual state
        setInterval(() => {
            if (window.voiceService && window.voiceService.isRecognitionActive !== undefined) {
                const isListening = window.voiceService.isRecognitionActive;
                
                if (isListening && !desktopSTTButton.classList.contains('listening')) {
                    desktopSTTButton.classList.add('listening');
                    desktopSTTButton.title = 'Stop Voice Input';
                } else if (!isListening && desktopSTTButton.classList.contains('listening')) {
                    desktopSTTButton.classList.remove('listening');
                    desktopSTTButton.title = 'Voice Input';
                }
            }
        }, 500); // Check every 500ms

        // Sync STT input content from mobile to desktop in real-time
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
                    // Sync value attribute changes
                    desktopInput.value = mobileInput.value;
                    this.autoResizeDesktopInput();
                }
            });
        });

        // Watch for input events on mobile input
        mobileInput.addEventListener('input', () => {
            desktopInput.value = mobileInput.value;
            this.autoResizeDesktopInput();
        });

        // Watch for value changes
        mobileInput.addEventListener('change', () => {
            desktopInput.value = mobileInput.value;
            this.autoResizeDesktopInput();
        });

        // Also check periodically for direct value changes (for STT)
        setInterval(() => {
            if (mobileInput.value !== desktopInput.value) {
                desktopInput.value = mobileInput.value;
                this.autoResizeDesktopInput();
            }
        }, 100); // Check every 100ms during STT
    }

    autoResizeDesktopInput() {
        const desktopInput = document.getElementById('desktop-user-input');
        if (desktopInput) {
            desktopInput.style.height = 'auto';
            desktopInput.style.height = Math.min(desktopInput.scrollHeight, 200) + 'px';
        }
    }

    showNotification(message) {
        // Create a simple notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #00bfff 0%, #8a2be2 100%);
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            font-size: 14px;
            font-weight: 500;
            transform: translateX(300px);
            transition: transform 0.3s cubic-bezier(.25,.8,.25,1);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(300px)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
}

// Initialize desktop interface when DOM is ready (prevent multiple instances)
if (!window.desktopInterface) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (!window.desktopInterface) {
                // Small delay to ensure main.js initialization completes first
                setTimeout(() => {
                    window.desktopInterface = new DesktopInterface();
                }, 100);
            }
        });
    } else {
        // Small delay to ensure main.js initialization completes first
        setTimeout(() => {
            if (!window.desktopInterface) {
                window.desktopInterface = new DesktopInterface();
            }
        }, 100);
    }
}