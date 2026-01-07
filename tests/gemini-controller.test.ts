/**
 * Unit tests for Gemini Controller
 * Tests model availability states and UI behavior
 * Requirements: 2.2, 2.3, 2.4, 2.5, 2.6
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GeminiController } from '../src/gemini-controller';

describe('GeminiController - Model Availability States', () => {
    let controller: GeminiController;
    let originalAI: any;

    beforeEach(() => {
        controller = new GeminiController();
        originalAI = (window as any).ai;
    });

    afterEach(() => {
        // Restore original window.ai
        (window as any).ai = originalAI;
    });

    /**
     * Test "readily" state
     * Requirements: 2.2, 2.4
     */
    it('should return "readily" status when model is immediately available', async () => {
        // Mock window.ai with readily available model
        (window as any).ai = {
            languageModel: {
                capabilities: async () => ({ available: 'readily' })
            }
        };

        const availability = await controller.checkAvailability();

        expect(availability.status).toBe('readily');
        expect(availability.downloadProgress).toBeUndefined();
    });

    /**
     * Test "after-download" state
     * Requirements: 2.2, 2.3, 2.5
     */
    it('should return "after-download" status when model needs downloading', async () => {
        // Mock window.ai with model requiring download
        (window as any).ai = {
            languageModel: {
                capabilities: async () => ({ available: 'after-download' })
            }
        };

        const availability = await controller.checkAvailability();

        expect(availability.status).toBe('after-download');
        // Note: Progress tracking would be implemented in UI layer with monitor callback
    });

    /**
     * Test "no" state
     * Requirements: 2.3, 2.6
     */
    it('should return "no" status when model is unavailable', async () => {
        // Mock window.ai with unavailable model
        (window as any).ai = {
            languageModel: {
                capabilities: async () => ({ available: 'no' })
            }
        };

        const availability = await controller.checkAvailability();

        expect(availability.status).toBe('no');
    });

    /**
     * Test missing API
     * Requirements: 2.3
     */
    it('should return "no" status when Prompt API is not available', async () => {
        // Remove window.ai
        delete (window as any).ai;

        const availability = await controller.checkAvailability();

        expect(availability.status).toBe('no');
    });

    /**
     * Test error handling during capability check
     * Requirements: 2.3
     */
    it('should return "no" status when capabilities check throws error', async () => {
        // Mock window.ai with error-throwing capabilities
        (window as any).ai = {
            languageModel: {
                capabilities: async () => {
                    throw new Error('Network error');
                }
            }
        };

        const availability = await controller.checkAvailability();

        expect(availability.status).toBe('no');
    });

    /**
     * Test session creation with "readily" status
     * Requirements: 2.4
     */
    it('should successfully create session when model is readily available', async () => {
        // Mock window.ai with readily available model
        const mockSession = {
            prompt: async () => 'response',
            promptStreaming: () => new ReadableStream(),
            destroy: () => { },
            clone: async () => mockSession
        };

        (window as any).ai = {
            languageModel: {
                capabilities: async () => ({ available: 'readily' }),
                create: async () => mockSession
            }
        };

        const session = await controller.createSession({
            temperature: 0.8,
            topK: 50
        });

        expect(session).toBeDefined();
        expect(typeof session.prompt).toBe('function');
        expect(typeof session.promptStreaming).toBe('function');
        expect(typeof session.destroy).toBe('function');
    });

    /**
     * Test session creation failure
     * Requirements: 2.4
     */
    it('should throw error when session creation fails', async () => {
        // Mock window.ai with failing create
        (window as any).ai = {
            languageModel: {
                capabilities: async () => ({ available: 'readily' }),
                create: async () => {
                    throw new Error('Insufficient memory');
                }
            }
        };

        await expect(controller.createSession()).rejects.toThrow('Failed to create Gemini session');
    });

    /**
     * Test session creation without API
     * Requirements: 2.4
     */
    it('should throw error when creating session without Prompt API', async () => {
        delete (window as any).ai;

        await expect(controller.createSession()).rejects.toThrow('Prompt API not available');
    });

    /**
     * Test streaming response
     * Requirements: 3.2
     */
    it('should stream response chunks correctly', async () => {
        const mockChunks = ['Hello', ' ', 'world', '!'];
        const mockStream = new ReadableStream({
            start(controller) {
                mockChunks.forEach(chunk => controller.enqueue(chunk));
                controller.close();
            }
        });

        const mockSession = {
            prompt: async () => 'response',
            promptStreaming: () => mockStream,
            destroy: () => { },
            clone: async () => mockSession
        };

        (window as any).ai = {
            languageModel: {
                capabilities: async () => ({ available: 'readily' }),
                create: async () => mockSession
            }
        };

        const session = await controller.createSession();
        const chunks: string[] = [];

        for await (const chunk of controller.promptStreaming(session, 'test prompt')) {
            chunks.push(chunk);
        }

        expect(chunks).toEqual(mockChunks);
    });

    /**
     * Test session destruction
     * Requirements: 3.5
     */
    it('should safely destroy sessions', async () => {
        let destroyCalled = false;
        const mockSession = {
            prompt: async () => 'response',
            promptStreaming: () => new ReadableStream(),
            destroy: () => { destroyCalled = true; },
            clone: async () => mockSession
        };

        (window as any).ai = {
            languageModel: {
                capabilities: async () => ({ available: 'readily' }),
                create: async () => mockSession
            }
        };

        const session = await controller.createSession();
        await controller.destroySession(session);

        expect(destroyCalled).toBe(true);
    });

    /**
     * Test session cloning
     * Requirements: 3.5
     */
    it('should clone sessions for branching conversations', async () => {
        const mockSession = {
            prompt: async () => 'response',
            promptStreaming: () => new ReadableStream(),
            destroy: () => { },
            clone: async () => ({
                prompt: async () => 'cloned response',
                promptStreaming: () => new ReadableStream(),
                destroy: () => { },
                clone: async () => mockSession
            })
        };

        (window as any).ai = {
            languageModel: {
                capabilities: async () => ({ available: 'readily' }),
                create: async () => mockSession
            }
        };

        const session = await controller.createSession();
        const clonedSession = await controller.cloneSession(session);

        expect(clonedSession).toBeDefined();
        expect(typeof clonedSession.prompt).toBe('function');
    });

    /**
     * Test default configuration values
     * Requirements: 3.1
     */
    it('should use default temperature and topK when not specified', async () => {
        let capturedOptions: any = null;

        (window as any).ai = {
            languageModel: {
                capabilities: async () => ({ available: 'readily' }),
                create: async (options: any) => {
                    capturedOptions = options;
                    return {
                        prompt: async () => 'response',
                        promptStreaming: () => new ReadableStream(),
                        destroy: () => { },
                        clone: async () => ({})
                    };
                }
            }
        };

        await controller.createSession();

        expect(capturedOptions).toBeDefined();
        expect(capturedOptions.temperature).toBe(0.7);
        expect(capturedOptions.topK).toBe(40);
    });

    /**
     * Test custom configuration values
     * Requirements: 3.1
     */
    it('should use provided temperature and topK values', async () => {
        let capturedOptions: any = null;

        (window as any).ai = {
            languageModel: {
                capabilities: async () => ({ available: 'readily' }),
                create: async (options: any) => {
                    capturedOptions = options;
                    return {
                        prompt: async () => 'response',
                        promptStreaming: () => new ReadableStream(),
                        destroy: () => { },
                        clone: async () => ({})
                    };
                }
            }
        };

        await controller.createSession({
            temperature: 0.9,
            topK: 100,
            systemPrompt: 'You are a helpful assistant'
        });

        expect(capturedOptions.temperature).toBe(0.9);
        expect(capturedOptions.topK).toBe(100);
        expect(capturedOptions.systemPrompt).toBe('You are a helpful assistant');
    });
});
