// Speech Worker for ASR (Whisper) and TTS (Kokoro) inference
// Handles speech-to-text and text-to-speech using WebGPU acceleration

import { ModelLoader, type ModelMetadata, type LoadProgress } from './model-loader';

export interface SpeechMessage {
    type: 'initialize-asr' | 'initialize-tts' | 'transcribe' | 'synthesize' | 'cancel';
    payload: {
        audioData?: ArrayBuffer;
        text?: string;
        language?: string;
        voice?: string;
    };
}

export interface SpeechResponse {
    type: 'initialized' | 'progress' | 'transcription' | 'audio' | 'error' | 'cancelled';
    payload: {
        transcription?: string;
        audioBlob?: Blob;
        progress?: number;
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
    asrModelLoaded: boolean;
    ttsModelLoaded: boolean;
    modelLoader?: ModelLoader;
    asrModelWeights?: ArrayBuffer;
    ttsModelWeights?: ArrayBuffer;
}

const state: WorkerState = {
    isInitialized: false,
    isProcessing: false,
    shouldCancel: false,
    asrModelLoaded: false,
    ttsModelLoaded: false
};

self.onmessage = async (event: MessageEvent<SpeechMessage>) => {
    const { type, payload } = event.data;

    try {
        switch (type) {
            case 'initialize-asr':
                await handleInitializeASR();
                break;
            case 'initialize-tts':
                await handleInitializeTTS();
                break;
            case 'transcribe':
                await handleTranscribe(payload);
                break;
            case 'synthesize':
                await handleSynthesize(payload);
                break;
            case 'cancel':
                handleCancel();
                break;
            default:
                throw new Error(`Unknown message type: ${type}`);
        }
    } catch (error) {
        const response: SpeechResponse = {
            type: 'error',
            payload: {
                error: error instanceof Error ? error.message : String(error)
            }
        };
        self.postMessage(response);
    }
};

async function handleInitializeASR(): Promise<void> {
    try {
        // Initialize WebGPU context if not already done
        if (!state.isInitialized) {
            await initializeWebGPU();
            state.modelLoader = new ModelLoader();
            await state.modelLoader.initialize();
            state.isInitialized = true;
        }

        // Load ASR model
        await loadASRModel();

        const response: SpeechResponse = {
            type: 'initialized',
            payload: {
                message: 'ASR (Whisper) initialized'
            }
        };
        self.postMessage(response);
    } catch (error) {
        throw new Error(`ASR initialization failed: ${error}`);
    }
}

async function handleInitializeTTS(): Promise<void> {
    try {
        // Initialize WebGPU context if not already done
        if (!state.isInitialized) {
            await initializeWebGPU();
            state.modelLoader = new ModelLoader();
            await state.modelLoader.initialize();
            state.isInitialized = true;
        }

        // Load TTS model
        await loadTTSModel();

        const response: SpeechResponse = {
            type: 'initialized',
            payload: {
                message: 'TTS (Kokoro) initialized'
            }
        };
        self.postMessage(response);
    } catch (error) {
        throw new Error(`TTS initialization failed: ${error}`);
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
        console.error('GPU device lost in speech worker:', info);
        handleGPUContextLoss(info.reason);
    });
}

async function handleGPUContextLoss(reason: string): Promise<void> {
    console.log(`Attempting to recover from GPU context loss: ${reason}`);

    const progressResponse: SpeechResponse = {
        type: 'progress',
        payload: {
            progress: 0,
            message: 'GPU context lost, attempting recovery...'
        }
    };
    self.postMessage(progressResponse);

    try {
        // Wait before attempting recovery
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Attempt to reinitialize WebGPU
        await initializeWebGPU();

        const successResponse: SpeechResponse = {
            type: 'progress',
            payload: {
                progress: 100,
                message: 'GPU context recovered successfully'
            }
        };
        self.postMessage(successResponse);

        console.log('GPU context recovery successful');
    } catch (error) {
        const errorResponse: SpeechResponse = {
            type: 'error',
            payload: {
                error: `GPU context recovery failed: ${error}`
            }
        };
        self.postMessage(errorResponse);

        // Mark as not initialized
        state.isInitialized = false;
        state.asrModelLoaded = false;
        state.ttsModelLoaded = false;
    }
}

