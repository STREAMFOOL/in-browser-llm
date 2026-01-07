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

    private static renderCodeBlocks(html: string, hasIncomplete: boolean): string {
        // Match complete code blocks
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;

        html = html.replace(codeBlockRegex, (match, language, code) => {
            const lang = language || 'plaintext';
            return `<pre><code class="language-${this.escapeHtml(lang)}">${code}</code></pre>`;
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

                html = before + `<pre class="incomplete"><code class="language-${this.escapeHtml(language)}">${codeStart}</code></pre>`;
            }
        }

        return html;
    }

    private static renderInlineCode(html: string): string {
        // Match inline code (single backticks)
        return html.replace(/`([^`]+)`/g, '<code>$1</code>');
    }

    private static renderHeaders(html: string): string {
        // H1-H6
        html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
        html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
        html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
        html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
        return html;
    }

    private static renderBoldItalic(html: string): string {
        // Bold and italic (avoid matching inside code blocks)
        html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
        html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
        html = html.replace(/_(.+?)_/g, '<em>$1</em>');
        return html;
    }

    private static renderLists(html: string): string {
        // Unordered lists
        html = html.replace(/^\s*[-*+]\s+(.+)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

        // Ordered lists
        html = html.replace(/^\s*\d+\.\s+(.+)$/gm, '<li>$1</li>');

        return html;
    }

    private static renderLinks(html: string): string {
        // Links [text](url)
        return html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    }

    private static renderLineBreaks(html: string): string {
        // Convert double newlines to paragraphs
        const paragraphs = html.split(/\n\n+/);
        return paragraphs.map(p => {
            // Don't wrap if already wrapped in a block element
            if (p.match(/^<(pre|ul|ol|h[1-6]|blockquote)/)) {
                return p;
            }
            return `<p>${p.replace(/\n/g, '<br>')}</p>`;
        }).join('\n');
    }

    /**
     * Get styles for rendered markdown
     */
    static getStyles(): string {
        return `
            .message-content h1,
            .message-content h2,
            .message-content h3,
            .message-content h4,
            .message-content h5,
            .message-content h6 {
                margin: 16px 0 8px 0;
                font-weight: 600;
                line-height: 1.3;
            }

            .message-content h1 { font-size: 1.8em; }
            .message-content h2 { font-size: 1.5em; }
            .message-content h3 { font-size: 1.3em; }
            .message-content h4 { font-size: 1.1em; }
            .message-content h5 { font-size: 1em; }
            .message-content h6 { font-size: 0.9em; }

            .message-content p {
                margin: 8px 0;
            }

            .message-content code {
                background: rgba(0, 0, 0, 0.05);
                padding: 2px 6px;
                border-radius: 3px;
                font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
                font-size: 0.9em;
            }

            .message-content pre {
                background: #1e1e1e;
                color: #d4d4d4;
                padding: 16px;
                border-radius: 8px;
                overflow-x: auto;
                margin: 12px 0;
            }

            .message-content pre.incomplete {
                border-bottom: 2px dashed #3b82f6;
                position: relative;
            }

            .message-content pre.incomplete::after {
                content: '⋯';
                position: absolute;
                bottom: 4px;
                right: 12px;
                color: #3b82f6;
                font-size: 20px;
                animation: blink 1.5s ease-in-out infinite;
            }

            @keyframes blink {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.3; }
            }

            .message-content pre code {
                background: none;
                padding: 0;
                color: inherit;
            }

            .message-content ul,
            .message-content ol {
                margin: 8px 0;
                padding-left: 24px;
            }

            .message-content li {
                margin: 4px 0;
            }

            .message-content a {
                color: #3b82f6;
                text-decoration: underline;
            }

            .message-content a:hover {
                color: #2563eb;
            }

            .message-content strong {
                font-weight: 600;
            }

            .message-content em {
                font-style: italic;
            }

            .message-content blockquote {
                border-left: 4px solid #e5e7eb;
                padding-left: 16px;
                margin: 12px 0;
                color: #6b7280;
            }
        `;
    }
}
