// Image Generation Worker for Stable Diffusion inference
// Handles text-to-image generation using WebGPU acceleration

import { ModelLoader, type ModelMetadata, type LoadProgress } from './model-loader';

interface ImageGenerationMessage {
    type: 'initialize' | 'generate' | 'cancel';
    payload: {
        prompt?: string;
        negativePrompt?: string;
        steps?: number;
        guidanceScale?: number;
        seed?: number;
    };
}

interface ImageGenerationResponse {
    type: 'initialized' | 'progress' | 'complete' | 'error' | 'cancelled';
    payload: {
        step?: number;
        totalSteps?: number;
        imageBlob?: Blob;
        error?: string;
        message?: string;
    };
}

interface WorkerState {
    gpuAdapter?: GPUAdapter;
    gpuDevice?: GPUDevice;
    isInitialized: boolean;
    isProcessing: boolean;
    shouldCancel: boolean;
    modelLoaded: boolean;
    modelLoader?: ModelLoader;
    modelWeights?: ArrayBuffer;
}

const state: WorkerState = {
    isInitialized: false,
    isProcessing: false,
    shouldCancel: false,
    modelLoaded: false
};

self.onmessage = async (event: MessageEvent<ImageGenerationMessage>) => {
    const { type, payload } = event.data;

    try {
        switch (type) {
            case 'initialize':
                await handleInitialize();
                break;
            case 'generate':
                await handleGenerate(payload);
                break;
            case 'cancel':
                handleCancel();
                break;
            default:
                throw new Error(`Unknown message type: ${type}`);
        }
    } catch (error) {
        const response: ImageGenerationResponse = {
            type: 'error',
            payload: {
                error: error instanceof Error ? error.message : String(error)
            }
        };
        self.postMessage(response);
    }
};

async function handleInitialize(): Promise<void> {
    try {
        // Initialize WebGPU context
        await initializeWebGPU();

        // Initialize model loader
        state.modelLoader = new ModelLoader();
        await state.modelLoader.initialize();

        state.isInitialized = true;

        const response: ImageGenerationResponse = {
            type: 'initialized',
            payload: {
                message: 'Image generation worker initialized'
            }
        };
        self.postMessage(response);
    } catch (error) {
        throw new Error(`Worker initialization failed: ${error}`);
    }
}

async function initializeWebGPU(): Promise<void> {
    if (!navigator.gpu) {
        throw new Error('WebGPU is not supported in this browser');
    }

    // Request GPU adapter with high performance preference
    const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance'
    });

    if (!adapter) {
        throw new Error('Failed to get GPU adapter');
    }

    state.gpuAdapter = adapter;

    // Request GPU device
    const device = await adapter.requestDevice();

    if (!device) {
        throw new Error('Failed to get GPU device');
    }

    state.gpuDevice = device;

    // Set up device lost handler for GPU context loss recovery
    device.lost.then((info) => {
        console.error('GPU device lost in image generation worker:', info);
        handleGPUContextLoss(info.reason);
    });
}

async function handleGPUContextLoss(reason: string): Promise<void> {
    console.log(`Attempting to recover from GPU context loss: ${reason}`);

    const progressResponse: ImageGenerationResponse = {
        type: 'progress',
        payload: {
            step: 0,
            totalSteps: 0,
            message: 'GPU context lost, attempting recovery...'
        }
    };
    self.postMessage(progressResponse);

    try {
        // Wait before attempting recovery
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Attempt to reinitialize WebGPU
        await initializeWebGPU();

        const successResponse: ImageGenerationResponse = {
            type: 'progress',
            payload: {
                step: 0,
                totalSteps: 0,
                message: 'GPU context recovered successfully'
            }
        };
        self.postMessage(successResponse);

        console.log('GPU context recovery successful');
    } catch (error) {
        const errorResponse: ImageGenerationResponse = {
            type: 'error',
            payload: {
                error: `GPU context recovery failed: ${error}`
            }
        };
        self.postMessage(errorResponse);

        // Mark as not initialized
        state.isInitialized = false;
        state.modelLoaded = false;
    }
}

