import { InferenceWorkerManager, type WorkerHandle } from '../core/inference-worker-manager';
import { OPFSManager } from '../storage/opfs-manager';
import { notify } from './notification-api';

export interface VisionAnalysisResult {
    imageId: string;
    caption?: string;
    objects?: DetectedObject[];
    text?: string;
}

export interface DetectedObject {
    label: string;
    confidence: number;
    boundingBox: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}

export interface VisionUICallbacks {
    onImageAnalyzed?: (result: VisionAnalysisResult) => void;
    onImageDeleted?: (imageId: string) => void;
}

interface StoredImage {
    id: string;
    filename: string;
    uploadedAt: number;
    sizeBytes: number;
    analysis?: VisionAnalysisResult;
}

export class VisionUI {
    private container: HTMLElement;
    private workerManager: InferenceWorkerManager;
    private opfsManager: OPFSManager;
    private callbacks: VisionUICallbacks;
    private imagesListElement: HTMLElement | null = null;
    private uploadButton: HTMLButtonElement | null = null;
    private storedImages: Map<string, StoredImage> = new Map();
    private visionWorker: WorkerHandle | null = null;

    constructor(
        container: HTMLElement,
        workerManager: InferenceWorkerManager,
        opfsManager: OPFSManager,
        callbacks: VisionUICallbacks = {}
    ) {
        this.container = container;
        this.workerManager = workerManager;
        this.opfsManager = opfsManager;
        this.callbacks = callbacks;
    }

    render(): void {
        this.container.innerHTML = '';

        const wrapper = document.createElement('div');
        wrapper.className = 'p-4 border-b border-gray-700';

        const header = document.createElement('div');
        header.className = 'flex items-center justify-between mb-3';

        const title = document.createElement('h3');
        title.className = 'text-sm font-semibold text-gray-200';
        title.textContent = 'Images';

        this.uploadButton = document.createElement('button');
        this.uploadButton.className = `
            px-3 py-1.5
            bg-blue-600 hover:bg-blue-700
            text-white text-xs font-medium
            rounded border-none
            cursor-pointer transition-colors
        `;
        this.uploadButton.textContent = 'Upload Image';
        this.uploadButton.addEventListener('click', () => this.handleUploadClick());

        header.appendChild(title);
        header.appendChild(this.uploadButton);

        this.imagesListElement = document.createElement('div');
        this.imagesListElement.className = 'space-y-3';

        wrapper.appendChild(header);
        wrapper.appendChild(this.imagesListElement);

        this.container.appendChild(wrapper);

        this.loadImages();
    }

