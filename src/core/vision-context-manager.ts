import { OPFSManager } from '../storage/opfs-manager';
import { InferenceWorkerManager, type WorkerHandle } from './inference-worker-manager';

export interface ImageMetadata {
    imageId: string;
    filename: string;
    uploadedAt: number;
    sizeBytes: number;
}

export interface ImageAnalysis {
    imageId: string;
    caption?: string;
    objects?: Array<{
        label: string;
        confidence: number;
        boundingBox: {
            x: number;
            y: number;
            width: number;
            height: number;
        };
    }>;
    text?: string;
}

interface StoredImageContext {
    metadata: ImageMetadata;
    analysis?: ImageAnalysis;
}

export class VisionContextManager {
    private opfsManager: OPFSManager;
    private workerManager: InferenceWorkerManager;
    private imageContexts: Map<string, StoredImageContext> = new Map();
    private visionWorker: WorkerHandle | null = null;

    constructor(opfsManager: OPFSManager, workerManager: InferenceWorkerManager) {
        this.opfsManager = opfsManager;
        this.workerManager = workerManager;
    }

    async storeImage(file: File): Promise<ImageMetadata> {
        const imageId = `img-${Date.now()}`;
        const arrayBuffer = await file.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: file.type });

        // Store image in OPFS
        await this.opfsManager.saveAsset(imageId, blob);

        // Create metadata
        const metadata: ImageMetadata = {
            imageId,
            filename: file.name,
            uploadedAt: Date.now(),
            sizeBytes: file.size
        };

        // Store in IndexedDB metadata
        await this.storeImageMetadata(metadata);

        // Cache in memory
        this.imageContexts.set(imageId, { metadata });

        return metadata;
    }

    async analyzeImage(imageId: string, taskType: string = 'caption'): Promise<ImageAnalysis> {
        // Initialize vision worker if needed
        if (!this.visionWorker) {
            this.visionWorker = await this.workerManager.initializeWorker('vision');
        }

        // Load image data from OPFS
        const imageBlob = await this.opfsManager.loadAsset(imageId);
        const arrayBuffer = await imageBlob.arrayBuffer();

        // Run vision inference
        const result = await this.workerManager.runInference(this.visionWorker, {
            type: 'vision',
            input: arrayBuffer,
            parameters: { taskType }
        });

        // Create analysis result - handle different output types
        let analysisData: Partial<ImageAnalysis> = {};
        if (typeof result.output === 'object' && result.output !== null && !(result.output instanceof Blob)) {
            analysisData = result.output as Partial<ImageAnalysis>;
        }

        const analysis: ImageAnalysis = {
            imageId,
            ...analysisData
        };

        // Store analysis
        await this.storeImageAnalysis(imageId, analysis);

        // Update cache
        const context = this.imageContexts.get(imageId);
        if (context) {
            context.analysis = analysis;
            this.imageContexts.set(imageId, context);
        }

        return analysis;
    }

    async getImageContext(imageId: string): Promise<StoredImageContext | null> {
        // Check cache first
        if (this.imageContexts.has(imageId)) {
            return this.imageContexts.get(imageId)!;
        }

        // Load from storage
        const metadata = await this.loadImageMetadata(imageId);
        if (!metadata) {
            return null;
        }

        const analysis = await this.loadImageAnalysis(imageId);

        const context: StoredImageContext = {
            metadata,
            analysis: analysis || undefined
        };

        // Cache it
        this.imageContexts.set(imageId, context);

        return context;
    }

    async injectImageContext(prompt: string, imageIds: string[]): Promise<string> {
        if (imageIds.length === 0) {
            return prompt;
        }

        const imageContexts: string[] = [];

        for (const imageId of imageIds) {
            const context = await this.getImageContext(imageId);
            if (!context) {
                continue;
            }

            let contextText = `\n\n[Image: ${context.metadata.filename}]`;

            if (context.analysis) {
                if (context.analysis.caption) {
                    contextText += `\nDescription: ${context.analysis.caption}`;
                }

                if (context.analysis.objects && context.analysis.objects.length > 0) {
                    contextText += `\nDetected objects: ${context.analysis.objects
                        .map(obj => `${obj.label} (${Math.round(obj.confidence * 100)}%)`)
                        .join(', ')}`;
                }

                if (context.analysis.text) {
                    contextText += `\nExtracted text: ${context.analysis.text}`;
                }

                contextText += `\n[Source: Image ${imageId}]`;
            } else {
                contextText += `\n(Image not yet analyzed)`;
            }

            imageContexts.push(contextText);
        }

        if (imageContexts.length === 0) {
            return prompt;
        }

        // Inject image contexts before the user prompt
        return `${imageContexts.join('\n')}\n\nUser query: ${prompt}`;
    }

    async deleteImage(imageId: string): Promise<void> {
        // Delete from OPFS
        await this.opfsManager.deleteAsset(imageId);

        // Delete metadata from IndexedDB
        await this.deleteImageMetadata(imageId);
        await this.deleteImageAnalysis(imageId);

        // Remove from cache
        this.imageContexts.delete(imageId);
    }

    async listImages(): Promise<ImageMetadata[]> {
        const metadataList = await this.loadAllImageMetadata();
        return metadataList;
    }

    private async storeImageMetadata(metadata: ImageMetadata): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('vision-context', 1);

            request.onerror = () => reject(new Error('Failed to open IndexedDB'));

            request.onsuccess = () => {
                const db = request.result;
                const transaction = db.transaction(['imageMetadata'], 'readwrite');
                const store = transaction.objectStore('imageMetadata');
                const putRequest = store.put(metadata);

                putRequest.onsuccess = () => resolve();
                putRequest.onerror = () => reject(new Error('Failed to store metadata'));
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                if (!db.objectStoreNames.contains('imageMetadata')) {
                    db.createObjectStore('imageMetadata', { keyPath: 'imageId' });
                }

                if (!db.objectStoreNames.contains('imageAnalysis')) {
                    db.createObjectStore('imageAnalysis', { keyPath: 'imageId' });
                }
            };
        });
    }

    private async loadImageMetadata(imageId: string): Promise<ImageMetadata | null> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('vision-context', 1);

            request.onerror = () => reject(new Error('Failed to open IndexedDB'));

            request.onsuccess = () => {
                const db = request.result;
                const transaction = db.transaction(['imageMetadata'], 'readonly');
                const store = transaction.objectStore('imageMetadata');
                const getRequest = store.get(imageId);

                getRequest.onsuccess = () => resolve(getRequest.result || null);
                getRequest.onerror = () => reject(new Error('Failed to load metadata'));
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                if (!db.objectStoreNames.contains('imageMetadata')) {
                    db.createObjectStore('imageMetadata', { keyPath: 'imageId' });
                }

                if (!db.objectStoreNames.contains('imageAnalysis')) {
                    db.createObjectStore('imageAnalysis', { keyPath: 'imageId' });
                }
            };
        });
    }

    private async loadAllImageMetadata(): Promise<ImageMetadata[]> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('vision-context', 1);

            request.onerror = () => reject(new Error('Failed to open IndexedDB'));

            request.onsuccess = () => {
                const db = request.result;
                const transaction = db.transaction(['imageMetadata'], 'readonly');
                const store = transaction.objectStore('imageMetadata');
                const getAllRequest = store.getAll();

                getAllRequest.onsuccess = () => resolve(getAllRequest.result || []);
                getAllRequest.onerror = () => reject(new Error('Failed to load metadata'));
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                if (!db.objectStoreNames.contains('imageMetadata')) {
                    db.createObjectStore('imageMetadata', { keyPath: 'imageId' });
                }

                if (!db.objectStoreNames.contains('imageAnalysis')) {
                    db.createObjectStore('imageAnalysis', { keyPath: 'imageId' });
                }
            };
        });
    }

    private async deleteImageMetadata(imageId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('vision-context', 1);

            request.onerror = () => reject(new Error('Failed to open IndexedDB'));

            request.onsuccess = () => {
                const db = request.result;
                const transaction = db.transaction(['imageMetadata'], 'readwrite');
                const store = transaction.objectStore('imageMetadata');
                const deleteRequest = store.delete(imageId);

                deleteRequest.onsuccess = () => resolve();
                deleteRequest.onerror = () => reject(new Error('Failed to delete metadata'));
            };
        });
    }

    private async storeImageAnalysis(imageId: string, analysis: ImageAnalysis): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('vision-context', 1);

            request.onerror = () => reject(new Error('Failed to open IndexedDB'));

            request.onsuccess = () => {
                const db = request.result;
                const transaction = db.transaction(['imageAnalysis'], 'readwrite');
                const store = transaction.objectStore('imageAnalysis');
                const putRequest = store.put(analysis);

                putRequest.onsuccess = () => resolve();
                putRequest.onerror = () => reject(new Error('Failed to store analysis'));
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                if (!db.objectStoreNames.contains('imageMetadata')) {
                    db.createObjectStore('imageMetadata', { keyPath: 'imageId' });
                }

                if (!db.objectStoreNames.contains('imageAnalysis')) {
                    db.createObjectStore('imageAnalysis', { keyPath: 'imageId' });
                }
            };
        });
    }

    private async loadImageAnalysis(imageId: string): Promise<ImageAnalysis | null> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('vision-context', 1);

            request.onerror = () => reject(new Error('Failed to open IndexedDB'));

            request.onsuccess = () => {
                const db = request.result;
                const transaction = db.transaction(['imageAnalysis'], 'readonly');
                const store = transaction.objectStore('imageAnalysis');
                const getRequest = store.get(imageId);

                getRequest.onsuccess = () => resolve(getRequest.result || null);
                getRequest.onerror = () => reject(new Error('Failed to load analysis'));
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                if (!db.objectStoreNames.contains('imageMetadata')) {
                    db.createObjectStore('imageMetadata', { keyPath: 'imageId' });
                }

                if (!db.objectStoreNames.contains('imageAnalysis')) {
                    db.createObjectStore('imageAnalysis', { keyPath: 'imageId' });
                }
            };
        });
    }

    private async deleteImageAnalysis(imageId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('vision-context', 1);

            request.onerror = () => reject(new Error('Failed to open IndexedDB'));

            request.onsuccess = () => {
                const db = request.result;
                const transaction = db.transaction(['imageAnalysis'], 'readwrite');
                const store = transaction.objectStore('imageAnalysis');
                const deleteRequest = store.delete(imageId);

                deleteRequest.onsuccess = () => resolve();
                deleteRequest.onerror = () => reject(new Error('Failed to delete analysis'));
            };
        });
    }
}
