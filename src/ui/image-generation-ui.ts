// Image Generation UI Component
// Provides interface for text-to-image generation with progress tracking

import { InferenceWorkerManager, type WorkerHandle, type ProgressUpdate } from '../core/inference-worker-manager';
import { OPFSManager } from '../storage/opfs-manager';
import { FeatureGate, type FeatureGateResult } from '../core/feature-gate';
import { notify } from './notification-api';

export interface ImageGenerationParams {
    prompt: string;
    negativePrompt?: string;
    steps?: number;
    guidanceScale?: number;
    seed?: number;
}

export interface GeneratedImage {
    id: string;
    prompt: string;
    imageUrl: string;
    timestamp: number;
    seed: number;
}

export class ImageGenerationUI {
    private container: HTMLElement;
    private workerManager: InferenceWorkerManager;
    private opfsManager: OPFSManager;
    private featureGate: FeatureGate;
    private currentWorker: WorkerHandle | null = null;
    private isGenerating: boolean = false;
    private featureEnabled: boolean = false;

    private promptInput!: HTMLTextAreaElement;
    private negativePromptInput!: HTMLTextAreaElement;
    private stepsInput!: HTMLInputElement;
    private generateButton!: HTMLButtonElement;
    private cancelButton!: HTMLButtonElement;
    private progressContainer!: HTMLElement;
    private progressBar!: HTMLElement;
    private progressText!: HTMLElement;
    private resultsContainer!: HTMLElement;
    private hardwareLimitationMessage!: HTMLElement;

    constructor(container: HTMLElement) {
        this.container = container;
        this.workerManager = new InferenceWorkerManager();
        this.opfsManager = new OPFSManager();
        this.featureGate = new FeatureGate();

        this.initialize();
    }

    private async initialize(): Promise<void> {
        // Check hardware capabilities
        await this.featureGate.initialize();
        const gateResult = await this.featureGate.getImageGenerationGate();
        this.featureEnabled = gateResult.enabled;

        this.render(gateResult);

        if (this.featureEnabled) {
            this.setupEventListeners();
        }
    }

    private render(gateResult: FeatureGateResult): void {
        this.container.className = 'flex flex-col gap-6 p-6 max-w-4xl mx-auto';

        // Title
        const title = document.createElement('h2');
        title.className = 'text-2xl font-bold text-gray-800';
        title.textContent = 'Image Generation';

        this.container.appendChild(title);

        // Check if feature is disabled due to hardware limitations
        if (!gateResult.enabled) {
            this.renderHardwareLimitation(gateResult);
            return;
        }

        // Prompt input section
        const promptSection = this.createPromptSection();

        // Advanced options section
        const optionsSection = this.createOptionsSection();

        // Action buttons
        const actionsSection = this.createActionsSection();

        // Progress section
        const progressSection = this.createProgressSection();

        // Results section
        const resultsSection = this.createResultsSection();

        this.container.appendChild(promptSection);
        this.container.appendChild(optionsSection);
        this.container.appendChild(actionsSection);
        this.container.appendChild(progressSection);
        this.container.appendChild(resultsSection);
    }

    private renderHardwareLimitation(gateResult: FeatureGateResult): void {
        this.hardwareLimitationMessage = document.createElement('div');
        this.hardwareLimitationMessage.className = 'p-6 bg-yellow-50 border-l-4 border-yellow-400 rounded-lg';

        const icon = document.createElement('div');
        icon.className = 'text-3xl mb-3';
        icon.textContent = '⚠️';

        const heading = document.createElement('h3');
        heading.className = 'text-lg font-semibold text-yellow-800 mb-2';
        heading.textContent = 'Image Generation Unavailable';

        const message = document.createElement('p');
        message.className = 'text-yellow-700 mb-4';
        message.textContent = gateResult.reason || 'Hardware requirements not met';

        const requirements = document.createElement('div');
        requirements.className = 'text-sm text-yellow-600 space-y-1';

        if (gateResult.requirements) {
            const vramInfo = document.createElement('p');
            vramInfo.innerHTML = `<strong>Required VRAM:</strong> ${gateResult.requirements.minVRAM} GB`;

            const actualInfo = document.createElement('p');
            actualInfo.innerHTML = `<strong>Your VRAM:</strong> ${gateResult.requirements.actualVRAM.toFixed(1)} GB`;

            requirements.appendChild(vramInfo);
            requirements.appendChild(actualInfo);
        }

        const suggestion = document.createElement('p');
        suggestion.className = 'text-sm text-yellow-600 mt-4';
        suggestion.textContent = 'To use image generation, you need a device with at least 4 GB of VRAM and WebGPU support.';

        this.hardwareLimitationMessage.appendChild(icon);
        this.hardwareLimitationMessage.appendChild(heading);
        this.hardwareLimitationMessage.appendChild(message);
        this.hardwareLimitationMessage.appendChild(requirements);
        this.hardwareLimitationMessage.appendChild(suggestion);

        this.container.appendChild(this.hardwareLimitationMessage);
    }

