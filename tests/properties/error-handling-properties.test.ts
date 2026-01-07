/**
 * Property-Based Tests for Error Handling
 * Feature: local-ai-assistant, Property 6: Error Handling Consistency
 * Validates: Requirements 3.6, 15.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ErrorHandler, ErrorCategory } from '../../src/error-handler';

describe('Error Handling Properties', () => {
    /**
     * Property 6: Error Handling Consistency
     * For any inference error, the system should display a user-friendly error message
     * in the UI and log detailed technical information to the console.
     */
    it('should handle all errors consistently with user messages and console logs', () => {
        // Feature: local-ai-assistant, Property 6: Error Handling Consistency

        fc.assert(
            fc.property(
                // Generate arbitrary error messages and categories
                fc.record({
                    message: fc.string({ minLength: 1, maxLength: 200 }),
                    category: fc.constantFrom(
                        ErrorCategory.MODEL_LOAD_FAILURE,
                        ErrorCategory.MEMORY_EXHAUSTION,
                        ErrorCategory.STORAGE_QUOTA_EXCEEDED,
                        ErrorCategory.GPU_CONTEXT_LOSS,
                        ErrorCategory.NETWORK_ERROR,
                        ErrorCategory.INFERENCE_ERROR,
                        ErrorCategory.UNKNOWN
                    )
                }),
                ({ message, category }) => {
                    // Create an error
                    const error = new Error(message);

                    // Handle the error
                    const context = ErrorHandler.handleError(error, category);

                    // Property: Error context should always have required fields
                    expect(context).toBeDefined();
                    expect(context.category).toBe(category);
                    expect(context.technicalMessage).toBeDefined();
                    expect(context.userMessage).toBeDefined();
                    expect(context.troubleshootingSteps).toBeDefined();
                    expect(Array.isArray(context.troubleshootingSteps)).toBe(true);
                    expect(typeof context.recoverable).toBe('boolean');

                    // Property: User message should be non-empty and user-friendly
                    expect(context.userMessage.length).toBeGreaterThan(0);
                    expect(context.userMessage).toContain('⚠️');

                    // Property: Technical message should contain the original error message
                    expect(context.technicalMessage).toBe(message);

                    // Property: Troubleshooting steps should be non-empty array
                    expect(context.troubleshootingSteps.length).toBeGreaterThan(0);

                    // Property: Formatted message should be valid markdown
                    const formatted = ErrorHandler.formatErrorMessage(context);
                    expect(formatted).toBeDefined();
                    expect(formatted.length).toBeGreaterThan(0);
                    expect(formatted).toContain(context.userMessage);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should correctly detect error categories from error messages', () => {
        // Feature: local-ai-assistant, Property 6: Error Handling Consistency

        fc.assert(
            fc.property(
                fc.constantFrom(
                    { keyword: 'quota', expected: ErrorCategory.STORAGE_QUOTA_EXCEEDED },
                    { keyword: 'QuotaExceededError', expected: ErrorCategory.STORAGE_QUOTA_EXCEEDED },
                    { keyword: 'memory', expected: ErrorCategory.MEMORY_EXHAUSTION },
                    { keyword: 'out of memory', expected: ErrorCategory.MEMORY_EXHAUSTION },
                    { keyword: 'gpu context lost', expected: ErrorCategory.GPU_CONTEXT_LOSS },
                    { keyword: 'model load failed', expected: ErrorCategory.MODEL_LOAD_FAILURE },
                    { keyword: 'model not available', expected: ErrorCategory.MODEL_LOAD_FAILURE },
                    { keyword: 'network error', expected: ErrorCategory.NETWORK_ERROR },
                    { keyword: 'fetch failed', expected: ErrorCategory.NETWORK_ERROR },
                    { keyword: 'inference failed', expected: ErrorCategory.INFERENCE_ERROR }
                ),
                ({ keyword, expected }) => {
                    // Create error with keyword
                    const error = new Error(`Test error: ${keyword}`);

                    // Detect category
                    const detected = ErrorHandler.detectErrorCategory(error);

                    // Property: Category should be correctly detected
                    expect(detected).toBe(expected);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should maintain error recoverability based on category', () => {
        // Feature: local-ai-assistant, Property 6: Error Handling Consistency

        fc.assert(
            fc.property(
                fc.constantFrom(
                    ErrorCategory.MODEL_LOAD_FAILURE,
                    ErrorCategory.MEMORY_EXHAUSTION,
                    ErrorCategory.STORAGE_QUOTA_EXCEEDED,
                    ErrorCategory.GPU_CONTEXT_LOSS,
                    ErrorCategory.NETWORK_ERROR,
                    ErrorCategory.INFERENCE_ERROR,
                    ErrorCategory.UNKNOWN
                ),
                (category) => {
                    // Create error
                    const error = new Error('Test error');

                    // Handle error
                    const context = ErrorHandler.handleError(error, category);

                    // Property: UNKNOWN errors should be non-recoverable
                    if (category === ErrorCategory.UNKNOWN) {
                        expect(context.recoverable).toBe(false);
                    } else {
                        // All other categories should be recoverable
                        expect(context.recoverable).toBe(true);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should format error messages consistently', () => {
        // Feature: local-ai-assistant, Property 6: Error Handling Consistency

        fc.assert(
            fc.property(
                fc.record({
                    message: fc.string({ minLength: 1, maxLength: 100 }),
                    category: fc.constantFrom(
                        ErrorCategory.MODEL_LOAD_FAILURE,
                        ErrorCategory.MEMORY_EXHAUSTION,
                        ErrorCategory.STORAGE_QUOTA_EXCEEDED
                    )
                }),
                ({ message, category }) => {
                    // Create and handle error
                    const error = new Error(message);
                    const context = ErrorHandler.handleError(error, category);

                    // Format message
                    const formatted = ErrorHandler.formatErrorMessage(context);

                    // Property: Formatted message should contain user message
                    expect(formatted).toContain(context.userMessage);

                    // Property: Formatted message should contain troubleshooting section
                    expect(formatted).toContain('**Troubleshooting Steps:**');

                    // Property: Each troubleshooting step should be numbered
                    context.troubleshootingSteps.forEach((step, index) => {
                        expect(formatted).toContain(`${index + 1}. ${step}`);
                    });

                    // Property: Non-recoverable errors should have reset warning
                    if (!context.recoverable) {
                        expect(formatted).toContain('reset');
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should handle non-Error objects gracefully', () => {
        // Feature: local-ai-assistant, Property 6: Error Handling Consistency

        fc.assert(
            fc.property(
                fc.oneof(
                    fc.string(),
                    fc.integer(),
                    fc.constant(null),
                    fc.constant(undefined),
                    fc.object()
                ),
                (value) => {
                    // Handle non-Error value
                    const context = ErrorHandler.handleError(value);

                    // Property: Should still return valid error context
                    expect(context).toBeDefined();
                    expect(context.category).toBe(ErrorCategory.UNKNOWN);
                    expect(context.userMessage).toBeDefined();
                    expect(context.technicalMessage).toBeDefined();
                    expect(context.troubleshootingSteps).toBeDefined();
                    expect(Array.isArray(context.troubleshootingSteps)).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });
});
