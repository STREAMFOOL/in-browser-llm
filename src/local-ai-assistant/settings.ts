

import { SettingsUI, type SettingsConfig } from '../settings-ui';
import type { ProviderManager } from '../provider-manager';
import type { StorageManager } from '../storage/storage-manager';
import type { HardwareProfile } from '../utils/hardware-diagnostics';
import type { Message } from '../chat-ui';

export interface SettingsPanelCallbacks {
    onProviderSwitch: (providerName: string) => Promise<void>;
    onSettingsChange: (config: SettingsConfig) => void;
    onClearData: () => Promise<void>;
    onResetApplication: () => Promise<void>;
    onApiConfigChange?: (backend: string, modelId: string, apiKey: string, endpoint: string) => Promise<void>;
    onShowMessage?: (message: Message) => void;
}

export class SettingsPanel {
    private shadow: ShadowRoot;
    private panel: HTMLElement | null = null;
    private settingsUI: SettingsUI | null = null;
    private providerManager: ProviderManager;
    private callbacks: SettingsPanelCallbacks;
    private currentSettings: SettingsConfig;

    constructor(
        shadow: ShadowRoot,
        providerManager: ProviderManager,
        _storageManager: StorageManager,
        callbacks: SettingsPanelCallbacks,
        initialSettings: SettingsConfig,
        _hardwareProfile: HardwareProfile | null = null
    ) {
        this.shadow = shadow;
        this.providerManager = providerManager;
        this.callbacks = callbacks;
        this.currentSettings = initialSettings;
    }

    createPanel(): HTMLElement {
        this.panel = document.createElement('div');
        this.panel.className = 'settings-panel hidden';
        this.panel.setAttribute('data-settings-panel', 'true');

        const header = document.createElement('div');
        header.className = 'settings-header';

        const title = document.createElement('span');
        title.textContent = 'Settings';

        const closeButton = document.createElement('button');
        closeButton.className = 'settings-close';
        closeButton.innerHTML = '×';
        closeButton.setAttribute('aria-label', 'Close settings');
        closeButton.addEventListener('click', () => this.hide());

        header.appendChild(title);
        header.appendChild(closeButton);

        const content = document.createElement('div');
        content.className = 'settings-content';

        this.panel.appendChild(header);
        this.panel.appendChild(content);

        return this.panel;
    }

    toggle(): void {
        if (!this.panel) return;

        const isHidden = this.panel.classList.contains('hidden');
        if (isHidden) {
            this.show();
        } else {
            this.hide();
        }
    }

    async show(): Promise<void> {
        if (!this.panel) return;

        this.panel.classList.remove('hidden');
        await this.populateProviderList();
    }

    hide(): void {
        if (!this.panel) return;
        this.panel.classList.add('hidden');
    }

    private async populateProviderList(): Promise<void> {
        const settingsContent = this.shadow.querySelector('.settings-content') as HTMLElement;
        if (!settingsContent) return;

        settingsContent.innerHTML = '<div style="text-align: center; padding: 2rem; color: #6b7280;">Loading settings...</div>';

        try {
            const providers = await this.providerManager.detectProviders();
            settingsContent.innerHTML = '';

            if (!this.settingsUI) {
                this.settingsUI = new SettingsUI(
                    settingsContent,
                    {
                        onProviderSwitch: async (providerName: string) => {
                            await this.handleProviderSwitch(providerName);
                        },
                        onSettingsChange: (config: SettingsConfig) => {
                            this.callbacks.onSettingsChange(config);
                        },
                        onClearData: async () => {
                            await this.callbacks.onClearData();
                            this.hide();
                        },
                        onResetApplication: async () => {
                            await this.callbacks.onResetApplication();
                        },
                        onApiConfigChange: this.callbacks.onApiConfigChange
                    },
                    this.currentSettings
                );
            }

            const activeProvider = this.providerManager.getActiveProvider();
            await this.settingsUI.render(providers, activeProvider?.name || null);
        } catch (error) {
            console.error('Failed to populate settings:', error);
            settingsContent.innerHTML = '<div style="text-align: center; padding: 2rem; color: #ef4444;">Failed to load settings</div>';
        }
    }

    private async handleProviderSwitch(providerName: string): Promise<void> {
        const settingsContent = this.shadow.querySelector('.settings-content') as HTMLElement;
        if (!settingsContent) return;

        try {
            settingsContent.style.opacity = '0.5';
            settingsContent.style.pointerEvents = 'none';

            await this.callbacks.onProviderSwitch(providerName);
            await this.populateProviderList();

            settingsContent.style.opacity = '1';
            settingsContent.style.pointerEvents = 'auto';
        } catch (error) {
            console.error('Failed to switch provider:', error);
            settingsContent.style.opacity = '1';
            settingsContent.style.pointerEvents = 'auto';

            if (this.callbacks.onShowMessage) {
                this.callbacks.onShowMessage({
                    id: `error-${Date.now()}`,
                    role: 'assistant',
                    content: `⚠️ **Failed to switch provider**: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    timestamp: Date.now()
                });
            }
        }
    }

    updateSettings(config: SettingsConfig): void {
        this.currentSettings = config;
        if (this.settingsUI) {
            this.settingsUI.updateConfig(config);
        }
    }

    getSettings(): SettingsConfig {
        return { ...this.currentSettings };
    }

    isVisible(): boolean {
        return this.panel ? !this.panel.classList.contains('hidden') : false;
    }
}
