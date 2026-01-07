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
import { ErrorHandler, ErrorCategory } from './error-handler';
import { RecoveryManager } from './recovery-manager';
import { SettingsUI, type SettingsConfig } from './settings-ui';
import { StorageManager } from './storage-manager';
import { HardwareDiagnostics, type HardwareProfile, type Feature } from './hardware-diagnostics';

export class LocalAIAssistant extends HTMLElement {
  private shadow: ShadowRoot;
  private chatUI: ChatUI | null = null;
  private settingsUI: SettingsUI | null = null;
  private geminiController: GeminiController;
  private providerManager: ProviderManager;
  private recoveryManager: RecoveryManager;
  private storageManager: StorageManager;
  private activeProvider: ModelProvider | null = null;
  private currentSession: ChatSession | null = null;
  private abortController: AbortController | null = null;
  private messageIdCounter = 0;
  private initMessageId: string | null = null;
  private hardwareProfile: HardwareProfile | null = null;
  private currentSettings: SettingsConfig = {
    temperature: 0.7,
    topK: 40,
    enabledFeatures: ['text-chat']
  };

  constructor() {
    super();

    // Create closed Shadow DOM for style isolation
    this.shadow = this.attachShadow({ mode: 'closed' });
    this.geminiController = new GeminiController();
    this.storageManager = new StorageManager();

    // Initialize provider manager with fallback support
    this.providerManager = new ProviderManager();
    this.providerManager.registerProvider(new ChromeProvider());
    this.providerManager.registerProvider(new WebLLMProvider());

    // Initialize recovery manager
    this.recoveryManager = new RecoveryManager({
      onGPURecovery: async () => {
        await this.handleGPURecovery();
      },
      onApplicationReset: async () => {
        await this.handleApplicationReset();
      }
    });

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

      .provider-indicator {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.75rem;
        font-weight: 500;
        padding: 0.375rem 0.75rem;
        border-radius: 0.375rem;
        background-color: rgba(255, 255, 255, 0.2);
      }

      .provider-indicator.local {
        background-color: rgba(134, 239, 172, 0.3);
      }

      .provider-indicator.api {
        background-color: rgba(251, 191, 36, 0.3);
      }

      .provider-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
      }

      .privacy-warning {
        font-size: 0.875rem;
        color: #fbbf24;
      }

      .settings-button {
        background: none;
        border: none;
        color: white;
        font-size: 1.25rem;
        cursor: pointer;
        padding: 0.5rem;
        border-radius: 0.375rem;
        transition: background-color 0.15s;
      }

      .settings-button:hover {
        background-color: rgba(255, 255, 255, 0.2);
      }

      .settings-button:focus {
        outline: 2px solid white;
        outline-offset: 2px;
      }

