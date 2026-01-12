import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BraveSearchClient } from '../../src/providers/brave-search-client';
import type { SettingsManager } from '../../src/storage/settings-manager';

describe('BraveSearchClient', () => {
    let client: BraveSearchClient;
    let mockSettingsManager: SettingsManager;
    const testApiKey = 'test-api-key-123';

    beforeEach(() => {
        // Mock SettingsManager
        mockSettingsManager = {
            get: vi.fn().mockResolvedValue(testApiKey),
        } as any;

        client = new BraveSearchClient(mockSettingsManager);
        vi.clearAllMocks();
    });

    describe('search()', () => {
        it('should format request with query parameters correctly', async () => {
            const mockResponse = {
                web: [
                    {
                        title: 'Test Result',
                        url: 'https://example.com',
                        description: 'Test snippet',
                    },
                ],
            };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
                headers: new Map(),
            });

            const result = await client.search('test query', { maxResults: 3 });

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('q=test+query'),
                expect.any(Object)
            );
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('count=3'),
                expect.any(Object)
            );
        });

        it('should include API key in X-Subscription-Token header', async () => {
            const mockResponse = { web: [] };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
                headers: new Map(),
            });

            await client.search('test');

            const callArgs = (global.fetch as any).mock.calls[0];
            expect(callArgs[1].headers['X-Subscription-Token']).toBe(testApiKey);
        });

        it('should parse and transform API responses correctly', async () => {
            const mockResponse = {
                web: [
                    {
                        title: 'Result 1',
                        url: 'https://example1.com',
                        description: 'Snippet 1',
                        page_age: '2024-01-15',
                    },
                    {
                        title: 'Result 2',
                        url: 'https://example2.com',
                        description: 'Snippet 2',
                    },
                ],
            };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
                headers: new Map(),
            });

            const result = await client.search('test');

            expect(result.results).toHaveLength(2);
            expect(result.results[0]).toEqual({
                title: 'Result 1',
                url: 'https://example1.com',
                snippet: 'Snippet 1',
                publishedDate: '2024-01-15',
                relevanceScore: expect.any(Number),
            });
            expect(result.results[1]).toEqual({
                title: 'Result 2',
                url: 'https://example2.com',
                snippet: 'Snippet 2',
                publishedDate: undefined,
                relevanceScore: expect.any(Number),
            });
        });

        it('should handle rate limiting error (HTTP 429)', async () => {
            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: false,
                status: 429,
                statusText: 'Too Many Requests',
            });

            await expect(client.search('test')).rejects.toThrow('Rate limit exceeded');
        });

        it('should handle quota exhausted error (HTTP 403)', async () => {
            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: false,
                status: 403,
                statusText: 'Forbidden',
            });

            await expect(client.search('test')).rejects.toThrow(
                'API quota exhausted or invalid key'
            );
        });

        it('should handle generic API errors', async () => {
            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
            });

            await expect(client.search('test')).rejects.toThrow('API error: 500');
        });

        it('should throw error when API key is missing', async () => {
            const mockSettingsManagerNoKey = {
                get: vi.fn().mockResolvedValue(''),
            } as any;
            const clientNoKey = new BraveSearchClient(mockSettingsManagerNoKey);

            await expect(clientNoKey.search('test')).rejects.toThrow(
                'Brave Search API key is not configured'
            );
        });

        it('should apply search options correctly', async () => {
            const mockResponse = { web: [] };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
                headers: new Map(),
            });

            await client.search('test', {
                maxResults: 10,
                language: 'en',
                safeSearch: true,
                freshness: 'week',
            });

            const url = (global.fetch as any).mock.calls[0][0];
            expect(url).toContain('count=10');
            expect(url).toContain('lang=en');
            expect(url).toContain('safesearch=on');
            expect(url).toContain('freshness=week');
        });

        it('should calculate search time', async () => {
            const mockResponse = { web: [] };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
                headers: new Map(),
            });

            const result = await client.search('test');

            expect(result.searchTime).toBeGreaterThanOrEqual(0);
            expect(typeof result.searchTime).toBe('number');
        });
    });

    describe('isAvailable()', () => {
        it('should return false when API key is not configured', async () => {
            const mockSettingsManagerNoKey = {
                get: vi.fn().mockResolvedValue(''),
            } as any;
            const clientNoKey = new BraveSearchClient(mockSettingsManagerNoKey);

            const available = await clientNoKey.isAvailable();

            expect(available).toBe(false);
        });

        it('should return true when API responds successfully', async () => {
            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                status: 200,
            });

            const available = await client.isAvailable();

            expect(available).toBe(true);
        });

        it('should return true when rate limited (API is reachable)', async () => {
            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: false,
                status: 429,
            });

            const available = await client.isAvailable();

            expect(available).toBe(true);
        });

        it('should return false on network error', async () => {
            global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

            const available = await client.isAvailable();

            expect(available).toBe(false);
        });
    });

    describe('getUsageStats()', () => {
        it('should return usage stats object', () => {
            const stats = client.getUsageStats();

            expect(stats).toEqual({
                requestsToday: 0,
                quotaLimit: 0,
                quotaRemaining: 0,
            });
        });

        it('should return a copy of stats (not reference)', () => {
            const stats1 = client.getUsageStats();
            const stats2 = client.getUsageStats();

            expect(stats1).toEqual(stats2);
            expect(stats1).not.toBe(stats2);
        });
    });
});
