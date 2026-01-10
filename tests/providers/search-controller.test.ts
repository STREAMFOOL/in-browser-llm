import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SearchController } from '../../src/providers/search-controller';
import type { SearchAPIClient, SearchResult } from '../../src/providers/search-api-client';
import { SnippetExtractor } from '../../src/providers/snippet-extractor';
import { CitationFormatter } from '../../src/providers/citation-formatter';
import { SettingsManager } from '../../src/storage/settings-manager';

describe('SearchController', () => {
    let searchController: SearchController;
    let mockSearchClient: SearchAPIClient;
    let mockSettingsManager: SettingsManager;
    let snippetExtractor: SnippetExtractor;
    let citationFormatter: CitationFormatter;

    beforeEach(() => {
        // Create mock search client
        mockSearchClient = {
            search: vi.fn(),
            isAvailable: vi.fn(),
            getUsageStats: vi.fn(),
        };

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
            mockSearchClient,
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

        it('should return search results when search is enabled', async () => {
            vi.mocked(mockSettingsManager.get).mockResolvedValue(true);

            const mockResults: SearchResult[] = [
                {
                    title: 'Test Result',
                    url: 'https://example.com',
                    snippet: 'This is a test snippet',
                    relevanceScore: 0.9,
                },
            ];

            vi.mocked(mockSearchClient.search).mockResolvedValue({
                results: mockResults,
                totalResults: 1,
                searchTime: 100,
            });

            const result = await searchController.search('test query');

            expect(result.sources).toHaveLength(1);
            expect(result.sources[0].title).toBe('Test Result');
            expect(result.contextText).toContain('Web Search Results');
        });

        it('should cache search results', async () => {
            vi.mocked(mockSettingsManager.get).mockResolvedValue(true);

            const mockResults: SearchResult[] = [
                {
                    title: 'Test Result',
                    url: 'https://example.com',
                    snippet: 'This is a test snippet',
                    relevanceScore: 0.9,
                },
            ];

            vi.mocked(mockSearchClient.search).mockResolvedValue({
                results: mockResults,
                totalResults: 1,
                searchTime: 100,
            });

            // First search
            await searchController.search('test query');
            expect(mockSearchClient.search).toHaveBeenCalledTimes(1);

            // Second search with same query should use cache
            await searchController.search('test query');
            expect(mockSearchClient.search).toHaveBeenCalledTimes(1); // Still 1, not 2
        });

        it('should handle search errors gracefully', async () => {
            vi.mocked(mockSettingsManager.get).mockResolvedValue(true);
            vi.mocked(mockSearchClient.search).mockRejectedValue(
                new Error('API key is not configured')
            );

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
            vi.mocked(mockSettingsManager.get).mockResolvedValue(true);

            const mockResults: SearchResult[] = [
                {
                    title: 'Test Result',
                    url: 'https://example.com',
                    snippet: 'This is a test snippet',
                    relevanceScore: 0.9,
                },
            ];

            vi.mocked(mockSearchClient.search).mockResolvedValue({
                results: mockResults,
                totalResults: 1,
                searchTime: 100,
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
});
