

import Dexie, { type Table } from 'dexie';
import { OPFSManager } from './opfs-manager';
import { notify } from '../ui/notification-api';

// Data Models

export interface Message {
    id: string;
    threadId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    complete?: boolean;
    attachments?: Attachment[];
    metadata?: MessageMetadata;
}

export interface Attachment {
    type: 'image' | 'document' | 'audio';
    assetId: string;
    metadata: Record<string, any>;
}

export interface MessageMetadata {
    tokenCount?: number;
    inferenceTimeMs?: number;
    modelVersion?: string;
    citedSources?: string[];
}

export interface Thread {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    messageCount: number;
    settings?: ThreadSettings;
}

export interface ThreadSettings {
    temperature: number;
    topK: number;
    systemPrompt: string;
    enabledFeatures: string[];
}

export interface ThreadMetadata {
    id: string;
    title: string;
    lastMessageTime: number;
    messageCount: number;
}

export interface Document {
    id: string;
    filename: string;
    chunkCount: number;
    createdAt: number;
}

export interface Chunk {
    id: string;
    documentId: string;
    content: string;
    startOffset: number;
    endOffset: number;
}

export interface Setting {
    key: string;
    value: any;
}

export interface Asset {
    id: string;
    type: 'image' | 'audio' | 'document';
    mimeType: string;
    sizeBytes: number;
    createdAt: number;
    metadata?: AssetMetadata;
}

export interface AssetMetadata {
    width?: number;
    height?: number;
    durationMs?: number;
    generationParams?: Record<string, any>;
}

// IndexedDB Database

class LocalAIDatabase extends Dexie {
    threads!: Table<Thread, string>;
    messages!: Table<Message, string>;
    documents!: Table<Document, string>;
    chunks!: Table<Chunk, string>;
    settings!: Table<Setting, string>;

    constructor() {
        super('LocalAIAssistant');

        this.version(1).stores({
            threads: 'id, updatedAt',
            messages: 'id, threadId, timestamp',
            documents: 'id, filename',
            chunks: 'id, documentId, content',
            settings: 'key'
        });

        // Version 2: Add notification log store
        this.version(2).stores({
            threads: 'id, updatedAt',
            messages: 'id, threadId, timestamp',
            documents: 'id, filename',
            chunks: 'id, documentId, content',
            settings: 'key',
            notificationLog: 'id, type, loggedAt'
        });
    }
}

// Storage Manager Interface

export interface StorageEstimate {
    usage: number;
    quota: number;
}

export interface IntegrityReport {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

export class StorageManager {
    private db: LocalAIDatabase;
    private opfs: OPFSManager;
    private persistenceRequested: boolean = false;
    private quotaMonitorInterval: number | null = null;
    private quotaWarningThreshold: number = 0.9; // Warn at 90% usage
    private onQuotaWarning?: (usage: number, quota: number) => void;
    private hasShownQuotaWarning: boolean = false;

    constructor() {
        this.db = new LocalAIDatabase();
        this.opfs = new OPFSManager();
    }

    setQuotaWarningCallback(callback: (usage: number, quota: number) => void): void {
        this.onQuotaWarning = callback;
    }

    startQuotaMonitoring(intervalMs: number = 60000): void {
        if (this.quotaMonitorInterval !== null) {
            return; // Already monitoring
        }

        // Check immediately
        this.checkStorageQuota();

        // Then check periodically
        this.quotaMonitorInterval = window.setInterval(() => {
            this.checkStorageQuota();
        }, intervalMs);
    }

    stopQuotaMonitoring(): void {
        if (this.quotaMonitorInterval !== null) {
            window.clearInterval(this.quotaMonitorInterval);
            this.quotaMonitorInterval = null;
        }
    }

    private async checkStorageQuota(): Promise<void> {
        try {
            const estimate = await this.getStorageEstimate();

            if (estimate.quota === 0) {
                return; // Storage API not available
            }

            const usageRatio = estimate.usage / estimate.quota;

            if (usageRatio >= this.quotaWarningThreshold) {
                // Only show warning once until storage usage drops below threshold
                if (!this.hasShownQuotaWarning) {
                    console.warn(`Storage quota warning: ${(usageRatio * 100).toFixed(1)}% used (${estimate.usage} / ${estimate.quota} bytes)`);

                    if (this.onQuotaWarning) {
                        this.onQuotaWarning(estimate.usage, estimate.quota);
                    }
                    this.hasShownQuotaWarning = true;
                }
            } else {
                // Reset warning flag when usage drops below threshold
                this.hasShownQuotaWarning = false;
            }
        } catch (error) {
            // Try to notify, but fall back to console if notification system not available
            try {
                notify({
                    type: 'error',
                    title: 'Storage Quota Check Failed',
                    message: `Unable to check storage quota: ${error instanceof Error ? error.message : String(error)}`
                });
            } catch {
                console.error('Failed to check storage quota:', error);
            }
        }
    }

