

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { APIProvider } from '../../src/providers/api-provider';
import { StorageManager } from '../../src/storage/storage-manager';

describe('API Provider Properties', () => {
    let storage: StorageManager;
    let provider: APIProvider;

    beforeEach(async () => {
        storage = new StorageManager();
        provider = new APIProvider(storage);
        // Clear any existing data
        await storage.clearAllData();
    });

    afterEach(async () => {
        await provider.dispose();
        await storage.clearAllData();
    });


    it('Property 37: API keys are stored securely in IndexedDB and not accessible via DOM', async () => {
        await fc.assert(
            fc.asyncProperty(
                // Generate random API keys (non-empty, non-whitespace-only)
                fc.string({ minLength: 20, maxLength: 100 }).filter(s => s.trim().length > 0),
                async (apiKey) => {
                    // Clear any previous state
                    await provider.dispose();
                    await storage.clearAllData();

                    // Create fresh provider instance
                    provider = new APIProvider(storage);

                    // Initialize provider with API key
                    await provider.initialize({
                        apiKey,
                        modelId: 'gpt-4o-mini'
                    });

                    // Verify API key is stored in IndexedDB
                    const storedKey = await storage.loadSetting('api_key');
                    expect(storedKey).toBe(apiKey);

                    // Verify API key is NOT in localStorage
                    const localStorageKeys = Object.keys(localStorage);
                    for (const key of localStorageKeys) {
                        const value = localStorage.getItem(key);
                        expect(value).not.toContain(apiKey);
                    }

                    // Verify API key is NOT in sessionStorage
                    const sessionStorageKeys = Object.keys(sessionStorage);
                    for (const key of sessionStorageKeys) {
                        const value = sessionStorage.getItem(key);
                        expect(value).not.toContain(apiKey);
                    }

                    // Verify API key is NOT accessible via DOM
                    // Check all text nodes in the document
                    const walker = document.createTreeWalker(
                        document.body,
                        NodeFilter.SHOW_TEXT,
                        null
                    );

                    let node: Node | null;
                    while ((node = walker.nextNode())) {
                        const textContent = node.textContent || '';
                        // API key should not appear in plain text in the DOM
                        expect(textContent).not.toContain(apiKey);
                    }

                    // Check all input values
                    const inputs = document.querySelectorAll('input');
                    inputs.forEach(input => {
                        // Password fields might contain the key, but it should be masked
                        if (input.type !== 'password') {
                            expect(input.value).not.toContain(apiKey);
                        }
                    });

                    // Check all data attributes
                    const allElements = document.querySelectorAll('*');
                    allElements.forEach(element => {
                        Array.from(element.attributes).forEach(attr => {
                            if (attr.name.startsWith('data-')) {
                                expect(attr.value).not.toContain(apiKey);
                            }
                        });
                    });
                }
            ),
            { numRuns: 100 }
        );
    });


    it('API keys persist across provider instances', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 20, maxLength: 100 }),
                async (apiKey) => {
                    // Store API key with first provider instance
                    await provider.setApiKey(apiKey);

                    // Dispose first provider
                    await provider.dispose();

                    // Create new provider instance with same storage
                    const newProvider = new APIProvider(storage);

                    // Check availability should load the stored key
                    await newProvider.checkAvailability();

                    // Verify the key is still accessible
                    const storedKey = await storage.loadSetting('api_key');
                    expect(storedKey).toBe(apiKey);

                    await newProvider.dispose();
                }
            ),
            { numRuns: 100 }
        );
    });


    it('Backend configuration is stored in IndexedDB', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom('openai', 'anthropic', 'ollama'),
                fc.string({ minLength: 10, maxLength: 50 }),
                async (backend, endpoint) => {
                    // Set backend and endpoint
                    await provider.setBackend(backend as 'openai' | 'anthropic' | 'ollama');
                    await provider.setEndpoint(endpoint);

                    // Verify stored in IndexedDB
                    const storedBackend = await storage.loadSetting('api_backend');
                    const storedEndpoint = await storage.loadSetting('api_endpoint');

                    expect(storedBackend).toBe(backend);
                    expect(storedEndpoint).toBe(endpoint);

                    // Verify NOT in localStorage
                    expect(localStorage.getItem('api_backend')).toBeNull();
                    expect(localStorage.getItem('api_endpoint')).toBeNull();
                }
            ),
            { numRuns: 100 }
        );
    });
});
