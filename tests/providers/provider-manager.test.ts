

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type {
    ModelProvider,
    ProviderAvailability,
    SessionConfig,
    ChatSession,
    DownloadProgress
} from '../../src/providers/model-provider';
import { ProviderManager, PROVIDER_PRIORITIES } from '../../src/providers/provider-manager';


function createMockProvider(
    name: string,
    type: 'local' | 'api',
    available: boolean,
    reason?: string
): ModelProvider {
    const sessions = new Map<string, ChatSession>();
    let initialized = false;

    return {
        name,
        type,
        description: `Mock ${name} provider`,

        async checkAvailability(): Promise<ProviderAvailability> {
            return {
                available,
                reason: available ? undefined : reason
            };
        },

        async initialize(): Promise<void> {
            if (!available) {
                throw new Error(`Provider ${name} is not available`);
            }
            initialized = true;
        },

        async createSession(config: SessionConfig): Promise<ChatSession> {
            if (!initialized) {
                throw new Error('Provider not initialized');
            }
            const session: ChatSession = {
                id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                provider: name,
                config
            };
            sessions.set(session.id, session);
            return session;
        },

        async *promptStreaming(): AsyncIterable<string> {
            yield 'test response';
        },

        async destroySession(session: ChatSession): Promise<void> {
            sessions.delete(session.id);
        },

        getProgress(): DownloadProgress | null {
            return initialized ? { phase: 'ready', percentage: 100 } : null;
        },

        async dispose(): Promise<void> {
            sessions.clear();
            initialized = false;
        }
    };
}

describe('ProviderManager - Provider Detection', () => {
    let manager: ProviderManager;

    beforeEach(() => {
        manager = new ProviderManager();
    });

    afterEach(async () => {
        await manager.dispose();
    });


    it('should register providers correctly', () => {
        const provider = createMockProvider('test-provider', 'local', true);
        manager.registerProvider(provider);

        expect(manager.getProvider('test-provider')).toBe(provider);
    });


    it('should return null for non-existent provider', () => {
        expect(manager.getProvider('non-existent')).toBeNull();
    });


    it('should detect all registered providers', async () => {
        const chromeProvider = createMockProvider('chrome-gemini', 'local', true);
        const webllmProvider = createMockProvider('webllm', 'local', false, 'WebGPU not available');
        const apiProvider = createMockProvider('api', 'api', true);

        manager.registerProvider(chromeProvider);
        manager.registerProvider(webllmProvider);
        manager.registerProvider(apiProvider);

        const detected = await manager.detectProviders();

        expect(detected).toHaveLength(3);
        expect(detected[0].name).toBe('chrome-gemini');
        expect(detected[0].available).toBe(true);
        expect(detected[1].name).toBe('webllm');
        expect(detected[1].available).toBe(false);
        expect(detected[1].reason).toBe('WebGPU not available');
        expect(detected[2].name).toBe('api');
        expect(detected[2].available).toBe(true);
    });


    it('should return providers sorted by priority', async () => {
        // Register in reverse priority order
        const apiProvider = createMockProvider('api', 'api', true);
        const webllmProvider = createMockProvider('webllm', 'local', true);
        const chromeProvider = createMockProvider('chrome-gemini', 'local', true);

        manager.registerProvider(apiProvider);
        manager.registerProvider(webllmProvider);
        manager.registerProvider(chromeProvider);

        const detected = await manager.detectProviders();

        expect(detected[0].name).toBe('chrome-gemini');
        expect(detected[1].name).toBe('webllm');
        expect(detected[2].name).toBe('api');
    });
});

