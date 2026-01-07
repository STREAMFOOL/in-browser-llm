

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
    private privacyWarning: HTMLElement | null = null;
    private callbacks: ChatUICallbacks;
    private isStreaming: boolean = false;
    private userHasScrolledUp: boolean = false;

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

        // Track user scroll behavior
        list.addEventListener('scroll', () => {
            const isNearBottom = this.isScrolledNearBottom();
            this.userHasScrolledUp = !isNearBottom;
        });

        return list;
    }

    private createInputContainer(): HTMLElement {
        const container = document.createElement('div');
        container.className = 'input-container';

        const textarea = document.createElement('textarea');
        textarea.className = 'message-input';
        textarea.placeholder = 'Type your message here. Enter adds new line, cmd+enter submits';
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
        spinner.className = 'loading-spinner';

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

        // Reset scroll tracking when user sends a message
        this.forceScrollToBottom();
    }


    addMessage(message: Message): HTMLElement {
        const messageEl = document.createElement('div');
        messageEl.className = 'message animate-fadeIn';
        messageEl.setAttribute('data-message-id', message.id);

        const avatar = document.createElement('div');
        avatar.className = `message-avatar ${message.role}`;
        avatar.textContent = message.role === 'user' ? '👤' : '🤖';

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'message-content-wrapper';

        const content = document.createElement('div');
        content.className = `message-content ${message.role}`;

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
        this.forceScrollToBottom();

        return messageEl;
    }


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


    showLoading(): void {
        this.loadingIndicator.classList.remove('hidden');
        this.isStreaming = true;
        this.sendButton.textContent = 'Cancel';
        this.forceScrollToBottom();
    }


    hideLoading(): void {
        this.loadingIndicator.classList.add('hidden');
        this.isStreaming = false;
        this.sendButton.textContent = 'Send';
    }


    clearMessages(): void {
        this.messageList.innerHTML = '';
    }


    private isScrolledNearBottom(): boolean {
        const threshold = 100;
        const scrollTop = this.messageList.scrollTop;
        const scrollHeight = this.messageList.scrollHeight;
        const clientHeight = this.messageList.clientHeight;
        return scrollHeight - scrollTop - clientHeight < threshold;
    }


    private scrollToBottom(): void {
        // Don't auto-scroll if user has intentionally scrolled up
        if (this.userHasScrolledUp) {
            return;
        }

        requestAnimationFrame(() => {
            this.messageList.scrollTop = this.messageList.scrollHeight;
        });
    }


    private forceScrollToBottom(): void {
        this.userHasScrolledUp = false;
        requestAnimationFrame(() => {
            this.messageList.scrollTop = this.messageList.scrollHeight;
        });
    }


    showPrivacyWarning(): void {
        if (this.privacyWarning) {
            this.privacyWarning.classList.remove('hidden');
            return;
        }

        this.privacyWarning = document.createElement('div');
        this.privacyWarning.className = 'privacy-warning';
        this.privacyWarning.setAttribute('role', 'alert');

        const icon = document.createElement('span');
        icon.className = 'privacy-warning-icon';
        icon.textContent = '⚠️';

        const text = document.createElement('span');
        text.className = 'privacy-warning-text';
        text.textContent = 'External API Active: Your messages are being sent to an external service. For privacy, use a local provider.';

        this.privacyWarning.appendChild(icon);
        this.privacyWarning.appendChild(text);

        // Insert before message list
        this.container.insertBefore(this.privacyWarning, this.messageList);
    }


    hidePrivacyWarning(): void {
        if (this.privacyWarning) {
            this.privacyWarning.classList.add('hidden');
        }
    }


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
}