    private createPromptSection(): HTMLElement {
        const section = document.createElement('div');
        section.className = 'flex flex-col gap-4';

        // Prompt label and input
        const promptLabel = document.createElement('label');
        promptLabel.className = 'text-sm font-semibold text-gray-700';
        promptLabel.textContent = 'Prompt';
        promptLabel.htmlFor = 'image-prompt';

        this.promptInput = document.createElement('textarea');
        this.promptInput.id = 'image-prompt';
        this.promptInput.className = 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none';
        this.promptInput.rows = 3;
        this.promptInput.placeholder = 'Describe the image you want to generate...';

        // Negative prompt label and input
        const negativeLabel = document.createElement('label');
        negativeLabel.className = 'text-sm font-semibold text-gray-700';
        negativeLabel.textContent = 'Negative Prompt (Optional)';
        negativeLabel.htmlFor = 'negative-prompt';

        this.negativePromptInput = document.createElement('textarea');
        this.negativePromptInput.id = 'negative-prompt';
        this.negativePromptInput.className = 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none';
        this.negativePromptInput.rows = 2;
        this.negativePromptInput.placeholder = 'What to avoid in the image...';

        section.appendChild(promptLabel);
        section.appendChild(this.promptInput);
        section.appendChild(negativeLabel);
        section.appendChild(this.negativePromptInput);

        return section;
    }

    private createOptionsSection(): HTMLElement {
        const section = document.createElement('div');
        section.className = 'flex flex-col gap-4 p-4 bg-gray-50 rounded-lg';

        const title = document.createElement('h3');
        title.className = 'text-sm font-semibold text-gray-700';
        title.textContent = 'Advanced Options';

        // Steps input
        const stepsContainer = document.createElement('div');
        stepsContainer.className = 'flex items-center gap-4';

        const stepsLabel = document.createElement('label');
        stepsLabel.className = 'text-sm text-gray-600 min-w-32';
        stepsLabel.textContent = 'Diffusion Steps:';
        stepsLabel.htmlFor = 'steps-input';

        this.stepsInput = document.createElement('input');
        this.stepsInput.id = 'steps-input';
        this.stepsInput.type = 'number';
        this.stepsInput.min = '10';
        this.stepsInput.max = '50';
        this.stepsInput.value = '20';
        this.stepsInput.className = 'px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-24';

        const stepsInfo = document.createElement('span');
        stepsInfo.className = 'text-xs text-gray-500';
        stepsInfo.textContent = '(10-50, higher = better quality but slower)';

        stepsContainer.appendChild(stepsLabel);
        stepsContainer.appendChild(this.stepsInput);
        stepsContainer.appendChild(stepsInfo);

        section.appendChild(title);
        section.appendChild(stepsContainer);

        return section;
    }

    private createActionsSection(): HTMLElement {
        const section = document.createElement('div');
        section.className = 'flex gap-4';

        this.generateButton = document.createElement('button');
        this.generateButton.className = 'px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500';
        this.generateButton.textContent = 'Generate Image';

        this.cancelButton = document.createElement('button');
        this.cancelButton.className = 'px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 hidden';
        this.cancelButton.textContent = 'Cancel';

        section.appendChild(this.generateButton);
        section.appendChild(this.cancelButton);

        return section;
    }

    private createProgressSection(): HTMLElement {
        this.progressContainer = document.createElement('div');
        this.progressContainer.className = 'flex flex-col gap-2 hidden';

        this.progressText = document.createElement('div');
        this.progressText.className = 'text-sm text-gray-600';

        const progressBarContainer = document.createElement('div');
        progressBarContainer.className = 'w-full h-3 bg-gray-200 rounded-full overflow-hidden';

        this.progressBar = document.createElement('div');
        this.progressBar.className = 'h-full bg-blue-500 transition-all duration-300';
        this.progressBar.style.width = '0%';

        progressBarContainer.appendChild(this.progressBar);

        this.progressContainer.appendChild(this.progressText);
        this.progressContainer.appendChild(progressBarContainer);

        return this.progressContainer;
    }

    private createResultsSection(): HTMLElement {
        this.resultsContainer = document.createElement('div');
        this.resultsContainer.className = 'flex flex-col gap-4';

        const title = document.createElement('h3');
        title.className = 'text-lg font-semibold text-gray-700';
        title.textContent = 'Generated Images';

        this.resultsContainer.appendChild(title);

        return this.resultsContainer;
    }