describe('ProviderManager - Auto-Selection Logic', () => {
    let manager: ProviderManager;

    beforeEach(() => {
        manager = new ProviderManager();
    });

    afterEach(async () => {
        await manager.dispose();
    });


    it('should auto-select Chrome provider when available', async () => {
        const chromeProvider = createMockProvider('chrome-gemini', 'local', true);
        const webllmProvider = createMockProvider('webllm', 'local', true);
        const apiProvider = createMockProvider('api', 'api', true);

        manager.registerProvider(chromeProvider);
        manager.registerProvider(webllmProvider);
        manager.registerProvider(apiProvider);

        const selected = await manager.autoSelectProvider();

        expect(selected).not.toBeNull();
        expect(selected!.name).toBe('chrome-gemini');
    });


    it('should fall back to WebLLM when Chrome unavailable', async () => {
        const chromeProvider = createMockProvider('chrome-gemini', 'local', false, 'Not Chrome');
        const webllmProvider = createMockProvider('webllm', 'local', true);
        const apiProvider = createMockProvider('api', 'api', true);

        manager.registerProvider(chromeProvider);
        manager.registerProvider(webllmProvider);
        manager.registerProvider(apiProvider);

        const selected = await manager.autoSelectProvider();

        expect(selected).not.toBeNull();
        expect(selected!.name).toBe('webllm');
    });


    it('should fall back to API when local providers unavailable', async () => {
        const chromeProvider = createMockProvider('chrome-gemini', 'local', false, 'Not Chrome');
        const webllmProvider = createMockProvider('webllm', 'local', false, 'No WebGPU');
        const apiProvider = createMockProvider('api', 'api', true);

        manager.registerProvider(chromeProvider);
        manager.registerProvider(webllmProvider);
        manager.registerProvider(apiProvider);

        const selected = await manager.autoSelectProvider();

        expect(selected).not.toBeNull();
        expect(selected!.name).toBe('api');
    });


    it('should return null when no providers available', async () => {
        const chromeProvider = createMockProvider('chrome-gemini', 'local', false, 'Not Chrome');
        const webllmProvider = createMockProvider('webllm', 'local', false, 'No WebGPU');
        const apiProvider = createMockProvider('api', 'api', false, 'No API key');

        manager.registerProvider(chromeProvider);
        manager.registerProvider(webllmProvider);
        manager.registerProvider(apiProvider);

        const selected = await manager.autoSelectProvider();

        expect(selected).toBeNull();
    });


    it('should return active provider after auto-selection', async () => {
        const chromeProvider = createMockProvider('chrome-gemini', 'local', true);
        manager.registerProvider(chromeProvider);

        expect(manager.getActiveProvider()).toBeNull();

        await manager.autoSelectProvider();

        expect(manager.getActiveProvider()).not.toBeNull();
        expect(manager.getActiveProvider()!.name).toBe('chrome-gemini');
    });
});

describe('ProviderManager - Manual Switching', () => {
    let manager: ProviderManager;

    beforeEach(() => {
        manager = new ProviderManager();
    });

    afterEach(async () => {
        await manager.dispose();
    });


    it('should allow manual provider switching', async () => {
        const chromeProvider = createMockProvider('chrome-gemini', 'local', true);
        const webllmProvider = createMockProvider('webllm', 'local', true);

        manager.registerProvider(chromeProvider);
        manager.registerProvider(webllmProvider);

        // Auto-select first
        await manager.autoSelectProvider();
        expect(manager.getActiveProvider()!.name).toBe('chrome-gemini');

        // Manually switch to webllm
        await manager.setActiveProvider('webllm');
        expect(manager.getActiveProvider()!.name).toBe('webllm');
    });


    it('should throw error when switching to unavailable provider', async () => {
        const chromeProvider = createMockProvider('chrome-gemini', 'local', true);
        const webllmProvider = createMockProvider('webllm', 'local', false, 'No WebGPU');

        manager.registerProvider(chromeProvider);
        manager.registerProvider(webllmProvider);

        await expect(manager.setActiveProvider('webllm')).rejects.toThrow('not available');
    });


    it('should throw error when switching to non-existent provider', async () => {
        const chromeProvider = createMockProvider('chrome-gemini', 'local', true);
        manager.registerProvider(chromeProvider);

        await expect(manager.setActiveProvider('non-existent')).rejects.toThrow('not found');
    });


    it('should notify listeners when provider changes', async () => {
        const chromeProvider = createMockProvider('chrome-gemini', 'local', true);
        const webllmProvider = createMockProvider('webllm', 'local', true);

        manager.registerProvider(chromeProvider);
        manager.registerProvider(webllmProvider);

        const changes: string[] = [];
        manager.onProviderChange((provider) => {
            changes.push(provider?.name || 'null');
        });

        await manager.autoSelectProvider();
        await manager.setActiveProvider('webllm');

        expect(changes).toEqual(['chrome-gemini', 'webllm']);
    });


    it('should allow unsubscribing from provider changes', async () => {
        const chromeProvider = createMockProvider('chrome-gemini', 'local', true);
        const webllmProvider = createMockProvider('webllm', 'local', true);

        manager.registerProvider(chromeProvider);
        manager.registerProvider(webllmProvider);

        const changes: string[] = [];
        const unsubscribe = manager.onProviderChange((provider) => {
            changes.push(provider?.name || 'null');
        });

        await manager.autoSelectProvider();
        unsubscribe();
        await manager.setActiveProvider('webllm');

        expect(changes).toEqual(['chrome-gemini']);
    });
});

describe('ProviderManager - Provider Priorities', () => {

    it('should have correct priority order', () => {
        expect(PROVIDER_PRIORITIES['chrome-gemini']).toBeLessThan(PROVIDER_PRIORITIES['webllm']);
        expect(PROVIDER_PRIORITIES['webllm']).toBeLessThan(PROVIDER_PRIORITIES['api']);
    });
});
