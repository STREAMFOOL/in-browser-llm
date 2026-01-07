/**
 * Local AI Assistant Web Component
 * A privacy-first, browser-based conversational AI system
 * Requirements: 5.1, 5.2
 */

import { ChatUI, type Message } from './chat-ui';
import { GeminiController, type AISession } from './gemini-controller';

export class LocalAIAssistant extends HTMLElement {
    private shadow: ShadowRoot;
    private chatUI: ChatUI | null = null;
    private geminiController: GeminiController;
    private currentSession: AISession | null = null;
    private abortController: AbortController | null = null;
    private messageIdCounter = 0;

    constructor() {
        super();

        // Create closed Shadow DOM for style isolation
        this.shadow = this.attachShadow({ mode: 'closed' });
        this.geminiController = new GeminiController();

        this.initializeComponent();
    }

    private initializeComponent(): void {
        // Create basic structure
        const container = document.createElement('div');
        container.className = 'ai-assistant-container';

        // Add basic styles
        const style = document.createElement('style');
        style.textContent = `
      :host {
        display: block;
        width: 100%;
        height: 100%;
        font-family: system-ui, -apple-system, sans-serif;
      }
      
      .ai-assistant-container {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        background: #ffffff;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        overflow: hidden;
      }
      
      .ai-assistant-header {
        padding: 16px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-bottom: 1px solid #e0e0e0;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      
      .status-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #4ade80;
        animation: pulse 2s ease-in-out infinite;
      }
      
      @keyframes pulse {
        0%, 100% {
          opacity: 1;
          transform: scale(1);
        }
        50% {
          opacity: 0.5;
          transform: scale(1.2);
        }
      }
      
      .ai-assistant-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      
      .ai-assistant-footer {
        padding: 12px 16px;
        border-top: 1px solid #e0e0e0;
        background: #f9fafb;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: #6b7280;
      }
      
      .footer-icon {
        font-size: 14px;
      }

      ${ChatUI.getStyles()}
    `;

        // Create header
        const header = document.createElement('div');
        header.className = 'ai-assistant-header';

        const statusIndicator = document.createElement('div');
        statusIndicator.className = 'status-indicator';

        const headerText = document.createElement('span');
        headerText.textContent = 'Local AI Assistant';

        header.appendChild(statusIndicator);
        header.appendChild(headerText);

        // Create content area for chat
        const content = document.createElement('div');
        content.className = 'ai-assistant-content';

        // Initialize chat UI
        this.chatUI = new ChatUI(content, {
            onSendMessage: (message) => this.handleSendMessage(message),
            onCancelStream: () => this.handleCancelStream()
        });

        // Create footer
        const footer = document.createElement('div');
        footer.className = 'ai-assistant-footer';
        footer.innerHTML = '<span class="footer-icon">🔒</span> All processing happens locally on your device';

        // Assemble component
        container.appendChild(header);
        container.appendChild(content);
        container.appendChild(footer);

        this.shadow.appendChild(style);
        this.shadow.appendChild(container);

        // Initialize session
        this.initializeSession();
    }

    private async initializeSession(): Promise<void> {
        try {
            const availability = await this.geminiController.checkAvailability();

            if (availability.status === 'readily') {
                this.currentSession = await this.geminiController.createSession({
                    temperature: 0.7,
                    topK: 40
                });
                console.log('Gemini session initialized');

                // Show welcome message
                if (this.chatUI) {
                    const welcomeMessage: Message = {
                        id: `msg-${this.messageIdCounter++}`,
                        role: 'assistant',
                        content: '👋 Hello! I\'m your local AI assistant. All processing happens on your device for complete privacy. How can I help you today?',
                        timestamp: Date.now()
                    };
                    this.chatUI.addMessage(welcomeMessage);
                }
            } else if (availability.status === 'after-download') {
                console.warn('Gemini model downloading');

                // Show download message
                if (this.chatUI) {
                    const downloadMessage: Message = {
                        id: `msg-${this.messageIdCounter++}`,
                        role: 'assistant',
                        content: '⏳ **Model Downloading**\n\nThe AI model is currently being downloaded to your device. This may take a few minutes. Please wait...',
                        timestamp: Date.now()
                    };
                    this.chatUI.addMessage(downloadMessage);
                }
            } else {
                console.warn('Gemini model not available:', availability.status);

                // Show setup instructions
                if (this.chatUI) {
                    const setupMessage: Message = {
                        id: `msg-${this.messageIdCounter++}`,
                        role: 'assistant',
                        content: '⚠️ **AI Model Not Available**\n\nTo use this assistant, you need to enable Chrome\'s built-in AI:\n\n1. Open `chrome://flags`\n2. Search for "Prompt API for Gemini Nano"\n3. Enable the flag\n4. Restart Chrome\n\nNote: This feature requires Chrome 127 or higher.',
                        timestamp: Date.now()
                    };
                    this.chatUI.addMessage(setupMessage);
                }
            }
        } catch (error) {
            console.error('Failed to initialize session:', error);

            // Show error message
            if (this.chatUI) {
                const errorMessage: Message = {
                    id: `msg-${this.messageIdCounter++}`,
                    role: 'assistant',
                    content: `⚠️ **Initialization Error**\n\nFailed to initialize the AI model: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease refresh the page or check the console for more details.`,
                    timestamp: Date.now()
                };
                this.chatUI.addMessage(errorMessage);
            }
        }
    }

