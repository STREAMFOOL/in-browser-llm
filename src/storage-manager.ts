/**
 * Storage Manager
 * Unified interface for persisting conversations and assets
 * Requirements: 4.1, 4.2, 4.3
 */

import Dexie, { type Table } from 'dexie';
import { OPFSManager } from './opfs-manager';

// Data Models

export interface Message {
    id: string;
    threadId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
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
    }
}

// Storage Manager Interface

export interface StorageEstimate {
    usage: number;
    quota: number;
}

export class StorageManager {
    private db: LocalAIDatabase;
    private opfs: OPFSManager;
    private persistenceRequested: boolean = false;

    constructor() {
        this.db = new LocalAIDatabase();
        this.opfs = new OPFSManager();
    }

    /**
     * Request persistent storage
     * Requirements: 4.3
     */
    async requestPersistence(): Promise<boolean> {
        if (this.persistenceRequested) {
            return true;
        }

        if (!navigator.storage || !navigator.storage.persist) {
            console.warn('Storage persistence API not available');
            return false;
        }

        try {
            const isPersisted = await navigator.storage.persist();
            this.persistenceRequested = true;
            return isPersisted;
        } catch (error) {
            console.error('Failed to request storage persistence:', error);
            return false;
        }
    }

    /**
     * Get storage estimate
     * Requirements: 4.6
     */
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
            console.error('Failed to get storage estimate:', error);
            return { usage: 0, quota: 0 };
        }
    }

    // Thread Operations

    /**
     * Save a message to a thread
     * Requirements: 4.1
     */
    async saveMessage(threadId: string, message: Message): Promise<void> {
        await this.db.messages.put(message);

        // Update thread's updatedAt and messageCount
        const thread = await this.db.threads.get(threadId);
        if (thread) {
            thread.updatedAt = Date.now();
            thread.messageCount = await this.db.messages.where('threadId').equals(threadId).count();
            await this.db.threads.put(thread);
        }
    }

    /**
     * Load all messages for a thread
     * Requirements: 4.5
     */
    async loadThread(threadId: string): Promise<Message[]> {
        return await this.db.messages
            .where('threadId')
            .equals(threadId)
            .sortBy('timestamp');
    }

    /**
     * List all threads
     * Requirements: 4.2
     */
    async listThreads(): Promise<ThreadMetadata[]> {
        const threads = await this.db.threads.orderBy('updatedAt').reverse().toArray();

        return threads.map(thread => ({
            id: thread.id,
            title: thread.title,
            lastMessageTime: thread.updatedAt,
            messageCount: thread.messageCount
        }));
    }

    /**
     * Create a new thread
     * Requirements: 4.4
     */
    async createThread(thread: Thread): Promise<void> {
        await this.db.threads.put(thread);
    }

    /**
     * Get a thread by ID
     */
    async getThread(threadId: string): Promise<Thread | undefined> {
        return await this.db.threads.get(threadId);
    }

    /**
     * Delete a thread and all its messages
     */
    async deleteThread(threadId: string): Promise<void> {
        await this.db.messages.where('threadId').equals(threadId).delete();
        await this.db.threads.delete(threadId);
    }

    // Document Operations

    /**
     * Save a document
     * Requirements: 9.6
     */
    async saveDocument(document: Document): Promise<void> {
        await this.db.documents.put(document);
    }

    /**
     * Save a chunk
     */
    async saveChunk(chunk: Chunk): Promise<void> {
        await this.db.chunks.put(chunk);
    }

    /**
     * Get chunks for a document
     */
    async getChunks(documentId: string): Promise<Chunk[]> {
        return await this.db.chunks.where('documentId').equals(documentId).toArray();
    }

    /**
     * Delete a document and its chunks
     */
    async deleteDocument(documentId: string): Promise<void> {
        await this.db.chunks.where('documentId').equals(documentId).delete();
        await this.db.documents.delete(documentId);
    }

    // Settings Operations

    /**
     * Save a setting
     * Requirements: 12.3
     */
    async saveSetting(key: string, value: any): Promise<void> {
        await this.db.settings.put({ key, value });
    }

    /**
     * Load a setting
     * Requirements: 12.4
     */
    async loadSetting(key: string): Promise<any | undefined> {
        const setting = await this.db.settings.get(key);
        return setting?.value;
    }

    /**
     * Clear all data
     * Requirements: 12.6
     */
    async clearAllData(): Promise<void> {
        await this.db.threads.clear();
        await this.db.messages.clear();
        await this.db.documents.clear();
        await this.db.chunks.clear();
        await this.db.settings.clear();
        await this.opfs.clearAllAssets();
    }

    // Asset Operations (OPFS)

    /**
     * Save an asset (image, audio, etc.)
     * Requirements: 7.5, 10.6
     */
    async saveAsset(assetId: string, data: Blob): Promise<void> {
        await this.opfs.saveAsset(assetId, data);
    }

    /**
     * Load an asset
     * Requirements: 7.5, 10.6
     */
    async loadAsset(assetId: string): Promise<Blob> {
        return await this.opfs.loadAsset(assetId);
    }

    /**
     * Delete an asset
     */
    async deleteAsset(assetId: string): Promise<void> {
        await this.opfs.deleteAsset(assetId);
    }

    /**
     * Check if an asset exists
     */
    async assetExists(assetId: string): Promise<boolean> {
        return await this.opfs.assetExists(assetId);
    }
}
