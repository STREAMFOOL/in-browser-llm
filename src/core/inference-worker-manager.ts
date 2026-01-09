/**
 * InferenceWorkerManager
 * 
 * Manages Web Workers for GPU-accelerated model inference.
 * Maintains a pool of workers (max 2 concurrent) to prevent memory exhaustion.
 * Handles progress callbacks and cancellation via AbortController.
 * 
 * Requirements: 7.2, 8.5
 */

export type ModelType = 'image-generation' | 'vision' | 'speech-asr' | 'speech-tts';

export interface InferenceTask {
    type: ModelType;
    input: string | Blob | ArrayBuffer;
    parameters: Record<string, any>;
}

export interface InferenceResult {
    type: ModelType;
    output: string | Blob | ArrayBuffer;
    metadata: Record<string, any>;
}

export interface WorkerHandle {
    id: string;
    modelType: ModelType;
    worker: Worker;
    busy: boolean;
    abortController: AbortController | null;
}

export interface ProgressCallback {
    (progress: number): void;
}

/**
 * InferenceWorkerManager manages a pool of Web Workers for ML inference tasks.
 * Ensures non-blocking execution by offloading heavy computations to workers.
 */
export class InferenceWorkerManager {
    private workers: Map<string, WorkerHandle> = new Map();
    private readonly maxWorkers = 2;
    private progressCallbacks: Map<string, ProgressCallback> = new Map();

