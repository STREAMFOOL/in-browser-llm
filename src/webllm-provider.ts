

import * as webllm from '@mlc-ai/web-llm';
import type { ChatCompletionMessageParam } from '@mlc-ai/web-llm';
import type {
    ModelProvider,
    ProviderAvailability,
    ProviderConfig,
    SessionConfig,
    ChatSession,
    DownloadProgress
} from './model-provider';
import { generateSessionId } from './model-provider';


export interface WebLLMModelInfo {
    id: string;
    name: string;
    description: string;
    estimatedVRAM: number;  // GB
    contextLength: number;
}


export const WEBLLM_MODELS: WebLLMModelInfo[] = [
    {
        id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
        name: 'Llama 3.2 1B',
        description: 'Compact Llama model, good for most tasks',
        estimatedVRAM: 1.5,
        contextLength: 4096
    },
    {
        id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
        name: 'Llama 3.2 3B',
        description: 'Larger Llama model, better quality',
        estimatedVRAM: 3,
        contextLength: 4096
    },
    {
        id: 'Mistral-7B-Instruct-v0.3-q4f16_1-MLC',
        name: 'Mistral 7B',
        description: 'High-quality instruction-following model',
        estimatedVRAM: 5,
        contextLength: 8192
    },
    {
        id: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
        name: 'Phi-3.5 Mini',
        description: 'Microsoft Phi model, efficient and capable',
        estimatedVRAM: 2.5,
        contextLength: 4096
    }
];


export const DEFAULT_WEBLLM_MODEL = WEBLLM_MODELS[0].id;



export class WebLLMProvider implements ModelProvider {
    readonly name = 'webllm';
    readonly type = 'local' as const;
    readonly description = 'Local LLM inference via WebGPU (Brave, Firefox, Chrome)';

    private engine: webllm.MLCEngine | null = null;
    private currentModelId: string = DEFAULT_WEBLLM_MODEL;
    private progress: DownloadProgress | null = null;
    private sessions: Map<string, ChatSession> = new Map();
    private initialized = false;


    async checkAvailability(): Promise<ProviderAvailability> {
        // Check for WebGPU support
        if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
            console.log('WebLLM: WebGPU not supported - navigator.gpu not available');
            return {
                available: false,
                reason: 'WebGPU is not supported in this browser'
            };
        }

        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const gpu = (navigator as any).gpu;
            const adapter = await gpu.requestAdapter();
            if (!adapter) {
                console.log('WebLLM: No WebGPU adapter found');
                return {
                    available: false,
                    reason: 'No WebGPU adapter found'
                };
            }

            // Check if we have enough VRAM (estimate from adapter limits)
            // Use adapter.limits instead of device.limits to get the actual hardware capabilities
            // Device limits are conservative defaults unless explicitly requested
            const maxBufferSize = adapter.limits.maxBufferSize;
            console.log(`WebLLM: maxBufferSize = ${maxBufferSize} bytes (${(maxBufferSize / (1024 * 1024 * 1024)).toFixed(2)}GB)`);

            // Estimate VRAM using same heuristic as hardware diagnostics
            // maxBufferSize is typically a fraction of total VRAM, multiply by 4 as heuristic
            const estimatedVRAM = (maxBufferSize / (1024 * 1024 * 1024)) * 4;

            // Get minimum VRAM requirement for the current model
            const currentModel = WEBLLM_MODELS.find(m => m.id === this.currentModelId);
            const minVRAM = currentModel ? currentModel.estimatedVRAM : 1.5;

            console.log(`WebLLM: Estimated VRAM: ${estimatedVRAM.toFixed(1)}GB, Required: ${minVRAM}GB, Model: ${this.currentModelId}`);

            if (estimatedVRAM < minVRAM) {
                return {
                    available: false,
                    reason: `Insufficient GPU memory for WebLLM models (estimated ${estimatedVRAM.toFixed(1)}GB, need ${minVRAM}GB)`
                };
            }

