if (typeof AzureSTTService === 'undefined') {
    window.AzureSTTService = class AzureSTTService {
        constructor(apiKey = null, region = 'eastus') {
            this.apiKey = apiKey;
            this.region = region;
            
            // Track recognition state
            this.isRecognizing = false;
            this.recognizer = null;
            
            // Callbacks
            this.onInterimResult = null;
            this.onFinalResult = null;
            this.onError = null;
            this.onEnd = null;
            
            console.log(`AzureSTTService initialized. Region: ${this.region}`);
        }

        // Check if Azure STT is properly configured
        isConfigured() {
            return !!(this.apiKey && this.region && typeof Microsoft !== 'undefined' && Microsoft.CognitiveServices && Microsoft.CognitiveServices.Speech);
        }

        // Update configuration
        updateConfig(apiKey, region) {
            this.apiKey = apiKey;
            this.region = region;
            console.log(`AzureSTTService: Config updated. Region: ${this.region}, API Key: ${this.apiKey ? 'PRESENT' : 'MISSING'}`);
        }

        // Start continuous speech recognition
        async startContinuousRecognition(onInterimResult, onFinalResult, onError, onEnd) {
            if (!this.isConfigured()) {
                const error = 'Azure STT not configured properly';
                console.error('AzureSTTService:', error);
                if (onError) onError(error);
                return false;
            }

            if (this.isRecognizing) {
                console.warn('AzureSTTService: Recognition already active');
                return false;
            }

            try {
                // Store callbacks
                this.onInterimResult = onInterimResult;
                this.onFinalResult = onFinalResult;
                this.onError = onError;
                this.onEnd = onEnd;

                // Create speech configuration
                const speechConfig = Microsoft.CognitiveServices.Speech.SpeechConfig.fromSubscription(
                    this.apiKey, 
                    this.region
                );
                speechConfig.speechRecognitionLanguage = "en-US";

                // Create audio configuration from microphone
                const audioConfig = Microsoft.CognitiveServices.Speech.AudioConfig.fromDefaultMicrophoneInput();

                // Create speech recognizer
                this.recognizer = new Microsoft.CognitiveServices.Speech.SpeechRecognizer(speechConfig, audioConfig);

                // Set up event handlers
                this.recognizer.recognizing = (s, e) => {
                    if (e.result.reason === Microsoft.CognitiveServices.Speech.ResultReason.RecognizingSpeech) {
                        console.log('AzureSTTService: Interim result:', e.result.text);
                        if (this.onInterimResult) {
                            this.onInterimResult(e.result.text);
                        }
                    }
                };

                this.recognizer.recognized = (s, e) => {
                    if (e.result.reason === Microsoft.CognitiveServices.Speech.ResultReason.RecognizedSpeech) {
                        console.log('AzureSTTService: Final result:', e.result.text);
                        if (this.onFinalResult) {
                            this.onFinalResult(e.result.text);
                        }
                    } else if (e.result.reason === Microsoft.CognitiveServices.Speech.ResultReason.NoMatch) {
                        console.log('AzureSTTService: No speech recognized');
                    }
                };

                this.recognizer.canceled = (s, e) => {
                    console.log('AzureSTTService: Recognition canceled:', e.reason);
                    if (e.reason === Microsoft.CognitiveServices.Speech.CancellationReason.Error) {
                        const errorMsg = `Azure STT error: ${e.errorDetails}`;
                        console.error('AzureSTTService:', errorMsg);
                        if (this.onError) {
                            this.onError(errorMsg);
                        }
                    }
                    this.cleanup();
                };

                this.recognizer.sessionStopped = (s, e) => {
                    console.log('AzureSTTService: Session stopped');
                    this.cleanup();
                    if (this.onEnd) {
                        this.onEnd();
                    }
                };

                // Start continuous recognition
                console.log('AzureSTTService: Starting continuous recognition...');
                this.recognizer.startContinuousRecognitionAsync(
                    () => {
                        console.log('AzureSTTService: Continuous recognition started successfully');
                        this.isRecognizing = true;
                    },
                    (err) => {
                        console.error('AzureSTTService: Failed to start recognition:', err);
                        this.cleanup();
                        if (this.onError) {
                            this.onError(`Failed to start Azure STT: ${err}`);
                        }
                    }
                );

                return true;

            } catch (error) {
                console.error('AzureSTTService: Error starting recognition:', error);
                this.cleanup();
                if (onError) onError(error.message || 'Azure STT initialization error');
                return false;
            }
        }

        // Stop speech recognition
        stopRecognition() {
            if (!this.isRecognizing || !this.recognizer) {
                console.log('AzureSTTService: No active recognition to stop');
                return;
            }

            console.log('AzureSTTService: Stopping recognition...');
            
            try {
                this.recognizer.stopContinuousRecognitionAsync(
                    () => {
                        console.log('AzureSTTService: Recognition stopped successfully');
                        this.cleanup();
                    },
                    (err) => {
                        console.error('AzureSTTService: Error stopping recognition:', err);
                        this.cleanup();
                    }
                );
            } catch (error) {
                console.error('AzureSTTService: Exception stopping recognition:', error);
                this.cleanup();
            }
        }

        // Clean up resources
        cleanup() {
            if (this.recognizer) {
                try {
                    this.recognizer.close();
                } catch (error) {
                    console.error('AzureSTTService: Error closing recognizer:', error);
                }
                this.recognizer = null;
            }
            
            this.isRecognizing = false;
            this.onInterimResult = null;
            this.onFinalResult = null;
            this.onError = null;
            this.onEnd = null;
        }

        // Check if currently recognizing
        getIsRecognizing() {
            return this.isRecognizing;
        }
    }
}