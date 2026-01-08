import { ChatUI, type Message } from '../ui/chat-ui';
import { GeminiController } from '../providers/gemini-controller';
import { ProviderManager } from '../providers/provider-manager';
import type { ModelProvider, ChatSession } from '../providers/model-provider';
import { ErrorHandler, ErrorCategory } from '../utils/error-handler';
import { RecoveryManager } from '../core/recovery-manager';
import { type SettingsConfig } from '../ui/settings-ui';
import { StorageManager } from '../storage/storage-manager';
import type { HardwareProfile, Feature } from '../utils/hardware-diagnostics';
import { SettingsPanel } from './settings';
import { ThreadManager } from './thread-manager';
import { SessionManager } from './session-manager';
import { ComponentCore } from './component-core';

export class ComponentLifecycle {
    private shadow: ShadowRoot;
    private core: ComponentCore;
    private chatUI: ChatUI | null = null;
    private settingsPanel: SettingsPanel | null = null;
    private threadManager: ThreadManager | null = null;
    private sessionManager: SessionManager | null = null;
    private geminiController: GeminiController;
    private providerManager: ProviderManager;
    private recoveryManager: RecoveryManager;
    private storageManager: StorageManager;
    private abortController: AbortController | null = null;
    private currentSettings: SettingsConfig = {
        temperature: 0.7,
        topK: 40,
        enabledFeatures: ['text-chat']
    };

    constructor(
        shadow: ShadowRoot,
        core: ComponentCore,
        geminiController: GeminiController,
        providerManager: ProviderManager,
        storageManager: StorageManager,
        recoveryManager: RecoveryManager
    ) {
        this.shadow = shadow;
        this.core = core;
        this.geminiController = geminiController;
        this.providerManager = providerManager;
        this.storageManager = storageManager;
        this.recoveryManager = recoveryManager;

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
            this.core.getMessageIdCounter()
        );
    }

    initializeChatUI(container: HTMLElement): void {
        this.chatUI = new ChatUI(container, {
            onSendMessage: (message) => this.handleSendMessage(message),
            onCancelStream: () => this.handleCancelStream()
        });
    }

    initializeSettingsPanel(): SettingsPanel {
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
        return this.settingsPanel;
    }

    initializeThreadManager(container: HTMLElement): void {
        this.threadManager = new ThreadManager(this.storageManager, {
            onThreadSwitch: (threadId, messages) => this.handleThreadSwitch(threadId, messages),
            onThreadDelete: (threadId) => this.handleThreadDeleteCallback(threadId),
            onNewThread: () => this.handleNewThreadCallback(),
            onThreadCreated: (threadId) => this.handleThreadCreated(threadId)
        });
        this.threadManager.initializeUI(container);
    }

    async initializeSession(): Promise<void> {
        if (this.sessionManager) {
            await this.sessionManager.initialize({
                temperature: this.currentSettings.temperature,
                topK: this.currentSettings.topK,
                enabledFeatures: this.currentSettings.enabledFeatures
            });
        }
    }

    toggleSettings(): void {
        if (this.settingsPanel) {
            this.settingsPanel.toggle();
        }
    }

    async toggleThreadList(): Promise<void> {
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
                const switchMessage = this.core.createProviderSwitchMessage(provider.description);
                this.chatUI.addMessage(switchMessage);
            }
        } catch (error) {
            console.error('Failed to switch provider:', error);
            throw error;
        }
    }

    private async handleSettingsChange(config: SettingsConfig): Promise<void> {
        console.log('Settings changed:', config);

        const hardwareProfile = this.sessionManager ? this.sessionManager.getHardwareProfile() : null;
        const { validConfig, invalidFeatures } = this.core.validateFeatures(config, hardwareProfile);

        if (invalidFeatures.length > 0 && this.chatUI) {
            const warningMessage = this.core.createWarningMessage(invalidFeatures);
            this.chatUI.addMessage(warningMessage);
        }

        this.currentSettings = validConfig;

        if (this.settingsPanel) {
            this.settingsPanel.updateSettings(validConfig);
        }

        if (this.sessionManager) {
            try {
                await this.sessionManager.recreateSession({
                    temperature: validConfig.temperature,
                    topK: validConfig.topK,
                    enabledFeatures: validConfig.enabledFeatures
                });
            } catch (error) {
                console.error('Failed to apply settings:', error);
            }
        }

        try {
            await this.storageManager.saveSetting('modelParameters', {
                temperature: validConfig.temperature,
                topK: validConfig.topK
            });
            await this.storageManager.saveSetting('enabledFeatures', validConfig.enabledFeatures);
        } catch (error) {
            console.error('Failed to persist settings:', error);
        }
    }

    private async clearAllData(): Promise<void> {
        try {
            console.log('Clearing all data...');
            await this.storageManager.clearAllData();

            if (this.chatUI) {
                const successMessage = this.core.createDataClearedMessage();
                this.chatUI.addMessage(successMessage);
            }
        } catch (error) {
            console.error('Failed to clear data:', error);

            if (this.chatUI) {
                const errorMessage = this.core.createDataClearErrorMessage(error);
                this.chatUI.addMessage(errorMessage);
            }
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
        this.core.updateProviderIndicator(provider);
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
            id: `msg-${this.core.incrementMessageIdCounter()}`,
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
            const errorMessage = this.core.createNoProviderMessage();
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
            id: `msg-${this.core.incrementMessageIdCounter()}`,
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

    async resetApplication(): Promise<void> {
        if (!confirm('Are you sure you want to reset the application? This will clear all data and reload the page.')) {
            return;
        }

        await this.recoveryManager.resetApplication();
    }

    private async handleThreadSwitch(threadId: string, messages: Message[]): Promise<void> {
        if (!this.chatUI) return;

        const thread = await this.storageManager.getThread(threadId);

        if (thread) {
            this.core.updateHeaderText(thread.title);
        }

        this.chatUI.clearMessages();
        messages.forEach(msg => this.chatUI!.addMessage(msg));
    }

    private handleThreadDeleteCallback(threadId: string): void {
        if (!this.chatUI) return;

        const currentThreadId = this.threadManager?.getCurrentThreadId();
        if (threadId === currentThreadId) {
            this.chatUI.clearMessages();
            this.core.updateHeaderText('Ask Ai Assistant Locally');

            const welcomeMessage = this.core.createWelcomeMessage();
            this.chatUI.addMessage(welcomeMessage);
        }
    }

    private handleNewThreadCallback(): void {
        if (!this.chatUI) return;

        this.chatUI.clearMessages();
        this.core.updateHeaderText('Ask Ai Assistant Locally');

        const welcomeMessage = this.core.createWelcomeMessage();
        this.chatUI.addMessage(welcomeMessage);
    }

    private handleThreadCreated(threadId: string): void {
        console.log('Thread created:', threadId);
    }

    async dispose(): Promise<void> {
        if (this.sessionManager) {
            await this.sessionManager.dispose();
        }

        this.providerManager.dispose();

        if (this.threadManager) {
            this.threadManager.dispose();
        }
    }
}
