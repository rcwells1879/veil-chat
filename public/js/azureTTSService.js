if (typeof AzureTTSService === 'undefined') {
    window.AzureTTSService = class AzureTTSService {
        constructor(apiKey = null, region = 'eastus') {
            this.apiKey = apiKey;
            this.region = region;
            this.endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
            
            // Voice settings with defaults
            this.voiceRate = 1.0;
            this.voicePitch = 1.0;
            this.currentVoice = 'en-US-JennyNeural';
            
            // Track active audio elements for stopping
            this.activeAudioElements = new Set();
            
            // Azure TTS initialized
        }

        // Check if Azure TTS is properly configured
        isConfigured() {
            return !!(this.apiKey && this.region);
        }

        // Voice settings getters and setters
        setVoiceRate(rate) {
            // Clamp rate between 0.5 and 2.0 for Azure compatibility
            this.voiceRate = Math.max(0.5, Math.min(2.0, parseFloat(rate) || 1.0));
            // Voice rate set
        }

        getVoiceRate() {
            return this.voiceRate;
        }

        setVoicePitch(pitch) {
            // Clamp pitch between 0.5 and 2.0
            this.voicePitch = Math.max(0.5, Math.min(2.0, parseFloat(pitch) || 1.0));
            // Voice pitch set
        }

        getVoicePitch() {
            return this.voicePitch;
        }

        setVoice(voice) {
            this.currentVoice = voice || 'en-US-JennyNeural';
            // Voice set
        }

        getVoice() {
            return this.currentVoice;
        }

        // Convert voice keyword to Azure neural voice name (updated for 2025)
        mapVoiceKeywordToAzure(voiceKeyword) {
            const voiceMap = {
                'AUTO': 'en-US-JennyNeural',
                
                // US Female Voices (updated names for 2025)
                'Ava': 'en-US-AvaMultilingualNeural',
                'Jenny': 'en-US-JennyNeural',
                'Emma': 'en-US-EmmaNeural',
                'Sara': 'en-US-SaraNeural',
                'Aria': 'en-US-AriaNeural',
                'Ashley': 'en-US-AshleyNeural',
                
                // US Male Voices
                'Andrew': 'en-US-AndrewNeural',
                'Brian': 'en-US-BrianNeural',
                'Guy': 'en-US-GuyNeural',
                'Jason': 'en-US-JasonNeural',
                'Tony': 'en-US-TonyNeural',
                
                // UK Female Voices
                'Sonia': 'en-GB-SoniaNeural',
                'Libby': 'en-GB-LibbyNeural',
                'Olivia': 'en-GB-OliviaNeural',
                'Hollie': 'en-GB-HollieNeural',
                
                // UK Male Voices
                'Ryan': 'en-GB-RyanNeural',
                'Alfie': 'en-GB-AlfieNeural',
                'Oliver': 'en-GB-OliverNeural',
                
                // AU Female Voices
                'Natasha': 'en-AU-NatashaNeural',
                'Freya': 'en-AU-FreyaNeural',
                
                // AU Male Voices
                'William': 'en-AU-WilliamNeural',
                'Neil': 'en-AU-NeilNeural',
                
                // CA Voices
                'Clara': 'en-CA-ClaraNeural',
                'Liam': 'en-CA-LiamNeural',
                
                // Legacy mappings for backward compatibility
                'Emily': 'en-GB-LibbyNeural'  // Map Emily to UK Libby since no Emily in Azure
            };
            
            const mappedVoice = voiceMap[voiceKeyword] || 'en-US-JennyNeural';
            console.log(`AzureTTSService: Mapped voice "${voiceKeyword}" to "${mappedVoice}"`);
            return mappedVoice;
        }

        // Main speak method that matches VoiceService interface
        async speak(textToSpeak, preferredVoiceKeyword = null) {
            return new Promise(async (resolve, reject) => {
                if (!this.isConfigured()) {
                    console.error('AzureTTSService: API key or region not configured');
                    reject(new Error('Azure TTS not configured. Please add API key and region in settings.'));
                    return;
                }

                if (!textToSpeak || textToSpeak.trim() === '') {
                    console.warn('AzureTTSService: Empty text provided');
                    resolve();
                    return;
                }

                try {
                    // Initialize SSML processor if not already done
                    if (typeof SSMLProcessor !== 'undefined' && !this.ssmlProcessor) {
                        this.ssmlProcessor = new SSMLProcessor();
                    }

                    // Check if input is SSML or plain text
                    let isSSML = false;
                    let ssmlToSend = '';
                    let cleanedText = textToSpeak.trim();

                    if (this.ssmlProcessor) {
                        const ssmlResult = this.ssmlProcessor.extractSSML(textToSpeak);
                        if (ssmlResult.hasSSML) {
                            isSSML = true;
                            ssmlToSend = ssmlResult.ssml;
                            cleanedText = ssmlResult.cleanText;
                            
                            // Skip local validation - let Azure TTS handle SSML validation
                            // Our local validator has issues with complex nested SSML
                            // Using SSML synthesis with Azure validation
                        }
                    }
                    
                    // Final safety check: if falling back to plain text, ensure we strip any SSML tags
                    if (!isSSML && this.ssmlProcessor && textToSpeak.includes('<')) {
                        cleanedText = this.ssmlProcessor.stripSSML(textToSpeak);
                        console.log('AzureTTSService: Final safety strip - ensuring no SSML tags in plain text fallback');
                    }
                    
                    // Starting TTS synthesis
                    // Using TTS synthesis
                    
                    // Map voice keyword to Azure voice (only needed for plain text)
                    const azureVoice = preferredVoiceKeyword ? 
                        this.mapVoiceKeywordToAzure(preferredVoiceKeyword) : 
                        this.currentVoice;

                    // Get audio buffer from Azure
                    const audioBuffer = isSSML ? 
                        await this.synthesizeSSML(ssmlToSend, preferredVoiceKeyword) : 
                        await this.synthesize(cleanedText, azureVoice);
                    
                    // Play audio using HTML Audio Element
                    await this.playAudio(audioBuffer);
                    
                    // TTS synthesis completed
                    resolve();
                    
                } catch (error) {
                    console.error('AzureTTSService: Error during speech synthesis:', error);
                    reject(error);
                }
            });
        }

        // Synthesize text to audio using Azure Speech Services (plain text)
        async synthesize(text, voice = 'en-US-JennyNeural') {
            // Create SSML with voice settings
            const ssml = `<speak version="1.0" xml:lang="en-US">
                <voice name="${voice}">
                    <prosody rate="${this.voiceRate}" pitch="${this.getPitchForSSML(this.voicePitch)}">${this.escapeXML(text)}</prosody>
                </voice>
            </speak>`;

            console.log(`AzureTTSService: Sending request to Azure for voice: ${voice}`);

            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Ocp-Apim-Subscription-Key': this.apiKey,
                    'Content-Type': 'application/ssml+xml',
                    'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
                    'User-Agent': 'VeilChat-TTS/1.0'
                },
                body: ssml
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');
                throw new Error(`Azure TTS API failed: ${response.status} ${response.statusText} - ${errorText}`);
            }

            return response.arrayBuffer();
        }

        // Synthesize SSML directly to audio using Azure Speech Services
        async synthesizeSSML(ssml, voiceKeyword = null) {
            // Processing SSML for Azure format

            // Fix SSML format for Azure requirements
            const processedSSML = this.processSSMLForAzure(ssml, voiceKeyword);
            console.log('🎵 Processed SSML:', processedSSML);

            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Ocp-Apim-Subscription-Key': this.apiKey,
                    'Content-Type': 'application/ssml+xml',
                    'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
                    'User-Agent': 'VeilChat-TTS/1.0'
                },
                body: processedSSML
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');
                console.error('🎵 AzureTTSService: SSML synthesis failed:', errorText);
                throw new Error(`Azure TTS SSML API failed: ${response.status} ${response.statusText} - ${errorText}`);
            }

            // SSML synthesis successful
            return response.arrayBuffer();
        }

        // Process SSML to ensure it meets Azure requirements
        processSSMLForAzure(ssml, voiceKeyword = null) {
            // Determine the voice to use
            const azureVoice = voiceKeyword ? 
                this.mapVoiceKeywordToAzure(voiceKeyword) : 
                this.currentVoice;

            // Check if SSML already has proper Azure format
            if (ssml.includes('xmlns="http://www.w3.org/2001/10/synthesis"') && ssml.includes('<voice name=')) {
                // Already properly formatted, just ensure the voice name is correct
                return ssml.replace(/name="[^"]*"/g, `name="${azureVoice}"`);
            }

            // Extract content from basic SSML
            let content = ssml;
            
            // Remove outer <speak> tags if present
            content = content.replace(/<speak[^>]*>/gi, '').replace(/<\/speak>/gi, '');
            
            // If there's no voice element, the content is what we want to wrap
            if (!content.includes('<voice')) {
                // Wrap content in proper Azure SSML format with Microsoft namespace for styles
                return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">
                    <voice name="${azureVoice}">
                        ${content.trim()}
                    </voice>
                </speak>`;
            } else {
                // Has voice element but missing proper speak wrapper
                return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">
                    ${content.trim()}
                </speak>`;
            }
        }

        // Play audio using HTML Audio Element
        async playAudio(audioBuffer) {
            return new Promise((resolve, reject) => {
                try {
                    // Create audio element
                    const audio = new Audio();
                    
                    // Add to tracking set
                    this.activeAudioElements.add(audio);
                    
                    // Create blob and object URL
                    const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
                    const audioUrl = URL.createObjectURL(blob);
                    audio.src = audioUrl;

                    // Set up event handlers
                    audio.onended = () => {
                        this.activeAudioElements.delete(audio); // Remove from tracking
                        URL.revokeObjectURL(audioUrl); // Clean up memory
                        resolve();
                    };

                    audio.onerror = (event) => {
                        this.activeAudioElements.delete(audio); // Remove from tracking
                        URL.revokeObjectURL(audioUrl); // Clean up memory
                        reject(new Error(`Audio playback failed: ${event.message || 'Unknown error'}`));
                    };

                    audio.onloadstart = () => {
                        console.log('AzureTTSService: Audio loading started');
                    };

                    audio.oncanplay = () => {
                        console.log('AzureTTSService: Audio ready to play');
                    };

                    // Start playback
                    audio.play().catch(error => {
                        this.activeAudioElements.delete(audio); // Remove from tracking
                        URL.revokeObjectURL(audioUrl);
                        reject(new Error(`Audio play failed: ${error.message}`));
                    });

                } catch (error) {
                    reject(new Error(`Audio setup failed: ${error.message}`));
                }
            });
        }

        // Stop speaking (for compatibility with VoiceService interface)
        stopSpeaking() {
            console.log("AzureTTSService: stopSpeaking called");
            
            // Stop tracked audio elements
            let stoppedCount = 0;
            this.activeAudioElements.forEach(audio => {
                try {
                    if (!audio.paused) {
                        console.log("AzureTTSService: Stopping tracked audio element:", audio.src?.substring(0, 100));
                        audio.pause();
                        audio.currentTime = 0;
                        stoppedCount++;
                    }
                    // Clean up the element
                    this.activeAudioElements.delete(audio);
                } catch (error) {
                    console.warn("AzureTTSService: Error stopping audio element:", error);
                    this.activeAudioElements.delete(audio);
                }
            });
            
            // Also check for any HTML Audio elements in DOM as fallback
            const audioElements = document.querySelectorAll('audio');
            audioElements.forEach(audio => {
                if (!audio.paused) {
                    console.log("AzureTTSService: Stopping DOM audio element:", audio.src?.substring(0, 100));
                    audio.pause();
                    audio.currentTime = 0;
                    stoppedCount++;
                }
            });
            
            console.log(`AzureTTSService: Stopped ${stoppedCount} active audio elements`);
        }

        // Helper method to convert pitch value to SSML format
        getPitchForSSML(pitchValue) {
            // Convert 0.5-2.0 range to percentage for SSML
            // 1.0 = 0%, 0.5 = -50%, 2.0 = +100%
            const percentage = Math.round((pitchValue - 1.0) * 100);
            return percentage >= 0 ? `+${percentage}%` : `${percentage}%`;
        }

        // Helper method to escape XML characters in text
        escapeXML(text) {
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
        }

        // Update configuration
        updateConfig(apiKey, region) {
            this.apiKey = apiKey;
            this.region = region;
            this.endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
            console.log(`AzureTTSService: Configuration updated. Region: ${this.region}`);
        }

        // Get available Azure voices (for future implementation)
        async getAvailableVoices() {
            if (!this.isConfigured()) {
                throw new Error('Azure TTS not configured');
            }

            try {
                const response = await fetch(`https://${this.region}.tts.speech.microsoft.com/cognitiveservices/voices/list`, {
                    method: 'GET',
                    headers: {
                        'Ocp-Apim-Subscription-Key': this.apiKey
                    }
                });

                if (!response.ok) {
                    throw new Error(`Failed to get voices: ${response.status} ${response.statusText}`);
                }

                return response.json();
            } catch (error) {
                console.error('AzureTTSService: Error fetching available voices:', error);
                throw error;
            }
        }
    }
}