import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { SettingsManager, DEFAULT_SETTINGS, type Settings } from '../../src/storage/settings-manager';
import { StorageManager } from '../../src/storage/storage-manager';

describe('Settings Properties', () => {
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

    describe('Property 7: Settings Persistence Round-Trip', () => {
        // Feature: critical-fixes, Property 7: Settings Persistence Round-Trip
        // Validates: Requirements 6.4

        it('should preserve all settings through save and load cycle', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.record({
                        temperature: fc.double({ min: 0, max: 2, noNaN: true }),
                        topK: fc.integer({ min: 1, max: 100 }),
                        enableTextChat: fc.boolean(),
                        enableImageGeneration: fc.boolean(),
                        enableVision: fc.boolean(),
                        enableSpeech: fc.boolean(),
                        enableWebSearch: fc.boolean(),
                        searchApiKey: fc.string({ maxLength: 100 }),
                        searchProvider: fc.constantFrom('brave', 'google'),
                        googleSearchApiKey: fc.string({ maxLength: 100 }),
                        googleSearchEngineId: fc.string({ maxLength: 100 }),
                        theme: fc.constantFrom('light', 'dark', 'auto'),
                        preferredProvider: fc.constantFrom('chrome', 'webllm', 'api', 'auto')
                    }),
                    async (settings: Settings) => {
                        // Save all settings
                        for (const [key, value] of Object.entries(settings)) {
                            await settingsManager.set(key, value);
                        }

                        // Simulate page reload by creating new manager
                        const newManager = new SettingsManager(storageManager);

                        // Load all settings
                        const loadedSettings = await newManager.getAll();

                        // Property: loaded settings should equal saved settings
                        expect(loadedSettings.temperature).toBeCloseTo(settings.temperature, 10);
                        expect(loadedSettings.topK).toBe(settings.topK);
                        expect(loadedSettings.enableTextChat).toBe(settings.enableTextChat);
                        expect(loadedSettings.enableImageGeneration).toBe(settings.enableImageGeneration);
                        expect(loadedSettings.enableVision).toBe(settings.enableVision);
                        expect(loadedSettings.enableSpeech).toBe(settings.enableSpeech);
                        expect(loadedSettings.enableWebSearch).toBe(settings.enableWebSearch);
                        expect(loadedSettings.searchApiKey).toBe(settings.searchApiKey);
                        expect(loadedSettings.searchProvider).toBe(settings.searchProvider);
                        expect(loadedSettings.googleSearchApiKey).toBe(settings.googleSearchApiKey);
                        expect(loadedSettings.googleSearchEngineId).toBe(settings.googleSearchEngineId);
                        expect(loadedSettings.theme).toBe(settings.theme);
                        expect(loadedSettings.preferredProvider).toBe(settings.preferredProvider);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should preserve individual settings through save and load cycle', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.constantFrom(
                        'temperature',
                        'topK',
                        'enableTextChat',
                        'enableImageGeneration',
                        'enableVision',
                        'enableSpeech',
                        'enableWebSearch',
                        'searchApiKey',
                        'searchProvider',
                        'googleSearchApiKey',
                        'googleSearchEngineId',
                        'theme',
                        'preferredProvider'
                    ),
                    fc.oneof(
                        fc.double({ min: 0, max: 2, noNaN: true }),
                        fc.integer({ min: 1, max: 100 }),
                        fc.boolean(),
                        fc.string({ maxLength: 100 }),
                        fc.constantFrom('brave', 'google', 'light', 'dark', 'auto', 'chrome', 'webllm', 'api')
                    ),
                    async (key: string, value: any) => {
                        // Save setting
                        await settingsManager.set(key, value);

                        // Simulate page reload
                        const newManager = new SettingsManager(storageManager);

                        // Load setting with appropriate default
                        const defaultValue = (DEFAULT_SETTINGS as any)[key];
                        const loadedValue = await newManager.get(key, defaultValue);

                        // Property: loaded value should equal saved value
                        if (typeof value === 'number' && !Number.isInteger(value)) {
                            expect(loadedValue).toBeCloseTo(value, 10);
                        } else {
                            expect(loadedValue).toEqual(value);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should handle partial settings updates without losing other settings', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.record({
                        temperature: fc.double({ min: 0, max: 2, noNaN: true }),
                        topK: fc.integer({ min: 1, max: 100 }),
                        enableWebSearch: fc.boolean()
                    }),
                    fc.record({
                        enableImageGeneration: fc.boolean(),
                        theme: fc.constantFrom('light', 'dark', 'auto')
                    }),
                    async (firstBatch: any, secondBatch: any) => {
                        // Save first batch of settings
                        for (const [key, value] of Object.entries(firstBatch)) {
                            await settingsManager.set(key, value);
                        }

                        // Save second batch of settings
                        for (const [key, value] of Object.entries(secondBatch)) {
                            await settingsManager.set(key, value);
                        }

                        // Load all settings
                        const loadedSettings = await settingsManager.getAll();

                        // Property: both batches should be preserved
                        expect(loadedSettings.temperature).toBeCloseTo(firstBatch.temperature, 10);
                        expect(loadedSettings.topK).toBe(firstBatch.topK);
                        expect(loadedSettings.enableWebSearch).toBe(firstBatch.enableWebSearch);
                        expect(loadedSettings.enableImageGeneration).toBe(secondBatch.enableImageGeneration);
                        expect(loadedSettings.theme).toBe(secondBatch.theme);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('Property 8: Hardware-Based Default Enablement', () => {
        // Feature: critical-fixes, Property 8: Hardware-Based Default Enablement
        // Validates: Requirements 6.2, 6.3

        it('should enable image generation by default when hardware supports it', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.record({
                        ram: fc.oneof(fc.constant(null), fc.integer({ min: 8, max: 64 })),
                        ramDetectionMethod: fc.constantFrom('deviceMemory', 'performance', 'unknown'),
                        cpuCores: fc.integer({ min: 4, max: 32 }), // image-generation requires 4+ cores
                        storageAvailable: fc.integer({ min: 22, max: 1000 }),
                        storageDetectionMethod: fc.constantFrom('estimate', 'fallback', 'unknown'),
                        gpuVRAM: fc.integer({ min: 4, max: 24 }),
                        webGPUSupported: fc.constant(true),
                        gpuPerformanceScore: fc.integer({ min: 1, max: 100 }),
                        browserName: fc.constantFrom('Chrome', 'Firefox', 'Safari', 'Edge', 'Brave'),
                        timestamp: fc.integer({ min: 0, max: Date.now() })
                    }),
                    async (hardwareProfile: any) => {
                        // Clear all data for fresh start
                        await storageManager.clearAllData();

                        // Create new settings manager
                        const newManager = new SettingsManager(storageManager);

                        // Initialize with hardware profile (first run)
                        await newManager.initialize(hardwareProfile);

                        // Load settings
                        const settings = await newManager.getAll();

                        // Property: image generation should be enabled when hardware supports it
                        // Requirements: RAM >= 8GB, VRAM >= 4GB, CPU >= 4 cores, storage >= 10GB, WebGPU supported
                        const shouldEnableImageGen =
                            (hardwareProfile.ram === null || hardwareProfile.ram >= 8) &&
                            hardwareProfile.gpuVRAM >= 4 &&
                            hardwareProfile.cpuCores >= 4 &&
                            hardwareProfile.storageAvailable >= 10 &&
                            hardwareProfile.webGPUSupported;

                        if (shouldEnableImageGen) {
                            expect(settings.enableImageGeneration).toBe(true);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should enable vision by default when hardware supports it', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.record({
                        ram: fc.oneof(fc.constant(null), fc.integer({ min: 6, max: 64 })),
                        ramDetectionMethod: fc.constantFrom('deviceMemory', 'performance', 'unknown'),
                        cpuCores: fc.integer({ min: 4, max: 32 }), // vision requires 4+ cores
                        storageAvailable: fc.integer({ min: 22, max: 1000 }),
                        storageDetectionMethod: fc.constantFrom('estimate', 'fallback', 'unknown'),
                        gpuVRAM: fc.integer({ min: 2, max: 24 }),
                        webGPUSupported: fc.constant(true),
                        gpuPerformanceScore: fc.integer({ min: 1, max: 100 }),
                        browserName: fc.constantFrom('Chrome', 'Firefox', 'Safari', 'Edge', 'Brave'),
                        timestamp: fc.integer({ min: 0, max: Date.now() })
                    }),
                    async (hardwareProfile: any) => {
                        // Clear all data for fresh start
                        await storageManager.clearAllData();

                        // Create new settings manager
                        const newManager = new SettingsManager(storageManager);

                        // Initialize with hardware profile (first run)
                        await newManager.initialize(hardwareProfile);

                        // Load settings
                        const settings = await newManager.getAll();

                        // Property: vision should be enabled when hardware supports it
                        // Requirements: RAM >= 6GB, VRAM >= 2GB, CPU >= 4 cores, storage >= 5GB, WebGPU supported
                        const shouldEnableVision =
                            (hardwareProfile.ram === null || hardwareProfile.ram >= 6) &&
                            hardwareProfile.gpuVRAM >= 2 &&
                            hardwareProfile.cpuCores >= 4 &&
                            hardwareProfile.storageAvailable >= 5 &&
                            hardwareProfile.webGPUSupported;

                        if (shouldEnableVision) {
                            expect(settings.enableVision).toBe(true);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should always enable text chat regardless of hardware', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.record({
                        ram: fc.oneof(fc.constant(null), fc.integer({ min: 1, max: 64 })),
                        ramDetectionMethod: fc.constantFrom('deviceMemory', 'performance', 'unknown'),
                        cpuCores: fc.integer({ min: 1, max: 32 }),
                        storageAvailable: fc.integer({ min: 0, max: 1000 }),
                        storageDetectionMethod: fc.constantFrom('estimate', 'fallback', 'unknown'),
                        gpuVRAM: fc.integer({ min: 0, max: 24 }),
                        webGPUSupported: fc.boolean(),
                        gpuPerformanceScore: fc.integer({ min: 0, max: 100 }),
                        browserName: fc.constantFrom('Chrome', 'Firefox', 'Safari', 'Edge', 'Brave'),
                        timestamp: fc.integer({ min: 0, max: Date.now() })
                    }),
                    async (hardwareProfile: any) => {
                        // Clear all data for fresh start
                        await storageManager.clearAllData();

                        // Create new settings manager
                        const newManager = new SettingsManager(storageManager);

                        // Initialize with hardware profile (first run)
                        await newManager.initialize(hardwareProfile);

                        // Load settings
                        const settings = await newManager.getAll();

                        // Property: text chat should always be enabled
                        expect(settings.enableTextChat).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should not override user settings on subsequent runs', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.record({
                        ram: fc.integer({ min: 8, max: 64 }),
                        ramDetectionMethod: fc.constantFrom('deviceMemory', 'performance', 'unknown'),
                        cpuCores: fc.integer({ min: 1, max: 32 }),
                        storageAvailable: fc.integer({ min: 22, max: 1000 }),
                        storageDetectionMethod: fc.constantFrom('estimate', 'fallback', 'unknown'),
                        gpuVRAM: fc.integer({ min: 4, max: 24 }),
                        webGPUSupported: fc.constant(true),
                        gpuPerformanceScore: fc.integer({ min: 1, max: 100 }),
                        browserName: fc.constantFrom('Chrome', 'Firefox', 'Safari', 'Edge', 'Brave'),
                        timestamp: fc.integer({ min: 0, max: Date.now() })
                    }),
                    fc.boolean(),
                    async (hardwareProfile: any, userChoice: boolean) => {
                        // Clear all data for fresh start
                        await storageManager.clearAllData();

                        // First run - apply defaults
                        const firstManager = new SettingsManager(storageManager);
                        await firstManager.initialize(hardwareProfile);

                        // User changes the setting
                        await firstManager.set('enableImageGeneration', userChoice);

                        // Second run - should not override user choice
                        const secondManager = new SettingsManager(storageManager);
                        await secondManager.initialize(hardwareProfile);

                        const settings = await secondManager.getAll();

                        // Property: user's choice should be preserved
                        expect(settings.enableImageGeneration).toBe(userChoice);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});
