/**
 * Property-Based Tests for Stream Cancellation
 * Feature: local-ai-assistant, Property 31: Stream Cancellation
 * Validates: Requirements 14.4, 14.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { GeminiController, AISession } from '../../src/gemini-controller';

describe('Stream Cancellation Properties', () => {
    let controller: GeminiController;

    beforeEach(() => {
        controller = new GeminiController();
    });

    // Feature: local-ai-assistant, Property 31: Stream Cancellation
    // For any active streaming response, sending a new message should cancel the current stream
    // and call the appropriate abort method
    it('should cancel stream when abort signal is triggered', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 3, maxLength: 10 }),
                async (chunks) => {
                    // Create a mock session that streams chunks
                    const mockSession: AISession = {
                        prompt: vi.fn(),
                        promptStreaming: vi.fn().mockReturnValue({
                            getReader: () => {
                                let index = 0;
                                let cancelled = false;

                                return {
                                    read: async () => {
                                        if (cancelled || index >= chunks.length) {
                                            return { done: true, value: undefined };
                                        }
                                        return { done: false, value: chunks[index++] };
                                    },
                                    releaseLock: vi.fn(),
                                    cancel: vi.fn(() => {
                                        cancelled = true;
                                    })
                                };
                            }
                        }),
                        destroy: vi.fn(),
                        clone: vi.fn()
                    };

                    // Create abort controller
                    const abortController = new AbortController();

                    // Start streaming
                    const stream = controller.promptStreaming(
                        mockSession,
                        'test prompt',
                        abortController.signal
                    );

                    let receivedChunks = 0;
                    let caughtError = false;

                    try {
                        for await (const chunk of stream) {
                            receivedChunks++;

                            // Cancel after receiving some chunks (but not all)
                            if (receivedChunks >= Math.min(2, chunks.length - 1)) {
                                abortController.abort();
                            }
                        }
                    } catch (error) {
                        if (error instanceof Error && error.message === 'Stream cancelled') {
                            caughtError = true;
                        }
                    }

                    // Should have caught the cancellation error
                    expect(caughtError).toBe(true);

                    // Should have received some chunks but not all
                    expect(receivedChunks).toBeGreaterThan(0);
                    expect(receivedChunks).toBeLessThan(chunks.length);
                }
            ),
            { numRuns: 100 }
        );
    });

    // Property: Cancelling before any chunks should prevent all chunks
    it('should prevent all chunks when cancelled immediately', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 10 }),
                async (chunks) => {
                    const mockSession: AISession = {
                        prompt: vi.fn(),
                        promptStreaming: vi.fn().mockReturnValue({
                            getReader: () => {
                                let index = 0;
                                let cancelled = false;

                                return {
                                    read: async () => {
                                        if (cancelled || index >= chunks.length) {
                                            return { done: true, value: undefined };
                                        }
                                        return { done: false, value: chunks[index++] };
                                    },
                                    releaseLock: vi.fn(),
                                    cancel: vi.fn(() => {
                                        cancelled = true;
                                    })
                                };
                            }
                        }),
                        destroy: vi.fn(),
                        clone: vi.fn()
                    };

                    const abortController = new AbortController();

                    // Cancel immediately
                    abortController.abort();

                    const stream = controller.promptStreaming(
                        mockSession,
                        'test prompt',
                        abortController.signal
                    );

                    let receivedChunks = 0;
                    let caughtError = false;

                    try {
                        for await (const chunk of stream) {
                            receivedChunks++;
                        }
                    } catch (error) {
                        if (error instanceof Error && error.message === 'Stream cancelled') {
                            caughtError = true;
                        }
                    }

                    // Should have caught the cancellation error
                    expect(caughtError).toBe(true);

                    // Should not have received any chunks
                    expect(receivedChunks).toBe(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    // Property: Multiple cancellations should be idempotent
    it('should handle multiple abort calls gracefully', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 2, maxLength: 5 }),
                async (chunks) => {
                    const mockSession: AISession = {
                        prompt: vi.fn(),
                        promptStreaming: vi.fn().mockReturnValue({
                            getReader: () => {
                                let index = 0;
                                let cancelled = false;

                                return {
                                    read: async () => {
                                        if (cancelled || index >= chunks.length) {
                                            return { done: true, value: undefined };
                                        }
                                        return { done: false, value: chunks[index++] };
                                    },
                                    releaseLock: vi.fn(),
                                    cancel: vi.fn(() => {
                                        cancelled = true;
                                    })
                                };
                            }
                        }),
                        destroy: vi.fn(),
                        clone: vi.fn()
                    };

                    const abortController = new AbortController();

                    const stream = controller.promptStreaming(
                        mockSession,
                        'test prompt',
                        abortController.signal
                    );

                    let receivedChunks = 0;
                    let errors = 0;

                    try {
                        for await (const chunk of stream) {
                            receivedChunks++;

                            if (receivedChunks === 1) {
                                // Call abort multiple times
                                abortController.abort();
                                abortController.abort();
                                abortController.abort();
                            }
                        }
                    } catch (error) {
                        if (error instanceof Error && error.message === 'Stream cancelled') {
                            errors++;
                        }
                    }

                    // Should only throw one error despite multiple aborts
                    expect(errors).toBe(1);
                }
            ),
            { numRuns: 100 }
        );
    });
});
