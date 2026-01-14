

import { MarkdownRenderer } from './markdown-renderer';
import { SearchIndicator } from './search-indicator';
import { notify } from './notification-api';
import { VoiceInputUI, type VoiceInputCallbacks } from './voice-input-ui';
import { AudioPlaybackUI } from './audio-playback-ui';
import { InferenceWorkerManager } from '../core/inference-worker-manager';

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
    private searchIndicator: SearchIndicator;
    private voiceInputUI: VoiceInputUI | null = null;
    private audioPlaybackUI: AudioPlaybackUI | null = null;
    private privacyWarning: HTMLElement | null = null;
    private inputOverlay: HTMLElement | null = null;
    private callbacks: ChatUICallbacks;
    private isStreaming: boolean = false;
    private userHasScrolledUp: boolean = false;
    private isInputEnabled: boolean = true;
    private voiceOutputEnabled: boolean = false;

    constructor(container: HTMLElement, callbacks: ChatUICallbacks, workerManager?: InferenceWorkerManager) {
        this.container = container;
        this.callbacks = callbacks;

        this.messageList = this.createMessageList();
        const inputContainer = this.createInputContainer(workerManager);
        this.inputField = inputContainer.querySelector('textarea') as HTMLTextAreaElement;
        this.sendButton = inputContainer.querySelector('button[aria-label="Send message"]') as HTMLButtonElement;
        this.loadingIndicator = this.createLoadingIndicator();
        this.searchIndicator = new SearchIndicator(this.messageList);

        // Initialize audio playback UI if worker manager is provided
        if (workerManager) {
            this.audioPlaybackUI = new AudioPlaybackUI(this.messageList, workerManager);
        }

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

    private createInputContainer(workerManager?: InferenceWorkerManager): HTMLElement {
        const container = document.createElement('div');
        container.className = 'input-container';
        container.style.position = 'relative';

        const textarea = document.createElement('textarea');
        textarea.className = 'message-input';
        textarea.placeholder = 'Type your message here. Enter adds new line, cmd+enter submits';
        textarea.rows = 1;
        textarea.setAttribute('aria-label', 'Message input');

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'flex items-center gap-2';

        // Add voice input button if worker manager is provided
        if (workerManager) {
            const voiceInputCallbacks: VoiceInputCallbacks = {
                onTranscription: (text: string) => {
                    // Insert transcription into input field
                    const currentValue = textarea.value;
                    textarea.value = currentValue ? `${currentValue} ${text}` : text;
                    textarea.focus();

                    // Trigger auto-resize
                    textarea.style.height = 'auto';
                    textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
                }
            };

            this.voiceInputUI = new VoiceInputUI(buttonContainer, voiceInputCallbacks, workerManager);
        }

        const button = document.createElement('button');
        button.className = 'send-button';
        button.textContent = 'Send';
        button.setAttribute('aria-label', 'Send message');

        buttonContainer.appendChild(button);

        container.appendChild(textarea);
        container.appendChild(buttonContainer);

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
        if (!this.isInputEnabled) return;

        const content = this.inputField.value.trim();
        if (!content) return;

        // Cancel any ongoing stream
        if (this.isStreaming && this.callbacks.onCancelStream) {
            this.callbacks.onCancelStream();
        }

        try {
            this.callbacks.onSendMessage(content);
            this.inputField.value = '';
            this.inputField.style.height = 'auto';
            this.inputField.focus();

            // Reset scroll tracking when user sends a message
            this.forceScrollToBottom();
        } catch (error) {
            notify({
                type: 'error',
                title: 'Message Send Failed',
                message: `Unable to send message: ${error instanceof Error ? error.message : String(error)}`
            });
        }
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

    /**
     * Show the search indicator during active search
     */
    showSearchIndicator(): void {
        this.searchIndicator.show();
    }

    /**
     * Hide the search indicator when search completes
     */
    hideSearchIndicator(): void {
        this.searchIndicator.hide();
    }

    /**
     * Check if search indicator is visible
     */
    isSearchIndicatorVisible(): boolean {
        return this.searchIndicator.isVisible();
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

    /**
     * Show error notification for message send failures
     */
    showSendError(error: Error | string): void {
        const errorMessage = error instanceof Error ? error.message : String(error);
        notify({
            type: 'error',
            title: 'Message Send Failed',
            message: `Unable to send message: ${errorMessage}. Please try again.`
        });
    }

    /**
     * Show error notification for streaming errors
     */
    showStreamingError(error: Error | string): void {
        const errorMessage = error instanceof Error ? error.message : String(error);
        notify({
            type: 'error',
            title: 'Streaming Error',
            message: `Message streaming interrupted: ${errorMessage}. The response may be incomplete.`
        });
    }

    /**
     * Show error notification for general chat errors
     */
    showChatError(title: string, error: Error | string): void {
        const errorMessage = error instanceof Error ? error.message : String(error);
        notify({
            type: 'error',
            title,
            message: errorMessage
        });
    }

    /**
     * Disable input with an overlay message
     */
    disableInput(reason: 'feature-disabled' | 'error', customMessage?: string): void {
        this.isInputEnabled = false;
        this.inputField.disabled = true;
        this.sendButton.disabled = true;

        // Apply disabled styling
        this.inputField.style.opacity = '0.5';
        this.inputField.style.cursor = 'not-allowed';
        this.sendButton.style.opacity = '0.5';
        this.sendButton.style.cursor = 'not-allowed';

        // Create overlay if it doesn't exist
        if (!this.inputOverlay) {
            this.inputOverlay = document.createElement('div');
            this.inputOverlay.className = 'input-overlay';
            this.inputOverlay.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(2px);
                border-radius: 0.5rem;
                z-index: 10;
                pointer-events: none;
            `;

            const inputContainer = this.inputField.parentElement;
            if (inputContainer) {
                inputContainer.appendChild(this.inputOverlay);
            }
        }

        // Set overlay message
        const message = customMessage || (reason === 'feature-disabled'
            ? '💬 Text chat is disabled. Enable it in Settings to start chatting.'
            : '⚠️ Chat is temporarily unavailable due to an error.');

        const messageEl = document.createElement('div');
        messageEl.className = 'overlay-message';
        messageEl.style.cssText = `
            padding: 0.75rem 1rem;
            background: ${reason === 'feature-disabled' ? '#eff6ff' : '#fef2f2'};
            border: 1px solid ${reason === 'feature-disabled' ? '#bfdbfe' : '#fecaca'};
            border-radius: 0.5rem;
            color: ${reason === 'feature-disabled' ? '#1e40af' : '#991b1b'};
            font-size: 0.875rem;
            text-align: center;
            max-width: 90%;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        `;
        messageEl.textContent = message;

        this.inputOverlay.innerHTML = '';
        this.inputOverlay.appendChild(messageEl);
        this.inputOverlay.style.display = 'flex';
    }

    /**
     * Enable input and remove overlay
     */
    enableInput(): void {
        this.isInputEnabled = true;
        this.inputField.disabled = false;
        this.sendButton.disabled = false;

        // Remove disabled styling
        this.inputField.style.opacity = '1';
        this.inputField.style.cursor = 'text';
        this.sendButton.style.opacity = '1';
        this.sendButton.style.cursor = 'pointer';

        // Hide overlay
        if (this.inputOverlay) {
            this.inputOverlay.style.display = 'none';
        }
    }

    /**
     * Check if input is currently enabled
     */
    isInputCurrentlyEnabled(): boolean {
        return this.isInputEnabled;
    }

    /**
     * Clean up resources
     */
    cleanup(): void {
        if (this.voiceInputUI) {
            this.voiceInputUI.cleanup();
        }
        if (this.audioPlaybackUI) {
            this.audioPlaybackUI.cleanupWorker();
        }
    }

    /**
     * Enable voice output for assistant responses
     */
    enableVoiceOutput(): void {
        this.voiceOutputEnabled = true;
    }

    /**
     * Disable voice output for assistant responses
     */
    disableVoiceOutput(): void {
        this.voiceOutputEnabled = false;
        if (this.audioPlaybackUI) {
            this.audioPlaybackUI.cleanup();
        }
    }

    /**
     * Check if voice output is enabled
     */
    isVoiceOutputEnabled(): boolean {
        return this.voiceOutputEnabled;
    }

    /**
     * Play text as speech (for assistant responses)
     */
    async playTextAsSpeech(text: string): Promise<void> {
        if (!this.voiceOutputEnabled || !this.audioPlaybackUI) {
            return;
        }

        await this.audioPlaybackUI.playText(text);
    }
}