            console.log('WebLLM: Available! VRAM check passed.');
            return {
                available: true,
                requiresDownload: true,
                downloadSize: this.getModelDownloadSize()
            };
        } catch (error) {
            console.error('WebLLM: Availability check failed with error:', error);
            return {
                available: false,
                reason: `WebGPU initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }


    private getModelDownloadSize(): number {
        const model = WEBLLM_MODELS.find(m => m.id === this.currentModelId);
        // Rough estimate: VRAM * 1.2 for download size
        return model ? model.estimatedVRAM * 1.2 * 1024 * 1024 * 1024 : 2 * 1024 * 1024 * 1024;
    }



    async initialize(config?: ProviderConfig): Promise<void> {
        if (this.initialized && this.engine) {
            return;
        }

        // Set model from config if provided
        if (config?.modelId) {
            const validModel = WEBLLM_MODELS.find(m => m.id === config.modelId);
            if (validModel) {
                this.currentModelId = config.modelId;
            }
        }

        this.progress = {
            phase: 'downloading',
            percentage: 0
        };

        try {
            // Create engine with progress callback
            this.engine = await webllm.CreateMLCEngine(
                this.currentModelId,
                {
                    initProgressCallback: (report) => {
                        this.handleProgressReport(report);
                    }
                }
            );

            this.progress = {
                phase: 'ready',
                percentage: 100
            };
            this.initialized = true;
        } catch (error) {
            this.progress = null;
            throw new Error(`Failed to initialize WebLLM: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }


    private handleProgressReport(report: webllm.InitProgressReport): void {
        // Parse progress from WebLLM report
        const text = report.text || '';

        // Determine phase based on progress text
        let phase: 'downloading' | 'loading' | 'ready' = 'downloading';
        if (text.includes('Loading')) {
            phase = 'loading';
        } else if (text.includes('Finish')) {
            phase = 'ready';
        }

        this.progress = {
            phase,
            percentage: Math.round(report.progress * 100),
            currentFile: text
        };
    }


    async createSession(config: SessionConfig): Promise<ChatSession> {
        if (!this.engine) {
            throw new Error('WebLLM engine not initialized. Call initialize() first.');
        }

        const sessionId = generateSessionId();
        const messages: ChatCompletionMessageParam[] = [];

        // Add system prompt if provided
        if (config.systemPrompt) {
            messages.push({
                role: 'system',
                content: config.systemPrompt
            });
        }

        const session: ChatSession = {
            id: sessionId,
            provider: this.name,
            config,
            _internal: { messages }
        };

        this.sessions.set(sessionId, session);
        return session;
    }



    async *promptStreaming(
        session: ChatSession,
        prompt: string,
        signal?: AbortSignal
    ): AsyncIterable<string> {
        if (!this.engine) {
            throw new Error('WebLLM engine not initialized');
        }

        const storedSession = this.sessions.get(session.id);
        if (!storedSession) {
            throw new Error(`Session ${session.id} not found`);
        }

        // Get internal message history
        const internal = storedSession._internal as { messages: ChatCompletionMessageParam[] };

        // Add user message to history
        internal.messages.push({
            role: 'user',
            content: prompt
        });

        try {
            // Create streaming completion
            const asyncChunkGenerator = await this.engine.chat.completions.create({
                messages: internal.messages,
                temperature: session.config.temperature,
                top_p: 0.95,  // WebLLM uses top_p instead of topK
                max_tokens: session.config.maxTokens || 2048,
                stream: true,
                stream_options: { include_usage: true }
            });

            let fullResponse = '';

            for await (const chunk of asyncChunkGenerator) {
                // Check for abort signal
                if (signal?.aborted) {
                    break;
                }

                const delta = chunk.choices[0]?.delta?.content;
                if (delta) {
                    fullResponse += delta;
                    yield delta;
                }
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


    async destroySession(session: ChatSession): Promise<void> {
        this.sessions.delete(session.id);
    }


    getProgress(): DownloadProgress | null {
        return this.progress;
    }


    async dispose(): Promise<void> {
        this.sessions.clear();
        if (this.engine) {
            // WebLLM doesn't have explicit dispose, but we can reset
            this.engine = null;
        }
        this.initialized = false;
        this.progress = null;
    }


    getCurrentModelId(): string {
        return this.currentModelId;
    }


    async setModel(modelId: string): Promise<void> {
        const validModel = WEBLLM_MODELS.find(m => m.id === modelId);
        if (!validModel) {
            throw new Error(`Invalid model ID: ${modelId}. Available models: ${WEBLLM_MODELS.map(m => m.id).join(', ')}`);
        }

        if (modelId !== this.currentModelId) {
            // Need to reinitialize with new model
            await this.dispose();
            this.currentModelId = modelId;
            await this.initialize();
        }
    }


    static getAvailableModels(): WebLLMModelInfo[] {
        return [...WEBLLM_MODELS];
    }


    static getModelInfo(modelId: string): WebLLMModelInfo | undefined {
        return WEBLLM_MODELS.find(m => m.id === modelId);
    }
}
