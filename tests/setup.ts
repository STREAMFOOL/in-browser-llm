// Test setup file for Vitest
import { afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';

// Clean up DOM after each test
afterEach(() => {
    document.body.innerHTML = '';
});

// Clean up IndexedDB after each test
afterEach(async () => {
    try {
        // Wait a bit for any pending operations to complete
        await new Promise(resolve => setTimeout(resolve, 100));
        await Dexie.delete('LocalAIAssistant');
    } catch (e) {
        // Ignore errors
    }
}, 20000); // Increase timeout to 20 seconds for IndexedDB cleanup

// Mock window.ai if not available (for testing environments)
if (typeof window !== 'undefined' && !(window as any).ai) {
    const createMockSession = () => ({
        prompt: async () => 'Mock response',
        promptStreaming: async function* () {
            yield 'Mock ';
            yield 'response';
        },
        destroy: () => { },
        clone: async () => createMockSession()
    });

    (window as any).ai = {
        languageModel: {
            capabilities: async () => ({ available: 'readily' }),
            create: async () => createMockSession()
        }
    };
}

// Mock Worker for testing environments
class MockWorker {
    private listeners: Map<string, Set<(event: any) => void>> = new Map();
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;

    constructor(scriptURL: string | URL) {
        // Worker is created but not initialized yet
    }

    postMessage(message: any) {
        // Simulate async message processing
        setTimeout(() => {
            const { type, modelType, task } = message;

            if (type === 'initialize') {
                // Respond with initialized message
                this.dispatchEvent({
                    data: {
                        type: 'initialized',
                        payload: {
                            modelType,
                            gpuInfo: {
                                adapter: 'available',
                                device: 'available'
                            }
                        }
                    }
                });
            } else if (type === 'inference') {
                // Simulate progress updates
                this.dispatchEvent({
                    data: {
                        type: 'progress',
                        payload: {
                            phase: 'starting',
                            percentage: 0,
                            message: 'Starting inference'
                        }
                    }
                });

                setTimeout(() => {
                    this.dispatchEvent({
                        data: {
                            type: 'progress',
                            payload: {
                                phase: 'processing',
                                percentage: 50,
                                message: 'Processing'
                            }
                        }
                    });
                }, 5);

                setTimeout(() => {
                    this.dispatchEvent({
                        data: {
                            type: 'progress',
                            payload: {
                                phase: 'complete',
                                percentage: 100,
                                message: 'Complete'
                            }
                        }
                    });
                }, 10);

                setTimeout(() => {
                    this.dispatchEvent({
                        data: {
                            type: 'result',
                            payload: {
                                output: 'Mock inference result',
                                metadata: {
                                    modelType: task?.type || 'unknown'
                                }
                            }
                        }
                    });
                }, 15);
            } else if (type === 'cancel') {
                // Respond with cancelled message
                this.dispatchEvent({
                    data: {
                        type: 'cancelled',
                        payload: {
                            message: 'Inference cancelled'
                        }
                    }
                });
            }
        }, 0);
    }

    addEventListener(type: string, listener: (event: any) => void) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, new Set());
        }
        this.listeners.get(type)!.add(listener);
    }

    removeEventListener(type: string, listener: (event: any) => void) {
        const listeners = this.listeners.get(type);
        if (listeners) {
            listeners.delete(listener);
        }
    }

    private dispatchEvent(event: any) {
        // Call onmessage if set
        if (this.onmessage) {
            this.onmessage(event as MessageEvent);
        }

        // Call all registered listeners
        const listeners = this.listeners.get('message');
        if (listeners) {
            listeners.forEach(listener => listener(event));
        }
    }

    terminate() {
        this.listeners.clear();
        this.onmessage = null;
        this.onerror = null;
    }
}

(global as any).Worker = MockWorker;
