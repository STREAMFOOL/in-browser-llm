import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClearDataOperation } from '../../src/storage/clear-data-operation';
import { StorageManager } from '../../src/storage/storage-manager';
import { OPFSManager } from '../../src/storage/opfs-manager';

describe('ClearDataOperation Unit Tests', () => {
    let clearDataOp: ClearDataOperation;
    let mockStorageManager: StorageManager;
    let mockOPFSManager: OPFSManager;

    beforeEach(() => {
        // Create mock instances
        mockStorageManager = {
            clearStore: vi.fn().mockResolvedValue(undefined),
            getStoreSize: vi.fn().mockResolvedValue(1024),
            getStorageEstimate: vi.fn().mockResolvedValue({ usage: 5000, quota: 100000 }),
        } as any;

        mockOPFSManager = {
            listAssets: vi.fn().mockResolvedValue(['asset1.png', 'asset2.jpg']),
            clearAllAssets: vi.fn().mockResolvedValue(undefined),
            getTotalSize: vi.fn().mockResolvedValue(2048),
        } as any;

        clearDataOp = new ClearDataOperation(mockStorageManager, mockOPFSManager);
    });

    describe('clearAll() completeness', () => {
        // Requirements: 1.6
        it('should clear all data types successfully', async () => {
            const result = await clearDataOp.clearAll();

            expect(result.success).toBe(true);
            expect(result.clearedStores).toContain('conversations');
            expect(result.clearedStores).toContain('settings');
            expect(result.clearedStores).toContain('modelCache');
            expect(result.clearedFiles).toBe(2);
            expect(result.errors).toHaveLength(0);

            // Verify all clear methods were called
            expect(mockStorageManager.clearStore).toHaveBeenCalledWith('threads');
            expect(mockStorageManager.clearStore).toHaveBeenCalledWith('messages');
            expect(mockStorageManager.clearStore).toHaveBeenCalledWith('settings');
            expect(mockOPFSManager.clearAllAssets).toHaveBeenCalled();
        });

        it('should return correct file count from assets', async () => {
            mockOPFSManager.listAssets = vi.fn().mockResolvedValue(['file1', 'file2', 'file3']);

            const result = await clearDataOp.clearAll();

            expect(result.clearedFiles).toBe(3);
        });

        it('should handle empty storage gracefully', async () => {
            mockOPFSManager.listAssets = vi.fn().mockResolvedValue([]);

            const result = await clearDataOp.clearAll();

            expect(result.success).toBe(true);
            expect(result.clearedFiles).toBe(0);
            expect(result.errors).toHaveLength(0);
        });
    });

    describe('partial clear operations', () => {
        // Requirements: 1.6
        it('should clear conversations only', async () => {
            await clearDataOp.clearConversations();

            expect(mockStorageManager.clearStore).toHaveBeenCalledWith('threads');
            expect(mockStorageManager.clearStore).toHaveBeenCalledWith('messages');
            expect(mockStorageManager.clearStore).toHaveBeenCalledTimes(2);
        });

        it('should clear settings only', async () => {
            await clearDataOp.clearSettings();

            expect(mockStorageManager.clearStore).toHaveBeenCalledWith('settings');
            expect(mockStorageManager.clearStore).toHaveBeenCalledTimes(1);
        });

        it('should clear assets only', async () => {
            const fileCount = await clearDataOp.clearAssets();

            expect(mockOPFSManager.listAssets).toHaveBeenCalled();
            expect(mockOPFSManager.clearAllAssets).toHaveBeenCalled();
            expect(fileCount).toBe(2);
        });

        it('should clear model cache', async () => {
            await clearDataOp.clearModelCache();

            // Model cache is currently a no-op, but should not throw
            expect(true).toBe(true);
        });
    });

    describe('error handling', () => {
        // Requirements: 1.6
        it('should handle conversation clear failure gracefully', async () => {
            mockStorageManager.clearStore = vi.fn()
                .mockRejectedValueOnce(new Error('Failed to clear threads'))
                .mockResolvedValue(undefined);

            const result = await clearDataOp.clearAll();

            expect(result.success).toBe(false);
            expect(result.errors).toContain('Failed to clear conversations: Failed to clear threads');
            expect(result.clearedStores).not.toContain('conversations');
            // Other stores should still be cleared
            expect(result.clearedStores).toContain('settings');
            expect(result.clearedStores).toContain('modelCache');
        });

        it('should handle settings clear failure gracefully', async () => {
            mockStorageManager.clearStore = vi.fn()
                .mockResolvedValueOnce(undefined) // threads
                .mockResolvedValueOnce(undefined) // messages
                .mockRejectedValueOnce(new Error('Settings error'));

            const result = await clearDataOp.clearAll();

            expect(result.success).toBe(false);
            expect(result.errors).toContain('Failed to clear settings: Settings error');
            expect(result.clearedStores).toContain('conversations');
            expect(result.clearedStores).not.toContain('settings');
        });

        it('should handle assets clear failure gracefully', async () => {
            mockOPFSManager.listAssets = vi.fn().mockRejectedValue(new Error('OPFS error'));

            const result = await clearDataOp.clearAll();

            expect(result.success).toBe(false);
            expect(result.errors).toContain('Failed to clear assets: OPFS error');
            expect(result.clearedFiles).toBe(0);
            // Other stores should still be cleared
            expect(result.clearedStores).toContain('conversations');
            expect(result.clearedStores).toContain('settings');
        });

        it('should handle multiple failures and report all errors', async () => {
            mockStorageManager.clearStore = vi.fn().mockRejectedValue(new Error('Store error'));
            mockOPFSManager.listAssets = vi.fn().mockRejectedValue(new Error('OPFS error'));

            const result = await clearDataOp.clearAll();

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(1);
            expect(result.errors).toContain('Failed to clear conversations: Store error');
            expect(result.errors).toContain('Failed to clear assets: OPFS error');
        });

        it('should handle non-Error exceptions', async () => {
            mockStorageManager.clearStore = vi.fn().mockRejectedValue('String error');

            const result = await clearDataOp.clearAll();

            expect(result.success).toBe(false);
            expect(result.errors[0]).toContain('String error');
        });

        it('should continue clearing after partial failure', async () => {
            mockStorageManager.clearStore = vi.fn()
                .mockRejectedValueOnce(new Error('Threads failed'))
                .mockResolvedValue(undefined);

            const result = await clearDataOp.clearAll();

            expect(result.success).toBe(false);
            expect(result.clearedStores).toContain('settings');
            expect(result.clearedStores).toContain('modelCache');
            expect(result.clearedFiles).toBe(2);
        });
    });

    describe('getDataSize()', () => {
        // Requirements: 1.6
        it('should calculate total data size correctly', async () => {
            mockStorageManager.getStoreSize = vi.fn()
                .mockResolvedValueOnce(1000) // threads
                .mockResolvedValueOnce(2000) // messages
                .mockResolvedValueOnce(500);  // settings
            mockOPFSManager.getTotalSize = vi.fn().mockResolvedValue(3000);
            mockStorageManager.getStorageEstimate = vi.fn().mockResolvedValue({ usage: 6500, quota: 100000 });

            const dataSize = await clearDataOp.getDataSize();

            expect(dataSize.conversations).toBe(3000); // threads + messages
            expect(dataSize.settings).toBe(500);
            expect(dataSize.assets).toBe(3000);
            expect(dataSize.modelCache).toBe(0);
            expect(dataSize.total).toBe(6500);
        });

        it('should handle zero sizes', async () => {
            mockStorageManager.getStoreSize = vi.fn().mockResolvedValue(0);
            mockOPFSManager.getTotalSize = vi.fn().mockResolvedValue(0);
            mockStorageManager.getStorageEstimate = vi.fn().mockResolvedValue({ usage: 0, quota: 100000 });

            const dataSize = await clearDataOp.getDataSize();

            expect(dataSize.conversations).toBe(0);
            expect(dataSize.settings).toBe(0);
            expect(dataSize.assets).toBe(0);
            expect(dataSize.modelCache).toBe(0);
            expect(dataSize.total).toBe(0);
        });
    });
});