async function handleGenerate(payload: ImageGenerationMessage['payload']): Promise<void> {
    if (!state.isInitialized) {
        throw new Error('Worker not initialized');
    }

    if (state.isProcessing) {
        throw new Error('Worker is already processing a task');
    }

    state.isProcessing = true;
    state.shouldCancel = false;

    try {
        const {
            prompt = '',
            negativePrompt = '',
            steps = 20,
            guidanceScale = 7.5,
            seed = Math.floor(Math.random() * 1000000)
        } = payload;

        if (!prompt.trim()) {
            throw new Error('Prompt cannot be empty');
        }

        // Report starting
        const startResponse: ImageGenerationResponse = {
            type: 'progress',
            payload: {
                step: 0,
                totalSteps: steps,
                message: 'Starting image generation...'
            }
        };
        self.postMessage(startResponse);

        // Load model if not already loaded
        if (!state.modelLoaded) {
            await loadModel();
        }

        // Check for cancellation
        if (state.shouldCancel) {
            handleCancel();
            return;
        }

        // Execute diffusion pipeline
        const imageBlob = await executeDiffusion({
            prompt,
            negativePrompt,
            steps,
            guidanceScale,
            seed
        });

        // Check for cancellation before sending result
        if (state.shouldCancel) {
            handleCancel();
            return;
        }

        // Send completion
        const completeResponse: ImageGenerationResponse = {
            type: 'complete',
            payload: {
                imageBlob,
                message: 'Image generation complete'
            }
        };
        self.postMessage(completeResponse);
    } finally {
        state.isProcessing = false;
        state.shouldCancel = false;
    }
}

async function loadModel(): Promise<void> {
    if (!state.modelLoader) {
        throw new Error('Model loader not initialized');
    }

    // Define Stable Diffusion model metadata
    // In production, this would point to actual model weights
    const modelMetadata: ModelMetadata = {
        modelId: 'stable-diffusion-v1-5',
        modelType: 'image-generation',
        version: '1.5',
        sizeBytes: 4 * 1024 * 1024 * 1024, // 4GB placeholder
        url: 'https://placeholder.com/sd-v1-5.bin' // Placeholder URL
    };

    // Load model with progress reporting
    state.modelWeights = await state.modelLoader.loadModel(
        modelMetadata,
        (progress: LoadProgress) => {
            const response: ImageGenerationResponse = {
                type: 'progress',
                payload: {
                    step: 0,
                    totalSteps: 0,
                    message: progress.message
                }
            };
            self.postMessage(response);
        }
    );

    state.modelLoaded = true;

    const loadedResponse: ImageGenerationResponse = {
        type: 'progress',
        payload: {
            step: 0,
            totalSteps: 0,
            message: 'Model loaded successfully'
        }
    };
    self.postMessage(loadedResponse);
}

interface DiffusionParams {
    prompt: string;
    negativePrompt: string;
    steps: number;
    guidanceScale: number;
    seed: number;
}

async function executeDiffusion(params: DiffusionParams): Promise<Blob> {
    const { prompt, steps, seed } = params;
    // negativePrompt and guidanceScale will be used when actual SD model is integrated

    // Validate we have model weights
    if (!state.modelWeights) {
        throw new Error('Model weights not loaded');
    }

    // Execute diffusion pipeline with progress reporting
    for (let step = 1; step <= steps; step++) {
        // Check for cancellation
        if (state.shouldCancel) {
            throw new Error('Generation cancelled');
        }

        // Report progress for each diffusion step
        const percentage = Math.floor((step / steps) * 100);
        const progressResponse: ImageGenerationResponse = {
            type: 'progress',
            payload: {
                step,
                totalSteps: steps,
                message: `Diffusion step ${step}/${steps} (${percentage}%)`
            }
        };
        self.postMessage(progressResponse);

        // Simulate diffusion computation
        // In production, this would execute actual Stable Diffusion inference
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Generate final image
    // In production, this would be the actual denoised latent converted to image
    const imageBlob = await generatePlaceholderImage(prompt, seed);

    return imageBlob;
}

async function generatePlaceholderImage(prompt: string, seed: number): Promise<Blob> {
    // Create 512x512 canvas (standard SD resolution)
    const canvas = new OffscreenCanvas(512, 512);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Failed to get canvas context');
    }

    // Generate deterministic gradient based on seed
    const hue1 = (seed % 360);
    const hue2 = ((seed * 137) % 360); // Use golden angle for variety

    const gradient = ctx.createLinearGradient(0, 0, 512, 512);
    gradient.addColorStop(0, `hsl(${hue1}, 70%, 60%)`);
    gradient.addColorStop(1, `hsl(${hue2}, 70%, 40%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);

    // Add prompt text (truncated)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 4;

    const maxLength = 40;
    const displayPrompt = prompt.length > maxLength
        ? prompt.substring(0, maxLength) + '...'
        : prompt;

    ctx.fillText(displayPrompt, 256, 256);

    // Add seed info
    ctx.font = '12px sans-serif';
    ctx.fillText(`Seed: ${seed}`, 256, 290);

    // Add placeholder indicator
    ctx.font = '10px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText('(Placeholder - Stable Diffusion not yet integrated)', 256, 480);

    // Convert to PNG blob
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return blob;
}

function handleCancel(): void {
    state.shouldCancel = true;

    if (state.isProcessing) {
        const cancelResponse: ImageGenerationResponse = {
            type: 'cancelled',
            payload: {
                message: 'Image generation cancelled'
            }
        };
        self.postMessage(cancelResponse);
    }
}
