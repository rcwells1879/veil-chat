// Offline Manager for VeilChat PWA
class OfflineManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.offlineQueue = [];
        this.offlineData = {
            conversations: new Map(),
            settings: {},
            attachedDocs: new Map()
        };
        
        this.initializeEventListeners();
        this.loadOfflineData();
    }
    
    initializeEventListeners() {
        // Network status changes
        window.addEventListener('online', () => {
            console.log('Network: Back online');
            this.isOnline = true;
            this.syncOfflineQueue();
            this.updateOfflineIndicator(false);
        });
        
        window.addEventListener('offline', () => {
            console.log('Network: Gone offline');
            this.isOnline = false;
            this.updateOfflineIndicator(true);
        });
        
        // Page visibility changes (for saving data)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.saveOfflineData();
            }
        });
        
        // Before page unload
        window.addEventListener('beforeunload', () => {
            this.saveOfflineData();
        });
    }
    
    // Save conversation to offline storage
    saveConversation(conversationId, messages) {
        this.offlineData.conversations.set(conversationId, {
            messages: [...messages],
            lastUpdated: Date.now()
        });
        
        // Save to localStorage immediately
        this.saveOfflineData();
    }
    
    // Get conversation from offline storage
    getConversation(conversationId) {
        return this.offlineData.conversations.get(conversationId);
    }
    
    // Save user settings offline
    saveSettings(settings) {
        this.offlineData.settings = { ...settings };
        this.saveOfflineData();
    }
    
    // Get settings from offline storage
    getSettings() {
        return this.offlineData.settings;
    }
    
    // Save attached document offline
    saveAttachedDoc(docId, docData) {
        this.offlineData.attachedDocs.set(docId, {
            ...docData,
            savedAt: Date.now()
        });
        this.saveOfflineData();
    }
    
    // Get attached document from offline storage
    getAttachedDoc(docId) {
        return this.offlineData.attachedDocs.get(docId);
    }
    
    // Queue API request for when online
    queueRequest(requestData) {
        const queueItem = {
            id: Date.now().toString(),
            ...requestData,
            timestamp: Date.now()
        };
        
        this.offlineQueue.push(queueItem);
        console.log('Offline: Queued request', queueItem.id);
        
        // Save queue to localStorage
        localStorage.setItem('veilchat_offline_queue', JSON.stringify(this.offlineQueue));
        
        return queueItem.id;
    }
    
    // Sync queued requests when back online
    async syncOfflineQueue() {
        if (!this.isOnline || this.offlineQueue.length === 0) return;
        
        console.log(`Offline: Syncing ${this.offlineQueue.length} queued requests`);
        
        const queue = [...this.offlineQueue];
        this.offlineQueue = [];
        
        for (const item of queue) {
            try {
                await this.processQueuedRequest(item);
                console.log('Offline: Successfully synced request', item.id);
            } catch (error) {
                console.error('Offline: Failed to sync request', item.id, error);
                // Re-queue failed requests
                this.offlineQueue.push(item);
            }
        }
        
        // Update localStorage
        localStorage.setItem('veilchat_offline_queue', JSON.stringify(this.offlineQueue));
    }
    
    // Process a queued request
    async processQueuedRequest(item) {
        switch (item.type) {
            case 'llm_request':
                // Re-send LLM request
                return await this.processOfflineLLMRequest(item);
            case 'save_conversation':
                // Save conversation to server if needed
                return await this.processSaveConversation(item);
            default:
                console.warn('Offline: Unknown request type', item.type);
        }
    }
    
    // Handle offline LLM requests
    async processOfflineLLMRequest(item) {
        // This would integrate with your LLM service
        // For now, just log that we would process it
        console.log('Offline: Would process LLM request', item);
    }
    
    // Handle saving conversations
    async processSaveConversation(item) {
        // This would save to server if you have conversation sync
        console.log('Offline: Would save conversation', item);
    }
    
    // Save all offline data to localStorage
    saveOfflineData() {
        try {
            const data = {
                conversations: Array.from(this.offlineData.conversations.entries()),
                settings: this.offlineData.settings,
                attachedDocs: Array.from(this.offlineData.attachedDocs.entries()),
                lastSaved: Date.now()
            };
            
            localStorage.setItem('veilchat_offline_data', JSON.stringify(data));
            
            // Also save queue
            localStorage.setItem('veilchat_offline_queue', JSON.stringify(this.offlineQueue));
            
        } catch (error) {
            console.error('Offline: Failed to save data to localStorage', error);
        }
    }
    
    // Load offline data from localStorage
    loadOfflineData() {
        try {
            // Load main data
            const savedData = localStorage.getItem('veilchat_offline_data');
            if (savedData) {
                const data = JSON.parse(savedData);
                this.offlineData.conversations = new Map(data.conversations || []);
                this.offlineData.settings = data.settings || {};
                this.offlineData.attachedDocs = new Map(data.attachedDocs || []);
                console.log('Offline: Loaded saved data from', new Date(data.lastSaved));
            }
            
            // Load queue
            const savedQueue = localStorage.getItem('veilchat_offline_queue');
            if (savedQueue) {
                this.offlineQueue = JSON.parse(savedQueue);
                console.log(`Offline: Loaded ${this.offlineQueue.length} queued requests`);
            }
            
        } catch (error) {
            console.error('Offline: Failed to load data from localStorage', error);
        }
    }
    
    // Clear old offline data (cleanup)
    cleanupOldData(maxAgeMs = 7 * 24 * 60 * 60 * 1000) { // 7 days default
        const cutoff = Date.now() - maxAgeMs;
        
        // Clean conversations
        for (const [id, data] of this.offlineData.conversations.entries()) {
            if (data.lastUpdated < cutoff) {
                this.offlineData.conversations.delete(id);
            }
        }
        
        // Clean attached docs
        for (const [id, data] of this.offlineData.attachedDocs.entries()) {
            if (data.savedAt < cutoff) {
                this.offlineData.attachedDocs.delete(id);
            }
        }
        
        // Clean old queue items
        this.offlineQueue = this.offlineQueue.filter(item => 
            item.timestamp > cutoff
        );
        
        this.saveOfflineData();
    }
    
    // Show/hide offline indicator
    updateOfflineIndicator(isOffline) {
        let indicator = document.getElementById('offline-indicator');
        
        if (isOffline) {
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'offline-indicator';
                indicator.innerHTML = '⚠️ Offline Mode';
                indicator.style.cssText = `
                    position: fixed;
                    top: 50px;
                    right: 10px;
                    background: #ff6b6b;
                    color: white;
                    padding: 8px 12px;
                    border-radius: 6px;
                    font-size: 12px;
                    z-index: 999;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                `;
                document.body.appendChild(indicator);
            }
        } else {
            if (indicator) {
                indicator.remove();
            }
        }
    }
    
    // Get offline status
    getOfflineStatus() {
        return {
            isOnline: this.isOnline,
            queuedRequests: this.offlineQueue.length,
            savedConversations: this.offlineData.conversations.size,
            savedDocuments: this.offlineData.attachedDocs.size
        };
    }
    
    // Export offline data (for backup)
    exportOfflineData() {
        const data = {
            conversations: Array.from(this.offlineData.conversations.entries()),
            settings: this.offlineData.settings,
            attachedDocs: Array.from(this.offlineData.attachedDocs.entries()),
            queue: this.offlineQueue,
            exportedAt: Date.now()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], 
            { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `veilchat-offline-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
    }
}

// Create global instance
window.offlineManager = new OfflineManager();

console.log('Offline Manager initialized');