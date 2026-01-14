import { HardwareDiagnostics, type HardwareProfile, type Feature } from '../utils/hardware-diagnostics';
import type { ProviderInfo } from '../providers/model-provider';
import { SettingsSections } from './settings-ui-sections';

export interface SettingsConfig {
    temperature: number;
    topK: number;
    enabledFeatures: Feature[];
}

export interface SettingsCallbacks {
    onProviderSwitch: (providerName: string) => Promise<void>;
    onSettingsChange: (config: SettingsConfig) => void;
    onClearData: () => Promise<void>;
    onResetApplication: () => Promise<void>;
    onClearModelCache?: () => Promise<void>;
    onApiConfigChange?: (backend: string, modelId: string, apiKey: string, endpoint: string) => Promise<void>;
    onWebLLMModelChange?: (modelId: string) => Promise<void>;
    onSearchToggle?: (enabled: boolean) => Promise<void>;
    onSearchApiKeyChange?: (apiKey: string) => Promise<void>;
}

export class SettingsUI {
    private container: HTMLElement;
    private callbacks: SettingsCallbacks;
    private hardwareProfile: HardwareProfile | null = null;
    private currentConfig: SettingsConfig;
    private sections: SettingsSections;

    constructor(container: HTMLElement, callbacks: SettingsCallbacks, initialConfig: SettingsConfig) {
        this.container = container;
        this.callbacks = callbacks;
        this.currentConfig = initialConfig;
        this.sections = new SettingsSections(container, this.callbacks, this.hardwareProfile, initialConfig);
    }

    async render(providers: ProviderInfo[], activeProviderName: string | null): Promise<void> {
        // Clear container
        this.container.innerHTML = '';

        // Detect hardware if not already done
        if (!this.hardwareProfile) {
            this.hardwareProfile = await HardwareDiagnostics.detectCapabilities();
            this.sections.updateHardwareProfile(this.hardwareProfile);
        }

        // Render all sections
        this.sections.renderHardwareSection();
        this.sections.renderModelParametersSection();
        this.sections.renderFeaturesSection();
        this.sections.renderProviderSection(providers, activeProviderName);
        this.sections.renderWebLLMModelSection(activeProviderName);
        this.sections.renderApiConfigSection(activeProviderName);
        this.sections.renderSearchSection();
        await this.sections.renderNotificationLogSection();
        this.sections.renderDataManagementSection();
    }

    updateConfig(config: SettingsConfig): void {
        this.currentConfig = config;
        this.sections.updateConfig(config);
    }

    getConfig(): SettingsConfig {
        return { ...this.currentConfig };
    }
}
