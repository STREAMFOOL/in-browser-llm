import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SettingsManager, DEFAULT_SETTINGS } from '../../src/storage/settings-manager';
import { StorageManager } from '../../src/storage/storage-manager';

describe('SettingsManager Unit Tests', () => {
    let settingsManager: SettingsManager;
    let storageManager: StorageManager;

    beforeEach(async () => {
        storageManager = new StorageManager();
        await storageManager.clearAllData();
        settingsManager = new SettingsManager(storageManager);
    });

    afterEach(async () => {
        await storageManager.clearAllData();
    });

    describe('get() method with defaults', () => {
        // Requirements: 1.1, 1.2
        it('should return default value when setting does not exist', async () => {
            const value = await settingsManager.get('temperature', 0.7);
            expect(value).toBe(0.7);
        });

        it('should return stored value when setting exists', async () => {
            await storageManager.saveSetting('temperature', 0.9);
            const value = await settingsManager.get('temperature', 0.7);
            expect(value).toBe(0.9);
        });

        it('should cache retrieved values', async () => {
            await storageManager.saveSetting('topK', 50);

            // First call loads from storage
            const value1 = await settingsManager.get('topK', 40);
            expect(value1).toBe(50);

            // Clear storage but cache should still have value
            await storageManager.clearStore('settings');

            // Second call should return cached value
            const value2 = await settingsManager.get('topK', 40);
            expect(value2).toBe(50);
        });

        it('should handle different data types', async () => {
            await storageManager.saveSetting('enableWebSearch', true);
            await storageManager.saveSetting('theme', 'dark');
            await storageManager.saveSetting('temperature', 0.8);

            const boolValue = await settingsManager.get('enableWebSearch', false);
            const stringValue = await settingsManager.get('theme', 'auto');
            const numberValue = await settingsManager.get('temperature', 0.7);

            expect(boolValue).toBe(true);
            expect(stringValue).toBe('dark');
            expect(numberValue).toBe(0.8);
        });
    });

    describe('set() method with persistence', () => {
        // Requirements: 1.3, 1.4
        it('should persist setting to storage', async () => {
            await settingsManager.set('temperature', 0.9);

            // Verify it was saved to storage
            const value = await storageManager.loadSetting('temperature');
            expect(value).toBe(0.9);
        });

        it('should update cache when setting value', async () => {
            await settingsManager.set('topK', 50);

            // Clear storage to ensure we're reading from cache
            await storageManager.clearStore('settings');

            const value = await settingsManager.get('topK', 40);
            expect(value).toBe(50);
        });

        it('should persist different data types', async () => {
            await settingsManager.set('enableImageGeneration', true);
            await settingsManager.set('preferredProvider', 'webllm');
            await settingsManager.set('temperature', 0.5);

            const boolValue = await storageManager.loadSetting('enableImageGeneration');
            const stringValue = await storageManager.loadSetting('preferredProvider');
            const numberValue = await storageManager.loadSetting('temperature');

            expect(boolValue).toBe(true);
            expect(stringValue).toBe('webllm');
            expect(numberValue).toBe(0.5);
        });

        it('should overwrite existing values', async () => {
            await settingsManager.set('temperature', 0.7);
            await settingsManager.set('temperature', 0.9);

            const value = await storageManager.loadSetting('temperature');
            expect(value).toBe(0.9);
        });
    });

    describe('getAll() method', () => {
        // Requirements: 1.1, 1.2
        it('should return all settings with defaults', async () => {
            const settings = await settingsManager.getAll();

            expect(settings).toEqual(DEFAULT_SETTINGS);
        });

        it('should return stored values when they exist', async () => {
            await storageManager.saveSetting('temperature', 0.9);
            await storageManager.saveSetting('topK', 50);
            await storageManager.saveSetting('enableWebSearch', true);

            const settings = await settingsManager.getAll();

            expect(settings.temperature).toBe(0.9);
            expect(settings.topK).toBe(50);
            expect(settings.enableWebSearch).toBe(true);
            // Other settings should have defaults
            expect(settings.enableImageGeneration).toBe(DEFAULT_SETTINGS.enableImageGeneration);
            expect(settings.theme).toBe(DEFAULT_SETTINGS.theme);
        });

        it('should return complete Settings object', async () => {
            const settings = await settingsManager.getAll();

            // Verify all required properties exist
            expect(settings).toHaveProperty('temperature');
            expect(settings).toHaveProperty('topK');
            expect(settings).toHaveProperty('enableImageGeneration');
            expect(settings).toHaveProperty('enableSpeech');
            expect(settings).toHaveProperty('enableWebSearch');
            expect(settings).toHaveProperty('theme');
            expect(settings).toHaveProperty('preferredProvider');
        });
    });

    describe('resetToDefaults() method', () => {
        // Requirements: 1.4
        it('should reset all settings to defaults', async () => {
            // Set some custom values
            await settingsManager.set('temperature', 0.9);
            await settingsManager.set('topK', 50);
            await settingsManager.set('enableWebSearch', true);

            // Reset to defaults
            await settingsManager.resetToDefaults();

            // Verify all settings are back to defaults
            const settings = await settingsManager.getAll();
            expect(settings).toEqual(DEFAULT_SETTINGS);
        });

        it('should persist defaults to storage', async () => {
            await settingsManager.set('temperature', 0.9);
            await settingsManager.resetToDefaults();

            // Create new manager to verify persistence
            const newManager = new SettingsManager(storageManager);
            const value = await newManager.get('temperature', 0.5);

            expect(value).toBe(DEFAULT_SETTINGS.temperature);
        });

        it('should clear cache', async () => {
            await settingsManager.set('temperature', 0.9);
            await settingsManager.resetToDefaults();

            // Verify cache was cleared by checking internal state
            const settings = await settingsManager.getAll();
            expect(settings.temperature).toBe(DEFAULT_SETTINGS.temperature);
        });
    });

    describe('onChange() change notifications', () => {
        // Requirements: 1.3
        it('should notify listeners when setting changes', async () => {
            const listener = vi.fn();
            settingsManager.onChange(listener);

            await settingsManager.set('temperature', 0.9);

            expect(listener).toHaveBeenCalledWith('temperature', 0.9);
            expect(listener).toHaveBeenCalledTimes(1);
        });

        it('should notify multiple listeners', async () => {
            const listener1 = vi.fn();
            const listener2 = vi.fn();

            settingsManager.onChange(listener1);
            settingsManager.onChange(listener2);

            await settingsManager.set('topK', 50);

            expect(listener1).toHaveBeenCalledWith('topK', 50);
            expect(listener2).toHaveBeenCalledWith('topK', 50);
        });

        it('should notify listeners on resetToDefaults', async () => {
            const listener = vi.fn();
            settingsManager.onChange(listener);

            await settingsManager.resetToDefaults();

            // Should be called once for each default setting
            expect(listener).toHaveBeenCalled();
            expect(listener.mock.calls.length).toBe(Object.keys(DEFAULT_SETTINGS).length);
        });

        it('should handle listener errors gracefully', async () => {
            const errorListener = vi.fn(() => {
                throw new Error('Listener error');
            });
            const goodListener = vi.fn();

            settingsManager.onChange(errorListener);
            settingsManager.onChange(goodListener);

            // Should not throw despite error in first listener
            await expect(settingsManager.set('temperature', 0.9)).resolves.not.toThrow();

            // Both listeners should have been called
            expect(errorListener).toHaveBeenCalled();
            expect(goodListener).toHaveBeenCalled();
        });
    });

    describe('clearCache() method', () => {
        it('should clear the internal cache', async () => {
            await settingsManager.set('temperature', 0.9);

            // Verify it's cached
            await storageManager.clearStore('settings');
            let value = await settingsManager.get('temperature', 0.7);
            expect(value).toBe(0.9);

            // Clear cache
            settingsManager.clearCache();

            // Now should return default since cache is cleared and storage is empty
            value = await settingsManager.get('temperature', 0.7);
            expect(value).toBe(0.7);
        });
    });

    describe('Integration scenarios', () => {
        it('should handle complete settings lifecycle', async () => {
            // Set initial values
            await settingsManager.set('temperature', 0.9);
            await settingsManager.set('enableWebSearch', true);

            // Get all settings
            let settings = await settingsManager.getAll();
            expect(settings.temperature).toBe(0.9);
            expect(settings.enableWebSearch).toBe(true);

            // Reset to defaults
            await settingsManager.resetToDefaults();
            settings = await settingsManager.getAll();
            expect(settings).toEqual(DEFAULT_SETTINGS);

            // Set new values
            await settingsManager.set('topK', 60);
            settings = await settingsManager.getAll();
            expect(settings.topK).toBe(60);
        });

        it('should persist across manager instances', async () => {
            await settingsManager.set('temperature', 0.8);
            await settingsManager.set('theme', 'dark');

            // Create new manager instance
            const newManager = new SettingsManager(storageManager);
            const settings = await newManager.getAll();

            expect(settings.temperature).toBe(0.8);
            expect(settings.theme).toBe('dark');
        });
    });
});
