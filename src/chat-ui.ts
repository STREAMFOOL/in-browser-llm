/**
 * Chat UI Components
 * Message list with auto-scroll, input field, and loading indicators
 * Requirements: 3.2, 3.3
 */

import { MarkdownRenderer } from './markdown-renderer';

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    isStreaming?: boolean;
}

export interface ChatUICallbacks {
    onSendMessage: (content: string) => void;
    onCancelStream?: () => void;
}

export class ChatUI {
    private container: HTMLElement;
    private messageList: HTMLElement;
    private inputField: HTMLTextAreaElement;
    private sendButton: HTMLButtonElement;
    private loadingIndicator: HTMLElement;
    private callbacks: ChatUICallbacks;
    private isStreaming: boolean = false;

    constructor(container: HTMLElement, callbacks: ChatUICallbacks) {
        this.container = container;
        this.callbacks = callbacks;

        this.messageList = this.createMessageList();
        const inputContainer = this.createInputContainer();
        this.inputField = inputContainer.querySelector('textarea') as HTMLTextAreaElement;
        this.sendButton = inputContainer.querySelector('button') as HTMLButtonElement;
        this.loadingIndicator = this.createLoadingIndicator();

        this.container.appendChild(this.messageList);
        this.container.appendChild(this.loadingIndicator);
        this.container.appendChild(inputContainer);

        this.setupEventListeners();
    }

    private createMessageList(): HTMLElement {
        const list = document.createElement('div');
        list.className = 'message-list';
        list.setAttribute('role', 'log');
        list.setAttribute('aria-live', 'polite');
        list.setAttribute('aria-label', 'Chat messages');
        return list;
    }

    private createInputContainer(): HTMLElement {
        const container = document.createElement('div');
        container.className = 'input-container';

        const textarea = document.createElement('textarea');
        textarea.className = 'message-input';
        textarea.placeholder = 'Type your message...';
        textarea.rows = 1;
        textarea.setAttribute('aria-label', 'Message input');

        const button = document.createElement('button');
        button.className = 'send-button';
        button.textContent = 'Send';
        button.setAttribute('aria-label', 'Send message');

        container.appendChild(textarea);
        container.appendChild(button);

        return container;
    }

    private createLoadingIndicator(): HTMLElement {
        const indicator = document.createElement('div');
        indicator.className = 'loading-indicator hidden';
        indicator.setAttribute('role', 'status');
        indicator.setAttribute('aria-label', 'Loading');

        const spinner = document.createElement('div');
        spinner.className = 'spinner';

        const text = document.createElement('span');
        text.textContent = 'Thinking...';

        indicator.appendChild(spinner);
        indicator.appendChild(text);

        return indicator;
    }

