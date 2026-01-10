import { describe, it, expect, beforeEach } from 'vitest';
import { CitationFormatter } from '../../src/providers/citation-formatter';
import { type SearchResult } from '../../src/providers/search-api-client';

describe('CitationFormatter', () => {
    let formatter: CitationFormatter;

    beforeEach(() => {
        formatter = new CitationFormatter();
    });

    describe('formatCitations()', () => {
        it('should return empty string for empty sources', () => {
            const result = formatter.formatCitations([]);
            expect(result).toBe('');
        });

        it('should return empty string for null sources', () => {
            const result = formatter.formatCitations(null as any);
            expect(result).toBe('');
        });

        it('should format single citation', () => {
            const sources: SearchResult[] = [
                {
                    title: 'How to Use WebGPU',
                    url: 'https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API',
                    snippet: 'WebGPU is a graphics API',
                    relevanceScore: 0.9,
                },
            ];

            const result = formatter.formatCitations(sources);

            expect(result).toContain('Sources:');
            expect(result).toContain('[1]');
            expect(result).toContain('How to Use WebGPU');
            expect(result).toContain('developer.mozilla.org');
        });

        it('should format multiple citations with correct numbering', () => {
            const sources: SearchResult[] = [
                {
                    title: 'First Source',
                    url: 'https://example1.com',
                    snippet: 'First snippet',
                    relevanceScore: 0.9,
                },
                {
                    title: 'Second Source',
                    url: 'https://example2.com',
                    snippet: 'Second snippet',
                    relevanceScore: 0.8,
                },
                {
                    title: 'Third Source',
                    url: 'https://example3.com',
                    snippet: 'Third snippet',
                    relevanceScore: 0.7,
                },
            ];

            const result = formatter.formatCitations(sources);

            expect(result).toContain('[1]');
            expect(result).toContain('[2]');
            expect(result).toContain('[3]');
            expect(result).toContain('First Source');
            expect(result).toContain('Second Source');
            expect(result).toContain('Third Source');
        });

        it('should format as valid markdown', () => {
            const sources: SearchResult[] = [
                {
                    title: 'Example Title',
                    url: 'https://example.com/page',
                    snippet: 'Example snippet',
                    relevanceScore: 0.9,
                },
            ];

            const result = formatter.formatCitations(sources);

            // Check for markdown link format [text](url)
            expect(result).toMatch(/\[.*?\]\(.*?\)/);
        });

        it('should include domain in citations', () => {
            const sources: SearchResult[] = [
                {
                    title: 'Example',
                    url: 'https://www.example.com/page',
                    snippet: 'Example',
                    relevanceScore: 0.9,
                },
            ];

            const result = formatter.formatCitations(sources);

            expect(result).toContain('example.com');
        });

        it('should remove www prefix from domain display', () => {
            const sources: SearchResult[] = [
                {
                    title: 'Example',
                    url: 'https://www.example.com/page',
                    snippet: 'Example',
                    relevanceScore: 0.9,
                },
            ];

            const result = formatter.formatCitations(sources);

            // Domain display should not have www prefix
            expect(result).toMatch(/- example\.com$/m);
        });

        it('should handle URLs without www prefix', () => {
            const sources: SearchResult[] = [
                {
                    title: 'Example',
                    url: 'https://example.com/page',
                    snippet: 'Example',
                    relevanceScore: 0.9,
                },
            ];

            const result = formatter.formatCitations(sources);

            expect(result).toContain('example.com');
        });

        it('should escape special characters in titles', () => {
            const sources: SearchResult[] = [
                {
                    title: 'Title with [brackets] and (parentheses)',
                    url: 'https://example.com',
                    snippet: 'Example',
                    relevanceScore: 0.9,
                },
            ];

            const result = formatter.formatCitations(sources);

            // Should contain escaped brackets
            expect(result).toContain('\\[');
            expect(result).toContain('\\]');
        });

        it('should handle titles with asterisks', () => {
            const sources: SearchResult[] = [
                {
                    title: 'Title with *asterisks*',
                    url: 'https://example.com',
                    snippet: 'Example',
                    relevanceScore: 0.9,
                },
            ];

            const result = formatter.formatCitations(sources);

            expect(result).toContain('\\*');
        });

        it('should handle titles with underscores', () => {
            const sources: SearchResult[] = [
                {
                    title: 'Title_with_underscores',
                    url: 'https://example.com',
                    snippet: 'Example',
                    relevanceScore: 0.9,
                },
            ];

            const result = formatter.formatCitations(sources);

            expect(result).toContain('\\_');
        });

        it('should handle titles with backticks', () => {
            const sources: SearchResult[] = [
                {
                    title: 'Title with `code`',
                    url: 'https://example.com',
                    snippet: 'Example',
                    relevanceScore: 0.9,
                },
            ];

            const result = formatter.formatCitations(sources);

            expect(result).toContain('\\`');
        });

        it('should handle complex URLs with query parameters', () => {
            const sources: SearchResult[] = [
                {
                    title: 'Example',
                    url: 'https://example.com/page?param1=value1&param2=value2#section',
                    snippet: 'Example',
                    relevanceScore: 0.9,
                },
            ];

            const result = formatter.formatCitations(sources);

            expect(result).toContain('example.com');
            expect(result).toContain('https://example.com/page');
        });

        it('should handle URLs with special characters', () => {
            const sources: SearchResult[] = [
                {
                    title: 'Example',
                    url: 'https://example.com/path-with-dashes_and_underscores',
                    snippet: 'Example',
                    relevanceScore: 0.9,
                },
            ];

            const result = formatter.formatCitations(sources);

            expect(result).toContain('example.com');
        });
    });

    describe('generateInlineCitation()', () => {
        it('should generate citation marker for index 1', () => {
            const marker = formatter.generateInlineCitation(1);
            expect(marker).toBe('[1]');
        });

        it('should generate citation marker for index 5', () => {
            const marker = formatter.generateInlineCitation(5);
            expect(marker).toBe('[5]');
        });

        it('should generate citation marker for index 10', () => {
            const marker = formatter.generateInlineCitation(10);
            expect(marker).toBe('[10]');
        });

        it('should generate citation marker for large index', () => {
            const marker = formatter.generateInlineCitation(999);
            expect(marker).toBe('[999]');
        });
    });

    describe('extractDomain()', () => {
        it('should extract domain from simple URL', () => {
            const domain = formatter.extractDomain('https://example.com');
            expect(domain).toBe('example.com');
        });

        it('should extract domain from URL with path', () => {
            const domain = formatter.extractDomain('https://example.com/path/to/page');
            expect(domain).toBe('example.com');
        });

        it('should extract domain from URL with query parameters', () => {
            const domain = formatter.extractDomain('https://example.com/page?param=value');
            expect(domain).toBe('example.com');
        });

        it('should extract domain from URL with fragment', () => {
            const domain = formatter.extractDomain('https://example.com/page#section');
            expect(domain).toBe('example.com');
        });

        it('should remove www prefix', () => {
            const domain = formatter.extractDomain('https://www.example.com');
            expect(domain).toBe('example.com');
        });

        it('should handle subdomains', () => {
            const domain = formatter.extractDomain('https://api.example.com');
            expect(domain).toBe('api.example.com');
        });

        it('should handle multiple subdomains', () => {
            const domain = formatter.extractDomain('https://docs.api.example.com');
            expect(domain).toBe('docs.api.example.com');
        });

        it('should handle URLs with port numbers', () => {
            const domain = formatter.extractDomain('https://example.com:8080/page');
            expect(domain).toBe('example.com');
        });

        it('should handle http URLs', () => {
            const domain = formatter.extractDomain('http://example.com');
            expect(domain).toBe('example.com');
        });

        it('should return empty string for empty URL', () => {
            const domain = formatter.extractDomain('');
            expect(domain).toBe('');
        });

        it('should return original URL for invalid URL', () => {
            const invalidUrl = 'not a valid url';
            const domain = formatter.extractDomain(invalidUrl);
            expect(domain).toBe(invalidUrl);
        });

        it('should handle developer.mozilla.org', () => {
            const domain = formatter.extractDomain('https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API');
            expect(domain).toBe('developer.mozilla.org');
        });

        it('should handle github.com URLs', () => {
            const domain = formatter.extractDomain('https://github.com/user/repo');
            expect(domain).toBe('github.com');
        });
    });

    describe('edge cases', () => {
        it('should handle sources with empty title', () => {
            const sources: SearchResult[] = [
                {
                    title: '',
                    url: 'https://example.com',
                    snippet: 'Example',
                    relevanceScore: 0.9,
                },
            ];

            const result = formatter.formatCitations(sources);

            expect(result).toContain('[1]');
            expect(result).toContain('example.com');
        });

        it('should handle sources with empty URL', () => {
            const sources: SearchResult[] = [
                {
                    title: 'Example',
                    url: '',
                    snippet: 'Example',
                    relevanceScore: 0.9,
                },
            ];

            const result = formatter.formatCitations(sources);

            expect(result).toContain('[1]');
            expect(result).toContain('Example');
        });

        it('should handle sources with very long titles', () => {
            const longTitle = 'A'.repeat(500);
            const sources: SearchResult[] = [
                {
                    title: longTitle,
                    url: 'https://example.com',
                    snippet: 'Example',
                    relevanceScore: 0.9,
                },
            ];

            const result = formatter.formatCitations(sources);

            expect(result).toContain('[1]');
            expect(result).toContain('A');
        });

        it('should handle sources with special characters in title', () => {
            const sources: SearchResult[] = [
                {
                    title: 'Title with "quotes" and \'apostrophes\'',
                    url: 'https://example.com',
                    snippet: 'Example',
                    relevanceScore: 0.9,
                },
            ];

            const result = formatter.formatCitations(sources);

            expect(result).toContain('[1]');
        });

        it('should handle many sources', () => {
            const sources: SearchResult[] = Array.from({ length: 20 }, (_, i) => ({
                title: `Source ${i + 1}`,
                url: `https://example${i + 1}.com`,
                snippet: 'Example',
                relevanceScore: 0.9,
            }));

            const result = formatter.formatCitations(sources);

            expect(result).toContain('[1]');
            expect(result).toContain('[20]');
            expect(result).toContain('Source 1');
            expect(result).toContain('Source 20');
        });
    });

    describe('citation format structure', () => {
        it('should have Sources header', () => {
            const sources: SearchResult[] = [
                {
                    title: 'Example',
                    url: 'https://example.com',
                    snippet: 'Example',
                    relevanceScore: 0.9,
                },
            ];

            const result = formatter.formatCitations(sources);

            expect(result.startsWith('Sources:')).toBe(true);
        });

        it('should have newline after Sources header', () => {
            const sources: SearchResult[] = [
                {
                    title: 'Example',
                    url: 'https://example.com',
                    snippet: 'Example',
                    relevanceScore: 0.9,
                },
            ];

            const result = formatter.formatCitations(sources);

            expect(result).toMatch(/Sources:\n/);
        });

        it('should have each citation on separate line', () => {
            const sources: SearchResult[] = [
                {
                    title: 'First',
                    url: 'https://example1.com',
                    snippet: 'Example',
                    relevanceScore: 0.9,
                },
                {
                    title: 'Second',
                    url: 'https://example2.com',
                    snippet: 'Example',
                    relevanceScore: 0.8,
                },
            ];

            const result = formatter.formatCitations(sources);
            const lines = result.split('\n');

            expect(lines.length).toBeGreaterThanOrEqual(3); // Header + 2 citations
        });
    });
});
