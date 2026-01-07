/**
 * Error Handler
 * Centralized error handling with user-friendly messages and technical logging
 * Requirements: 3.6, 15.1, 15.2, 15.3, 15.4
 */

export const ErrorCategory = {
    MODEL_LOAD_FAILURE: 'model-load-failure',
    MEMORY_EXHAUSTION: 'memory-exhaustion',
    STORAGE_QUOTA_EXCEEDED: 'storage-quota-exceeded',
    GPU_CONTEXT_LOSS: 'gpu-context-loss',
    NETWORK_ERROR: 'network-error',
    INFERENCE_ERROR: 'inference-error',
    UNKNOWN: 'unknown'
} as const;

export type ErrorCategory = typeof ErrorCategory[keyof typeof ErrorCategory];

export interface ErrorContext {
    category: ErrorCategory;
    technicalMessage: string;
    userMessage: string;
    troubleshootingSteps: string[];
    recoverable: boolean;
    error?: Error;
}

export class ErrorHandler {
    /**
     * Handle an error by logging technical details and returning user-friendly message
     */
    static handleError(error: unknown, category: ErrorCategory = ErrorCategory.UNKNOWN): ErrorContext {
        const errorObj = error instanceof Error ? error : new Error(String(error));

        // Log technical details to console
        console.error(`[${category}]`, errorObj);
        console.error('Stack trace:', errorObj.stack);

        // Generate user-friendly context
        const context = this.generateErrorContext(errorObj, category);

        return context;
    }

    /**
     * Generate error context with user-friendly messages and troubleshooting steps
     */
    private static generateErrorContext(error: Error, category: ErrorCategory): ErrorContext {
        switch (category) {
            case ErrorCategory.MODEL_LOAD_FAILURE:
                return {
                    category,
                    technicalMessage: error.message,
                    userMessage: '⚠️ **Model Load Failed**\n\nThe AI model could not be loaded. This might be due to browser compatibility or missing setup.',
                    troubleshootingSteps: [
                        'Ensure you\'re using Chrome 127 or later',
                        'Enable required flags in chrome://flags',
                        'Check chrome://on-device-internals for model status',
                        'Verify you have at least 22GB of free disk space',
                        'Try restarting your browser'
                    ],
                    recoverable: true,
                    error
                };

            case ErrorCategory.MEMORY_EXHAUSTION:
                return {
                    category,
                    technicalMessage: error.message,
                    userMessage: '⚠️ **Out of Memory**\n\nThe system ran out of memory during processing. This can happen with long conversations or complex tasks.',
                    troubleshootingSteps: [
                        'Close other browser tabs to free up memory',
                        'Start a new conversation to reduce context length',
                        'Reduce the complexity of your request',
                        'If using image generation, try a lower resolution',
                        'Restart your browser if the issue persists'
                    ],
                    recoverable: true,
                    error
                };

            case ErrorCategory.STORAGE_QUOTA_EXCEEDED:
                return {
                    category,
                    technicalMessage: error.message,
                    userMessage: '⚠️ **Storage Full**\n\nYour browser\'s storage quota has been exceeded. You need to free up space to continue.',
                    troubleshootingSteps: [
                        'Delete old conversations from the thread list',
                        'Clear cached model data if available',
                        'Use the "Clear All Data" button in settings',
                        'Check your browser\'s storage settings',
                        'Consider using a different browser profile'
                    ],
                    recoverable: true,
                    error
                };

            case ErrorCategory.GPU_CONTEXT_LOSS:
                return {
                    category,
                    technicalMessage: error.message,
                    userMessage: '⚠️ **GPU Connection Lost**\n\nThe connection to your GPU was lost. This can happen when the GPU is under heavy load or drivers crash.',
                    troubleshootingSteps: [
                        'The system will attempt to reinitialize the GPU',
                        'Close GPU-intensive applications',
                        'Update your graphics drivers',
                        'Try restarting your browser',
                        'If the issue persists, use the Reset Application button'
                    ],
                    recoverable: true,
                    error
                };

            case ErrorCategory.NETWORK_ERROR:
                return {
                    category,
                    technicalMessage: error.message,
                    userMessage: '⚠️ **Network Error**\n\nA network request failed. This might affect web search or external API features.',
                    troubleshootingSteps: [
                        'Check your internet connection',
                        'Verify API keys are correct (if using external APIs)',
                        'Try disabling web search if enabled',
                        'Check if the service is experiencing downtime',
                        'The assistant will continue working with local features'
                    ],
                    recoverable: true,
                    error
                };

            case ErrorCategory.INFERENCE_ERROR:
                return {
                    category,
                    technicalMessage: error.message,
                    userMessage: '⚠️ **Inference Failed**\n\nThe AI model encountered an error while generating a response.',
                    troubleshootingSteps: [
                        'Try rephrasing your message',
                        'Start a new conversation to reset context',
                        'Check if the model is still loaded',
                        'Reduce the length or complexity of your input',
                        'Try switching to a different model provider'
                    ],
                    recoverable: true,
                    error
                };

            case ErrorCategory.UNKNOWN:
            default:
                return {
                    category: ErrorCategory.UNKNOWN,
                    technicalMessage: error.message,
                    userMessage: '⚠️ **Unexpected Error**\n\nSomething went wrong. Please check the console for details.',
                    troubleshootingSteps: [
                        'Check the browser console for detailed error messages',
                        'Try refreshing the page',
                        'Clear your browser cache',
                        'Try using a different browser',
                        'If the issue persists, use the Reset Application button'
                    ],
                    recoverable: false,
                    error
                };
        }
    }

