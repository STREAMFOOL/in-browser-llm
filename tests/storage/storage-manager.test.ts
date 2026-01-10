

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StorageManager } from '../../src/storage/storage-manager';

describe('StorageManager Unit Tests', () => {
    let storage: StorageManager;

    beforeEach(async () => {
        storage = new StorageManager();
        await storage.clearAllData();
    });

    afterEach(async () => {
        await storage.clearAllData();
    });

    describe('Persistence Request', () => {
        // Requirements: 4.3
        it('should request persistent storage on initialization', async () => {
            const result = await storage.requestPersistence();

            // Should return a boolean
            expect(typeof result).toBe('boolean');
        });

        it('should handle multiple persistence requests gracefully', async () => {
            const result1 = await storage.requestPersistence();
            const result2 = await storage.requestPersistence();

            // Both should succeed
            expect(typeof result1).toBe('boolean');
            expect(typeof result2).toBe('boolean');
        });
    });

    describe('Storage Quota Handling', () => {
        // Requirements: 4.6
        it('should return storage estimate', async () => {
            const estimate = await storage.getStorageEstimate();

            expect(estimate).toHaveProperty('usage');
            expect(estimate).toHaveProperty('quota');
            expect(typeof estimate.usage).toBe('number');
            expect(typeof estimate.quota).toBe('number');
        });

        it('should handle storage estimate errors gracefully', async () => {
            // Even if the API fails, should return valid structure
            const estimate = await storage.getStorageEstimate();

            expect(estimate).toBeDefined();
            expect(estimate.usage).toBeGreaterThanOrEqual(0);
            expect(estimate.quota).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Clear All Data', () => {
        it('should clear all data from storage', async () => {
            // Add some data
            const thread = {
                id: 'test-thread',
                title: 'Test Thread',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                messageCount: 0
            };
            await storage.createThread(thread);

            const message = {
                id: 'test-message',
                threadId: 'test-thread',
                role: 'user' as const,
                content: 'Test message',
                timestamp: Date.now()
            };
            await storage.saveMessage('test-thread', message);

            await storage.saveSetting('test-key', 'test-value');

            // Clear all data
            await storage.clearAllData();

            // Verify data is cleared
            const threads = await storage.listThreads();
            expect(threads).toHaveLength(0);

            const loadedThread = await storage.getThread('test-thread');
            expect(loadedThread).toBeUndefined();

            const setting = await storage.loadSetting('test-key');
            expect(setting).toBeUndefined();
        });
    });

    describe('Data Integrity Verification', () => {
        // Requirements: 2.1, 2.2
        it('should pass integrity check with valid data', async () => {
            // Create valid thread and message
            const thread = {
                id: 'test-thread',
                title: 'Test Thread',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                messageCount: 1
            };
            await storage.createThread(thread);

            const message = {
                id: 'test-message',
                threadId: 'test-thread',
                role: 'user' as const,
                content: 'Test message',
                timestamp: Date.now()
            };
            await storage.saveMessage('test-thread', message);

            const report = await storage.verifyDataIntegrity();

            expect(report.valid).toBe(true);
            expect(report.errors).toHaveLength(0);
        });

        it('should detect orphaned messages', async () => {
            // Create message without corresponding thread
            const message = {
                id: 'orphaned-message',
                threadId: 'non-existent-thread',
                role: 'user' as const,
                content: 'Orphaned message',
                timestamp: Date.now()
            };
            await storage.saveMessage('non-existent-thread', message);

            const report = await storage.verifyDataIntegrity();

            expect(report.valid).toBe(false);
            expect(report.errors.length).toBeGreaterThan(0);
            expect(report.errors[0]).toContain('Orphaned message');
            expect(report.errors[0]).toContain('non-existent-thread');
        });

        it('should detect corrupted data with missing required fields', async () => {
            // Create thread first
            const thread = {
                id: 'test-thread',
                title: 'Test Thread',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                messageCount: 1
            };
            await storage.createThread(thread);

            // Manually insert corrupted message (missing required fields)
            const corruptedMessage = {
                id: 'corrupted-message',
                threadId: 'test-thread',
                // Missing role, content, timestamp
            };

            // Access the internal db to insert corrupted data
            const storageAny = storage as any;
            await storageAny.db.messages.put(corruptedMessage);

            const report = await storage.verifyDataIntegrity();

            expect(report.valid).toBe(false);
            expect(report.errors.length).toBeGreaterThan(0);
            expect(report.errors.some(e => e.includes('missing required fields'))).toBe(true);
        });

        it('should warn about incorrect message counts', async () => {
            // Create thread with incorrect message count
            const thread = {
                id: 'test-thread',
                title: 'Test Thread',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                messageCount: 5 // Incorrect count
            };
            await storage.createThread(thread);

            // Add only 2 messages
            const message1 = {
                id: 'message-1',
                threadId: 'test-thread',
                role: 'user' as const,
                content: 'Message 1',
                timestamp: Date.now()
            };
            const message2 = {
                id: 'message-2',
                threadId: 'test-thread',
                role: 'assistant' as const,
                content: 'Message 2',
                timestamp: Date.now()
            };

            // Manually insert messages without updating thread count
            const storageAny = storage as any;
            await storageAny.db.messages.put(message1);
            await storageAny.db.messages.put(message2);

            const report = await storage.verifyDataIntegrity();

            // Should have warnings about message count mismatch
            expect(report.warnings.length).toBeGreaterThan(0);
            expect(report.warnings.some(w => w.includes('messageCount'))).toBe(true);
        });

        it('should detect orphaned chunks', async () => {
            // Create chunk without corresponding document
            const chunk = {
                id: 'orphaned-chunk',
                documentId: 'non-existent-document',
                content: 'Orphaned chunk content',
                startOffset: 0,
                endOffset: 100
            };
            await storage.saveChunk(chunk);

            const report = await storage.verifyDataIntegrity();

            expect(report.valid).toBe(false);
            expect(report.errors.length).toBeGreaterThan(0);
            expect(report.errors.some(e => e.includes('Orphaned chunk'))).toBe(true);
        });

        it('should handle empty database gracefully', async () => {
            const report = await storage.verifyDataIntegrity();

            expect(report.valid).toBe(true);
            expect(report.errors).toHaveLength(0);
            expect(report.warnings).toHaveLength(0);
        });
    });

    describe('clearStore() method', () => {
        // Requirements: 1.6
        it('should clear specific object store', async () => {
            // Add data to multiple stores
            const thread = {
                id: 'test-thread',
                title: 'Test Thread',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                messageCount: 0
            };
            await storage.createThread(thread);

            await storage.saveSetting('test-key', 'test-value');

            // Clear only threads store
            await storage.clearStore('threads');

            // Verify threads are cleared but settings remain
            const threads = await storage.listThreads();
            expect(threads).toHaveLength(0);

            const setting = await storage.loadSetting('test-key');
            expect(setting).toBe('test-value');
        });

        it('should handle transaction errors for unknown stores', async () => {
            await expect(storage.clearStore('unknown-store')).rejects.toThrow('Unknown store');
        });
    });

    describe('getStoreSize() method', () => {
        // Requirements: 1.6
        it('should calculate store size in bytes', async () => {
            // Add some data
            const thread = {
                id: 'test-thread',
                title: 'Test Thread',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                messageCount: 0
            };
            await storage.createThread(thread);

            const size = await storage.getStoreSize('threads');

            // Size should be greater than 0
            expect(size).toBeGreaterThan(0);
        });

        it('should return 0 for empty store', async () => {
            const size = await storage.getStoreSize('threads');
            expect(size).toBe(0);
        });

        it('should return 0 for unknown store', async () => {
            const size = await storage.getStoreSize('unknown-store');
            expect(size).toBe(0);
        });
    });

    describe('updateMessageComplete() method', () => {
        // Requirements: 3.6
        it('should update message complete flag', async () => {
            // Create thread and message
            const thread = {
                id: 'test-thread',
                title: 'Test Thread',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                messageCount: 0
            };
            await storage.createThread(thread);

            const message = {
                id: 'test-message',
                threadId: 'test-thread',
                role: 'assistant' as const,
                content: 'Test message',
                timestamp: Date.now(),
                complete: false
            };
            await storage.saveMessage('test-thread', message);

            // Update complete flag
            await storage.updateMessageComplete('test-message', true);

            // Verify flag was updated
            const messages = await storage.loadThread('test-thread');
            expect(messages).toHaveLength(1);
            expect(messages[0].complete).toBe(true);
        });

        it('should handle non-existent message gracefully', async () => {
            // Should not throw error
            await expect(storage.updateMessageComplete('non-existent', true)).resolves.not.toThrow();
        });
    });
});
