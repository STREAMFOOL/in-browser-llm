

import type {
    ModelProvider,
    ProviderAvailability,
    ProviderConfig,
    SessionConfig,
    ChatSession,
    DownloadProgress
} from './model-provider';
import { generateSessionId } from './model-provider';
import { StorageManager } from './storage-manager';


export type APIBackend = 'openai' | 'anthropic' | 'ollama';


export interface BackendConfig {
    name: string;
    models: string[];
    defaultEndpoint: string;
    requiresApiKey: boolean;
}


export const API_BACKENDS: Record<APIBackend, BackendConfig> = {
    openai: {
        name: 'OpenAI',
        models: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
        defaultEndpoint: 'https://api.openai.com/v1',
        requiresApiKey: true
    },
    anthropic: {
        name: 'Anthropic',
        models: ['claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest', 'claude-3-opus-latest'],
        defaultEndpoint: 'https://api.anthropic.com/v1',
        requiresApiKey: true
    },
    ollama: {
        name: 'Ollama (Local)',
        models: ['llama3.2', 'mistral', 'phi3', 'qwen2.5'],
        defaultEndpoint: 'http://localhost:11434',
        requiresApiKey: false
    }
};


interface APIMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}


interface APISessionInternal {
    messages: APIMessage[];
    backend: APIBackend;
    modelId: string;
}


export class APIProvider implements ModelProvider {
    readonly name = 'api';
    readonly type = 'api' as const;
    readonly description = 'External API (OpenAI/Anthropic/Ollama)';

    private storage: StorageManager;
    private sessions: Map<string, ChatSession> = new Map();
    private currentBackend: APIBackend = 'openai';
    private currentModelId: string = API_BACKENDS.openai.models[0];
    private apiKey: string | null = null;
    private apiEndpoint: string | null = null;
    private initialized = false;

    constructor(storage?: StorageManager) {
        this.storage = storage || new StorageManager();
    }


    async checkAvailability(): Promise<ProviderAvailability> {
        // Load saved configuration
        const savedBackend = await this.storage.loadSetting('api_backend');
        const savedModelId = await this.storage.loadSetting('api_model_id');
        const savedApiKey = await this.storage.loadSetting('api_key');
        const savedEndpoint = await this.storage.loadSetting('api_endpoint');

        if (savedBackend) {
            this.currentBackend = savedBackend as APIBackend;
        }
        if (savedModelId) {
            this.currentModelId = savedModelId;
        }
        if (savedApiKey) {
            this.apiKey = savedApiKey;
        }
        if (savedEndpoint) {
            this.apiEndpoint = savedEndpoint;
        }

        const backendConfig = API_BACKENDS[this.currentBackend];

        // Ollama doesn't require API key
        if (this.currentBackend === 'ollama') {
            return {
                available: true,
                requiresDownload: false
            };
        }

        // Other backends require API key
        if (!this.apiKey) {
            return {
                available: false,
                reason: `${backendConfig.name} API key not configured. Please add your API key in settings.`
            };
        }

        return {
            available: true,
            requiresDownload: false
        };
    }


    async initialize(config?: ProviderConfig): Promise<void> {
        if (this.initialized) {
            return;
        }

        // Apply configuration if provided
        if (config?.modelId) {
            this.currentModelId = config.modelId;
        }
        if (config?.apiKey) {
            this.apiKey = config.apiKey;
            // Store API key securely in IndexedDB
            await this.storage.saveSetting('api_key', config.apiKey);
        }
        if (config?.apiEndpoint) {
            this.apiEndpoint = config.apiEndpoint;
            await this.storage.saveSetting('api_endpoint', config.apiEndpoint);
        }

        // Validate API key for non-Ollama backends
        const backendConfig = API_BACKENDS[this.currentBackend];
        if (backendConfig.requiresApiKey && !this.apiKey) {
            throw new Error(`${backendConfig.name} requires an API key. Please configure it in settings.`);
        }

        this.initialized = true;
    }


    async createSession(config: SessionConfig): Promise<ChatSession> {
        if (!this.initialized) {
            throw new Error('API provider not initialized. Call initialize() first.');
        }

        const sessionId = generateSessionId();
        const messages: APIMessage[] = [];

        // Add system prompt if provided
        if (config.systemPrompt) {
            messages.push({
                role: 'system',
                content: config.systemPrompt
            });
        }

        const internal: APISessionInternal = {
            messages,
            backend: this.currentBackend,
            modelId: this.currentModelId
        };

        const session: ChatSession = {
            id: sessionId,
            provider: this.name,
            config,
            _internal: internal
        };

        this.sessions.set(sessionId, session);
        return session;
    }


    async *promptStreaming(
        session: ChatSession,
        prompt: string,
        signal?: AbortSignal
    ): AsyncIterable<string> {
        const storedSession = this.sessions.get(session.id);
        if (!storedSession) {
            throw new Error(`Session ${session.id} not found`);
        }

        const internal = storedSession._internal as APISessionInternal;

        // Add user message to history
        internal.messages.push({
            role: 'user',
            content: prompt
        });

        try {
            let fullResponse = '';

            // Route to appropriate backend
            switch (internal.backend) {
                case 'openai':
                    for await (const chunk of this.streamOpenAI(internal, signal)) {
                        fullResponse += chunk;
                        yield chunk;
                    }
                    break;
                case 'anthropic':
                    for await (const chunk of this.streamAnthropic(internal, signal)) {
                        fullResponse += chunk;
                        yield chunk;
                    }
                    break;
                case 'ollama':
                    for await (const chunk of this.streamOllama(internal, signal)) {
                        fullResponse += chunk;
                        yield chunk;
                    }
                    break;
                default:
                    throw new Error(`Unsupported backend: ${internal.backend}`);
            }

            // Add assistant response to history
            internal.messages.push({
                role: 'assistant',
                content: fullResponse
            });

        } catch (error) {
            // Remove the user message if generation failed
            internal.messages.pop();
            throw error;
        }
    }