      /* Settings panel */
      .settings-panel {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: white;
        z-index: 1000;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .settings-panel.hidden {
        display: none;
      }

      .settings-header {
        padding: 1rem;
        background: linear-gradient(to bottom right, #6366f1, #9333ea);
        color: white;
        border-bottom: 1px solid #e5e7eb;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .settings-close {
        background: none;
        border: none;
        color: white;
        font-size: 1.5rem;
        cursor: pointer;
        padding: 0.25rem 0.5rem;
        border-radius: 0.375rem;
        transition: background-color 0.15s;
      }

      .settings-close:hover {
        background-color: rgba(255, 255, 255, 0.2);
      }

      .settings-content {
        flex: 1;
        overflow-y: auto;
        padding: 1.5rem;
      }

      .settings-section {
        margin-bottom: 2rem;
      }

      .settings-section-title {
        font-size: 1.125rem;
        font-weight: 600;
        margin-bottom: 1rem;
        color: #111827;
      }

      .provider-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .provider-item {
        padding: 1rem;
        border: 2px solid #e5e7eb;
        border-radius: 0.5rem;
        cursor: pointer;
        transition: all 0.15s;
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .provider-item:hover {
        border-color: #6366f1;
        background-color: #f9fafb;
      }

      .provider-item.active {
        border-color: #6366f1;
        background-color: #eff6ff;
      }

      .provider-item.unavailable {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .provider-item.unavailable:hover {
        border-color: #e5e7eb;
        background-color: white;
      }

      .provider-icon {
        font-size: 1.5rem;
        flex-shrink: 0;
      }

      .provider-details {
        flex: 1;
      }

      .provider-name {
        font-weight: 600;
        color: #111827;
        margin-bottom: 0.25rem;
      }

      .provider-description {
        font-size: 0.875rem;
        color: #6b7280;
      }

      .provider-status {
        font-size: 0.75rem;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        font-weight: 500;
      }

      .provider-status.available {
        background-color: #d1fae5;
        color: #065f46;
      }

      .provider-status.unavailable {
        background-color: #fee2e2;
        color: #991b1b;
      }

      .provider-status.active {
        background-color: #dbeafe;
        color: #1e40af;
      }

      /* Reset button styles */
      .reset-button {
        width: 100%;
        padding: 0.75rem 1rem;
        background-color: #ef4444;
        color: white;
        border: none;
        border-radius: 0.5rem;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.15s;
        margin-top: 0.75rem;
      }

      .reset-button:hover {
        background-color: #dc2626;
      }

      .reset-button:active {
        background-color: #b91c1c;
      }

      .reset-description {
        font-size: 0.875rem;
        color: #6b7280;
        line-height: 1.5;
      }

      /* Hardware diagnostics styles */
      .hardware-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 0.75rem;
        margin-bottom: 1rem;
      }

      .hardware-card {
        padding: 1rem;
        border: 2px solid #e5e7eb;
        border-radius: 0.5rem;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        position: relative;
      }

      .hardware-card.good {
        border-color: #10b981;
        background-color: #f0fdf4;
      }

      .hardware-card.warning {
        border-color: #f59e0b;
        background-color: #fffbeb;
      }

      .hardware-card.poor {
        border-color: #ef4444;
        background-color: #fef2f2;
      }

      .hardware-icon {
        font-size: 1.5rem;
        flex-shrink: 0;
      }

      .hardware-details {
        flex: 1;
        min-width: 0;
      }

      .hardware-label {
        font-size: 0.75rem;
        color: #6b7280;
        font-weight: 500;
        margin-bottom: 0.25rem;
      }

      .hardware-value {
        font-size: 1rem;
        font-weight: 600;
        color: #111827;
      }

      .hardware-indicator {
        font-size: 1.25rem;
        flex-shrink: 0;
      }

      .hardware-indicator.good {
        color: #10b981;
      }

      .hardware-indicator.warning {
        color: #f59e0b;
      }

      .hardware-indicator.poor {
        color: #ef4444;
      }

      .performance-info {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1rem;
        background-color: #f3f4f6;
        border-radius: 0.5rem;
        font-size: 0.875rem;
      }

      .perf-label {
        color: #6b7280;
        font-weight: 500;
      }

      .perf-score {
        color: #111827;
        font-weight: 600;
      }

      /* Slider control styles */
      .slider-control {
        margin-bottom: 1.5rem;
      }

      .slider-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
      }

      .slider-label {
        font-weight: 600;
        color: #111827;
        font-size: 0.875rem;
      }

      .slider-value {
        font-weight: 600;
        color: #3b82f6;
        font-size: 0.875rem;
      }

      .slider {
        width: 100%;
        height: 6px;
        border-radius: 3px;
        background: #e5e7eb;
        outline: none;
        -webkit-appearance: none;
        appearance: none;
      }

      .slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #3b82f6;
        cursor: pointer;
        transition: background-color 0.15s;
      }

      .slider::-webkit-slider-thumb:hover {
        background: #2563eb;
      }

      .slider::-moz-range-thumb {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #3b82f6;
        cursor: pointer;
        border: none;
        transition: background-color 0.15s;
      }

      .slider::-moz-range-thumb:hover {
        background: #2563eb;
      }

      .slider-description {
        font-size: 0.75rem;
        color: #6b7280;
        margin-top: 0.5rem;
        line-height: 1.4;
      }

      /* Feature toggle styles */
      .feature-toggle {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        margin-bottom: 0.75rem;
        transition: background-color 0.15s;
      }

      .feature-toggle:hover {
        background-color: #f9fafb;
      }

      .feature-toggle.disabled {
        opacity: 0.6;
        background-color: #f9fafb;
      }

      .feature-details {
        flex: 1;
      }

      .feature-label {
        font-weight: 600;
        color: #111827;
        margin-bottom: 0.25rem;
      }

      .feature-description {
        font-size: 0.75rem;
        color: #6b7280;
        line-height: 1.4;
      }

      .feature-warning {
        color: #f59e0b;
        font-weight: 500;
        margin-top: 0.25rem;
      }

      /* Toggle switch styles */
      .switch {
        position: relative;
        display: inline-block;
        width: 48px;
        height: 24px;
        flex-shrink: 0;
      }

      .switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }

