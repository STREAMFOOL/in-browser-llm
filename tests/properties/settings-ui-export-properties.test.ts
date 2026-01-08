import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { SettingsUI, type SettingsConfig, type SettingsCallbacks } from '../../src/ui/settings-ui';

describe('Settings UI Export Properties', () => {
    describe('Property 8: Export API Preservation', () => {
        // Feature: code-reorganization, Property 8: Export API Preservation
        // Validates: Requirements 5.2

        it('should export SettingsUI class', () => {
            expect(SettingsUI).toBeDefined();
            expect(typeof SettingsUI).toBe('function');
        });

        it('should export SettingsConfig type', () => {
            // Type exports can't be tested directly, but we can verify the interface structure
            const config: SettingsConfig = {
                temperature: 0.7,
                topK: 40,
                enabledFeatures: ['text-chat']
            };

            expect(config).toBeDefined();
            expect(typeof config.temperature).toBe('number');
            expect(typeof config.topK).toBe('number');
            expect(Array.isArray(config.enabledFeatures)).toBe(true);
        });

        it('should export SettingsCallbacks type', () => {
            // Type exports can't be tested directly, but we can verify the interface structure
            const callbacks: SettingsCallbacks = {
                onProviderSwitch: async () => { },
                onSettingsChange: () => { },
                onClearData: async () => { },
                onResetApplication: async () => { }
            };

            expect(callbacks).toBeDefined();
            expect(typeof callbacks.onProviderSwitch).toBe('function');
            expect(typeof callbacks.onSettingsChange).toBe('function');
            expect(typeof callbacks.onClearData).toBe('function');
            expect(typeof callbacks.onResetApplication).toBe('function');
        });

        it('should create SettingsUI instance with required methods', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.constant(null),
                    async () => {
                        const container = document.createElement('div');
                        const callbacks: SettingsCallbacks = {
                            onProviderSwitch: async () => { },
                            onSettingsChange: () => { },
                            onClearData: async () => { },
                            onResetApplication: async () => { }
                        };
                        const config: SettingsConfig = {
                            temperature: 0.7,
                            topK: 40,
                            enabledFeatures: ['text-chat']
                        };

                        const settingsUI = new SettingsUI(container, callbacks, config);

                        // Verify all required methods exist
                        expect(typeof settingsUI.render).toBe('function');
                        expect(typeof settingsUI.updateConfig).toBe('function');
                        expect(typeof settingsUI.getConfig).toBe('function');
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should preserve config through updateConfig and getConfig', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.record({
                        temperature: fc.double({ min: 0, max: 1 }),
                        topK: fc.integer({ min: 1, max: 100 }),
                        enabledFeatures: fc.array(fc.constantFrom('text-chat', 'image-generation', 'vision', 'speech'))
                    }),
                    async (config: SettingsConfig) => {
                        const container = document.createElement('div');
                        const callbacks: SettingsCallbacks = {
                            onProviderSwitch: async () => { },
                            onSettingsChange: () => { },
                            onClearData: async () => { },
                            onResetApplication: async () => { }
                        };

                        const settingsUI = new SettingsUI(container, callbacks, config);
                        settingsUI.updateConfig(config);
                        const retrievedConfig = settingsUI.getConfig();

                        // Verify config is preserved
                        expect(retrievedConfig.temperature).toBe(config.temperature);
                        expect(retrievedConfig.topK).toBe(config.topK);
                        expect(retrievedConfig.enabledFeatures).toEqual(config.enabledFeatures);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should maintain API compatibility across multiple instances', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.constant(null),
                    async () => {
                        const container1 = document.createElement('div');
                        const container2 = document.createElement('div');
                        const callbacks: SettingsCallbacks = {
                            onProviderSwitch: async () => { },
                            onSettingsChange: () => { },
                            onClearData: async () => { },
                            onResetApplication: async () => { }
                        };
                        const config: SettingsConfig = {
                            temperature: 0.7,
                            topK: 40,
                            enabledFeatures: ['text-chat']
                        };

                        const settingsUI1 = new SettingsUI(container1, callbacks, config);
                        const settingsUI2 = new SettingsUI(container2, callbacks, config);

                        // Both instances should have the same API
                        expect(typeof settingsUI1.render).toBe(typeof settingsUI2.render);
                        expect(typeof settingsUI1.updateConfig).toBe(typeof settingsUI2.updateConfig);
                        expect(typeof settingsUI1.getConfig).toBe(typeof settingsUI2.getConfig);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});
