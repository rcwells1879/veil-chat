if (typeof VoiceService === 'undefined') {
    window.VoiceService = class VoiceService {
        constructor(sttResultCallback, sttErrorCallback, sttListeningStateCallback, sttAutoSendCallback) {
            this.voices = [];
            this.recognition = null;
            this.synthesis = window.speechSynthesis;
            
            // Voice settings with defaults
            this.voiceRate = 1.0;  // Changed from 1.3 to 1.0 for mobile compatibility
            this.voicePitch = 1.0;
            
            // Initialize Azure TTS service
            this.azureTTS = null;
            this.useAzureTTS = false;
            
            // Voice settings update callback (set by main.js)
            this.updateVoiceDropdownCallback = null;
            
            // Gender-based voice categorization
            this.voicesByGender = {
                female: [
                    'Ava', 'Jenny', 'Emma', 'Sara', 'Aria', 'Ashley',  // US Female
                    'Sonia', 'Libby', 'Olivia', 'Hollie',              // UK Female  
                    'Natasha', 'Freya',                                 // AU Female
                    'Clara'                                             // CA Female
                ],
                male: [
                    'Andrew', 'Brian', 'Guy', 'Jason', 'Tony',         // US Male
                    'Ryan', 'Alfie', 'Oliver',                         // UK Male
                    'William', 'Neil',                                  // AU Male
                    'Liam'                                              // CA Male
                ]
            };
        this.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        this.sttResultCallback = sttResultCallback || function() {};
        this.sttErrorCallback = sttErrorCallback || function() {};
        this.sttListeningStateCallback = sttListeningStateCallback || function() {};
        this.sttAutoSendCallback = sttAutoSendCallback || function() {};

        this.finalAutoSendTimer = null;
        this.finalAutoSendDelay = 1000; // Default: Time to wait after the pause is confirmed

        this.speechContinuationTimer = null;
        // User wants 7000ms for this, as per their last log where it "worked" for waiting
        // but STT wasn't active. Let's use a more typical value first and they can adjust.
        this.speechContinuationDelay = 2000; // How long to wait for more speech before considering pause definitive

        this.currentAccumulatedTranscript = "";
        this.isRecognitionActive = false;
        this.speechDetectedSinceLastFinalSend = false;
        
        this._setupSpeechSynthesis();
        if (this.isRecognitionSupported()) {
            this._setupSpeechRecognition();
        } else {
            console.warn('Speech Recognition API not supported in this browser.');
        }
    }

    // --- Speech Synthesis (TTS) Methods ---
    isSynthesisSupported() {
        return 'speechSynthesis' in window;
    }

    _populateVoiceList(source = "initial call") {
        if (!this.isSynthesisSupported()) return;
        this.voices = this.synthesis.getVoices();
        // console.log(`VoiceService: populateVoiceList called from ${source}. Number of voices: ${this.voices.length}`);
    }

    _setupSpeechSynthesis() {
        if (!this.isSynthesisSupported()) {
            // console.warn('Speech Synthesis API not supported in this browser.');
            return;
        }
        this._populateVoiceList("VoiceService constructor");
        if (this.synthesis.onvoiceschanged !== undefined) {
            this.synthesis.onvoiceschanged = () => this._populateVoiceList("onvoiceschanged event");
        } else {
            setTimeout(() => {
                if (this.voices.length === 0) {
                    this._populateVoiceList("setTimeout fallback");
                }
            }, 500);
        }
    }

    speak(textToSpeak, preferredVoiceKeyword) {
        return new Promise(async (resolve, reject) => { 
            const voiceToUse = preferredVoiceKeyword;
            
            // Try Azure TTS first if available
            if (this.isAzureTTSEnabled()) {
                try {
                    console.log(`VoiceService: Using Azure TTS with voice: ${voiceToUse}`);
                    await this.azureTTS.speak(textToSpeak, voiceToUse);
                    resolve();
                    return;
                } catch (error) {
                    console.warn('VoiceService: Azure TTS failed, falling back to Web Speech API:', error);
                    // Fall through to Web Speech API
                }
            } else {
                console.log('VoiceService: Azure TTS not enabled, using Web Speech API');
                console.log('Azure TTS configured:', !!this.azureTTS);
                console.log('Azure TTS enabled:', this.useAzureTTS);
                if (this.azureTTS) {
                    console.log('Azure TTS is configured:', this.azureTTS.isConfigured());
                }
            }

            // Fallback to Web Speech API
            if (!this.isSynthesisSupported()) {
                console.warn('VoiceService: Speech Synthesis API not supported, cannot speak.');
                resolve(); 
                return;
            }
            
            // Mobile detection - using same breakpoint as other mobile settings
            const isMobile = window.innerWidth <= 475 || /Mobi|Android/i.test(navigator.userAgent);
            
            // Mobile fix: Check if synthesis is ready and voices are loaded
            if (this.voices.length === 0) {
                this._populateVoiceList("speak() when voices empty");
                // On mobile, wait longer for voices to load
                if (this.voices.length === 0 && isMobile) {
                    setTimeout(() => {
                        this._populateVoiceList("mobile fallback");
                        this._executeSpeech(textToSpeak, voiceToUse, resolve, reject, isMobile);
                    }, 1000);
                    return;
                }
            }
            
            this._executeSpeech(textToSpeak, voiceToUse, resolve, reject, isMobile);
        });
    }

    stopSpeaking() {
        console.log("VoiceService: stopSpeaking called");
        
        // Stop Azure TTS if active
        if (this.azureTTS) {
            console.log("VoiceService: Stopping Azure TTS");
            this.azureTTS.stopSpeaking();
        }
        
        // Stop Web Speech API if active
        if (this.isSynthesisSupported() && (this.synthesis.speaking || this.synthesis.pending)) {
            console.log("VoiceService: Stopping Web Speech API");
            this.synthesis.cancel();
        }
        
        // Additional aggressive stop for PWA - stop all HTML audio elements
        const audioElements = document.querySelectorAll('audio');
        audioElements.forEach(audio => {
            if (!audio.paused) {
                console.log("VoiceService: Force stopping HTML audio element");
                audio.pause();
                audio.currentTime = 0;
            }
        });
    }

    // Voice settings getters and setters
    setVoiceRate(rate) {
        // Clamp rate between 0.1 and 2.0 for cross-browser compatibility
        this.voiceRate = Math.max(0.1, Math.min(2.0, parseFloat(rate) || 1.0));
        
        // Sync with Azure TTS if available
        if (this.azureTTS) {
            this.azureTTS.setVoiceRate(this.voiceRate);
        }
        
        console.log(`VoiceService: Voice rate set to ${this.voiceRate}`);
    }

    getVoiceRate() {
        return this.voiceRate;
    }

    setVoicePitch(pitch) {
        // Clamp pitch between 0.5 and 2.0
        this.voicePitch = Math.max(0.5, Math.min(2.0, parseFloat(pitch) || 1.0));
        
        // Sync with Azure TTS if available
        if (this.azureTTS) {
            this.azureTTS.setVoicePitch(this.voicePitch);
        }
        
        console.log(`VoiceService: Voice pitch set to ${this.voicePitch}`);
    }

    getVoicePitch() {
        return this.voicePitch;
    }

    // Azure TTS management methods
    initializeAzureTTS(apiKey, region) {
        if (typeof AzureTTSService !== 'undefined') {
            this.azureTTS = new AzureTTSService(apiKey, region);
            this.azureTTS.setVoiceRate(this.voiceRate);
            this.azureTTS.setVoicePitch(this.voicePitch);
            this.useAzureTTS = this.azureTTS.isConfigured();
            console.log(`VoiceService: Azure TTS ${this.useAzureTTS ? 'enabled' : 'disabled'}`);
        } else {
            console.error('VoiceService: AzureTTSService not loaded');
            this.useAzureTTS = false;
        }
    }

    setAzureConfig(apiKey, region) {
        if (this.azureTTS) {
            this.azureTTS.updateConfig(apiKey, region);
            this.useAzureTTS = this.azureTTS.isConfigured();
        } else {
            this.initializeAzureTTS(apiKey, region);
        }
    }

    isAzureTTSEnabled() {
        return this.useAzureTTS && this.azureTTS && this.azureTTS.isConfigured();
    }

    // Persona voice management methods
    detectGenderFromProfile(characterProfile) {
        if (!characterProfile || typeof characterProfile !== 'string') {
            console.log('VoiceService: No character profile provided for gender detection');
            return 'unknown';
        }

        const profileLower = characterProfile.toLowerCase();
        
        // First, look for explicit structured gender declarations - prioritize new man/woman format
        if (profileLower.includes('**gender:** woman') || profileLower.includes('gender: woman')) {
            console.log('VoiceService: Found explicit woman gender declaration');
            return 'female';
        }
        if (profileLower.includes('**gender:** man') || profileLower.includes('gender: man')) {
            console.log('VoiceService: Found explicit man gender declaration');
            return 'male';
        }
        
        // Fallback to original male/female format for backward compatibility
        if (profileLower.includes('**gender:** female') || profileLower.includes('gender: female')) {
            console.log('VoiceService: Found explicit female gender declaration (legacy format)');
            return 'female';
        }
        if (profileLower.includes('**gender:** male') || profileLower.includes('gender: male')) {
            console.log('VoiceService: Found explicit male gender declaration (legacy format)');
            return 'male';
        }
        
        // Fallback to keyword scoring
        const femaleKeywords = ['female', 'woman', 'girl', 'lady', 'she', 'her', 'herself'];
        const maleKeywords = ['male', 'man', 'boy', 'guy', 'he', 'him', 'himself'];
        
        let femaleScore = 0;
        let maleScore = 0;
        
        // Count occurrences of gender-specific keywords
        femaleKeywords.forEach(keyword => {
            const matches = (profileLower.match(new RegExp(keyword, 'g')) || []).length;
            femaleScore += matches;
        });
        
        maleKeywords.forEach(keyword => {
            const matches = (profileLower.match(new RegExp(keyword, 'g')) || []).length;
            maleScore += matches;
        });
        
        // Determine gender based on scores
        if (femaleScore > maleScore) {
            console.log(`VoiceService: Detected female gender (score: ${femaleScore} vs ${maleScore})`);
            return 'female';
        } else if (maleScore > femaleScore) {
            console.log(`VoiceService: Detected male gender (score: ${maleScore} vs ${femaleScore})`);
            return 'male';
        } else {
            console.log(`VoiceService: Could not determine gender (tie: ${femaleScore} vs ${maleScore})`);
            console.log('Profile excerpt for debugging:', profileLower.substring(0, 300));
            return 'unknown';
        }
    }

    selectRandomVoiceByGender(gender) {
        const voices = this.voicesByGender[gender];
        if (!voices || voices.length === 0) {
            console.warn(`VoiceService: No voices available for gender: ${gender}`);
            // Fallback to opposite gender if available
            const fallbackGender = gender === 'male' ? 'female' : 'male';
            const fallbackVoices = this.voicesByGender[fallbackGender];
            if (fallbackVoices && fallbackVoices.length > 0) {
                const selectedVoice = fallbackVoices[Math.floor(Math.random() * fallbackVoices.length)];
                console.log(`VoiceService: Using fallback voice: ${selectedVoice} (${fallbackGender})`);
                return selectedVoice;
            }
            return null;
        }
        
        const selectedVoice = voices[Math.floor(Math.random() * voices.length)];
        console.log(`VoiceService: Selected random ${gender} voice: ${selectedVoice}`);
        return selectedVoice;
    }

    updateUserVoiceSetting(characterProfile, settingsObject) {
        const gender = this.detectGenderFromProfile(characterProfile);
        const selectedVoice = this.selectRandomVoiceByGender(gender);
        
        if (selectedVoice) {
            // Update user settings directly
            settingsObject.ttsVoice = selectedVoice;
            localStorage.setItem('ttsVoice', selectedVoice);
            
            // Update the voice dropdown in UI if callback is available
            if (this.updateVoiceDropdownCallback) {
                this.updateVoiceDropdownCallback(selectedVoice);
            }
            
            console.log(`VoiceService: User voice setting updated to: ${selectedVoice} (${gender})`);
            return selectedVoice;
        } else {
            console.warn('VoiceService: Could not select voice for persona, keeping current setting');
            return null;
        }
    }

    // Set callback function for updating voice dropdown in UI
    setVoiceDropdownCallback(callback) {
        this.updateVoiceDropdownCallback = callback;
    }

    // Map Azure voice names to Web Speech API voice names for fallback
    mapToWebSpeechVoice(azureVoiceName) {
        const webSpeechMap = {
            // US Voices
            'Ava': 'Microsoft Ava Online (Natural) - English (United States)',
            'Jenny': 'Microsoft Jenny Online (Natural) - English (United States)', 
            'Emma': 'Microsoft Emma Online (Natural) - English (United States)',
            'Sara': 'Microsoft Sara Online (Natural) - English (United States)',
            'Aria': 'Microsoft Aria Online (Natural) - English (United States)',
            'Ashley': 'Microsoft Ashley Online (Natural) - English (United States)',
            'Andrew': 'Microsoft Andrew Online (Natural) - English (United States)',
            'Brian': 'Microsoft Brian Online (Natural) - English (United States)',
            'Guy': 'Microsoft Guy Online (Natural) - English (United States)',
            'Jason': 'Microsoft Jason Online (Natural) - English (United States)',
            'Tony': 'Microsoft Tony Online (Natural) - English (United States)',
            
            // UK Voices
            'Sonia': 'Microsoft Sonia Online (Natural) - English (United Kingdom)',
            'Libby': 'Microsoft Libby Online (Natural) - English (United Kingdom)',
            'Olivia': 'Microsoft Olivia Online (Natural) - English (United Kingdom)',
            'Hollie': 'Microsoft Hollie Online (Natural) - English (United Kingdom)',
            'Ryan': 'Microsoft Ryan Online (Natural) - English (United Kingdom)',
            'Alfie': 'Microsoft Alfie Online (Natural) - English (United Kingdom)',
            'Oliver': 'Microsoft Oliver Online (Natural) - English (United Kingdom)',
            
            // AU Voices
            'Natasha': 'Microsoft Natasha Online (Natural) - English (Australia)',
            'Freya': 'Microsoft Freya Online (Natural) - English (Australia)',
            'William': 'Microsoft William Online (Natural) - English (Australia)',
            'Neil': 'Microsoft Neil Online (Natural) - English (Australia)',
            
            // CA Voices
            'Clara': 'Microsoft Clara Online (Natural) - English (Canada)',
            'Liam': 'Microsoft Liam Online (Natural) - English (Canada)'
        };
        
        const mappedVoice = webSpeechMap[azureVoiceName];
        if (mappedVoice) {
            console.log(`VoiceService: Mapped ${azureVoiceName} to Web Speech voice: ${mappedVoice}`);
            return mappedVoice;
        }
        
        // Fallback: try to find a voice containing the name, prefer Microsoft voices
        let fallbackVoice = this.voices.find(voice => 
            voice.name.toLowerCase().includes(azureVoiceName.toLowerCase()) && 
            voice.name.toLowerCase().includes('microsoft') &&
            voice.lang.startsWith('en')
        );
        
        // If no Microsoft voice found, try any voice with the name
        if (!fallbackVoice) {
            fallbackVoice = this.voices.find(voice => 
                voice.name.toLowerCase().includes(azureVoiceName.toLowerCase()) && 
                voice.lang.startsWith('en')
            );
        }
        
        if (fallbackVoice) {
            console.log(`VoiceService: Found fallback Web Speech voice for ${azureVoiceName}: ${fallbackVoice.name}`);
            return fallbackVoice.name;
        }
        
        console.warn(`VoiceService: No Web Speech voice mapping found for ${azureVoiceName}`);
        return azureVoiceName; // Return original name as last resort
    }

    _executeSpeech(textToSpeak, preferredVoiceKeyword, resolve, reject, isMobile) {
        if (this.synthesis.speaking || this.synthesis.pending) {
            console.log("VoiceService: Cancelling previous speech before speaking new utterance.");
            this.synthesis.cancel(); 
        }

        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        let voiceToUse = null;

        if (this.voices.length > 0) {
            if (preferredVoiceKeyword && preferredVoiceKeyword !== "AUTO") {
                // Try to find voice by exact name match from mapping
                const mappedVoiceName = this.mapToWebSpeechVoice(preferredVoiceKeyword);
                voiceToUse = this.voices.find(voice => voice.name === mappedVoiceName);
                
                if (voiceToUse) {
                    console.log(`VoiceService: Using exact mapped voice: ${voiceToUse.name}`);
                } else {
                    // Try to find voice by direct fallback search within mapToWebSpeechVoice
                    // Check if mapToWebSpeechVoice already found a fallback voice name
                    if (mappedVoiceName !== preferredVoiceKeyword) {
                        console.log(`VoiceService: Exact mapped voice "${mappedVoiceName}" not found, but fallback was attempted`);
                    }
                    
                    // Debug: show available voices that contain the keyword
                    const availableVoicesWithKeyword = this.voices.filter(voice => 
                        voice.name.toLowerCase().includes(preferredVoiceKeyword.toLowerCase()) && voice.lang.startsWith('en')
                    );
                    console.log(`VoiceService: Available voices containing "${preferredVoiceKeyword}":`, availableVoicesWithKeyword.map(v => v.name));
                    
                    // Use the first available voice with the keyword if mapToWebSpeechVoice found one
                    if (availableVoicesWithKeyword.length > 0) {
                        voiceToUse = availableVoicesWithKeyword[0];
                        console.log(`VoiceService: Using first available voice with keyword: ${voiceToUse.name}`);
                    } else {
                        console.log(`VoiceService: No voices found containing "${preferredVoiceKeyword}", falling back to keyword search`);
                    }
                }
                
                // Keyword-based search if mapping didn't work
                if (!voiceToUse) {
                    const keyword = preferredVoiceKeyword.toLowerCase();
                    // Attempt to find a "Microsoft ... (Natural)" voice first
                    voiceToUse = this.voices.find(voice =>
                        voice.lang.startsWith('en') &&
                        voice.name.toLowerCase().includes("microsoft") &&
                        voice.name.toLowerCase().includes("(natural)") &&
                        voice.name.toLowerCase().includes(keyword)
                    );
                    // Fallback: Microsoft voice without (Natural)
                    if (!voiceToUse) {
                        voiceToUse = this.voices.find(voice =>
                            voice.lang.startsWith('en') &&
                            voice.name.toLowerCase().includes("microsoft") &&
                            voice.name.toLowerCase().includes(keyword)
                        );
                    }
                    // Fallback: Any voice with the keyword (ensure it's English)
                    if (!voiceToUse) {
                        voiceToUse = this.voices.find(voice =>
                            voice.lang.startsWith('en') &&
                            voice.name.toLowerCase().includes(keyword)
                        );
                    }
                    if (voiceToUse) {
                        console.log(`VoiceService: Selected voice for keyword "${preferredVoiceKeyword}": ${voiceToUse.name}`);
                    } else {
                        console.log(`VoiceService: No specific voice found for keyword "${preferredVoiceKeyword}". Will use default selection logic.`);
                    }
                }
            }

            // Determine gender of requested voice for appropriate fallback
            let requestedGender = 'unknown';
            if (preferredVoiceKeyword && preferredVoiceKeyword !== "AUTO") {
                if (this.voicesByGender.female.includes(preferredVoiceKeyword)) {
                    requestedGender = 'female';
                } else if (this.voicesByGender.male.includes(preferredVoiceKeyword)) {
                    requestedGender = 'male';
                }
            }

            // If no voice selected by keyword, or keyword was "AUTO", use gender-aware default logic
            if (!voiceToUse) {
                
                // Use gender-appropriate default keywords
                const defaultFemaleKeywords = ['sonia', 'ava', 'jenny', 'emily', 'libby'];
                const defaultMaleKeywords = ['ryan', 'andrew', 'brian', 'guy', 'oliver'];
                
                const defaultKeywords = requestedGender === 'male' ? defaultMaleKeywords : 
                                       requestedGender === 'female' ? defaultFemaleKeywords : 
                                       defaultFemaleKeywords; // fallback to female if unknown
                
                console.log(`VoiceService: Using ${requestedGender} fallback keywords:`, defaultKeywords);
                for (const key of defaultKeywords) {
                    // Prefer Microsoft Natural voices
                    voiceToUse = this.voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes("microsoft") && v.name.toLowerCase().includes("(natural)") && v.name.toLowerCase().includes(key) && !v.name.toLowerCase().includes('david'));
                    if (voiceToUse) break;
                    // Prefer Microsoft voices
                    voiceToUse = this.voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes("microsoft") && v.name.toLowerCase().includes(key) && !v.name.toLowerCase().includes('david'));
                    if (voiceToUse) break;
                     // Prefer any local service voice with the keyword
                    if (!voiceToUse) {
                        voiceToUse = this.voices.find(v => v.lang.startsWith('en') && v.localService && v.name.toLowerCase().includes(key) && !v.name.toLowerCase().includes('david'));
                        if (voiceToUse) break;
                    }
                }
                // If gender-aware selection found a voice, log it
                if (voiceToUse) {
                    console.log(`VoiceService: Gender-aware fallback voice selection (${requestedGender}): ${voiceToUse.name}`);
                } else {
                    // Broader fallbacks if still no voice - these ignore gender
                    console.log(`VoiceService: No gender-appropriate voice found, using broader fallback (may not match gender)`);
                    if (!voiceToUse) voiceToUse = this.voices.find(v => v.lang.startsWith('en') && v.localService && v.name.toLowerCase().includes("microsoft") && !v.name.toLowerCase().includes('david'));
                    if (!voiceToUse) voiceToUse = this.voices.find(v => v.lang.startsWith('en') && v.localService && !v.name.toLowerCase().includes('david'));
                    if (!voiceToUse) voiceToUse = this.voices.find(v => v.lang.startsWith('en') && v.localService); // Any local English voice
                    if (!voiceToUse) voiceToUse = this.voices.find(v => v.lang.startsWith('en')); // Any English voice
                    
                    if (voiceToUse) {
                        console.log(`VoiceService: Broader fallback voice selection: ${voiceToUse.name}`);
                    }
                }
            }
        }

        if (voiceToUse) {
            utterance.voice = voiceToUse;
        } else {
            console.warn("VoiceService: No suitable voice found after all checks. Using browser/system default voice for utterance.");
        }
        
        utterance.pitch = this.voicePitch;
        utterance.rate = this.voiceRate;

        utterance.onstart = () => {
            console.log(`VoiceService: TTS Speech started: "${utterance.text.substring(0, 30)}..."`);
        };
        utterance.onend = () => {
            console.log(`VoiceService: TTS Speech ended: "${utterance.text.substring(0, 30)}..."`);
            resolve(); 
        };
        utterance.onerror = (event) => {
            console.error('VoiceService: TTS Error:', event.error, event);
            reject(event.error); 
        };
        
        this.synthesis.speak(utterance);
    }

    // --- Speech Recognition (STT) Methods ---
    isRecognitionSupported() {
        return !!this.SpeechRecognition;
    }

    _clearFinalAutoSendTimer() {
        if (this.finalAutoSendTimer) {
            clearTimeout(this.finalAutoSendTimer);
            this.finalAutoSendTimer = null;
            console.log("VoiceService: DEBUG: Final Auto-Send Timer CLEARED.");
        }
    }

    _clearSpeechContinuationTimer() {
        if (this.speechContinuationTimer) {
            clearTimeout(this.speechContinuationTimer);
            this.speechContinuationTimer = null;
            console.log("VoiceService: DEBUG: Speech Continuation Timer CLEARED.");
        }
    }

    _updateListeningState(isActive) {
        if (this.isRecognitionActive !== isActive) {
            this.isRecognitionActive = isActive;
            this.sttListeningStateCallback(isActive);
            console.log("VoiceService: DEBUG: Recognition active state changed to:", this.isRecognitionActive);
        }
    }

    _setupSpeechRecognition() {
        this.recognition = new this.SpeechRecognition();
        this.recognition.continuous = false; // Key: We are NOT using the browser's continuous mode.
        this.recognition.lang = 'en-US';
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 1;

        console.log("VoiceService: DEBUG: _setupSpeechRecognition completed.");

        this.recognition.onstart = () => {
            console.log("VoiceService: DEBUG: recognition.onstart FIRED.");
            this._updateListeningState(true);
            // Flags are reset by startRecognition()
        };

        this.recognition.onresult = (event) => {
            let interimTranscript = "";
            let finalTranscriptSegment = "";
            let hasInterimResultInEvent = false;

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (!event.results[i].isFinal) {
                    hasInterimResultInEvent = true;
                    break;
                }
            }

            // If we receive an interim result, it means speech is actively ongoing.
            // Clear any speechContinuationTimer that might have been set by a premature onspeechend.
            if (hasInterimResultInEvent) {
                this._clearSpeechContinuationTimer();
            }

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscriptSegment += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            if (finalTranscriptSegment.trim()) {
                this.speechDetectedSinceLastFinalSend = true;
                this.currentAccumulatedTranscript = (this.currentAccumulatedTranscript ? this.currentAccumulatedTranscript + " " : "") + finalTranscriptSegment.trim();
                console.log('VoiceService: DEBUG: onresult (FINAL):', `"${finalTranscriptSegment}"`, 'Accumulated:', `"${this.currentAccumulatedTranscript}"`);
                this.sttResultCallback(this.currentAccumulatedTranscript);
                // DO NOT clear speechContinuationTimer here for a final result.
                // If onspeechend has already set it, let that timer determine if this final segment is the actual end of speech after a pause.
            } else if (interimTranscript.trim()) {
                this.speechDetectedSinceLastFinalSend = true;
                console.log('VoiceService: DEBUG: onresult (INTERIM):', `"${interimTranscript}"`);
            }
        };

        this.recognition.onspeechend = () => {
            console.log("VoiceService: DEBUG: recognition.onspeechend FIRED. isRecognitionActive:", this.isRecognitionActive);
            // Clear any *previous* continuation timer. This onspeechend event starts a new decision point for a pause.
                this._clearSpeechContinuationTimer();

            if (this.isRecognitionActive) { // Only if STT is supposed to be running
                console.log("VoiceService: DEBUG: onspeechend - Recognition active. Starting speechContinuationTimer.");
                this.speechContinuationTimer = setTimeout(() => {
                    console.log("VoiceService: DEBUG: speechContinuationTimer FIRED. Accumulated:", `"${this.currentAccumulatedTranscript}"`, "speechDetectedFlag:", this.speechDetectedSinceLastFinalSend);
                    if (this.currentAccumulatedTranscript.trim() && this.speechDetectedSinceLastFinalSend) {
                        this._startFinalAutoSendTimer(this.currentAccumulatedTranscript);
                    } else {
                        console.log("VoiceService: DEBUG: speechContinuationTimer - No valid accumulated transcript or speechDetected flag is false. Not starting final send timer.");
                    }
                }, this.speechContinuationDelay);
            }
        };

        this.recognition.onerror = (event) => {
            console.error('VoiceService: DEBUG: recognition.onerror FIRED:', event.error, event.message);
            this._clearFinalAutoSendTimer();
            this._clearSpeechContinuationTimer();
            this._updateListeningState(false);
            this.sttErrorCallback(event.error);
        };
    }

    _startFinalAutoSendTimer(transcript) {
        this._clearFinalAutoSendTimer();
        console.log("VoiceService: DEBUG: Starting finalAutoSendTimer for:", `"${transcript}"`);
        this.finalAutoSendTimer = setTimeout(() => {
            console.log("VoiceService: DEBUG: finalAutoSendTimer CALLBACK EXECUTED.");
            // Check !this.isRecognitionActive because onend should have fired and set it to false
            // before this timer callback executes.
            if (transcript.trim() && !this.isRecognitionActive) {
                console.log("VoiceService: DEBUG: finalAutoSendTimer - CONDITIONS MET. Sending:", `"${transcript}"`);
                this.sttAutoSendCallback(transcript);
                this.currentAccumulatedTranscript = "";
                this.speechDetectedSinceLastFinalSend = false;
            } else {
                let reason = "VoiceService: DEBUG: finalAutoSendTimer - Conditions NOT MET. ";
                if (!transcript.trim()) reason += "Transcript was empty. ";
                if (this.isRecognitionActive) reason += "Recognition was still (or became) active. ";
                console.log(reason.trim());
            }
        }, this.finalAutoSendDelay);
    }

    startRecognition() {
        console.log("VoiceService: DEBUG: startRecognition (EXTERNAL) called.");
        if (!this.isRecognitionSupported() || !this.recognition) {
            console.error("VoiceService: Speech recognition not supported or not initialized.");
            return;
        }

        this._clearFinalAutoSendTimer();
        this._clearSpeechContinuationTimer();
        this.currentAccumulatedTranscript = "";
        this.speechDetectedSinceLastFinalSend = false;

        if (this.isRecognitionActive) {
            console.warn("VoiceService: DEBUG: startRecognition called while recognition active. Stopping previous session first.");
            // Setting this.isRecognitionActive = false here might be too soon if stop() is async.
            // Let onend handle setting it to false.
            this.recognition.stop();
        }
        
        try {
            console.log("VoiceService: DEBUG: Calling recognition.start().");
            this.recognition.start();
        } catch (e) {
            console.error("VoiceService: DEBUG: Error calling recognition.start():", e);
            this._updateListeningState(false);
            this.sttErrorCallback(e.message || "Error starting recognition");
        }
    }

    stopRecognition() {
        console.log("VoiceService: DEBUG: stopRecognition (EXTERNAL) called.");
        if (!this.isRecognitionSupported() || !this.recognition) return;

        this._clearFinalAutoSendTimer();
        this._clearSpeechContinuationTimer();

        const transcriptToSend = this.currentAccumulatedTranscript.trim();
        this.currentAccumulatedTranscript = "";
        this.speechDetectedSinceLastFinalSend = false;

        if (this.isRecognitionActive) {
            try {
                this.recognition.stop(); // This will trigger onend
            } catch (e) {
                console.error("VoiceService: DEBUG: Error calling recognition.stop():", e);
                this._updateListeningState(false); // Ensure UI updates if stop fails
            }
        } else {
            // If not active, ensure UI state is correct.
            this._updateListeningState(false);
        }

        if (transcriptToSend) {
            console.log("VoiceService: DEBUG: User stopped. Sending accumulated transcript immediately:", `"${transcriptToSend}"`);
            this.sttAutoSendCallback(transcriptToSend);
        } else {
            console.log("VoiceService: DEBUG: User stopped. No accumulated transcript to send.");        }
    }
}
}