async function loadASRModel(): Promise<void> {
    if (!state.modelLoader) {
        throw new Error('Model loader not initialized');
    }

    if (state.asrModelLoaded) {
        return;
    }

    // Define Whisper Tiny model metadata
    const modelMetadata: ModelMetadata = {
        modelId: 'whisper-tiny',
        modelType: 'speech-asr',
        version: '1.0',
        sizeBytes: 39 * 1024 * 1024, // 39MB
        url: 'https://placeholder.com/whisper-tiny.bin' // Placeholder URL
    };

    // Load model with progress reporting
    state.asrModelWeights = await state.modelLoader.loadModel(
        modelMetadata,
        (progress: LoadProgress) => {
            const response: SpeechResponse = {
                type: 'progress',
                payload: {
                    progress: progress.percentage,
                    message: progress.message
                }
            };
            self.postMessage(response);
        }
    );

    state.asrModelLoaded = true;

    const loadedResponse: SpeechResponse = {
        type: 'progress',
        payload: {
            progress: 100,
            message: 'Whisper model loaded successfully'
        }
    };
    self.postMessage(loadedResponse);
}

async function loadTTSModel(): Promise<void> {
    if (!state.modelLoader) {
        throw new Error('Model loader not initialized');
    }

    if (state.ttsModelLoaded) {
        return;
    }

    // Define Kokoro-82M model metadata
    const modelMetadata: ModelMetadata = {
        modelId: 'kokoro-82m',
        modelType: 'speech-tts',
        version: '1.0',
        sizeBytes: 82 * 1024 * 1024, // 82MB
        url: 'https://placeholder.com/kokoro-82m.bin' // Placeholder URL
    };

    // Load model with progress reporting
    state.ttsModelWeights = await state.modelLoader.loadModel(
        modelMetadata,
        (progress: LoadProgress) => {
            const response: SpeechResponse = {
                type: 'progress',
                payload: {
                    progress: progress.percentage,
                    message: progress.message
                }
            };
            self.postMessage(response);
        }
    );

    state.ttsModelLoaded = true;

    const loadedResponse: SpeechResponse = {
        type: 'progress',
        payload: {
            progress: 100,
            message: 'Kokoro TTS model loaded successfully'
        }
    };
    self.postMessage(loadedResponse);
}

async function handleTranscribe(payload: SpeechMessage['payload']): Promise<void> {
    if (!state.isInitialized || !state.asrModelLoaded) {
        throw new Error('ASR model not initialized');
    }

    if (state.isProcessing) {
        throw new Error('Worker is already processing a task');
    }

    state.isProcessing = true;
    state.shouldCancel = false;

    try {
        const { audioData, language = 'auto' } = payload;

        if (!audioData) {
            throw new Error('Audio data is required for transcription');
        }

        // Report starting
        const startResponse: SpeechResponse = {
            type: 'progress',
            payload: {
                progress: 0,
                message: 'Starting transcription...'
            }
        };
        self.postMessage(startResponse);

        // Check for cancellation
        if (state.shouldCancel) {
            handleCancel();
            return;
        }

        // Execute ASR inference
        const transcription = await executeASR(audioData, language);

        // Check for cancellation before sending result
        if (state.shouldCancel) {
            handleCancel();
            return;
        }

        // Send transcription result
        const completeResponse: SpeechResponse = {
            type: 'transcription',
            payload: {
                transcription,
                message: 'Transcription complete'
            }
        };
        self.postMessage(completeResponse);
    } finally {
        state.isProcessing = false;
        state.shouldCancel = false;
    }
}

