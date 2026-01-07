/**
 * Local AI Assistant Web Component
 * A privacy-first, browser-based conversational AI system
 * Requirements: 5.1, 5.2
 */

import { ChatUI, type Message } from './chat-ui';
import { GeminiController, type InitStep, type DetailedAvailability } from './gemini-controller';
import { ProviderManager } from './provider-manager';
import { ChromeProvider } from './chrome-provider';
import { WebLLMProvider } from './webllm-provider';
import type { ModelProvider, ChatSession } from './model-provider';

export class LocalAIAssistant extends HTMLElement {
    private shadow: ShadowRoot;
    private chatUI: ChatUI | null = null;
    private geminiController: GeminiController;
    private providerManager: ProviderManager;
    private activeProvider: ModelProvider | null = null;
    private currentSession: ChatSession | null = null;
    private abortController: AbortController | null = null;
    private messageIdCounter = 0;
    private initMessageId: string | null = null;

    constructor() {
        super();

        // Create closed Shadow DOM for style isolation
        this.shadow = this.attachShadow({ mode: 'closed' });
        this.geminiController = new GeminiController();

        // Initialize provider manager with fallback support
        this.providerManager = new ProviderManager();
        this.providerManager.registerProvider(new ChromeProvider());
        this.providerManager.registerProvider(new WebLLMProvider());

        this.initializeComponent();
    }

