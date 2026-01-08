import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getMainStyles, getBaseStyles, getComponentStyles, getThemeStyles, getAnimationStyles } from '../../src/styles/index';

describe('Styles Export Properties', () => {
    describe('Property 8: Export API Preservation', () => {
        // Feature: code-reorganization, Property 8: Export API Preservation
        // Validates: Requirements 5.2

        it('should export getMainStyles function', () => {
            expect(getMainStyles).toBeDefined();
            expect(typeof getMainStyles).toBe('function');
        });

        it('should export all individual style functions', () => {
            expect(getBaseStyles).toBeDefined();
            expect(typeof getBaseStyles).toBe('function');

            expect(getComponentStyles).toBeDefined();
            expect(typeof getComponentStyles).toBe('function');

            expect(getThemeStyles).toBeDefined();
            expect(typeof getThemeStyles).toBe('function');

            expect(getAnimationStyles).toBeDefined();
            expect(typeof getAnimationStyles).toBe('function');
        });

        it('should return non-empty strings from all style functions', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.constant(null),
                    async () => {
                        const mainStyles = getMainStyles();
                        const baseStyles = getBaseStyles();
                        const componentStyles = getComponentStyles();
                        const themeStyles = getThemeStyles();
                        const animationStyles = getAnimationStyles();

                        expect(typeof mainStyles).toBe('string');
                        expect(mainStyles.length).toBeGreaterThan(0);

                        expect(typeof baseStyles).toBe('string');
                        expect(baseStyles.length).toBeGreaterThan(0);

                        expect(typeof componentStyles).toBe('string');
                        expect(componentStyles.length).toBeGreaterThan(0);

                        expect(typeof themeStyles).toBe('string');
                        expect(themeStyles.length).toBeGreaterThan(0);

                        expect(typeof animationStyles).toBe('string');
                        expect(animationStyles.length).toBeGreaterThan(0);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should preserve all styles when combining individual style functions', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.constant(null),
                    async () => {
                        const mainStyles = getMainStyles();
                        const baseStyles = getBaseStyles();
                        const componentStyles = getComponentStyles();
                        const themeStyles = getThemeStyles();
                        const animationStyles = getAnimationStyles();

                        // Main styles should contain all individual styles
                        expect(mainStyles).toContain(baseStyles.trim());
                        expect(mainStyles).toContain(componentStyles.trim());
                        expect(mainStyles).toContain(themeStyles.trim());
                        expect(mainStyles).toContain(animationStyles.trim());
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should preserve critical CSS classes from original styles', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.constant(null),
                    async () => {
                        const mainStyles = getMainStyles();

                        // Check for critical classes that must be preserved
                        const criticalClasses = [
                            ':host',
                            '.ai-assistant-container',
                            '.ai-assistant-header',
                            '.ai-assistant-content',
                            '.ai-assistant-footer',
                            '.settings-panel',
                            '.message-list',
                            '.message-input',
                            '.send-button',
                            '@keyframes fadeIn',
                            '@keyframes blink',
                            '@keyframes pulse',
                            '@keyframes spin',
                            '.animate-fadeIn',
                            '.animate-blink',
                            '.animate-pulse',
                            '.animate-spin'
                        ];

                        for (const className of criticalClasses) {
                            expect(mainStyles).toContain(className);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should maintain consistent output across multiple calls', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.constant(null),
                    async () => {
                        const firstCall = getMainStyles();
                        const secondCall = getMainStyles();
                        const thirdCall = getMainStyles();

                        // All calls should return identical strings
                        expect(firstCall).toBe(secondCall);
                        expect(secondCall).toBe(thirdCall);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});
