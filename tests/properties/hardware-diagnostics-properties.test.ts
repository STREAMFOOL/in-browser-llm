import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { HardwareDiagnostics, type HardwareProfile } from '../../src/utils/hardware-diagnostics';

describe('Hardware Diagnostics Properties', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        HardwareDiagnostics.clearCache();
    });

    describe('Property 1: Hardware Detection Graceful Degradation', () => {
        // Feature: critical-fixes, Property 1: Hardware Detection Graceful Degradation
        // Validates: Requirements 1.1, 1.3
        it('should return null RAM when navigator.deviceMemory is unavailable and still enable text-chat', async () => {
            fc.assert(
                fc.asyncProperty(
                    fc.integer({ min: 0, max: 100 }),
                    async (storageGB) => {
                        // Mock navigator without deviceMemory
                        const originalDeviceMemory = (navigator as any).deviceMemory;
                        delete (navigator as any).deviceMemory;

                        // Mock storage
                        const mockEstimate = vi.fn().mockResolvedValue({
                            quota: storageGB * 1024 ** 3,
                            usage: 0
                        });

                        const originalStorage = navigator.storage;
                        Object.defineProperty(navigator, 'storage', {
                            value: {
                                estimate: mockEstimate,
                                persist: vi.fn().mockResolvedValue(true)
                            },
                            configurable: true
                        });

                        // Mock GPU as unavailable
                        const originalGPU = navigator.gpu;
                        Object.defineProperty(navigator, 'gpu', {
                            value: undefined,
                            configurable: true
                        });

                        try {
                            const profile = await HardwareDiagnostics.detectCapabilities();

                            // Property 1: RAM should be null when unavailable
                            expect(profile.ram).toBeNull();
                            expect(profile.ramDetectionMethod).toBe('unknown');

                            // Property 2: Text-chat should still be supported despite unknown RAM
                            const canSupportTextChat = HardwareDiagnostics.canSupport('text-chat', profile);
                            expect(canSupportTextChat).toBe(true);

                            // Property 3: Storage should not be negative
                            expect(profile.storageAvailable).toBeGreaterThanOrEqual(0);
                        } finally {
                            // Restore
                            if (originalDeviceMemory !== undefined) {
                                (navigator as any).deviceMemory = originalDeviceMemory;
                            }
                            Object.defineProperty(navigator, 'storage', {
                                value: originalStorage,
                                configurable: true
                            });
                            Object.defineProperty(navigator, 'gpu', {
                                value: originalGPU,
                                configurable: true
                            });
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        // Feature: critical-fixes, Property 1: Hardware Detection Graceful Degradation
        // Validates: Requirements 1.1, 1.3
        it('should not disable features when RAM is unknown', async () => {
            fc.assert(
                fc.asyncProperty(
                    fc.constantFrom('text-chat', 'image-generation', 'vision', 'speech', 'video'),
                    async (feature) => {
                        // Create a profile with null RAM
                        const profile: HardwareProfile = {
                            ram: null,
                            ramDetectionMethod: 'unknown',
                            cpuCores: 8,
                            storageAvailable: 50,
                            storageDetectionMethod: 'estimate',
                            gpuVRAM: 8,
                            webGPUSupported: true,
                            gpuPerformanceScore: 75,
                            browserName: 'Chrome',
                            timestamp: Date.now()
                        };

                        // Property: canSupport should not fail due to null RAM
                        // It should only fail if other requirements are not met
                        const canSupport = HardwareDiagnostics.canSupport(feature as any, profile);

                        // For text-chat, should always be true (no RAM requirement)
                        if (feature === 'text-chat') {
                            expect(canSupport).toBe(true);
                        }
                        // For other features with sufficient other resources, should be true
                        else if (feature === 'image-generation' || feature === 'vision' || feature === 'speech') {
                            expect(canSupport).toBe(true);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('Property 2: Storage Detection Non-Blocking', () => {
        // Feature: critical-fixes, Property 2: Storage Detection Non-Blocking
        // Validates: Requirements 1.2, 1.3
        it('should handle zero or negative storage gracefully and not disable text-chat', async () => {
            fc.assert(
                fc.asyncProperty(
                    fc.integer({ min: -100, max: 0 }),
                    async (storageBytes) => {
                        // Mock storage with zero or negative available space
                        const mockEstimate = vi.fn().mockResolvedValue({
                            quota: 100 * 1024 ** 3,
                            usage: (100 * 1024 ** 3) - storageBytes
                        });

                        const originalStorage = navigator.storage;
                        Object.defineProperty(navigator, 'storage', {
                            value: {
                                estimate: mockEstimate,
                                persist: vi.fn().mockResolvedValue(true)
                            },
                            configurable: true
                        });

                        // Mock other hardware as available
                        const originalDeviceMemory = (navigator as any).deviceMemory;
                        (navigator as any).deviceMemory = 8;

                        const originalGPU = navigator.gpu;
                        Object.defineProperty(navigator, 'gpu', {
                            value: undefined,
                            configurable: true
                        });

                        try {
                            const profile = await HardwareDiagnostics.detectCapabilities();

                            // Property 1: Storage should be 0 (unknown), not negative
                            expect(profile.storageAvailable).toBe(0);
                            expect(profile.storageDetectionMethod).toBe('fallback');

                            // Property 2: Text-chat should still be supported
                            // Text-chat has minStorage: 0, so it should not be blocked
                            const canSupportTextChat = HardwareDiagnostics.canSupport('text-chat', profile);
                            expect(canSupportTextChat).toBe(true);

                            // Property 3: Storage detection should not throw
                            expect(profile).toBeDefined();
                        } finally {
                            // Restore
                            Object.defineProperty(navigator, 'storage', {
                                value: originalStorage,
                                configurable: true
                            });
                            if (originalDeviceMemory !== undefined) {
                                (navigator as any).deviceMemory = originalDeviceMemory;
                            }
                            Object.defineProperty(navigator, 'gpu', {
                                value: originalGPU,
                                configurable: true
                            });
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        // Feature: critical-fixes, Property 2: Storage Detection Non-Blocking
        // Validates: Requirements 1.2, 1.3
        it('should not disable text-chat regardless of storage availability', async () => {
            fc.assert(
                fc.asyncProperty(
                    fc.float({ min: 0, max: 1000, noNaN: true }),
                    async (storageGB) => {
                        // Create profiles with various storage levels
                        const profile: HardwareProfile = {
                            ram: 8,
                            ramDetectionMethod: 'deviceMemory',
                            cpuCores: 4,
                            storageAvailable: storageGB,
                            storageDetectionMethod: 'estimate',
                            gpuVRAM: 2,
                            webGPUSupported: false,
                            gpuPerformanceScore: 0,
                            browserName: 'Firefox',
                            timestamp: Date.now()
                        };

                        // Property: text-chat should always be supported
                        // regardless of storage (minStorage: 0)
                        const canSupportTextChat = HardwareDiagnostics.canSupport('text-chat', profile);
                        expect(canSupportTextChat).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});
