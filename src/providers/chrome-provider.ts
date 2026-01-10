

import type {
    ModelProvider,
    ProviderAvailability,
    ProviderConfig,
    SessionConfig,
    ChatSession,
    DownloadProgress
} from './model-provider';
import { DEFAULT_SESSION_CONFIG, generateSessionId } from './model-provider';
import {
    GeminiController,
    type AISession,
    type ModelAvailability
} from './gemini-controller';


export class ChromeProvider implements ModelProvider {
    readonly name = 'chrome-gemini';
    readonly type = 'local' as const;
    readonly description = 'Chrome Built-in AI (Gemini Nano)';

    private controller: GeminiController;
    private sessions: Map<string, AISession> = new Map();
    private currentProgress: DownloadProgress | null = null;
    private initialized: boolean = false;

    constructor() {
        this.controller = new GeminiController();
    }


    async checkAvailability(): Promise<ProviderAvailability> {
        const availability = await this.controller.checkAvailability();

        return this.mapAvailability(availability);
    }


    async initialize(_config?: ProviderConfig): Promise<void> {
        if (this.initialized) {
            return;
        }

        const availability = await this.controller.checkAvailability();

        if (availability.status === 'no') {
            throw new Error('Chrome Gemini Nano is not available');
        }

        if (availability.status === 'after-download') {
            // Set progress to downloading state
            this.currentProgress = {
                phase: 'downloading',
                percentage: 0
            };

            // The actual download happens when creating a session
            // We'll update progress via the monitor callback
        }

        this.initialized = true;
        this.currentProgress = {
            phase: 'ready',
            percentage: 100
        };
    }


    async createSession(config: SessionConfig): Promise<ChatSession> {
        const mergedConfig = {
            ...DEFAULT_SESSION_CONFIG,
            ...config
        };

        const aiSession = await this.controller.createSession({
            temperature: mergedConfig.temperature,
            topK: mergedConfig.topK,
            systemPrompt: mergedConfig.systemPrompt
        });

        const sessionId = generateSessionId();
        this.sessions.set(sessionId, aiSession);

        return {
            id: sessionId,
            provider: this.name,
            config: mergedConfig,
            _internal: aiSession
        };
    }


    async *promptStreaming(
        session: ChatSession,
        prompt: string,
        signal?: AbortSignal
    ): AsyncIterable<string> {
        const aiSession = this.sessions.get(session.id);
        if (!aiSession) {
            throw new Error(`Session "${session.id}" not found`);
        }

        yield* this.controller.promptStreaming(aiSession, prompt, signal);
    }


    async destroySession(session: ChatSession): Promise<void> {
        const aiSession = this.sessions.get(session.id);
        if (aiSession) {
            await this.controller.destroySession(aiSession);
            this.sessions.delete(session.id);
        }
    }


    getProgress(): DownloadProgress | null {
        return this.currentProgress;
    }


    async dispose(): Promise<void> {
        // Destroy all sessions
        for (const [sessionId, aiSession] of this.sessions) {
            try {
                await this.controller.destroySession(aiSession);
            } catch (error) {
                console.warn(`Failed to destroy session ${sessionId}:`, error);
            }
        }
        this.sessions.clear();
        this.initialized = false;
        this.currentProgress = null;
    }


    async cloneSession(session: ChatSession): Promise<ChatSession> {
        const aiSession = this.sessions.get(session.id);
        if (!aiSession) {
            throw new Error(`Session "${session.id}" not found`);
        }

        const clonedAiSession = await this.controller.cloneSession(aiSession);
        const newSessionId = generateSessionId();
        this.sessions.set(newSessionId, clonedAiSession);

        return {
            id: newSessionId,
            provider: this.name,
            config: { ...session.config },
            _internal: clonedAiSession
        };
    }


    getController(): GeminiController {
        return this.controller;
    }


    private mapAvailability(availability: ModelAvailability): ProviderAvailability {
        switch (availability.status) {
            case 'readily':
                return {
                    available: true,
                    requiresDownload: false
                };
            case 'after-download':
                return {
                    available: true,
                    requiresDownload: true,
                    reason: 'Model needs to be downloaded'
                };
            case 'no':
            default:
                return {
                    available: false,
                    reason: 'Chrome Gemini Nano is only available in Chrome 127 or later with the Prompt API enabled.'
                };
        }
    }
}
