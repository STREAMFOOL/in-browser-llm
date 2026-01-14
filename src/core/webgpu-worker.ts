import type { ModelType } from './inference-worker-manager';
import { ModelLoader, type ModelMetadata, type LoadProgress } from './model-loader';

interface WorkerState {
  modelType?: ModelType;
  gpuAdapter?: GPUAdapter;
  gpuDevice?: GPUDevice;
  isInitialized: boolean;
  isProcessing: boolean;
  modelLoader?: ModelLoader;
  visionModelWeights?: ArrayBuffer;
  visionModelLoaded: boolean;
}

const state: WorkerState = {
  isInitialized: false,
  isProcessing: false,
  visionModelLoaded: false
};

self.onmessage = async (event: MessageEvent) => {
  const { type, modelType, task } = event.data;

  try {
    switch (type) {
      case 'initialize':
        await handleInitialize(modelType);
        break;
      case 'inference':
        await handleInference(task);
        break;
      case 'cancel':
        handleCancel();
        break;
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : String(error)
      }
    });
  }
};

async function handleInitialize(modelType: ModelType): Promise<void> {
  try {
    state.modelType = modelType;

    // Initialize WebGPU context
    await initializeWebGPU();

    // Initialize model loader
    state.modelLoader = new ModelLoader();
    await state.modelLoader.initialize();

    state.isInitialized = true;

    self.postMessage({
      type: 'initialized',
      payload: {
        modelType,
        gpuInfo: {
          adapter: state.gpuAdapter ? 'available' : 'unavailable',
          device: state.gpuDevice ? 'available' : 'unavailable'
        }
      }
    });
  } catch (error) {
    throw new Error(`Worker initialization failed: ${error}`);
  }
}

async function initializeWebGPU(): Promise<void> {
  if (!navigator.gpu) {
    throw new Error('WebGPU is not supported in this browser');
  }

  // Request GPU adapter
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

  // Set up device lost handler
  device.lost.then((info) => {
    console.error('GPU device lost in worker:', info);
    handleGPUContextLoss(info.reason);
  });
}

async function handleGPUContextLoss(reason: string): Promise<void> {
  console.log(`Attempting to recover from GPU context loss: ${reason}`);

  self.postMessage({
    type: 'progress',
    payload: {
      phase: 'gpu-recovery',
      percentage: 0,
      message: 'GPU context lost, attempting recovery...'
    }
  });

  try {
    // Wait a bit before attempting recovery
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Attempt to reinitialize WebGPU
    await initializeWebGPU();

    self.postMessage({
      type: 'progress',
      payload: {
        phase: 'gpu-recovery',
        percentage: 100,
        message: 'GPU context recovered successfully'
      }
    });

    console.log('GPU context recovery successful');
  } catch (error) {
    self.postMessage({
      type: 'error',
      payload: {
        message: `GPU context recovery failed: ${error}`
      }
    });

    // Mark as not initialized so future operations will fail gracefully
    state.isInitialized = false;
  }
}

async function handleInference(task: any): Promise<void> {
  if (!state.isInitialized) {
    throw new Error('Worker not initialized');
  }

  if (state.isProcessing) {
    throw new Error('Worker is already processing a task');
  }

  state.isProcessing = true;

  try {
    // Report progress
    self.postMessage({
      type: 'progress',
      payload: {
        phase: 'starting',
        percentage: 0,
        message: `Starting ${state.modelType} inference`
      }
    });

    // Placeholder for actual model inference
    // This will be implemented in subsequent tasks for each model type
    const result = await executeModelInference(task);

    self.postMessage({
      type: 'result',
      payload: {
        output: result,
        metadata: {
          modelType: state.modelType
        }
      }
    });
  } finally {
    state.isProcessing = false;
  }
}

async function executeModelInference(task: any): Promise<any> {
  // Route to model-specific inference based on model type
  switch (state.modelType) {
    case 'image-generation':
      return await executeImageGeneration(task);
    case 'speech-asr':
      return await executeSpeechASR(task);
    case 'speech-tts':
      return await executeSpeechTTS(task);
    case 'vision':
      return await executeVisionInference(task);
    default:
      throw new Error(`Unknown model type: ${state.modelType}`);
  }
}