    private setupEventListeners(): void {
        this.generateButton.addEventListener('click', () => {
            this.handleGenerate();
        });

        this.cancelButton.addEventListener('click', () => {
            this.handleCancel();
        });

        // Allow Enter to generate
        this.promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                this.handleGenerate();
            }
        });
    }

    private async handleGenerate(): Promise<void> {
        // Double-check feature is enabled
        if (!this.featureEnabled) {
            notify({
                type: 'error',
                title: 'Feature Unavailable',
                message: 'Image generation is not available on this device'
            });
            return;
        }

        const prompt = this.promptInput.value.trim();

        if (!prompt) {
            notify({
                type: 'error',
                title: 'Invalid Input',
                message: 'Please enter a prompt'
            });
            return;
        }

        if (this.isGenerating) {
            return;
        }

        this.isGenerating = true;
        this.updateUIForGenerating(true);

        try {
            // Initialize worker
            this.currentWorker = await this.workerManager.initializeWorker('image-generation');

            // Set up progress callback
            this.workerManager.onProgress((progress: ProgressUpdate) => {
                this.updateProgress(progress);
            });

            // Run inference
            const params: ImageGenerationParams = {
                prompt,
                negativePrompt: this.negativePromptInput.value.trim(),
                steps: parseInt(this.stepsInput.value, 10),
                seed: Math.floor(Math.random() * 1000000)
            };

            const result = await this.workerManager.runInference(this.currentWorker, {
                type: 'image-generation',
                input: prompt,
                parameters: params
            });

            // Save to OPFS
            const imageId = `img-${Date.now()}.png`;
            await this.opfsManager.saveAsset(imageId, result.output as Blob);

            // Display result
            await this.displayGeneratedImage({
                id: imageId,
                prompt,
                imageUrl: URL.createObjectURL(result.output as Blob),
                timestamp: Date.now(),
                seed: params.seed || 0
            });

            notify({
                type: 'info',
                title: 'Success',
                message: 'Image generated successfully!'
            });
        } catch (error) {
            console.error('Image generation failed:', error);
            notify({
                type: 'error',
                title: 'Generation Failed',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        } finally {
            this.isGenerating = false;
            this.updateUIForGenerating(false);
        }
    }

    private async handleCancel(): Promise<void> {
        if (this.currentWorker) {
            await this.workerManager.cancelInference(this.currentWorker);
            notify({
                type: 'info',
                title: 'Cancelled',
                message: 'Image generation cancelled'
            });
        }
    }

    private updateUIForGenerating(isGenerating: boolean): void {
        this.generateButton.classList.toggle('hidden', isGenerating);
        this.cancelButton.classList.toggle('hidden', !isGenerating);
        this.progressContainer.classList.toggle('hidden', !isGenerating);
        this.promptInput.disabled = isGenerating;
        this.negativePromptInput.disabled = isGenerating;
        this.stepsInput.disabled = isGenerating;

        if (!isGenerating) {
            this.progressBar.style.width = '0%';
            this.progressText.textContent = '';
        }
    }

    private updateProgress(progress: ProgressUpdate): void {
        this.progressBar.style.width = `${progress.percentage}%`;
        this.progressText.textContent = progress.message || `${progress.percentage}%`;
    }

    private async displayGeneratedImage(image: GeneratedImage): Promise<void> {
        const imageCard = document.createElement('div');
        imageCard.className = 'flex flex-col gap-3 p-4 bg-white border border-gray-200 rounded-lg shadow-sm';

        // Image
        const img = document.createElement('img');
        img.src = image.imageUrl;
        img.alt = image.prompt;
        img.className = 'w-full rounded-lg';

        // Metadata
        const metadata = document.createElement('div');
        metadata.className = 'flex flex-col gap-2 text-sm text-gray-600';

        const promptText = document.createElement('p');
        promptText.className = 'font-semibold';
        promptText.textContent = `Prompt: ${image.prompt}`;

        const seedText = document.createElement('p');
        seedText.textContent = `Seed: ${image.seed}`;

        const timestampText = document.createElement('p');
        timestampText.textContent = `Generated: ${new Date(image.timestamp).toLocaleString()}`;

        metadata.appendChild(promptText);
        metadata.appendChild(seedText);
        metadata.appendChild(timestampText);

        // Download button
        const downloadButton = document.createElement('button');
        downloadButton.className = 'px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors';
        downloadButton.textContent = 'Download';
        downloadButton.addEventListener('click', () => {
            const a = document.createElement('a');
            a.href = image.imageUrl;
            a.download = `generated-${image.id}`;
            a.click();
        });

        imageCard.appendChild(img);
        imageCard.appendChild(metadata);
        imageCard.appendChild(downloadButton);

        // Insert at the beginning (most recent first)
        const title = this.resultsContainer.querySelector('h3');
        if (title && title.nextSibling) {
            this.resultsContainer.insertBefore(imageCard, title.nextSibling);
        } else {
            this.resultsContainer.appendChild(imageCard);
        }
    }

    async cleanup(): Promise<void> {
        await this.workerManager.cleanup();
    }
}
