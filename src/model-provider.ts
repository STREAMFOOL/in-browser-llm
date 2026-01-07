


export interface ProviderAvailability {
    available: boolean;
    reason?: string;  // Why unavailable
    requiresDownload?: boolean;
    downloadSize?: number;  // Bytes
}


export interface ProviderConfig {
    modelId?: string;  // For providers with multiple models
    apiKey?: string;   // For API providers
    apiEndpoint?: string;  // For custom endpoints (Ollama)
}


export interface SessionConfig {
    temperature: number;  // 0.0 to 1.0
    topK: number;         // Number of top tokens to consider
    systemPrompt?: string;
    maxTokens?: number;
}


export interface ChatSession {
    id: string;
    provider: string;
    config: SessionConfig;
    // Internal session reference (provider-specific)
    _internal?: unknown;
}


export interface DownloadProgress {
    phase: 'downloading' | 'loading' | 'ready';
    percentage: number;  // 0 to 100
    downloadedBytes?: number;
    totalBytes?: number;
    currentFile?: string;
}


export interface ProviderInfo {
    name: string;
    type: 'local' | 'api';
    description: string;
    available: boolean;
    reason?: string;
    priority: number;  // Lower = higher priority
}


export interface ModelProvider {
    // Provider identification
    readonly name: string;
    readonly type: 'local' | 'api';
    readonly description: string;


    checkAvailability(): Promise<ProviderAvailability>;


    initialize(config?: ProviderConfig): Promise<void>;


    createSession(config: SessionConfig): Promise<ChatSession>;


    promptStreaming(session: ChatSession, prompt: string, signal?: AbortSignal): AsyncIterable<string>;


    destroySession(session: ChatSession): Promise<void>;


    getProgress(): DownloadProgress | null;


    dispose(): Promise<void>;
}


export const DEFAULT_SESSION_CONFIG: SessionConfig = {
    temperature: 0.7,
    topK: 40
};


export function generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