    private async handleSendMessage(content: string): Promise<void> {
        if (!this.chatUI) {
            console.error('Chat UI not initialized');
            return;
        }

        // Add user message first (always add to history)
        const userMessage: Message = {
            id: `msg-${this.messageIdCounter++}`,
            role: 'user',
            content,
            timestamp: Date.now()
        };
        this.chatUI.addMessage(userMessage);

        // Check if session is available
        if (!this.currentSession) {
            const errorMessage: Message = {
                id: `msg-${this.messageIdCounter++}`,
                role: 'assistant',
                content: '⚠️ **AI Model Not Available**\n\nThe Gemini Nano model is not currently available. This could be because:\n\n- Chrome built-in AI is not enabled in your browser\n- The model is still downloading\n- Your browser version doesn\'t support the Prompt API\n\nPlease check chrome://flags and enable "Prompt API for Gemini Nano".',
                timestamp: Date.now()
            };
            this.chatUI.addMessage(errorMessage);
            return;
        }

        // Show loading
        this.chatUI.showLoading();

        // Create assistant message placeholder
        const assistantMessage: Message = {
            id: `msg-${this.messageIdCounter++}`,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            isStreaming: true
        };
        this.chatUI.addMessage(assistantMessage);

        // Create abort controller for cancellation
        this.abortController = new AbortController();

        try {
            // Stream response
            let fullResponse = '';
            const stream = this.geminiController.promptStreaming(
                this.currentSession,
                content,
                this.abortController.signal
            );

            for await (const chunk of stream) {
                fullResponse = chunk; // Gemini returns full text each time
                this.chatUI.updateMessage(assistantMessage.id, fullResponse, true);
            }

            // Mark as complete
            this.chatUI.updateMessage(assistantMessage.id, fullResponse, false);

            // Hide loading when done
            this.chatUI.hideLoading();
        } catch (error) {
            this.chatUI.hideLoading();

            if (error instanceof Error && error.message === 'Stream cancelled') {
                // Update message to show it was cancelled
                this.chatUI.updateMessage(
                    assistantMessage.id,
                    assistantMessage.content || '⚠️ _Message cancelled by user_',
                    false
                );
            } else {
                console.error('Error during streaming:', error);
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                this.chatUI.updateMessage(
                    assistantMessage.id,
                    `⚠️ **Error: Failed to generate response**\n\n${errorMsg}\n\nPlease try again or check the console for more details.`,
                    false
                );
            }
        } finally {
            this.abortController = null;
        }
    }

    private handleCancelStream(): void {
        if (this.abortController) {
            this.abortController.abort();
            console.log('Stream cancelled by user');
        }
    }

    connectedCallback(): void {
        // Called when element is added to the DOM
        console.log('Local AI Assistant connected');
    }

    disconnectedCallback(): void {
        // Called when element is removed from the DOM
        console.log('Local AI Assistant disconnected');

        // Cleanup session
        if (this.currentSession) {
            this.geminiController.destroySession(this.currentSession);
        }
    }
}

// Register the custom element
if (!customElements.get('local-ai-assistant')) {
    customElements.define('local-ai-assistant', LocalAIAssistant);
}

