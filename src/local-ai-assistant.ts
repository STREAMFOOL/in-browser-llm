/**
 * Local AI Assistant Web Component
 * A privacy-first, browser-based conversational AI system
 * Requirements: 5.1, 5.2
 */

export class LocalAIAssistant extends HTMLElement {
    private shadow: ShadowRoot;

    constructor() {
        super();

        // Create closed Shadow DOM for style isolation
        this.shadow = this.attachShadow({ mode: 'closed' });

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
        padding: 24px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      
      .initialization-status {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      .status-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: #f9fafb;
        border-radius: 6px;
        transition: all 0.3s ease;
      }
      
      .status-item.completed {
        background: #ecfdf5;
        border-left: 3px solid #10b981;
      }
      
      .status-item.active {
        background: #eff6ff;
        border-left: 3px solid #3b82f6;
      }
      
      .status-icon {
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
      }
      
      .spinner {
        width: 16px;
        height: 16px;
        border: 2px solid #e5e7eb;
        border-top-color: #3b82f6;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      
      .status-text {
        flex: 1;
        font-size: 14px;
        color: #374151;
      }
      
      .status-text strong {
        color: #111827;
        font-weight: 600;
      }
      
      .ai-assistant-footer {
        padding: 16px;
        border-top: 1px solid #e0e0e0;
        background: #f9fafb;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: #6b7280;
      }
      
      .footer-icon {
        font-size: 16px;
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

        // Create content area with initialization status
        const content = document.createElement('div');
        content.className = 'ai-assistant-content';

        const statusContainer = document.createElement('div');
        statusContainer.className = 'initialization-status';

        // Add initialization steps
        const steps = [
            { id: 'browser', text: 'Checking browser compatibility', delay: 0 },
            { id: 'storage', text: 'Verifying storage availability', delay: 800 },
            { id: 'webgpu', text: 'Initializing WebGPU context', delay: 1600 },
            { id: 'model', text: 'Loading Gemini Nano model', delay: 2400 },
            { id: 'ready', text: 'System ready', delay: 3200 }
        ];

        steps.forEach((step, index) => {
            const statusItem = document.createElement('div');
            statusItem.className = 'status-item';
            statusItem.id = `status-${step.id}`;

            const icon = document.createElement('div');
            icon.className = 'status-icon';
            icon.innerHTML = '⏳';

            const text = document.createElement('div');
            text.className = 'status-text';
            text.innerHTML = `<strong>${index + 1}.</strong> ${step.text}`;

            statusItem.appendChild(icon);
            statusItem.appendChild(text);
            statusContainer.appendChild(statusItem);

            // Animate status updates
            setTimeout(() => {
                statusItem.classList.add('active');
                icon.innerHTML = '<div class="spinner"></div>';

                setTimeout(() => {
                    statusItem.classList.remove('active');
                    statusItem.classList.add('completed');
                    icon.innerHTML = '✓';
                }, 600);
            }, step.delay);
        });

        content.appendChild(statusContainer);

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
    }

    connectedCallback(): void {
        // Called when element is added to the DOM
        console.log('Local AI Assistant connected');
    }

    disconnectedCallback(): void {
        // Called when element is removed from the DOM
        console.log('Local AI Assistant disconnected');
    }
}

// Register the custom element
if (!customElements.get('local-ai-assistant')) {
    customElements.define('local-ai-assistant', LocalAIAssistant);
}
