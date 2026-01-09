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
        await Dexie.delete('LocalAIAssistant');
    } catch (e) {
        // Ignore errors
    }
});

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
if (typeof Worker === 'undefined') {
    class MockWorker {
        private listeners: Map<string, Set<(event: any) => void>> = new Map();

        constructor(scriptURL: string | URL) {
            // Simulate worker initialization
            setTimeout(() => {
                this.postMessage({ type: 'webgpu-ready', limits: {} });
            }, 0);
        }

        postMessage(message: any) {
            // Simulate async message processing
            setTimeout(() => {
                const { type, task } = message;

                if (type === 'inference') {
                    // Simulate progress updates
                    this.dispatchEvent({ data: { type: 'progress', data: { progress: 0 } } });

                    setTimeout(() => {
                        this.dispatchEvent({ data: { type: 'progress', data: { progress: 50 } } });
                    }, 10);

                    setTimeout(() => {
                        this.dispatchEvent({ data: { type: 'progress', data: { progress: 100 } } });
                    }, 20);

                    setTimeout(() => {
                        this.dispatchEvent({
                            data: {
                                type: 'result',
                                data: {
                                    type: task.type,
                                    output: 'Mock inference result',
                                    metadata: { modelType: task.type }
                                }
                            }
                        });
                    }, 30);
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
            const listeners = this.listeners.get('message');
            if (listeners) {
                listeners.forEach(listener => listener(event));
            }
        }

        terminate() {
            this.listeners.clear();
        }
    }

    (global as any).Worker = MockWorker;
}
