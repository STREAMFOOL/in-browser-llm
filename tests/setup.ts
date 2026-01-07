// Test setup file for Vitest
import { afterEach } from 'vitest';

// Clean up DOM after each test
afterEach(() => {
    document.body.innerHTML = '';
});

// Mock window.ai if not available (for testing environments)
if (typeof window !== 'undefined' && !(window as any).ai) {
    (window as any).ai = {
        languageModel: {
            capabilities: async () => ({ status: 'no' }),
            create: async () => ({
                prompt: async () => 'Mock response',
                promptStreaming: async function* () {
                    yield 'Mock ';
                    yield 'response';
                },
                destroy: async () => { }
            })
        }
    };
}
