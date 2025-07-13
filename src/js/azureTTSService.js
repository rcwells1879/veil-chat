if (typeof AzureTTSService === 'undefined') {
    window.AzureTTSService = class AzureTTSService {
        constructor(apiKey = null, region = 'eastus') {
            this.apiKey = apiKey;
            this.region = region;
            this.endpoint = `https://${region}.tts.speech.microsoft.com/`;
            
            // Voice settings with defaults
            this.voiceRate = 1.0;
            this.voicePitch = 1.0;
            this.currentVoice = 'en-US-JennyNeural';
            
            console.log(`AzureTTSService initialized. Region: ${this.region}, Endpoint: ${this.endpoint}`);
        }

        // Check if Azure TTS is properly configured
        isConfigured() {
            return !!(this.apiKey && this.region);
        }

        // Voice settings getters and setters
        setVoiceRate(rate) {
            // Clamp rate between 0.5 and 2.0 for Azure compatibility
            this.voiceRate = Math.max(0.5, Math.min(2.0, parseFloat(rate) || 1.0));
            console.log(`AzureTTSService: Voice rate set to ${this.voiceRate}`);
        }

        getVoiceRate() {
            return this.voiceRate;
        }

        setVoicePitch(pitch) {
            // Clamp pitch between 0.5 and 2.0
            this.voicePitch = Math.max(0.5, Math.min(2.0, parseFloat(pitch) || 1.0));
            console.log(`AzureTTSService: Voice pitch set to ${this.voicePitch}`);
        }

        getVoicePitch() {
            return this.voicePitch;
        }

        setVoice(voice) {
            this.currentVoice = voice || 'en-US-JennyNeural';
            console.log(`AzureTTSService: Voice set to ${this.currentVoice}`);
        }

        getVoice() {
            return this.currentVoice;
        }

        // Convert voice keyword to Azure neural voice name
        mapVoiceKeywordToAzure(voiceKeyword) {
            const voiceMap = {
                'AUTO': 'en-US-JennyNeural',
                
                // US Female Voices
                'Ava': 'en-US-AvaNeural',
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
            
            return voiceMap[voiceKeyword] || 'en-US-JennyNeural';
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
                    console.log(`AzureTTSService: Starting TTS for text: "${textToSpeak.substring(0, 50)}..."`);
                    
                    // Map voice keyword to Azure voice
                    const azureVoice = preferredVoiceKeyword ? 
                        this.mapVoiceKeywordToAzure(preferredVoiceKeyword) : 
                        this.currentVoice;

                    // Get audio buffer from Azure
                    const audioBuffer = await this.synthesize(textToSpeak, azureVoice);
                    
                    // Play audio using HTML Audio Element
                    await this.playAudio(audioBuffer);
                    
                    console.log(`AzureTTSService: TTS completed for text: "${textToSpeak.substring(0, 30)}..."`);
                    resolve();
                    
                } catch (error) {
                    console.error('AzureTTSService: Error during speech synthesis:', error);
                    reject(error);
                }
            });
        }

        // Synthesize text to audio using Azure Speech Services
        async synthesize(text, voice = 'en-US-JennyNeural') {
            // Create SSML with voice settings
            const ssml = `<speak version="1.0" xml:lang="en-US">
                <voice name="${voice}">
                    <prosody rate="${this.voiceRate}" pitch="${this.getPitchForSSML(this.voicePitch)}">${this.escapeXML(text)}</prosody>
                </voice>
            </speak>`;

            console.log(`AzureTTSService: Sending request to Azure for voice: ${voice}`);

            const response = await fetch(`${this.endpoint}cognitiveservices/v1`, {
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

        // Play audio using HTML Audio Element
        async playAudio(audioBuffer) {
            return new Promise((resolve, reject) => {
                try {
                    // Create audio element
                    const audio = new Audio();
                    
                    // Create blob and object URL
                    const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
                    const audioUrl = URL.createObjectURL(blob);
                    audio.src = audioUrl;

                    // Set up event handlers
                    audio.onended = () => {
                        URL.revokeObjectURL(audioUrl); // Clean up memory
                        resolve();
                    };

                    audio.onerror = (event) => {
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
            // For HTML Audio elements, we'd need to track active audio elements
            // For now, we'll implement basic stopping
            const audioElements = document.querySelectorAll('audio');
            audioElements.forEach(audio => {
                if (!audio.paused) {
                    audio.pause();
                    audio.currentTime = 0;
                }
            });
            console.log("AzureTTSService: Stopped all active audio playback");
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
            this.endpoint = `https://${region}.tts.speech.microsoft.com/`;
            console.log(`AzureTTSService: Configuration updated. Region: ${this.region}`);
        }

        // Get available Azure voices (for future implementation)
        async getAvailableVoices() {
            if (!this.isConfigured()) {
                throw new Error('Azure TTS not configured');
            }

            try {
                const response = await fetch(`${this.endpoint}cognitiveservices/voices/list`, {
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