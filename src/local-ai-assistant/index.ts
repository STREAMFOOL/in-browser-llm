/**
 * Local AI Assistant Web Component
 * A privacy-first, browser-based conversational AI system
 * Requirements: 5.1, 5.2
 */

import { ChatUI, type Message } from '../chat-ui';
import { GeminiController, type InitStep, type DetailedAvailability } from '../gemini-controller';
import { ProviderManager } from '../provider-manager';
import { ChromeProvider } from '../chrome-provider';
import { WebLLMProvider } from '../webllm-provider';
import type { ModelProvider, ChatSession } from '../model-provider';
import { ErrorHandler, ErrorCategory } from '../error-handler';
import { RecoveryManager } from '../recovery-manager';
import { SettingsUI, type SettingsConfig } from '../settings-ui';
import { StorageManager } from '../storage-manager';
import { HardwareDiagnostics, type HardwareProfile, type Feature } from '../hardware-diagnostics';
import { ThreadListUI } from '../thread-list-ui';
import { getTroubleshootingGuide } from './troubleshoot';
import { generateThreadTitle } from './utils';
import { getMainStyles } from './styles';

export class LocalAIAssistant extends HTMLElement {
  private shadow: ShadowRoot;
  private chatUI: ChatUI | null = null;
  private settingsUI: SettingsUI | null = null;
  private threadListUI: ThreadListUI | null = null;
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
  private currentThreadId: string | null = null;
  private headerText: HTMLElement | null = null;
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
    style.textContent = getMainStyles()

    // Create header
    const header = document.createElement('div');
    header.className = 'ai-assistant-header';

    const statusIndicator = document.createElement('div');
    statusIndicator.className = 'status-indicator';

    // Create thread toggle button
    const threadToggleButton = document.createElement('button');
    threadToggleButton.className = 'thread-toggle-button';
    threadToggleButton.innerHTML = '☰';
    threadToggleButton.title = 'Conversations';
    threadToggleButton.setAttribute('aria-label', 'Toggle conversation list');
    threadToggleButton.addEventListener('click', () => this.toggleThreadList());

    this.headerText = document.createElement('span');
    this.headerText.textContent = 'Ask Ai Assistant Locally';

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
    header.appendChild(threadToggleButton);
    header.appendChild(this.headerText);
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

    // Create thread list sidebar
    const threadListSidebar = document.createElement('div');
    threadListSidebar.className = 'thread-list-sidebar';
    threadListSidebar.setAttribute('data-thread-list', 'true');

    // Initialize thread list UI
    this.threadListUI = new ThreadListUI(threadListSidebar, {
      onThreadSelect: (threadId) => this.handleThreadSelect(threadId),
      onThreadDelete: (threadId) => this.handleThreadDelete(threadId),
      onNewThread: () => this.handleNewThread()
    });

    // Create footer
    const footer = document.createElement('div');
    footer.className = 'ai-assistant-footer';
    footer.innerHTML = '<span class="footer-icon">🔒</span> All processing happens locally on your device';

    // Assemble component
    container.appendChild(threadListSidebar);
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
    console.debug('enter tryWebLLMFallback, chromeAvailability=', chromeAvailability);
    if (!this.chatUI || !this.initMessageId) return;

    // 
    console.debug('show that we trying WebLLM');
    const fallbackSteps: InitStep[] = [
      { id: 'chrome', label: 'Chrome AI not available', status: 'failed', error: chromeAvailability?.errorMessage || 'Not supported' },
      { id: 'webllm', label: 'Trying WebLLM fallback...', status: 'running' },
    ];

    console.debug('updateMessage checking fallback=', fallbackSteps);
    this.chatUI.updateMessage(
      this.initMessageId,
      this.renderFallbackStatus(fallbackSteps, 'checking'),
      true
    );