    private initializeComponent(): void {
        // Create basic structure
        const container = document.createElement('div');
        container.className = 'ai-assistant-container';

        // Add comprehensive styles including Tailwind equivalents for Shadow DOM
        const style = document.createElement('style');
        style.textContent = `
      :host {
        display: block;
        width: 100%;
        height: 100%;
        font-family: system-ui, -apple-system, sans-serif;
      }

      /* Container styles */
      .ai-assistant-container {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        background-color: white;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        overflow: hidden;
      }

      /* Header styles */
      .ai-assistant-header {
        padding: 1rem;
        background: linear-gradient(to bottom right, #6366f1, #9333ea);
        color: white;
        border-bottom: 1px solid #e5e7eb;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .status-indicator {
        width: 0.5rem;
        height: 0.5rem;
        border-radius: 9999px;
        background-color: #86efac;
        animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      }

      /* Content area */
      .ai-assistant-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      /* Footer styles */
      .ai-assistant-footer {
        padding: 0.75rem 1rem;
        border-top: 1px solid #e5e7eb;
        background-color: #f9fafb;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.75rem;
        color: #6b7280;
      }

      .footer-icon {
        font-size: 1rem;
      }

      /* Animations */
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

      @keyframes blink {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.3;
        }
      }

      @keyframes pulse {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.5;
        }
      }

      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }

      .animate-fadeIn {
        animation: fadeIn 0.3s ease-in;
      }

      .animate-blink {
        animation: blink 1.5s ease-in-out infinite;
      }

      .animate-pulse {
        animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      }

      .animate-spin {
        animation: spin 1s linear infinite;
      }

      /* ChatUI styles - comprehensive CSS for all chat elements */
      .message-list {
        flex: 1;
        overflow-y: auto;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        scroll-behavior: smooth;
        min-height: 0;
      }

      .message {
        display: flex;
        gap: 0.75rem;
        animation: fadeIn 0.3s ease-in;
      }

      .message-avatar {
        width: 2.25rem;
        height: 2.25rem;
        border-radius: 9999px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.25rem;
        flex-shrink: 0;
      }

      .message-avatar.user {
        background-color: #dbeafe;
      }

      .message-avatar.assistant {
        background-color: #f3e8ff;
      }

      .message-content-wrapper {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .message-content {
        padding: 0.75rem 1rem;
        border-radius: 0.75rem;
        line-height: 1.5;
        word-break: break-word;
      }

      .message-content.user {
        background-color: #3b82f6;
        color: white;
        white-space: pre-wrap;
      }

      .message-content.assistant {
        background-color: #f3f4f6;
        color: #111827;
        white-space: normal;
      }

      .message-timestamp {
        font-size: 0.6875rem;
        color: #9ca3af;
        padding: 0 0.25rem;
      }

      .input-container {
        display: flex;
        gap: 0.5rem;
        padding: 1rem;
        border-top: 1px solid #e5e7eb;
        background-color: white;
      }

      .message-input {
        flex: 1;
        padding: 0.75rem 1rem;
        border: 1px solid #d1d5db;
        border-radius: 0.5rem;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 0.875rem;
        resize: none;
        outline: none;
        transition: border-color 0.15s, box-shadow 0.15s;
        min-height: 44px;
        max-height: 150px;
      }

      .message-input:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }

      .send-button {
        padding: 0.75rem 1.5rem;
        background-color: #3b82f6;
        color: white;
        border: none;
        border-radius: 0.5rem;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.15s;
        white-space: nowrap;
      }

      .send-button:hover {
        background-color: #2563eb;
      }

      .send-button:active {
        background-color: #1d4ed8;
      }

      .send-button:disabled {
        background-color: #9ca3af;
        cursor: not-allowed;
      }

      .send-button:focus {
        outline: 2px solid #3b82f6;
        outline-offset: 2px;
      }

      .loading-indicator {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        margin: 0 1rem;
        background-color: #f3f4f6;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        color: #6b7280;
      }

      .loading-indicator.hidden {
        display: none;
      }

      .loading-spinner {
        width: 1rem;
        height: 1rem;
        border: 2px solid #e5e7eb;
        border-top-color: #3b82f6;
        border-radius: 9999px;
        animation: spin 1s linear infinite;
      }

      /* Markdown styles */
      .message-content h1,
      .message-content h2,
      .message-content h3,
      .message-content h4,
      .message-content h5,
      .message-content h6 {
        margin: 1rem 0 0.5rem 0;
        font-weight: 600;
        line-height: 1.25;
      }

      .message-content h1 { font-size: 1.875rem; }
      .message-content h2 { font-size: 1.5rem; }
      .message-content h3 { font-size: 1.25rem; }
      .message-content h4 { font-size: 1.125rem; }
      .message-content h5 { font-size: 1rem; }
      .message-content h6 { font-size: 0.875rem; }

      .message-content p {
        margin: 0.5rem 0;
      }

      .message-content pre {
        background-color: #1e1e1e;
        color: #d4d4d4;
        padding: 1rem;
        border-radius: 0.5rem;
        overflow-x: auto;
        margin: 0.75rem 0;
      }

      .message-content pre.incomplete {
        border-bottom: 2px dashed #3b82f6;
        position: relative;
      }

      .message-content pre code {
        background-color: transparent;
        padding: 0;
      }

      .message-content code {
        background-color: rgba(0, 0, 0, 0.05);
        padding: 0.125rem 0.375rem;
        border-radius: 0.25rem;
        font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
        font-size: 0.875rem;
      }

      .message-content ul,
      .message-content ol {
        margin: 0.5rem 0;
        padding-left: 1.5rem;
      }

      .message-content li {
        margin: 0.25rem 0;
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
        padding-left: 1rem;
        margin: 0.75rem 0;
        color: #6b7280;
      }
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
        if (!this.chatUI) return;

        // Show initialization message with steps
        this.initMessageId = `msg-${this.messageIdCounter++}`;
        const initMessage: Message = {
            id: this.initMessageId,
            role: 'assistant',
            content: this.renderInitializationStatus([], 'checking'),
            timestamp: Date.now()
        };
        this.chatUI.addMessage(initMessage);

        try {
            // First try Chrome's built-in AI
            const availability = await this.geminiController.checkDetailedAvailability();

            if (availability.status === 'readily') {
                // Chrome AI is ready - use it directly
                this.chatUI.updateMessage(
                    this.initMessageId,
                    this.renderInitializationStatus(availability.steps, 'success', availability),
                    true
                );

                // Use provider manager to get Chrome provider
                this.activeProvider = await this.providerManager.autoSelectProvider();
                if (this.activeProvider) {
                    this.currentSession = await this.activeProvider.createSession({
                        temperature: 0.7,
                        topK: 40
                    });
                    console.log('Chrome Gemini session initialized');

                    this.chatUI.updateMessage(
                        this.initMessageId,
                        '👋 Hello! I\'m your local AI assistant powered by Chrome\'s built-in AI. All processing happens on your device for complete privacy. How can I help you today?',
                        true
                    );
                }
            } else if (availability.status === 'after-download') {
                console.warn('Gemini model downloading');
                this.startModelDownload();
            } else {
                // Chrome AI not available - try WebLLM fallback
                console.warn('Chrome AI not available:', availability.reason, '- trying WebLLM fallback');
                await this.tryWebLLMFallback(availability);
            }
        } catch (error) {
            console.error('Failed to initialize session:', error);
            // Try WebLLM as fallback on any error
            await this.tryWebLLMFallback();
        }
    }

    private async tryWebLLMFallback(chromeAvailability?: DetailedAvailability): Promise<void> {
        if (!this.chatUI || !this.initMessageId) return;

        // Show that we're trying WebLLM
        const fallbackSteps: InitStep[] = [
            { id: 'chrome', label: 'Chrome AI not available', status: 'failed', error: chromeAvailability?.errorMessage || 'Not supported' },
            { id: 'webllm', label: 'Trying WebLLM fallback...', status: 'running' },
        ];

        this.chatUI.updateMessage(
            this.initMessageId,
            this.renderFallbackStatus(fallbackSteps, 'checking'),
            true
        );

        try {
            // Check WebLLM availability
            const webllmProvider = this.providerManager.getProvider('webllm');
            if (!webllmProvider) {
                throw new Error('WebLLM provider not registered');
            }

            const webllmAvailability = await webllmProvider.checkAvailability();

            if (!webllmAvailability.available) {
                fallbackSteps[1] = { id: 'webllm', label: 'WebLLM not available', status: 'failed', error: webllmAvailability.reason };
                this.chatUI.updateMessage(
                    this.initMessageId,
                    this.renderFallbackStatus(fallbackSteps, 'failed', chromeAvailability),
                    true
                );
                return;
            }

            // Initialize WebLLM with progress
            fallbackSteps[1] = { id: 'webllm', label: 'Initializing WebLLM...', status: 'running' };
            this.chatUI.updateMessage(
                this.initMessageId,
                this.renderFallbackStatus(fallbackSteps, 'downloading'),
                true
            );

            await webllmProvider.initialize();
            this.activeProvider = webllmProvider;
            this.currentSession = await webllmProvider.createSession({
                temperature: 0.7,
                topK: 40
            });

            fallbackSteps[1] = { id: 'webllm', label: 'WebLLM ready', status: 'passed' };

            console.log('WebLLM session initialized as fallback');
            this.chatUI.updateMessage(
                this.initMessageId,
                '👋 Hello! I\'m your local AI assistant powered by WebLLM. Chrome\'s built-in AI wasn\'t available, so I\'m using WebGPU instead. All processing still happens on your device for complete privacy. How can I help you today?',
                true
            );
        } catch (error) {
            console.error('WebLLM fallback failed:', error);
            fallbackSteps[1] = {
                id: 'webllm',
                label: 'WebLLM initialization failed',
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
            this.chatUI.updateMessage(
                this.initMessageId,
                this.renderFallbackStatus(fallbackSteps, 'failed', chromeAvailability),
                true
            );
        }
    }

    private renderFallbackStatus(
        steps: InitStep[],
        status: 'checking' | 'downloading' | 'failed',
        chromeAvailability?: DetailedAvailability
    ): string {
        const statusIcons: Record<InitStep['status'], string> = {
            pending: '⏳',
            running: '🔄',
            passed: '✅',
            failed: '❌',
            skipped: '⏭️'
        };

        let header = '🔄 **Trying Alternative AI Provider**';
        if (status === 'failed') {
            header = '⚠️ **No AI Provider Available**';
        } else if (status === 'downloading') {
            header = '📥 **Downloading WebLLM Model**';
        }

        const stepsList = steps.map(step => {
            const icon = statusIcons[step.status];
            let line = `- ${icon} ${step.label}`;
            if (step.error) {
                line += ` — _${step.error}_`;
            }
            return line;
        }).join('\n');

        let content = `${header}\n\n${stepsList}`;

        if (status === 'failed') {
            content += '\n\n---\n\n';
            content += this.getNoProviderGuide(chromeAvailability?.reason);
        }

        return content;
    }

    private getNoProviderGuide(chromeReason?: DetailedAvailability['reason']): string {
        let guide = `**No AI Provider Available**\n\n`;
        guide += `Neither Chrome's built-in AI nor WebLLM could be initialized.\n\n`;

        guide += `**Option 1: Enable Chrome AI**\n`;
        if (chromeReason === 'api-not-available' || chromeReason === 'flags-disabled') {
            guide += `1. Open \`chrome://flags\` in Chrome\n`;
            guide += `2. Enable \`#optimization-guide-on-device-model\` → **Enabled BypassPerfRequirement**\n`;
            guide += `3. Enable \`#prompt-api-for-gemini-nano\` → **Enabled**\n`;
            guide += `4. Click **Relaunch** to restart Chrome\n\n`;
        } else {
            guide += `Requires Google Chrome 138+ with experimental flags enabled.\n\n`;
        }

        guide += `**Option 2: Use WebLLM**\n`;
        guide += `WebLLM requires a browser with WebGPU support (Chrome, Edge, Firefox Nightly).\n`;
        guide += `Make sure your GPU drivers are up to date.\n`;

        return guide;
    }

