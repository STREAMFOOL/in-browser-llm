/**
 * Settings UI Module
 * Provides settings interface with hardware diagnostics and feature management
 * Requirements: 6.1, 6.2, 6.3, 6.4, 12.1, 12.2, 12.5
 */

import { HardwareDiagnostics, type HardwareProfile, type Feature } from './hardware-diagnostics';
import type { ProviderInfo } from './model-provider';

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
}

export class SettingsUI {
    private container: HTMLElement;
    private callbacks: SettingsCallbacks;
    private hardwareProfile: HardwareProfile | null = null;
    private currentConfig: SettingsConfig;

    constructor(container: HTMLElement, callbacks: SettingsCallbacks, initialConfig: SettingsConfig) {
        this.container = container;
        this.callbacks = callbacks;
        this.currentConfig = initialConfig;
    }

    /**
     * Render the complete settings UI
     * Requirements: 6.1, 6.2, 6.3, 6.4, 12.1, 12.2, 12.5
     */
    async render(providers: ProviderInfo[], activeProviderName: string | null): Promise<void> {
        // Clear container
        this.container.innerHTML = '';

        // Detect hardware if not already done
        if (!this.hardwareProfile) {
            this.hardwareProfile = await HardwareDiagnostics.detectCapabilities();
        }

        // Create sections
        this.renderHardwareSection();
        this.renderModelParametersSection();
        this.renderFeaturesSection();
        this.renderProviderSection(providers, activeProviderName);
        this.renderDataManagementSection();
    }

    /**
     * Render hardware diagnostics section
     * Requirements: 6.1, 6.2, 6.3, 6.4
     */
    private renderHardwareSection(): void {
        if (!this.hardwareProfile) return;

        const section = document.createElement('div');
        section.className = 'settings-section';

        const title = document.createElement('div');
        title.className = 'settings-section-title';
        title.textContent = 'Hardware Diagnostics';

        const grid = document.createElement('div');
        grid.className = 'hardware-grid';

        // RAM
        const ramCard = this.createHardwareCard(
            '💾',
            'RAM',
            `${this.hardwareProfile.ram} GB`,
            this.hardwareProfile.ram >= 8 ? 'good' : this.hardwareProfile.ram >= 4 ? 'warning' : 'poor'
        );

        // CPU
        const cpuCard = this.createHardwareCard(
            '⚙️',
            'CPU Cores',
            `${this.hardwareProfile.cpuCores}`,
            this.hardwareProfile.cpuCores >= 4 ? 'good' : this.hardwareProfile.cpuCores >= 2 ? 'warning' : 'poor'
        );

        // Storage
        const storageCard = this.createHardwareCard(
            '💿',
            'Available Storage',
            `${this.hardwareProfile.storageAvailable.toFixed(1)} GB`,
            this.hardwareProfile.storageAvailable >= 22 ? 'good' : this.hardwareProfile.storageAvailable >= 10 ? 'warning' : 'poor'
        );

        // GPU VRAM
        const vramCard = this.createHardwareCard(
            '🎮',
            'GPU VRAM',
            this.hardwareProfile.webGPUSupported ? `~${this.hardwareProfile.gpuVRAM.toFixed(1)} GB` : 'N/A',
            this.hardwareProfile.webGPUSupported
                ? (this.hardwareProfile.gpuVRAM >= 4 ? 'good' : this.hardwareProfile.gpuVRAM >= 2 ? 'warning' : 'poor')
                : 'poor'
        );

        grid.appendChild(ramCard);
        grid.appendChild(cpuCard);
        grid.appendChild(storageCard);
        grid.appendChild(vramCard);

        // Performance score
        if (this.hardwareProfile.webGPUSupported && this.hardwareProfile.gpuPerformanceScore > 0) {
            const perfInfo = document.createElement('div');
            perfInfo.className = 'performance-info';
            perfInfo.innerHTML = `
                <span class="perf-label">GPU Performance Score:</span>
                <span class="perf-score">${this.hardwareProfile.gpuPerformanceScore}/100</span>
            `;
            section.appendChild(title);
            section.appendChild(grid);
            section.appendChild(perfInfo);
        } else {
            section.appendChild(title);
            section.appendChild(grid);
        }

        this.container.appendChild(section);
    }

    /**
     * Create a hardware metric card
     */
    private createHardwareCard(icon: string, label: string, value: string, status: 'good' | 'warning' | 'poor'): HTMLElement {
        const card = document.createElement('div');
        card.className = `hardware-card ${status}`;

        const iconEl = document.createElement('div');
        iconEl.className = 'hardware-icon';
        iconEl.textContent = icon;

        const details = document.createElement('div');
        details.className = 'hardware-details';

        const labelEl = document.createElement('div');
        labelEl.className = 'hardware-label';
        labelEl.textContent = label;

        const valueEl = document.createElement('div');
        valueEl.className = 'hardware-value';
        valueEl.textContent = value;

        const indicator = document.createElement('div');
        indicator.className = `hardware-indicator ${status}`;
        indicator.textContent = status === 'good' ? '●' : status === 'warning' ? '●' : '●';

        details.appendChild(labelEl);
        details.appendChild(valueEl);

        card.appendChild(iconEl);
        card.appendChild(details);
        card.appendChild(indicator);

        return card;
    }