    try {
      console.debug('check webllm provider');
      const webllmProvider = this.providerManager.getProvider('webllm');
      if (!webllmProvider) {
        throw new Error('WebLLM provider not registered');
      }

      console.debug('check webllm availability');
      const webllmAvailability = await webllmProvider.checkAvailability();
      console.log('WebLLM availability check result:', webllmAvailability);

      if (!webllmAvailability.available) {
        fallbackSteps[1] = { id: 'webllm', label: 'WebLLM not available', status: 'failed', error: webllmAvailability.reason };
        this.chatUI.updateMessage(
          this.initMessageId,
          this.renderFallbackStatus(fallbackSteps, 'failed', chromeAvailability),
          true
        );
        console.warn('WebLLM unavailable. Reason:', webllmAvailability.reason);
        return;
      }

      console.debug('initialize WebLLM with progress monitoring');
      fallbackSteps[1] = { id: 'webllm', label: 'Initializing WebLLM...', status: 'running' };
      this.chatUI.updateMessage(
        this.initMessageId,
        this.renderFallbackStatus(fallbackSteps, 'downloading'),
        true
      );

      const timestamp = Date.now()
      const progressInterval = setInterval(() => {
        let timespan = Date.now() - timestamp
        console.debug(`${timespan} millis monitoring WebLLM initialization`);
        if (!this.chatUI || !this.initMessageId) {
          clearInterval(progressInterval);
          return;
        }

        const progress = webllmProvider.getProgress();
        if (progress) {
          const percentage = progress.percentage || 0;
          const phase = progress.phase || 'downloading';
          const currentFile = progress.currentFile || '';

          fallbackSteps[1] = {
            id: 'webllm',
            label: `${phase === 'downloading' ? 'Downloading' : 'Loading'} WebLLM model... ${percentage}%`,
            status: 'running',
            error: currentFile
          };

          this.chatUI.updateMessage(
            this.initMessageId,
            this.renderFallbackStatus(fallbackSteps, 'downloading'),
            true
          );
        }
      }, 500);

      try {
        console.debug('initializing WebLLM');
        await webllmProvider.initialize();
        clearInterval(progressInterval);

        this.activeProvider = webllmProvider;
        this.currentSession = await webllmProvider.createSession({
          temperature: 0.7,
          topK: 40
        });

        fallbackSteps[1] = { id: 'webllm', label: 'WebLLM ready', status: 'passed' };
      } catch (initError) {
        console.error(initError, 'ERROR while initializing WebLLM');
        clearInterval(progressInterval);
        throw initError;
      }

      console.debug('Update provider indicator');
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
      content += getTroubleshootingGuide(availability.reason);
    }