async function executeASR(audioData: ArrayBuffer, language: string): Promise<string> {
    // Validate we have model weights
    if (!state.asrModelWeights) {
        throw new Error('ASR model weights not loaded');
    }

    // Report progress
    const progressResponse: SpeechResponse = {
        type: 'progress',
        payload: {
            progress: 50,
            message: `Processing audio (language: ${language})...`
        }
    };
    self.postMessage(progressResponse);

    // Simulate ASR processing
    // In production, this would execute actual Whisper inference
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check for cancellation
    if (state.shouldCancel) {
        throw new Error('Transcription cancelled');
    }

    // Generate placeholder transcription
    const audioLengthSeconds = Math.floor(audioData.byteLength / (16000 * 2)); // Assuming 16kHz, 16-bit audio
    const placeholderText = `[Placeholder transcription - Whisper not yet integrated. Audio length: ~${audioLengthSeconds}s, Language: ${language}]`;

    return placeholderText;
}

async function handleSynthesize(payload: SpeechMessage['payload']): Promise<void> {
    if (!state.isInitialized || !state.ttsModelLoaded) {
        throw new Error('TTS model not initialized');
    }

    if (state.isProcessing) {
        throw new Error('Worker is already processing a task');
    }

    state.isProcessing = true;
    state.shouldCancel = false;

    try {
        const { text, voice = 'default' } = payload;

        if (!text || !text.trim()) {
            throw new Error('Text is required for speech synthesis');
        }

        // Report starting
        const startResponse: SpeechResponse = {
            type: 'progress',
            payload: {
                progress: 0,
                message: 'Starting speech synthesis...'
            }
        };
        self.postMessage(startResponse);

        // Check for cancellation
        if (state.shouldCancel) {
            handleCancel();
            return;
        }

        // Execute TTS inference
        const audioBlob = await executeTTS(text, voice);

        // Check for cancellation before sending result
        if (state.shouldCancel) {
            handleCancel();
            return;
        }

        // Send audio result
        const completeResponse: SpeechResponse = {
            type: 'audio',
            payload: {
                audioBlob,
                message: 'Speech synthesis complete'
            }
        };
        self.postMessage(completeResponse);
    } finally {
        state.isProcessing = false;
        state.shouldCancel = false;
    }
}

async function executeTTS(text: string, voice: string): Promise<Blob> {
    // Validate we have model weights
    if (!state.ttsModelWeights) {
        throw new Error('TTS model weights not loaded');
    }

    // Report progress
    const progressResponse: SpeechResponse = {
        type: 'progress',
        payload: {
            progress: 50,
            message: `Generating speech (voice: ${voice})...`
        }
    };
    self.postMessage(progressResponse);

    // Simulate TTS processing
    // In production, this would execute actual Kokoro inference
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check for cancellation
    if (state.shouldCancel) {
        throw new Error('Speech synthesis cancelled');
    }

    // Generate placeholder audio
    const audioBlob = await generatePlaceholderAudio(text);

    return audioBlob;
}

async function generatePlaceholderAudio(text: string): Promise<Blob> {
    // Generate a simple beep sound as placeholder
    // In production, this would be the actual synthesized speech

    const sampleRate = 16000;
    const duration = Math.min(text.length * 0.05, 10); // Rough estimate: 50ms per character, max 10s
    const numSamples = Math.floor(sampleRate * duration);

    // Create WAV file
    const wavBuffer = createWavBuffer(numSamples, sampleRate);

    return new Blob([wavBuffer], { type: 'audio/wav' });
}

function createWavBuffer(numSamples: number, sampleRate: number): ArrayBuffer {
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    // WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    writeString(view, 36, 'data');
    view.setUint32(40, numSamples * 2, true);

    // Generate simple tone (440 Hz beep)
    const frequency = 440;
    for (let i = 0; i < numSamples; i++) {
        const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.3;
        view.setInt16(44 + i * 2, sample * 32767, true);
    }

    return buffer;
}

function writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

function handleCancel(): void {
    state.shouldCancel = true;

    if (state.isProcessing) {
        const cancelResponse: SpeechResponse = {
            type: 'cancelled',
            payload: {
                message: 'Speech processing cancelled'
            }
        };
        self.postMessage(cancelResponse);
    }
}
