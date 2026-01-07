/**
 * Markdown Renderer
 * Incremental markdown parsing for streaming responses
 * Requirements: 3.3, 14.1, 14.2, 14.3
 */

export class MarkdownRenderer {
    /**
     * Render markdown to HTML incrementally
     * Handles incomplete code blocks gracefully
     */
    static render(markdown: string): string {
        // Handle empty or whitespace-only content
        if (!markdown || markdown.trim().length === 0) {
            return markdown;
        }

        let html = markdown;

        // Escape HTML to prevent XSS
        html = this.escapeHtml(html);

        // Track if we're in a code block
        const codeBlockMatches = html.match(/```/g);
        const hasIncompleteCodeBlock = codeBlockMatches && codeBlockMatches.length % 2 !== 0;

        // Process complete code blocks first
        html = this.renderCodeBlocks(html, hasIncompleteCodeBlock);

        // Process inline code
        html = this.renderInlineCode(html);

        // Process headers
        html = this.renderHeaders(html);

        // Process blockquotes
        html = this.renderBlockquotes(html);

        // Process bold and italic
        html = this.renderBoldItalic(html);

        // Process lists
        html = this.renderLists(html);

        // Process links
        html = this.renderLinks(html);

        // Process line breaks
        html = this.renderLineBreaks(html);

        return html;
    }

    private static escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    private static renderCodeBlocks(html: string, hasIncomplete: boolean | null): string {
        // Match complete code blocks
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;

        html = html.replace(codeBlockRegex, (_match, language, code) => {
            const lang = language || 'plaintext';
            return `<pre class="bg-gray-900 text-gray-300 p-4 rounded-lg overflow-x-auto my-3"><code class="language-${this.escapeHtml(lang)} bg-transparent p-0">${code}</code></pre>`;
        });

        // Handle incomplete code block at the end
        if (hasIncomplete) {
            const lastTripleBacktick = html.lastIndexOf('```');
            if (lastTripleBacktick !== -1) {
                const before = html.substring(0, lastTripleBacktick);
                const after = html.substring(lastTripleBacktick + 3);

                // Extract language if present
                const langMatch = after.match(/^(\w+)?\n/);
                const language = langMatch ? langMatch[1] || 'plaintext' : 'plaintext';
                const codeStart = langMatch ? after.substring(langMatch[0].length) : after;

                html = before + `<pre class="incomplete bg-gray-900 text-gray-300 p-4 rounded-lg overflow-x-auto my-3 border-b-2 border-dashed border-blue-500 relative"><code class="language-${this.escapeHtml(language)} bg-transparent p-0">${codeStart}</code></pre>`;
            }
        }

        return html;
    }

    private static renderInlineCode(html: string): string {
        // Match inline code (single backticks)
        return html.replace(/`([^`]+)`/g, '<code class="bg-black/5 py-0.5 px-1.5 rounded font-mono text-sm">$1</code>');
    }

    private static renderHeaders(html: string): string {
        // H1-H6 with Tailwind classes
        html = html.replace(/^######\s+(.+)$/gm, '<h6 class="my-4 mb-2 font-semibold leading-tight text-sm">$1</h6>');
        html = html.replace(/^#####\s+(.+)$/gm, '<h5 class="my-4 mb-2 font-semibold leading-tight text-base">$1</h5>');
        html = html.replace(/^####\s+(.+)$/gm, '<h4 class="my-4 mb-2 font-semibold leading-tight text-lg">$1</h4>');
        html = html.replace(/^###\s+(.+)$/gm, '<h3 class="my-4 mb-2 font-semibold leading-tight text-xl">$1</h3>');
        html = html.replace(/^##\s+(.+)$/gm, '<h2 class="my-4 mb-2 font-semibold leading-tight text-2xl">$1</h2>');
        html = html.replace(/^#\s+(.+)$/gm, '<h1 class="my-4 mb-2 font-semibold leading-tight text-3xl">$1</h1>');
        return html;
    }

    private static renderBlockquotes(html: string): string {
        // Blockquotes
        return html.replace(/^>\s+(.+)$/gm, '<blockquote class="border-l-4 border-gray-200 pl-4 my-3 text-gray-500">$1</blockquote>');
    }

    private static renderBoldItalic(html: string): string {
        // Bold and italic (avoid matching inside code blocks)
        html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong class="font-semibold"><em class="italic">$1</em></strong>');
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>');
        html = html.replace(/\*(.+?)\*/g, '<em class="italic">$1</em>');
        html = html.replace(/___(.+?)___/g, '<strong class="font-semibold"><em class="italic">$1</em></strong>');
        html = html.replace(/__(.+?)__/g, '<strong class="font-semibold">$1</strong>');
        html = html.replace(/_(.+?)_/g, '<em class="italic">$1</em>');
        return html;
    }

    private static renderLists(html: string): string {
        // Unordered lists
        html = html.replace(/^\s*[-*+]\s+(.+)$/gm, '<li class="my-1">$1</li>');
        html = html.replace(/(<li class="my-1">.*<\/li>\n?)+/g, '<ul class="my-2 pl-6">$&</ul>');

        // Ordered lists
        html = html.replace(/^\s*\d+\.\s+(.+)$/gm, '<li class="my-1">$1</li>');

        return html;
    }

    private static renderLinks(html: string): string {
        // Links [text](url)
        return html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-500 underline hover:text-blue-600">$1</a>');
    }

    private static renderLineBreaks(html: string): string {
        // Convert double newlines to paragraphs
        const paragraphs = html.split(/\n\n+/);
        return paragraphs.map(p => {
            // Don't wrap if already wrapped in a block element
            if (p.match(/^<(pre|ul|ol|h[1-6]|blockquote)/)) {
                return p;
            }
            return `<p class="my-2">${p.replace(/\n/g, '<br>')}</p>`;
        }).join('\n');
    }
}