async function executeImageGeneration(task: any): Promise<any> {
  const { input, parameters } = task;

  // Validate input is a prompt string
  if (typeof input !== 'string') {
    throw new Error('Image generation requires a text prompt');
  }

  const {
    steps = 20
  } = parameters;
  // seed, negativePrompt and guidanceScale will be used when actual SD model is integrated
  const seed = parameters.seed || Math.floor(Math.random() * 1000000);

  // Report starting
  self.postMessage({
    type: 'progress',
    payload: {
      phase: 'starting',
      percentage: 0,
      message: 'Starting image generation...'
    }
  });

  // Simulate diffusion steps with progress reporting
  for (let step = 1; step <= steps; step++) {
    const percentage = Math.floor((step / steps) * 100);

    self.postMessage({
      type: 'progress',
      payload: {
        phase: 'diffusion',
        percentage,
        message: `Diffusion step ${step}/${steps}`
      }
    });

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  // Create placeholder image (512x512)
  const canvas = new OffscreenCanvas(512, 512);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Fill with gradient
  const gradient = ctx.createLinearGradient(0, 0, 512, 512);
  gradient.addColorStop(0, '#667eea');
  gradient.addColorStop(1, '#764ba2');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);

  // Add prompt text
  ctx.fillStyle = 'white';
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Prompt: ${input.substring(0, 30)}...`, 256, 240);

  // Add seed info
  ctx.font = '14px sans-serif';
  ctx.fillText(`Seed: ${seed}`, 256, 270);

  // Convert to blob
  const blob = await canvas.convertToBlob({ type: 'image/png' });

  self.postMessage({
    type: 'progress',
    payload: {
      phase: 'complete',
      percentage: 100,
      message: 'Image generation complete'
    }
  });

  return blob;
}

async function executeSpeechASR(task: any): Promise<any> {
  const { input, parameters } = task;

  // Validate input is audio data
  if (!(input instanceof ArrayBuffer)) {
    throw new Error('ASR requires audio data as ArrayBuffer');
  }

  const { language = 'auto' } = parameters;

  // Report starting
  self.postMessage({
    type: 'progress',
    payload: {
      phase: 'starting',
      percentage: 0,
      message: 'Starting transcription...'
    }
  });

  // Report processing
  self.postMessage({
    type: 'progress',
    payload: {
      phase: 'processing',
      percentage: 50,
      message: `Processing audio (language: ${language})...`
    }
  });

  // Simulate ASR processing
  await new Promise(resolve => setTimeout(resolve, 500));

  // Generate placeholder transcription
  const audioLengthSeconds = Math.floor(input.byteLength / (16000 * 2));
  const transcription = `[Placeholder transcription - Whisper not yet integrated. Audio length: ~${audioLengthSeconds}s, Language: ${language}]`;

  self.postMessage({
    type: 'progress',
    payload: {
      phase: 'complete',
      percentage: 100,
      message: 'Transcription complete'
    }
  });

  return transcription;
}

async function executeSpeechTTS(task: any): Promise<any> {
  const { input, parameters } = task;

  // Validate input is text
  if (typeof input !== 'string') {
    throw new Error('TTS requires text input');
  }

  if (!input.trim()) {
    throw new Error('Text cannot be empty');
  }

  const { voice = 'default' } = parameters;

  // Report starting
  self.postMessage({
    type: 'progress',
    payload: {
      phase: 'starting',
      percentage: 0,
      message: 'Starting speech synthesis...'
    }
  });

  // Report processing
  self.postMessage({
    type: 'progress',
    payload: {
      phase: 'processing',
      percentage: 50,
      message: `Generating speech (voice: ${voice})...`
    }
  });

  // Simulate TTS processing
  await new Promise(resolve => setTimeout(resolve, 500));

  // Generate placeholder audio
  const audioBlob = await generatePlaceholderAudio(input);

  self.postMessage({
    type: 'progress',
    payload: {
      phase: 'complete',
      percentage: 100,
      message: 'Speech synthesis complete'
    }
  });

  return audioBlob;
}

function generatePlaceholderAudio(text: string): Promise<Blob> {
  // Generate a simple beep sound as placeholder
  const sampleRate = 16000;
  const duration = Math.min(text.length * 0.05, 10);
  const numSamples = Math.floor(sampleRate * duration);

  // Create WAV file
  const wavBuffer = createWavBuffer(numSamples, sampleRate);

  return Promise.resolve(new Blob([wavBuffer], { type: 'audio/wav' }));
}

function createWavBuffer(numSamples: number, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
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

async function executeVisionInference(task: any): Promise<any> {
  const { input, parameters } = task;

  // Validate input is image data
  if (!(input instanceof ArrayBuffer)) {
    throw new Error('Vision model requires image data as ArrayBuffer');
  }

  const { taskType = 'caption' } = parameters;

  // Report starting
  self.postMessage({
    type: 'progress',
    payload: {
      phase: 'starting',
      percentage: 0,
      message: 'Starting image analysis...'
    }
  });

  // Load Florence-2 model if not already loaded
  if (!state.visionModelLoaded) {
    await loadVisionModel();
  }

  // Report processing
  self.postMessage({
    type: 'progress',
    payload: {
      phase: 'processing',
      percentage: 50,
      message: `Analyzing image (task: ${taskType})...`
    }
  });

  // Execute vision pipeline
  const result = await executeVisionPipeline(input, taskType);

  self.postMessage({
    type: 'progress',
    payload: {
      phase: 'complete',
      percentage: 100,
      message: 'Image analysis complete'
    }
  });

  return result;
}

async function loadVisionModel(): Promise<void> {
  if (!state.modelLoader) {
    throw new Error('Model loader not initialized');
  }

  // Define Florence-2 Base model metadata
  const modelMetadata: ModelMetadata = {
    modelId: 'florence-2-base',
    modelType: 'vision',
    version: '1.0',
    sizeBytes: 232 * 1024 * 1024, // 232MB
    url: 'https://placeholder.com/florence-2-base.bin' // Placeholder URL
  };

  // Load model with progress reporting
  state.visionModelWeights = await state.modelLoader.loadModel(
    modelMetadata,
    (progress: LoadProgress) => {
      self.postMessage({
        type: 'progress',
        payload: {
          phase: 'loading',
          percentage: progress.percentage,
          message: progress.message
        }
      });
    }
  );

  state.visionModelLoaded = true;

  self.postMessage({
    type: 'progress',
    payload: {
      phase: 'loading',
      percentage: 100,
      message: 'Florence-2 model loaded successfully'
    }
  });
}

async function executeVisionPipeline(imageData: ArrayBuffer, taskType: string): Promise<any> {
  // Validate we have model weights
  if (!state.visionModelWeights) {
    throw new Error('Vision model weights not loaded');
  }

  // Simulate vision processing
  // In production, this would execute actual Florence-2 inference
  await new Promise(resolve => setTimeout(resolve, 500));

  // Generate result based on task type
  let result: any;
  switch (taskType) {
    case 'caption':
      result = {
        caption: '[Placeholder caption - Florence-2 not yet integrated. This would be a detailed description of the image.]'
      };
      break;
    case 'detailed-caption':
      result = {
        caption: '[Placeholder detailed caption - Florence-2 not yet integrated. This would be a comprehensive description including objects, actions, and scene context.]'
      };
      break;
    case 'object-detection':
      // Generate placeholder bounding boxes
      result = {
        objects: [
          {
            label: 'placeholder_object_1',
            confidence: 0.95,
            boundingBox: { x: 100, y: 100, width: 200, height: 200 }
          },
          {
            label: 'placeholder_object_2',
            confidence: 0.87,
            boundingBox: { x: 350, y: 150, width: 150, height: 180 }
          }
        ]
      };
      break;
    case 'ocr':
      result = {
        text: '[Placeholder OCR text - Florence-2 not yet integrated. This would be extracted text from the image.]'
      };
      break;
    default:
      throw new Error(`Unknown vision task type: ${taskType}`);
  }

  return result;
}

async function executePlaceholderInference(_task: any): Promise<any> {
  // Placeholder for future model types
  self.postMessage({
    type: 'progress',
    payload: {
      phase: 'processing',
      percentage: 50,
      message: 'Processing inference task'
    }
  });

  await new Promise(resolve => setTimeout(resolve, 100));

  self.postMessage({
    type: 'progress',
    payload: {
      phase: 'complete',
      percentage: 100,
      message: 'Inference complete'
    }
  });

  return {
    placeholder: true,
    message: 'Model inference not yet implemented'
  };
}

function handleCancel(): void {
  if (state.isProcessing) {
    state.isProcessing = false;
    self.postMessage({
      type: 'cancelled',
      payload: {
        message: 'Inference cancelled'
      }
    });
  }
}
