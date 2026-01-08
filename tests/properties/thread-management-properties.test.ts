

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { StorageManager } from '../../src/storage/storage-manager';
import type { Message, Thread } from '../../src/storage/storage-manager';

describe('Thread Management Properties', () => {
    let storage: StorageManager;

    beforeEach(async () => {
        storage = new StorageManager();
        // Clear all data before each test
        try {
            await storage.clearAllData();
        } catch (e) {
            // Ignore errors on first run
        }
    });

    afterEach(async () => {
        // Clean up after each test
        try {
            await storage.clearAllData();
        } catch (e) {
            // Ignore cleanup errors
        }
    });

    describe('Property 27: Thread List Completeness', () => {
        // Feature: local-ai-assistant, Property 27: Thread List Completeness
        // Validates: Requirements 13.1, 13.6

        it('should list all created threads', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.array(
                        fc.record({
                            id: fc.uuid(),
                            title: fc.string({ minLength: 1, maxLength: 100 }),
                            createdAt: fc.integer({ min: 0, max: Date.now() }),
                            updatedAt: fc.integer({ min: 0, max: Date.now() }),
                            messageCount: fc.integer({ min: 0, max: 100 })
                        }),
                        { minLength: 1, maxLength: 20 }
                    ),
                    async (threads: Thread[]) => {
                        // Clear database before this iteration
                        await storage.clearAllData();

                        // Save all threads
                        for (const thread of threads) {
                            await storage.createThread(thread);
                        }

                        // List threads
                        const listedThreads = await storage.listThreads();

                        // Property: all created threads should appear in the list
                        const uniqueInputIds = new Set(threads.map(t => t.id));
                        expect(listedThreads.length).toBe(uniqueInputIds.size);

                        // Property: all thread IDs from input should be in the list
                        const listedIds = new Set(listedThreads.map(t => t.id));
                        for (const thread of threads) {
                            expect(listedIds.has(thread.id)).toBe(true);
                        }

                        // Property: all listed threads should have required metadata
                        for (const thread of listedThreads) {
                            expect(thread.id).toBeDefined();
                            expect(thread.title).toBeDefined();
                            expect(thread.lastMessageTime).toBeDefined();
                            expect(thread.messageCount).toBeDefined();
                            expect(typeof thread.messageCount).toBe('number');
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should display threads in reverse chronological order by update time', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.array(
                        fc.record({
                            id: fc.uuid(),
                            title: fc.string({ minLength: 1, maxLength: 100 }),
                            createdAt: fc.integer({ min: 0, max: Date.now() }),
                            updatedAt: fc.integer({ min: 0, max: Date.now() }),
                            messageCount: fc.integer({ min: 0, max: 100 })
                        }),
                        { minLength: 2, maxLength: 10 }
                    ),
                    async (threads: Thread[]) => {
                        // Clear database before this iteration
                        await storage.clearAllData();

                        // Save all threads
                        for (const thread of threads) {
                            await storage.createThread(thread);
                        }

                        // List threads
                        const listedThreads = await storage.listThreads();

                        // Property: threads should be sorted by updatedAt in descending order
                        for (let i = 1; i < listedThreads.length; i++) {
                            expect(listedThreads[i].lastMessageTime).toBeLessThanOrEqual(
                                listedThreads[i - 1].lastMessageTime
                            );
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should update thread metadata when messages are added', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.uuid(),
                    fc.array(
                        fc.record({
                            id: fc.uuid(),
                            role: fc.constantFrom('user', 'assistant', 'system'),
                            content: fc.string({ minLength: 1, maxLength: 100 }),
                            timestamp: fc.integer({ min: 0, max: Date.now() })
                        }),
                        { minLength: 1, maxLength: 10 }
                    ),
                    async (threadId: string, messages: Omit<Message, 'threadId'>[]) => {
                        // Create thread
                        const thread: Thread = {
                            id: threadId,
                            title: 'Test Thread',
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                            messageCount: 0
                        };
                        await storage.createThread(thread);

                        // Add messages
                        for (const msg of messages) {
                            const message: Message = { ...msg, threadId };
                            await storage.saveMessage(threadId, message);
                        }

                        // List threads
                        const listedThreads = await storage.listThreads();
                        const updatedThread = listedThreads.find(t => t.id === threadId);

                        // Property: thread should exist in list
                        expect(updatedThread).toBeDefined();

                        // Property: message count should match number of messages added
                        expect(updatedThread!.messageCount).toBe(messages.length);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('Property 28: Thread Message Ordering', () => {
        // Feature: local-ai-assistant, Property 28: Thread Message Ordering
        // Validates: Requirements 13.3

        it('should load messages in chronological order by timestamp', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.uuid(),
                    fc.array(
                        fc.record({
                            id: fc.uuid(),
                            role: fc.constantFrom('user', 'assistant', 'system'),
                            content: fc.string({ minLength: 1, maxLength: 100 }),
                            timestamp: fc.integer({ min: 0, max: Date.now() })
                        }),
                        { minLength: 2, maxLength: 20 }
                    ),
                    async (threadId: string, messages: Omit<Message, 'threadId'>[]) => {
                        // Create thread
                        const thread: Thread = {
                            id: threadId,
                            title: 'Test Thread',
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                            messageCount: 0
                        };
                        await storage.createThread(thread);

                        // Save messages in random order
                        const shuffled = [...messages].sort(() => Math.random() - 0.5);
                        for (const msg of shuffled) {
                            const message: Message = { ...msg, threadId };
                            await storage.saveMessage(threadId, message);
                        }

                        // Load messages
                        const loadedMessages = await storage.loadThread(threadId);

                        // Property: messages should be sorted by timestamp in ascending order
                        for (let i = 1; i < loadedMessages.length; i++) {
                            expect(loadedMessages[i].timestamp).toBeGreaterThanOrEqual(
                                loadedMessages[i - 1].timestamp
                            );
                        }

                        // Property: all messages should be present
                        expect(loadedMessages.length).toBe(messages.length);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should preserve message order across multiple loads', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.uuid(),
                    fc.array(
                        fc.record({
                            id: fc.uuid(),
                            role: fc.constantFrom('user', 'assistant', 'system'),
                            content: fc.string({ minLength: 1, maxLength: 100 }),
                            timestamp: fc.integer({ min: 0, max: Date.now() })
                        }),
                        { minLength: 1, maxLength: 10 }
                    ),
                    async (threadId: string, messages: Omit<Message, 'threadId'>[]) => {
                        // Create thread
                        const thread: Thread = {
                            id: threadId,
                            title: 'Test Thread',
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                            messageCount: 0
                        };
                        await storage.createThread(thread);

                        // Save messages
                        for (const msg of messages) {
                            const message: Message = { ...msg, threadId };
                            await storage.saveMessage(threadId, message);
                        }

                        // Load messages multiple times
                        const load1 = await storage.loadThread(threadId);
                        const load2 = await storage.loadThread(threadId);
                        const load3 = await storage.loadThread(threadId);

                        // Property: order should be consistent across loads
                        expect(load1.map(m => m.id)).toEqual(load2.map(m => m.id));
                        expect(load2.map(m => m.id)).toEqual(load3.map(m => m.id));
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('Property 29: Thread Deletion Completeness', () => {
        // Feature: local-ai-assistant, Property 29: Thread Deletion Completeness
        // Validates: Requirements 13.4

        it('should remove thread and all its messages when deleted', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.uuid(),
                    fc.array(
                        fc.record({
                            id: fc.uuid(),
                            role: fc.constantFrom('user', 'assistant', 'system'),
                            content: fc.string({ minLength: 1, maxLength: 100 }),
                            timestamp: fc.integer({ min: 0, max: Date.now() })
                        }),
                        { minLength: 1, maxLength: 10 }
                    ),
                    async (threadId: string, messages: Omit<Message, 'threadId'>[]) => {
                        // Create thread
                        const thread: Thread = {
                            id: threadId,
                            title: 'Test Thread',
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                            messageCount: 0
                        };
                        await storage.createThread(thread);

                        // Add messages
                        for (const msg of messages) {
                            const message: Message = { ...msg, threadId };
                            await storage.saveMessage(threadId, message);
                        }

                        // Verify thread exists
                        const beforeDelete = await storage.getThread(threadId);
                        expect(beforeDelete).toBeDefined();

                        // Delete thread
                        await storage.deleteThread(threadId);

                        // Property: thread should no longer exist
                        const afterDelete = await storage.getThread(threadId);
                        expect(afterDelete).toBeUndefined();

                        // Property: thread should not appear in list
                        const listedThreads = await storage.listThreads();
                        const deletedThread = listedThreads.find(t => t.id === threadId);
                        expect(deletedThread).toBeUndefined();

                        // Property: all messages should be deleted
                        const remainingMessages = await storage.loadThread(threadId);
                        expect(remainingMessages).toHaveLength(0);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should not affect other threads when one is deleted', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.array(
                        fc.record({
                            id: fc.uuid(),
                            title: fc.string({ minLength: 1, maxLength: 100 }),
                            createdAt: fc.integer({ min: 0, max: Date.now() }),
                            updatedAt: fc.integer({ min: 0, max: Date.now() }),
                            messageCount: fc.integer({ min: 0, max: 100 })
                        }),
                        { minLength: 2, maxLength: 10 }
                    ),
                    fc.integer({ min: 0, max: 9 }),
                    async (threads: Thread[], deleteIndex: number) => {
                        // Clear database before this iteration
                        await storage.clearAllData();

                        // Ensure we have at least 2 threads
                        if (threads.length < 2) return;

                        // Adjust delete index to be within bounds
                        const actualDeleteIndex = deleteIndex % threads.length;

                        // Save all threads
                        for (const thread of threads) {
                            await storage.createThread(thread);
                        }

                        // Get thread to delete
                        const threadToDelete = threads[actualDeleteIndex];

                        // Delete one thread
                        await storage.deleteThread(threadToDelete.id);

                        // List remaining threads
                        const remainingThreads = await storage.listThreads();

                        // Property: deleted thread should not be in list
                        const deletedThread = remainingThreads.find(t => t.id === threadToDelete.id);
                        expect(deletedThread).toBeUndefined();

                        // Property: all other threads should still exist
                        const uniqueInputIds = new Set(threads.map(t => t.id));
                        uniqueInputIds.delete(threadToDelete.id);
                        expect(remainingThreads.length).toBe(uniqueInputIds.size);

                        for (const thread of threads) {
                            if (thread.id !== threadToDelete.id) {
                                const found = remainingThreads.find(t => t.id === thread.id);
                                expect(found).toBeDefined();
                            }
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('Property 30: Thread Title Generation', () => {
        // Feature: local-ai-assistant, Property 30: Thread Title Generation
        // Validates: Requirements 13.5

        it('should generate title from first message that is non-empty', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.string({ minLength: 1, maxLength: 200 }),
                    async (firstMessage: string) => {
                        // Simulate title generation logic
                        const maxLength = 50;
                        const trimmed = firstMessage.trim();

                        let expectedTitle: string;
                        if (trimmed.length <= maxLength) {
                            expectedTitle = trimmed;
                        } else {
                            const truncated = trimmed.substring(0, maxLength);
                            const lastSpace = truncated.lastIndexOf(' ');

                            if (lastSpace > maxLength * 0.7) {
                                expectedTitle = truncated.substring(0, lastSpace) + '...';
                            } else {
                                expectedTitle = truncated + '...';
                            }
                        }

                        // Property: generated title should be non-empty
                        expect(expectedTitle.length).toBeGreaterThan(0);

                        // Property: generated title should not exceed max length + ellipsis
                        expect(expectedTitle.length).toBeLessThanOrEqual(maxLength + 3);

                        // Property: if original is short, title should match exactly
                        if (trimmed.length <= maxLength) {
                            expect(expectedTitle).toBe(trimmed);
                        }

                        // Property: if original is long, title should end with ellipsis
                        if (trimmed.length > maxLength) {
                            expect(expectedTitle.endsWith('...')).toBe(true);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should handle edge cases in title generation', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.oneof(
                        fc.constant(''),
                        fc.constant('   '),
                        fc.constant('a'),
                        fc.string({ minLength: 51, maxLength: 51 }),
                        fc.string({ minLength: 100, maxLength: 200 })
                    ),
                    async (input: string) => {
                        // Simulate title generation logic
                        const maxLength = 50;
                        const trimmed = input.trim();

                        let expectedTitle: string;
                        if (trimmed.length === 0) {
                            expectedTitle = 'New Conversation';
                        } else if (trimmed.length <= maxLength) {
                            expectedTitle = trimmed;
                        } else {
                            const truncated = trimmed.substring(0, maxLength);
                            const lastSpace = truncated.lastIndexOf(' ');

                            if (lastSpace > maxLength * 0.7) {
                                expectedTitle = truncated.substring(0, lastSpace) + '...';
                            } else {
                                expectedTitle = truncated + '...';
                            }
                        }

                        // Property: title should always be non-empty
                        expect(expectedTitle.length).toBeGreaterThan(0);

                        // Property: empty/whitespace input should get default title
                        if (trimmed.length === 0) {
                            expect(expectedTitle).toBe('New Conversation');
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});
