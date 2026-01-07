// Test setup file for Vitest
import { afterEach, beforeEach } from 'vitest';
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
