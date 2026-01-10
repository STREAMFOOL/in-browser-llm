

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    WebLLMProvider,
    WEBLLM_MODELS,
    DEFAULT_WEBLLM_MODEL
} from '../../src/providers/webllm-provider';

describe('WebLLMProvider', () => {
    let provider: WebLLMProvider;

    beforeEach(() => {
        provider = new WebLLMProvider();
    });

    afterEach(async () => {
        await provider.dispose();
    });

    describe('Provider identification', () => {
        it('should have correct name', () => {
            expect(provider.name).toBe('webllm');
        });

        it('should be a local provider type', () => {
            expect(provider.type).toBe('local');
        });

        it('should have a description', () => {
            expect(provider.description).toBeTruthy();
            expect(provider.description.length).toBeGreaterThan(0);
        });
    });

    describe('Model selection', () => {
        it('should default to Qwen 2.5 Coder 7B', () => {
            expect(DEFAULT_WEBLLM_MODEL).toBe('Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC');
        });

        it('should return current model ID', () => {
            const modelId = provider.getCurrentModelId();
            expect(modelId).toBe(DEFAULT_WEBLLM_MODEL);
        });

        it('should allow setting a valid model', async () => {
            const newModel = WEBLLM_MODELS[4].id; // Llama 3.2 1B
            await provider.setModel(newModel);
            expect(provider.getCurrentModelId()).toBe(newModel);
        });

        it('should reject invalid model ID', async () => {
            await expect(provider.setModel('invalid-model-id')).rejects.toThrow('Invalid model ID');
        });

        it('should accept model ID in initialize config', async () => {
            const testModel = WEBLLM_MODELS[4].id; // Llama 3.2 1B (smallest for tests)

            // Mock WebGPU for this test
            const mockAdapter = {
                limits: { maxBufferSize: 2 * 1024 * 1024 * 1024 } // 2GB
            };

            vi.stubGlobal('navigator', {
                gpu: {
                    requestAdapter: vi.fn().mockResolvedValue(mockAdapter)
                }
            });

            const newProvider = new WebLLMProvider();

            // Check availability first
            const availability = await newProvider.checkAvailability();

            if (availability.available) {
                // Only test initialization if WebGPU is available
                // In CI/test environment, this will be skipped
                await newProvider.initialize({ modelId: testModel });
                expect(newProvider.getCurrentModelId()).toBe(testModel);
            }

            await newProvider.dispose();
            vi.unstubAllGlobals();
        });

        it('should list all available models', () => {
            const models = WebLLMProvider.getAvailableModels();
            expect(models).toHaveLength(5);
            expect(models[0].id).toBe('Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC');
            expect(models[4].id).toBe('Llama-3.2-1B-Instruct-q4f16_1-MLC');
        });

        it('should get model info by ID', () => {
            const modelInfo = WebLLMProvider.getModelInfo('Llama-3.2-1B-Instruct-q4f16_1-MLC');
            expect(modelInfo).toBeDefined();
            expect(modelInfo?.name).toBe('Llama 3.2 1B');
            expect(modelInfo?.estimatedVRAM).toBe(1.5);
        });

        it('should return undefined for invalid model ID', () => {
            const modelInfo = WebLLMProvider.getModelInfo('invalid-model');
            expect(modelInfo).toBeUndefined();
        });
    });

    describe('WebGPU detection (Requirement 18.2)', () => {
        it('should report unavailable when navigator.gpu is missing', async () => {
            // In jsdom, navigator.gpu is not available
            const availability = await provider.checkAvailability();

            expect(availability.available).toBe(false);
            expect(availability.reason).toContain('WebGPU');
        });

        it('should include reason when unavailable', async () => {
            const availability = await provider.checkAvailability();

            if (!availability.available) {
                expect(availability.reason).toBeDefined();
                expect(typeof availability.reason).toBe('string');
            }
        });
    });


    describe('Model selection (Requirement 18.5)', () => {
        it('should have default model set', () => {
            expect(provider.getCurrentModelId()).toBe(DEFAULT_WEBLLM_MODEL);
        });

        it('should list available models', () => {
            const models = WebLLMProvider.getAvailableModels();

            expect(models.length).toBeGreaterThan(0);
            expect(models).toEqual(WEBLLM_MODELS);
        });

        it('should include Llama model option', () => {
            const models = WebLLMProvider.getAvailableModels();
            const llamaModel = models.find(m => m.name.toLowerCase().includes('llama'));

            expect(llamaModel).toBeDefined();
        });

        it('should include Mistral model option', () => {
            const models = WebLLMProvider.getAvailableModels();
            const mistralModel = models.find(m => m.name.toLowerCase().includes('mistral'));

            expect(mistralModel).toBeDefined();
        });

        it('should include Phi model option', () => {
            const models = WebLLMProvider.getAvailableModels();
            const phiModel = models.find(m => m.name.toLowerCase().includes('phi'));

            expect(phiModel).toBeDefined();
        });

        it('should get model info by ID', () => {
            const modelId = WEBLLM_MODELS[0].id;
            const info = WebLLMProvider.getModelInfo(modelId);

            expect(info).toBeDefined();
            expect(info!.id).toBe(modelId);
        });

        it('should return undefined for invalid model ID', () => {
            const info = WebLLMProvider.getModelInfo('invalid-model-id');

            expect(info).toBeUndefined();
        });
    });

    describe('VRAM requirements display (Requirement 18.8)', () => {
        it('should include estimated VRAM for each model', () => {
            const models = WebLLMProvider.getAvailableModels();

            for (const model of models) {
                expect(model.estimatedVRAM).toBeDefined();
                expect(typeof model.estimatedVRAM).toBe('number');
                expect(model.estimatedVRAM).toBeGreaterThan(0);
            }
        });

        it('should include context length for each model', () => {
            const models = WebLLMProvider.getAvailableModels();

            for (const model of models) {
                expect(model.contextLength).toBeDefined();
                expect(typeof model.contextLength).toBe('number');
                expect(model.contextLength).toBeGreaterThan(0);
            }
        });

        it('should have human-readable model names', () => {
            const models = WebLLMProvider.getAvailableModels();

            for (const model of models) {
                expect(model.name).toBeDefined();
                expect(model.name.length).toBeGreaterThan(0);
                // Name should not be the raw model ID
                expect(model.name).not.toBe(model.id);
            }
        });

        it('should have descriptions for each model', () => {
            const models = WebLLMProvider.getAvailableModels();

            for (const model of models) {
                expect(model.description).toBeDefined();
                expect(model.description.length).toBeGreaterThan(0);
            }
        });
    });


    describe('Progress reporting', () => {
        it('should return null progress before initialization', () => {
            const progress = provider.getProgress();

            expect(progress).toBeNull();
        });
    });

    describe('Session management', () => {
        it('should throw error when creating session without initialization', async () => {
            await expect(
                provider.createSession({ temperature: 0.7, topK: 40 })
            ).rejects.toThrow('not initialized');
        });
    });

    describe('Streaming', () => {
        it('should throw error when streaming without initialization', async () => {
            const mockSession = {
                id: 'test-session',
                provider: 'webllm',
                config: { temperature: 0.7, topK: 40 }
            };

            const iterable = provider.promptStreaming(mockSession, 'test prompt');
            const iterator = iterable[Symbol.asyncIterator]();

            await expect(iterator.next()).rejects.toThrow('not initialized');
        });
    });

    describe('Dispose', () => {
        it('should reset state on dispose', async () => {
            await provider.dispose();

            // After dispose, progress should be null
            expect(provider.getProgress()).toBeNull();

            // Should be able to check availability again
            const availability = await provider.checkAvailability();
            expect(typeof availability.available).toBe('boolean');
        });

        it('should be safe to call dispose multiple times', async () => {
            await provider.dispose();
            await provider.dispose();
            await provider.dispose();

            // Should not throw
            expect(provider.getProgress()).toBeNull();
        });
    });
});

describe('WEBLLM_MODELS constant', () => {
    it('should have at least 3 model options', () => {
        expect(WEBLLM_MODELS.length).toBeGreaterThanOrEqual(3);
    });

    it('should have unique model IDs', () => {
        const ids = WEBLLM_MODELS.map(m => m.id);
        const uniqueIds = new Set(ids);

        expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have valid MLC model ID format', () => {
        for (const model of WEBLLM_MODELS) {
            // MLC model IDs typically end with -MLC
            expect(model.id).toMatch(/-MLC$/);
        }
    });
});
