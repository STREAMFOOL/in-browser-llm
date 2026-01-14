export type ModelType = 'image-generation' | 'vision' | 'speech-asr' | 'speech-tts';

export interface WorkerHandle {
  id: string;
  type: ModelType;
  status: 'initializing' | 'ready' | 'busy' | 'terminated';
}

export interface InferenceTask {
  type: ModelType;
  input: string | Blob | ArrayBuffer;
  parameters: Record<string, any>;
  abortSignal?: AbortSignal;
}

export interface InferenceResult {
  type: ModelType;
  output: string | Blob | ArrayBuffer;
  metadata: {
    inferenceTimeMs: number;
    modelVersion?: string;
    [key: string]: any;
  };
}

export interface ProgressUpdate {
  workerId: string;
  phase: string;
  percentage: number;
  message?: string;
}

interface WorkerInfo {
  handle: WorkerHandle;
  worker: Worker;
  abortController?: AbortController;
  lastUsed: number;
}

interface QueuedTask {
  task: InferenceTask;
  resolve: (result: InferenceResult) => void;
  reject: (error: Error) => void;
}

export class InferenceWorkerManager {
  private static readonly MAX_WORKERS = 2;
  private static readonly IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

  private workers: Map<string, WorkerInfo> = new Map();
  private taskQueue: QueuedTask[] = [];
  private progressCallbacks: Set<(progress: ProgressUpdate) => void> = new Set();
  private idleCheckInterval?: number;

  constructor() {
    this.startIdleWorkerCleanup();
  }

  async initializeWorker(modelType: ModelType): Promise<WorkerHandle> {
    // Check if we already have a worker for this model type
    for (const info of this.workers.values()) {
      if (info.handle.type === modelType && info.handle.status !== 'terminated') {
        return info.handle;
      }
    }

    // Check worker pool limit
    if (this.getActiveWorkerCount() >= InferenceWorkerManager.MAX_WORKERS) {
      // Try to terminate an idle worker
      const terminatedAny = await this.terminateIdleWorker();
      if (!terminatedAny) {
        throw new Error('Worker pool limit reached and no idle workers available');
      }
    }

    const workerId = `worker-${modelType}-${Date.now()}`;
    const handle: WorkerHandle = {
      id: workerId,
      type: modelType,
      status: 'initializing'
    };

    try {
      const worker = new Worker(
        new URL('./webgpu-worker.ts', import.meta.url),
        { type: 'module' }
      );

      const workerInfo: WorkerInfo = {
        handle,
        worker,
        lastUsed: Date.now()
      };

      this.workers.set(workerId, workerInfo);

      // Set up message handler
      worker.onmessage = (event) => {
        this.handleWorkerMessage(workerId, event.data);
      };

      worker.onerror = (error) => {
        console.error(`Worker ${workerId} error:`, error);
        handle.status = 'terminated';
      };

      // Initialize the worker with model type
      await this.sendWorkerMessage(worker, {
        type: 'initialize',
        modelType
      });

      handle.status = 'ready';
      return handle;
    } catch (error) {
      this.workers.delete(workerId);
      throw new Error(`Failed to initialize worker: ${error}`);
    }
  }

  async runInference(handle: WorkerHandle, task: InferenceTask): Promise<InferenceResult> {
    const workerInfo = this.workers.get(handle.id);
    if (!workerInfo) {
      throw new Error(`Worker ${handle.id} not found`);
    }

    if (handle.status === 'terminated') {
      throw new Error(`Worker ${handle.id} is terminated`);
    }

    // If worker is busy, queue the task
    if (handle.status === 'busy') {
      return new Promise((resolve, reject) => {
        this.taskQueue.push({ task, resolve, reject });
      });
    }

    handle.status = 'busy';
    workerInfo.lastUsed = Date.now();

    // Set up abort handling
    if (task.abortSignal) {
      workerInfo.abortController = new AbortController();
      task.abortSignal.addEventListener('abort', () => {
        this.cancelInference(handle);
      });
    }

    try {
      const result = await this.executeTask(workerInfo.worker, task);
      handle.status = 'ready';
      workerInfo.abortController = undefined;

      // Process next queued task if any
      this.processNextQueuedTask(handle);

      return result;
    } catch (error) {
      handle.status = 'ready';
      workerInfo.abortController = undefined;
      throw error;
    }
  }