    private async startModelDownload(): Promise<void> {
        if (!this.chatUI || !this.initMessageId) return;

        try {
            // Use provider manager to get Chrome provider and create session
            this.activeProvider = await this.providerManager.autoSelectProvider();
            if (this.activeProvider) {
                this.currentSession = await this.activeProvider.createSession({
                    temperature: 0.7,
                    topK: 40
                });

                // Download complete, show welcome
                this.chatUI.updateMessage(
                    this.initMessageId,
                    '👋 Hello! I\'m your local AI assistant. All processing happens on your device for complete privacy. How can I help you today?',
                    true
                );
            } else {
                // Chrome download failed, try WebLLM
                await this.tryWebLLMFallback();
            }
        } catch (error) {
            console.error('Failed to download model:', error);
            // Try WebLLM as fallback
            await this.tryWebLLMFallback();
        }
    }

    // Unused - kept for potential future use
    // private handleDownloadProgress(loaded: number, total: number): void {
    //     if (!this.chatUI || !this.initMessageId) return;

    //     const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
    //     const loadedMB = (loaded / (1024 * 1024)).toFixed(1);
    //     const totalMB = (total / (1024 * 1024)).toFixed(1);

    //     const steps: InitStep[] = [
    //         { id: 'browser', label: 'Browser compatibility', status: 'passed' },
    //         { id: 'api', label: 'Prompt API availability', status: 'passed' },
    //         { id: 'flags', label: 'Chrome flags enabled', status: 'passed' },
    //         { id: 'model', label: `Downloading model... ${loadedMB}MB / ${totalMB}MB (${percent}%)`, status: 'running' },
    //     ];

