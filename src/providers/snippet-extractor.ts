/**
 * Snippet Extractor
 * Processes search results to extract relevant text snippets for context injection
 */

import { SearchResult } from './search-api-client';

export interface ExtractedSnippet {
    text: string;
    source: SearchResult;
    relevanceScore: number;
    truncated: boolean;
}

export class SnippetExtractor {
    private readonly maxSnippetLength: number;
    private readonly maxTotalLength: number;

    constructor(maxSnippetLength: number = 300, maxTotalLength: number = 2000) {
        this.maxSnippetLength = maxSnippetLength;
        this.maxTotalLength = maxTotalLength;
    }

    /**
     * Extract and rank snippets from search results
     */
    extractSnippets(results: SearchResult[], query: string): ExtractedSnippet[] {
        if (!results || results.length === 0) {
            return [];
        }

        // Clean and extract snippets
        let snippets = results.map((result) => ({
            text: this.cleanSnippet(result.snippet),
            source: result,
            relevanceScore: this.calculateRelevance(result.snippet, query) * result.relevanceScore,
            truncated: false,
        }));

        // Truncate snippets
        snippets = snippets.map((snippet) => {
            const truncated = this.truncateSnippet(snippet.text);
            return {
                ...snippet,
                text: truncated.text,
                truncated: truncated.wasTruncated,
            };
        });

        // Deduplicate similar snippets
        snippets = this.deduplicateSnippets(snippets);

        // Sort by relevance score
        snippets.sort((a, b) => b.relevanceScore - a.relevanceScore);

        // Limit total length
        return this.limitTotalLength(snippets);
    }

    /**
     * Calculate relevance score for a snippet based on query match
     */
    calculateRelevance(snippet: string, query: string): number {
        if (!snippet || !query) {
            return 0;
        }

        const snippetLower = snippet.toLowerCase();
        const queryTerms = query.toLowerCase().split(/\s+/);

        let matchCount = 0;
        for (const term of queryTerms) {
            if (term.length > 0 && snippetLower.includes(term)) {
                matchCount++;
            }
        }

        // Score based on percentage of query terms found
        const score = queryTerms.length > 0 ? matchCount / queryTerms.length : 0;
        return Math.min(score, 1);
    }

    /**
     * Truncate snippet to fit context window while preserving sentence boundaries
     */
    truncateSnippet(snippet: string): { text: string; wasTruncated: boolean } {
        if (snippet.length <= this.maxSnippetLength) {
            return { text: snippet, wasTruncated: false };
        }

        // Reserve 3 characters for "..." if needed
        const maxLength = this.maxSnippetLength - 3;

        // Find the last sentence boundary before max length
        const truncated = snippet.substring(0, maxLength);
        const lastPeriod = truncated.lastIndexOf('.');
        const lastQuestion = truncated.lastIndexOf('?');
        const lastExclamation = truncated.lastIndexOf('!');

        const lastBoundary = Math.max(lastPeriod, lastQuestion, lastExclamation);

        if (lastBoundary > maxLength * 0.7) {
            // If we found a sentence boundary in the last 30% of the truncated text
            return {
                text: truncated.substring(0, lastBoundary + 1).trim(),
                wasTruncated: true,
            };
        }

        // Otherwise, truncate at word boundary
        const lastSpace = truncated.lastIndexOf(' ');
        if (lastSpace > 0) {
            return {
                text: truncated.substring(0, lastSpace).trim() + '...',
                wasTruncated: true,
            };
        }

        return { text: truncated.trim() + '...', wasTruncated: true };
    }

    /**
     * Remove HTML tags and formatting from snippets
     */
    private cleanSnippet(snippet: string): string {
        if (!snippet) {
            return '';
        }

        // Remove HTML tags
        let cleaned = snippet.replace(/<[^>]*>/g, '');

        // Decode HTML entities
        cleaned = this.decodeHtmlEntities(cleaned);

        // Normalize whitespace
        cleaned = cleaned.replace(/\s+/g, ' ').trim();

        return cleaned;
    }

    /**
     * Decode common HTML entities
     */
    private decodeHtmlEntities(text: string): string {
        const entities: Record<string, string> = {
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&#39;': "'",
            '&nbsp;': ' ',
            '&apos;': "'",
        };

        let decoded = text;
        for (const [entity, char] of Object.entries(entities)) {
            decoded = decoded.replace(new RegExp(entity, 'g'), char);
        }

        return decoded;
    }

    /**
     * Detect and remove duplicate snippets by content similarity
     */
    private deduplicateSnippets(snippets: ExtractedSnippet[]): ExtractedSnippet[] {
        const seen = new Set<string>();
        const deduplicated: ExtractedSnippet[] = [];

        for (const snippet of snippets) {
            const normalized = this.normalizeForComparison(snippet.text);

            if (!seen.has(normalized)) {
                seen.add(normalized);
                deduplicated.push(snippet);
            }
        }

        return deduplicated;
    }

    /**
     * Normalize snippet text for similarity comparison
     */
    private normalizeForComparison(text: string): string {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, '') // Remove punctuation
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
    }

    /**
     * Limit total length of all snippets combined
     */
    private limitTotalLength(snippets: ExtractedSnippet[]): ExtractedSnippet[] {
        let totalLength = 0;
        const result: ExtractedSnippet[] = [];

        for (const snippet of snippets) {
            const newLength = totalLength + snippet.text.length;

            if (newLength <= this.maxTotalLength) {
                result.push(snippet);
                totalLength = newLength;
            } else if (totalLength < this.maxTotalLength) {
                // Try to fit a partial snippet
                const remaining = this.maxTotalLength - totalLength;
                if (remaining > 50) {
                    // Only include if we have at least 50 chars left
                    const partial = snippet.text.substring(0, remaining - 3) + '...';
                    result.push({
                        ...snippet,
                        text: partial,
                        truncated: true,
                    });
                }
                break;
            } else {
                break;
            }
        }

        return result;
    }
}