      .switch-slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #d1d5db;
        transition: 0.3s;
        border-radius: 24px;
      }

      .switch-slider:before {
        position: absolute;
        content: "";
        height: 18px;
        width: 18px;
        left: 3px;
        bottom: 3px;
        background-color: white;
        transition: 0.3s;
        border-radius: 50%;
      }

      .switch input:checked + .switch-slider {
        background-color: #3b82f6;
      }

      .switch input:checked + .switch-slider:before {
        transform: translateX(24px);
      }

      .switch input:disabled + .switch-slider {
        cursor: not-allowed;
        opacity: 0.5;
      }

      /* Action button styles */
      .action-button {
        width: 100%;
        padding: 0.75rem 1rem;
        border: none;
        border-radius: 0.5rem;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.15s;
        margin-top: 0.75rem;
        font-size: 0.875rem;
      }

      .action-button.secondary {
        background-color: #6b7280;
        color: white;
      }

      .action-button.secondary:hover {
        background-color: #4b5563;
      }

      .action-button.danger {
        background-color: #ef4444;
        color: white;
      }

      .action-button.danger:hover {
        background-color: #dc2626;
      }

      .action-button.danger:active {
        background-color: #b91c1c;
      }

      .action-description {
        font-size: 0.875rem;
        color: #6b7280;
        line-height: 1.5;
        margin-top: 0.5rem;
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

    // Create provider indicator
    const providerIndicator = document.createElement('div');
    providerIndicator.className = 'provider-indicator';
    providerIndicator.setAttribute('data-provider-indicator', 'true');
    providerIndicator.style.display = 'none'; // Hidden until provider is initialized

    // Create settings button
    const settingsButton = document.createElement('button');
    settingsButton.className = 'settings-button';
    settingsButton.innerHTML = '⚙️';
    settingsButton.title = 'Settings';
    settingsButton.setAttribute('aria-label', 'Open settings');
    settingsButton.addEventListener('click', () => this.toggleSettings());

    header.appendChild(statusIndicator);
    header.appendChild(headerText);
    header.appendChild(providerIndicator);
    header.appendChild(settingsButton);

    // Create content area for chat
    const content = document.createElement('div');
    content.className = 'ai-assistant-content';

    // Initialize chat UI
    this.chatUI = new ChatUI(content, {
      onSendMessage: (message) => this.handleSendMessage(message),
      onCancelStream: () => this.handleCancelStream()
    });

    // Create settings panel
    const settingsPanel = this.createSettingsPanel();

    // Create footer
    const footer = document.createElement('div');
    footer.className = 'ai-assistant-footer';
    footer.innerHTML = '<span class="footer-icon">🔒</span> All processing happens locally on your device';

    // Assemble component
    container.appendChild(header);
    container.appendChild(content);
    container.appendChild(settingsPanel);
    container.appendChild(footer);

    this.shadow.appendChild(style);
    this.shadow.appendChild(container);

    // Initialize session
    this.initializeSession();
  }

  /**
   * Create the settings panel
   * Requirements: 16.8, 18.5, 18.8, 6.1, 6.2, 6.3, 6.4, 12.1, 12.2, 12.5
   */
  private createSettingsPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'settings-panel hidden';
    panel.setAttribute('data-settings-panel', 'true');

    // Header
    const header = document.createElement('div');
    header.className = 'settings-header';

    const title = document.createElement('span');
    title.textContent = 'Settings';

    const closeButton = document.createElement('button');
    closeButton.className = 'settings-close';
    closeButton.innerHTML = '×';
    closeButton.setAttribute('aria-label', 'Close settings');
    closeButton.addEventListener('click', () => this.toggleSettings());

    header.appendChild(title);
    header.appendChild(closeButton);

    // Content (will be populated by SettingsUI)
    const content = document.createElement('div');
    content.className = 'settings-content';

    panel.appendChild(header);
    panel.appendChild(content);

    return panel;
  }

  /**
   * Toggle settings panel visibility
   */
  private toggleSettings(): void {
    const panel = this.shadow.querySelector('[data-settings-panel]') as HTMLElement;
    if (!panel) return;

    const isHidden = panel.classList.contains('hidden');
    if (isHidden) {
      // Show settings and populate provider list
      panel.classList.remove('hidden');
      this.populateProviderList();
    } else {
      // Hide settings
      panel.classList.add('hidden');
    }
  }

  /**
   * Populate the provider list in settings
   * Requirements: 16.8, 18.5, 18.8, 6.1, 6.2, 6.3, 6.4, 12.1, 12.2
   */
  private async populateProviderList(): Promise<void> {
    const settingsContent = this.shadow.querySelector('.settings-content') as HTMLElement;
    if (!settingsContent) return;

    // Show loading
    settingsContent.innerHTML = '<div style="text-align: center; padding: 2rem; color: #6b7280;">Loading settings...</div>';

    try {
      // Detect all providers
      const providers = await this.providerManager.detectProviders();

      // Clear loading
      settingsContent.innerHTML = '';

      // Initialize SettingsUI if not already done
      if (!this.settingsUI) {
        this.settingsUI = new SettingsUI(
          settingsContent,
          {
            onProviderSwitch: async (providerName: string) => {
              await this.switchProvider(providerName);
            },
            onSettingsChange: (config: SettingsConfig) => {
              this.handleSettingsChange(config);
            },
            onClearData: async () => {
              await this.clearAllData();
            },
            onResetApplication: async () => {
              await this.resetApplication();
            }
          },
          this.currentSettings
        );
      }

      // Render the settings UI
      await this.settingsUI.render(providers, this.activeProvider?.name || null);
    } catch (error) {
      console.error('Failed to populate settings:', error);
      settingsContent.innerHTML = '<div style="text-align: center; padding: 2rem; color: #ef4444;">Failed to load settings</div>';
    }
  }

  /**
   * Switch to a different provider
   * Requirements: 16.8
   */
  private async switchProvider(providerName: string): Promise<void> {
    const settingsContent = this.shadow.querySelector('.settings-content') as HTMLElement;
    if (!settingsContent) return;

    try {
      // Show loading state
      settingsContent.style.opacity = '0.5';
      settingsContent.style.pointerEvents = 'none';

      // Destroy current session
      if (this.currentSession && this.activeProvider) {
        await this.activeProvider.destroySession(this.currentSession);
        this.currentSession = null;
      }

      // Switch provider
      await this.providerManager.setActiveProvider(providerName);
      this.activeProvider = this.providerManager.getActiveProvider();

      // Create new session with current settings
      if (this.activeProvider) {
        this.currentSession = await this.activeProvider.createSession({
          temperature: this.currentSettings.temperature,
          topK: this.currentSettings.topK
        });

        // Update provider indicator
        this.updateProviderIndicator(this.activeProvider);

        // Add system message about provider switch
        if (this.chatUI) {
          const switchMessage: Message = {
            id: `msg-${this.messageIdCounter++}`,
            role: 'assistant',
            content: `✅ Switched to **${this.activeProvider.description}**. All future messages will use this provider.`,
            timestamp: Date.now()
          };
          this.chatUI.addMessage(switchMessage);
        }
      }

      // Refresh settings UI
      await this.populateProviderList();

      // Restore state
      settingsContent.style.opacity = '1';
      settingsContent.style.pointerEvents = 'auto';
    } catch (error) {
      console.error('Failed to switch provider:', error);
      settingsContent.style.opacity = '1';
      settingsContent.style.pointerEvents = 'auto';

      // Show error message
      if (this.chatUI) {
        const errorMessage: Message = {
          id: `msg-${this.messageIdCounter++}`,
          role: 'assistant',
          content: `⚠️ **Failed to switch provider**: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: Date.now()
        };
        this.chatUI.addMessage(errorMessage);
      }
    }
  }

  /**
   * Handle settings changes
   * Requirements: 12.1, 6.5, 6.6
   */
  private async handleSettingsChange(config: SettingsConfig): Promise<void> {
    console.log('Settings changed:', config);

    // Requirement 6.5, 6.6: Validate enabled features against hardware capabilities
    if (this.hardwareProfile) {
      const invalidFeatures: Feature[] = [];
      for (const feature of config.enabledFeatures) {
        if (!HardwareDiagnostics.canSupport(feature, this.hardwareProfile)) {
          invalidFeatures.push(feature);
        }
      }

      // Remove features that don't meet hardware requirements
      if (invalidFeatures.length > 0) {
        config.enabledFeatures = config.enabledFeatures.filter(
          f => !invalidFeatures.includes(f)
        );

        // Show warning message
        if (this.chatUI) {
          const warningMessage: Message = {
            id: `msg-${this.messageIdCounter++}`,
            role: 'assistant',
            content: `⚠️ **Hardware Limitation**\n\nThe following features were disabled due to insufficient hardware:\n\n${invalidFeatures.map(f => `- ${f}`).join('\n')}\n\nPlease check the hardware requirements in settings.`,
            timestamp: Date.now()
          };
          this.chatUI.addMessage(warningMessage);
        }
      }
    }

    this.currentSettings = config;

    // Recreate session with new parameters if provider is active
    if (this.activeProvider && this.currentSession) {
      try {
        await this.activeProvider.destroySession(this.currentSession);
        this.currentSession = await this.activeProvider.createSession({
          temperature: config.temperature,
          topK: config.topK
        });
        console.log('Session recreated with new settings');
      } catch (error) {
        console.error('Failed to apply settings:', error);
      }
    }

    // Persist settings to storage
    try {
      await this.storageManager.saveSetting('modelParameters', {
        temperature: config.temperature,
        topK: config.topK
      });
      await this.storageManager.saveSetting('enabledFeatures', config.enabledFeatures);
    } catch (error) {
      console.error('Failed to persist settings:', error);
    }
  }

  /**
   * Clear all data
   * Requirement 12.5
   */
  private async clearAllData(): Promise<void> {
    try {
      console.log('Clearing all data...');
      await this.storageManager.clearAllData();

      if (this.chatUI) {
        const successMessage: Message = {
          id: `msg-${this.messageIdCounter++}`,
          role: 'assistant',
          content: '✅ **All data cleared successfully**\n\nAll conversations, cached models, and settings have been deleted.',
          timestamp: Date.now()
        };
        this.chatUI.addMessage(successMessage);
      }

      // Close settings panel
      this.toggleSettings();
    } catch (error) {
      console.error('Failed to clear data:', error);

      if (this.chatUI) {
        const errorMessage: Message = {
          id: `msg-${this.messageIdCounter++}`,
          role: 'assistant',
          content: `⚠️ **Failed to clear data**: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: Date.now()
        };
        this.chatUI.addMessage(errorMessage);
      }
    }
  }

  private async initializeSession(): Promise<void> {
    if (!this.chatUI) return;

    // Detect hardware capabilities first
    // Requirement 6.1, 6.2, 6.3, 6.4
    try {
      this.hardwareProfile = await HardwareDiagnostics.detectCapabilities();
      console.log('Hardware profile detected:', this.hardwareProfile);

      // Requirement 6.5, 6.6: Filter enabled features based on hardware
      const supportedFeatures = this.currentSettings.enabledFeatures.filter(
        feature => HardwareDiagnostics.canSupport(feature, this.hardwareProfile!)
      );

      if (supportedFeatures.length < this.currentSettings.enabledFeatures.length) {
        const unsupportedFeatures = this.currentSettings.enabledFeatures.filter(
          f => !supportedFeatures.includes(f)
        );
        console.warn('Some features disabled due to hardware limitations:', unsupportedFeatures);
        this.currentSettings.enabledFeatures = supportedFeatures;
      }
    } catch (error) {
      console.error('Failed to detect hardware capabilities:', error);
    }

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

          // Update provider indicator
          this.updateProviderIndicator(this.activeProvider);

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

      // Update provider indicator
      this.updateProviderIndicator(this.activeProvider);

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

    // Detect browser
    const userAgent = navigator.userAgent.toLowerCase();
    const isChrome = userAgent.includes('chrome') && !userAgent.includes('edg') && !userAgent.includes('brave');
    const isBrave = userAgent.includes('brave') || (navigator as any).brave !== undefined;
    const isFirefox = userAgent.includes('firefox');
    const isEdge = userAgent.includes('edg');
    const isSafari = userAgent.includes('safari') && !userAgent.includes('chrome');

    // Browser-specific instructions
    if (isChrome) {
      guide += `**You're using Chrome - Enable Built-in AI**\n\n`;
      if (chromeReason === 'api-not-available' || chromeReason === 'flags-disabled') {
        guide += `1. Open \`chrome://flags\` in Chrome\n`;
        guide += `2. Enable \`#optimization-guide-on-device-model\` → **Enabled BypassPerfRequirement**\n`;
        guide += `3. Enable \`#prompt-api-for-gemini-nano\` → **Enabled**\n`;
        guide += `4. Click **Relaunch** to restart Chrome\n\n`;
      } else {
        guide += `Requires Google Chrome 138+ with experimental flags enabled.\n`;
        guide += `Visit \`chrome://flags\` to enable the required flags.\n\n`;
      }
    } else if (isBrave || isFirefox || isEdge) {
      const browserName = isBrave ? 'Brave' : isFirefox ? 'Firefox' : 'Edge';
      guide += `**You're using ${browserName} - Enable WebGPU**\n\n`;
      guide += `WebLLM requires WebGPU support:\n\n`;

      if (isBrave) {
        guide += `1. Open \`brave://flags\` in Brave\n`;
        guide += `2. Search for "WebGPU"\n`;
        guide += `3. Enable \`#enable-unsafe-webgpu\` → **Enabled**\n`;
        guide += `4. Click **Relaunch** to restart Brave\n\n`;
      } else if (isFirefox) {
        guide += `1. Open \`about:config\` in Firefox\n`;
        guide += `2. Search for "dom.webgpu.enabled"\n`;
        guide += `3. Set it to **true**\n`;
        guide += `4. Restart Firefox\n\n`;
        guide += `Note: WebGPU support in Firefox is experimental.\n\n`;
      } else if (isEdge) {
        guide += `1. Open \`edge://flags\` in Edge\n`;
        guide += `2. Search for "WebGPU"\n`;
        guide += `3. Enable \`#enable-unsafe-webgpu\` → **Enabled**\n`;
        guide += `4. Click **Restart** to restart Edge\n\n`;
      }

      guide += `**Alternative: Use Chrome**\n\n`;
      guide += `For the best experience, use Google Chrome 138+ with built-in AI enabled.\n\n`;
    } else if (isSafari) {
      guide += `**Safari is not currently supported**\n\n`;
      guide += `Safari does not support the required APIs for local AI inference.\n\n`;
      guide += `**Recommended Browsers:**\n`;
      guide += `- **Google Chrome 138+** (with built-in AI)\n`;
      guide += `- **Brave** (with WebGPU enabled)\n`;
      guide += `- **Firefox** (with WebGPU enabled)\n`;
      guide += `- **Microsoft Edge** (with WebGPU enabled)\n\n`;
    } else {
      guide += `**Browser Not Recognized**\n\n`;
      guide += `This browser may not support the required APIs.\n\n`;
      guide += `**Recommended Browsers:**\n`;
      guide += `- **Google Chrome 138+** (with built-in AI)\n`;
      guide += `- **Brave** (with WebGPU enabled)\n`;
      guide += `- **Firefox** (with WebGPU enabled)\n`;
      guide += `- **Microsoft Edge** (with WebGPU enabled)\n\n`;
    }

    guide += `**System Requirements:**\n`;
    guide += `- At least 22GB free disk space\n`;
    guide += `- WebGPU-capable GPU (for WebLLM)\n`;
    guide += `- Up-to-date GPU drivers\n`;

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

        // Update provider indicator
        this.updateProviderIndicator(this.activeProvider);

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

  /**
   * Update the provider indicator in the header
   * Requirements: 16.7
   */
  private updateProviderIndicator(provider: ModelProvider): void {
    const indicator = this.shadow.querySelector('[data-provider-indicator]') as HTMLElement;
    if (!indicator) return;

    // Show the indicator
    indicator.style.display = 'flex';

    // Clear previous content
    indicator.innerHTML = '';

    // Add provider badge
    const badge = document.createElement('span');
    badge.className = 'provider-badge';

    // Add icon based on provider type
    const icon = document.createElement('span');
    if (provider.type === 'local') {
      icon.textContent = '🔒';
      indicator.classList.add('local');
      indicator.classList.remove('api');
    } else {
      icon.textContent = '🌐';
      indicator.classList.add('api');
      indicator.classList.remove('local');
    }

    const name = document.createElement('span');
    name.textContent = provider.description;

    badge.appendChild(icon);
    badge.appendChild(name);
    indicator.appendChild(badge);

    // Add privacy warning for API providers (except local Ollama)
    if (provider.type === 'api') {
      const warning = document.createElement('span');
      warning.className = 'privacy-warning';
      warning.textContent = '⚠️';
      warning.title = 'External API - data sent to third party';
      indicator.appendChild(warning);
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
        // Use ErrorHandler to process the error
        const category = ErrorHandler.detectErrorCategory(error);
        const errorContext = ErrorHandler.handleError(error, category);
        const errorMessage = ErrorHandler.formatErrorMessage(errorContext);

        this.chatUI.updateMessage(
          assistantMessage.id,
          errorMessage,
          false
        );

        // If it's a GPU context loss, attempt recovery
        if (category === ErrorCategory.GPU_CONTEXT_LOSS) {
          await this.recoveryManager.handleGPUContextLoss('inference-error');
        }
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

  /**
   * Handle GPU recovery after context loss
   * Requirements: 15.5
   */
  private async handleGPURecovery(): Promise<void> {
    console.log('Handling GPU recovery...');

    if (!this.chatUI) return;

    // Show recovery message
    const recoveryMessage: Message = {
      id: `msg-${this.messageIdCounter++}`,
      role: 'assistant',
      content: '🔄 **GPU Recovery in Progress**\n\nThe GPU connection was lost and is being reinitialized. Please wait...',
      timestamp: Date.now()
    };
    this.chatUI.addMessage(recoveryMessage);

    try {
      // Reinitialize the active provider if it uses GPU
      if (this.activeProvider && this.activeProvider.name === 'webllm') {
        await this.activeProvider.dispose();
        await this.activeProvider.initialize({});

        // Recreate session
        if (this.currentSession) {
          this.currentSession = await this.activeProvider.createSession({
            temperature: 0.7,
            topK: 40
          });
        }
      }

      // Show success message
      const successMessage: Message = {
        id: `msg-${this.messageIdCounter++}`,
        role: 'assistant',
        content: '✅ **GPU Recovery Successful**\n\nThe GPU has been reinitialized. You can continue using the assistant.',
        timestamp: Date.now()
      };
      this.chatUI.addMessage(successMessage);
    } catch (error) {
      console.error('GPU recovery failed:', error);

      // Show failure message with reset option
      const failureMessage: Message = {
        id: `msg-${this.messageIdCounter++}`,
        role: 'assistant',
        content: '⚠️ **GPU Recovery Failed**\n\nThe GPU could not be reinitialized. You may need to reset the application or restart your browser.',
        timestamp: Date.now()
      };
      this.chatUI.addMessage(failureMessage);
    }
  }

  /**
   * Handle application reset
   * Requirements: 15.6
   */
  private async handleApplicationReset(): Promise<void> {
    console.log('Application reset initiated');
    // The recovery manager will handle the actual reset
  }

  /**
   * Trigger application reset (called from UI)
   * Requirements: 15.6
   */
  async resetApplication(): Promise<void> {
    if (!confirm('Are you sure you want to reset the application? This will clear all data and reload the page.')) {
      return;
    }

    await this.recoveryManager.resetApplication();
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

