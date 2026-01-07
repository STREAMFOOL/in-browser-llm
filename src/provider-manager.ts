

import type { ModelProvider, ProviderInfo, ProviderAvailability } from './model-provider';
import { StorageManager } from './storage-manager';


const PROVIDER_PREFERENCE_KEY = 'provider-preference';


export const PROVIDER_PRIORITIES: Record<string, number> = {
    'chrome-gemini': 1,  // Chrome Provider (highest priority)
    'webllm': 2,         // WebLLM Provider
    'api': 3             // API Provider (lowest priority)
};


export type ProviderChangeCallback = (provider: ModelProvider | null) => void;


export class ProviderManager {
    private providers: Map<string, ModelProvider> = new Map();
    private activeProvider: ModelProvider | null = null;
    private changeCallbacks: Set<ProviderChangeCallback> = new Set();
    private storageManager: StorageManager;
    private availabilityCache: Map<string, ProviderAvailability> = new Map();

    constructor(storageManager?: StorageManager) {
        this.storageManager = storageManager || new StorageManager();
    }


    registerProvider(provider: ModelProvider): void {
        this.providers.set(provider.name, provider);
        // Clear availability cache when a new provider is registered
        this.availabilityCache.delete(provider.name);
    }


    getProvider(name: string): ModelProvider | null {
        return this.providers.get(name) || null;
    }


    getAllProviders(): ModelProvider[] {
        return Array.from(this.providers.values());
    }


    async detectProviders(): Promise<ProviderInfo[]> {
        const results: ProviderInfo[] = [];

        for (const [name, provider] of this.providers) {
            try {
                const availability = await provider.checkAvailability();
                this.availabilityCache.set(name, availability);

                results.push({
                    name: provider.name,
                    type: provider.type,
                    description: provider.description,
                    available: availability.available,
                    reason: availability.reason,
                    priority: PROVIDER_PRIORITIES[name] ?? 999
                });
            } catch (error) {
                console.error(`Failed to check availability for provider ${name}:`, error);
                results.push({
                    name: provider.name,
                    type: provider.type,
                    description: provider.description,
                    available: false,
                    reason: error instanceof Error ? error.message : 'Unknown error',
                    priority: PROVIDER_PRIORITIES[name] ?? 999
                });
            }
        }

        // Sort by priority (lower = higher priority)
        return results.sort((a, b) => a.priority - b.priority);
    }


    getActiveProvider(): ModelProvider | null {
        return this.activeProvider;
    }


    async setActiveProvider(providerName: string): Promise<void> {
        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new Error(`Provider "${providerName}" not found`);
        }

        // Check availability
        const availability = await provider.checkAvailability();
        if (!availability.available) {
            throw new Error(`Provider "${providerName}" is not available: ${availability.reason || 'Unknown reason'}`);
        }

        // Dispose previous provider if different
        if (this.activeProvider && this.activeProvider.name !== providerName) {
            try {
                await this.activeProvider.dispose();
            } catch (error) {
                console.warn('Failed to dispose previous provider:', error);
            }
        }

        // Initialize the new provider
        await provider.initialize();
        this.activeProvider = provider;

        // Persist preference
        await this.persistProviderPreference(providerName);

        // Notify listeners
        this.notifyProviderChange(provider);
    }


    async autoSelectProvider(): Promise<ModelProvider | null> {
        // First, try to load persisted preference
        const preferredName = await this.loadProviderPreference();
        if (preferredName) {
            const preferred = this.providers.get(preferredName);
            if (preferred) {
                try {
                    const availability = await preferred.checkAvailability();
                    if (availability.available) {
                        await preferred.initialize();
                        this.activeProvider = preferred;
                        this.notifyProviderChange(preferred);
                        return preferred;
                    }
                } catch (error) {
                    console.warn(`Preferred provider "${preferredName}" not available:`, error);
                }
            }
        }

        // Detect all providers and select by priority
        const providerInfos = await this.detectProviders();

        for (const info of providerInfos) {
            if (info.available) {
                const provider = this.providers.get(info.name);
                if (provider) {
                    try {
                        await provider.initialize();
                        this.activeProvider = provider;
                        this.notifyProviderChange(provider);
                        return provider;
                    } catch (error) {
                        console.warn(`Failed to initialize provider "${info.name}":`, error);
                        // Continue to next provider
                    }
                }
            }
        }

        // No providers available
        this.activeProvider = null;
        this.notifyProviderChange(null);
        return null;
    }


    onProviderChange(callback: ProviderChangeCallback): () => void {
        this.changeCallbacks.add(callback);
        // Return unsubscribe function
        return () => {
            this.changeCallbacks.delete(callback);
        };
    }


    getCachedAvailability(providerName: string): ProviderAvailability | null {
        return this.availabilityCache.get(providerName) || null;
    }


    clearAvailabilityCache(): void {
        this.availabilityCache.clear();
    }


    async dispose(): Promise<void> {
        for (const provider of this.providers.values()) {
            try {
                await provider.dispose();
            } catch (error) {
                console.warn(`Failed to dispose provider "${provider.name}":`, error);
            }
        }
        this.providers.clear();
        this.activeProvider = null;
        this.changeCallbacks.clear();
        this.availabilityCache.clear();
    }


    private async persistProviderPreference(providerName: string): Promise<void> {
        try {
            await this.storageManager.saveSetting(PROVIDER_PREFERENCE_KEY, providerName);
        } catch (error) {
            console.warn('Failed to persist provider preference:', error);
        }
    }


    private async loadProviderPreference(): Promise<string | null> {
        try {
            const preference = await this.storageManager.loadSetting(PROVIDER_PREFERENCE_KEY);
            return typeof preference === 'string' ? preference : null;
        } catch (error) {
            console.warn('Failed to load provider preference:', error);
            return null;
        }
    }


    private notifyProviderChange(provider: ModelProvider | null): void {
        for (const callback of this.changeCallbacks) {
            try {
                callback(provider);
            } catch (error) {
                console.error('Error in provider change callback:', error);
            }
        }
    }
}
