if (typeof ContextService === 'undefined') {
    window.ContextService = class ContextService {
        constructor() {
            this.attachedDocuments = [];
            this.maxFileSize = 10 * 1024 * 1024; // 10MB limit
        
        // Configure PDF.js worker
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
        
        this.supportedTypes = {
            'text/plain': 'txt',
            'application/json': 'json',
            'text/javascript': 'js',
            'application/javascript': 'js',
            'text/x-python': 'py',
            'application/pdf': 'pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
            'text/html': 'html',
            'text/css': 'css',
            'text/markdown': 'md',
            'application/xml': 'xml',
            'text/xml': 'xml',
            'application/x-yaml': 'yaml',
            'text/yaml': 'yaml'
        };
        
        // File extension fallback mapping
        this.extensionMap = {
            'txt': 'txt',
            'js': 'js',
            'py': 'py',
            'json': 'json',
            'pdf': 'pdf',
            'docx': 'docx',
            'cpp': 'cpp',
            'h': 'cpp',
            'cs': 'cs',
            'html': 'html',
            'css': 'css',
            'md': 'md',
            'xml': 'xml',
            'yaml': 'yaml',
            'yml': 'yaml',
            'log': 'txt'
        };
    }

    async processFiles(files) {
        const results = [];
        
        for (const file of files) {
            try {
                if (file.size > this.maxFileSize) {
                    throw new Error(`File ${file.name} is too large (max 10MB)`);
                }

                const fileType = this.getFileType(file);
                if (!fileType) {
                    throw new Error(`File type not supported: ${file.name}`);
                }

                const extractedText = await this.extractText(file, fileType);
                
                // 🔒 SECURITY: Validate and sanitize extracted file content
                let finalContent = extractedText;
                let securityValidated = false;
                
                if (window.securityValidator) {
                    const validation = window.securityValidator.validateAttachedFileContent(
                        extractedText, 
                        file.name, 
                        fileType
                    );
                    
                    if (!validation.isValid) {
                        console.warn('🔒 Security: File content blocked:', validation.violations);
                        window.securityValidator.logSecurityEvent('FILE_CONTENT_BLOCKED', {
                            fileName: file.name,
                            fileType: fileType,
                            violations: validation.violations,
                            riskLevel: validation.riskLevel
                        });
                        
                        throw new Error(`File "${file.name}" contains potentially unsafe content: ${validation.violations.join(', ')}`);
                    }
                    
                    // Use sanitized content
                    finalContent = validation.sanitizedContent;
                    securityValidated = true;
                    console.log('🔒 Security: File content validated and sanitized');
                }
                
                const document = {
                    id: Date.now() + Math.random(),
                    name: file.name,
                    type: fileType,
                    size: file.size,
                    content: finalContent,
                    preview: this.generatePreview(finalContent),
                    addedAt: new Date().toISOString(),
                    securityValidated: securityValidated
                };

                this.attachedDocuments.push(document);
                results.push({ success: true, document });
                
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
                results.push({ success: false, error: error.message, fileName: file.name });
            }
        }
        
        return results;
    }

    getFileType(file) {
        // First try MIME type
        if (this.supportedTypes[file.type]) {
            return this.supportedTypes[file.type];
        }
        
        // Fallback to file extension
        const extension = file.name.toLowerCase().split('.').pop();
        return this.extensionMap[extension] || null;
    }

    async extractText(file, fileType) {
        switch (fileType) {
            case 'pdf':
                return await this.extractPdfText(file);
            case 'docx':
                return await this.extractDocxText(file);
            case 'txt':
            case 'js':
            case 'py':
            case 'cpp':
            case 'cs':
            case 'html':
            case 'css':
            case 'md':
            case 'xml':
            case 'yaml':
                return await this.extractPlainText(file);
            case 'json':
                return await this.extractJsonText(file);
            default:
                throw new Error(`Unsupported file type: ${fileType}`);
        }
    }

    async extractPdfText(file) {
        if (typeof pdfjsLib === 'undefined') {
            throw new Error('PDF.js library not loaded. Cannot extract PDF text.');
        }

        return new Promise((resolve, reject) => {
            const fileReader = new FileReader();
            fileReader.onload = async function() {
                try {
                    const typedArray = new Uint8Array(this.result);
                    const pdf = await pdfjsLib.getDocument(typedArray).promise;
                    let fullText = '';

                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const content = await page.getTextContent();
                        const pageText = content.items.map(item => item.str).join(' ');
                        fullText += pageText + '\n\n';
                    }

                    resolve(fullText.trim());
                } catch (error) {
                    reject(new Error(`Failed to extract PDF text: ${error.message}`));
                }
            };
            fileReader.onerror = () => reject(new Error('Failed to read PDF file'));
            fileReader.readAsArrayBuffer(file);
        });
    }

    async extractDocxText(file) {
        if (typeof mammoth === 'undefined') {
            throw new Error('Mammoth.js library not loaded. Cannot extract DOCX text.');
        }

        return new Promise((resolve, reject) => {
            const fileReader = new FileReader();
            fileReader.onload = async function() {
                try {
                    const arrayBuffer = this.result;
                    const result = await mammoth.extractRawText({ arrayBuffer });
                    resolve(result.value);
                } catch (error) {
                    reject(new Error(`Failed to extract DOCX text: ${error.message}`));
                }
            };
            fileReader.onerror = () => reject(new Error('Failed to read DOCX file'));
            fileReader.readAsArrayBuffer(file);
        });
    }

    async extractPlainText(file) {
        return new Promise((resolve, reject) => {
            const fileReader = new FileReader();
            fileReader.onload = function() {
                resolve(this.result);
            };
            fileReader.onerror = () => reject(new Error('Failed to read text file'));
            fileReader.readAsText(file);
        });
    }

    async extractJsonText(file) {
        const text = await this.extractPlainText(file);
        try {
            // Validate JSON and format it nicely
            const parsed = JSON.parse(text);
            return JSON.stringify(parsed, null, 2);
        } catch (error) {
            throw new Error('Invalid JSON file');
        }
    }

    generatePreview(content, maxLength = 150) {
        if (!content) return 'Empty file';
        const preview = content.trim().substring(0, maxLength);
        return preview.length < content.length ? preview + '...' : preview;
    }

    removeDocument(documentId) {
        const idNum = Number(documentId);
        this.attachedDocuments = this.attachedDocuments.filter(doc => doc.id !== idNum);
        return this.attachedDocuments.length;
    }

    clearAllDocuments() {
        this.attachedDocuments = [];
    } 

    getAttachedDocuments() {
        return [...this.attachedDocuments];
    }

    hasDocuments() {
        return this.attachedDocuments.length > 0;
    }

    getDocumentContext() {
        if (this.attachedDocuments.length === 0) {
            return '';
        }

        const contextParts = this.attachedDocuments.map(doc => {
            return `--- Document: ${doc.name} ---\n${doc.content}\n--- End of ${doc.name} ---\n`;
        });

        return `[Document Context - The following documents have been provided for reference]\n\n${contextParts.join('\n')}\n[End of Document Context]\n\n`;
    }

    getDocumentSummary() {
        if (this.attachedDocuments.length === 0) {
            return 'No documents attached';
        }
        
        const totalSize = this.attachedDocuments.reduce((sum, doc) => sum + doc.size, 0);
        const types = [...new Set(this.attachedDocuments.map(doc => doc.type))];
        
        return `${this.attachedDocuments.length} document(s) | ${this.formatFileSize(totalSize)} | Types: ${types.join(', ')}`;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    }

    // Export/Import context for conversation saving
    exportContext() {
        return {
            version: "1.0",
            documents: this.attachedDocuments,
            exportedAt: new Date().toISOString()
        };
    }

    importContext(contextData) {
        if (contextData && contextData.documents && Array.isArray(contextData.documents)) {
            // 🔒 SECURITY: Validate and sanitize imported document content
            const sanitizedDocuments = [];
            let blockedDocuments = 0;
            
            for (const doc of contextData.documents) {
                if (doc && doc.content) {
                    // Validate document content using SecurityValidator
                    if (window.securityValidator) {
                        const validation = window.securityValidator.validateAttachedFileContent(
                            doc.content,
                            doc.name || 'imported-document',
                            doc.type || 'unknown'
                        );
                        
                        if (!validation.isValid) {
                            console.warn('🔒 Security: Blocked malicious document in imported context:', validation.violations);
                            window.securityValidator.logSecurityEvent('DOCUMENT_IMPORT_BLOCKED', {
                                documentName: doc.name,
                                documentType: doc.type,
                                violations: validation.violations,
                                riskLevel: validation.riskLevel
                            });
                            blockedDocuments++;
                            
                            // Replace with sanitized placeholder
                            sanitizedDocuments.push({
                                ...doc,
                                content: '[Document content blocked for security - contained potentially malicious content]',
                                securityValidated: false,
                                originallyBlocked: true
                            });
                        } else {
                            // Use sanitized content
                            sanitizedDocuments.push({
                                ...doc,
                                content: validation.sanitizedContent,
                                securityValidated: true,
                                originallyBlocked: false
                            });
                        }
                    } else {
                        // Fallback if SecurityValidator not available
                        sanitizedDocuments.push({
                            ...doc,
                            securityValidated: false,
                            originallyBlocked: false
                        });
                    }
                } else {
                    // Keep documents without content as-is
                    sanitizedDocuments.push({
                        ...doc,
                        securityValidated: false,
                        originallyBlocked: false
                    });
                }
            }
            
            this.attachedDocuments = sanitizedDocuments;
            
            if (blockedDocuments > 0) {
                console.warn(`🔒 Security: ${blockedDocuments} documents blocked during context import`);
            }
            
            return true;
        }
        return false;
    }
}
}