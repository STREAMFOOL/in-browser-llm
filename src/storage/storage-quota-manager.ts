/**
 * Storage Quota Manager
 * 
 * Monitors storage usage and requests additional quota when needed.
 * Integrates with the notification system to inform users about storage status.
 */

import { notify } from '../ui/notification-api';

export interface StorageStatus {
    usage: number;
    quota: number;
    percentUsed: number;
    isLow: boolean;        // > 80%
    isExceeded: boolean;   // > 100%
}

export interface StorageBreakdown {
    models: number;
    conversations: number;
    cache: number;
}

export class StorageQuotaManager {
    private readonly WARNING_THRESHOLD = 0.8;  // 80%
    private hasShownWarning = false;

    /**
     * Check current storage quota and usage
     * Returns storage status with usage metrics
     */
    async checkQuota(): Promise<StorageStatus> {
        const estimate = await navigator.storage.estimate();
        const usage = estimate.usage || 0;
        const quota = estimate.quota || 0;
        const percentUsed = quota > 0 ? usage / quota : 0;

        const status: StorageStatus = {
            usage,
            quota,
            percentUsed,
            isLow: percentUsed >= this.WARNING_THRESHOLD,
            isExceeded: percentUsed >= 1,
        };

        // Show warning if storage is low (but not yet exceeded)
        if (status.isLow && !status.isExceeded && !this.hasShownWarning) {
            this.showWarning(status);
            this.hasShownWarning = true;
        }

        return status;
    }

    /**
     * Show warning notification when storage is running low
     * Includes storage amounts in GB and action button
     */
    private showWarning(status: StorageStatus): void {
        notify({
            type: 'warning',
            title: 'Storage Running Low',
            message: 'Your storage is getting full. Consider clearing old conversations or managing your data.',
            storageInfo: {
                required: 0,
                current: status.usage,
                quota: status.quota,
            },
            action: {
                label: 'Manage Storage',
                callback: () => this.openStorageSettings(),
            },
        });
    }

    /**
     * Open storage management section in settings
     */
    private openStorageSettings(): void {
        // Dispatch custom event to open settings
        const event = new CustomEvent('open-settings', {
            detail: { section: 'storage' },
            bubbles: true,
            composed: true,
        });
        document.dispatchEvent(event);
    }

    /**
     * Request additional storage quota from the browser
     * Shows notifications for success or failure
     */
    async requestMoreStorage(reason: string): Promise<boolean> {
        if (!navigator.storage?.persist) {
            // Show fallback notification for unsupported browsers
            this.showUnsupportedBrowserFallback(reason);
            return false;
        }

        try {
            const granted = await navigator.storage.persist();
            return granted;
        } catch (error) {
            console.error('Failed to request storage:', error);
            return false;
        }
    }

    /**
     * Show fallback notification for browsers without persist() API
     * Provides alternative suggestions
     */
    private showUnsupportedBrowserFallback(reason: string): void {
        notify({
            type: 'warning',
            title: 'Storage Persistence Unavailable',
            message: `This browser doesn't support persistent storage requests. Your data may be cleared by the browser automatically.\n\n**Reason:** ${reason}\n\n**Alternatives:**\n• Use Chrome, Edge, or Firefox for better storage support\n• Regularly export your conversations\n• Clear unused data to free up space`,
            duration: 10000, // Show longer for important message
        });
    }

    /**
     * Handle storage quota exceeded scenario
     * Requests additional storage and shows appropriate notifications
     */
    async handleExceeded(): Promise<void> {
        const status = await this.checkQuota();
        const breakdown = await this.getStorageBreakdown();

        // Show initial notification about requesting storage
        notify({
            type: 'error',
            title: 'Storage Quota Exceeded',
            message: 'Requesting additional storage from your browser...',
            storageInfo: {
                required: this.calculateRequired(),
                current: status.usage,
                quota: status.quota,
                breakdown,
            },
        });

        // Request persistent storage
        const granted = await this.requestMoreStorage('Model download and conversation storage');

        if (granted) {
            notify({
                type: 'info',
                title: 'Storage Granted',
                message: 'Your browser has granted additional storage. You can continue using the assistant.',
            });
        } else {
            notify({
                type: 'error',
                title: 'Storage Request Denied',
                message: 'Your browser denied the storage request. Try clearing old data or using a different browser.',
                action: {
                    label: 'Clear Data',
                    callback: () => this.openClearDataDialog(),
                },
            });
        }
    }

    /**
     * Calculate required storage amount
     * 22GB for Gemini Nano model + buffer
     */
    private calculateRequired(): number {
        return 22 * 1024 * 1024 * 1024;
    }

    /**
     * Open clear data dialog
     */
    private openClearDataDialog(): void {
        const event = new CustomEvent('open-clear-data', {
            bubbles: true,
            composed: true,
        });
        document.dispatchEvent(event);
    }

    /**
     * Get detailed breakdown of storage usage by category
     * Estimates based on IndexedDB stores
     */
    async getStorageBreakdown(): Promise<StorageBreakdown> {
        try {
            const databases = await indexedDB.databases();
            let models = 0;
            let conversations = 0;
            let cache = 0;

            // Estimate storage by database/store names
            for (const dbInfo of databases) {
                if (!dbInfo.name) continue;

                // Open database to get store sizes
                const db = await this.openDatabase(dbInfo.name);

                for (const storeName of db.objectStoreNames) {
                    const size = await this.estimateStoreSize(db, storeName);

                    // Categorize by store name
                    if (storeName.includes('model') || storeName.includes('weight')) {
                        models += size;
                    } else if (storeName.includes('conversation') || storeName.includes('thread') || storeName.includes('message')) {
                        conversations += size;
                    } else {
                        cache += size;
                    }
                }

                db.close();
            }

            return { models, conversations, cache };
        } catch (error) {
            console.error('Failed to get storage breakdown:', error);
            // Return zeros if breakdown fails
            return { models: 0, conversations: 0, cache: 0 };
        }
    }

    private openDatabase(name: string): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(name);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    private async estimateStoreSize(db: IDBDatabase, storeName: string): Promise<number> {
        return new Promise((resolve) => {
            try {
                const tx = db.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);
                const request = store.getAll();

                request.onsuccess = () => {
                    const data = request.result;
                    // Rough estimate: JSON stringify and measure
                    const jsonSize = JSON.stringify(data).length;
                    resolve(jsonSize);
                };

                request.onerror = () => resolve(0);
            } catch (error) {
                resolve(0);
            }
        });
    }
}

// Singleton instance
let quotaManagerInstance: StorageQuotaManager | null = null;

export function getStorageQuotaManager(): StorageQuotaManager {
    if (!quotaManagerInstance) {
        quotaManagerInstance = new StorageQuotaManager();
    }
    return quotaManagerInstance;
}
