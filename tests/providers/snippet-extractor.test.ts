import { describe, it, expect, beforeEach } from 'vitest';
import { SnippetExtractor } from '../../src/providers/snippet-extractor';
import { type SearchResult } from '../../src/providers/search-api-client';

describe('SnippetExtractor', () => {
    let extractor: SnippetExtractor;

    beforeEach(() => {
        extractor = new SnippetExtractor(300, 2000);
    });

    describe('extractSnippets()', () => {
        it('should return empty array for empty results', () => {
            const snippets = extractor.extractSnippets([], 'test query');
            expect(snippets).toEqual([]);
        });

        it('should extract snippets from search results', () => {
            const results: SearchResult[] = [
                {
                    title: 'Result 1',
                    url: 'https://example1.com',
                    snippet: 'This is a test snippet about WebGPU.',
                    relevanceScore: 0.9,
                },
                {
                    title: 'Result 2',
                    url: 'https://example2.com',
                    snippet: 'Another snippet about WebGPU performance.',
                    relevanceScore: 0.8,
                },
            ];

            const snippets = extractor.extractSnippets(results, 'WebGPU');

            expect(snippets).toHaveLength(2);
            expect(snippets[0].text).toBe('This is a test snippet about WebGPU.');
            expect(snippets[1].text).toBe('Another snippet about WebGPU performance.');
        });

        it('should sort snippets by relevance score', () => {
            const results: SearchResult[] = [
                {
                    title: 'Result 1',
                    url: 'https://example1.com',
                    snippet: 'Low relevance snippet.',
                    relevanceScore: 0.5,
                },
                {
                    title: 'Result 2',
                    url: 'https://example2.com',
                    snippet: 'WebGPU WebGPU WebGPU high relevance.',
                    relevanceScore: 0.9,
                },
            ];

            const snippets = extractor.extractSnippets(results, 'WebGPU');

            expect(snippets[0].text).toContain('WebGPU WebGPU WebGPU');
            expect(snippets[0].relevanceScore).toBeGreaterThan(snippets[1].relevanceScore);
        });

        it('should clean HTML tags from snippets', () => {
            const results: SearchResult[] = [
                {
                    title: 'Result',
                    url: 'https://example.com',
                    snippet: '<p>This is <b>bold</b> text with <em>emphasis</em>.</p>',
                    relevanceScore: 0.9,
                },
            ];

            const snippets = extractor.extractSnippets(results, 'test');

            expect(snippets[0].text).toBe('This is bold text with emphasis.');
            expect(snippets[0].text).not.toContain('<');
            expect(snippets[0].text).not.toContain('>');
        });

        it('should decode HTML entities', () => {
            const results: SearchResult[] = [
                {
                    title: 'Result',
                    url: 'https://example.com',
                    snippet: 'This &amp; that &quot;quoted&quot; text.',
                    relevanceScore: 0.9,
                },
            ];

            const snippets = extractor.extractSnippets(results, 'test');

            expect(snippets[0].text).toBe('This & that "quoted" text.');
        });

        it('should deduplicate similar snippets', () => {
            const results: SearchResult[] = [
                {
                    title: 'Result 1',
                    url: 'https://example1.com',
                    snippet: 'This is a test snippet.',
                    relevanceScore: 0.9,
                },
                {
                    title: 'Result 2',
                    url: 'https://example2.com',
                    snippet: 'This is a test snippet.',
                    relevanceScore: 0.8,
                },
                {
                    title: 'Result 3',
                    url: 'https://example3.com',
                    snippet: 'Different content here.',
                    relevanceScore: 0.7,
                },
            ];

            const snippets = extractor.extractSnippets(results, 'test');

            expect(snippets).toHaveLength(2);
        });

        it('should mark truncated snippets', () => {
            const longSnippet = 'A'.repeat(400);
            const results: SearchResult[] = [
                {
                    title: 'Result',
                    url: 'https://example.com',
                    snippet: longSnippet,
                    relevanceScore: 0.9,
                },
            ];

            const snippets = extractor.extractSnippets(results, 'test');

            expect(snippets[0].truncated).toBe(true);
            expect(snippets[0].text.length).toBeLessThanOrEqual(300);
        });

        it('should respect max total length', () => {
            const results: SearchResult[] = [
                {
                    title: 'Result 1',
                    url: 'https://example1.com',
                    snippet: 'A'.repeat(1500),
                    relevanceScore: 0.9,
                },
                {
                    title: 'Result 2',
                    url: 'https://example2.com',
                    snippet: 'B'.repeat(1500),
                    relevanceScore: 0.8,
                },
            ];

            const snippets = extractor.extractSnippets(results, 'test');

            const totalLength = snippets.reduce((sum, s) => sum + s.text.length, 0);
            expect(totalLength).toBeLessThanOrEqual(2000);
        });
    });

    describe('calculateRelevance()', () => {
        it('should return 0 for empty snippet', () => {
            const score = extractor.calculateRelevance('', 'query');
            expect(score).toBe(0);
        });

        it('should return 0 for empty query', () => {
            const score = extractor.calculateRelevance('snippet text', '');
            expect(score).toBe(0);
        });

        it('should calculate relevance based on query term matches', () => {
            const score1 = extractor.calculateRelevance('WebGPU is great', 'WebGPU');
            const score2 = extractor.calculateRelevance('Something else', 'WebGPU');

            expect(score1).toBeGreaterThan(score2);
        });

        it('should be case-insensitive', () => {
            const score1 = extractor.calculateRelevance('WebGPU is great', 'webgpu');
            const score2 = extractor.calculateRelevance('WebGPU is great', 'WebGPU');

            expect(score1).toBe(score2);
        });

        it('should handle multi-word queries', () => {
            const score = extractor.calculateRelevance(
                'WebGPU performance is excellent',
                'WebGPU performance'
            );

            expect(score).toBeGreaterThan(0.5);
        });

        it('should return max score of 1', () => {
            const score = extractor.calculateRelevance('WebGPU WebGPU WebGPU', 'WebGPU');
            expect(score).toBeLessThanOrEqual(1);
        });
    });

    describe('truncateSnippet()', () => {
        it('should not truncate short snippets', () => {
            const short = 'This is a short snippet.';
            const result = extractor.truncateSnippet(short);

            expect(result.text).toBe(short);
            expect(result.wasTruncated).toBe(false);
        });

        it('should truncate long snippets', () => {
            const long = 'A'.repeat(400);
            const result = extractor.truncateSnippet(long);

            expect(result.text.length).toBeLessThanOrEqual(300);
            expect(result.wasTruncated).toBe(true);
        });

        it('should preserve sentence boundaries when truncating', () => {
            // Create a snippet that's definitely longer than 300 chars
            const snippet =
                'First sentence. Second sentence. Third sentence. Fourth sentence. Fifth sentence. Sixth sentence. Seventh sentence. Eighth sentence. Ninth sentence. Tenth sentence. Eleventh sentence. Twelfth sentence. Thirteenth sentence. Fourteenth sentence. Fifteenth sentence. Sixteenth sentence. Seventeenth sentence. Eighteenth sentence. Nineteenth sentence. Twentieth sentence.';
            const result = extractor.truncateSnippet(snippet);

            expect(result.text).toMatch(/\.$|\.\.\.$/);
            expect(result.wasTruncated).toBe(true);
        });

        it('should handle snippets with question marks', () => {
            const snippet = 'What is WebGPU? It is a graphics API. More text here.';
            const result = extractor.truncateSnippet(snippet);

            expect(result.text).toMatch(/\?|\.\.\.$/);
        });

        it('should handle snippets with exclamation marks', () => {
            const snippet = 'WebGPU is amazing! It is fast. More text here.';
            const result = extractor.truncateSnippet(snippet);

            expect(result.text).toMatch(/!|\.\.\.$/);
        });

        it('should truncate at word boundary if no sentence boundary found', () => {
            const snippet = 'A'.repeat(100) + ' ' + 'B'.repeat(300);
            const result = extractor.truncateSnippet(snippet);

            expect(result.text).not.toContain('B'.repeat(50));
            expect(result.wasTruncated).toBe(true);
        });
    });

    describe('deduplication', () => {
        it('should remove exact duplicate snippets', () => {
            const results: SearchResult[] = [
                {
                    title: 'Result 1',
                    url: 'https://example1.com',
                    snippet: 'Exact same content',
                    relevanceScore: 0.9,
                },
                {
                    title: 'Result 2',
                    url: 'https://example2.com',
                    snippet: 'Exact same content',
                    relevanceScore: 0.8,
                },
            ];

            const snippets = extractor.extractSnippets(results, 'test');

            expect(snippets).toHaveLength(1);
        });

        it('should remove similar snippets ignoring punctuation', () => {
            const results: SearchResult[] = [
                {
                    title: 'Result 1',
                    url: 'https://example1.com',
                    snippet: 'This is a test snippet.',
                    relevanceScore: 0.9,
                },
                {
                    title: 'Result 2',
                    url: 'https://example2.com',
                    snippet: 'This is a test snippet',
                    relevanceScore: 0.8,
                },
            ];

            const snippets = extractor.extractSnippets(results, 'test');

            expect(snippets).toHaveLength(1);
        });

        it('should keep snippets with different content', () => {
            const results: SearchResult[] = [
                {
                    title: 'Result 1',
                    url: 'https://example1.com',
                    snippet: 'First unique content',
                    relevanceScore: 0.9,
                },
                {
                    title: 'Result 2',
                    url: 'https://example2.com',
                    snippet: 'Second unique content',
                    relevanceScore: 0.8,
                },
            ];

            const snippets = extractor.extractSnippets(results, 'test');

            expect(snippets).toHaveLength(2);
        });
    });

    describe('edge cases', () => {
        it('should handle null results gracefully', () => {
            const snippets = extractor.extractSnippets(null as any, 'test');
            expect(snippets).toEqual([]);
        });

        it('should handle snippets with only whitespace', () => {
            const results: SearchResult[] = [
                {
                    title: 'Result',
                    url: 'https://example.com',
                    snippet: '   \n\t  ',
                    relevanceScore: 0.9,
                },
            ];

            const snippets = extractor.extractSnippets(results, 'test');

            expect(snippets[0].text).toBe('');
        });

        it('should handle very long URLs in snippets', () => {
            const longUrl = 'https://example.com/' + 'a'.repeat(500);
            const results: SearchResult[] = [
                {
                    title: 'Result',
                    url: longUrl,
                    snippet: 'Check out this link: ' + longUrl,
                    relevanceScore: 0.9,
                },
            ];

            const snippets = extractor.extractSnippets(results, 'test');

            expect(snippets[0].text.length).toBeLessThanOrEqual(300);
        });

        it('should handle special characters in snippets', () => {
            const results: SearchResult[] = [
                {
                    title: 'Result',
                    url: 'https://example.com',
                    snippet: 'Special chars: @#$%^&*()_+-=[]{}|;:,.<>?',
                    relevanceScore: 0.9,
                },
            ];

            const snippets = extractor.extractSnippets(results, 'test');

            expect(snippets).toHaveLength(1);
            expect(snippets[0].text).toContain('Special chars');
        });
    });

    describe('ExtractedSnippet structure', () => {
        it('should include all required fields', () => {
            const results: SearchResult[] = [
                {
                    title: 'Result',
                    url: 'https://example.com',
                    snippet: 'Test snippet',
                    relevanceScore: 0.9,
                },
            ];

            const snippets = extractor.extractSnippets(results, 'test');

            expect(snippets[0]).toHaveProperty('text');
            expect(snippets[0]).toHaveProperty('source');
            expect(snippets[0]).toHaveProperty('relevanceScore');
            expect(snippets[0]).toHaveProperty('truncated');
        });

        it('should preserve source information', () => {
            const results: SearchResult[] = [
                {
                    title: 'Test Title',
                    url: 'https://example.com',
                    snippet: 'Test snippet',
                    publishedDate: '2024-01-15',
                    relevanceScore: 0.9,
                },
            ];

            const snippets = extractor.extractSnippets(results, 'test');

            expect(snippets[0].source.title).toBe('Test Title');
            expect(snippets[0].source.url).toBe('https://example.com');
            expect(snippets[0].source.publishedDate).toBe('2024-01-15');
        });
    });
});