    return content;
  }

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

    // Save user message to thread
    await this.saveMessageToThread(userMessage);

    // Check if session is available
    if (!this.currentSession || !this.activeProvider) {
      const errorMessage: Message = {
        id: `msg-${this.messageIdCounter++}`,
        role: 'assistant',
        content: '⚠️ **AI Model Not Available**\n\nNo AI provider is currently available. This could be because:\n\n- Chrome built-in AI is not enabled in your browser\n- WebLLM couldn\'t initialize (WebGPU not available)\n- The model is still downloading\n\nPlease check the initialization status above for more details.',
        timestamp: Date.now()
      };
      this.chatUI.addMessage(errorMessage);
      await this.saveMessageToThread(errorMessage);
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

      // Mark as complete (keep as assistant message for markdown rendering)
      this.chatUI.updateMessage(assistantMessage.id, fullResponse, true);

      // Update assistant message content and save to thread
      assistantMessage.content = fullResponse;
      assistantMessage.isStreaming = false;
      await this.saveMessageToThread(assistantMessage);

      // Hide loading when done
      this.chatUI.hideLoading();
    } catch (error) {
      this.chatUI.hideLoading();

      if (error instanceof Error && error.message === 'Stream cancelled') {
        // Update message to show it was cancelled (keep markdown rendering)
        const cancelledContent = assistantMessage.content || '⚠️ _Message cancelled by user_';
        this.chatUI.updateMessage(
          assistantMessage.id,
          cancelledContent,
          true
        );
        assistantMessage.content = cancelledContent;
        assistantMessage.isStreaming = false;
        await this.saveMessageToThread(assistantMessage);
      } else {
        // Use ErrorHandler to process the error
        const category = ErrorHandler.detectErrorCategory(error);
        const errorContext = ErrorHandler.handleError(error, category);
        const errorMessage = ErrorHandler.formatErrorMessage(errorContext);

        this.chatUI.updateMessage(
          assistantMessage.id,
          errorMessage,
          true
        );

        assistantMessage.content = errorMessage;
        assistantMessage.isStreaming = false;
        await this.saveMessageToThread(assistantMessage);

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

  /**
   * Generate a unique thread ID using UUID v4
   * Requirements: 4.4, 13.2
   */
  private generateThreadId(): string {
    // UUID v4 implementation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }


  /**
   * Create a new thread
   * Requirements: 4.4, 13.2, 13.5
   */
  private async createNewThread(firstMessage?: string): Promise<string> {
    const threadId = this.generateThreadId();
    const now = Date.now();

    const thread: import('../storage-manager').Thread = {
      id: threadId,
      title: firstMessage ? generateThreadTitle(firstMessage) : 'New Conversation',
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      settings: {
        temperature: this.currentSettings.temperature,
        topK: this.currentSettings.topK,
        systemPrompt: '',
        enabledFeatures: this.currentSettings.enabledFeatures
      }
    };

    await this.storageManager.createThread(thread);
    this.currentThreadId = threadId;

    console.log('Created new thread:', threadId);
    return threadId;
  }

  /**
   * Save a message to the current thread
   * Requirements: 4.1
   */
  private async saveMessageToThread(message: Message): Promise<void> {
    if (!this.currentThreadId) {
      // Create a new thread if none exists
      await this.createNewThread(message.role === 'user' ? message.content : undefined);
    }

    const storageMessage: import('../storage-manager').Message = {
      id: message.id,
      threadId: this.currentThreadId!,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
      attachments: [],
      metadata: {}
    };

    await this.storageManager.saveMessage(this.currentThreadId!, storageMessage);
  }

  /**
   * Toggle thread list sidebar
   * Requirements: 13.1
   */
  private async toggleThreadList(): Promise<void> {
    if (!this.threadListUI) return;

    // Load threads from storage
    const threads = await this.storageManager.listThreads();

    // Render thread list
    this.threadListUI.render(threads, this.currentThreadId);

    // Toggle visibility
    this.threadListUI.toggle();
  }

  /**
   * Handle thread selection
   * Requirements: 13.3
   */
  private async handleThreadSelect(threadId: string): Promise<void> {
    if (!this.chatUI || !this.threadListUI) return;

    // Close thread list
    this.threadListUI.close();

    // Load thread data to get the title
    const thread = await this.storageManager.getThread(threadId);

    // Update header with thread title
    if (this.headerText && thread) {
      this.headerText.textContent = thread.title;
    }

    // Load thread messages
    const messages = await this.storageManager.loadThread(threadId);

    // Clear current chat
    this.chatUI.clearMessages();

    // Display messages in chronological order (filter out system messages)
    messages.forEach(msg => {
      // Skip system messages as they're not displayed in chat
      if (msg.role === 'system') return;

      const chatMessage: Message = {
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: msg.timestamp
      };
      this.chatUI!.addMessage(chatMessage);
    });

    // Update current thread ID
    this.currentThreadId = threadId;

    console.log('Loaded thread:', threadId, 'with', messages.length, 'messages');
  }

  /**
   * Handle thread deletion
   * Requirements: 13.4
   */
  private async handleThreadDelete(threadId: string): Promise<void> {
    if (!this.chatUI || !this.threadListUI) return;

    try {
      // Delete thread from storage
      await this.storageManager.deleteThread(threadId);

      // If this was the current thread, clear the chat and create a new thread
      if (threadId === this.currentThreadId) {
        this.chatUI.clearMessages();
        this.currentThreadId = null;

        // Reset header text to default
        if (this.headerText) {
          this.headerText.textContent = 'Ask Ai Assistant Locally';
        }

        // Show welcome message
        const welcomeMessage: Message = {
          id: `msg-${this.messageIdCounter++}`,
          role: 'assistant',
          content: '👋 Hello! I\'m your local AI assistant. How can I help you today?',
          timestamp: Date.now()
        };
        this.chatUI.addMessage(welcomeMessage);
      }

      // Refresh thread list
      const threads = await this.storageManager.listThreads();
      this.threadListUI.render(threads, this.currentThreadId);

      console.log('Deleted thread:', threadId);
    } catch (error) {
      console.error('Failed to delete thread:', error);

      if (this.chatUI) {
        const errorMessage: Message = {
          id: `msg-${this.messageIdCounter++}`,
          role: 'assistant',
          content: `⚠️ **Failed to delete conversation**: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: Date.now()
        };
        this.chatUI.addMessage(errorMessage);
      }
    }
  }

  /**
   * Handle new thread creation
   * Requirements: 13.2
   */
  private async handleNewThread(): Promise<void> {
    if (!this.chatUI || !this.threadListUI) return;

    // Close thread list
    this.threadListUI.close();

    // Clear current chat
    this.chatUI.clearMessages();

    // Reset current thread ID (will be created on first message)
    this.currentThreadId = null;

    // Reset header text to default
    if (this.headerText) {
      this.headerText.textContent = 'Ask Ai Assistant Locally';
    }

    // Show welcome message
    const welcomeMessage: Message = {
      id: `msg-${this.messageIdCounter++}`,
      role: 'assistant',
      content: '👋 Hello! I\'m your local AI assistant. How can I help you today?',
      timestamp: Date.now()
    };
    this.chatUI.addMessage(welcomeMessage);

    console.log('Started new thread');
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

