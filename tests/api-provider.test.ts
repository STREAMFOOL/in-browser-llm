/**
 * Unit Tests for API Provider
 * Requirements: 19.1, 19.3, 19.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { APIProvider, API_BACKENDS } from '../src/api-provider';
import { StorageManager } from '../src/storage-manager';

describe('APIProvider', () => {
    let storage: StorageManager;
    let provider: APIProvider;

    beforeEach(async () => {
        storage = new StorageManager();
        provider = new APIProvider(storage);
        await storage.clearAllData();
    });

    afterEach(async () => {
        await provider.dispose();
        await storage.clearAllData();
    });

    describe('API Key Validation', () => {
        /**
         * Test API key validation for OpenAI
         * Requirements: 19.1
         */
        it('should require API key for OpenAI backend', async () => {
            await provider.setBackend('openai');

            const availability = await provider.checkAvailability();
            expect(availability.available).toBe(false);
            expect(availability.reason).toContain('API key not configured');
        });

        /**
         * Test API key validation for Anthropic
         * Requirements: 19.1
         */
        it('should require API key for Anthropic backend', async () => {
            await provider.setBackend('anthropic');

            const availability = await provider.checkAvailability();
            expect(availability.available).toBe(false);
            expect(availability.reason).toContain('API key not configured');
        });

        /**
         * Test that Ollama does not require API key
         * Requirements: 19.1
         */
        it('should not require API key for Ollama backend', async () => {
            await provider.setBackend('ollama');

            const availability = await provider.checkAvailability();
            expect(availability.available).toBe(true);
        });

        /**
         * Test that provider becomes available after setting API key
         */
        it('should become available after setting API key', async () => {
            await provider.setBackend('openai');
            await provider.setApiKey('sk-test-key-12345');

            const availability = await provider.checkAvailability();
            expect(availability.available).toBe(true);
        });
    });

    describe('Privacy Warning Display', () => {
        /**
         * Test privacy warning for OpenAI
         * Requirements: 19.3
         */
        it('should require privacy warning for OpenAI', async () => {
            await provider.setBackend('openai');
            expect(provider.requiresPrivacyWarning()).toBe(true);
        });

        /**
         * Test privacy warning for Anthropic
         * Requirements: 19.3
         */
        it('should require privacy warning for Anthropic', async () => {
            await provider.setBackend('anthropic');
            expect(provider.requiresPrivacyWarning()).toBe(true);
        });

        /**
         * Test no privacy warning for local Ollama
         * Requirements: 19.3, 19.6
         */
        it('should not require privacy warning for local Ollama', async () => {
            await provider.setBackend('ollama');
            await provider.setEndpoint('http://localhost:11434');
            expect(provider.requiresPrivacyWarning()).toBe(false);
        });

        /**
         * Test privacy warning for remote Ollama
         * Requirements: 19.3, 19.6
         */
        it('should require privacy warning for remote Ollama', async () => {
            await provider.setBackend('ollama');
            await provider.setEndpoint('https://remote-ollama.example.com');
            expect(provider.requiresPrivacyWarning()).toBe(true);
        });

        /**
         * Test privacy warning for Ollama with 127.0.0.1
         * Requirements: 19.6
         */
        it('should not require privacy warning for Ollama on 127.0.0.1', async () => {
            await provider.setBackend('ollama');
            await provider.setEndpoint('http://127.0.0.1:11434');
            expect(provider.requiresPrivacyWarning()).toBe(false);
        });
    });

    describe('Streaming Response Parsing', () => {
        /**
         * Test OpenAI SSE parsing
         * Requirements: 19.5
         */
        it('should parse OpenAI Server-Sent Events correctly', async () => {
            // Mock fetch for OpenAI streaming
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                body: {
                    getReader: () => {
                        const encoder = new TextEncoder();
                        const chunks = [
                            'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
                            'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
                            'data: [DONE]\n\n'
                        ];
                        let index = 0;

                        return {
                            read: async () => {
                                if (index < chunks.length) {
                                    return {
                                        done: false,
                                        value: encoder.encode(chunks[index++])
                                    };
                                }
                                return { done: true, value: undefined };
                            },
                            releaseLock: () => { }
                        };
                    }
                }
            } as any);

            await provider.setBackend('openai');
            await provider.setApiKey('sk-test-key');
            await provider.initialize();

            const session = await provider.createSession({
                temperature: 0.7,
                topK: 40
            });

            const chunks: string[] = [];
            for await (const chunk of provider.promptStreaming(session, 'Test prompt')) {
                chunks.push(chunk);
            }

            expect(chunks).toEqual(['Hello', ' world']);
        });

        /**
         * Test Anthropic SSE parsing
         * Requirements: 19.5
         */
        it('should parse Anthropic Server-Sent Events correctly', async () => {
            // Mock fetch for Anthropic streaming
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                body: {
                    getReader: () => {
                        const encoder = new TextEncoder();
                        const chunks = [
                            'data: {"type":"content_block_delta","delta":{"text":"Hello"}}\n\n',
                            'data: {"type":"content_block_delta","delta":{"text":" world"}}\n\n',
                            'data: {"type":"message_stop"}\n\n'
                        ];
                        let index = 0;

                        return {
                            read: async () => {
                                if (index < chunks.length) {
                                    return {
                                        done: false,
                                        value: encoder.encode(chunks[index++])
                                    };
                                }
                                return { done: true, value: undefined };
                            },
                            releaseLock: () => { }
                        };
                    }
                }
            } as any);

            await provider.setBackend('anthropic');
            await provider.setApiKey('sk-ant-test-key');
            await provider.initialize();

            const session = await provider.createSession({
                temperature: 0.7,
                topK: 40
            });

            const chunks: string[] = [];
            for await (const chunk of provider.promptStreaming(session, 'Test prompt')) {
                chunks.push(chunk);
            }

            expect(chunks).toEqual(['Hello', ' world']);
        });

        /**
         * Test Ollama streaming format
         * Requirements: 19.5
         */
        it('should parse Ollama streaming format correctly', async () => {
            // Mock fetch for Ollama streaming
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                body: {
                    getReader: () => {
                        const encoder = new TextEncoder();
                        const chunks = [
                            '{"message":{"content":"Hello"}}\n',
                            '{"message":{"content":" world"}}\n',
                            '{"done":true}\n'
                        ];
                        let index = 0;

                        return {
                            read: async () => {
                                if (index < chunks.length) {
                                    return {
                                        done: false,
                                        value: encoder.encode(chunks[index++])
                                    };
                                }
                                return { done: true, value: undefined };
                            },
                            releaseLock: () => { }
                        };
                    }
                }
            } as any);

            await provider.setBackend('ollama');
            await provider.initialize();

            const session = await provider.createSession({
                temperature: 0.7,
                topK: 40
            });

            const chunks: string[] = [];
            for await (const chunk of provider.promptStreaming(session, 'Test prompt')) {
                chunks.push(chunk);
            }

            expect(chunks).toEqual(['Hello', ' world']);
        });
    });

    describe('Backend Configuration', () => {
        /**
         * Test backend switching
         * Requirements: 19.1
         */
        it('should switch backends correctly', async () => {
            expect(provider.getCurrentBackend()).toBe('openai');

            await provider.setBackend('anthropic');
            expect(provider.getCurrentBackend()).toBe('anthropic');

            await provider.setBackend('ollama');
            expect(provider.getCurrentBackend()).toBe('ollama');
        });

        /**
         * Test model selection
         * Requirements: 19.1
         */
        it('should set model correctly', async () => {
            await provider.setBackend('openai');
            await provider.setModel('gpt-4o');
            expect(provider.getCurrentModelId()).toBe('gpt-4o');
        });

        /**
         * Test invalid model rejection
         */
        it('should reject invalid model for backend', async () => {
            await provider.setBackend('openai');
            await expect(provider.setModel('claude-3-opus-latest')).rejects.toThrow();
        });

        /**
         * Test available backends
         */
        it('should provide list of available backends', () => {
            const backends = APIProvider.getAvailableBackends();
            expect(backends).toHaveProperty('openai');
            expect(backends).toHaveProperty('anthropic');
            expect(backends).toHaveProperty('ollama');
        });

        /**
         * Test backend configuration
         */
        it('should provide backend configuration', () => {
            const openaiConfig = APIProvider.getBackendConfig('openai');
            expect(openaiConfig).toBeDefined();
            expect(openaiConfig?.name).toBe('OpenAI');
            expect(openaiConfig?.requiresApiKey).toBe(true);
        });
    });

    describe('Session Management', () => {
        /**
         * Test session creation
         */
        it('should create session successfully', async () => {
            await provider.setBackend('ollama');
            await provider.initialize();

            const session = await provider.createSession({
                temperature: 0.7,
                topK: 40,
                systemPrompt: 'You are a helpful assistant'
            });

            expect(session).toBeDefined();
            expect(session.id).toBeDefined();
            expect(session.provider).toBe('api');
        });

        /**
         * Test session destruction
         */
        it('should destroy session successfully', async () => {
            await provider.setBackend('ollama');
            await provider.initialize();

            const session = await provider.createSession({
                temperature: 0.7,
                topK: 40
            });

            await expect(provider.destroySession(session)).resolves.not.toThrow();
        });
    });

    describe('Error Handling', () => {
        /**
         * Test initialization without API key
         */
        it('should throw error when initializing OpenAI without API key', async () => {
            await provider.setBackend('openai');
            await expect(provider.initialize()).rejects.toThrow('requires an API key');
        });

        /**
         * Test invalid backend
         */
        it('should throw error for invalid backend', async () => {
            await expect(provider.setBackend('invalid' as any)).rejects.toThrow();
        });
    });
});
