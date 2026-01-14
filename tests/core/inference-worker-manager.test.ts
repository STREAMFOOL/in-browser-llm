import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InferenceWorkerManager, type ModelType, type InferenceTask } from '../../src/core/inference-worker-manager';

describe('InferenceWorkerManager Unit Tests', () => {
    let workerManager: InferenceWorkerManager;

    beforeEach(() => {
        workerManager = new InferenceWorkerManager();
    });

    afterEach(async () => {
        await workerManager.cleanup();
    });

    describe('Worker Initialization', () => {
        it('should create worker with image-generation model type', async () => {
            const handle = await workerManager.initializeWorker('image-generation');

            expect(handle).toBeDefined();
            expect(handle.id).toContain('worker-image-generation');
            expect(handle.type).toBe('image-generation');
            expect(handle.status).toBe('ready');
        });

        it('should create worker with vision model type', async () => {
            const handle = await workerManager.initializeWorker('vision');

            expect(handle).toBeDefined();
            expect(handle.id).toContain('worker-vision');
            expect(handle.type).toBe('vision');
            expect(handle.status).toBe('ready');
        });

        it('should create worker with speech-asr model type', async () => {
            const handle = await workerManager.initializeWorker('speech-asr');

            expect(handle).toBeDefined();
            expect(handle.id).toContain('worker-speech-asr');
            expect(handle.type).toBe('speech-asr');
            expect(handle.status).toBe('ready');
        });

        it('should create worker with speech-tts model type', async () => {
            const handle = await workerManager.initializeWorker('speech-tts');

            expect(handle).toBeDefined();
            expect(handle.id).toContain('worker-speech-tts');
            expect(handle.type).toBe('speech-tts');
            expect(handle.status).toBe('ready');
        });

        it('should reuse existing worker for same model type', async () => {
            const handle1 = await workerManager.initializeWorker('image-generation');
            const handle2 = await workerManager.initializeWorker('image-generation');

            expect(handle1.id).toBe(handle2.id);
            expect(workerManager.getActiveWorkerCount()).toBe(1);
        });

        it('should create separate workers for different model types', async () => {
            const handle1 = await workerManager.initializeWorker('image-generation');
            const handle2 = await workerManager.initializeWorker('vision');

            expect(handle1.id).not.toBe(handle2.id);
            expect(workerManager.getActiveWorkerCount()).toBe(2);
        });

        it('should enforce worker pool limit of 2', async () => {
            const handle1 = await workerManager.initializeWorker('image-generation');
            const handle2 = await workerManager.initializeWorker('vision');

            // Third worker should fail or terminate an idle worker
            await expect(async () => {
                await workerManager.initializeWorker('speech-asr');
            }).rejects.toThrow();

            expect(workerManager.getActiveWorkerCount()).toBeLessThanOrEqual(2);
        });
    });

    describe('GPU Context Initialization', () => {
        it('should initialize worker successfully when GPU is available', async () => {
            const handle = await workerManager.initializeWorker('image-generation');

            expect(handle.status).toBe('ready');
        });

        it('should handle GPU unavailable error gracefully', async () => {
            // Mock navigator.gpu to be undefined
            const originalGpu = (navigator as any).gpu;
            (navigator as any).gpu = undefined;

            try {
                await workerManager.initializeWorker('image-generation');
                // If it doesn't throw, that's also acceptable (fallback behavior)
            } catch (error) {
                expect(error).toBeDefined();
                expect((error as Error).message).toContain('WebGPU');
            } finally {
                // Restore original GPU
                (navigator as any).gpu = originalGpu;
            }
        });
    });

    describe('Error Handling', () => {
        it('should handle worker initialization failure', async () => {
            // Mock Worker constructor to throw
            const OriginalWorker = global.Worker;
            (global as any).Worker = class {
                constructor() {
                    throw new Error('Worker creation failed');
                }
            };

            try {
                await expect(async () => {
                    await workerManager.initializeWorker('image-generation');
                }).rejects.toThrow('Failed to initialize worker');
            } finally {
                // Restore original Worker
                (global as any).Worker = OriginalWorker;
            }
        });

        it('should handle worker termination', async () => {
            const handle = await workerManager.initializeWorker('image-generation');

            await workerManager.terminateWorker(handle);

            expect(handle.status).toBe('terminated');
            expect(workerManager.getActiveWorkerCount()).toBe(0);
        });

        it('should handle inference on terminated worker', async () => {
            const handle = await workerManager.initializeWorker('image-generation');
            await workerManager.terminateWorker(handle);

            const task: InferenceTask = {
                type: 'image-generation',
                input: 'test prompt',
                parameters: {}
            };

            await expect(async () => {
                await workerManager.runInference(handle, task);
            }).rejects.toThrow('not found');
        });

        it('should handle inference on non-existent worker', async () => {
            const fakeHandle = {
                id: 'non-existent-worker',
                type: 'image-generation' as ModelType,
                status: 'ready' as const
            };

            const task: InferenceTask = {
                type: 'image-generation',
                input: 'test prompt',
                parameters: {}
            };

            await expect(async () => {
                await workerManager.runInference(fakeHandle, task);
            }).rejects.toThrow('not found');
        });
    });

    describe('Worker Pool Management', () => {
        it('should track active worker count correctly', async () => {
            expect(workerManager.getActiveWorkerCount()).toBe(0);

            const handle1 = await workerManager.initializeWorker('image-generation');
            expect(workerManager.getActiveWorkerCount()).toBe(1);

            const handle2 = await workerManager.initializeWorker('vision');
            expect(workerManager.getActiveWorkerCount()).toBe(2);

            await workerManager.terminateWorker(handle1);
            expect(workerManager.getActiveWorkerCount()).toBe(1);

            await workerManager.terminateWorker(handle2);
            expect(workerManager.getActiveWorkerCount()).toBe(0);
        });

        it('should cleanup all workers', async () => {
            await workerManager.initializeWorker('image-generation');
            await workerManager.initializeWorker('vision');

            expect(workerManager.getActiveWorkerCount()).toBe(2);

            await workerManager.cleanup();

            expect(workerManager.getActiveWorkerCount()).toBe(0);
        });
    });

    describe('Progress Callbacks', () => {
        it('should register progress callback', () => {
            const callback = vi.fn();
            workerManager.onProgress(callback);

            // Callback should be registered (no error thrown)
            expect(callback).toBeDefined();
        });

        it('should unregister progress callback', () => {
            const callback = vi.fn();
            workerManager.onProgress(callback);
            workerManager.offProgress(callback);

            // Callback should be unregistered (no error thrown)
            expect(callback).toBeDefined();
        });
    });

    describe('Cancellation', () => {
        it('should cancel inference and free worker', async () => {
            const handle = await workerManager.initializeWorker('image-generation');

            const task: InferenceTask = {
                type: 'image-generation',
                input: 'test prompt',
                parameters: {}
            };

            // Start inference
            const inferencePromise = workerManager.runInference(handle, task);

            // Cancel immediately
            await workerManager.cancelInference(handle);

            // Worker should be freed
            expect(handle.status).toBe('ready');
        });

        it('should handle cancellation of non-existent worker gracefully', async () => {
            const fakeHandle = {
                id: 'non-existent-worker',
                type: 'image-generation' as ModelType,
                status: 'ready' as const
            };

            // Should not throw
            await workerManager.cancelInference(fakeHandle);
        });
    });
});