    //     this.chatUI.updateMessage(
    //         this.initMessageId,
    //         this.renderInitializationStatus(steps, 'downloading', undefined, percent),
    //         true
    //     );
    // }

    private renderInitializationStatus(
        steps: InitStep[],
        status: 'checking' | 'success' | 'failed' | 'downloading',
        availability?: DetailedAvailability,
        downloadPercent?: number
    ): string {
        const statusIcons: Record<InitStep['status'], string> = {
            pending: '⏳',
            running: '🔄',
            passed: '✅',
            failed: '❌',
            skipped: '⏭️'
        };

        // Default steps for initial checking state
        const displaySteps = steps.length > 0 ? steps : [
            { id: 'browser', label: 'Checking browser compatibility', status: 'running' as const },
            { id: 'api', label: 'Checking Prompt API availability', status: 'pending' as const },
            { id: 'flags', label: 'Verifying Chrome flags enabled', status: 'pending' as const },
            { id: 'model', label: 'Checking model status', status: 'pending' as const },
        ];

        let header = '🔧 **Initializing AI Assistant**';
        if (status === 'success') {
            header = '✅ **Initialization Complete**';
        } else if (status === 'failed') {
            header = '⚠️ **Initialization Failed**';
        } else if (status === 'downloading') {
            header = '📥 **Downloading AI Model**';
        }

        // Render steps as markdown list items (use - for proper list rendering)
        const stepsList = displaySteps.map(step => {
            const icon = statusIcons[step.status];
            let line = `- ${icon} ${step.label}`;
            if (step.error) {
                line += ` — _${step.error}_`;
            }
            return line;
        }).join('\n');

        let content = `${header}\n\n${stepsList}`;

        // Add progress bar for downloading
        if (status === 'downloading' && downloadPercent !== undefined) {
            const filled = Math.round(downloadPercent / 5);
            const empty = 20 - filled;
            const progressBar = `\n\n**Progress:** ${'█'.repeat(filled)}${'░'.repeat(empty)} ${downloadPercent}%`;
            content += progressBar;
        }

        // Add troubleshooting info for failures
        if (status === 'failed' && availability) {
            content += '\n\n---\n\n';
            content += this.getTroubleshootingGuide(availability.reason);
        }

        return content;
    }

