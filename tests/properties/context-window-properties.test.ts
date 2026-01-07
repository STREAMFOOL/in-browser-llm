/**
 * Property-based tests for Context Window Manager
 * Feature: local-ai-assistant
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ContextWindowManager } from '../../src/context-window-manager';
import { GeminiController, type AISession } from '../../src/gemini-controller';
import type { Message } from '../../src/storage-manager';

describe('Context Window Manager Properties', () => {
    let manager: ContextWindowManager;
    let controller: GeminiController;

    beforeEach(() => {
        manager = new ContextWindowManager({
            maxTokens: 1000,
            summarizationThreshold: 0.8
        });
        controller = new GeminiController();
    });

    /**
     * Property 5: Context Window Management
     * For any conversation that exceeds the context window limit, the system should 
     * automatically summarize or truncate older messages to maintain the conversation 
     * within the limit.
     * 
     * Feature: local-ai-assistant, Property 5: Context Window Management
     * Validates: Requirements 3.4
     */
    it('should detect when context exceeds threshold and trigger summarization', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.record({
                        role: fc.constantFrom('user' as const, 'assistant' as const),
                        content: fc.string({ minLength: 50, maxLength: 200 })
                    }),
                    { minLength: 1, maxLength: 50 }
                ),
                async (messageData) => {
                    // Create messages from the generated data
                    const messages: Message[] = messageData.map((data, index) => ({
                        id: `msg-${index}`,
                        threadId: 'test-thread',
                        role: data.role,
                        content: data.content,
                        timestamp: Date.now() + index
                    }));

                    // Monitor token usage
                    const usage = manager.monitorTokenUsage(messages);

                    // Verify usage calculations are consistent
                    expect(usage.currentTokens).toBeGreaterThanOrEqual(0);
                    expect(usage.maxTokens).toBe(1000);
                    expect(usage.percentageUsed).toBe(usage.currentTokens / usage.maxTokens);
                    expect(usage.needsSummarization).toBe(usage.percentageUsed >= 0.8);

                    // If summarization is needed, verify it reduces token count
                    if (usage.needsSummarization && messages.length > 5) {
                        const availability = await controller.checkAvailability();

                        if (availability.status === 'readily') {
                            const session = await controller.createSession();

                            try {
                                const summarized = await manager.summarizeMessages(session, messages, 5);

                                // Summarized messages should have fewer or equal messages
                                expect(summarized.length).toBeLessThanOrEqual(messages.length);

                                // Should keep recent messages (last 5) plus summary
                                expect(summarized.length).toBeLessThanOrEqual(6); // 1 summary + 5 recent

                                // First message should be a system summary if we had enough messages
                                if (messages.length > 5) {
                                    expect(summarized[0].role).toBe('system');
                                    expect(summarized[0].content).toContain('summary');
                                }
                            } finally {
                                await controller.destroySession(session);
                            }
                        }
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Token monitoring should be consistent
     * Feature: local-ai-assistant, Property 5: Context Window Management
     * Validates: Requirements 3.4
     */
    it('should consistently calculate token usage for the same messages', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.record({
                        role: fc.constantFrom('user' as const, 'assistant' as const),
                        content: fc.string({ minLength: 10, maxLength: 100 })
                    }),
                    { minLength: 1, maxLength: 20 }
                ),
                async (messageData) => {
                    const messages: Message[] = messageData.map((data, index) => ({
                        id: `msg-${index}`,
                        threadId: 'test-thread',
                        role: data.role,
                        content: data.content,
                        timestamp: Date.now() + index
                    }));

                    // Monitor usage twice
                    const usage1 = manager.monitorTokenUsage(messages);
                    const usage2 = manager.monitorTokenUsage(messages);

                    // Results should be identical
                    expect(usage1.currentTokens).toBe(usage2.currentTokens);
                    expect(usage1.percentageUsed).toBe(usage2.percentageUsed);
                    expect(usage1.needsSummarization).toBe(usage2.needsSummarization);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Summarization should preserve recent messages
     * Feature: local-ai-assistant, Property 5: Context Window Management
     * Validates: Requirements 3.4
     */
    it('should preserve the most recent messages when summarizing', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.tuple(
                    fc.array(
                        fc.record({
                            role: fc.constantFrom('user' as const, 'assistant' as const),
                            content: fc.string({ minLength: 20, maxLength: 100 })
                        }),
                        { minLength: 10, maxLength: 30 }
                    ),
                    fc.integer({ min: 1, max: 10 })
                ),
                async ([messageData, keepCount]) => {
                    const messages: Message[] = messageData.map((data, index) => ({
                        id: `msg-${index}`,
                        threadId: 'test-thread',
                        role: data.role,
                        content: data.content,
                        timestamp: Date.now() + index
                    }));

                    const availability = await controller.checkAvailability();

                    if (availability.status !== 'readily') {
                        return true;
                    }

                    const session = await controller.createSession();

                    try {
                        const summarized = await manager.summarizeMessages(session, messages, keepCount);

                        // If we have more messages than keepCount, check preservation
                        if (messages.length > keepCount) {
                            const recentOriginal = messages.slice(-keepCount);
                            const recentSummarized = summarized.slice(-keepCount);

                            // The last keepCount messages should be preserved
                            expect(recentSummarized.length).toBe(keepCount);

                            // Content should match (excluding the summary message)
                            for (let i = 0; i < keepCount; i++) {
                                expect(recentSummarized[i].content).toBe(recentOriginal[i].content);
                            }
                        } else {
                            // If we have fewer messages than keepCount, all should be preserved
                            expect(summarized.length).toBe(messages.length);
                        }
                    } finally {
                        await controller.destroySession(session);
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Adding messages should increase token count
     * Feature: local-ai-assistant, Property 5: Context Window Management
     * Validates: Requirements 3.4
     */
    it('should increase token count when messages are added', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.tuple(
                    fc.array(
                        fc.record({
                            role: fc.constantFrom('user' as const, 'assistant' as const),
                            content: fc.string({ minLength: 10, maxLength: 100 })
                        }),
                        { minLength: 1, maxLength: 10 }
                    ),
                    fc.record({
                        role: fc.constantFrom('user' as const, 'assistant' as const),
                        content: fc.string({ minLength: 10, maxLength: 100 })
                    })
                ),
                async ([messageData, newMessageData]) => {
                    const messages: Message[] = messageData.map((data, index) => ({
                        id: `msg-${index}`,
                        threadId: 'test-thread',
                        role: data.role,
                        content: data.content,
                        timestamp: Date.now() + index
                    }));

                    const usage1 = manager.monitorTokenUsage(messages);

                    // Add a new message
                    const newMessage: Message = {
                        id: `msg-${messages.length}`,
                        threadId: 'test-thread',
                        role: newMessageData.role,
                        content: newMessageData.content,
                        timestamp: Date.now() + messages.length
                    };

                    const messagesWithNew = [...messages, newMessage];
                    const usage2 = manager.monitorTokenUsage(messagesWithNew);

                    // Token count should increase (or stay same if content is empty)
                    expect(usage2.currentTokens).toBeGreaterThanOrEqual(usage1.currentTokens);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});
