/**
 * Citation Formatter
 * Formats source citations for inclusion in model responses
 */

import { SearchResult } from './search-api-client';

export interface FormattedCitation {
    index: number;
    title: string;
    domain: string;
    url: string;
}

export class CitationFormatter {
    /**
     * Format citations as markdown list
     */
    formatCitations(sources: SearchResult[]): string {
        if (!sources || sources.length === 0) {
            return '';
        }

        const citations = sources.map((source, index) => this.formatCitation(source, index + 1));

        return `Sources:\n${citations.join('\n')}`;
    }

    /**
     * Generate inline citation marker
     */
    generateInlineCitation(index: number): string {
        return `[${index}]`;
    }

    /**
     * Extract domain from URL for display
     */
    extractDomain(url: string): string {
        if (!url) {
            return '';
        }

        try {
            const urlObj = new URL(url);
            // Remove 'www.' prefix if present
            return urlObj.hostname.replace(/^www\./, '');
        } catch {
            // If URL parsing fails, return the original URL
            return url;
        }
    }

    /**
     * Format a single citation as markdown
     */
    private formatCitation(source: SearchResult, index: number): string {
        const domain = this.extractDomain(source.url);
        const title = this.escapeMarkdown(source.title);
        const url = this.escapeUrl(source.url);

        return `[${index}] [${title}](${url}) - ${domain}`;
    }

    /**
     * Escape special markdown characters in title
     */
    private escapeMarkdown(text: string): string {
        if (!text) {
            return '';
        }

        // Escape markdown special characters
        return text
            .replace(/\\/g, '\\\\')
            .replace(/\[/g, '\\[')
            .replace(/\]/g, '\\]')
            .replace(/\(/g, '\\(')
            .replace(/\)/g, '\\)')
            .replace(/\*/g, '\\*')
            .replace(/_/g, '\\_')
            .replace(/`/g, '\\`');
    }

    /**
     * Escape URL for markdown link
     */
    private escapeUrl(url: string): string {
        if (!url) {
            return '';
        }

        // Encode special characters in URL while preserving the URL structure
        try {
            const urlObj = new URL(url);
            return urlObj.toString();
        } catch {
            // If URL is invalid, return as-is
            return url;
        }
    }
}
