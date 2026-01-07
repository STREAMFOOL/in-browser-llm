

import { describe, it, expect } from 'vitest';
import { MarkdownRenderer } from '../src/markdown-renderer';

describe('MarkdownRenderer', () => {
    describe('Incomplete Code Block Handling', () => {
        // Requirement 14.3: Handle incomplete code blocks gracefully
        it('should render incomplete code block with indicator', () => {
            const markdown = 'Here is some code:\n```javascript\nconst x = 1;';
            const html = MarkdownRenderer.render(markdown);

            // Should contain a pre element
            expect(html).toContain('<pre');

            // Should have border-dashed class for incomplete indicator
            expect(html).toContain('border-dashed');
            expect(html).toContain('border-blue-500');

            // Should contain the code content
            expect(html).toContain('const x = 1;');
        });

        it('should render incomplete code block without language', () => {
            const markdown = 'Code:\n```\nfunction test() {';
            const html = MarkdownRenderer.render(markdown);

            expect(html).toContain('<pre');
            expect(html).toContain('border-dashed');
            expect(html).toContain('function test() {');
        });

        it('should handle multiple complete code blocks followed by incomplete one', () => {
            const markdown = `
First block:
\`\`\`python
print("hello")
\`\`\`

Second block:
\`\`\`javascript
console.log("world")
\`\`\`

Incomplete:
\`\`\`typescript
const incomplete = true;
`;
            const html = MarkdownRenderer.render(markdown);

            // Should have 3 pre elements
            const preCount = (html.match(/<pre/g) || []).length;
            expect(preCount).toBe(3);

            // Last one should have incomplete indicator (border-dashed)
            expect(html).toContain('border-dashed');
        });

        it('should handle incomplete code block at the very start', () => {
            const markdown = '```\ncode here';
            const html = MarkdownRenderer.render(markdown);

            expect(html).toContain('<pre');
            expect(html).toContain('border-dashed');
        });

        it('should handle empty incomplete code block', () => {
            const markdown = 'Text before\n```javascript\n';
            const html = MarkdownRenderer.render(markdown);

            expect(html).toContain('<pre');
            expect(html).toContain('border-dashed');
        });

        it('should not mark complete code blocks as incomplete', () => {
            const markdown = '```javascript\nconst x = 1;\n```';
            const html = MarkdownRenderer.render(markdown);

            expect(html).toContain('<pre');
            expect(html).not.toContain('border-dashed');
        });

        it('should handle text after incomplete code block', () => {
            const markdown = 'Before\n```\ncode\nAfter text';
            const html = MarkdownRenderer.render(markdown);

            expect(html).toContain('border-dashed');
            expect(html).toContain('After text');
        });
    });

    describe('Complete Markdown Rendering', () => {
        it('should render bold text', () => {
            const markdown = '**bold text**';
            const html = MarkdownRenderer.render(markdown);
            expect(html).toContain('<strong class="font-semibold">bold text</strong>');
        });

        it('should render italic text', () => {
            const markdown = '*italic text*';
            const html = MarkdownRenderer.render(markdown);
            expect(html).toContain('<em class="italic">italic text</em>');
        });

        it('should render inline code', () => {
            const markdown = 'Use `const` keyword';
            const html = MarkdownRenderer.render(markdown);
            expect(html).toContain('<code class="bg-black/5 py-0.5 px-1.5 rounded font-mono text-sm">const</code>');
        });

        it('should render headers', () => {
            const markdown = '# Header 1\n## Header 2';
            const html = MarkdownRenderer.render(markdown);
            expect(html).toContain('<h1 class="my-4 mb-2 font-semibold leading-tight text-3xl">Header 1</h1>');
            expect(html).toContain('<h2 class="my-4 mb-2 font-semibold leading-tight text-2xl">Header 2</h2>');
        });

        it('should render links', () => {
            const markdown = '[Google](https://google.com)';
            const html = MarkdownRenderer.render(markdown);
            expect(html).toContain('<a href="https://google.com"');
            expect(html).toContain('class="text-blue-500 underline hover:text-blue-600"');
            expect(html).toContain('Google</a>');
        });

        it('should escape HTML to prevent XSS', () => {
            const markdown = '<script>alert("xss")</script>';
            const html = MarkdownRenderer.render(markdown);
            expect(html).not.toContain('<script>');
            expect(html).toContain('&lt;script&gt;');
        });

        it('should render complete code blocks with language', () => {
            const markdown = '```python\nprint("hello")\n```';
            const html = MarkdownRenderer.render(markdown);
            expect(html).toContain('<pre class="bg-gray-900 text-gray-300 p-4 rounded-lg overflow-x-auto my-3">');
            expect(html).toContain('language-python');
            expect(html).toContain('print(&quot;hello&quot;)');
        });
    });
});
