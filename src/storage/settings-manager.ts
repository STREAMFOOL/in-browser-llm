import type { StorageManager } from './storage-manager';

// Settings Interface

export interface Settings {
    temperature: number;
    topK: number;
    enableImageGeneration: boolean;
    enableSpeech: boolean;
    enableWebSearch: boolean;
    searchApiKey: string;
    theme: 'light' | 'dark' | 'auto';
    preferredProvider: 'chrome' | 'webllm' | 'api' | 'auto';
}

// Default Settings

export const DEFAULT_SETTINGS: Settings = {
    temperature: 0.7,
    topK: 40,
    enableImageGeneration: false,
    enableSpeech: false,
    enableWebSearch: false,
    searchApiKey: '',
    theme: 'auto',
    preferredProvider: 'auto',
};

// Change Listener Type

type ChangeListener = (key: string, value: any) => void;

// SettingsManager Class

export class SettingsManager {
    private storageManager: StorageManager;
    private changeListeners: ChangeListener[] = [];
    private cache: Map<string, any> = new Map();

    constructor(storageManager: StorageManager) {
        this.storageManager = storageManager;
    }

    /**
     * Get a setting value with default fallback
     */
    async get<T>(key: string, defaultValue: T): Promise<T> {
        // Check cache first
        if (this.cache.has(key)) {
            return this.cache.get(key) as T;
        }

        // Load from storage
        const value = await this.storageManager.loadSetting(key);

        if (value !== undefined) {
            this.cache.set(key, value);
            return value as T;
        }

        return defaultValue;
    }

    /**
     * Set a setting value and persist to storage
     */
    async set(key: string, value: any): Promise<void> {
        // Update cache
        this.cache.set(key, value);

        // Persist to storage
        await this.storageManager.saveSetting(key, value);

        // Notify listeners
        this.notifyChange(key, value);
    }

    /**
     * Get all settings with defaults
     */
    async getAll(): Promise<Settings> {
        const settings: Partial<Settings> = { ...DEFAULT_SETTINGS };

        // Load each setting from storage or use default
        for (const key of Object.keys(DEFAULT_SETTINGS) as Array<keyof Settings>) {
            const value = await this.get(key, DEFAULT_SETTINGS[key]);
            (settings as any)[key] = value;
        }

        return settings as Settings;
    }

    /**
     * Reset all settings to defaults
     */
    async resetToDefaults(): Promise<void> {
        // Clear cache
        this.cache.clear();

        // Save each default setting
        for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
            await this.storageManager.saveSetting(key, value);
            this.notifyChange(key, value);
        }
    }

    /**
     * Register a change listener
     */
    onChange(callback: ChangeListener): void {
        this.changeListeners.push(callback);
    }

    /**
     * Notify all listeners of a setting change
     */
    private notifyChange(key: string, value: any): void {
        for (const listener of this.changeListeners) {
            try {
                listener(key, value);
            } catch (error) {
                console.error('Error in settings change listener:', error);
            }
        }
    }

    /**
     * Clear the cache (useful for testing or forcing reload)
     */
    clearCache(): void {
        this.cache.clear();
    }
}
