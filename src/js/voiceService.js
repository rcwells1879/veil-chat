class VoiceService {
    constructor(sttResultCallback, sttErrorCallback, sttListeningStateCallback, sttAutoSendCallback) {
        this.voices = [];
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
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
        return new Promise((resolve, reject) => { 
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
                        this._executeSpeech(textToSpeak, preferredVoiceKeyword, resolve, reject, isMobile);
                    }, 1000);
                    return;
                }
            }
            
            this._executeSpeech(textToSpeak, preferredVoiceKeyword, resolve, reject, isMobile);
        });
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

            // If no voice selected by keyword, or keyword was "AUTO", use default logic
            if (!voiceToUse) {
                const defaultKeywords = ['sonia', 'ava', 'jenny', 'emily', 'libby', 'zira', 'susan', 'hazel', 'linda', 'female'];
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
                // Broader fallbacks if still no voice
                if (!voiceToUse) voiceToUse = this.voices.find(v => v.lang.startsWith('en') && v.localService && v.name.toLowerCase().includes("microsoft") && !v.name.toLowerCase().includes('david'));
                if (!voiceToUse) voiceToUse = this.voices.find(v => v.lang.startsWith('en') && v.localService && !v.name.toLowerCase().includes('david'));
                if (!voiceToUse) voiceToUse = this.voices.find(v => v.lang.startsWith('en') && v.localService); // Any local English voice
                if (!voiceToUse) voiceToUse = this.voices.find(v => v.lang.startsWith('en')); // Any English voice
                
                if (voiceToUse) {
                    console.log(`VoiceService: Default/Auto voice selection: ${voiceToUse.name}`);
                }
            }
        }

        if (voiceToUse) {
            utterance.voice = voiceToUse;
        } else {
            console.warn("VoiceService: No suitable voice found after all checks. Using browser/system default voice for utterance.");
        }
        
        utterance.pitch = 1;
        utterance.rate = 1.3;

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
            console.log("VoiceService: DEBUG: User stopped. No accumulated transcript to send.");
        }
    }
}

