// Model Loader for managing ML model weights
// Handles caching in IndexedDB and progressive loading with progress reporting

export interface ModelMetadata {
    modelId: string;
    modelType: 'image-generation' | 'vision' | 'speech-asr' | 'speech-tts';
    version: string;
    sizeBytes: number;
    url: string;
}

export interface LoadProgress {
    phase: 'checking-cache' | 'downloading' | 'caching' | 'loading' | 'complete';
    bytesLoaded: number;
    bytesTotal: number;
    percentage: number;
    message: string;
}

const DB_NAME = 'model-cache';
const DB_VERSION = 1;
const STORE_NAME = 'modelWeights';

export class ModelLoader {
    private db: IDBDatabase | null = null;
    private static readonly MAX_CACHE_SIZE_GB = 10; // Maximum 10GB for model cache
    private static readonly CACHE_EVICTION_THRESHOLD = 0.9; // Evict when 90% full

    async initialize(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                reject(new Error('Failed to open IndexedDB'));
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'modelId' });
                    store.createIndex('modelType', 'modelType', { unique: false });
                    store.createIndex('lastUsed', 'lastUsed', { unique: false });
                }
            };
        });
    }

    async loadModel(
        metadata: ModelMetadata,
        onProgress?: (progress: LoadProgress) => void
    ): Promise<ArrayBuffer> {
        if (!this.db) {
            await this.initialize();
        }

        // Check cache first
        onProgress?.({
            phase: 'checking-cache',
            bytesLoaded: 0,
            bytesTotal: metadata.sizeBytes,
            percentage: 0,
            message: 'Checking model cache...'
        });

        const cached = await this.getFromCache(metadata.modelId);

        if (cached) {
            // Update last used timestamp
            await this.updateLastUsed(metadata.modelId);

            onProgress?.({
                phase: 'complete',
                bytesLoaded: metadata.sizeBytes,
                bytesTotal: metadata.sizeBytes,
                percentage: 100,
                message: 'Model loaded from cache'
            });

            return cached.weights;
        }

        // Download model
        onProgress?.({
            phase: 'downloading',
            bytesLoaded: 0,
            bytesTotal: metadata.sizeBytes,
            percentage: 0,
            message: 'Downloading model weights...'
        });

        const weights = await this.downloadModel(metadata, (loaded, total) => {
            const percentage = Math.floor((loaded / total) * 90); // Reserve 10% for caching
            onProgress?.({
                phase: 'downloading',
                bytesLoaded: loaded,
                bytesTotal: total,
                percentage,
                message: `Downloading: ${this.formatBytes(loaded)} / ${this.formatBytes(total)}`
            });
        });

        // Cache the model
        onProgress?.({
            phase: 'caching',
            bytesLoaded: metadata.sizeBytes,
            bytesTotal: metadata.sizeBytes,
            percentage: 95,
            message: 'Caching model weights...'
        });

        await this.saveToCache({
            modelId: metadata.modelId,
            modelType: metadata.modelType,
            version: metadata.version,
            weights,
            sizeBytes: metadata.sizeBytes,
            cachedAt: Date.now(),
            lastUsed: Date.now()
        });

        onProgress?.({
            phase: 'complete',
            bytesLoaded: metadata.sizeBytes,
            bytesTotal: metadata.sizeBytes,
            percentage: 100,
            message: 'Model loaded and cached'
        });

        return weights;
    }

    async clearCache(): Promise<void> {
        if (!this.db) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error('Failed to clear cache'));
        });
    }

    async getCacheSize(): Promise<number> {
        if (!this.db) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                const entries = request.result;
                const totalSize = entries.reduce((sum, entry) => sum + entry.sizeBytes, 0);
                resolve(totalSize);
            };

            request.onerror = () => reject(new Error('Failed to get cache size'));
        });
    }

    async listCachedModels(): Promise<Array<{ modelId: string; modelType: string; sizeBytes: number; lastUsed: number }>> {
        if (!this.db) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                const entries = request.result;
                resolve(entries.map(entry => ({
                    modelId: entry.modelId,
                    modelType: entry.modelType,
                    sizeBytes: entry.sizeBytes,
                    lastUsed: entry.lastUsed
                })));
            };

            request.onerror = () => reject(new Error('Failed to list cached models'));
        });
    }

    async evictLeastRecentlyUsed(): Promise<void> {
        if (!this.db) {
            await this.initialize();
        }

        const models = await this.listCachedModels();
        if (models.length === 0) {
            return;
        }

        // Sort by lastUsed (oldest first)
        models.sort((a, b) => a.lastUsed - b.lastUsed);

        // Remove the oldest model
        const oldestModel = models[0];
        await this.removeFromCache(oldestModel.modelId);

        console.log(`Evicted model ${oldestModel.modelId} (last used: ${new Date(oldestModel.lastUsed).toISOString()})`);
    }

    async enforceQuota(): Promise<void> {
        const currentSize = await this.getCacheSize();
        const maxSizeBytes = ModelLoader.MAX_CACHE_SIZE_GB * 1024 * 1024 * 1024;

        if (currentSize > maxSizeBytes * ModelLoader.CACHE_EVICTION_THRESHOLD) {
            console.log(`Model cache size (${this.formatBytes(currentSize)}) exceeds threshold. Evicting least recently used models...`);

            // Keep evicting until we're below threshold
            while ((await this.getCacheSize()) > maxSizeBytes * 0.7) {
                const models = await this.listCachedModels();
                if (models.length === 0) {
                    break;
                }
                await this.evictLeastRecentlyUsed();
            }
        }
    }

    async clearModelCache(): Promise<void> {
        await this.clearCache();
    }

    private async getFromCache(modelId: string): Promise<any | null> {
        if (!this.db) {
            return null;
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(modelId);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(new Error('Failed to read from cache'));
        });
    }

    private async saveToCache(entry: any): Promise<void> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        // Enforce quota before saving
        await this.enforceQuota();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(entry);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error('Failed to save to cache'));
        });
    }

    private async removeFromCache(modelId: string): Promise<void> {
        if (!this.db) {
            return;
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(modelId);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error('Failed to remove from cache'));
        });
    }

    private async updateLastUsed(modelId: string): Promise<void> {
        if (!this.db) {
            return;
        }

        const entry = await this.getFromCache(modelId);
        if (entry) {
            entry.lastUsed = Date.now();
            await this.saveToCache(entry);
        }
    }

    private async downloadModel(
        metadata: ModelMetadata,
        onProgress: (loaded: number, total: number) => void
    ): Promise<ArrayBuffer> {
        const response = await fetch(metadata.url);

        if (!response.ok) {
            throw new Error(`Failed to download model: ${response.statusText}`);
        }

        const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
        const total = contentLength || metadata.sizeBytes;

        if (!response.body) {
            throw new Error('Response body is null');
        }

        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let loaded = 0;

        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            chunks.push(value);
            loaded += value.length;
            onProgress(loaded, total);
        }

        // Combine chunks into single ArrayBuffer
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;

        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }

        return result.buffer;
    }

    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';

        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
    }
}