    private async checkQuotaBeforeOperation(operationName: string): Promise<boolean> {
        try {
            const estimate = await this.getStorageEstimate();

            if (estimate.quota === 0) {
                return true; // Storage API not available, proceed anyway
            }

            const usageRatio = estimate.usage / estimate.quota;

            // Only block at extreme levels (98%+) to avoid false positives
            // Storage API estimates can be inaccurate
            if (usageRatio >= 0.98) {
                console.warn(`Storage critically full: ${(usageRatio * 100).toFixed(1)}% - attempting ${operationName} anyway`);
            }

            // Always allow operations to proceed - let the browser handle actual quota errors
            return true;
        } catch (error) {
            // If quota check fails, proceed with operation but log error
            console.error('Quota check failed:', error);
            return true;
        }
    }


    async requestPersistence(): Promise<boolean> {
        if (this.persistenceRequested) {
            return true;
        }

        if (!navigator.storage || !navigator.storage.persist) {
            try {
                notify({
                    type: 'warning',
                    title: 'Storage Persistence Unavailable',
                    message: 'Your browser doesn\'t support persistent storage. Data may be cleared automatically.'
                });
            } catch {
                console.warn('Storage persistence API not available');
            }
            return false;
        }

        try {
            const isPersisted = await navigator.storage.persist();
            this.persistenceRequested = true;
            return isPersisted;
        } catch (error) {
            try {
                notify({
                    type: 'error',
                    title: 'Storage Persistence Request Failed',
                    message: `Unable to request persistent storage: ${error instanceof Error ? error.message : String(error)}`
                });
            } catch {
                console.error('Failed to request storage persistence:', error);
            }
            return false;
        }
    }

    async verifyPersistenceWithTest(): Promise<boolean> {
        const ANCHOR_KEY = '__persistence_test__';
        const ANCHOR_VALUE = { timestamp: Date.now(), test: true };

        try {
            // Write anchor data
            await this.db.settings.put({ key: ANCHOR_KEY, value: ANCHOR_VALUE });

            // Immediately read it back
            const retrieved = await this.db.settings.get(ANCHOR_KEY);

            // Verify the data matches
            if (retrieved &&
                retrieved.value.test === ANCHOR_VALUE.test &&
                retrieved.value.timestamp === ANCHOR_VALUE.timestamp) {
                console.log('Persistence verification test passed');
                return true;
            } else {
                console.warn('Persistence verification test failed: data mismatch');
                return false;
            }
        } catch (error) {
            console.error('Persistence verification test failed:', error);
            return false;
        }
    }


    async getStorageEstimate(): Promise<StorageEstimate> {
        if (!navigator.storage || !navigator.storage.estimate) {
            return { usage: 0, quota: 0 };
        }

        try {
            const estimate = await navigator.storage.estimate();
            return {
                usage: estimate.usage || 0,
                quota: estimate.quota || 0
            };
        } catch (error) {
            try {
                notify({
                    type: 'error',
                    title: 'Storage Estimate Failed',
                    message: `Unable to get storage estimate: ${error instanceof Error ? error.message : String(error)}`
                });
            } catch {
                console.error('Failed to get storage estimate:', error);
            }
            return { usage: 0, quota: 0 };
        }
    }

    // Thread Operations


    async saveMessage(threadId: string, message: Message): Promise<void> {
        try {
            await this.db.messages.put(message);

            // Update thread's updatedAt and messageCount
            const thread = await this.db.threads.get(threadId);
            if (thread) {
                thread.updatedAt = Date.now();
                thread.messageCount = await this.db.messages.where('threadId').equals(threadId).count();
                await this.db.threads.put(thread);
            }
        } catch (error) {
            // Log error but don't throw - allow chat to continue even if save fails
            console.error('Failed to save message:', error);

            // Only notify on actual storage errors, not quota check failures
            if (error instanceof Error && error.name === 'QuotaExceededError') {
                notify({
                    type: 'warning',
                    title: 'Message Not Saved',
                    message: 'Storage is full. Message sent but not saved to history. Clear old conversations to save new messages.'
                });
            }
        }
    }


    async loadThread(threadId: string): Promise<Message[]> {
        return await this.db.messages
            .where('threadId')
            .equals(threadId)
            .sortBy('timestamp');
    }


    async listThreads(): Promise<ThreadMetadata[]> {
        const threads = await this.db.threads.orderBy('updatedAt').reverse().toArray();

        return threads.map(thread => ({
            id: thread.id,
            title: thread.title,
            lastMessageTime: thread.updatedAt,
            messageCount: thread.messageCount
        }));
    }


    async createThread(thread: Thread): Promise<void> {
        await this.db.threads.put(thread);
    }


    async getThread(threadId: string): Promise<Thread | undefined> {
        return await this.db.threads.get(threadId);
    }


    async deleteThread(threadId: string): Promise<void> {
        await this.db.messages.where('threadId').equals(threadId).delete();
        await this.db.threads.delete(threadId);
    }

    async updateMessageComplete(messageId: string, complete: boolean): Promise<void> {
        const message = await this.db.messages.get(messageId);
        if (message) {
            message.complete = complete;
            await this.db.messages.put(message);
        }
    }

    // Document Operations


    async saveDocument(document: Document): Promise<void> {
        await this.db.documents.put(document);
    }