    /**
     * Render model parameters section
     * Requirement 12.1
     */
    private renderModelParametersSection(): void {
        const section = document.createElement('div');
        section.className = 'settings-section';

        const title = document.createElement('div');
        title.className = 'settings-section-title';
        title.textContent = 'Model Parameters';

        // Temperature slider
        const tempControl = this.createSliderControl(
            'Temperature',
            'Controls randomness in responses. Lower = more focused, Higher = more creative',
            this.currentConfig.temperature,
            0,
            1,
            0.1,
            (value) => {
                this.currentConfig.temperature = value;
                this.callbacks.onSettingsChange(this.currentConfig);
            }
        );

        // TopK slider
        const topKControl = this.createSliderControl(
            'Top-K',
            'Number of top tokens to consider. Lower = more focused, Higher = more diverse',
            this.currentConfig.topK,
            1,
            100,
            1,
            (value) => {
                this.currentConfig.topK = value;
                this.callbacks.onSettingsChange(this.currentConfig);
            }
        );

        section.appendChild(title);
        section.appendChild(tempControl);
        section.appendChild(topKControl);

        this.container.appendChild(section);
    }

    /**
     * Create a slider control
     */
    private createSliderControl(
        label: string,
        description: string,
        value: number,
        min: number,
        max: number,
        step: number,
        onChange: (value: number) => void
    ): HTMLElement {
        const control = document.createElement('div');
        control.className = 'slider-control';

        const header = document.createElement('div');
        header.className = 'slider-header';

        const labelEl = document.createElement('label');
        labelEl.className = 'slider-label';
        labelEl.textContent = label;

        const valueEl = document.createElement('span');
        valueEl.className = 'slider-value';
        valueEl.textContent = value.toString();

        header.appendChild(labelEl);
        header.appendChild(valueEl);

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'slider';
        slider.min = min.toString();
        slider.max = max.toString();
        slider.step = step.toString();
        slider.value = value.toString();

        slider.addEventListener('input', () => {
            const newValue = parseFloat(slider.value);
            valueEl.textContent = newValue.toString();
            onChange(newValue);
        });

        const desc = document.createElement('div');
        desc.className = 'slider-description';
        desc.textContent = description;

        control.appendChild(header);
        control.appendChild(slider);
        control.appendChild(desc);

        return control;
    }

    /**
     * Render features section
     * Requirement 12.2
     */
    private renderFeaturesSection(): void {
        if (!this.hardwareProfile) return;

        const section = document.createElement('div');
        section.className = 'settings-section';

        const title = document.createElement('div');
        title.className = 'settings-section-title';
        title.textContent = 'Features';

        const features: Array<{ feature: Feature; label: string; description: string }> = [
            { feature: 'text-chat', label: 'Text Chat', description: 'Basic conversational AI' },
            { feature: 'image-generation', label: 'Image Generation', description: 'Generate images from text (requires 4GB+ VRAM)' },
            { feature: 'vision', label: 'Image Understanding', description: 'Analyze and describe images (requires 2GB+ VRAM)' },
            { feature: 'speech', label: 'Speech Input/Output', description: 'Voice interaction (requires 1GB+ VRAM)' },
        ];

        for (const { feature, label, description } of features) {
            const canSupport = HardwareDiagnostics.canSupport(feature, this.hardwareProfile);
            const isEnabled = this.currentConfig.enabledFeatures.includes(feature);

            const toggle = this.createFeatureToggle(
                label,
                description,
                isEnabled,
                canSupport,
                (enabled) => {
                    if (enabled) {
                        if (!this.currentConfig.enabledFeatures.includes(feature)) {
                            this.currentConfig.enabledFeatures.push(feature);
                        }
                    } else {
                        this.currentConfig.enabledFeatures = this.currentConfig.enabledFeatures.filter(f => f !== feature);
                    }
                    this.callbacks.onSettingsChange(this.currentConfig);
                }
            );

            section.appendChild(toggle);
        }

        section.insertBefore(title, section.firstChild);
        this.container.appendChild(section);
    }

