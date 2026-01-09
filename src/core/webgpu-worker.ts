/**
 * WebGPU Worker Context Manager
 * 
 * Handles WebGPU adapter and device initialization in Web Workers.
 * Manages GPU context loss and reinitialization.
 * 
 * Requirements: 7.1, 10.1
 */

export interface WebGPUContext {
    adapter: GPUAdapter;
    device: GPUDevice;
    limits: GPUSupportedLimits;
}

export interface WebGPUContextOptions {
    powerPreference?: 'low-power' | 'high-performance';
    requiredFeatures?: GPUFeatureName[];
    requiredLimits?: Record<string, number>;
}

/**
 * WebGPUWorkerContext manages WebGPU initialization and context loss handling.
 */
export class WebGPUWorkerContext {
    private context: WebGPUContext | null = null;
    private contextLostHandler: (() => void) | null = null;
    private reinitializing = false;

    /**
     * Initialize WebGPU adapter and device.
     * Returns the WebGPU context or throws if unavailable.
     */
    async initialize(options: WebGPUContextOptions = {}): Promise<WebGPUContext> {
        if (this.context) {
            return this.context;
        }

        // Check if WebGPU is available
        if (!navigator.gpu) {
            throw new Error('WebGPU is not supported in this environment');
        }

        try {
            // Request adapter
            const adapter = await navigator.gpu.requestAdapter({
                powerPreference: options.powerPreference || 'high-performance',
            });

            if (!adapter) {
                throw new Error('Failed to get WebGPU adapter');
            }

            // Request device with optional features and limits
            const device = await adapter.requestDevice({
                requiredFeatures: options.requiredFeatures,
                requiredLimits: options.requiredLimits,
            });

            // Set up context loss handler
            device.lost.then((info) => {
                console.error('WebGPU device lost:', info.message);
                this.handleContextLoss(info.reason);
            });

            this.context = {
                adapter,
                device,
                limits: device.limits,
            };

            return this.context;
        } catch (error) {
            console.error('Failed to initialize WebGPU:', error);
            throw error;
        }
    }

    /**
     * Get the current WebGPU context.
     * Throws if not initialized.
     */
    getContext(): WebGPUContext {
        if (!this.context) {
            throw new Error('WebGPU context not initialized');
        }
        return this.context;
    }

    /**
     * Check if WebGPU context is initialized and valid.
     */
    isInitialized(): boolean {
        return this.context !== null && !this.context.device.lost;
    }

    /**
     * Register a callback for context loss events.
     */
    onContextLost(handler: () => void): void {
        this.contextLostHandler = handler;
    }

    /**
     * Handle GPU context loss.
     * Attempts to reinitialize the context.
     */
    private async handleContextLoss(reason: GPUDeviceLostReason): Promise<void> {
        console.warn(`GPU context lost: ${reason}`);

        // Clear current context
        this.context = null;

        // Notify handler
        if (this.contextLostHandler) {
            this.contextLostHandler();
        }

        // Attempt reinitialization if not already doing so
        if (!this.reinitializing && reason !== 'destroyed') {
            this.reinitializing = true;

            try {
                console.log('Attempting to reinitialize WebGPU context...');
                await this.initialize();
                console.log('WebGPU context reinitialized successfully');
            } catch (error) {
                console.error('Failed to reinitialize WebGPU context:', error);
            } finally {
                this.reinitializing = false;
            }
        }
    }

    /**
     * Destroy the WebGPU context and release resources.
     */
    async destroy(): Promise<void> {
        if (this.context) {
            this.context.device.destroy();
            this.context = null;
        }
        this.contextLostHandler = null;
        this.reinitializing = false;
    }

    /**
     * Get estimated VRAM capacity from adapter limits.
     * Returns estimated VRAM in GB.
     */
    getEstimatedVRAM(): number {
        if (!this.context) {
            return 0;
        }

        // Estimate VRAM based on maxBufferSize
        // This is a rough estimate as WebGPU doesn't expose actual VRAM
        const maxBufferSize = this.context.limits.maxBufferSize;
        const estimatedVRAM = maxBufferSize / (1024 * 1024 * 1024); // Convert to GB

        return Math.round(estimatedVRAM * 10) / 10; // Round to 1 decimal place
    }

    /**
     * Check if the device supports specific features.
     */
    supportsFeatures(features: GPUFeatureName[]): boolean {
        if (!this.context) {
            return false;
        }

        return features.every(feature =>
            this.context!.device.features.has(feature)
        );
    }

    /**
     * Get device limits for resource planning.
     */
    getLimits(): GPUSupportedLimits | null {
        return this.context?.limits || null;
    }
}

/**
 * Worker-side WebGPU initialization helper.
 * This code runs inside the Web Worker context.
 */
export function createWebGPUWorkerScript(): string {
    return `
    // WebGPU Worker Script
    let gpuContext = null;
    let adapter = null;
    let device = null;

    async function initializeWebGPU(options = {}) {
      try {
        if (!navigator.gpu) {
          throw new Error('WebGPU not supported');
        }

        adapter = await navigator.gpu.requestAdapter({
          powerPreference: options.powerPreference || 'high-performance',
        });

        if (!adapter) {
          throw new Error('Failed to get WebGPU adapter');
        }

        device = await adapter.requestDevice({
          requiredFeatures: options.requiredFeatures || [],
          requiredLimits: options.requiredLimits || {},
        });

        // Handle device loss
        device.lost.then((info) => {
          self.postMessage({
            type: 'context-lost',
            reason: info.reason,
            message: info.message,
          });
          
          // Attempt reinitialization
          initializeWebGPU(options).catch(err => {
            self.postMessage({
              type: 'error',
              data: { message: 'Failed to reinitialize WebGPU: ' + err.message }
            });
          });
        });

        gpuContext = { adapter, device };
        
        self.postMessage({
          type: 'webgpu-ready',
          limits: {
            maxBufferSize: device.limits.maxBufferSize,
            maxTextureDimension2D: device.limits.maxTextureDimension2D,
            maxComputeWorkgroupSizeX: device.limits.maxComputeWorkgroupSizeX,
          }
        });

        return gpuContext;
      } catch (error) {
        self.postMessage({
          type: 'error',
          data: { message: 'WebGPU initialization failed: ' + error.message }
        });
        throw error;
      }
    }

    function getGPUContext() {
      if (!gpuContext) {
        throw new Error('WebGPU context not initialized');
      }
      return gpuContext;
    }

    // Export for use in worker
    self.initializeWebGPU = initializeWebGPU;
    self.getGPUContext = getGPUContext;
  `;
}
