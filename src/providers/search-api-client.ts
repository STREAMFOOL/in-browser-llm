/**
 * Search API Client Interface and Types
 * Provides a unified interface for different search API providers
 */

export interface SearchOptions {
    maxResults?: number;
    language?: string;
    safeSearch?: boolean;
    freshness?: 'day' | 'week' | 'month' | 'year';
}

export interface SearchResult {
    title: string;
    url: string;
    snippet: string;
    publishedDate?: string;
    relevanceScore: number;
}

export interface SearchResponse {
    results: SearchResult[];
    totalResults: number;
    searchTime: number;
}

export interface APIUsageStats {
    requestsToday: number;
    quotaLimit: number;
    quotaRemaining: number;
}

export interface SearchAPIClient {
    /**
     * Execute a search query
     */
    search(query: string, options?: SearchOptions): Promise<SearchResponse>;

    /**
     * Check if API is configured and available
     */
    isAvailable(): Promise<boolean>;

    /**
     * Get API usage statistics
     */
    getUsageStats(): APIUsageStats;
}