    private getTroubleshootingGuide(reason: DetailedAvailability['reason']): string {
        switch (reason) {
            case 'unsupported-browser':
                return `**Browser Not Supported**

This feature requires **Google Chrome** (not Brave, Edge, or other Chromium browsers).

Please download and use Google Chrome version 138 or higher.`;

            case 'api-not-available':
                return `**Chrome AI APIs Not Found**

Your Chrome version may be too old or the APIs aren't available.

**Requirements:**

- Google Chrome 138 or higher

- macOS 13+ (Ventura), Windows 10/11, or Linux

To check your version, type \`chrome://version\` in the address bar.`;

            case 'flags-disabled':
                return `**Chrome Flags Not Enabled**

You need to enable the experimental AI features:

1. Open \`chrome://flags\` in Chrome

2. Search for and enable these flags:

- \`#optimization-guide-on-device-model\` → **Enabled**

- \`#prompt-api-for-gemini-nano\` → **Enabled**

3. Click **Relaunch** to restart Chrome

After restart, the model will begin downloading automatically.`;

            case 'model-downloading':
                return `**Model Downloading**

The AI model is being downloaded to your device. This is a one-time download of approximately 2GB.

Please wait for the download to complete. You can check progress at \`chrome://on-device-internals\`.`;

            case 'model-not-downloaded':
                return `**Model Not Available**

The model hasn't been downloaded yet.

**To trigger download:**

1. Go to \`chrome://on-device-internals\`

2. Check the **Model Status** tab for any errors

3. Make sure you have at least 22GB free disk space

4. Try restarting Chrome

If issues persist, try disabling and re-enabling the flags in \`chrome://flags\`.`;

            case 'error':
            default:
                return `**Unexpected Error**

Something went wrong during initialization.

**Try these steps:**

1. Refresh the page

2. Restart Chrome completely

3. Check \`chrome://on-device-internals\` for model status

4. Check the browser console for detailed error messages`;
        }
    }

    // Unused - kept for potential future use
    // private renderErrorMessage(error: string): string {
    //     return `⚠️ **Initialization Error**

    // ${error}

    // **Troubleshooting:**
    // 1. Refresh the page
    // 2. Check \`chrome://on-device-internals\` for model status
    // 3. Ensure Chrome flags are enabled in \`chrome://flags\`
    // 4. Check the browser console for more details`;
    // }

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
        if (!this.currentSession || !this.activeProvider) {
            const errorMessage: Message = {
                id: `msg-${this.messageIdCounter++}`,
                role: 'assistant',
                content: '⚠️ **AI Model Not Available**\n\nNo AI provider is currently available. This could be because:\n\n- Chrome built-in AI is not enabled in your browser\n- WebLLM couldn\'t initialize (WebGPU not available)\n- The model is still downloading\n\nPlease check the initialization status above for more details.',
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
            // Stream response using the active provider
            let fullResponse = '';
            const stream = this.activeProvider.promptStreaming(
                this.currentSession,
                content,
                this.abortController.signal
            );

            for await (const chunk of stream) {
                // For Chrome provider, it returns full text each time
                // For WebLLM, it returns deltas
                if (this.activeProvider.name === 'chrome-gemini') {
                    fullResponse = chunk;
                } else {
                    fullResponse += chunk;
                }
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

        // Cleanup session and provider
        if (this.currentSession && this.activeProvider) {
            this.activeProvider.destroySession(this.currentSession);
        }

        // Dispose provider manager
        this.providerManager.dispose();
    }
}

// Register the custom element
if (!customElements.get('local-ai-assistant')) {
    customElements.define('local-ai-assistant', LocalAIAssistant);
}

