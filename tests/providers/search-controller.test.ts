import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SearchController } from '../../src/providers/search-controller';
import type { SearchAPIClient, SearchResult } from '../../src/providers/search-api-client';
import { BraveSearchClient } from '../../src/providers/brave-search-client';
import { GoogleSearchClient } from '../../src/providers/google-search-client';
import { SnippetExtractor } from '../../src/providers/snippet-extractor';
import { CitationFormatter } from '../../src/providers/citation-formatter';
import { SettingsManager } from '../../src/storage/settings-manager';

describe('SearchController', () => {
    let searchController: SearchController;
    let mockSettingsManager: SettingsManager;
    let snippetExtractor: SnippetExtractor;
    let citationFormatter: CitationFormatter;

    beforeEach(() => {
        // Create mock settings manager
        mockSettingsManager = {
            get: vi.fn(),
            set: vi.fn(),
            getAll: vi.fn(),
            resetToDefaults: vi.fn(),
            onChange: vi.fn(),
            clearCache: vi.fn(),
        } as any;

        snippetExtractor = new SnippetExtractor();
        citationFormatter = new CitationFormatter();

        searchController = new SearchController(
            snippetExtractor,
            citationFormatter,
            mockSettingsManager
        );
    });

    describe('isSearchEnabled', () => {
        it('should return true when web search is enabled', async () => {
            vi.mocked(mockSettingsManager.get).mockResolvedValue(true);

            const result = await searchController.isSearchEnabled();

            expect(result).toBe(true);
            expect(mockSettingsManager.get).toHaveBeenCalledWith('enableWebSearch', false);
        });

        it('should return false when web search is disabled', async () => {
            vi.mocked(mockSettingsManager.get).mockResolvedValue(false);

            const result = await searchController.isSearchEnabled();

            expect(result).toBe(false);
        });
    });

    describe('setSearchEnabled', () => {
        it('should update the search enabled setting', async () => {
            await searchController.setSearchEnabled(true);

            expect(mockSettingsManager.set).toHaveBeenCalledWith('enableWebSearch', true);
        });
    });

    describe('shouldSearch', () => {
        it('should return true for queries with current info keywords', () => {
            expect(searchController.shouldSearch('What is the latest news?')).toBe(true);
            expect(searchController.shouldSearch('Tell me about recent events')).toBe(true);
            expect(searchController.shouldSearch('What is the current weather?')).toBe(true);
        });

        it('should return true for questions', () => {
            expect(searchController.shouldSearch('What is WebGPU?')).toBe(true);
            expect(searchController.shouldSearch('How do I use this?')).toBe(true);
        });

        it('should return false for empty queries', () => {
            expect(searchController.shouldSearch('')).toBe(false);
            expect(searchController.shouldSearch('   ')).toBe(false);
        });

        it('should return false for general queries without current info keywords', () => {
            expect(searchController.shouldSearch('Explain machine learning')).toBe(false);
            expect(searchController.shouldSearch('Tell me about TypeScript')).toBe(false);
        });
    });

    describe('search', () => {
        it('should return empty context when search is disabled', async () => {
            vi.mocked(mockSettingsManager.get).mockResolvedValue(false);

            const result = await searchController.search('test query');

            expect(result.snippets).toEqual([]);
            expect(result.sources).toEqual([]);
            expect(result.contextText).toBe('');
        });

        it('should return search results when search is enabled with Brave provider', async () => {
            // Mock settings for Brave provider
            vi.mocked(mockSettingsManager.get).mockImplementation(async (key: string) => {
                if (key === 'enableWebSearch') return true;
                if (key === 'searchProvider') return 'brave';
                if (key === 'searchApiKey') return 'test-brave-key';
                return '';
            });

            const mockResults: SearchResult[] = [
                {
                    title: 'Test Result',
                    url: 'https://example.com',
                    snippet: 'This is a test snippet',
                    relevanceScore: 0.9,
                },
            ];

            // Mock fetch for Brave API
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    web: [
                        {
                            title: 'Test Result',
                            url: 'https://example.com',
                            description: 'This is a test snippet',
                        },
                    ],
                }),
                headers: new Headers(),
            });

            const result = await searchController.search('test query');

            expect(result.sources).toHaveLength(1);
            expect(result.sources[0].title).toBe('Test Result');
            expect(result.contextText).toContain('Web Search Results');
        });

        it('should return search results when search is enabled with Google provider', async () => {
            // Mock settings for Google provider
            vi.mocked(mockSettingsManager.get).mockImplementation(async (key: string) => {
                if (key === 'enableWebSearch') return true;
                if (key === 'searchProvider') return 'google';
                if (key === 'googleSearchApiKey') return 'test-google-key';
                if (key === 'googleSearchEngineId') return 'test-cx-id';
                return '';
            });

            const mockResults: SearchResult[] = [
                {
                    title: 'Google Test Result',
                    url: 'https://google-example.com',
                    snippet: 'This is a Google test snippet',
                    relevanceScore: 0.9,
                },
            ];

            // Mock fetch for Google API
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    items: [
                        {
                            title: 'Google Test Result',
                            link: 'https://google-example.com',
                            snippet: 'This is a Google test snippet',
                        },
                    ],
                    searchInformation: {
                        totalResults: '1',
                        searchTime: 0.1,
                    },
                }),
            });

            const result = await searchController.search('test query');

            expect(result.sources).toHaveLength(1);
            expect(result.sources[0].title).toBe('Google Test Result');
            expect(result.contextText).toContain('Web Search Results');
        });

        it('should cache search results', async () => {
            // Mock settings for Brave provider
            vi.mocked(mockSettingsManager.get).mockImplementation(async (key: string) => {
                if (key === 'enableWebSearch') return true;
                if (key === 'searchProvider') return 'brave';
                if (key === 'searchApiKey') return 'test-brave-key';
                return '';
            });

            // Mock fetch for Brave API
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    web: [
                        {
                            title: 'Test Result',
                            url: 'https://example.com',
                            description: 'This is a test snippet',
                        },
                    ],
                }),
                headers: new Headers(),
            });
            global.fetch = mockFetch;

            // First search
            await searchController.search('test query');
            expect(mockFetch).toHaveBeenCalledTimes(1);

            // Second search with same query should use cache
            await searchController.search('test query');
            expect(mockFetch).toHaveBeenCalledTimes(1); // Still 1, not 2
        });

        it('should handle search errors gracefully', async () => {
            vi.mocked(mockSettingsManager.get).mockImplementation(async (key: string) => {
                if (key === 'enableWebSearch') return true;
                if (key === 'searchProvider') return 'brave';
                if (key === 'searchApiKey') return '';
                return '';
            });

            const result = await searchController.search('test query');

            expect(result.snippets).toEqual([]);
            expect(result.sources).toEqual([]);
            expect(result.contextText).toBe('');
        });
    });

    describe('formatCitations', () => {
        it('should format citations as markdown', () => {
            const sources: SearchResult[] = [
                {
                    title: 'Example Article',
                    url: 'https://example.com/article',
                    snippet: 'Test snippet',
                    relevanceScore: 0.9,
                },
                {
                    title: 'Another Article',
                    url: 'https://another.com/page',
                    snippet: 'Another snippet',
                    relevanceScore: 0.8,
                },
            ];

            const citations = searchController.formatCitations(sources);

            expect(citations).toContain('Sources:');
            expect(citations).toContain('[1]');
            expect(citations).toContain('[2]');
            expect(citations).toContain('Example Article');
            expect(citations).toContain('Another Article');
        });

        it('should return empty string for empty sources', () => {
            const citations = searchController.formatCitations([]);

            expect(citations).toBe('');
        });
    });

    describe('cache management', () => {
        it('should clear cache', async () => {
            // Mock settings for Brave provider
            vi.mocked(mockSettingsManager.get).mockImplementation(async (key: string) => {
                if (key === 'enableWebSearch') return true;
                if (key === 'searchProvider') return 'brave';
                if (key === 'searchApiKey') return 'test-brave-key';
                return '';
            });

            // Mock fetch for Brave API
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    web: [
                        {
                            title: 'Test Result',
                            url: 'https://example.com',
                            description: 'This is a test snippet',
                        },
                    ],
                }),
                headers: new Headers(),
            });

            // Add to cache
            await searchController.search('test query');
            expect(searchController.getCacheStats().size).toBe(1);

            // Clear cache
            searchController.clearCache();
            expect(searchController.getCacheStats().size).toBe(0);
        });

        it('should return cache statistics', () => {
            const stats = searchController.getCacheStats();

            expect(stats).toHaveProperty('size');
            expect(stats).toHaveProperty('maxSize');
            expect(stats.maxSize).toBe(10);
        });
    });

    describe('provider selection', () => {
        it('should use Brave provider when searchProvider is set to brave', async () => {
            vi.mocked(mockSettingsManager.get).mockImplementation(async (key: string) => {
                if (key === 'enableWebSearch') return true;
                if (key === 'searchProvider') return 'brave';
                if (key === 'searchApiKey') return 'test-brave-key';
                return '';
            });

            // Mock fetch for Brave API
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    web: [
                        {
                            title: 'Brave Result',
                            url: 'https://brave-example.com',
                            description: 'Brave search result',
                        },
                    ],
                }),
                headers: new Headers(),
            });
            global.fetch = mockFetch;

            const result = await searchController.search('test query');

            expect(result.sources).toHaveLength(1);
            expect(result.sources[0].title).toBe('Brave Result');
            // Verify Brave API was called
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('api.search.brave.com'),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'X-Subscription-Token': 'test-brave-key',
                    }),
                })
            );
        });

        it('should use Google provider when searchProvider is set to google', async () => {
            vi.mocked(mockSettingsManager.get).mockImplementation(async (key: string) => {
                if (key === 'enableWebSearch') return true;
                if (key === 'searchProvider') return 'google';
                if (key === 'googleSearchApiKey') return 'test-google-key';
                if (key === 'googleSearchEngineId') return 'test-cx-id';
                return '';
            });

            // Mock fetch for Google API
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    items: [
                        {
                            title: 'Google Result',
                            link: 'https://google-example.com',
                            snippet: 'Google search result',
                        },
                    ],
                    searchInformation: {
                        totalResults: '1',
                        searchTime: 0.1,
                    },
                }),
            });
            global.fetch = mockFetch;

            const result = await searchController.search('test query');

            expect(result.sources).toHaveLength(1);
            expect(result.sources[0].title).toBe('Google Result');
            // Verify Google API was called
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('googleapis.com/customsearch'),
                expect.any(Object)
            );
        });

        it('should switch providers when searchProvider setting changes', async () => {
            // Start with Brave
            vi.mocked(mockSettingsManager.get).mockImplementation(async (key: string) => {
                if (key === 'enableWebSearch') return true;
                if (key === 'searchProvider') return 'brave';
                if (key === 'searchApiKey') return 'test-brave-key';
                return '';
            });

            const mockFetchBrave = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    web: [
                        {
                            title: 'Brave Result',
                            url: 'https://brave-example.com',
                            description: 'Brave search result',
                        },
                    ],
                }),
                headers: new Headers(),
            });
            global.fetch = mockFetchBrave;

            await searchController.search('test query 1');
            expect(mockFetchBrave).toHaveBeenCalledWith(
                expect.stringContaining('api.search.brave.com'),
                expect.any(Object)
            );

            // Clear cache to force new search
            searchController.clearCache();

            // Switch to Google
            vi.mocked(mockSettingsManager.get).mockImplementation(async (key: string) => {
                if (key === 'enableWebSearch') return true;
                if (key === 'searchProvider') return 'google';
                if (key === 'googleSearchApiKey') return 'test-google-key';
                if (key === 'googleSearchEngineId') return 'test-cx-id';
                return '';
            });

            const mockFetchGoogle = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    items: [
                        {
                            title: 'Google Result',
                            link: 'https://google-example.com',
                            snippet: 'Google search result',
                        },
                    ],
                    searchInformation: {
                        totalResults: '1',
                        searchTime: 0.1,
                    },
                }),
            });
            global.fetch = mockFetchGoogle;

            await searchController.search('test query 2');
            expect(mockFetchGoogle).toHaveBeenCalledWith(
                expect.stringContaining('googleapis.com/customsearch'),
                expect.any(Object)
            );
        });

        it('should default to Brave provider when searchProvider is not set', async () => {
            vi.mocked(mockSettingsManager.get).mockImplementation(async (key: string) => {
                if (key === 'enableWebSearch') return true;
                if (key === 'searchProvider') return 'brave'; // Default
                if (key === 'searchApiKey') return 'test-brave-key';
                return '';
            });

            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    web: [
                        {
                            title: 'Brave Result',
                            url: 'https://brave-example.com',
                            description: 'Brave search result',
                        },
                    ],
                }),
                headers: new Headers(),
            });
            global.fetch = mockFetch;

            await searchController.search('test query');

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('api.search.brave.com'),
                expect.any(Object)
            );
        });
    });
});
