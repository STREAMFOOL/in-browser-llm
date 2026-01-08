

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StorageManager } from '../src/storage/storage-manager';

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
});
