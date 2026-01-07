/**
 * Unit Tests for Error Handling
 * Tests specific error scenarios and recovery mechanisms
 * Requirements: 15.1, 15.2, 15.3, 15.5, 15.6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorHandler, ErrorCategory } from '../src/error-handler';
import { RecoveryManager } from '../src/recovery-manager';

describe('ErrorHandler', () => {
    let consoleErrorSpy: any;

    beforeEach(() => {
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    describe('Model Load Failure', () => {
        it('should display user-friendly message for model load failure', () => {
            // Requirement: 15.1
            const error = new Error('Model download failed');
            const context = ErrorHandler.handleError(error, ErrorCategory.MODEL_LOAD_FAILURE);

            expect(context.userMessage).toContain('Model Load Failed');
            expect(context.userMessage).toContain('⚠️');
            expect(context.troubleshootingSteps.length).toBeGreaterThan(0);
            expect(context.recoverable).toBe(true);
        });

        it('should log technical details to console', () => {
            // Requirement: 15.1
            const error = new Error('Model not available');
            ErrorHandler.handleError(error, ErrorCategory.MODEL_LOAD_FAILURE);

            expect(consoleErrorSpy).toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('[model-load-failure]'),
                error
            );
        });

        it('should provide Chrome-specific troubleshooting steps', () => {
            // Requirement: 15.1
            const error = new Error('Model load failed');
            const context = ErrorHandler.handleError(error, ErrorCategory.MODEL_LOAD_FAILURE);

            const steps = context.troubleshootingSteps.join(' ');
            expect(steps).toContain('Chrome');
            expect(steps).toContain('flags');
            expect(steps).toContain('chrome://on-device-internals');
        });
    });

    describe('Memory Exhaustion', () => {
        it('should display memory exhaustion message with suggestions', () => {
            // Requirement: 15.2
            const error = new Error('Out of memory');
            const context = ErrorHandler.handleError(error, ErrorCategory.MEMORY_EXHAUSTION);

            expect(context.userMessage).toContain('Out of Memory');
            const steps = context.troubleshootingSteps.join(' ');
            expect(steps).toContain('Close other browser tabs');
            expect(steps).toContain('new conversation');
        });

        it('should detect memory errors from error message', () => {
            // Requirement: 15.2
            const error = new Error('JavaScript heap out of memory');
            const category = ErrorHandler.detectErrorCategory(error);

            expect(category).toBe(ErrorCategory.MEMORY_EXHAUSTION);
        });
    });

    describe('Storage Quota Exceeded', () => {
        it('should display quota exceeded message with cleanup prompts', () => {
            // Requirement: 15.3
            const error = new Error('QuotaExceededError');
            const context = ErrorHandler.handleError(error, ErrorCategory.STORAGE_QUOTA_EXCEEDED);

            expect(context.userMessage).toContain('Storage Full');
            const steps = context.troubleshootingSteps.join(' ');
            expect(steps).toContain('Delete old conversations');
            expect(steps).toContain('Clear All Data');
        });

        it('should detect quota errors from error name', () => {
            // Requirement: 15.3
            const error = new Error('Storage quota exceeded');
            error.name = 'QuotaExceededError';
            const category = ErrorHandler.detectErrorCategory(error);

            expect(category).toBe(ErrorCategory.STORAGE_QUOTA_EXCEEDED);
        });
    });

    describe('Error Category Detection', () => {
        it('should detect GPU context loss', () => {
            const error = new Error('GPU context lost');
            const category = ErrorHandler.detectErrorCategory(error);
            expect(category).toBe(ErrorCategory.GPU_CONTEXT_LOSS);
        });

        it('should detect network errors', () => {
            const error = new Error('Network request failed');
            const category = ErrorHandler.detectErrorCategory(error);
            expect(category).toBe(ErrorCategory.NETWORK_ERROR);
        });

        it('should detect inference errors', () => {
            const error = new Error('Inference generation failed');
            const category = ErrorHandler.detectErrorCategory(error);
            expect(category).toBe(ErrorCategory.INFERENCE_ERROR);
        });

        it('should default to UNKNOWN for unrecognized errors', () => {
            const error = new Error('Some random error');
            const category = ErrorHandler.detectErrorCategory(error);
            expect(category).toBe(ErrorCategory.UNKNOWN);
        });
    });

    describe('Error Formatting', () => {
        it('should format error messages with troubleshooting steps', () => {
            const error = new Error('Test error');
            const context = ErrorHandler.handleError(error, ErrorCategory.MODEL_LOAD_FAILURE);
            const formatted = ErrorHandler.formatErrorMessage(context);

            expect(formatted).toContain(context.userMessage);
            expect(formatted).toContain('**Troubleshooting Steps:**');
            context.troubleshootingSteps.forEach((step, index) => {
                expect(formatted).toContain(`${index + 1}. ${step}`);
            });
        });

        it('should include reset warning for non-recoverable errors', () => {
            const error = new Error('Fatal error');
            const context = ErrorHandler.handleError(error, ErrorCategory.UNKNOWN);
            const formatted = ErrorHandler.formatErrorMessage(context);

            expect(formatted).toContain('reset');
        });
    });

    describe('Recoverability', () => {
        it('should mark known errors as recoverable', () => {
            const categories = [
                ErrorCategory.MODEL_LOAD_FAILURE,
                ErrorCategory.MEMORY_EXHAUSTION,
                ErrorCategory.STORAGE_QUOTA_EXCEEDED,
                ErrorCategory.GPU_CONTEXT_LOSS,
                ErrorCategory.NETWORK_ERROR,
                ErrorCategory.INFERENCE_ERROR
            ];

            categories.forEach(category => {
                const error = new Error('Test error');
                const context = ErrorHandler.handleError(error, category);
                expect(context.recoverable).toBe(true);
            });
        });

        it('should mark unknown errors as non-recoverable', () => {
            const error = new Error('Unknown error');
            const context = ErrorHandler.handleError(error, ErrorCategory.UNKNOWN);
            expect(context.recoverable).toBe(false);
        });
    });
});

describe('RecoveryManager', () => {
    let recoveryManager: RecoveryManager;
    let consoleLogSpy: any;
    let consoleErrorSpy: any;

    beforeEach(() => {
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        recoveryManager = new RecoveryManager();
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    describe('GPU Recovery', () => {
        it('should track GPU recovery attempts', async () => {
            // Requirement: 15.5
            const status = recoveryManager.getRecoveryStatus();

            expect(status.gpuRecoveryAttempts).toBe(0);
            expect(status.maxGPURecoveryAttempts).toBe(3);
            expect(status.canAttemptGPURecovery).toBe(true);
        });

        it('should limit GPU recovery attempts', async () => {
            // Requirement: 15.5
            // Simulate multiple recovery attempts
            for (let i = 0; i < 4; i++) {
                await recoveryManager.handleGPUContextLoss('test');
            }

            const status = recoveryManager.getRecoveryStatus();
            expect(status.gpuRecoveryAttempts).toBe(3);
            expect(status.canAttemptGPURecovery).toBe(false);
        });

        it('should reset recovery counter after successful operation', () => {
            // Requirement: 15.5
            recoveryManager.resetGPURecoveryCounter();
            const status = recoveryManager.getRecoveryStatus();
            expect(status.gpuRecoveryAttempts).toBe(0);
        });

        it('should prevent concurrent recovery attempts', async () => {
            // Requirement: 15.5
            const promise1 = recoveryManager.handleGPUContextLoss('test1');
            const promise2 = recoveryManager.handleGPUContextLoss('test2');

            await Promise.all([promise1, promise2]);

            // Only one attempt should have been made
            const status = recoveryManager.getRecoveryStatus();
            expect(status.gpuRecoveryAttempts).toBe(1);
        });
    });

    describe('Application Reset', () => {
        it('should have resetApplication method', () => {
            // Requirement: 15.6
            expect(typeof recoveryManager.resetApplication).toBe('function');
        });

        it('should log reset initiation', async () => {
            // Requirement: 15.6
            // Mock window.location.reload to prevent actual reload
            const reloadMock = vi.fn();
            Object.defineProperty(window, 'location', {
                value: { reload: reloadMock },
                writable: true,
                configurable: true
            });

            // Mock storage APIs
            vi.spyOn(Storage.prototype, 'clear').mockImplementation(() => { });

            // Mock IndexedDB
            const mockDatabases = vi.fn().mockResolvedValue([]);
            Object.defineProperty(indexedDB, 'databases', {
                value: mockDatabases,
                writable: true,
                configurable: true
            });

            try {
                await recoveryManager.resetApplication();
            } catch (e) {
                // Expected to fail in test environment
            }

            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('Resetting application')
            );
        });
    });

    describe('Recovery Status', () => {
        it('should provide recovery status information', () => {
            const status = recoveryManager.getRecoveryStatus();

            expect(status).toHaveProperty('gpuRecoveryAttempts');
            expect(status).toHaveProperty('maxGPURecoveryAttempts');
            expect(status).toHaveProperty('canAttemptGPURecovery');
            expect(status).toHaveProperty('gpuRecoveryInProgress');
        });
    });
});
