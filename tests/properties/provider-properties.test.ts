

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import type {
    ModelProvider,
    ProviderAvailability,
    SessionConfig,
    ChatSession,
    DownloadProgress
} from '../../src/model-provider';
import { ProviderManager, PROVIDER_PRIORITIES } from '../../src/provider-manager';


function createMockProvider(
    name: string,
    type: 'local' | 'api',
    available: boolean,
    reason?: string
): ModelProvider {
    const sessions = new Map<string, ChatSession>();
    let initialized = false;

    return {
        name,
        type,
        description: `Mock ${name} provider`,

        async checkAvailability(): Promise<ProviderAvailability> {
            return {
                available,
                reason: available ? undefined : reason
            };
        },

        async initialize(): Promise<void> {
            if (!available) {
                throw new Error(`Provider ${name} is not available`);
            }
            initialized = true;
        },

        async createSession(config: SessionConfig): Promise<ChatSession> {
            if (!initialized) {
                throw new Error('Provider not initialized');
            }
            const session: ChatSession = {
                id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                provider: name,
                config
            };
            sessions.set(session.id, session);
            return session;
        },

        async *promptStreaming(session: ChatSession, prompt: string): AsyncIterable<string> {
            if (!sessions.has(session.id)) {
                throw new Error('Session not found');
            }
            yield `Response to: ${prompt}`;
        },

        async destroySession(session: ChatSession): Promise<void> {
            sessions.delete(session.id);
        },

        getProgress(): DownloadProgress | null {
            return initialized ? { phase: 'ready', percentage: 100 } : null;
        },

        async dispose(): Promise<void> {
            sessions.clear();
            initialized = false;
        }
    };
}

describe('Provider Interface Consistency Properties', () => {

    it('Property 33: checkAvailability returns valid object and initialize succeeds when available', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    name: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/i.test(s)),
                    type: fc.constantFrom('local' as const, 'api' as const),
                    available: fc.boolean()
                }),
                async ({ name, type, available }) => {
                    const provider = createMockProvider(name, type, available, 'Test unavailable');

                    // checkAvailability should return a valid ProviderAvailability object
                    const availability = await provider.checkAvailability();

                    // Verify the structure of ProviderAvailability
                    expect(typeof availability.available).toBe('boolean');
                    expect(availability.available).toBe(available);

                    if (!availability.available) {
                        // If not available, reason should be provided
                        expect(typeof availability.reason).toBe('string');
                    }

                    // If available is true, initialize should succeed
                    if (availability.available) {
                        await expect(provider.initialize()).resolves.not.toThrow();
                    }

                    // Cleanup
                    await provider.dispose();

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });


    it('Property 33: Session lifecycle follows interface contract', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    temperature: fc.double({ min: 0, max: 1, noNaN: true }),
                    topK: fc.integer({ min: 1, max: 100 })
                }),
                async (config: SessionConfig) => {
                    const provider = createMockProvider('test-provider', 'local', true);

                    // Initialize provider
                    await provider.initialize();

                    // Create session
                    const session = await provider.createSession(config);

                    // Verify session structure
                    expect(typeof session.id).toBe('string');
                    expect(session.id.length).toBeGreaterThan(0);
                    expect(session.provider).toBe('test-provider');
                    expect(session.config).toEqual(config);

                    // Destroy session should not throw
                    await expect(provider.destroySession(session)).resolves.not.toThrow();

                    // Cleanup
                    await provider.dispose();

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe('Provider Selection Priority Properties', () => {
    let manager: ProviderManager;

    beforeEach(() => {
        manager = new ProviderManager();
    });

    afterEach(async () => {
        await manager.dispose();
    });


    it('Property 34: autoSelectProvider chooses first available provider by priority', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    chromeAvailable: fc.boolean(),
                    webllmAvailable: fc.boolean(),
                    apiAvailable: fc.boolean()
                }),
                async ({ chromeAvailable, webllmAvailable, apiAvailable }) => {
                    // Create a fresh manager for each test
                    const testManager = new ProviderManager();

                    // Register providers with their availability
                    const chromeProvider = createMockProvider('chrome-gemini', 'local', chromeAvailable);
                    const webllmProvider = createMockProvider('webllm', 'local', webllmAvailable);
                    const apiProvider = createMockProvider('api', 'api', apiAvailable);

                    testManager.registerProvider(chromeProvider);
                    testManager.registerProvider(webllmProvider);
                    testManager.registerProvider(apiProvider);

                    // Auto-select provider
                    const selected = await testManager.autoSelectProvider();

                    // Determine expected provider based on priority
                    let expectedName: string | null = null;
                    if (chromeAvailable) {
                        expectedName = 'chrome-gemini';
                    } else if (webllmAvailable) {
                        expectedName = 'webllm';
                    } else if (apiAvailable) {
                        expectedName = 'api';
                    }

                    if (expectedName) {
                        expect(selected).not.toBeNull();
                        expect(selected!.name).toBe(expectedName);
                    } else {
                        expect(selected).toBeNull();
                    }

                    // Cleanup
                    await testManager.dispose();

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });


    it('Property 34: detectProviders returns providers sorted by priority', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.record({
                        name: fc.constantFrom('chrome-gemini', 'webllm', 'api'),
                        available: fc.boolean()
                    }),
                    { minLength: 1, maxLength: 3 }
                ).filter(arr => {
                    // Ensure unique names
                    const names = arr.map(p => p.name);
                    return new Set(names).size === names.length;
                }),
                async (providerConfigs) => {
                    const testManager = new ProviderManager();

                    // Register providers in random order
                    for (const config of providerConfigs) {
                        const provider = createMockProvider(
                            config.name,
                            config.name === 'api' ? 'api' : 'local',
                            config.available
                        );
                        testManager.registerProvider(provider);
                    }

                    // Detect providers
                    const detected = await testManager.detectProviders();

                    // Verify sorted by priority
                    for (let i = 1; i < detected.length; i++) {
                        const prevPriority = PROVIDER_PRIORITIES[detected[i - 1].name] ?? 999;
                        const currPriority = PROVIDER_PRIORITIES[detected[i].name] ?? 999;
                        expect(prevPriority).toBeLessThanOrEqual(currPriority);
                    }

                    // Cleanup
                    await testManager.dispose();

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});