    /**
     * Format error context as a user-friendly markdown message
     */
    static formatErrorMessage(context: ErrorContext): string {
        let message = context.userMessage + '\n\n';

        if (context.troubleshootingSteps.length > 0) {
            message += '**Troubleshooting Steps:**\n\n';
            context.troubleshootingSteps.forEach((step, index) => {
                message += `${index + 1}. ${step}\n`;
            });
        }

        if (!context.recoverable) {
            message += '\n\n_This error may require resetting the application._';
        }

        return message;
    }

    /**
     * Detect error category from error object
     */
    static detectErrorCategory(error: unknown): ErrorCategory {
        if (!(error instanceof Error)) {
            return ErrorCategory.UNKNOWN;
        }

        const message = error.message.toLowerCase();
        const name = error.name.toLowerCase();

        // Check for specific error patterns
        if (message.includes('quota') || name.includes('quotaexceedederror')) {
            return ErrorCategory.STORAGE_QUOTA_EXCEEDED;
        }

        if (message.includes('memory') || message.includes('oom') || name.includes('outofmemory')) {
            return ErrorCategory.MEMORY_EXHAUSTION;
        }

        if (message.includes('gpu') && (message.includes('lost') || message.includes('context'))) {
            return ErrorCategory.GPU_CONTEXT_LOSS;
        }

        if (message.includes('model') && (message.includes('load') || message.includes('download') || message.includes('not available'))) {
            return ErrorCategory.MODEL_LOAD_FAILURE;
        }

        if (message.includes('network') || message.includes('fetch') || name.includes('networkerror')) {
            return ErrorCategory.NETWORK_ERROR;
        }

        if (message.includes('inference') || message.includes('generation') || message.includes('prompt')) {
            return ErrorCategory.INFERENCE_ERROR;
        }

        return ErrorCategory.UNKNOWN;
    }

    /**
     * Check if an error is recoverable
     */
    static isRecoverable(error: unknown): boolean {
        const category = this.detectErrorCategory(error);
        const context = this.generateErrorContext(
            error instanceof Error ? error : new Error(String(error)),
            category
        );
        return context.recoverable;
    }
}
