if (typeof SSMLProcessor === 'undefined') {
    window.SSMLProcessor = class SSMLProcessor {
        constructor() {
            this.debugMode = localStorage.getItem('debugMode') === 'true' || true; // Enable by default for development
        }

        /**
         * Extracts SSML content from LLM response text
         * @param {string} text - The raw response text from LLM
         * @returns {object} - {hasSSML: boolean, ssml: string, cleanText: string}
         */
        extractSSML(text) {
            if (!text || typeof text !== 'string') {
                return {
                    hasSSML: false,
                    ssml: '',
                    cleanText: text || ''
                };
            }

            // Check if text contains SSML speak tags (full SSML)
            const ssmlPattern = /<speak[^>]*>[\s\S]*?<\/speak>/i;
            const match = text.match(ssmlPattern);

            if (match) {
                const ssml = match[0];
                const cleanText = this.stripSSML(ssml);
                
                if (this.debugMode) {
                    console.log('🎵 SSML Processor: Full SSML detected in response');
                    console.log('🎵 Original SSML:', ssml);
                    console.log('🎵 Clean text:', cleanText);
                }

                return {
                    hasSSML: true,
                    ssml: ssml,
                    cleanText: cleanText
                };
            }

            // Check if text contains SSML elements without proper speak wrapper (partial SSML)
            const partialSSMLPattern = /<mstts:express-as[^>]*>[\s\S]*?<\/mstts:express-as>/i;
            if (partialSSMLPattern.test(text)) {
                // Check if it already has a speak tag but malformed (like incomplete or nested)
                const hasSpeak = text.includes('<speak>') || text.includes('<speak ');
                
                let processedSSML;
                if (hasSpeak) {
                    // Already has speak tags, use as-is but clean up any nesting issues
                    processedSSML = text.trim();
                    // Fix double speak tags by removing inner ones
                    processedSSML = processedSSML.replace(/<speak>\s*<speak[^>]*>/gi, '<speak>');
                    processedSSML = processedSSML.replace(/<\/speak>\s*<\/speak>/gi, '</speak>');
                } else {
                    // No speak wrapper, add one
                    processedSSML = `<speak>${text.trim()}</speak>`;
                }
                
                const cleanText = this.stripSSML(text);
                
                if (this.debugMode) {
                    console.log('🎵 SSML Processor: Partial SSML detected');
                    console.log('🎵 Had speak tags:', hasSpeak);
                    console.log('🎵 Processed SSML:', processedSSML);
                    console.log('🎵 Clean text:', cleanText);
                }

                return {
                    hasSSML: true,
                    ssml: processedSSML,
                    cleanText: cleanText
                };
            }

            // No SSML found, return original text
            return {
                hasSSML: false,
                ssml: '',
                cleanText: text
            };
        }

        /**
         * Strips SSML tags from text to get clean display text
         * @param {string} ssmlText - Text containing SSML tags
         * @returns {string} - Clean text without SSML tags
         */
        stripSSML(ssmlText) {
            if (!ssmlText || typeof ssmlText !== 'string') {
                return ssmlText || '';
            }

            // Remove all SSML tags but preserve the content
            let cleanText = ssmlText
                // Remove speak tags
                .replace(/<\/?speak[^>]*>/gi, '')
                // Remove voice tags
                .replace(/<\/?voice[^>]*>/gi, '')
                // Remove Microsoft TTS style tags
                .replace(/<\/?mstts:express-as[^>]*>/gi, '')
                // Remove prosody tags
                .replace(/<\/?prosody[^>]*>/gi, '')
                // Remove emphasis tags
                .replace(/<\/?emphasis[^>]*>/gi, '')
                // Remove break tags completely (they're just pauses)
                .replace(/<break[^>]*\/?>[\s\S]*?<\/break>|<break[^>]*\/?>/gi, ' ')
                // Remove any other remaining SSML tags
                .replace(/<\/?[^>]+>/gi, '')
                // Clean up extra whitespace
                .replace(/\s+/g, ' ')
                .trim();

            return cleanText;
        }

        /**
         * Validates SSML syntax (basic validation)
         * @param {string} ssml - SSML string to validate
         * @returns {object} - {isValid: boolean, errors: array}
         */
        validateSSML(ssml) {
            const errors = [];

            if (!ssml || typeof ssml !== 'string') {
                errors.push('SSML content is empty or invalid');
                return { isValid: false, errors };
            }

            // Check for basic SSML structure
            if (!ssml.includes('<speak')) {
                errors.push('Missing <speak> root element');
            }

            if (!ssml.includes('</speak>')) {
                errors.push('Missing closing </speak> tag');
            }

            // Check for common SSML syntax issues
            const unclosedTags = this.findUnclosedTags(ssml);
            if (unclosedTags.length > 0) {
                errors.push(`Unclosed tags found: ${unclosedTags.join(', ')}`);
            }

            // Check for invalid nesting (basic check)
            if (ssml.includes('<speak') && ssml.includes('<speak')) {
                const speakCount = (ssml.match(/<speak/g) || []).length;
                if (speakCount > 1) {
                    errors.push('Multiple <speak> tags detected - only one root <speak> element allowed');
                }
            }

            const isValid = errors.length === 0;

            if (this.debugMode) {
                if (isValid) {
                    console.log('🎵 SSML Validation: PASSED');
                } else {
                    console.warn('🎵 SSML Validation: FAILED');
                    console.warn('🎵 Validation errors:', errors);
                }
            }

            return { isValid, errors };
        }

        /**
         * Finds unclosed tags in SSML (simplified check)
         * @param {string} ssml - SSML content
         * @returns {array} - Array of unclosed tag names
         */
        findUnclosedTags(ssml) {
            // Updated regex to handle namespace tags like mstts:express-as
            const openingTags = ssml.match(/<([a-zA-Z][a-zA-Z0-9:-]*)[^>]*>/g) || [];
            const closingTags = ssml.match(/<\/([a-zA-Z][a-zA-Z0-9:-]*)[^>]*>/g) || [];
            const selfClosingTags = ssml.match(/<([a-zA-Z][a-zA-Z0-9:-]*)[^>]*\/>/g) || [];

            const opened = [];
            const unclosed = [];

            // Process opening tags
            openingTags.forEach(tag => {
                const tagMatch = tag.match(/<([a-zA-Z][a-zA-Z0-9:-]*)/);
                if (tagMatch) {
                    const tagName = tagMatch[1];
                    opened.push(tagName);
                }
            });

            // Process self-closing tags (remove from opened list)
            selfClosingTags.forEach(tag => {
                const tagMatch = tag.match(/<([a-zA-Z][a-zA-Z0-9:-]*)/);
                if (tagMatch) {
                    const tagName = tagMatch[1];
                    const index = opened.indexOf(tagName);
                    if (index > -1) {
                        opened.splice(index, 1);
                    }
                }
            });

            // Process closing tags
            closingTags.forEach(tag => {
                const tagMatch = tag.match(/<\/([a-zA-Z][a-zA-Z0-9:-]*)/);
                if (tagMatch) {
                    const tagName = tagMatch[1];
                    const index = opened.indexOf(tagName);
                    if (index > -1) {
                        opened.splice(index, 1);
                    } else {
                        unclosed.push(tagName);
                    }
                }
            });

            return [...new Set([...opened, ...unclosed])]; // Remove duplicates
        }

        /**
         * Logs SSML processing information for debugging
         * @param {string} ssml - Original SSML content
         * @param {string} cleanText - Cleaned text for display
         * @param {string} context - Context information (e.g., model name)
         */
        logSSMLForDebugging(ssml, cleanText, context = '') {
            if (!this.debugMode) return;

            console.group('🎵 SSML Processing Debug');
            console.log('🕐 Timestamp:', new Date().toLocaleTimeString());
            if (context) console.log('📋 Context:', context);
            console.log('🎵 Original SSML:');
            console.log(ssml);
            console.log('🧹 Clean Text:');
            console.log(cleanText);
            console.log('📊 SSML Length:', ssml.length);
            console.log('📊 Clean Text Length:', cleanText.length);
            
            // Analyze SSML elements used
            const prosodyCount = (ssml.match(/<prosody/gi) || []).length;
            const emphasisCount = (ssml.match(/<emphasis/gi) || []).length;
            const breakCount = (ssml.match(/<break/gi) || []).length;
            const voiceCount = (ssml.match(/<voice/gi) || []).length;
            const styleCount = (ssml.match(/<mstts:express-as/gi) || []).length;

            console.log('📈 SSML Elements Used:');
            console.log(`   - Prosody: ${prosodyCount}`);
            console.log(`   - Emphasis: ${emphasisCount}`);
            console.log(`   - Breaks: ${breakCount}`);
            console.log(`   - Voice: ${voiceCount}`);
            console.log(`   - Style (mstts:express-as): ${styleCount}`);
            
            // Extract style information
            if (styleCount > 0) {
                const styleMatches = ssml.match(/<mstts:express-as[^>]*>/gi) || [];
                styleMatches.forEach((match, index) => {
                    const styleAttr = match.match(/style="([^"]*)"/) || [];
                    const degreeAttr = match.match(/styledegree="([^"]*)"/) || [];
                    console.log(`   Style ${index + 1}: ${styleAttr[1] || 'unknown'} (degree: ${degreeAttr[1] || 'default'})`);
                });
            }
            
            console.groupEnd();
        }

        /**
         * Creates a fallback SSML wrapper for plain text
         * @param {string} text - Plain text to wrap
         * @param {string} voiceName - Voice name for SSML
         * @returns {string} - Basic SSML wrapper
         */
        createBasicSSML(text, voiceName = null) {
            if (!text) return '';

            let ssml = '<speak>';
            
            if (voiceName) {
                // Map voice name to Azure voice format if needed
                const azureVoiceName = this.mapToAzureVoiceName(voiceName);
                ssml += `<voice name="${azureVoiceName}">`;
            }
            
            ssml += text;
            
            if (voiceName) {
                ssml += '</voice>';
            }
            
            ssml += '</speak>';

            if (this.debugMode) {
                console.log('🎵 SSML Processor: Created basic SSML wrapper');
                console.log('🎵 Generated SSML:', ssml);
            }

            return ssml;
        }

        /**
         * Maps voice names to Azure TTS voice names
         * @param {string} voiceName - Input voice name
         * @returns {string} - Azure-compatible voice name
         */
        mapToAzureVoiceName(voiceName) {
            const azureVoiceMap = {
                // US Voices
                'Ava': 'en-US-AvaMultilingualNeural',
                'Jenny': 'en-US-JennyNeural',
                'Emma': 'en-US-EmmaNeural',
                'Sara': 'en-US-SaraNeural',
                'Aria': 'en-US-AriaNeural',
                'Ashley': 'en-US-AshleyNeural',
                'Andrew': 'en-US-AndrewNeural',
                'Brian': 'en-US-BrianNeural',
                'Guy': 'en-US-GuyNeural',
                'Jason': 'en-US-JasonNeural',
                'Tony': 'en-US-TonyNeural',
                
                // UK Voices
                'Sonia': 'en-GB-SoniaNeural',
                'Libby': 'en-GB-LibbyNeural',
                'Olivia': 'en-GB-OliviaNeural',
                'Hollie': 'en-GB-HollieNeural',
                'Ryan': 'en-GB-RyanNeural',
                'Alfie': 'en-GB-AlfieNeural',
                'Oliver': 'en-GB-OliverNeural',
                
                // AU Voices
                'Natasha': 'en-AU-NatashaNeural',
                'Freya': 'en-AU-FreyaNeural',
                'William': 'en-AU-WilliamNeural',
                'Neil': 'en-AU-NeilNeural',
                
                // CA Voices
                'Clara': 'en-CA-ClaraNeural',
                'Liam': 'en-CA-LiamNeural'
            };

            return azureVoiceMap[voiceName] || voiceName;
        }

        /**
         * Enables or disables debug mode
         * @param {boolean} enabled - Whether to enable debug logging
         */
        setDebugMode(enabled) {
            this.debugMode = enabled;
            localStorage.setItem('debugMode', enabled.toString());
            console.log(`🎵 SSML Processor: Debug mode ${enabled ? 'enabled' : 'disabled'}`);
        }

        /**
         * Gets comprehensive Azure TTS style reference guide
         * @returns {object} - Complete style reference with descriptions
         */
        getAzureStyleReference() {
            return {
                // Positive/Upbeat Emotions
                'cheerful': 'Expresses a positive and happy tone',
                'excited': 'Expresses an upbeat and hopeful tone, like something great is happening',
                'affectionate': 'Expresses a warm and affectionate tone with higher pitch and vocal energy',
                'friendly': 'Expresses a pleasant, inviting, and warm tone that sounds sincere and caring',
                'gentle': 'Expresses a mild, polite, and pleasant tone with lower pitch and vocal energy',
                'hopeful': 'Expresses a warm and yearning tone, like something good is expected',
                'advertisement_upbeat': 'Expresses an excited and high-energy tone for promoting',

                // Negative Emotions
                'sad': 'Expresses a sorrowful tone',
                'depressed': 'Expresses a melancholic and despondent tone with lower pitch and energy',
                'angry': 'Expresses an angry and annoyed tone',
                'disgruntled': 'Expresses a disdainful and complaining tone with displeasure and contempt',
                'fearful': 'Expresses a scared and nervous tone with higher pitch, energy, and faster rate',
                'terrified': 'Expresses a scared tone with faster pace and shakier voice, unsteady and frantic',
                'embarrassed': 'Expresses an uncertain and hesitant tone when feeling uncomfortable',
                'unfriendly': 'Expresses a cold and indifferent tone',
                'envious': 'Expresses a tone of admiration when you desire something someone else has',

                // Neutral/Professional
                'assistant': 'Expresses a warm and relaxed tone for digital assistants',
                'chat': 'Expresses a casual and relaxed tone',
                'calm': 'Expresses a cool, collected, and composed attitude with uniform tone and pitch',
                'customerservice': 'Expresses a friendly and helpful tone for customer support',
                'serious': 'Expresses a strict and commanding tone, stiffer and less relaxed with firm cadence',
                'empathetic': 'Expresses a sense of caring and understanding',

                // Special Expressions
                'whispering': 'Expresses a soft tone trying to make a quiet and gentle sound',
                'shouting': 'Expresses a tone as if the voice is distant and making effort to be clearly heard',
                'lyrical': 'Expresses emotions in a melodic and sentimental way',
                'poetry-reading': 'Expresses an emotional and rhythmic tone while reading poetry',

                // Narration Styles
                'documentary-narration': 'Narrates in a relaxed, interested, and informative style for documentaries',
                'narration-professional': 'Expresses a professional, objective tone for content reading',
                'narration-relaxed': 'Expresses a soothing and melodious tone for content reading',
                'newscast': 'Expresses a formal and professional tone for narrating news',
                'newscast-casual': 'Expresses a versatile and casual tone for general news delivery',
                'newscast-formal': 'Expresses a formal, confident, and authoritative tone for news delivery',

                // Sports Commentary
                'sports_commentary': 'Expresses a relaxed and interested tone for broadcasting sports events',
                'sports_commentary_excited': 'Expresses an intensive and energetic tone for exciting sports moments'
            };
        }

        /**
         * Prints comprehensive style guide to console
         */
        printStyleGuide() {
            const styles = this.getAzureStyleReference();
            console.group('🎭 Azure TTS Style Reference Guide');
            console.log('🎵 Total Available Styles:', Object.keys(styles).length);
            
            console.group('😊 POSITIVE EMOTIONS');
            ['cheerful', 'excited', 'affectionate', 'friendly', 'gentle', 'hopeful', 'advertisement_upbeat'].forEach(style => {
                console.log(`${style}: ${styles[style]}`);
            });
            console.groupEnd();

            console.group('😢 NEGATIVE EMOTIONS');
            ['sad', 'depressed', 'angry', 'disgruntled', 'fearful', 'terrified', 'embarrassed', 'unfriendly', 'envious'].forEach(style => {
                console.log(`${style}: ${styles[style]}`);
            });
            console.groupEnd();

            console.group('🤝 NEUTRAL/PROFESSIONAL');
            ['assistant', 'chat', 'calm', 'customerservice', 'serious', 'empathetic'].forEach(style => {
                console.log(`${style}: ${styles[style]}`);
            });
            console.groupEnd();

            console.group('🎪 SPECIAL EXPRESSIONS');
            ['whispering', 'shouting', 'lyrical', 'poetry-reading'].forEach(style => {
                console.log(`${style}: ${styles[style]}`);
            });
            console.groupEnd();

            console.group('📺 NARRATION STYLES');
            ['documentary-narration', 'narration-professional', 'narration-relaxed', 'newscast', 'newscast-casual', 'newscast-formal'].forEach(style => {
                console.log(`${style}: ${styles[style]}`);
            });
            console.groupEnd();

            console.group('🏀 SPORTS COMMENTARY');
            ['sports_commentary', 'sports_commentary_excited'].forEach(style => {
                console.log(`${style}: ${styles[style]}`);
            });
            console.groupEnd();

            console.log('💡 Usage: <mstts:express-as style="STYLE" styledegree="0.5-2.0">');
            console.log('💡 Degrees: 1.0=normal, 1.5=strong, 1.8=very strong, 2.0=maximum (USE 1.5-2.0 for clear emotions)');
            console.groupEnd();
        }
    }
}