    async saveChunk(chunk: Chunk): Promise<void> {
        await this.db.chunks.put(chunk);
    }


    async getChunks(documentId: string): Promise<Chunk[]> {
        return await this.db.chunks.where('documentId').equals(documentId).toArray();
    }


    async deleteDocument(documentId: string): Promise<void> {
        await this.db.chunks.where('documentId').equals(documentId).delete();
        await this.db.documents.delete(documentId);
    }

    // Settings Operations


    async saveSetting(key: string, value: any): Promise<void> {
        await this.db.settings.put({ key, value });
    }


    async loadSetting(key: string): Promise<any | undefined> {
        const setting = await this.db.settings.get(key);
        return setting?.value;
    }


    async clearAllData(): Promise<void> {
        await this.db.threads.clear();
        await this.db.messages.clear();
        await this.db.documents.clear();
        await this.db.chunks.clear();
        await this.db.settings.clear();
        await this.opfs.clearAllAssets();
    }

    async clearStore(storeName: string): Promise<void> {
        switch (storeName) {
            case 'threads':
                await this.db.threads.clear();
                break;
            case 'messages':
                await this.db.messages.clear();
                break;
            case 'documents':
                await this.db.documents.clear();
                break;
            case 'chunks':
                await this.db.chunks.clear();
                break;
            case 'settings':
                await this.db.settings.clear();
                break;
            default:
                throw new Error(`Unknown store: ${storeName}`);
        }
    }

    async getStoreSize(storeName: string): Promise<number> {
        let size = 0;

        try {
            let items: any[] = [];

            switch (storeName) {
                case 'threads':
                    items = await this.db.threads.toArray();
                    break;
                case 'messages':
                    items = await this.db.messages.toArray();
                    break;
                case 'documents':
                    items = await this.db.documents.toArray();
                    break;
                case 'chunks':
                    items = await this.db.chunks.toArray();
                    break;
                case 'settings':
                    items = await this.db.settings.toArray();
                    break;
                default:
                    return 0;
            }

            for (const item of items) {
                const serialized = JSON.stringify(item);
                size += serialized.length;
            }
        } catch (error) {
            try {
                notify({
                    type: 'error',
                    title: 'Store Size Calculation Failed',
                    message: `Unable to calculate size for store ${storeName}: ${error instanceof Error ? error.message : String(error)}`
                });
            } catch {
                console.error(`Failed to calculate size for store ${storeName}:`, error);
            }
        }

        return size;
    }

    async verifyDataIntegrity(): Promise<IntegrityReport> {
        const report: IntegrityReport = {
            valid: true,
            errors: [],
            warnings: []
        };

        try {
            // Check message-thread consistency
            const messages = await this.db.messages.toArray();
            const threads = await this.db.threads.toArray();
            const threadIds = new Set(threads.map(t => t.id));

            for (const message of messages) {
                if (!threadIds.has(message.threadId)) {
                    report.valid = false;
                    report.errors.push(`Orphaned message ${message.id} references non-existent thread ${message.threadId}`);
                }
            }

            // Check for corrupted data (messages without required fields)
            for (const message of messages) {
                if (!message.id || !message.threadId || !message.role || !message.content || !message.timestamp) {
                    report.valid = false;
                    report.errors.push(`Message ${message.id || 'unknown'} is missing required fields`);
                }
            }

            // Check thread message counts
            for (const thread of threads) {
                const actualCount = await this.db.messages.where('threadId').equals(thread.id).count();
                if (thread.messageCount !== actualCount) {
                    report.warnings.push(`Thread ${thread.id} has messageCount=${thread.messageCount} but actual count is ${actualCount}`);
                }
            }

            // Check chunk-document consistency
            const chunks = await this.db.chunks.toArray();
            const documents = await this.db.documents.toArray();
            const documentIds = new Set(documents.map(d => d.id));

            for (const chunk of chunks) {
                if (!documentIds.has(chunk.documentId)) {
                    report.valid = false;
                    report.errors.push(`Orphaned chunk ${chunk.id} references non-existent document ${chunk.documentId}`);
                }
            }

        } catch (error) {
            report.valid = false;
            report.errors.push(`Integrity check failed: ${error instanceof Error ? error.message : String(error)}`);
        }

        return report;
    }

    // Asset Operations (OPFS)


    async saveAsset(assetId: string, data: Blob): Promise<void> {
        try {
            await this.opfs.saveAsset(assetId, data);
        } catch (error) {
            // Log error but provide better context
            console.error('Failed to save asset:', error);

            if (error instanceof Error && error.name === 'QuotaExceededError') {
                notify({
                    type: 'error',
                    title: 'Asset Save Failed',
                    message: 'Storage is full. Unable to save asset. Clear old data to free up space.'
                });
            }
            throw error;
        }
    }


    async loadAsset(assetId: string): Promise<Blob> {
        return await this.opfs.loadAsset(assetId);
    }


    async deleteAsset(assetId: string): Promise<void> {
        await this.opfs.deleteAsset(assetId);
    }


    async assetExists(assetId: string): Promise<boolean> {
        return await this.opfs.assetExists(assetId);
    }
}
