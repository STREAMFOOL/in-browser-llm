

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BrowserCompatibilityChecker } from '../../src/utils/browser-compatibility';

describe('BrowserCompatibilityChecker', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    describe('checkPromptAPI', () => {
        // Requirement 1.2: Test API availability detection
        it('should detect when Prompt API is available', () => {
            const result = BrowserCompatibilityChecker.checkPromptAPI();

            // In test environment, window.ai is mocked in setup.ts
            expect(result.available).toBe(true);
            expect(result.passed).toBe(true);
            expect(result.message).toContain('available');
        });

        it('should detect when Prompt API is not available', () => {
            const originalAI = (window as any).ai;
            delete (window as any).ai;

            const result = BrowserCompatibilityChecker.checkPromptAPI();

            expect(result.available).toBe(false);
            expect(result.passed).toBe(false);
            expect(result.message).toContain('not available');
            expect(result.message).toContain('chrome://flags');

            // Restore
            (window as any).ai = originalAI;
        });

        it('should handle null window.ai', () => {
            const originalAI = (window as any).ai;
            (window as any).ai = null;

            const result = BrowserCompatibilityChecker.checkPromptAPI();

            expect(result.available).toBe(false);
            expect(result.passed).toBe(false);

            // Restore
            (window as any).ai = originalAI;
        });

        it('should handle window.ai without languageModel', () => {
            const originalAI = (window as any).ai;
            (window as any).ai = {};

            const result = BrowserCompatibilityChecker.checkPromptAPI();

            expect(result.available).toBe(false);
            expect(result.passed).toBe(false);

            // Restore
            (window as any).ai = originalAI;
        });
    });

    describe('checkChromeVersion - Error Messages', () => {
        // Requirement 1.5: Test error messages for incompatible browsers
        it('should display error message for Chrome version below 127', () => {
            const originalUserAgent = navigator.userAgent;
            Object.defineProperty(navigator, 'userAgent', {
                value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                configurable: true
            });

            const result = BrowserCompatibilityChecker.checkChromeVersion();

            expect(result.passed).toBe(false);
            expect(result.message).toContain('upgrade');
            expect(result.message).toContain('127');

            Object.defineProperty(navigator, 'userAgent', {
                value: originalUserAgent,
                configurable: true
            });
        });

        it('should display error message for non-Chrome browsers', () => {
            const originalUserAgent = navigator.userAgent;
            Object.defineProperty(navigator, 'userAgent', {
                value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0',
                configurable: true
            });

            const result = BrowserCompatibilityChecker.checkChromeVersion();

            expect(result.passed).toBe(false);
            expect(result.detected).toBe(null);
            expect(result.message).toContain('Chrome browser not detected');
            expect(result.message).toContain('requires Chrome 127');

            Object.defineProperty(navigator, 'userAgent', {
                value: originalUserAgent,
                configurable: true
            });
        });

        it('should display success message for compatible Chrome version', () => {
            const originalUserAgent = navigator.userAgent;
            Object.defineProperty(navigator, 'userAgent', {
                value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                configurable: true
            });

            const result = BrowserCompatibilityChecker.checkChromeVersion();

            expect(result.passed).toBe(true);
            expect(result.detected).toBe(130);
            expect(result.message).toContain('compatible');

            Object.defineProperty(navigator, 'userAgent', {
                value: originalUserAgent,
                configurable: true
            });
        });
    });

    describe('checkStorage - Error Messages', () => {
        // Requirement 1.6: Test warning messages for insufficient storage
        it('should display warning when storage is below 22 GB', async () => {
            const mockEstimate = vi.fn().mockResolvedValue({
                quota: 15 * 1024 ** 3,
                usage: 0
            });

            const originalStorage = navigator.storage;
            Object.defineProperty(navigator, 'storage', {
                value: {
                    estimate: mockEstimate
                },
                configurable: true
            });

            const result = await BrowserCompatibilityChecker.checkStorage();

            expect(result.passed).toBe(false);
            expect(result.available).toBeLessThan(22);
            expect(result.message).toContain('GB available');
            expect(result.message).toContain('22 GB required');
            expect(result.message).toContain('model downloads');

            Object.defineProperty(navigator, 'storage', {
                value: originalStorage,
                configurable: true
            });
        });

        it('should display success message when storage is sufficient', async () => {
            const mockEstimate = vi.fn().mockResolvedValue({
                quota: 50 * 1024 ** 3,
                usage: 0
            });

            const originalStorage = navigator.storage;
            Object.defineProperty(navigator, 'storage', {
                value: {
                    estimate: mockEstimate
                },
                configurable: true
            });

            const result = await BrowserCompatibilityChecker.checkStorage();

            expect(result.passed).toBe(true);
            expect(result.available).toBeGreaterThanOrEqual(22);
            expect(result.message).toContain('sufficient');

            Object.defineProperty(navigator, 'storage', {
                value: originalStorage,
                configurable: true
            });
        });

        it('should handle Storage API not available', async () => {
            const originalStorage = navigator.storage;
            Object.defineProperty(navigator, 'storage', {
                value: undefined,
                configurable: true
            });

            const result = await BrowserCompatibilityChecker.checkStorage();

            expect(result.passed).toBe(false);
            expect(result.available).toBe(0);
            expect(result.message).toContain('Storage API not available');

            Object.defineProperty(navigator, 'storage', {
                value: originalStorage,
                configurable: true
            });
        });
    });

    describe('detectHardware', () => {
        // Requirement 1.4: Test hardware detection
        it('should detect RAM using navigator.deviceMemory', () => {
            const result = BrowserCompatibilityChecker.detectHardware();

            // deviceMemory may or may not be available in test environment
            const nav = navigator as Navigator & { deviceMemory?: number };
            if (nav.deviceMemory) {
                expect(result.ram).toBe(nav.deviceMemory);
            } else {
                expect(result.ram).toBe(null);
            }
        });

        it('should detect CPU cores using navigator.hardwareConcurrency', () => {
            const result = BrowserCompatibilityChecker.detectHardware();

            // hardwareConcurrency should be available in most environments
            if (navigator.hardwareConcurrency) {
                expect(result.cpuCores).toBe(navigator.hardwareConcurrency);
                expect(result.cpuCores).toBeGreaterThan(0);
            } else {
                expect(result.cpuCores).toBe(null);
            }
        });
    });

    describe('checkCompatibility', () => {
        it('should aggregate all checks and return overall compatibility', async () => {
            const result = await BrowserCompatibilityChecker.checkCompatibility();

            expect(result).toHaveProperty('compatible');
            expect(result).toHaveProperty('checks');
            expect(result).toHaveProperty('errors');
            expect(result).toHaveProperty('warnings');

            expect(result.checks).toHaveProperty('chromeVersion');
            expect(result.checks).toHaveProperty('promptAPI');
            expect(result.checks).toHaveProperty('storage');
            expect(result.checks).toHaveProperty('hardware');
        });

        it('should mark as incompatible if Chrome version fails', async () => {
            const originalUserAgent = navigator.userAgent;
            Object.defineProperty(navigator, 'userAgent', {
                value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0',
                configurable: true
            });

            const result = await BrowserCompatibilityChecker.checkCompatibility();

            expect(result.compatible).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors.some(e => e.includes('Chrome'))).toBe(true);

            Object.defineProperty(navigator, 'userAgent', {
                value: originalUserAgent,
                configurable: true
            });
        });

        it('should mark as incompatible if Prompt API is unavailable', async () => {
            const originalAI = (window as any).ai;
            delete (window as any).ai;

            const result = await BrowserCompatibilityChecker.checkCompatibility();

            expect(result.compatible).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors.some(e => e.includes('Prompt API'))).toBe(true);

            (window as any).ai = originalAI;
        });

        it('should add warnings for insufficient storage but not mark as incompatible', async () => {
            const mockEstimate = vi.fn().mockResolvedValue({
                quota: 10 * 1024 ** 3,
                usage: 0
            });

            const originalStorage = navigator.storage;
            Object.defineProperty(navigator, 'storage', {
                value: {
                    estimate: mockEstimate
                },
                configurable: true
            });

            const result = await BrowserCompatibilityChecker.checkCompatibility();

            // Storage is a warning, not a hard error
            expect(result.warnings.length).toBeGreaterThan(0);
            expect(result.warnings.some(w => w.includes('GB'))).toBe(true);

            Object.defineProperty(navigator, 'storage', {
                value: originalStorage,
                configurable: true
            });
        });
    });
});
