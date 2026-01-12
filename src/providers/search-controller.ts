/**
 * Search Controller
 * Orchestrates web search operations and integrates results into the conversation flow
 */

import type { SearchAPIClient, SearchResult } from './search-api-client';
import { BraveSearchClient } from './brave-search-client';
import { GoogleSearchClient } from './google-search-client';
import { SnippetExtractor } from './snippet-extractor';
import type { ExtractedSnippet } from './snippet-extractor';
import { CitationFormatter } from './citation-formatter';
import { SettingsManager } from '../storage/settings-manager';

export interface SearchContext {
    snippets: ExtractedSnippet[];
    sources: SearchResult[];
    contextText: string;
}

export interface SearchError {
    type:
    | 'api_key_missing'
    | 'rate_limit'
    | 'network'
    | 'invalid_response'
    | 'quota_exhausted';
    message: string;
    userMessage: string;
    recoverable: boolean;
}

interface CacheEntry {
    query: string;
    results: SearchResult[];
    timestamp: number;
    expiresAt: number;
}

export class SearchController {
    private searchClient: SearchAPIClient | null = null;
    private snippetExtractor: SnippetExtractor;
    private citationFormatter: CitationFormatter;
    private settingsManager: SettingsManager;
    private cache: Map<string, CacheEntry> = new Map();
    private readonly CACHE_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes
    private readonly MAX_CACHED_QUERIES = 10;
    private readonly SEARCH_TIMEOUT_MS = 5000; // 5 seconds

    constructor(
        snippetExtractor: SnippetExtractor,
        citationFormatter: CitationFormatter,
        settingsManager: SettingsManager
    ) {
        this.snippetExtractor = snippetExtractor;
        this.citationFormatter = citationFormatter;
        this.settingsManager = settingsManager;
    }

    /**
     * Get the appropriate search client based on provider preference
     */
    private async getSearchClient(): Promise<SearchAPIClient> {
        const provider = await this.settingsManager.get('searchProvider', 'brave');

        // Return cached client if provider hasn't changed
        if (this.searchClient) {
            // Check if current client matches the provider
            const isBrave = this.searchClient instanceof BraveSearchClient;
            const isGoogle = this.searchClient instanceof GoogleSearchClient;

            if ((provider === 'brave' && isBrave) || (provider === 'google' && isGoogle)) {
                return this.searchClient;
            }
        }

        // Create new client based on provider
        if (provider === 'google') {
            this.searchClient = new GoogleSearchClient(this.settingsManager);
        } else {
            // Default to Brave
            this.searchClient = new BraveSearchClient(this.settingsManager);
        }

        return this.searchClient;
    }

    /**
     * Check if search is enabled
     */
    async isSearchEnabled(): Promise<boolean> {
        return this.settingsManager.get('enableWebSearch', false);
    }

    /**
     * Enable or disable search
     */
    async setSearchEnabled(enabled: boolean): Promise<void> {
        await this.settingsManager.set('enableWebSearch', enabled);
    }

    /**
     * Determine if a query should trigger search based on heuristics
     */
    shouldSearch(query: string): boolean {
        if (!query || query.trim().length === 0) {
            return false;
        }

        // Keywords that suggest need for current information
        const currentInfoKeywords = [
            'latest',
            'recent',
            'today',
            'now',
            'current',
            'news',
            'today',
            'this week',
            'this month',
            'this year',
            'when',
            'what is',
            'how to',
            'where',
            'who is',
            'what happened',
            'breaking',
            'update',
            'status',
            'price',
            'weather',
            'stock',
            'score',
            'result',
        ];

        const queryLower = query.toLowerCase();

        // Check for current info keywords
        for (const keyword of currentInfoKeywords) {
            if (queryLower.includes(keyword)) {
                return true;
            }
        }

        // Check for question marks (questions are more likely to need current info)
        if (query.includes('?')) {
            return true;
        }

        return false;
    }

    /**
     * Execute search and return formatted context
     */
    async search(query: string): Promise<SearchContext> {
        // Check if search is enabled
        const enabled = await this.isSearchEnabled();
        if (!enabled) {
            return {
                snippets: [],
                sources: [],
                contextText: '',
            };
        }

        // Check cache first
        const cached = this.getFromCache(query);
        if (cached) {
            return this.formatSearchContext(cached);
        }

        try {
            // Execute search with timeout
            const results = await this.executeSearchWithTimeout(query);

            // Cache results
            this.addToCache(query, results);

            return this.formatSearchContext(results);
        } catch (error) {
            const searchError = this.handleSearchError(error);
            console.error('Search error:', searchError);

            // Return empty context on error - fallback to model's built-in knowledge
            return {
                snippets: [],
                sources: [],
                contextText: '',
            };
        }
    }

    /**
     * Format citations for a response
     */
    formatCitations(sources: SearchResult[]): string {
        return this.citationFormatter.formatCitations(sources);
    }

