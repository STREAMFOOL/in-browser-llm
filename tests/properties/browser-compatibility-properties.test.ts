/**
 * Property-Based Tests for Browser Compatibility
 * Feature: local-ai-assistant
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { BrowserCompatibilityChecker } from '../../src/browser-compatibility';

describe('Browser Compatibility Properties', () => {
    beforeEach(() => {
        // Reset mocks before each test
        vi.restoreAllMocks();
    });

    describe('Property 1: Version Validation Correctness', () => {
        // Feature: local-ai-assistant, Property 1: Version Validation Correctness
        // Validates: Requirements 1.1, 1.5
        it('should correctly identify versions >= 127 as compatible and < 127 as incompatible', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 1, max: 200 }),
                    (version) => {
                        // Mock navigator.userAgent with the test version
                        const originalUserAgent = navigator.userAgent;
                        Object.defineProperty(navigator, 'userAgent', {
                            value: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36`,
                            configurable: true
                        });

                        const result = BrowserCompatibilityChecker.checkChromeVersion();

                        // Restore original userAgent
                        Object.defineProperty(navigator, 'userAgent', {
                            value: originalUserAgent,
                            configurable: true
                        });

                        // Property: versions >= 127 should pass, versions < 127 should fail
                        if (version >= 127) {
                            expect(result.passed).toBe(true);
                            expect(result.detected).toBe(version);
                            expect(result.message).toContain('compatible');
                        } else {
                            expect(result.passed).toBe(false);
                            expect(result.detected).toBe(version);
                            expect(result.message).toContain('upgrade');
                        }

                        // Invariant: detected version should always match input
                        expect(result.detected).toBe(version);
                        expect(result.required).toBe(127);
                    }
                ),
                { numRuns: 100 }
            );
        });

        // Feature: local-ai-assistant, Property 1: Version Validation Correctness
        // Validates: Requirements 1.1, 1.5
        it('should handle non-Chrome browsers correctly', () => {
            fc.assert(
                fc.property(
                    fc.constantFrom(
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0',
                        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15',
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/115.0.0.0'
                    ),
                    (userAgent) => {
                        const originalUserAgent = navigator.userAgent;
                        Object.defineProperty(navigator, 'userAgent', {
                            value: userAgent,
                            configurable: true
                        });

                        const result = BrowserCompatibilityChecker.checkChromeVersion();

                        Object.defineProperty(navigator, 'userAgent', {
                            value: originalUserAgent,
                            configurable: true
                        });

                        // Property: non-Chrome browsers should fail
                        expect(result.passed).toBe(false);
                        expect(result.detected).toBe(null);
                        expect(result.message).toContain('Chrome browser not detected');
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('Property 2: Storage Threshold Validation', () => {
        // Feature: local-ai-assistant, Property 2: Storage Threshold Validation
        // Validates: Requirements 1.3, 1.6
        it('should correctly identify storage >= 22 GB as sufficient and < 22 GB as insufficient', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.float({ min: 0, max: 100, noNaN: true }),
                    async (storageGB) => {
                        // Mock navigator.storage.estimate
                        const mockEstimate = vi.fn().mockResolvedValue({
                            quota: storageGB * 1024 ** 3,
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

                        // Restore original storage
                        Object.defineProperty(navigator, 'storage', {
                            value: originalStorage,
                            configurable: true
                        });

                        // Property: storage >= 22 GB should pass, < 22 GB should fail
                        if (storageGB >= 22) {
                            expect(result.passed).toBe(true);
                            expect(result.message).toContain('sufficient');
                        } else {
                            expect(result.passed).toBe(false);
                            expect(result.message).toContain('required');
                        }

                        // Invariant: available storage should be approximately the input
                        expect(result.available).toBeGreaterThanOrEqual(storageGB - 0.2);
                        expect(result.available).toBeLessThanOrEqual(storageGB + 0.2);
                        expect(result.required).toBe(22);
                    }
                ),
                { numRuns: 100 }
            );
        });

        // Feature: local-ai-assistant, Property 2: Storage Threshold Validation
        // Validates: Requirements 1.3, 1.6
        it('should handle storage with usage correctly', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.float({ min: 25, max: 100, noNaN: true }),
                    fc.float({ min: 0, max: 20, noNaN: true }),
                    async (quotaGB, usageGB) => {
                        const quotaBytes = quotaGB * 1024 ** 3;
                        const usageBytes = usageGB * 1024 ** 3;
                        const availableGB = quotaGB - usageGB;

                        const mockEstimate = vi.fn().mockResolvedValue({
                            quota: quotaBytes,
                            usage: usageBytes
                        });

                        const originalStorage = navigator.storage;
                        Object.defineProperty(navigator, 'storage', {
                            value: {
                                estimate: mockEstimate
                            },
                            configurable: true
                        });

                        const result = await BrowserCompatibilityChecker.checkStorage();

                        Object.defineProperty(navigator, 'storage', {
                            value: originalStorage,
                            configurable: true
                        });

                        // Property: available = quota - usage
                        expect(result.available).toBeGreaterThanOrEqual(availableGB - 0.2);
                        expect(result.available).toBeLessThanOrEqual(availableGB + 0.2);

                        // Property: pass/fail based on available, not quota
                        if (availableGB >= 22) {
                            expect(result.passed).toBe(true);
                        } else {
                            expect(result.passed).toBe(false);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});
