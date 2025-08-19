// Desktop Interface Management
// Handles navigation, settings synchronization, and desktop-specific functionality

class DesktopInterface {
    constructor() {
        this.currentView = 'dashboard';
        this.isDesktop = window.innerWidth >= 1024;
        this.settingsSync = new Map();
        this.initialized = false;
        
        this.init();
    }

    async init() {
        if (!this.isDesktop || this.initialized) return;
        
        this.setupNavigation();
        this.setupFeatureCards();
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
        // Just wait for it to be available
        const panelExists = document.querySelector('#settings-panel-container .settings-panel');
        if (!panelExists) {
            console.log('Desktop: Waiting for mobile settings panel to be loaded by main.js...');
            await this.waitForMobileSettings();
        } else {
            console.log('Desktop: Mobile settings panel already available');
        }
    }

    setupNavigation() {
        const chatNav = document.getElementById('desktop-chat-nav');
        const personaNav = document.getElementById('desktop-persona-nav');
        const settingsNav = document.getElementById('desktop-settings-nav');

        const dashboard = document.querySelector('.desktop-dashboard');
        const chat = document.querySelector('.desktop-chat');
        const settings = document.querySelector('.desktop-settings');
        const persona = document.querySelector('.desktop-persona');

        // Navigation click handlers
        chatNav?.addEventListener('click', () => this.switchView('chat'));
        personaNav?.addEventListener('click', () => this.switchView('persona'));
        settingsNav?.addEventListener('click', () => this.switchView('settings'));

        // Feature card click handlers to start chat
        document.querySelectorAll('.feature-card').forEach(card => {
            card.addEventListener('click', () => {
                const feature = card.dataset.feature;
                this.startFeatureChat(feature);
            });
        });
    }

    switchView(view) {
        // Auto-save settings if leaving the settings view
        if (this.currentView === 'settings' && view !== 'settings') {
            if (window.saveAllSettings && typeof window.saveAllSettings === 'function') {
                window.saveAllSettings();
                this.showNotification('Settings saved automatically');
            }
        }

        // Remove active class from all nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        // Hide all content areas
        const contentAreas = [
            '.desktop-dashboard',
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
            case 'chat':
                document.querySelector('.desktop-chat').style.display = 'flex';
                document.getElementById('desktop-chat-nav').classList.add('active');
                this.currentView = 'chat';
                break;
            case 'settings':
                document.querySelector('.desktop-settings').style.display = 'block';
                document.getElementById('desktop-settings-nav').classList.add('active');
                this.currentView = 'settings';
                this.syncSettingsToDesktop();
                break;
            case 'persona':
                document.querySelector('.desktop-persona').style.display = 'block';
                document.getElementById('desktop-persona-nav').classList.add('active');
                this.currentView = 'persona';
                break;
            default:
                document.querySelector('.desktop-dashboard').style.display = 'block';
                document.getElementById('desktop-chat-nav').classList.add('active');
                this.currentView = 'dashboard';
        }

        // Add fade-in animation
        const activeContent = document.querySelector(
            this.currentView === 'dashboard' ? '.desktop-dashboard' :
            this.currentView === 'chat' ? '.desktop-chat' :
            this.currentView === 'settings' ? '.desktop-settings' :
            '.desktop-persona'
        );
        if (activeContent) {
            activeContent.classList.add('fade-in');
            setTimeout(() => activeContent.classList.remove('fade-in'), 500);
        }
    }

    startFeatureChat(feature) {
        // Switch to chat view
        this.switchView('chat');
        
        // Add a welcome message for the feature
        const welcomeMessages = {
            'guided-learning': 'Welcome to Guided Learning! I\'ll help you create structured learning plans and break down complex topics into manageable steps.',
            'course-links': 'Course Links activated! I can help you find relevant courses and learning resources for any topic you\'re interested in.',
            'voice-interaction': 'Voice interaction is ready! You can now speak to me and I\'ll respond with natural speech.',
            'image-generation': 'Image generation is active! Describe any image you\'d like me to create and I\'ll generate it for you.',
            'reasoning': 'Enhanced reasoning mode enabled! I\'ll use advanced logical thinking and step-by-step analysis for complex problems.',
            'web-search': 'Web search capabilities activated! I can now search the internet for current information and real-time data.'
        };

        const message = welcomeMessages[feature] || 'Feature activated! How can I help you today?';
        
        // Add system message to chat
        this.addSystemMessage(message);
        
        // Focus the desktop input
        const desktopInput = document.getElementById('desktop-user-input');
        if (desktopInput) {
            setTimeout(() => desktopInput.focus(), 100);
        }
    }