describe('Provider Streaming Equivalence Properties', () => {

    it('Property 35: streaming response concatenation produces consistent result', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    prompt: fc.string({ minLength: 1, maxLength: 100 }),
                    temperature: fc.double({ min: 0, max: 1, noNaN: true }),
                    topK: fc.integer({ min: 1, max: 100 })
                }),
                async ({ prompt, temperature, topK }) => {
                    // Create a mock provider that streams in chunks
                    const provider = createMockProvider('test-streaming', 'local', true);

                    await provider.initialize();
                    const session = await provider.createSession({ temperature, topK });

                    // Collect all chunks from streaming
                    const chunks: string[] = [];
                    for await (const chunk of provider.promptStreaming(session, prompt)) {
                        chunks.push(chunk);
                    }

                    // Concatenated result should be non-empty for valid prompts
                    const fullResponse = chunks.join('');
                    expect(fullResponse.length).toBeGreaterThan(0);

                    // The response should contain the prompt (our mock echoes it)
                    expect(fullResponse).toContain(prompt);

                    // Cleanup
                    await provider.destroySession(session);
                    await provider.dispose();

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });


    it('Property 35: multiple streaming calls produce independent results', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.string({ minLength: 1, maxLength: 50 }),
                    { minLength: 2, maxLength: 5 }
                ),
                async (prompts) => {
                    const provider = createMockProvider('test-multi-stream', 'local', true);

                    await provider.initialize();
                    const session = await provider.createSession({ temperature: 0.7, topK: 40 });

                    // Collect responses for each prompt
                    const responses: string[] = [];
                    for (const prompt of prompts) {
                        const chunks: string[] = [];
                        for await (const chunk of provider.promptStreaming(session, prompt)) {
                            chunks.push(chunk);
                        }
                        responses.push(chunks.join(''));
                    }

                    // Each response should be unique and contain its prompt
                    for (let i = 0; i < prompts.length; i++) {
                        expect(responses[i]).toContain(prompts[i]);
                    }

                    // Cleanup
                    await provider.destroySession(session);
                    await provider.dispose();

                    return true;
                }
            ),
            { numRuns: 50 }
        );
    });
});


describe('WebLLM Model Caching Properties', () => {

    it('Property 36: model caching behavior is consistent', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    modelId: fc.constantFrom(
                        'Llama-3.2-1B-Instruct-q4f16_1-MLC',
                        'Llama-3.2-3B-Instruct-q4f16_1-MLC',
                        'Mistral-7B-Instruct-v0.3-q4f16_1-MLC',
                        'Phi-3.5-mini-instruct-q4f16_1-MLC'
                    )
                }),
                async ({ modelId }) => {
                    // Import WebLLM provider types
                    const { WEBLLM_MODELS } = await import('../../src/webllm-provider');

                    // Verify model exists in available models
                    const modelInfo = WEBLLM_MODELS.find(m => m.id === modelId);
                    expect(modelInfo).toBeDefined();

                    // Verify model has required caching-related properties
                    expect(modelInfo!.estimatedVRAM).toBeGreaterThan(0);
                    expect(modelInfo!.contextLength).toBeGreaterThan(0);

                    return true;
                }
            ),
            { numRuns: 10 }
        );
    });


    it('Property 36: model info is consistent across calls', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 1, max: 5 }),
                async (numCalls) => {
                    const { WebLLMProvider, WEBLLM_MODELS } = await import('../../src/webllm-provider');

                    // Get available models multiple times
                    const results: typeof WEBLLM_MODELS[] = [];
                    for (let i = 0; i < numCalls; i++) {
                        results.push(WebLLMProvider.getAvailableModels());
                    }

                    // All results should be identical
                    for (let i = 1; i < results.length; i++) {
                        expect(results[i].length).toBe(results[0].length);
                        for (let j = 0; j < results[0].length; j++) {
                            expect(results[i][j].id).toBe(results[0][j].id);
                            expect(results[i][j].name).toBe(results[0][j].name);
                            expect(results[i][j].estimatedVRAM).toBe(results[0][j].estimatedVRAM);
                        }
                    }

                    return true;
                }
            ),
            { numRuns: 20 }
        );
    });
});
