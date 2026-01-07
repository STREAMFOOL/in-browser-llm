

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

    // Asset Operations (OPFS)


    async saveAsset(assetId: string, data: Blob): Promise<void> {
        await this.opfs.saveAsset(assetId, data);
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