    private async *streamOpenAI(
        internal: APISessionInternal,
        signal?: AbortSignal
    ): AsyncIterable<string> {
        const endpoint = this.apiEndpoint || API_BACKENDS.openai.defaultEndpoint;
        const url = `${endpoint}/chat/completions`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: internal.modelId,
                messages: internal.messages,
                temperature: this.sessions.get(internal.messages[0]?.content || '')?.config.temperature || 0.7,
                stream: true
            }),
            signal
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
        }

        if (!response.body) {
            throw new Error('Response body is null');
        }

        // Parse Server-Sent Events
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            return;
                        }

                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices?.[0]?.delta?.content;
                            if (content) {
                                yield content;
                            }
                        } catch (e) {
                            // Skip invalid JSON
                            console.warn('Failed to parse SSE data:', data);
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }


    private async *streamAnthropic(
        internal: APISessionInternal,
        signal?: AbortSignal
    ): AsyncIterable<string> {
        const endpoint = this.apiEndpoint || API_BACKENDS.anthropic.defaultEndpoint;
        const url = `${endpoint}/messages`;

        // Anthropic requires system message separate from messages array
        const systemMessage = internal.messages.find(m => m.role === 'system');
        const conversationMessages = internal.messages.filter(m => m.role !== 'system');

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey || '',
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: internal.modelId,
                messages: conversationMessages,
                system: systemMessage?.content,
                max_tokens: 4096,
                temperature: this.sessions.get(internal.messages[0]?.content || '')?.config.temperature || 0.7,
                stream: true
            }),
            signal
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Anthropic API error: ${response.status} ${errorText}`);
        }

        if (!response.body) {
            throw new Error('Response body is null');
        }

        // Parse Server-Sent Events
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);

                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.type === 'content_block_delta') {
                                const content = parsed.delta?.text;
                                if (content) {
                                    yield content;
                                }
                            }
                        } catch (e) {
                            // Skip invalid JSON
                            console.warn('Failed to parse SSE data:', data);
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }


    private async *streamOllama(
        internal: APISessionInternal,
        signal?: AbortSignal
    ): AsyncIterable<string> {
        const endpoint = this.apiEndpoint || API_BACKENDS.ollama.defaultEndpoint;
        const url = `${endpoint}/api/chat`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: internal.modelId,
                messages: internal.messages,
                stream: true
            }),
            signal
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ollama API error: ${response.status} ${errorText}`);
        }

        if (!response.body) {
            throw new Error('Response body is null');
        }

        // Parse newline-delimited JSON
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            const parsed = JSON.parse(line);
                            const content = parsed.message?.content;
                            if (content) {
                                yield content;
                            }
                            if (parsed.done) {
                                return;
                            }
                        } catch (e) {
                            // Skip invalid JSON
                            console.warn('Failed to parse Ollama response:', line);
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }


    async destroySession(session: ChatSession): Promise<void> {
        this.sessions.delete(session.id);
    }


    getProgress(): DownloadProgress | null {
        return null;
    }


    async dispose(): Promise<void> {
        this.sessions.clear();
        this.initialized = false;
    }


    async setBackend(backend: APIBackend): Promise<void> {
        if (!API_BACKENDS[backend]) {
            throw new Error(`Invalid backend: ${backend}`);
        }

        this.currentBackend = backend;
        this.currentModelId = API_BACKENDS[backend].models[0];

        // Save to storage
        await this.storage.saveSetting('api_backend', backend);
        await this.storage.saveSetting('api_model_id', this.currentModelId);

        // Reset initialization to force reconfiguration
        this.initialized = false;
    }


    async setModel(modelId: string): Promise<void> {
        const backendConfig = API_BACKENDS[this.currentBackend];
        if (!backendConfig.models.includes(modelId)) {
            throw new Error(`Invalid model for ${backendConfig.name}: ${modelId}`);
        }

        this.currentModelId = modelId;
        await this.storage.saveSetting('api_model_id', modelId);
    }


    async setApiKey(apiKey: string): Promise<void> {
        this.apiKey = apiKey;
        // Store securely in IndexedDB
        await this.storage.saveSetting('api_key', apiKey);
    }


    async setEndpoint(endpoint: string): Promise<void> {
        this.apiEndpoint = endpoint;
        await this.storage.saveSetting('api_endpoint', endpoint);
    }


    getCurrentBackend(): APIBackend {
        return this.currentBackend;
    }


    getCurrentModelId(): string {
        return this.currentModelId;
    }


    requiresPrivacyWarning(): boolean {
        // Ollama with local endpoint doesn't require warning
        if (this.currentBackend === 'ollama') {
            const endpoint = this.apiEndpoint || API_BACKENDS.ollama.defaultEndpoint;
            return !endpoint.includes('localhost') && !endpoint.includes('127.0.0.1');
        }

        // All other backends send data externally
        return true;
    }


    static getAvailableBackends(): Record<APIBackend, BackendConfig> {
        return { ...API_BACKENDS };
    }


    static getBackendConfig(backend: APIBackend): BackendConfig | undefined {
        return API_BACKENDS[backend];
    }
}
