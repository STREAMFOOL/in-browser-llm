/**
 * Brave Search API Client Implementation
 * Concrete implementation of SearchAPIClient for Brave Search API
 */

import {
    SearchAPIClient,
    SearchOptions,
    SearchResponse,
    SearchResult,
    APIUsageStats,
} from './search-api-client';

interface BraveSearchAPIResponse {
    web?: Array<{
        title: string;
        url: string;
        description: string;
        page_age?: string;
    }>;
}

export class BraveSearchClient implements SearchAPIClient {
    private apiKey: string;
    private baseURL = 'https://api.search.brave.com/res/v1/web/search';
    private usageStats: APIUsageStats = {
        requestsToday: 0,
        quotaLimit: 0,
        quotaRemaining: 0,
    };

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async search(query: string, options?: SearchOptions): Promise<SearchResponse> {
        if (!this.apiKey) {
            throw new Error('Brave Search API key is not configured');
        }

        const params = new URLSearchParams();
        params.append('q', query);
        params.append('count', String(options?.maxResults ?? 5));

        if (options?.language) {
            params.append('lang', options.language);
        }

        if (options?.safeSearch !== undefined) {
            params.append('safesearch', options.safeSearch ? 'on' : 'off');
        }

        if (options?.freshness) {
            params.append('freshness', options.freshness);
        }

        const startTime = performance.now();

        try {
            const response = await fetch(`${this.baseURL}?${params.toString()}`, {
                method: 'GET',
                headers: {
                    'X-Subscription-Token': this.apiKey,
                    Accept: 'application/json',
                },
            });

            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error('Rate limit exceeded');
                }
                if (response.status === 403) {
                    throw new Error('API quota exhausted or invalid key');
                }
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }

            const data: BraveSearchAPIResponse = await response.json();
            const searchTime = performance.now() - startTime;

            // Update usage stats from response headers if available
            const remaining = response.headers.get('X-Remaining-Requests');
            if (remaining) {
                this.usageStats.quotaRemaining = parseInt(remaining, 10);
            }

            const results: SearchResult[] = (data.web ?? []).map((item, index) => ({
                title: item.title,
                url: item.url,
                snippet: item.description,
                publishedDate: item.page_age,
                relevanceScore: 1 - index * 0.1, // Higher score for earlier results
            }));

            return {
                results,
                totalResults: results.length,
                searchTime,
            };
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Unknown error during search');
        }
    }

    async isAvailable(): Promise<boolean> {
        if (!this.apiKey) {
            return false;
        }

        try {
            const response = await fetch(
                `${this.baseURL}?q=test&count=1`,
                {
                    method: 'GET',
                    headers: {
                        'X-Subscription-Token': this.apiKey,
                        Accept: 'application/json',
                    },
                }
            );

            return response.ok || response.status === 429; // 429 means API is reachable but rate limited
        } catch {
            return false;
        }
    }

    getUsageStats(): APIUsageStats {
        return { ...this.usageStats };
    }
}
