/**
 * Model Provider Interface and Types
 * Defines the unified interface that all model providers must implement
 * Requirements: 16.1
 */

/**
 * Provider availability status
 */
export interface ProviderAvailability {
    available: boolean;
    reason?: string;  // Why unavailable
    requiresDownload?: boolean;
    downloadSize?: number;  // Bytes
}

/**
 * Provider configuration options
 */
export interface ProviderConfig {
    modelId?: string;  // For providers with multiple models
    apiKey?: string;   // For API providers
    apiEndpoint?: string;  // For custom endpoints (Ollama)
}

/**
 * Session configuration for chat sessions
 */
export interface SessionConfig {
    temperature: number;  // 0.0 to 1.0
    topK: number;         // Number of top tokens to consider
    systemPrompt?: string;
    maxTokens?: number;
}

/**
 * Chat session handle
 */
export interface ChatSession {
    id: string;
    provider: string;
    config: SessionConfig;
    // Internal session reference (provider-specific)
    _internal?: unknown;
}

/**
 * Download/loading progress information
 */
export interface DownloadProgress {
    phase: 'downloading' | 'loading' | 'ready';
    percentage: number;  // 0 to 100
    downloadedBytes?: number;
    totalBytes?: number;
    currentFile?: string;
}

/**
 * Provider information for listing
 */
export interface ProviderInfo {
    name: string;
    type: 'local' | 'api';
    description: string;
    available: boolean;
    reason?: string;
    priority: number;  // Lower = higher priority
}

/**
 * ModelProvider interface
 * All model providers must implement this interface
 */
export interface ModelProvider {
    // Provider identification
    readonly name: string;
    readonly type: 'local' | 'api';
    readonly description: string;

    /**
     * Check if this provider is available in the current environment
     */
    checkAvailability(): Promise<ProviderAvailability>;

    /**
     * Initialize the provider (load models, etc.)
     */
    initialize(config?: ProviderConfig): Promise<void>;

    /**
     * Create a new chat session
     */
    createSession(config: SessionConfig): Promise<ChatSession>;

    /**
     * Send a prompt and receive streaming response
     */
    promptStreaming(session: ChatSession, prompt: string, signal?: AbortSignal): AsyncIterable<string>;

    /**
     * Destroy a session to free memory
     */
    destroySession(session: ChatSession): Promise<void>;

    /**
     * Get current download/loading progress
     */
    getProgress(): DownloadProgress | null;

    /**
     * Cleanup and release resources
     */
    dispose(): Promise<void>;
}

/**
 * Default session configuration values
 */
export const DEFAULT_SESSION_CONFIG: SessionConfig = {
    temperature: 0.7,
    topK: 40
};

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
