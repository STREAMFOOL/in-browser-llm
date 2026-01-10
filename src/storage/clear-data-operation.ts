import { StorageManager } from './storage-manager';
import { OPFSManager } from './opfs-manager';

export interface ClearResult {
    success: boolean;
    clearedStores: string[];
    clearedFiles: number;
    errors: string[];
}

export interface DataSize {
    conversations: number;
    settings: number;
    assets: number;
    modelCache: number;
    total: number;
}

export class ClearDataOperation {
    private storageManager: StorageManager;
    private opfsManager: OPFSManager;

    constructor(storageManager: StorageManager, opfsManager: OPFSManager) {
        this.storageManager = storageManager;
        this.opfsManager = opfsManager;
    }

    async clearAll(): Promise<ClearResult> {
        const result: ClearResult = {
            success: true,
            clearedStores: [],
            clearedFiles: 0,
            errors: [],
        };

        try {
            await this.clearConversations();
            result.clearedStores.push('conversations');
        } catch (error) {
            result.success = false;
            const errorMsg = error instanceof Error ? error.message : String(error);
            result.errors.push(`Failed to clear conversations: ${errorMsg}`);
            console.error('Failed to clear conversations:', error);
        }

        try {
            await this.clearSettings();
            result.clearedStores.push('settings');
        } catch (error) {
            result.success = false;
            const errorMsg = error instanceof Error ? error.message : String(error);
            result.errors.push(`Failed to clear settings: ${errorMsg}`);
            console.error('Failed to clear settings:', error);
        }

        try {
            await this.clearModelCache();
            result.clearedStores.push('modelCache');
        } catch (error) {
            result.success = false;
            const errorMsg = error instanceof Error ? error.message : String(error);
            result.errors.push(`Failed to clear model cache: ${errorMsg}`);
            console.error('Failed to clear model cache:', error);
        }

        try {
            const fileCount = await this.clearAssets();
            result.clearedFiles = fileCount;
        } catch (error) {
            result.success = false;
            const errorMsg = error instanceof Error ? error.message : String(error);
            result.errors.push(`Failed to clear assets: ${errorMsg}`);
            console.error('Failed to clear assets:', error);
        }

        return result;
    }

    async clearConversations(): Promise<void> {
        await this.storageManager.clearStore('threads');
        await this.storageManager.clearStore('messages');
    }

    async clearSettings(): Promise<void> {
        await this.storageManager.clearStore('settings');
    }

    async clearAssets(): Promise<number> {
        const assets = await this.opfsManager.listAssets();
        const fileCount = assets.length;
        await this.opfsManager.clearAllAssets();
        return fileCount;
    }

    async clearModelCache(): Promise<void> {
        // Model cache would be stored in a separate store if implemented
        // For now, this is a no-op as model weights are not stored in IndexedDB
    }

    async getDataSize(): Promise<DataSize> {
        const estimate = await this.storageManager.getStorageEstimate();

        const threadsSize = await this.storageManager.getStoreSize('threads');
        const messagesSize = await this.storageManager.getStoreSize('messages');
        const settingsSize = await this.storageManager.getStoreSize('settings');
        const assetsSize = await this.opfsManager.getTotalSize();

        return {
            conversations: threadsSize + messagesSize,
            settings: settingsSize,
            assets: assetsSize,
            modelCache: 0,
            total: estimate.usage,
        };
    }
}
