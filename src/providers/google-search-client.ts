/**
 * Google Custom Search API Client Implementation
 * Concrete implementation of SearchAPIClient for Google Custom Search API
 */

import type {
    SearchAPIClient,
    SearchOptions,
    SearchResponse,
    SearchResult,
    APIUsageStats,
} from './search-api-client';
import type { SettingsManager } from '../storage/settings-manager';

interface GoogleSearchAPIResponse {
    items?: Array<{
        title: string;
        link: string;
        snippet: string;
        displayLink?: string;
    }>;
    searchInformation?: {
        totalResults: string;
        searchTime: number;
    };
}

export class GoogleSearchClient implements SearchAPIClient {
    private settingsManager: SettingsManager;
    private baseURL = 'https://www.googleapis.com/customsearch/v1';
    private usageStats: APIUsageStats = {
        requestsToday: 0,
        quotaLimit: 100,
        quotaRemaining: 100,
    };

    constructor(settingsManager: SettingsManager) {
        this.settingsManager = settingsManager;
    }

    private async getApiKey(): Promise<string> {
        return await this.settingsManager.get('googleSearchApiKey', '');
    }

    private async getSearchEngineId(): Promise<string> {
        return await this.settingsManager.get('googleSearchEngineId', '');
    }

    async search(query: string, options?: SearchOptions): Promise<SearchResponse> {
        const apiKey = await this.getApiKey();
        const searchEngineId = await this.getSearchEngineId();

        if (!apiKey) {
            throw new Error('Google Search API key is not configured');
        }

        if (!searchEngineId) {
            throw new Error('Google Search Engine ID (cx) is not configured');
        }

        const params = new URLSearchParams();
        params.append('key', apiKey);
        params.append('cx', searchEngineId);
        params.append('q', query);
        params.append('num', String(options?.maxResults ?? 5));

        if (options?.language) {
            params.append('lr', `lang_${options.language}`);
        }

        if (options?.safeSearch !== undefined) {
            params.append('safe', options.safeSearch ? 'active' : 'off');
        }

        if (options?.freshness) {
            const dateRestrict = this.convertFreshnessToDateRestrict(options.freshness);
            if (dateRestrict) {
                params.append('dateRestrict', dateRestrict);
            }
        }

        const startTime = performance.now();

        try {
            const response = await fetch(`${this.baseURL}?${params.toString()}`, {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                },
            });

            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error('Rate limit exceeded');
                }
                if (response.status === 403) {
                    throw new Error('API quota exhausted or invalid credentials');
                }
                if (response.status === 400) {
                    throw new Error('Invalid request parameters');
                }
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }

            const data: GoogleSearchAPIResponse = await response.json();
            const searchTime = performance.now() - startTime;

            const results: SearchResult[] = (data.items ?? []).map((item, index) => ({
                title: item.title,
                url: item.link,
                snippet: item.snippet,
                publishedDate: undefined,
                relevanceScore: 1 - index * 0.1,
            }));

            return {
                results,
                totalResults: data.searchInformation
                    ? parseInt(data.searchInformation.totalResults, 10)
                    : results.length,
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
        const apiKey = await this.getApiKey();
        const searchEngineId = await this.getSearchEngineId();

        if (!apiKey || !searchEngineId) {
            return false;
        }

        try {
            const params = new URLSearchParams();
            params.append('key', apiKey);
            params.append('cx', searchEngineId);
            params.append('q', 'test');
            params.append('num', '1');

            const response = await fetch(`${this.baseURL}?${params.toString()}`, {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                },
            });

            return response.ok || response.status === 429;
        } catch {
            return false;
        }
    }

    getUsageStats(): APIUsageStats {
        return { ...this.usageStats };
    }

    private convertFreshnessToDateRestrict(
        freshness: 'day' | 'week' | 'month' | 'year'
    ): string {
        const freshnessMap: Record<string, string> = {
            day: 'd1',
            week: 'w1',
            month: 'm1',
            year: 'y1',
        };
        return freshnessMap[freshness] || '';
    }
}
