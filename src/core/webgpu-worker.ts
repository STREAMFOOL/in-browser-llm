import type { ModelType } from './inference-worker-manager';

interface WorkerState {
  modelType?: ModelType;
  gpuAdapter?: GPUAdapter;
  gpuDevice?: GPUDevice;
  isInitialized: boolean;
  isProcessing: boolean;
}

const state: WorkerState = {
  isInitialized: false,
  isProcessing: false
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
    case 'vision':
    case 'speech-asr':
    case 'speech-tts':
      // Placeholder for other model types
      return await executePlaceholderInference(task);
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

async function executePlaceholderInference(_task: any): Promise<any> {
  // Placeholder for other model types (vision, speech-asr, speech-tts)
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