  onProgress(callback: (progress: ProgressUpdate) => void): void {
    this.progressCallbacks.add(callback);
  }

  offProgress(callback: (progress: ProgressUpdate) => void): void {
    this.progressCallbacks.delete(callback);
  }

  async cancelInference(handle: WorkerHandle): Promise<void> {
    const workerInfo = this.workers.get(handle.id);
    if (!workerInfo) {
      return;
    }

    if (workerInfo.abortController) {
      workerInfo.abortController.abort();
    }

    // Send cancel message to worker
    await this.sendWorkerMessage(workerInfo.worker, {
      type: 'cancel'
    });

    handle.status = 'ready';
    workerInfo.abortController = undefined;
  }

  async terminateWorker(handle: WorkerHandle): Promise<void> {
    const workerInfo = this.workers.get(handle.id);
    if (!workerInfo) {
      return;
    }

    handle.status = 'terminated';
    workerInfo.worker.terminate();
    this.workers.delete(handle.id);
  }

  getActiveWorkerCount(): number {
    let count = 0;
    for (const info of this.workers.values()) {
      if (info.handle.status !== 'terminated') {
        count++;
      }
    }
    return count;
  }

  async cleanup(): Promise<void> {
    if (this.idleCheckInterval !== undefined) {
      clearInterval(this.idleCheckInterval);
    }

    const terminatePromises: Promise<void>[] = [];
    for (const info of this.workers.values()) {
      terminatePromises.push(this.terminateWorker(info.handle));
    }

    await Promise.all(terminatePromises);
    this.workers.clear();
    this.taskQueue = [];
    this.progressCallbacks.clear();
  }

  private async executeTask(worker: Worker, task: InferenceTask): Promise<InferenceResult> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const messageHandler = (event: MessageEvent) => {
        const { type, payload } = event.data;

        if (type === 'result') {
          worker.removeEventListener('message', messageHandler);
          const inferenceTimeMs = Date.now() - startTime;
          resolve({
            type: task.type,
            output: payload.output,
            metadata: {
              inferenceTimeMs,
              ...payload.metadata
            }
          });
        } else if (type === 'error') {
          worker.removeEventListener('message', messageHandler);
          reject(new Error(payload.message));
        }
      };

      worker.addEventListener('message', messageHandler);

      worker.postMessage({
        type: 'inference',
        task: {
          input: task.input,
          parameters: task.parameters
        }
      });
    });
  }

  private handleWorkerMessage(workerId: string, message: any): void {
    const { type, payload } = message;

    if (type === 'progress') {
      const progress: ProgressUpdate = {
        workerId,
        phase: payload.phase,
        percentage: payload.percentage,
        message: payload.message
      };

      for (const callback of this.progressCallbacks) {
        callback(progress);
      }
    }
  }

  private async sendWorkerMessage(worker: Worker, message: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const messageHandler = (event: MessageEvent) => {
        const { type } = event.data;
        if (type === 'initialized' || type === 'cancelled') {
          worker.removeEventListener('message', messageHandler);
          resolve();
        } else if (type === 'error') {
          worker.removeEventListener('message', messageHandler);
          reject(new Error(event.data.payload.message));
        }
      };

      worker.addEventListener('message', messageHandler);
      worker.postMessage(message);

      // Timeout after 30 seconds
      setTimeout(() => {
        worker.removeEventListener('message', messageHandler);
        reject(new Error('Worker initialization timeout'));
      }, 30000);
    });
  }

  private processNextQueuedTask(handle: WorkerHandle): void {
    if (this.taskQueue.length === 0) {
      return;
    }

    const { task, resolve, reject } = this.taskQueue.shift()!;
    this.runInference(handle, task).then(resolve).catch(reject);
  }

  private startIdleWorkerCleanup(): void {
    this.idleCheckInterval = window.setInterval(() => {
      this.terminateIdleWorker();
    }, 60000); // Check every minute
  }

  private async terminateIdleWorker(): Promise<boolean> {
    const now = Date.now();
    for (const info of this.workers.values()) {
      if (
        info.handle.status === 'ready' &&
        now - info.lastUsed > InferenceWorkerManager.IDLE_TIMEOUT_MS
      ) {
        await this.terminateWorker(info.handle);
        return true;
      }
    }
    return false;
  }
}
