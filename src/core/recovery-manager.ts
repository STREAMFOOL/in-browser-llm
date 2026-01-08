

export interface RecoveryOptions {
    onGPURecovery?: () => Promise<void>;
    onApplicationReset?: () => Promise<void>;
}

export class RecoveryManager {
    private gpuRecoveryAttempts: number = 0;
    private maxGPURecoveryAttempts: number = 3;
    private gpuRecoveryInProgress: boolean = false;
    private options: RecoveryOptions;

    constructor(options: RecoveryOptions = {}) {
        this.options = options;
        this.setupGPUContextLossDetection();
    }


    private setupGPUContextLossDetection(): void {
        // Listen for WebGPU device lost events
        if (navigator.gpu) {
            navigator.gpu.requestAdapter().then(adapter => {
                if (adapter) {
                    adapter.requestDevice().then(device => {
                        device.lost.then(info => {
                            console.error('GPU device lost:', info);
                            this.handleGPUContextLoss(info.reason);
                        });
                    }).catch(error => {
                        console.warn('Could not set up GPU context loss detection:', error);
                    });
                }
            }).catch(error => {
                console.warn('Could not access GPU adapter:', error);
            });
        }
    }


    async handleGPUContextLoss(reason: string): Promise<boolean> {
        if (this.gpuRecoveryInProgress) {
            console.log('GPU recovery already in progress, skipping...');
            return false;
        }

        if (this.gpuRecoveryAttempts >= this.maxGPURecoveryAttempts) {
            console.error('Max GPU recovery attempts reached. Manual reset required.');
            return false;
        }

        this.gpuRecoveryInProgress = true;
        this.gpuRecoveryAttempts++;

        console.log(`Attempting GPU recovery (attempt ${this.gpuRecoveryAttempts}/${this.maxGPURecoveryAttempts})...`);
        console.log('GPU loss reason:', reason);

        try {
            // Wait a bit before attempting recovery
            await this.delay(1000);

            // Attempt to reinitialize GPU
            const recovered = await this.reinitializeGPU();

            if (recovered) {
                console.log('GPU recovery successful');
                this.gpuRecoveryAttempts = 0; // Reset counter on success

                // Call recovery callback if provided
                if (this.options.onGPURecovery) {
                    await this.options.onGPURecovery();
                }

                this.gpuRecoveryInProgress = false;
                return true;
            } else {
                console.error('GPU recovery failed');
                this.gpuRecoveryInProgress = false;
                return false;
            }
        } catch (error) {
            console.error('Error during GPU recovery:', error);
            this.gpuRecoveryInProgress = false;
            return false;
        }
    }


    private async reinitializeGPU(): Promise<boolean> {
        try {
            if (!navigator.gpu) {
                console.error('WebGPU not available');
                return false;
            }

            const adapter = await navigator.gpu.requestAdapter();
            if (!adapter) {
                console.error('Could not get GPU adapter');
                return false;
            }

            const device = await adapter.requestDevice();
            if (!device) {
                console.error('Could not get GPU device');
                return false;
            }

            // Test that the device is working
            const testBuffer = device.createBuffer({
                size: 4,
                usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
            });

            // If we got here, GPU is working
            testBuffer.destroy();
            console.log('GPU reinitialization successful');
            return true;
        } catch (error) {
            console.error('GPU reinitialization failed:', error);
            return false;
        }
    }


    async resetApplication(): Promise<void> {
        console.log('Resetting application...');

        try {
            // Clear IndexedDB
            await this.clearIndexedDB();

            // Clear OPFS if available
            await this.clearOPFS();

            // Clear localStorage
            localStorage.clear();

            // Clear sessionStorage
            sessionStorage.clear();

            // Call reset callback if provided
            if (this.options.onApplicationReset) {
                await this.options.onApplicationReset();
            }

            console.log('Application reset complete');

            // Reload the page after a short delay
            await this.delay(500);
            window.location.reload();
        } catch (error) {
            console.error('Error during application reset:', error);
            // Force reload anyway
            window.location.reload();
        }
    }


    private async clearIndexedDB(): Promise<void> {
        try {
            const databases = await indexedDB.databases();

            for (const db of databases) {
                if (db.name) {
                    console.log(`Deleting IndexedDB database: ${db.name}`);
                    await new Promise<void>((resolve, reject) => {
                        const request = indexedDB.deleteDatabase(db.name!);
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                        request.onblocked = () => {
                            console.warn(`Database ${db.name} deletion blocked`);
                            resolve(); // Continue anyway
                        };
                    });
                }
            }

            console.log('IndexedDB cleared');
        } catch (error) {
            console.error('Error clearing IndexedDB:', error);
            throw error;
        }
    }


    private async clearOPFS(): Promise<void> {
        try {
            if (!navigator.storage || !navigator.storage.getDirectory) {
                console.log('OPFS not available, skipping...');
                return;
            }

            const root = await navigator.storage.getDirectory();

            // Remove all entries
            for await (const entry of (root as any).values()) {
                try {
                    await root.removeEntry(entry.name, { recursive: true });
                    console.log(`Removed OPFS entry: ${entry.name}`);
                } catch (error) {
                    console.warn(`Could not remove OPFS entry ${entry.name}:`, error);
                }
            }

            console.log('OPFS cleared');
        } catch (error) {
            console.error('Error clearing OPFS:', error);
            // Don't throw - OPFS might not be available
        }
    }


    getRecoveryStatus(): {
        gpuRecoveryAttempts: number;
        maxGPURecoveryAttempts: number;
        canAttemptGPURecovery: boolean;
        gpuRecoveryInProgress: boolean;
    } {
        return {
            gpuRecoveryAttempts: this.gpuRecoveryAttempts,
            maxGPURecoveryAttempts: this.maxGPURecoveryAttempts,
            canAttemptGPURecovery: this.gpuRecoveryAttempts < this.maxGPURecoveryAttempts,
            gpuRecoveryInProgress: this.gpuRecoveryInProgress
        };
    }


    resetGPURecoveryCounter(): void {
        this.gpuRecoveryAttempts = 0;
    }


    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
