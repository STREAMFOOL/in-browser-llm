import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OPFSManager } from '../../src/storage/opfs-manager';

describe('OPFSManager Unit Tests', () => {
    let opfsManager: OPFSManager;

    beforeEach(async () => {
        opfsManager = new OPFSManager();
        // Clear any existing files
        try {
            await opfsManager.clearAllFiles();
        } catch (error) {
            // Ignore if OPFS not supported
        }
    });

    afterEach(async () => {
        // Clean up after tests
        try {
            await opfsManager.clearAllFiles();
        } catch (error) {
            // Ignore if OPFS not supported
        }
    });

    describe('clearAllFiles() method', () => {
        // Requirements: 1.6
        it('should clear all files and return count', async () => {
            // Skip if OPFS not supported
            if (!navigator.storage || !navigator.storage.getDirectory) {
                return;
            }

            // Create some test files
            const blob1 = new Blob(['test content 1'], { type: 'text/plain' });
            const blob2 = new Blob(['test content 2'], { type: 'text/plain' });

            await opfsManager.saveAsset('test-file-1.txt', blob1);
            await opfsManager.saveAsset('test-file-2.txt', blob2);

            // Clear all files
            const count = await opfsManager.clearAllFiles();

            // Should return count of deleted files
            expect(count).toBeGreaterThanOrEqual(2);

            // Verify files are deleted
            const exists1 = await opfsManager.assetExists('test-file-1.txt');
            const exists2 = await opfsManager.assetExists('test-file-2.txt');
            expect(exists1).toBe(false);
            expect(exists2).toBe(false);
        });

        it('should return 0 when no files exist', async () => {
            // Skip if OPFS not supported
            if (!navigator.storage || !navigator.storage.getDirectory) {
                return;
            }

            const count = await opfsManager.clearAllFiles();
            expect(count).toBe(0);
        });

        it('should handle OPFS not supported gracefully', async () => {
            // If OPFS is not supported, should return 0 without throwing
            const count = await opfsManager.clearAllFiles();
            expect(typeof count).toBe('number');
            expect(count).toBeGreaterThanOrEqual(0);
        });
    });

    describe('getTotalSize() method', () => {
        // Requirements: 1.6
        it('should calculate total OPFS usage', async () => {
            // Skip if OPFS not supported
            if (!navigator.storage || !navigator.storage.getDirectory) {
                return;
            }

            // Create test files with known sizes
            const content1 = 'a'.repeat(100); // 100 bytes
            const content2 = 'b'.repeat(200); // 200 bytes
            const blob1 = new Blob([content1], { type: 'text/plain' });
            const blob2 = new Blob([content2], { type: 'text/plain' });

            await opfsManager.saveAsset('test-size-1.txt', blob1);
            await opfsManager.saveAsset('test-size-2.txt', blob2);

            const totalSize = await opfsManager.getTotalSize();

            // Should be at least 300 bytes
            expect(totalSize).toBeGreaterThanOrEqual(300);
        });

        it('should return 0 for empty OPFS', async () => {
            // Skip if OPFS not supported
            if (!navigator.storage || !navigator.storage.getDirectory) {
                return;
            }

            const totalSize = await opfsManager.getTotalSize();
            expect(totalSize).toBe(0);
        });

        it('should handle OPFS not supported gracefully', async () => {
            const totalSize = await opfsManager.getTotalSize();
            expect(typeof totalSize).toBe('number');
            expect(totalSize).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Recursive deletion', () => {
        // Requirements: 1.6
        it('should handle files in root directory', async () => {
            // Skip if OPFS not supported
            if (!navigator.storage || !navigator.storage.getDirectory) {
                return;
            }

            const blob = new Blob(['test'], { type: 'text/plain' });
            await opfsManager.saveAsset('root-file.txt', blob);

            const count = await opfsManager.clearAllFiles();
            expect(count).toBeGreaterThanOrEqual(1);

            const exists = await opfsManager.assetExists('root-file.txt');
            expect(exists).toBe(false);
        });
    });

    describe('Integration with existing methods', () => {
        it('should work with saveAsset and loadAsset', async () => {
            // Skip if OPFS not supported
            if (!navigator.storage || !navigator.storage.getDirectory) {
                return;
            }

            const content = 'integration test content';
            const blob = new Blob([content], { type: 'text/plain' });

            await opfsManager.saveAsset('integration-test.txt', blob);

            // Verify file exists
            const exists = await opfsManager.assetExists('integration-test.txt');
            expect(exists).toBe(true);

            // Load and verify content
            const loadedBlob = await opfsManager.loadAsset('integration-test.txt');
            const loadedText = await loadedBlob.text();
            expect(loadedText).toBe(content);

            // Clear and verify deletion
            const count = await opfsManager.clearAllFiles();
            expect(count).toBeGreaterThanOrEqual(1);

            const existsAfter = await opfsManager.assetExists('integration-test.txt');
            expect(existsAfter).toBe(false);
        });

        it('should calculate size correctly after adding files', async () => {
            // Skip if OPFS not supported
            if (!navigator.storage || !navigator.storage.getDirectory) {
                return;
            }

            const initialSize = await opfsManager.getTotalSize();

            const content = 'x'.repeat(500);
            const blob = new Blob([content], { type: 'text/plain' });
            await opfsManager.saveAsset('size-test.txt', blob);

            const newSize = await opfsManager.getTotalSize();
            expect(newSize).toBeGreaterThan(initialSize);
            expect(newSize - initialSize).toBeGreaterThanOrEqual(500);
        });
    });
});
