import { ChatUI, type Message } from '../ui/chat-ui';
import { GeminiController } from '../providers/gemini-controller';
import { ProviderManager } from '../providers/provider-manager';
import { ChromeProvider } from '../providers/chrome-provider';
import { WebLLMProvider } from '../providers/webllm-provider';
import type { ModelProvider, ChatSession } from '../providers/model-provider';
import { ErrorHandler, ErrorCategory } from '../utils/error-handler';
import { RecoveryManager } from '../core/recovery-manager';
import { type SettingsConfig } from '../ui/settings-ui';
import { StorageManager } from '../storage/storage-manager';
import { HardwareDiagnostics, type HardwareProfile, type Feature } from '../utils/hardware-diagnostics';
import { getMainStyles } from '../styles/index';
import { SettingsPanel } from './settings';
import { ThreadManager } from './thread-manager';
import { SessionManager } from './session-manager';

export class LocalAIAssistant extends HTMLElement {
  private shadow: ShadowRoot;
  private chatUI: ChatUI | null = null;
  private settingsPanel: SettingsPanel | null = null;
  private threadManager: ThreadManager | null = null;
  private sessionManager: SessionManager | null = null;
  private geminiController: GeminiController;
  private providerManager: ProviderManager;
  private recoveryManager: RecoveryManager;
  private storageManager: StorageManager;
  private abortController: AbortController | null = null;
  private messageIdCounter = 0;
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

    // Initialize session manager
    this.sessionManager = new SessionManager(
      this.geminiController,
      this.providerManager,
      {
        onInitMessage: (message) => this.handleInitMessage(message),
        onUpdateInitMessage: (messageId, content) => this.handleUpdateInitMessage(messageId, content),
        onProviderReady: (provider) => this.handleProviderReady(provider),
        onSessionCreated: (session) => this.handleSessionCreated(session),
        onHardwareProfileDetected: (profile) => this.handleHardwareProfileDetected(profile),
        onFeaturesFiltered: (supported, unsupported) => this.handleFeaturesFiltered(supported, unsupported)
      },
      this.messageIdCounter
    );

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

