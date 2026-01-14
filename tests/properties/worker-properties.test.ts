import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { InferenceWorkerManager, type ModelType, type InferenceTask } from '../../src/core/inference-worker-manager';

describe('Worker Properties', () => {
    let workerManager: InferenceWorkerManager;

    beforeEach(() => {
        workerManager = new InferenceWorkerManager();
    });

    afterEach(async () => {
        // Clean up all workers
        await workerManager.cleanup();
    });

    describe('Property 1: Worker Non-Blocking Execution', () => {
        // Feature: multimodal-support, Property 1: Worker Non-Blocking Execution
        // Validates: Requirements 1.3, 2.2, 3.5

        it('should not block the main thread during inference', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.constantFrom<ModelType>('image-generation', 'vision', 'speech-asr', 'speech-tts'),
                    fc.string({ minLength: 1, maxLength: 100 }),
                    async (modelType: ModelType, input: string) => {
                        // Clean up any existing workers first
                        await workerManager.cleanup();

                        // Initialize worker
                        const handle = await workerManager.initializeWorker(modelType);

                        // Create inference task
                        const task: InferenceTask = {
                            type: modelType,
                            input,
                            parameters: {}
                        };

                        // Track if main thread remains responsive
                        let checkCount = 0;

                        // Set up interval to check main thread responsiveness
                        const intervalId = setInterval(() => {
                            checkCount++;
                        }, 5);

                        // Run inference
                        const resultPromise = workerManager.runInference(handle, task);

                        // Wait longer to let inference start and interval run
                        await new Promise(resolve => setTimeout(resolve, 100));

                        // Check that interval has been running (main thread not blocked)
                        const midCheckCount = checkCount;

                        // Wait for inference to complete
                        const result = await resultPromise;

                        // Clean up interval
                        clearInterval(intervalId);

                        // Property: main thread should not have been blocked
                        // If the main thread was blocked, the interval wouldn't have run
                        expect(midCheckCount).toBeGreaterThan(0);

                        // Property: inference should complete successfully
                        expect(result).toBeDefined();
                        expect(result.type).toBe(modelType);
                        expect(result.output).toBeDefined();
                    }
                ),
                { numRuns: 100, timeout: 30000 }
            );
        }, 35000);
    });

    describe('Property 2: Worker Pool Limit', () => {
        // Feature: multimodal-support, Property 2: Worker Pool Limit
        // Validates: Requirements 1.4

        it('should never exceed 2 active workers', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.array(
                        fc.constantFrom<ModelType>('image-generation', 'vision', 'speech-asr', 'speech-tts'),
                        { minLength: 1, maxLength: 10 }
                    ),
                    async (modelTypes: ModelType[]) => {
                        const handles = [];

                        // Try to initialize multiple workers
                        for (const modelType of modelTypes) {
                            try {
                                const handle = await workerManager.initializeWorker(modelType);
                                handles.push(handle);

                                // Property: active worker count should never exceed 2
                                const activeCount = workerManager.getActiveWorkerCount();
                                expect(activeCount).toBeLessThanOrEqual(2);
                            } catch (error) {
                                // If we hit the pool limit, that's expected behavior
                                // Just verify we're at the limit
                                const activeCount = workerManager.getActiveWorkerCount();
                                expect(activeCount).toBeLessThanOrEqual(2);
                            }
                        }

                        // Final check: should never have more than 2 active workers
                        const finalCount = workerManager.getActiveWorkerCount();
                        expect(finalCount).toBeLessThanOrEqual(2);
                    }
                ),
                { numRuns: 100, timeout: 30000 }
            );
        }, 35000);
    });

    describe('Property 3: Worker Cancellation', () => {
        // Feature: multimodal-support, Property 3: Worker Cancellation
        // Validates: Requirements 1.6

        it('should terminate task and free worker when cancelled', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.constantFrom<ModelType>('image-generation', 'vision', 'speech-asr', 'speech-tts'),
                    fc.string({ minLength: 1, maxLength: 100 }),
                    async (modelType: ModelType, input: string) => {
                        // Clean up any existing workers first
                        await workerManager.cleanup();

                        // Initialize worker
                        const handle = await workerManager.initializeWorker(modelType);

                        // Create inference task with abort signal
                        const abortController = new AbortController();
                        const task: InferenceTask = {
                            type: modelType,
                            input,
                            parameters: {},
                            abortSignal: abortController.signal
                        };

                        // Start inference
                        const inferencePromise = workerManager.runInference(handle, task);

                        // Cancel after a short delay
                        await new Promise(resolve => setTimeout(resolve, 20));
                        await workerManager.cancelInference(handle);

                        // Property: worker should be freed (status should be 'ready')
                        expect(handle.status).toBe('ready');

                        // Property: worker should be available for new tasks
                        const newTask: InferenceTask = {
                            type: modelType,
                            input: 'new task',
                            parameters: {}
                        };

                        // Should be able to run a new task immediately
                        const newResult = await workerManager.runInference(handle, newTask);
                        expect(newResult).toBeDefined();
                    }
                ),
                { numRuns: 100, timeout: 30000 }
            );
        }, 35000);
    });
});
