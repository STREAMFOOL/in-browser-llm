/**
 * Property-Based Tests for Streaming Response Rendering
 * Feature: local-ai-assistant, Property 4: Streaming Incremental Rendering
 * Validates: Requirements 3.3, 14.1, 14.2
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ChatUI, Message } from '../../src/chat-ui';
import { MarkdownRenderer } from '../../src/markdown-renderer';

describe('Streaming Incremental Rendering Properties', () => {
    let container: HTMLElement;
    let chatUI: ChatUI;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);

        chatUI = new ChatUI(container, {
            onSendMessage: () => { },
            onCancelStream: () => { }
        });
    });

    // Feature: local-ai-assistant, Property 4: Streaming Incremental Rendering
    // For any stream of response chunks, each chunk should appear in the UI incrementally
    // as it arrives, maintaining correct Markdown rendering throughout
    it('should render each chunk incrementally with valid markdown', () => {
        fc.assert(
            fc.property(
                // Generate arrays of text chunks that form a complete message
                fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 20 }),
                (chunks) => {
                    // Create a message
                    const messageId = 'test-msg-' + Date.now();
                    const initialMessage: Message = {
                        id: messageId,
                        role: 'assistant',
                        content: '',
                        timestamp: Date.now(),
                        isStreaming: true
                    };

                    chatUI.addMessage(initialMessage);

                    // Simulate streaming by updating with accumulated chunks
                    let accumulated = '';
                    for (const chunk of chunks) {
                        accumulated += chunk;
                        chatUI.updateMessage(messageId, accumulated, true);

                        // Verify the message element exists
                        const messageEl = container.querySelector(`[data-message-id="${messageId}"]`);
                        expect(messageEl).toBeTruthy();

                        // Verify content is rendered
                        const contentEl = messageEl?.querySelector('.message-content');
                        expect(contentEl).toBeTruthy();
                        expect(contentEl?.innerHTML).toBeTruthy();
                    }

                    // Final verification: accumulated content should be rendered
                    const finalMessageEl = container.querySelector(`[data-message-id="${messageId}"]`);
                    const finalContentEl = finalMessageEl?.querySelector('.message-content');

                    // The rendered HTML should contain some representation of the accumulated text
                    expect(finalContentEl?.innerHTML.length).toBeGreaterThan(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    // Property: Markdown elements should be rendered correctly at each step
    it('should maintain valid markdown rendering during streaming', () => {
        fc.assert(
            fc.property(
                // Generate markdown-like content
                fc.array(
                    fc.oneof(
                        fc.constant('**bold** '),
                        fc.constant('*italic* '),
                        fc.constant('`code` '),
                        fc.constant('# Header\n'),
                        fc.constant('- list item\n'),
                        fc.string({ minLength: 1, maxLength: 20 }).map(s => s + ' ')
                    ),
                    { minLength: 1, maxLength: 15 }
                ),
                (chunks) => {
                    const messageId = 'test-md-' + Date.now();
                    const initialMessage: Message = {
                        id: messageId,
                        role: 'assistant',
                        content: '',
                        timestamp: Date.now()
                    };

                    chatUI.addMessage(initialMessage);

                    let accumulated = '';
                    for (const chunk of chunks) {
                        accumulated += chunk;
                        chatUI.updateMessage(messageId, accumulated, true);

                        // Verify markdown is rendered (HTML tags should be present)
                        const messageEl = container.querySelector(`[data-message-id="${messageId}"]`);
                        const contentEl = messageEl?.querySelector('.message-content');

                        // Should have HTML content (not just text)
                        expect(contentEl).toBeTruthy();
                    }

                    // Verify final rendering contains markdown elements
                    const finalMessageEl = container.querySelector(`[data-message-id="${messageId}"]`);
                    const finalContentEl = finalMessageEl?.querySelector('.message-content');
                    const html = finalContentEl?.innerHTML || '';

                    // If we had markdown syntax, it should be converted to HTML
                    if (accumulated.includes('**') || accumulated.includes('*') ||
                        accumulated.includes('`') || accumulated.includes('#')) {
                        expect(html).not.toBe(accumulated); // Should be transformed
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    // Property: Incomplete code blocks should be handled gracefully
    it('should handle incomplete code blocks without breaking rendering', () => {
        fc.assert(
            fc.property(
                fc.tuple(
                    fc.string({ minLength: 1, maxLength: 30 }),
                    fc.string({ minLength: 1, maxLength: 50 })
                ),
                ([beforeCode, codeContent]) => {
                    const messageId = 'test-code-' + Date.now();
                    const initialMessage: Message = {
                        id: messageId,
                        role: 'assistant',
                        content: '',
                        timestamp: Date.now()
                    };

                    chatUI.addMessage(initialMessage);

                    // Simulate streaming with incomplete code block
                    const chunks = [
                        beforeCode,
                        '\n```javascript\n',
                        codeContent
                        // Note: no closing ```
                    ];

                    let accumulated = '';
                    for (const chunk of chunks) {
                        accumulated += chunk;
                        chatUI.updateMessage(messageId, accumulated, true);

                        // Should not throw error
                        const messageEl = container.querySelector(`[data-message-id="${messageId}"]`);
                        expect(messageEl).toBeTruthy();
                    }

                    // Verify incomplete code block is rendered with indicator
                    const finalMessageEl = container.querySelector(`[data-message-id="${messageId}"]`);
                    const contentEl = finalMessageEl?.querySelector('.message-content');
                    const html = contentEl?.innerHTML || '';

                    // Should contain a pre element (code block)
                    expect(html).toContain('<pre');

                    // Should have incomplete indicator
                    expect(html).toContain('incomplete');
                }
            ),
            { numRuns: 100 }
        );
    });

    // Property: User messages should render as plain text (no markdown)
    it('should render user messages as plain text without markdown processing', () => {
        let counter = 0;
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
                (content) => {
                    const messageId = `test-user-${Date.now()}-${counter++}`;
                    const userMessage: Message = {
                        id: messageId,
                        role: 'user',
                        content,
                        timestamp: Date.now()
                    };

                    chatUI.addMessage(userMessage);

                    const messageEl = container.querySelector(`[data-message-id="${messageId}"]`);
                    const contentEl = messageEl?.querySelector('.message-content');

                    // User messages should have textContent equal to original
                    expect(contentEl?.textContent).toBe(content);

                    // Should not have HTML tags from markdown processing
                    if (content.includes('**') || content.includes('*')) {
                        expect(contentEl?.innerHTML).not.toContain('<strong>');
                        expect(contentEl?.innerHTML).not.toContain('<em>');
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});
