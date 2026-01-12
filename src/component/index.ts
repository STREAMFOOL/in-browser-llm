import { GeminiController } from '../providers/gemini-controller';
import { ProviderManager } from '../providers/provider-manager';
import { ChromeProvider } from '../providers/chrome-provider';
import { WebLLMProvider } from '../providers/webllm-provider';
import { RecoveryManager } from '../core/recovery-manager';
import { StorageManager } from '../storage/storage-manager';
import { getMainStyles } from '../styles/index';
import { ComponentCore } from './component-core';
import { ComponentLifecycle } from './component-lifecycle';
import { initializeNotificationSystem, notify, dismissNotification, clearAllNotifications } from '../ui/notification-api';

export class LocalAIAssistant extends HTMLElement {
    private shadow: ShadowRoot;
    private core: ComponentCore;
    private lifecycle: ComponentLifecycle;
    private geminiController: GeminiController;
    private providerManager: ProviderManager;
    private recoveryManager: RecoveryManager;
    private storageManager: StorageManager;

    constructor() {
        super();

        // Create closed Shadow DOM for style isolation
        this.shadow = this.attachShadow({ mode: 'closed' });

        // Initialize notification system with Shadow DOM
        initializeNotificationSystem(this.shadow);

        this.geminiController = new GeminiController();
        this.storageManager = new StorageManager();

        // Initialize provider manager with fallback support
        this.providerManager = new ProviderManager();
        this.providerManager.registerProvider(new ChromeProvider());
        this.providerManager.registerProvider(new WebLLMProvider());

        // Initialize core and lifecycle
        this.core = new ComponentCore(this.shadow);

        // Initialize recovery manager
        this.recoveryManager = new RecoveryManager({
            onGPURecovery: async () => {
                // Recovery is handled by lifecycle
            },
            onApplicationReset: async () => {
                // Reset is handled by lifecycle
            }
        });

        this.lifecycle = new ComponentLifecycle(
            this.shadow,
            this.core,
            this.geminiController,
            this.providerManager,
            this.storageManager,
            this.recoveryManager
        );

        this.initializeComponent();
    }

    private initializeComponent(): void {
        // Create basic structure
        const container = document.createElement('div');
        container.className = 'ai-assistant-container';

        // Add comprehensive styles including Tailwind equivalents for Shadow DOM
        const style = document.createElement('style');
        style.textContent = getMainStyles();

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
        threadToggleButton.addEventListener('click', () => this.lifecycle.toggleThreadList());

        const headerText = document.createElement('span');
        headerText.textContent = 'Ask Ai Assistant Locally';
        this.core.setHeaderText(headerText);

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
        settingsButton.addEventListener('click', () => this.lifecycle.toggleSettings());

        header.appendChild(statusIndicator);
        header.appendChild(threadToggleButton);
        header.appendChild(headerText);
        header.appendChild(providerIndicator);
        header.appendChild(settingsButton);

        // Create content area for chat
        const content = document.createElement('div');
        content.className = 'ai-assistant-content';

        // Initialize chat UI
        this.lifecycle.initializeChatUI(content);

        // Initialize settings panel
        const settingsPanel = this.lifecycle.initializeSettingsPanel();
        const settingsPanelElement = settingsPanel.createPanel();

        // Create thread list sidebar
        const threadListSidebar = document.createElement('div');
        threadListSidebar.className = 'thread-list-sidebar';
        threadListSidebar.setAttribute('data-thread-list', 'true');

        // Initialize thread manager
        this.lifecycle.initializeThreadManager(threadListSidebar);

        // Create footer
        const footer = document.createElement('div');
        footer.className = 'ai-assistant-footer';
        footer.innerHTML = '<span class="footer-icon">🔒</span> All processing happens locally on your device';

        // Assemble component
        container.appendChild(threadListSidebar);
        container.appendChild(header);
        container.appendChild(content);
        container.appendChild(settingsPanelElement);
        container.appendChild(footer);

        this.shadow.appendChild(style);
        this.shadow.appendChild(container);

        // Initialize session and run integrity check
        this.initializeWithIntegrityCheck();
    }

    private async initializeWithIntegrityCheck(): Promise<void> {
        // Request persistent storage on initialization
        try {
            // First, request persistence
            await this.storageManager.requestPersistence();

            // Then verify persistence works by actually writing and reading data
            const canPersist = await this.storageManager.verifyPersistenceWithTest();

            if (!canPersist) {
                console.warn('Persistent storage verification failed. Data may not be reliably stored.');

                // Display warning notification if persistence test fails
                notify({
                    type: 'warning',
                    title: 'Persistent Storage Not Available',
                    message: 'Your browser denied persistent storage permission. Your conversations and settings may be cleared by the browser.'
                });
            } else {
                console.log('Persistent storage verified and working');
            }
        } catch (error) {
            console.error('Failed to verify persistent storage:', error);
        }

        // Run data integrity check on startup
        try {
            const integrityReport = await this.storageManager.verifyDataIntegrity();

            if (!integrityReport.valid) {
                console.warn('Data integrity issues detected:', integrityReport);

                // Display notification for integrity errors
                if (integrityReport.errors.length > 0) {
                    notify({
                        type: 'error',
                        title: 'Data Integrity Issues Detected',
                        message: `Found ${integrityReport.errors.length} data integrity error(s). Check the chat for details or clear data in settings.`
                    });

                    // Also display detailed error message in chat UI
                    const errorMessage = this.core.createIntegrityErrorMessage(integrityReport);
                    setTimeout(() => {
                        const chatContent = this.shadow.querySelector('.ai-assistant-content');
                        if (chatContent) {
                            const chatUI = (this.lifecycle as any).chatUI;
                            if (chatUI) {
                                chatUI.addMessage(errorMessage);
                            }
                        }
                    }, 100);
                }
            } else if (integrityReport.warnings.length > 0) {
                console.warn('Data integrity warnings:', integrityReport.warnings);
            }
        } catch (error) {
            console.error('Failed to verify data integrity:', error);
        }

        // Initialize session
        await this.lifecycle.initializeSession();
    }

    connectedCallback(): void {
        console.log('Local AI Assistant connected');
    }

    disconnectedCallback(): void {
        console.log('Local AI Assistant disconnected');
        this.lifecycle.dispose();
    }

    // Expose updateProviderIndicator for testing
    updateProviderIndicator(provider: { name: string; type: 'local' | 'api'; description: string }): void {
        this.core.updateProviderIndicator(provider as any);
    }
}

if (!customElements.get('local-ai-assistant')) {
    customElements.define('local-ai-assistant', LocalAIAssistant);
}

// Export notification API for global access
export { notify, dismissNotification, clearAllNotifications };