    addSystemMessage(text) {
        const chatWindow = document.getElementById('desktop-chat-window');
        if (!chatWindow) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = 'message llm-message';
        messageDiv.style.background = 'linear-gradient(135deg, rgba(138, 43, 226, 0.2) 0%, rgba(0, 191, 255, 0.2) 100%)';
        messageDiv.style.border = '1px solid rgba(138, 43, 226, 0.3)';
        messageDiv.textContent = text;
        
        chatWindow.appendChild(messageDiv);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    setupSettingsSync() {
        // Map desktop settings to mobile settings
        this.settingsMap = {
            // Font Settings
            'desktop-font-size': 'slider-font-size',
            
            // LLM Provider Settings
            'desktop-llm-provider': 'llm-provider',
            'desktop-llm-api-url': 'llm-api-url',
            'desktop-llm-model': 'llm-model-identifier',
            'desktop-llm-api-key': 'llm-api-key',
            
            // Direct API Provider Settings
            'desktop-openai-model-identifier': 'openai-model-identifier',
            'desktop-openai-api-key': 'openai-api-key',
            'desktop-anthropic-model-identifier': 'anthropic-model-identifier',
            'desktop-anthropic-api-key': 'anthropic-api-key',
            'desktop-google-model-identifier': 'google-model-identifier',
            'desktop-google-api-key': 'google-api-key',
            
            // Voice Settings
            'desktop-tts-voice': 'select-tts-voice',
            'desktop-voice-speed': 'slider-voice-speed',
            'desktop-voice-pitch': 'slider-voice-pitch',
            'desktop-azure-api-key': 'azure-api-key',
            'desktop-azure-region': 'azure-region',
            
            // MCP Settings
            'desktop-mcp-enabled': 'mcp-enabled',
            'desktop-mcp-url': 'mcp-server-url',
            
            // Web Search Settings
            'desktop-search-enabled': 'search-enabled',
            'desktop-search-provider': 'search-provider',
            'desktop-search-api-key': 'search-api-key',
            'desktop-search-results-limit': 'search-results-limit',
            'desktop-search-auto-summarize': 'search-auto-summarize',
            'desktop-search-time-filter': 'search-time-filter',
            
            // Image Generation Settings
            'desktop-image-provider': 'image-provider',
            
            // A1111 Settings
            'desktop-image-api-url': 'image-api-url',
            'desktop-image-width': 'image-width',
            'desktop-image-height': 'image-height',
            'desktop-image-steps': 'image-steps',
            'desktop-image-cfg-scale': 'image-cfg-scale',
            'desktop-image-sampler': 'image-sampler',
            
            // SwarmUI Settings
            'desktop-swarmui-api-url': 'swarmui-api-url',
            'desktop-swarmui-width': 'swarmui-width',
            'desktop-swarmui-height': 'swarmui-height',
            'desktop-swarmui-steps': 'swarmui-steps',
            'desktop-swarmui-cfg-scale': 'swarmui-cfg-scale',
            'desktop-swarmui-model': 'swarmui-model',
            'desktop-swarmui-sampler': 'swarmui-sampler',
            
            // OpenAI Image Settings
            'desktop-image-size': 'image-size',
            'desktop-openai-quality': 'openai-quality',
            'desktop-openai-output-format': 'openai-output-format',
            'desktop-openai-background': 'openai-background'
        };

        // Setup two-way sync for all settings
        Object.entries(this.settingsMap).forEach(([desktopId, mobileId]) => {
            const desktopElement = document.getElementById(desktopId);
            const mobileElement = document.getElementById(mobileId);
            
            if (desktopElement && mobileElement) {
                // Sync from mobile to desktop initially
                this.syncElementValue(mobileElement, desktopElement);
                
                // Setup change listeners for real-time sync to mobile (saving handled by saveAllSettings)
                desktopElement.addEventListener('change', () => {
                    this.syncElementValue(desktopElement, mobileElement);
                    this.updateSettingsDisplay(desktopId);
                    
                    // Handle provider-specific section visibility
                    if (desktopId === 'desktop-llm-provider') {
                        this.toggleProviderSections(desktopElement.value);
                    } else if (desktopId === 'desktop-image-provider') {
                        this.toggleImageProviderSections(desktopElement.value);
                    }
                });
                
                desktopElement.addEventListener('input', () => {
                    this.syncElementValue(desktopElement, mobileElement);
                    this.updateSettingsDisplay(desktopId);
                });
            }
        });

        // Auto-save functionality (no manual save button needed)
        // Settings will be auto-saved when leaving the settings view

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


    syncElementValue(source, target) {
        if (source.type === 'checkbox') {
            target.checked = source.checked;
        } else if (source.type === 'range') {
            target.value = source.value;
            // Trigger input event to update displays
            target.dispatchEvent(new Event('input'));
        } else {
            target.value = source.value;
        }
    }

    async syncSettingsToDesktop() {
        // Wait for mobile settings panel to be loaded
        await this.waitForMobileSettings();
        
        // Sync all mobile settings to desktop when opening settings panel
        Object.entries(this.settingsMap).forEach(([desktopId, mobileId]) => {
            const desktopElement = document.getElementById(desktopId);
            const mobileElement = document.getElementById(mobileId);
            
            if (desktopElement && mobileElement) {
                this.syncElementValue(mobileElement, desktopElement);
                this.updateSettingsDisplay(desktopId);
            } else if (!mobileElement) {
                console.warn(`Mobile settings element not found: ${mobileId}`);
            }
        });
    }

    async waitForMobileSettings() {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 100;
            
            const checkForSettings = () => {
                const settingsPanel = document.querySelector('#settings-panel-container .settings-panel');
                const hasBasicSettings = document.getElementById('slider-font-size') && 
                                       document.getElementById('llm-provider') &&
                                       document.getElementById('select-tts-voice');
                
                if (settingsPanel && hasBasicSettings) {
                    resolve(true);
                } else if (attempts < maxAttempts) {
                    attempts++;
                    setTimeout(checkForSettings, 100);
                } else {
                    console.warn('Mobile settings panel not loaded after timeout');
                    resolve(false);
                }
            };
            
            checkForSettings();
        });
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
        // Hide all direct API sections
        const sections = ['desktop-openai-direct-settings', 'desktop-anthropic-direct-settings', 'desktop-google-direct-settings'];
        sections.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section) section.style.display = 'none';
        });

        // Show relevant section based on provider
        let targetSection = null;
        if (provider === 'openai-direct') {
            targetSection = 'desktop-openai-direct-settings';
        } else if (provider === 'anthropic-direct') {
            targetSection = 'desktop-anthropic-direct-settings';
        } else if (provider === 'google-direct') {
            targetSection = 'desktop-google-direct-settings';
        }

        if (targetSection) {
            const section = document.getElementById(targetSection);
            if (section) section.style.display = 'block';
        }
    }

    toggleImageProviderSections(provider) {
        // Hide all image provider sections
        const sections = ['desktop-a1111-settings', 'desktop-swarmui-settings', 'desktop-openai-settings'];
        sections.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section) section.style.display = 'none';
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
            if (section) section.style.display = 'block';
        }
    }

    setupPersonaSync() {
        const createButton = document.getElementById('desktop-create-persona');
        const randomButton = document.getElementById('desktop-use-random-persona');
        const clearButton = document.getElementById('desktop-clear-persona');
        
        if (createButton) {
            createButton.addEventListener('click', async () => {
                const name = document.getElementById('desktop-persona-name').value;
                const prompt = document.getElementById('desktop-persona-prompt').value;
                
                if (!prompt) {
                    this.showNotification('Please enter a persona description');
                    return;
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
        
        if (randomButton) {
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
        
        if (clearButton) {
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

    setupFeatureCards() {
        // Add click animations to feature cards
        document.querySelectorAll('.feature-card').forEach(card => {
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-8px) scale(1.02)';
            });
            
            card.addEventListener('mouseleave', () => {
                card.style.transform = 'translateY(0) scale(1)';
            });
            
            card.addEventListener('click', () => {
                card.style.transform = 'translateY(-4px) scale(0.98)';
                setTimeout(() => {
                    card.style.transform = 'translateY(-8px) scale(1.02)';
                }, 150);
            });
        });
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

            // Sync desktop chat to mobile chat
            this.setupChatSync();
            
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
                // Copy to mobile input and trigger send
                mobileInput.value = message;
                desktopInput.value = '';
                desktopInput.style.height = 'auto';
                
                // Trigger mobile send button
                const mobileSendButton = document.getElementById('send-button');
                if (mobileSendButton) {
                    mobileSendButton.click();
                }
            }
        }
    }

    setupChatSync() {
        const desktopChat = document.getElementById('desktop-chat-window');
        const mobileChat = document.getElementById('chat-window');
        
        if (mobileChat && desktopChat) {
            // Clear existing content
            desktopChat.innerHTML = '';
            
            // Simple direct sync - copy existing messages immediately
            const syncMessages = () => {
                const mobileMessages = mobileChat.querySelectorAll('.message');
                const desktopMessages = desktopChat.querySelectorAll('.message');
                
                // If mobile has more messages than desktop, add the new ones
                if (mobileMessages.length > desktopMessages.length) {
                    for (let i = desktopMessages.length; i < mobileMessages.length; i++) {
                        const originalMessage = mobileMessages[i];
                        const clonedMessage = originalMessage.cloneNode(true);
                        
                        // Apply desktop-specific styling
                        if (clonedMessage.classList.contains('user-message')) {
                            clonedMessage.style.marginLeft = '30%';
                            clonedMessage.style.maxWidth = '70%';
                        } else if (clonedMessage.classList.contains('llm-message')) {
                            clonedMessage.style.maxWidth = '70%';
                        }
                        
                        desktopChat.appendChild(clonedMessage);
                    }
                    
                    // Scroll to bottom
                    desktopChat.scrollTop = desktopChat.scrollHeight;
                }
            };
            
            // Initial sync
            syncMessages();
            
            // Watch for new messages with a more aggressive observer
            const observer = new MutationObserver(() => {
                syncMessages();
            });
            
            // Observe all changes to mobile chat
            observer.observe(mobileChat, { 
                childList: true, 
                subtree: true, 
                attributes: true, 
                characterData: true 
            });
            
            // Also poll every 500ms to catch any missed updates
            setInterval(syncMessages, 500);
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
            console.warn('Desktop: Universal loadAllSettings not available, using fallback');
            // Fallback to original implementation if main.js not loaded yet
            const settingsKeys = this.getStorageKeyMapping();

            Object.entries(settingsKeys).forEach(([elementId, storageKey]) => {
                const element = document.getElementById(elementId);
                const storedValue = localStorage.getItem(storageKey);
                
                if (element && storedValue !== null) {
                    if (element.type === 'checkbox') {
                        element.checked = storedValue === 'true';
                    } else if (element.type === 'range') {
                        element.value = storedValue;
                        this.updateSettingsDisplay(elementId);
                    } else {
                        element.value = storedValue;
                    }
                    
                    console.log(`Loaded ${storageKey}: ${storedValue} into ${elementId}`);
                }
            });
        }
        
        console.log('Desktop settings loaded');
    }

    getStorageKeyMapping() {
        // Use the same localStorage keys as main.js to prevent conflicts
        return {
            // Font Settings
            'desktop-font-size': 'fontSize',
            
            // LLM Provider Settings
            'desktop-llm-provider': 'customLlmProvider',
            'desktop-llm-api-url': 'customLlmApiUrl',
            'desktop-llm-model': 'customLlmModelIdentifier',
            'desktop-llm-api-key': 'customLlmApiKey',
            
            // Direct API Provider Settings
            'desktop-openai-model-identifier': 'openaiModelIdentifier',
            'desktop-openai-api-key': 'openaiApiKey',
            'desktop-anthropic-model-identifier': 'anthropicModelIdentifier',
            'desktop-anthropic-api-key': 'anthropicApiKey',
            'desktop-google-model-identifier': 'googleModelIdentifier',
            'desktop-google-api-key': 'googleApiKey',
            
            // Voice Settings
            'desktop-tts-voice': 'selectedTTSVoice',
            'desktop-voice-speed': 'voiceSpeed',
            'desktop-voice-pitch': 'voicePitch',
            'desktop-azure-api-key': 'azureAPIKey',
            'desktop-azure-region': 'azureRegion',
            
            // MCP Settings
            'desktop-mcp-enabled': 'mcpEnabled',
            'desktop-mcp-url': 'mcpServerUrl',
            
            // Web Search Settings
            'desktop-search-enabled': 'searchEnabled',
            'desktop-search-provider': 'searchProvider',
            'desktop-search-api-key': 'searchApiKey',
            'desktop-search-results-limit': 'searchResultsLimit',
            'desktop-search-auto-summarize': 'searchAutoSummarize',
            'desktop-search-time-filter': 'searchTimeFilter',
            
            // Image Generation Settings
            'desktop-image-provider': 'customImageProvider',
            
            // A1111 Settings
            'desktop-image-api-url': 'customImageApiUrl',
            'desktop-image-width': 'imageWidth',
            'desktop-image-height': 'imageHeight',
            'desktop-image-steps': 'imageSteps',
            'desktop-image-cfg-scale': 'imageCfgScale',
            'desktop-image-sampler': 'imageSampler',
            
            // SwarmUI Settings
            'desktop-swarmui-api-url': 'swarmuiApiUrl',
            'desktop-swarmui-width': 'swarmuiWidth',
            'desktop-swarmui-height': 'swarmuiHeight',
            'desktop-swarmui-steps': 'swarmuiSteps',
            'desktop-swarmui-cfg-scale': 'swarmuiCfgScale',
            'desktop-swarmui-model': 'swarmUIModel',
            'desktop-swarmui-sampler': 'swarmuiSampler',
            
            // OpenAI Image Settings
            'desktop-image-size': 'imageSize',
            'desktop-openai-quality': 'openaiQuality',
            'desktop-openai-output-format': 'openaiOutputFormat',
            'desktop-openai-background': 'openaiBackground'
        };
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