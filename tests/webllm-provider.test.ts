/**
 * Unit tests for WebLLMProvider
 * Tests WebGPU detection, model selection, and download progress reporting
 * Requirements: 18.2, 18.5, 18.8
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    WebLLMProvider,
    WEBLLM_MODELS,
    DEFAULT_WEBLLM_MODEL
} from '../src/webllm-provider';

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

            const generator = provider.promptStreaming(mockSession, 'test prompt');

            await expect(generator.next()).rejects.toThrow('not initialized');
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

describe('DEFAULT_WEBLLM_MODEL', () => {
    it('should be a valid model ID', () => {
        const validIds = WEBLLM_MODELS.map(m => m.id);

        expect(validIds).toContain(DEFAULT_WEBLLM_MODEL);
    });

    it('should be a smaller model for faster initial experience', () => {
        const defaultModel = WEBLLM_MODELS.find(m => m.id === DEFAULT_WEBLLM_MODEL);

        expect(defaultModel).toBeDefined();
        // Default should be a smaller model (< 3GB VRAM)
        expect(defaultModel!.estimatedVRAM).toBeLessThanOrEqual(3);
    });
});