    private async loadImages(): Promise<void> {
        if (!this.imagesListElement) return;

        try {
            // Load images from OPFS
            const imageFiles = await this.opfsManager.listAssets();
            const imageAssets = imageFiles.filter(name => name.startsWith('img-'));

            if (imageAssets.length === 0) {
                this.imagesListElement.innerHTML = `
                    <p class="text-xs text-gray-400 italic">No images uploaded</p>
                `;
                return;
            }

            this.imagesListElement.innerHTML = '';

            for (const assetId of imageAssets) {
                const storedImage = this.storedImages.get(assetId);

                if (storedImage) {
                    const imageElement = await this.createImageElement(storedImage);
                    this.imagesListElement.appendChild(imageElement);
                }
            }
        } catch (error) {
            notify({
                type: 'error',
                title: 'Failed to Load Images',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    private async createImageElement(image: StoredImage): Promise<HTMLElement> {
        const element = document.createElement('div');
        element.className = `
            p-3 rounded
            bg-gray-800 hover:bg-gray-750
            border border-gray-700
            transition-colors
        `;

        const header = document.createElement('div');
        header.className = 'flex items-start justify-between gap-2 mb-2';

        const info = document.createElement('div');
        info.className = 'flex-1 min-w-0';

        const filename = document.createElement('div');
        filename.className = 'text-xs font-medium text-gray-200 truncate';
        filename.textContent = image.filename;
        filename.title = image.filename;

        const metadata = document.createElement('div');
        metadata.className = 'text-xs text-gray-400 mt-1';
        metadata.textContent = `${this.formatBytes(image.sizeBytes)} • ${this.formatDate(image.uploadedAt)}`;

        info.appendChild(filename);
        info.appendChild(metadata);

        const actions = document.createElement('div');
        actions.className = 'flex gap-2';

        const analyzeButton = document.createElement('button');
        analyzeButton.className = `
            px-2 py-1
            text-xs text-blue-400 hover:text-blue-300
            border-none bg-transparent
            cursor-pointer transition-colors
        `;
        analyzeButton.textContent = 'Analyze';
        analyzeButton.addEventListener('click', () => this.handleAnalyzeImage(image.id));

        const deleteButton = document.createElement('button');
        deleteButton.className = `
            px-2 py-1
            text-xs text-red-400 hover:text-red-300
            border-none bg-transparent
            cursor-pointer transition-colors
        `;
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => this.handleDeleteImage(image.id));

        actions.appendChild(analyzeButton);
        actions.appendChild(deleteButton);

        header.appendChild(info);
        header.appendChild(actions);

        element.appendChild(header);

        // Display thumbnail
        const thumbnailContainer = document.createElement('div');
        thumbnailContainer.className = 'relative mb-2';

        const thumbnail = document.createElement('img');
        thumbnail.className = 'w-full h-32 object-cover rounded';

        try {
            const imageBlob = await this.opfsManager.loadAsset(image.id);
            const imageUrl = URL.createObjectURL(imageBlob);
            thumbnail.src = imageUrl;
        } catch (error) {
            thumbnail.alt = 'Failed to load image';
            thumbnail.className += ' bg-gray-700';
        }

        thumbnailContainer.appendChild(thumbnail);
        element.appendChild(thumbnailContainer);

        // Display analysis results if available
        if (image.analysis) {
            const analysisContainer = document.createElement('div');
            analysisContainer.className = 'mt-2 p-2 bg-gray-900 rounded text-xs';

            if (image.analysis.caption) {
                const caption = document.createElement('p');
                caption.className = 'text-gray-300 mb-2';
                caption.textContent = image.analysis.caption;
                analysisContainer.appendChild(caption);
            }

            if (image.analysis.objects && image.analysis.objects.length > 0) {
                const objectsTitle = document.createElement('div');
                objectsTitle.className = 'text-gray-400 font-medium mb-1';
                objectsTitle.textContent = 'Detected Objects:';
                analysisContainer.appendChild(objectsTitle);

                const objectsList = document.createElement('ul');
                objectsList.className = 'list-disc list-inside text-gray-400 space-y-1';

                for (const obj of image.analysis.objects) {
                    const item = document.createElement('li');
                    item.textContent = `${obj.label} (${Math.round(obj.confidence * 100)}%)`;
                    objectsList.appendChild(item);
                }

                analysisContainer.appendChild(objectsList);

                // Render bounding boxes on thumbnail
                this.renderBoundingBoxes(thumbnailContainer, thumbnail, image.analysis.objects);
            }

            element.appendChild(analysisContainer);
        }

        return element;
    }

    private renderBoundingBoxes(
        container: HTMLElement,
        image: HTMLImageElement,
        objects: DetectedObject[]
    ): void {
        const canvas = document.createElement('canvas');
        canvas.className = 'absolute top-0 left-0 w-full h-full pointer-events-none';
        canvas.width = image.naturalWidth || 512;
        canvas.height = image.naturalHeight || 512;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Scale to match displayed size
        const scaleX = canvas.width / (image.naturalWidth || 512);
        const scaleY = canvas.height / (image.naturalHeight || 512);

        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.font = '12px sans-serif';
        ctx.fillStyle = '#3b82f6';

        for (const obj of objects) {
            const { x, y, width, height } = obj.boundingBox;

            // Draw bounding box
            ctx.strokeRect(x * scaleX, y * scaleY, width * scaleX, height * scaleY);

            // Draw label
            const label = `${obj.label} ${Math.round(obj.confidence * 100)}%`;
            const textMetrics = ctx.measureText(label);
            const textHeight = 16;

            ctx.fillStyle = 'rgba(59, 130, 246, 0.8)';
            ctx.fillRect(
                x * scaleX,
                y * scaleY - textHeight,
                textMetrics.width + 4,
                textHeight
            );

            ctx.fillStyle = 'white';
            ctx.fillText(label, x * scaleX + 2, y * scaleY - 4);
        }

        container.appendChild(canvas);
    }

    private handleUploadClick(): void {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/png,image/jpeg,image/jpg,image/webp';
        input.multiple = false;

        input.addEventListener('change', async () => {
            if (input.files && input.files.length > 0) {
                await this.handleFileUpload(input.files[0]);
            }
        });

        input.click();
    }

    private async handleFileUpload(file: File): Promise<void> {
        if (this.uploadButton) {
            this.uploadButton.disabled = true;
            this.uploadButton.textContent = 'Uploading...';
        }

        try {
            const imageId = `img-${Date.now()}`;
            const arrayBuffer = await file.arrayBuffer();
            const blob = new Blob([arrayBuffer], { type: file.type });

            // Store image in OPFS
            await this.opfsManager.saveAsset(imageId, blob);

            // Store metadata
            const storedImage: StoredImage = {
                id: imageId,
                filename: file.name,
                uploadedAt: Date.now(),
                sizeBytes: file.size
            };

            this.storedImages.set(imageId, storedImage);

            notify({
                type: 'info',
                title: 'Image Uploaded',
                message: `${file.name} uploaded successfully`
            });

            await this.loadImages();
        } catch (error) {
            notify({
                type: 'error',
                title: 'Upload Failed',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        } finally {
            if (this.uploadButton) {
                this.uploadButton.disabled = false;
                this.uploadButton.textContent = 'Upload Image';
            }
        }
    }

    private async handleAnalyzeImage(imageId: string): Promise<void> {
        try {
            notify({
                type: 'info',
                title: 'Analyzing Image',
                message: 'Processing image with Florence-2...'
            });

            // Initialize vision worker if needed
            if (!this.visionWorker) {
                this.visionWorker = await this.workerManager.initializeWorker('vision');
            }

            // Load image data
            const imageBlob = await this.opfsManager.loadAsset(imageId);
            const arrayBuffer = await imageBlob.arrayBuffer();

            // Run vision inference
            const result = await this.workerManager.runInference(this.visionWorker, {
                type: 'vision',
                input: arrayBuffer,
                parameters: {
                    taskType: 'object-detection'
                }
            });

            // Store analysis results
            const storedImage = this.storedImages.get(imageId);
            if (storedImage) {
                let analysisData: Partial<VisionAnalysisResult> = {};
                if (typeof result.output === 'object' && result.output !== null && !(result.output instanceof Blob)) {
                    analysisData = result.output as Partial<VisionAnalysisResult>;
                }

                storedImage.analysis = {
                    imageId,
                    ...analysisData
                };
                this.storedImages.set(imageId, storedImage);
            }

            notify({
                type: 'info',
                title: 'Analysis Complete',
                message: 'Image analyzed successfully'
            });

            await this.loadImages();

            if (this.callbacks.onImageAnalyzed && storedImage?.analysis) {
                this.callbacks.onImageAnalyzed(storedImage.analysis);
            }
        } catch (error) {
            notify({
                type: 'error',
                title: 'Analysis Failed',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    private async handleDeleteImage(imageId: string): Promise<void> {
        try {
            await this.opfsManager.deleteAsset(imageId);
            this.storedImages.delete(imageId);

            notify({
                type: 'info',
                title: 'Image Deleted',
                message: 'Image removed successfully'
            });

            await this.loadImages();

            if (this.callbacks.onImageDeleted) {
                this.callbacks.onImageDeleted(imageId);
            }
        } catch (error) {
            notify({
                type: 'error',
                title: 'Delete Failed',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';

        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
    }

    private formatDate(timestamp: number): string {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString();
    }

    destroy(): void {
        this.container.innerHTML = '';
        this.storedImages.clear();
    }
}