    private setupEventListeners(): void {
        // Send button click
        this.sendButton.addEventListener('click', () => this.handleSend());

        // Keyboard shortcuts for sending messages
        // Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux) to send
        // Enter, Shift+Enter, Option+Enter, Ctrl+Enter (Mac) for newline
        this.inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                // Cmd+Enter on Mac or Ctrl+Enter on Windows/Linux sends the message
                if ((e.metaKey && !e.ctrlKey) || (e.ctrlKey && !e.metaKey && navigator.platform.indexOf('Mac') === -1)) {
                    e.preventDefault();
                    this.handleSend();
                }
                // All other Enter combinations (plain Enter, Shift+Enter, Option+Enter, Ctrl+Enter on Mac) insert newline
                // Default behavior handles newline insertion, so we don't need to prevent default
            }
        });

        // Auto-resize textarea
        this.inputField.addEventListener('input', () => {
            this.inputField.style.height = 'auto';
            this.inputField.style.height = Math.min(this.inputField.scrollHeight, 150) + 'px';
        });
    }

    private handleSend(): void {
        const content = this.inputField.value.trim();
        if (!content) return;

        // Cancel any ongoing stream
        if (this.isStreaming && this.callbacks.onCancelStream) {
            this.callbacks.onCancelStream();
        }

        this.callbacks.onSendMessage(content);
        this.inputField.value = '';
        this.inputField.style.height = 'auto';
        this.inputField.focus();
    }

    /**
     * Add a message to the chat
     */
    addMessage(message: Message): HTMLElement {
        const messageEl = document.createElement('div');
        messageEl.className = `message message-${message.role}`;
        messageEl.setAttribute('data-message-id', message.id);

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = message.role === 'user' ? '👤' : '🤖';

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'message-content-wrapper';

        const content = document.createElement('div');
        content.className = 'message-content';

        // Render markdown for assistant messages, plain text for user messages
        if (message.role === 'assistant') {
            content.innerHTML = MarkdownRenderer.render(message.content);
        } else {
            content.textContent = message.content;
        }

        const timestamp = document.createElement('div');
        timestamp.className = 'message-timestamp';
        timestamp.textContent = this.formatTimestamp(message.timestamp);

        contentWrapper.appendChild(content);
        contentWrapper.appendChild(timestamp);

        messageEl.appendChild(avatar);
        messageEl.appendChild(contentWrapper);

        this.messageList.appendChild(messageEl);
        this.scrollToBottom();

        return messageEl;
    }

    /**
     * Update an existing message (for streaming)
     */
    updateMessage(messageId: string, content: string, isAssistant: boolean = true): void {
        const messageEl = this.messageList.querySelector(`[data-message-id="${messageId}"]`);
        if (messageEl) {
            const contentEl = messageEl.querySelector('.message-content');
            if (contentEl) {
                // Render markdown incrementally for assistant messages
                if (isAssistant) {
                    contentEl.innerHTML = MarkdownRenderer.render(content);
                } else {
                    contentEl.textContent = content;
                }
                this.scrollToBottom();
            }
        }
    }

    /**
     * Show loading indicator
     */
    showLoading(): void {
        this.loadingIndicator.classList.remove('hidden');
        this.isStreaming = true;
        this.sendButton.textContent = 'Cancel';
        this.scrollToBottom();
    }

    /**
     * Hide loading indicator
     */
    hideLoading(): void {
        this.loadingIndicator.classList.add('hidden');
        this.isStreaming = false;
        this.sendButton.textContent = 'Send';
    }

    /**
     * Clear all messages
     */
    clearMessages(): void {
        this.messageList.innerHTML = '';
    }

    /**
     * Scroll to bottom of message list
     */
    private scrollToBottom(): void {
        requestAnimationFrame(() => {
            this.messageList.scrollTop = this.messageList.scrollHeight;
        });
    }

    /**
     * Format timestamp for display
     */
    private formatTimestamp(timestamp: number): string {
        const date = new Date(timestamp);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();

        if (isToday) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
                date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
    }

    /**
     * Get styles for the chat UI
     */
    static getStyles(): string {
        return `
            .message-list {
                flex: 1;
                overflow-y: auto;
                padding: 16px;
                display: flex;
                flex-direction: column;
                gap: 16px;
                scroll-behavior: smooth;
            }

            .message {
                display: flex;
                gap: 12px;
                animation: fadeIn 0.3s ease-in;
            }

            @keyframes fadeIn {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .message-avatar {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                flex-shrink: 0;
                background: #f3f4f6;
            }

            .message-user .message-avatar {
                background: #dbeafe;
            }

            .message-assistant .message-avatar {
                background: #f3e8ff;
            }

            .message-content-wrapper {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .message-content {
                padding: 12px 16px;
                border-radius: 12px;
                background: #f9fafb;
                color: #111827;
                line-height: 1.5;
                word-wrap: break-word;
                white-space: pre-wrap;
            }

            .message-user .message-content {
                background: #3b82f6;
                color: white;
            }

            .message-assistant .message-content {
                background: #f3f4f6;
                color: #111827;
                white-space: normal;
            }

            .message-timestamp {
                font-size: 11px;
                color: #9ca3af;
                padding: 0 4px;
            }

            .loading-indicator {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 12px 16px;
                margin: 0 16px;
                background: #f3f4f6;
                border-radius: 8px;
                font-size: 14px;
                color: #6b7280;
            }

            .loading-indicator.hidden {
                display: none;
            }

            .loading-indicator .spinner {
                width: 16px;
                height: 16px;
                border: 2px solid #e5e7eb;
                border-top-color: #3b82f6;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
            }

            .input-container {
                display: flex;
                gap: 8px;
                padding: 16px;
                border-top: 1px solid #e5e7eb;
                background: #ffffff;
            }

            .message-input {
                flex: 1;
                padding: 12px 16px;
                border: 1px solid #d1d5db;
                border-radius: 8px;
                font-family: inherit;
                font-size: 14px;
                resize: none;
                outline: none;
                transition: border-color 0.2s;
                min-height: 44px;
                max-height: 150px;
            }

            .message-input:focus {
                border-color: #3b82f6;
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
            }

            .send-button {
                padding: 12px 24px;
                background: #3b82f6;
                color: white;
                border: none;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                transition: background 0.2s;
                white-space: nowrap;
            }

            .send-button:hover {
                background: #2563eb;
            }

            .send-button:active {
                background: #1d4ed8;
            }

            .send-button:disabled {
                background: #9ca3af;
                cursor: not-allowed;
            }

            ${MarkdownRenderer.getStyles()}
        `;
    }
}