    /**
     * Create a feature toggle
     * Requirements: 6.5, 6.6, 7.6
     */
    private createFeatureToggle(
        label: string,
        description: string,
        enabled: boolean,
        canSupport: boolean,
        onChange: (enabled: boolean) => void
    ): HTMLElement {
        const toggle = document.createElement('div');
        toggle.className = `feature-toggle ${!canSupport ? 'disabled' : ''}`;

        const details = document.createElement('div');
        details.className = 'feature-details';

        const labelEl = document.createElement('div');
        labelEl.className = 'feature-label';
        labelEl.textContent = label;

        const desc = document.createElement('div');
        desc.className = 'feature-description';
        desc.textContent = description;

        if (!canSupport) {
            const warning = document.createElement('div');
            warning.className = 'feature-warning';
            warning.textContent = '⚠️ Insufficient hardware';
            desc.appendChild(warning);
        }

        details.appendChild(labelEl);
        details.appendChild(desc);

        const switchEl = document.createElement('label');
        switchEl.className = 'switch';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = enabled;
        checkbox.disabled = !canSupport;

        checkbox.addEventListener('change', () => {
            // Requirement 6.5, 6.6: Warn when hardware is insufficient for features
            if (checkbox.checked && !canSupport) {
                // This shouldn't happen since checkbox is disabled, but double-check
                alert('⚠️ This feature cannot be enabled due to insufficient hardware.');
                checkbox.checked = false;
                return;
            }
            onChange(checkbox.checked);
        });

        const slider = document.createElement('span');
        slider.className = 'switch-slider';

        switchEl.appendChild(checkbox);
        switchEl.appendChild(slider);

        toggle.appendChild(details);
        toggle.appendChild(switchEl);

        return toggle;
    }

    /**
     * Render provider selection section
     */
    private renderProviderSection(providers: ProviderInfo[], activeProviderName: string | null): void {
        const section = document.createElement('div');
        section.className = 'settings-section';

        const title = document.createElement('div');
        title.className = 'settings-section-title';
        title.textContent = 'AI Provider';

        const providerList = document.createElement('div');
        providerList.className = 'provider-list';

        for (const provider of providers) {
            const item = this.createProviderItem(provider, provider.name === activeProviderName);
            providerList.appendChild(item);
        }

        section.appendChild(title);
        section.appendChild(providerList);

        this.container.appendChild(section);
    }

    /**
     * Create a provider item
     */
    private createProviderItem(provider: ProviderInfo, isActive: boolean): HTMLElement {
        const item = document.createElement('div');
        item.className = 'provider-item';

        if (!provider.available) {
            item.classList.add('unavailable');
        }

        if (isActive) {
            item.classList.add('active');
        }

        const icon = document.createElement('div');
        icon.className = 'provider-icon';
        icon.textContent = provider.type === 'local' ? '🔒' : '🌐';

        const details = document.createElement('div');
        details.className = 'provider-details';

        const name = document.createElement('div');
        name.className = 'provider-name';
        name.textContent = provider.name;

        const description = document.createElement('div');
        description.className = 'provider-description';
        description.textContent = provider.available
            ? (provider.type === 'local' ? 'Local processing' : 'External API')
            : (provider.reason || 'Not available');

        details.appendChild(name);
        details.appendChild(description);

        const status = document.createElement('div');
        status.className = 'provider-status';
        if (isActive) {
            status.className += ' active';
            status.textContent = 'Active';
        } else if (provider.available) {
            status.className += ' available';
            status.textContent = 'Available';
        } else {
            status.className += ' unavailable';
            status.textContent = 'Unavailable';
        }

        item.appendChild(icon);
        item.appendChild(details);
        item.appendChild(status);

        if (provider.available && !isActive) {
            item.style.cursor = 'pointer';
            item.addEventListener('click', () => {
                this.callbacks.onProviderSwitch(provider.name);
            });
        }

        return item;
    }

    /**
     * Render data management section
     * Requirement 12.5
     */
    private renderDataManagementSection(): void {
        const section = document.createElement('div');
        section.className = 'settings-section';

        const title = document.createElement('div');
        title.className = 'settings-section-title';
        title.textContent = 'Data Management';

        // Clear data button
        const clearButton = document.createElement('button');
        clearButton.className = 'action-button secondary';
        clearButton.textContent = '🗑️ Clear All Data';
        clearButton.addEventListener('click', async () => {
            if (confirm('Are you sure you want to clear all data? This will delete all conversations and cached models.')) {
                await this.callbacks.onClearData();
            }
        });

        const clearDescription = document.createElement('div');
        clearDescription.className = 'action-description';
        clearDescription.textContent = 'Delete all conversations, cached models, and settings. This action cannot be undone.';

        // Reset application button
        const resetButton = document.createElement('button');
        resetButton.className = 'action-button danger';
        resetButton.textContent = '🔄 Reset Application';
        resetButton.addEventListener('click', async () => {
            if (confirm('Are you sure you want to reset the application? This will clear all data and reload the page.')) {
                await this.callbacks.onResetApplication();
            }
        });

        const resetDescription = document.createElement('div');
        resetDescription.className = 'action-description';
        resetDescription.textContent = 'Clear all data and reset the application to its initial state. The page will reload.';

        section.appendChild(title);
        section.appendChild(clearDescription);
        section.appendChild(clearButton);
        section.appendChild(document.createElement('br'));
        section.appendChild(resetDescription);
        section.appendChild(resetButton);

        this.container.appendChild(section);
    }

    /**
     * Update current configuration
     */
    updateConfig(config: SettingsConfig): void {
        this.currentConfig = config;
    }

    /**
     * Get current configuration
     */
    getConfig(): SettingsConfig {
        return { ...this.currentConfig };
    }
}