    /**
     * Format search context for injection into model prompt
     * Ensures context fits within token limits and adds clear markers
     */
    formatContextForPrompt(contextText: string, maxTokens: number = 500): string {
        if (!contextText || contextText.trim().length === 0) {
            return '';
        }

        // Rough estimate: 1 token ≈ 4 characters
        const maxChars = maxTokens * 4;
        let formattedContext = contextText;

        // Truncate if necessary
        if (formattedContext.length > maxChars) {
            formattedContext = formattedContext.substring(0, maxChars).trim();
            // Add ellipsis if truncated
            if (!formattedContext.endsWith('\n')) {
                formattedContext += '\n...';
            }
        }

        // Add clear markers for search context
        return `\n\n---\n**Web Search Context:**\n${formattedContext}\n---\n`;
    }

    /**
     * Execute search with timeout protection
     */
    private async executeSearchWithTimeout(query: string): Promise<SearchResult[]> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.SEARCH_TIMEOUT_MS);

        try {
            const searchClient = await this.getSearchClient();
            const response = await Promise.race([
                searchClient.search(query, { maxResults: 5 }),
                new Promise<never>((_, reject) =>
                    controller.signal.addEventListener('abort', () =>
                        reject(new Error('Search timeout'))
                    )
                ),
            ]);

            return response.results;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Format search results into context for model prompt
     */
    private formatSearchContext(results: SearchResult[]): SearchContext {
        const snippets = this.snippetExtractor.extractSnippets(results, '');

        // Format snippets for model context
        const contextLines = snippets.map(
            (snippet, index) =>
                `[${index + 1}] ${snippet.text} (Source: ${this.citationFormatter.extractDomain(snippet.source.url)})`
        );

        const contextText =
            contextLines.length > 0
                ? `\n\nWeb Search Results:\n${contextLines.join('\n\n')}\n`
                : '';

        return {
            snippets,
            sources: snippets.map((s) => s.source),
            contextText,
        };
    }

    /**
     * Get search results from cache if available and not expired
     */
    private getFromCache(query: string): SearchResult[] | null {
        const normalized = this.normalizeQuery(query);
        const entry = this.cache.get(normalized);

        if (!entry) {
            return null;
        }

        // Check if cache entry has expired
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(normalized);
            return null;
        }

        return entry.results;
    }

    /**
     * Add search results to cache with LRU eviction
     */
    private addToCache(query: string, results: SearchResult[]): void {
        const normalized = this.normalizeQuery(query);

        // Evict oldest entry if cache is full
        if (this.cache.size >= this.MAX_CACHED_QUERIES) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) {
                this.cache.delete(oldestKey);
            }
        }

        const entry: CacheEntry = {
            query,
            results,
            timestamp: Date.now(),
            expiresAt: Date.now() + this.CACHE_EXPIRATION_MS,
        };

        this.cache.set(normalized, entry);
    }

    /**
     * Normalize query for cache key comparison
     */
    private normalizeQuery(query: string): string {
        return query.toLowerCase().trim();
    }

    /**
     * Handle search errors and return user-friendly messages
     */
    private handleSearchError(error: unknown): SearchError {
        if (error instanceof Error) {
            const message = error.message.toLowerCase();

            if (message.includes('api key') || message.includes('not configured')) {
                return {
                    type: 'api_key_missing',
                    message: error.message,
                    userMessage: 'Web search requires an API key. Configure it in settings.',
                    recoverable: true,
                };
            }

            if (message.includes('rate limit') || message.includes('429')) {
                return {
                    type: 'rate_limit',
                    message: error.message,
                    userMessage:
                        'Search temporarily unavailable. Using model\'s built-in knowledge.',
                    recoverable: true,
                };
            }

            if (message.includes('timeout') || message.includes('network')) {
                return {
                    type: 'network',
                    message: error.message,
                    userMessage:
                        'Couldn\'t reach search service. Using model\'s built-in knowledge.',
                    recoverable: true,
                };
            }

            if (message.includes('quota') || message.includes('403')) {
                return {
                    type: 'quota_exhausted',
                    message: error.message,
                    userMessage:
                        'Search quota exceeded. Web search disabled until quota resets.',
                    recoverable: false,
                };
            }

            if (message.includes('invalid') || message.includes('parse')) {
                return {
                    type: 'invalid_response',
                    message: error.message,
                    userMessage:
                        'Invalid search response. Using model\'s built-in knowledge.',
                    recoverable: true,
                };
            }

            return {
                type: 'invalid_response',
                message: error.message,
                userMessage:
                    'Search error occurred. Using model\'s built-in knowledge.',
                recoverable: true,
            };
        }

        return {
            type: 'invalid_response',
            message: 'Unknown error',
            userMessage: 'Search error occurred. Using model\'s built-in knowledge.',
            recoverable: true,
        };
    }

    /**
     * Clear the search cache (useful for testing or manual refresh)
     */
    clearCache(): void {
        this.cache.clear();
    }

    /**
     * Get cache statistics for debugging
     */
    getCacheStats(): { size: number; maxSize: number } {
        return {
            size: this.cache.size,
            maxSize: this.MAX_CACHED_QUERIES,
        };
    }
}