    // Initialize settings panel
    this.settingsPanel = new SettingsPanel(
      this.shadow,
      this.providerManager,
      this.storageManager,
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
        },
        onShowMessage: (message: Message) => {
          if (this.chatUI) {
            this.chatUI.addMessage(message);
          }
        }
      },
      this.currentSettings,
      this.sessionManager?.getHardwareProfile() || null
    );

    // Create settings panel DOM
    const settingsPanel = this.settingsPanel.createPanel();

    // Create thread list sidebar
    const threadListSidebar = document.createElement('div');
    threadListSidebar.className = 'thread-list-sidebar';
    threadListSidebar.setAttribute('data-thread-list', 'true');

    // Initialize thread manager
    this.threadManager = new ThreadManager(this.storageManager, {
      onThreadSwitch: (threadId, messages) => this.handleThreadSwitch(threadId, messages),
      onThreadDelete: (threadId) => this.handleThreadDeleteCallback(threadId),
      onNewThread: () => this.handleNewThreadCallback(),
      onThreadCreated: (threadId) => this.handleThreadCreated(threadId)
    });
    this.threadManager.initializeUI(threadListSidebar);

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
    if (this.sessionManager) {
      this.sessionManager.initialize({
        temperature: this.currentSettings.temperature,
        topK: this.currentSettings.topK,
        enabledFeatures: this.currentSettings.enabledFeatures
      });
    }
  }

  private toggleSettings(): void {
    if (this.settingsPanel) {
      this.settingsPanel.toggle();
    }
  }

  private async toggleThreadList(): Promise<void> {
    if (this.threadManager) {
      await this.threadManager.toggleThreadList();
    }
  }

  private async switchProvider(providerName: string): Promise<void> {
    try {
      if (!this.sessionManager) return;

      await this.sessionManager.switchProvider(providerName, {
        temperature: this.currentSettings.temperature,
        topK: this.currentSettings.topK,
        enabledFeatures: this.currentSettings.enabledFeatures
      });

      const provider = this.sessionManager.getActiveProvider();
      if (provider && this.chatUI) {
        const switchMessage: Message = {
          id: `msg-${this.messageIdCounter++}`,
          role: 'assistant',
          content: `✅ Switched to **${provider.description}**. All future messages will use this provider.`,
          timestamp: Date.now()
        };
        this.chatUI.addMessage(switchMessage);
      }
    } catch (error) {
      console.error('Failed to switch provider:', error);
      throw error;
    }
  }

  private async handleSettingsChange(config: SettingsConfig): Promise<void> {
    console.log('Settings changed:', config);

    const hardwareProfile = this.sessionManager?.getHardwareProfile();
    if (hardwareProfile) {
      const invalidFeatures: Feature[] = [];
      for (const feature of config.enabledFeatures) {
        if (!HardwareDiagnostics.canSupport(feature, hardwareProfile)) {
          invalidFeatures.push(feature);
        }
      }

      if (invalidFeatures.length > 0) {
        config.enabledFeatures = config.enabledFeatures.filter(
          f => !invalidFeatures.includes(f)
        );

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

    if (this.settingsPanel) {
      this.settingsPanel.updateSettings(config);
    }

    if (this.sessionManager) {
      try {
        await this.sessionManager.recreateSession({
          temperature: config.temperature,
          topK: config.topK,
          enabledFeatures: config.enabledFeatures
        });
      } catch (error) {
        console.error('Failed to apply settings:', error);
      }
    }

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

  private updateProviderIndicator(provider: ModelProvider): void {
    const indicator = this.shadow.querySelector('[data-provider-indicator]') as HTMLElement;
    if (!indicator) return;

    indicator.style.display = 'flex';
    indicator.innerHTML = '';

    const badge = document.createElement('span');
    badge.className = 'provider-badge';

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

    // Privacy warning for external API providers (not local Ollama)
    if (provider.type === 'api') {
      const warning = document.createElement('span');
      warning.className = 'privacy-warning';
      warning.textContent = '⚠️';
      warning.title = 'External API - data sent to third party';
      indicator.appendChild(warning);
    }
  }

  private handleInitMessage(message: Message): void {
    if (this.chatUI) {
      this.chatUI.addMessage(message);
    }
  }

  private handleUpdateInitMessage(messageId: string, content: string): void {
    if (this.chatUI) {
      this.chatUI.updateMessage(messageId, content, true);
    }
  }

  private handleProviderReady(provider: ModelProvider): void {
    this.updateProviderIndicator(provider);
  }

  private handleSessionCreated(session: ChatSession): void {
    console.log('Session created:', session);
  }

  private handleHardwareProfileDetected(profile: HardwareProfile): void {
    console.log('Hardware profile detected:', profile);
  }

  private handleFeaturesFiltered(supported: Feature[], _unsupported: Feature[]): void {
    this.currentSettings.enabledFeatures = supported;
    if (this.settingsPanel) {
      this.settingsPanel.updateSettings(this.currentSettings);
    }
  }

  private async handleSendMessage(content: string): Promise<void> {
    if (!this.chatUI) {
      console.error('Chat UI not initialized');
      return;
    }

    const userMessage: Message = {
      id: `msg-${this.messageIdCounter++}`,
      role: 'user',
      content,
      timestamp: Date.now()
    };
    this.chatUI.addMessage(userMessage);

    if (this.threadManager) {
      await this.threadManager.saveMessageToThread(userMessage, {
        temperature: this.currentSettings.temperature,
        topK: this.currentSettings.topK,
        systemPrompt: '',
        enabledFeatures: this.currentSettings.enabledFeatures
      });
    }

    const currentSession = this.sessionManager?.getCurrentSession();
    const activeProvider = this.sessionManager?.getActiveProvider();

    if (!currentSession || !activeProvider) {
      const errorMessage: Message = {
        id: `msg-${this.messageIdCounter++}`,
        role: 'assistant',
        content: '⚠️ **AI Model Not Available**\n\nNo AI provider is currently available. This could be because:\n\n- Chrome built-in AI is not enabled in your browser\n- WebLLM couldn\'t initialize (WebGPU not available)\n- The model is still downloading\n\nPlease check the initialization status above for more details.',
        timestamp: Date.now()
      };
      this.chatUI.addMessage(errorMessage);
      if (this.threadManager) {
        await this.threadManager.saveMessageToThread(errorMessage, {
          temperature: this.currentSettings.temperature,
          topK: this.currentSettings.topK,
          systemPrompt: '',
          enabledFeatures: this.currentSettings.enabledFeatures
        });
      }
      return;
    }

    this.chatUI.showLoading();

    const assistantMessage: Message = {
      id: `msg-${this.messageIdCounter++}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true
    };
    this.chatUI.addMessage(assistantMessage);

    this.abortController = new AbortController();

    try {
      let fullResponse = '';
      const stream = activeProvider.promptStreaming(
        currentSession,
        content,
        this.abortController.signal
      );

      for await (const chunk of stream) {
        if (activeProvider.name === 'chrome-gemini') {
          fullResponse = chunk;
        } else {
          fullResponse += chunk;
        }
        this.chatUI.updateMessage(assistantMessage.id, fullResponse, true);
      }

      this.chatUI.updateMessage(assistantMessage.id, fullResponse, true);

      assistantMessage.content = fullResponse;
      assistantMessage.isStreaming = false;
      if (this.threadManager) {
        await this.threadManager.saveMessageToThread(assistantMessage, {
          temperature: this.currentSettings.temperature,
          topK: this.currentSettings.topK,
          systemPrompt: '',
          enabledFeatures: this.currentSettings.enabledFeatures
        });
      }

      this.chatUI.hideLoading();
    } catch (error) {
      this.chatUI.hideLoading();

      if (error instanceof Error && error.message === 'Stream cancelled') {
        const cancelledContent = assistantMessage.content || '⚠️ _Message cancelled by user_';
        this.chatUI.updateMessage(
          assistantMessage.id,
          cancelledContent,
          true
        );
        assistantMessage.content = cancelledContent;
        assistantMessage.isStreaming = false;
        if (this.threadManager) {
          await this.threadManager.saveMessageToThread(assistantMessage, {
            temperature: this.currentSettings.temperature,
            topK: this.currentSettings.topK,
            systemPrompt: '',
            enabledFeatures: this.currentSettings.enabledFeatures
          });
        }
      } else {
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
        if (this.threadManager) {
          await this.threadManager.saveMessageToThread(assistantMessage, {
            temperature: this.currentSettings.temperature,
            topK: this.currentSettings.topK,
            systemPrompt: '',
            enabledFeatures: this.currentSettings.enabledFeatures
          });
        }

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

  private async handleGPURecovery(): Promise<void> {
    console.log('Handling GPU recovery...');

    if (!this.chatUI) return;

    const recoveryMessage: Message = {
      id: `msg-${this.messageIdCounter++}`,
      role: 'assistant',
      content: '🔄 **GPU Recovery in Progress**\n\nThe GPU connection was lost and is being reinitialized. Please wait...',
      timestamp: Date.now()
    };
    this.chatUI.addMessage(recoveryMessage);

    try {
      const activeProvider = this.sessionManager?.getActiveProvider();
      if (activeProvider && activeProvider.name === 'webllm') {
        await activeProvider.dispose();
        await activeProvider.initialize({});

        if (this.sessionManager) {
          await this.sessionManager.recreateSession({
            temperature: this.currentSettings.temperature,
            topK: this.currentSettings.topK,
            enabledFeatures: this.currentSettings.enabledFeatures
          });
        }
      }

      const successMessage: Message = {
        id: `msg-${this.messageIdCounter++}`,
        role: 'assistant',
        content: '✅ **GPU Recovery Successful**\n\nThe GPU has been reinitialized. You can continue using the assistant.',
        timestamp: Date.now()
      };
      this.chatUI.addMessage(successMessage);
    } catch (error) {
      console.error('GPU recovery failed:', error);

      const failureMessage: Message = {
        id: `msg-${this.messageIdCounter++}`,
        role: 'assistant',
        content: '⚠️ **GPU Recovery Failed**\n\nThe GPU could not be reinitialized. You may need to reset the application or restart your browser.',
        timestamp: Date.now()
      };
      this.chatUI.addMessage(failureMessage);
    }
  }

  private async handleApplicationReset(): Promise<void> {
    console.log('Application reset initiated');
  }

  async resetApplication(): Promise<void> {
    if (!confirm('Are you sure you want to reset the application? This will clear all data and reload the page.')) {
      return;
    }

    await this.recoveryManager.resetApplication();
  }


  private async handleThreadSwitch(threadId: string, messages: Message[]): Promise<void> {
    if (!this.chatUI) return;

    const thread = await this.storageManager.getThread(threadId);

    if (this.headerText && thread) {
      this.headerText.textContent = thread.title;
    }

    this.chatUI.clearMessages();
    messages.forEach(msg => this.chatUI!.addMessage(msg));
  }

  private handleThreadDeleteCallback(threadId: string): void {
    if (!this.chatUI) return;

    const currentThreadId = this.threadManager?.getCurrentThreadId();
    if (threadId === currentThreadId) {
      this.chatUI.clearMessages();

      if (this.headerText) {
        this.headerText.textContent = 'Ask Ai Assistant Locally';
      }

      const welcomeMessage: Message = {
        id: `msg-${this.messageIdCounter++}`,
        role: 'assistant',
        content: '👋 Hello! I\'m your local AI assistant. How can I help you today?',
        timestamp: Date.now()
      };
      this.chatUI.addMessage(welcomeMessage);
    }
  }

  private handleNewThreadCallback(): void {
    if (!this.chatUI) return;

    this.chatUI.clearMessages();

    if (this.headerText) {
      this.headerText.textContent = 'Ask Ai Assistant Locally';
    }

    const welcomeMessage: Message = {
      id: `msg-${this.messageIdCounter++}`,
      role: 'assistant',
      content: '👋 Hello! I\'m your local AI assistant. How can I help you today?',
      timestamp: Date.now()
    };
    this.chatUI.addMessage(welcomeMessage);
  }

  private handleThreadCreated(threadId: string): void {
    console.log('Thread created:', threadId);
  }

  connectedCallback(): void {
    console.log('Local AI Assistant connected');
  }

  disconnectedCallback(): void {
    console.log('Local AI Assistant disconnected');

    if (this.sessionManager) {
      this.sessionManager.dispose();
    }

    this.providerManager.dispose();

    if (this.threadManager) {
      this.threadManager.dispose();
    }
  }
}

if (!customElements.get('local-ai-assistant')) {
  customElements.define('local-ai-assistant', LocalAIAssistant);
}