    /**
     * Initialize a worker for a specific model type.
     * Reuses existing idle worker if available, otherwise creates new one up to maxWorkers limit.
     */
    async initializeWorker(modelType: ModelType): Promise<WorkerHandle> {
        // Check if we already have an idle worker for this model type
        for (const handle of this.workers.values()) {
            if (handle.modelType === modelType && !handle.busy) {
                return handle;
            }
        }

        // Check if we've reached the max worker limit
        if (this.workers.size >= this.maxWorkers) {
            // Try to find an idle worker of a different type to terminate
            const idleWorker = this.findIdleWorker();
            if (idleWorker) {
                await this.terminateWorker(idleWorker);
            } else {
                throw new Error('Maximum number of workers reached and all are busy');
            }
        }

        // Create new worker
        const workerId = `worker-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        const worker = this.createWorker(modelType);

        const handle: WorkerHandle = {
            id: workerId,
            modelType,
            worker,
            busy: false,
            abortController: null,
        };

        this.workers.set(workerId, handle);
        return handle;
    }

    /**
     * Execute an inference task on a worker.
     * Returns a promise that resolves with the inference result.
     */
    async runInference(handle: WorkerHandle, task: InferenceTask): Promise<InferenceResult> {
        if (handle.busy) {
            throw new Error('Worker is already busy with another task');
        }

        handle.busy = true;
        handle.abortController = new AbortController();

        return new Promise((resolve, reject) => {
            let settled = false;

            const cleanup = () => {
                clearTimeout(timeoutId);
                handle.worker.removeEventListener('message', messageHandler);
                handle.worker.removeEventListener('error', errorHandler);
                if (handle.abortController) {
                    handle.abortController.signal.removeEventListener('abort', abortHandler);
                }
            };

            const timeoutId = setTimeout(() => {
                if (settled) return;
                settled = true;
                cleanup();
                this.cancelInference(handle);
                reject(new Error('Inference timeout'));
            }, 120000); // 120s timeout for inference tasks

            const abortHandler = () => {
                if (settled) return;
                settled = true;
                cleanup();
                handle.busy = false;
                handle.abortController = null;
                reject(new Error('Inference cancelled'));
            };

            const messageHandler = (event: MessageEvent) => {
                const { type, data } = event.data;

                if (type === 'progress') {
                    const callback = this.progressCallbacks.get(handle.id);
                    if (callback) {
                        callback(data.progress);
                    }
                } else if (type === 'result') {
                    if (settled) return;
                    settled = true;
                    cleanup();
                    handle.busy = false;
                    handle.abortController = null;
                    resolve(data as InferenceResult);
                } else if (type === 'error') {
                    if (settled) return;
                    settled = true;
                    cleanup();
                    handle.busy = false;
                    handle.abortController = null;
                    reject(new Error(data.message));
                }
            };

            const errorHandler = (error: ErrorEvent) => {
                if (settled) return;
                settled = true;
                cleanup();
                handle.busy = false;
                handle.abortController = null;
                reject(error);
            };

            handle.worker.addEventListener('message', messageHandler);
            handle.worker.addEventListener('error', errorHandler);

            if (!handle.abortController) {
                throw new Error('AbortController is unexpectedly null');
            }

            // Listen for abort signal BEFORE sending task
            handle.abortController.signal.addEventListener('abort', abortHandler);

            // Send task to worker
            handle.worker.postMessage({
                type: 'inference',
                task,
                signal: handle.abortController.signal,
            });
        });
    }

    /**
     * Register a progress callback for a worker.
     */
    onProgress(callback: ProgressCallback): void {
        // Register callback for all workers
        for (const id of this.workers.keys()) {
            this.progressCallbacks.set(id, callback);
        }
    }

    /**
     * Cancel ongoing inference on a worker.
     */
    async cancelInference(handle: WorkerHandle): Promise<void> {
        if (handle.abortController) {
            handle.abortController.abort();
            // Wait a tick for abort handler to fire
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    /**
     * Terminate a worker and free resources.
     */
    async terminateWorker(handle: WorkerHandle): Promise<void> {
        if (handle.busy && handle.abortController) {
            handle.abortController.abort();
            // Wait for cancellation to complete
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        handle.worker.terminate();
        this.workers.delete(handle.id);
        this.progressCallbacks.delete(handle.id);
    }

    /**
     * Terminate all workers and clean up resources.
     */
    async terminateAll(): Promise<void> {
        const terminationPromises = Array.from(this.workers.values()).map(handle =>
            this.terminateWorker(handle).catch(() => {
                // Ignore errors during cleanup
            })
        );
        await Promise.all(terminationPromises);
    }

    /**
     * Find an idle (not busy) worker.
     */
    private findIdleWorker(): WorkerHandle | null {
        for (const handle of this.workers.values()) {
            if (!handle.busy) {
                return handle;
            }
        }
        return null;
    }

    /**
     * Create a worker for a specific model type.
     * In a real implementation, this would load different worker scripts
     * based on the model type.
     */
    private createWorker(modelType: ModelType): Worker {
        // For now, create a generic worker
        // In production, this would load model-specific worker scripts
        const workerCode = this.getWorkerCode(modelType);
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        return new Worker(workerUrl);
    }

    /**
     * Get worker code for a specific model type.
     * This is a placeholder that would be replaced with actual worker implementations.
     */
    private getWorkerCode(modelType: ModelType): string {
        return `
      // WebGPU initialization code
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

      // Initialize WebGPU on worker startup
      initializeWebGPU().catch(err => {
        console.error('Failed to initialize WebGPU in worker:', err);
      });

      self.addEventListener('message', async (event) => {
        const { type, task } = event.data;
        
        if (type === 'inference') {
          try {
            // Ensure WebGPU is ready
            if (!gpuContext) {
              await initializeWebGPU();
            }

            // Simulate inference work with WebGPU
            self.postMessage({ type: 'progress', data: { progress: 0 } });
            
            await new Promise(resolve => setTimeout(resolve, 100));
            self.postMessage({ type: 'progress', data: { progress: 50 } });
            
            await new Promise(resolve => setTimeout(resolve, 100));
            self.postMessage({ type: 'progress', data: { progress: 100 } });
            
            // Return mock result
            const result = {
              type: task.type,
              output: 'Mock inference result with WebGPU',
              metadata: { 
                modelType: '${modelType}',
                webgpuEnabled: !!gpuContext 
              }
            };
            
            self.postMessage({ type: 'result', data: result });
          } catch (error) {
            self.postMessage({ 
              type: 'error', 
              data: { message: error.message } 
            });
          }
        }
      });
    `;
    }
}
