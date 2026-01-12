import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GoogleSearchClient } from '../../src/providers/google-search-client';
import type { SettingsManager } from '../../src/storage/settings-manager';

describe('GoogleSearchClient', () => {
    let client: GoogleSearchClient;
    let mockSettingsManager: SettingsManager;
    const testApiKey = 'test-google-api-key-123';
    const testSearchEngineId = 'test-cx-id-456';

    beforeEach(() => {
        // Mock SettingsManager
        mockSettingsManager = {
            get: vi.fn((key: string) => {
                if (key === 'googleSearchApiKey') {
                    return Promise.resolve(testApiKey);
                }
                if (key === 'googleSearchEngineId') {
                    return Promise.resolve(testSearchEngineId);
                }
                return Promise.resolve('');
            }),
        } as any;

        client = new GoogleSearchClient(mockSettingsManager);
        vi.clearAllMocks();
    });

    describe('search()', () => {
        it('should format request with key and cx parameters correctly', async () => {
            const mockResponse = {
                items: [
                    {
                        title: 'Test Result',
                        link: 'https://example.com',
                        snippet: 'Test snippet',
                    },
                ],
            };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            await client.search('test query', { maxResults: 3 });

            const callUrl = (global.fetch as any).mock.calls[0][0];
            expect(callUrl).toContain('key=test-google-api-key-123');
            expect(callUrl).toContain('cx=test-cx-id-456');
            expect(callUrl).toContain('q=test+query');
            expect(callUrl).toContain('num=3');
        });

        it('should parse Google Custom Search JSON responses correctly', async () => {
            const mockResponse = {
                items: [
                    {
                        title: 'Result 1',
                        link: 'https://example1.com',
                        snippet: 'Snippet 1',
                        displayLink: 'example1.com',
                    },
                    {
                        title: 'Result 2',
                        link: 'https://example2.com',
                        snippet: 'Snippet 2',
                    },
                ],
                searchInformation: {
                    totalResults: '1000',
                    searchTime: 0.5,
                },
            };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const result = await client.search('test');

            expect(result.results).toHaveLength(2);
            expect(result.results[0]).toEqual({
                title: 'Result 1',
                url: 'https://example1.com',
                snippet: 'Snippet 1',
                publishedDate: undefined,
                relevanceScore: expect.any(Number),
            });
            expect(result.results[1]).toEqual({
                title: 'Result 2',
                url: 'https://example2.com',
                snippet: 'Snippet 2',
                publishedDate: undefined,
                relevanceScore: expect.any(Number),
            });
            expect(result.totalResults).toBe(1000);
        });

        it('should transform to common SearchResponse format', async () => {
            const mockResponse = {
                items: [
                    {
                        title: 'Test',
                        link: 'https://test.com',
                        snippet: 'Test snippet',
                    },
                ],
            };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const result = await client.search('test');

            expect(result).toHaveProperty('results');
            expect(result).toHaveProperty('totalResults');
            expect(result).toHaveProperty('searchTime');
            expect(Array.isArray(result.results)).toBe(true);
            expect(typeof result.totalResults).toBe('number');
            expect(typeof result.searchTime).toBe('number');
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
                'API quota exhausted or invalid credentials'
            );
        });

        it('should handle invalid request parameters (HTTP 400)', async () => {
            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: false,
                status: 400,
                statusText: 'Bad Request',
            });

            await expect(client.search('test')).rejects.toThrow(
                'Invalid request parameters'
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
                get: vi.fn((key: string) => {
                    if (key === 'googleSearchApiKey') {
                        return Promise.resolve('');
                    }
                    if (key === 'googleSearchEngineId') {
                        return Promise.resolve(testSearchEngineId);
                    }
                    return Promise.resolve('');
                }),
            } as any;
            const clientNoKey = new GoogleSearchClient(mockSettingsManagerNoKey);

            await expect(clientNoKey.search('test')).rejects.toThrow(
                'Google Search API key is not configured'
            );
        });

        it('should throw error when Search Engine ID is missing', async () => {
            const mockSettingsManagerNoCx = {
                get: vi.fn((key: string) => {
                    if (key === 'googleSearchApiKey') {
                        return Promise.resolve(testApiKey);
                    }
                    if (key === 'googleSearchEngineId') {
                        return Promise.resolve('');
                    }
                    return Promise.resolve('');
                }),
            } as any;
            const clientNoCx = new GoogleSearchClient(mockSettingsManagerNoCx);

            await expect(clientNoCx.search('test')).rejects.toThrow(
                'Google Search Engine ID (cx) is not configured'
            );
        });

        it('should apply search options correctly', async () => {
            const mockResponse = { items: [] };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            await client.search('test', {
                maxResults: 10,
                language: 'en',
                safeSearch: true,
                freshness: 'week',
            });

            const url = (global.fetch as any).mock.calls[0][0];
            expect(url).toContain('num=10');
            expect(url).toContain('lr=lang_en');
            expect(url).toContain('safe=active');
            expect(url).toContain('dateRestrict=w1');
        });

        it('should convert freshness options to dateRestrict format', async () => {
            const mockResponse = { items: [] };

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => mockResponse,
            });

            await client.search('test', { freshness: 'day' });
            expect((global.fetch as any).mock.calls[0][0]).toContain('dateRestrict=d1');

            await client.search('test', { freshness: 'week' });
            expect((global.fetch as any).mock.calls[1][0]).toContain('dateRestrict=w1');

            await client.search('test', { freshness: 'month' });
            expect((global.fetch as any).mock.calls[2][0]).toContain('dateRestrict=m1');

            await client.search('test', { freshness: 'year' });
            expect((global.fetch as any).mock.calls[3][0]).toContain('dateRestrict=y1');
        });

        it('should handle safeSearch false option', async () => {
            const mockResponse = { items: [] };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            await client.search('test', { safeSearch: false });

            const url = (global.fetch as any).mock.calls[0][0];
            expect(url).toContain('safe=off');
        });

        it('should calculate search time', async () => {
            const mockResponse = { items: [] };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const result = await client.search('test');

            expect(result.searchTime).toBeGreaterThanOrEqual(0);
            expect(typeof result.searchTime).toBe('number');
        });

        it('should handle empty results', async () => {
            const mockResponse = {
                searchInformation: {
                    totalResults: '0',
                    searchTime: 0.1,
                },
            };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const result = await client.search('test');

            expect(result.results).toHaveLength(0);
            expect(result.totalResults).toBe(0);
        });

        it('should handle response without searchInformation', async () => {
            const mockResponse = {
                items: [
                    {
                        title: 'Test',
                        link: 'https://test.com',
                        snippet: 'Test snippet',
                    },
                ],
            };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const result = await client.search('test');

            expect(result.totalResults).toBe(1);
        });
    });

    describe('isAvailable()', () => {
        it('should return false when API key is not configured', async () => {
            const mockSettingsManagerNoKey = {
                get: vi.fn((key: string) => {
                    if (key === 'googleSearchApiKey') {
                        return Promise.resolve('');
                    }
                    if (key === 'googleSearchEngineId') {
                        return Promise.resolve(testSearchEngineId);
                    }
                    return Promise.resolve('');
                }),
            } as any;
            const clientNoKey = new GoogleSearchClient(mockSettingsManagerNoKey);

            const available = await clientNoKey.isAvailable();

            expect(available).toBe(false);
        });

        it('should return false when Search Engine ID is not configured', async () => {
            const mockSettingsManagerNoCx = {
                get: vi.fn((key: string) => {
                    if (key === 'googleSearchApiKey') {
                        return Promise.resolve(testApiKey);
                    }
                    if (key === 'googleSearchEngineId') {
                        return Promise.resolve('');
                    }
                    return Promise.resolve('');
                }),
            } as any;
            const clientNoCx = new GoogleSearchClient(mockSettingsManagerNoCx);

            const available = await clientNoCx.isAvailable();

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
                quotaLimit: 100,
                quotaRemaining: 100,
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
