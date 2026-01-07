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

export type InitStepStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

export interface InitStep {
    id: string;
    label: string;
    status: InitStepStatus;
    error?: string;
}

export interface DetailedAvailability {
    status: 'readily' | 'after-download' | 'no' | 'error';
    reason: 'ready' | 'api-not-available' | 'flags-disabled' | 'model-downloading' | 'model-not-downloaded' | 'unsupported-browser' | 'error';
    downloadProgress?: number;
    steps: InitStep[];
    errorMessage?: string;
}

export interface ModelAvailability {
    status: 'readily' | 'after-download' | 'no';
    downloadProgress?: number;
}

export type AISession = AILanguageModel;

export type DownloadProgressCallback = (loaded: number, total: number) => void;

/**
 * GeminiController manages Gemini Nano sessions
 */
export class GeminiController {
    private static readonly DEFAULT_TEMPERATURE = 0.7;
    private static readonly DEFAULT_TOP_K = 40;

    /**
     * Check if the model is available (simple check)
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
     * Detailed availability check with step-by-step status
     * Returns granular information about what's working and what's not
     */
    async checkDetailedAvailability(): Promise<DetailedAvailability> {
        const steps: InitStep[] = [
            { id: 'browser', label: 'Checking browser compatibility', status: 'pending' },
            { id: 'api', label: 'Checking Prompt API availability', status: 'pending' },
            { id: 'flags', label: 'Verifying Chrome flags enabled', status: 'pending' },
            { id: 'model', label: 'Checking model status', status: 'pending' },
        ];

        // Step 1: Browser check
        steps[0].status = 'running';
        const isChrome = this.isChromeBrowser();
        if (!isChrome) {
            steps[0].status = 'failed';
            steps[0].error = 'This feature requires Google Chrome (not Brave, Edge, or other browsers)';
            return {
                status: 'no',
                reason: 'unsupported-browser',
                steps,
                errorMessage: 'Gemini Nano requires Google Chrome browser'
            };
        }
        steps[0].status = 'passed';

        // Step 2: API availability
        steps[1].status = 'running';
        if (typeof window === 'undefined' || !window.ai) {
            steps[1].status = 'failed';
            steps[1].error = 'window.ai is not available';
            return {
                status: 'no',
                reason: 'api-not-available',
                steps,
                errorMessage: 'Chrome AI APIs not found. Make sure you\'re using Chrome 138+'
            };
        }
        steps[1].status = 'passed';

        // Step 3: Flags check (languageModel factory exists)
        steps[2].status = 'running';
        if (!window.ai.languageModel) {
            steps[2].status = 'failed';
            steps[2].error = 'languageModel API not enabled';
            return {
                status: 'no',
                reason: 'flags-disabled',
                steps,
                errorMessage: 'Chrome flags not enabled. Enable #optimization-guide-on-device-model and #prompt-api-for-gemini-nano in chrome://flags'
            };
        }
        steps[2].status = 'passed';

        // Step 4: Model status
        steps[3].status = 'running';
        try {
            const capabilities = await window.ai.languageModel.capabilities();

            if (capabilities.available === 'readily') {
                steps[3].status = 'passed';
                return {
                    status: 'readily',
                    reason: 'ready',
                    steps
                };
            } else if (capabilities.available === 'after-download') {
                steps[3].status = 'running';
                steps[3].label = 'Model downloading...';
                return {
                    status: 'after-download',
                    reason: 'model-downloading',
                    steps,
                    downloadProgress: 0
                };
            } else {
                steps[3].status = 'failed';
                steps[3].error = 'Model not available for download';
                return {
                    status: 'no',
                    reason: 'model-not-downloaded',
                    steps,
                    errorMessage: 'Model not available. Check chrome://on-device-internals for status'
                };
            }
        } catch (error) {
            steps[3].status = 'failed';
            steps[3].error = error instanceof Error ? error.message : 'Unknown error';
            return {
                status: 'error',
                reason: 'error',
                steps,
                errorMessage: `Failed to check model: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Check if running in actual Chrome (not Chromium derivatives)
     */
    private isChromeBrowser(): boolean {
        if (typeof navigator === 'undefined') return false;

        const ua = navigator.userAgent;
        // Check for Chrome but exclude Brave, Edge, Opera, etc.
        const isChrome = /Chrome\//.test(ua);
        const isBrave = 'brave' in navigator;
        const isEdge = /Edg\//.test(ua);
        const isOpera = /OPR\//.test(ua);
        const isSamsung = /SamsungBrowser/.test(ua);

        return isChrome && !isBrave && !isEdge && !isOpera && !isSamsung;
    }

    /**
     * Create a new session with configuration
     * Requirements: 2.4, 3.1
     */
    async createSession(config: SessionConfig = {}, onDownloadProgress?: DownloadProgressCallback): Promise<AISession> {
        if (!window.ai?.languageModel) {
            throw new Error('Prompt API not available');
        }

        const options: AILanguageModelCreateOptions = {
            temperature: config.temperature ?? GeminiController.DEFAULT_TEMPERATURE,
            topK: config.topK ?? GeminiController.DEFAULT_TOP_K,
            systemPrompt: config.systemPrompt
        };

        // Add download progress monitor if callback provided
        if (onDownloadProgress) {
            options.monitor = (monitor: AICreateMonitor) => {
                monitor.addEventListener('downloadprogress', (event: DownloadProgressEvent) => {
                    onDownloadProgress(event.loaded, event.total);
                });
            };
        }

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
