

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { StorageManager, Message, Thread, Document, Chunk } from '../../src/storage/storage-manager';

describe('Storage Properties', () => {
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

    describe('Property 7: Storage Round-Trip Consistency', () => {
        // Feature: local-ai-assistant, Property 7: Storage Round-Trip Consistency
        // Validates: Requirements 4.1, 4.2, 4.5, 7.5, 9.6, 10.6, 12.3, 12.4

        it('should preserve message data through save and load cycle', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.record({
                        id: fc.uuid(),
                        threadId: fc.uuid(),
                        role: fc.constantFrom('user', 'assistant', 'system'),
                        content: fc.string({ minLength: 1, maxLength: 1000 }),
                        timestamp: fc.integer({ min: 0, max: Date.now() })
                    }),
                    async (message: Message) => {
                        // Create thread first
                        const thread: Thread = {
                            id: message.threadId,
                            title: 'Test Thread',
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                            messageCount: 0
                        };
                        await storage.createThread(thread);

                        // Save message
                        await storage.saveMessage(message.threadId, message);

                        // Load thread messages
                        const loadedMessages = await storage.loadThread(message.threadId);

                        // Property: loaded message should equal saved message
                        expect(loadedMessages).toHaveLength(1);
                        const loadedMessage = loadedMessages[0];
                        expect(loadedMessage.id).toBe(message.id);
                        expect(loadedMessage.threadId).toBe(message.threadId);
                        expect(loadedMessage.role).toBe(message.role);
                        expect(loadedMessage.content).toBe(message.content);
                        expect(loadedMessage.timestamp).toBe(message.timestamp);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should preserve thread data through save and load cycle', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.record({
                        id: fc.uuid(),
                        title: fc.string({ minLength: 1, maxLength: 200 }),
                        createdAt: fc.integer({ min: 0, max: Date.now() }),
                        updatedAt: fc.integer({ min: 0, max: Date.now() }),
                        messageCount: fc.integer({ min: 0, max: 1000 })
                    }),
                    async (thread: Thread) => {
                        // Save thread
                        await storage.createThread(thread);

                        // Load thread
                        const loadedThread = await storage.getThread(thread.id);

                        // Property: loaded thread should equal saved thread
                        expect(loadedThread).toBeDefined();
                        expect(loadedThread!.id).toBe(thread.id);
                        expect(loadedThread!.title).toBe(thread.title);
                        expect(loadedThread!.createdAt).toBe(thread.createdAt);
                        expect(loadedThread!.updatedAt).toBe(thread.updatedAt);
                        expect(loadedThread!.messageCount).toBe(thread.messageCount);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should preserve document data through save and load cycle', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.record({
                        id: fc.uuid(),
                        filename: fc.string({ minLength: 1, maxLength: 100 }),
                        chunkCount: fc.integer({ min: 0, max: 100 }),
                        createdAt: fc.integer({ min: 0, max: Date.now() })
                    }),
                    async (document: Document) => {
                        // Save document
                        await storage.saveDocument(document);

                        // Create and save a chunk for this document
                        const chunk: Chunk = {
                            id: fc.sample(fc.uuid(), 1)[0],
                            documentId: document.id,
                            content: 'Test content',
                            startOffset: 0,
                            endOffset: 12
                        };
                        await storage.saveChunk(chunk);

                        // Load chunks
                        const loadedChunks = await storage.getChunks(document.id);

                        // Property: loaded chunks should contain saved chunk
                        expect(loadedChunks).toHaveLength(1);
                        expect(loadedChunks[0].id).toBe(chunk.id);
                        expect(loadedChunks[0].documentId).toBe(document.id);
                        expect(loadedChunks[0].content).toBe(chunk.content);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should preserve settings through save and load cycle', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.string({ minLength: 1, maxLength: 50 }),
                    fc.oneof(
                        fc.string(),
                        fc.integer(),
                        fc.boolean(),
                        fc.double(),
                        fc.array(fc.string())
                    ),
                    async (key: string, value: any) => {
                        // Save setting
                        await storage.saveSetting(key, value);

                        // Load setting
                        const loadedValue = await storage.loadSetting(key);

                        // Property: loaded value should equal saved value
                        expect(loadedValue).toEqual(value);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should preserve asset data through save and load cycle', async () => {
            // Skip if OPFS is not supported
            if (!navigator.storage || !navigator.storage.getDirectory) {
                console.warn('OPFS not supported, skipping asset test');
                return;
            }

            await fc.assert(
                fc.asyncProperty(
                    fc.uuid(),
                    fc.uint8Array({ minLength: 1, maxLength: 1000 }),
                    async (assetId: string, data: Uint8Array) => {
                        // Create blob from data
                        const blob = new Blob([data], { type: 'application/octet-stream' });

                        // Save asset
                        await storage.saveAsset(assetId, blob);

                        // Load asset
                        const loadedBlob = await storage.loadAsset(assetId);

                        // Property: loaded blob should have same size and content
                        expect(loadedBlob.size).toBe(blob.size);

                        const loadedData = new Uint8Array(await loadedBlob.arrayBuffer());
                        expect(loadedData).toEqual(data);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should handle multiple messages in correct order', async () => {
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

                        // Save all messages
                        for (const msg of messages) {
                            const message: Message = { ...msg, threadId };
                            await storage.saveMessage(threadId, message);
                        }

                        // Load messages
                        const loadedMessages = await storage.loadThread(threadId);

                        // Property: all messages should be loaded
                        expect(loadedMessages).toHaveLength(messages.length);

                        // Property: messages should be sorted by timestamp
                        for (let i = 1; i < loadedMessages.length; i++) {
                            expect(loadedMessages[i].timestamp).toBeGreaterThanOrEqual(
                                loadedMessages[i - 1].timestamp
                            );
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('Property 8: Thread Identifier Uniqueness', () => {
        // Feature: local-ai-assistant, Property 8: Thread Identifier Uniqueness
        // Validates: Requirements 4.4, 13.2

        it('should ensure all thread IDs are unique', async () => {
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
                        { minLength: 2, maxLength: 20 }
                    ),
                    async (threads: Thread[]) => {
                        // Clear database before this iteration
                        await storage.clearAllData();

                        // Save all threads
                        for (const thread of threads) {
                            await storage.createThread(thread);
                        }

                        // Load all threads
                        const loadedThreads = await storage.listThreads();

                        // Property: all thread IDs should be unique
                        const ids = loadedThreads.map(t => t.id);
                        const uniqueIds = new Set(ids);
                        expect(uniqueIds.size).toBe(ids.length);

                        // Property: number of loaded threads should match unique input threads
                        // (duplicates in input get overwritten)
                        const uniqueInputIds = new Set(threads.map(t => t.id));
                        expect(loadedThreads.length).toBe(uniqueInputIds.size);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should handle UUID collision gracefully (overwrite)', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.uuid(),
                    fc.string({ minLength: 1, maxLength: 100 }),
                    fc.string({ minLength: 1, maxLength: 100 }),
                    async (id: string, title1: string, title2: string) => {
                        // Create first thread
                        const thread1: Thread = {
                            id,
                            title: title1,
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                            messageCount: 0
                        };
                        await storage.createThread(thread1);

                        // Create second thread with same ID
                        const thread2: Thread = {
                            id,
                            title: title2,
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                            messageCount: 0
                        };
                        await storage.createThread(thread2);

                        // Load thread
                        const loadedThread = await storage.getThread(id);

                        // Property: only one thread should exist with this ID
                        expect(loadedThread).toBeDefined();
                        expect(loadedThread!.id).toBe(id);

                        // Property: latest write should win
                        expect(loadedThread!.title).toBe(title2);

                        // Property: list should contain only one thread with this ID
                        const allThreads = await storage.listThreads();
                        const matchingThreads = allThreads.filter(t => t.id === id);
                        expect(matchingThreads).toHaveLength(1);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});
