/**
 * Gemini Controller
 * Manages the lifecycle of Gemini Nano sessions and streaming responses
 * Requirements: 2.1, 2.4, 3.1, 3.2, 3.5
 */

// Type definitions for Chrome's Prompt API
export interface AILanguageModel {
    prompt(input: string): Promise<string>;
    promptStreaming(input: string): ReadableStream;
    destroy(): void;
    clone(): Promise<AILanguageModel>;
}

export interface AILanguageModelCapabilities {
    available: 'readily' | 'after-download' | 'no';
    defaultTemperature?: number;
    defaultTopK?: number;
    maxTopK?: number;
}

export interface AILanguageModelFactory {
    capabilities(): Promise<AILanguageModelCapabilities>;
    create(options?: AILanguageModelCreateOptions): Promise<AILanguageModel>;
}

export interface AILanguageModelCreateOptions {
    temperature?: number;
    topK?: number;
    systemPrompt?: string;
    signal?: AbortSignal;
    monitor?: (monitor: AICreateMonitor) => void;
}

export interface AICreateMonitor {
    addEventListener(type: 'downloadprogress', listener: (event: DownloadProgressEvent) => void): void;
}

export interface DownloadProgressEvent {
    loaded: number;
    total: number;
}

declare global {
    interface Window {
        ai?: {
            languageModel: AILanguageModelFactory;
        };
    }
}

// Controller types

export interface SessionConfig {
    temperature?: number;
    topK?: number;
    systemPrompt?: string;
}

export interface ModelAvailability {
    status: 'readily' | 'after-download' | 'no';
    downloadProgress?: number;
}

export type AISession = AILanguageModel;

/**
 * GeminiController manages Gemini Nano sessions
 */
export class GeminiController {
    private static readonly DEFAULT_TEMPERATURE = 0.7;
    private static readonly DEFAULT_TOP_K = 40;

    /**
     * Check if the model is available
     * Requirements: 2.1
     */
    async checkAvailability(): Promise<ModelAvailability> {
        if (!window.ai?.languageModel) {
            return {
                status: 'no',
                downloadProgress: undefined
            };
        }

        try {
            const capabilities = await window.ai.languageModel.capabilities();
            return {
                status: capabilities.available,
                downloadProgress: undefined
            };
        } catch (error) {
            console.error('Failed to check model availability:', error);
            return {
                status: 'no',
                downloadProgress: undefined
            };
        }
    }

    /**
     * Create a new session with configuration
     * Requirements: 2.4, 3.1
     */
    async createSession(config: SessionConfig = {}): Promise<AISession> {
        if (!window.ai?.languageModel) {
            throw new Error('Prompt API not available');
        }

        const options: AILanguageModelCreateOptions = {
            temperature: config.temperature ?? GeminiController.DEFAULT_TEMPERATURE,
            topK: config.topK ?? GeminiController.DEFAULT_TOP_K,
            systemPrompt: config.systemPrompt
        };

        try {
            const session = await window.ai.languageModel.create(options);
            return session;
        } catch (error) {
            console.error('Failed to create session:', error);
            throw new Error(`Failed to create Gemini session: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Send a prompt and receive streaming response
     * Requirements: 3.2, 14.4, 14.5
     */
    async *promptStreaming(session: AISession, prompt: string, signal?: AbortSignal): AsyncIterable<string> {
        try {
            const stream = session.promptStreaming(prompt);
            const reader = stream.getReader();

            try {
                while (true) {
                    // Check if cancelled
                    if (signal?.aborted) {
                        reader.cancel();
                        throw new Error('Stream cancelled');
                    }

                    const { done, value } = await reader.read();
                    if (done) break;
                    yield value;
                }
            } finally {
                reader.releaseLock();
            }
        } catch (error) {
            if (error instanceof Error && error.message === 'Stream cancelled') {
                throw error;
            }
            console.error('Streaming error:', error);
            throw new Error(`Streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Destroy a session to free memory
     * Requirements: 3.5
     */
    async destroySession(session: AISession): Promise<void> {
        try {
            session.destroy();
        } catch (error) {
            console.error('Failed to destroy session:', error);
            // Don't throw - session cleanup is best-effort
        }
    }

    /**
     * Clone a session for branching conversations
     * Requirements: 3.5
     */
    async cloneSession(session: AISession): Promise<AISession> {
        try {
            return await session.clone();
        } catch (error) {
            console.error('Failed to clone session:', error);
            throw new Error(`Failed to clone session: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
