import { HardwareDiagnostics, type HardwareProfile, type Feature } from '../utils/hardware-diagnostics';
import type { ProviderInfo } from '../providers/model-provider';
import type { SettingsConfig, SettingsCallbacks } from './settings-ui';

export class SettingsSections {
    private container: HTMLElement;
    private callbacks: SettingsCallbacks;
    private hardwareProfile: HardwareProfile | null;
    private currentConfig: SettingsConfig;

    constructor(
        container: HTMLElement,
        callbacks: SettingsCallbacks,
        hardwareProfile: HardwareProfile | null,
        currentConfig: SettingsConfig
    ) {
        this.container = container;
        this.callbacks = callbacks;
        this.hardwareProfile = hardwareProfile;
        this.currentConfig = currentConfig;
    }

    updateConfig(config: SettingsConfig): void {
        this.currentConfig = config;
    }

    updateHardwareProfile(profile: HardwareProfile): void {
        this.hardwareProfile = profile;
    }

    renderHardwareSection(): void {
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
        const storageStatus = this.hardwareProfile.storageAvailable >= 22 ? 'good' : this.hardwareProfile.storageAvailable >= 10 ? 'warning' : 'poor';
        const storageCard = this.createHardwareCard(
            '💿',
            'Available Storage',
            `${this.hardwareProfile.storageAvailable.toFixed(1)} GB`,
            storageStatus
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

        // Storage quota info message
        if (this.hardwareProfile.storageAvailable < 22) {
            const storageInfo = document.createElement('div');
            storageInfo.className = 'p-3 mt-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900 leading-relaxed';

            if (this.hardwareProfile.storageAvailable < 10) {
                storageInfo.innerHTML = `
                    <div class="font-semibold mb-1">⚠️ Limited Storage Available</div>
                    <div>Your browser has allocated ${this.hardwareProfile.storageAvailable.toFixed(1)} GB for this site. 
                    Chrome typically provides more storage than other browsers. For the best experience with local AI models, 
                    we recommend using Chrome.</div>
                `;
            } else {
                storageInfo.innerHTML = `
                    <div class="font-semibold mb-1">ℹ️ Storage Notice</div>
                    <div>You have ${this.hardwareProfile.storageAvailable.toFixed(1)} GB available. 
                    Local AI models work best with 22+ GB of storage. Chrome typically provides larger storage quotas than other browsers.</div>
                `;
            }

            section.appendChild(title);
            section.appendChild(grid);
            section.appendChild(storageInfo);
        } else {
            section.appendChild(title);
            section.appendChild(grid);
        }

        // Performance score
        if (this.hardwareProfile.webGPUSupported && this.hardwareProfile.gpuPerformanceScore > 0) {
            const perfInfo = document.createElement('div');
            perfInfo.className = 'performance-info';
            perfInfo.innerHTML = `
                <span class="perf-label">GPU Performance Score:</span>
                <span class="perf-score">${this.hardwareProfile.gpuPerformanceScore}/100</span>
            `;
            section.appendChild(perfInfo);
        }

        this.container.appendChild(section);
    }

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

    renderModelParametersSection(): void {
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

    renderFeaturesSection(): void {
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

    renderProviderSection(providers: ProviderInfo[], activeProviderName: string | null): void {
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

    private createProviderItem(provider: ProviderInfo, isActive: boolean): HTMLElement {
        const item = document.createElement('div');
        item.className = 'provider-item';

        if (!provider.available) {
            item.classList.add('unavailable');
            // Add title attribute for hover tooltip showing why unavailable
            item.title = provider.reason || 'Provider is not available';
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

    renderWebLLMModelSection(activeProviderName: string | null): void {
        // Only show if WebLLM provider is active
        if (activeProviderName !== 'webllm') {
            return;
        }

        const section = document.createElement('div');
        section.className = 'settings-section webllm-model-section';

        const title = document.createElement('div');
        title.className = 'settings-section-title';
        title.textContent = 'WebLLM Model Selection';

        const description = document.createElement('div');
        description.className = 'input-note';
        description.textContent = 'Choose the AI model to run locally. Larger models provide better quality but require more VRAM and storage.';

        // Import WebLLM models dynamically
        import('../providers/webllm-provider.js').then(({ WEBLLM_MODELS }) => {
            const modelList = document.createElement('div');
            modelList.className = 'model-list';

            // Get current model from provider if available
            let currentModelId: string | null = null;
            if (this.callbacks.onWebLLMModelChange) {
                // We'll need to pass current model through render
                currentModelId = (window as any).__currentWebLLMModel || WEBLLM_MODELS[0].id;
            }

            WEBLLM_MODELS.forEach(model => {
                const modelCard = this.createModelCard(
                    model,
                    model.id === currentModelId,
                    async () => {
                        if (this.callbacks.onWebLLMModelChange) {
                            try {
                                await this.callbacks.onWebLLMModelChange(model.id);
                                // Store for UI refresh
                                (window as any).__currentWebLLMModel = model.id;
                            } catch (error) {
                                alert('Failed to switch model: ' + (error instanceof Error ? error.message : 'Unknown error'));
                            }
                        }
                    }
                );
                modelList.appendChild(modelCard);
            });

            section.appendChild(title);
            section.appendChild(description);
            section.appendChild(modelList);
            this.container.appendChild(section);
        }).catch(error => {
            console.error('Failed to load WebLLM models:', error);
        });
    }

    private createModelCard(
        model: { id: string; name: string; description: string; estimatedVRAM: number; contextLength: number },
        isActive: boolean,
        onSelect: () => Promise<void>
    ): HTMLElement {
        const card = document.createElement('div');
        card.className = `model-card ${isActive ? 'active' : ''}`;

        const header = document.createElement('div');
        header.className = 'model-header';

        const name = document.createElement('div');
        name.className = 'model-name';
        name.textContent = model.name;

        const badge = document.createElement('div');
        badge.className = 'model-badge';
        badge.textContent = isActive ? '✓ Active' : 'Select';

        header.appendChild(name);
        header.appendChild(badge);

        const description = document.createElement('div');
        description.className = 'model-description';
        description.textContent = model.description;

        const specs = document.createElement('div');
        specs.className = 'model-specs';
        specs.innerHTML = `
            <span class="model-spec">💾 ${model.estimatedVRAM}GB VRAM</span>
            <span class="model-spec">📝 ${(model.contextLength / 1024).toFixed(0)}K context</span>
        `;

        card.appendChild(header);
        card.appendChild(description);
        card.appendChild(specs);

        if (!isActive) {
            card.style.cursor = 'pointer';
            card.addEventListener('click', async () => {
                card.style.opacity = '0.5';
                card.style.pointerEvents = 'none';
                try {
                    await onSelect();
                } finally {
                    card.style.opacity = '1';
                    card.style.pointerEvents = 'auto';
                }
            });
        }

        return card;
    }

    renderApiConfigSection(activeProviderName: string | null): void {
        // Only show if API provider is active or available
        if (activeProviderName !== 'api') {
            return;
        }

        const section = document.createElement('div');
        section.className = 'settings-section api-config-section';

        const title = document.createElement('div');
        title.className = 'settings-section-title';
        title.textContent = 'API Configuration';

        // Backend selection
        const backendLabel = document.createElement('label');
        backendLabel.className = 'input-label';
        backendLabel.textContent = 'API Backend';

        const backendSelect = document.createElement('select');
        backendSelect.className = 'input-select';
        backendSelect.innerHTML = `
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="ollama">Ollama (Local)</option>
        `;

        // Model selection
        const modelLabel = document.createElement('label');
        modelLabel.className = 'input-label';
        modelLabel.textContent = 'Model';

        const modelSelect = document.createElement('select');
        modelSelect.className = 'input-select';

        // Update models when backend changes
        const updateModels = (backend: string) => {
            const models: Record<string, string[]> = {
                openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
                anthropic: ['claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest', 'claude-3-opus-latest'],
                ollama: ['llama3.2', 'mistral', 'phi3', 'qwen2.5']
            };

            modelSelect.innerHTML = '';
            (models[backend] || []).forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                modelSelect.appendChild(option);
            });
        };

        backendSelect.addEventListener('change', () => {
            updateModels(backendSelect.value);
            // Show/hide API key field based on backend
            if (backendSelect.value === 'ollama') {
                apiKeyContainer.style.display = 'none';
            } else {
                apiKeyContainer.style.display = 'block';
            }
        });

        // Initialize models
        updateModels(backendSelect.value);

        // API Key input
        const apiKeyContainer = document.createElement('div');
        apiKeyContainer.className = 'input-container';

        const apiKeyLabel = document.createElement('label');
        apiKeyLabel.className = 'input-label';
        apiKeyLabel.textContent = 'API Key';

        const apiKeyInput = document.createElement('input');
        apiKeyInput.type = 'password';
        apiKeyInput.className = 'input-field';
        apiKeyInput.placeholder = 'Enter your API key';

        const apiKeyNote = document.createElement('div');
        apiKeyNote.className = 'input-note';
        apiKeyNote.textContent = '🔒 API keys are stored securely in IndexedDB and never sent to external servers except the configured API endpoint.';

        apiKeyContainer.appendChild(apiKeyLabel);
        apiKeyContainer.appendChild(apiKeyInput);
        apiKeyContainer.appendChild(apiKeyNote);

        // Endpoint input (optional)
        const endpointLabel = document.createElement('label');
        endpointLabel.className = 'input-label';
        endpointLabel.textContent = 'Custom Endpoint (Optional)';

        const endpointInput = document.createElement('input');
        endpointInput.type = 'text';
        endpointInput.className = 'input-field';
        endpointInput.placeholder = 'Leave empty for default endpoint';

        const endpointNote = document.createElement('div');
        endpointNote.className = 'input-note';
        endpointNote.textContent = 'For Ollama, use http://localhost:11434 (default). For custom OpenAI/Anthropic endpoints, enter the full URL.';

        // Save button
        const saveButton = document.createElement('button');
        saveButton.className = 'action-button primary';
        saveButton.textContent = '💾 Save API Configuration';
        saveButton.addEventListener('click', async () => {
            if (this.callbacks.onApiConfigChange) {
                const backend = backendSelect.value;
                const modelId = modelSelect.value;
                const apiKey = apiKeyInput.value;
                const endpoint = endpointInput.value;

                // Validate API key for non-Ollama backends
                if (backend !== 'ollama' && !apiKey) {
                    alert('Please enter an API key for ' + backend);
                    return;
                }

                try {
                    await this.callbacks.onApiConfigChange(backend, modelId, apiKey, endpoint);
                    alert('✅ API configuration saved successfully!');
                } catch (error) {
                    alert('❌ Failed to save API configuration: ' + (error instanceof Error ? error.message : 'Unknown error'));
                }
            }
        });

        section.appendChild(title);
        section.appendChild(backendLabel);
        section.appendChild(backendSelect);
        section.appendChild(modelLabel);
        section.appendChild(modelSelect);
        section.appendChild(apiKeyContainer);
        section.appendChild(endpointLabel);
        section.appendChild(endpointInput);
        section.appendChild(endpointNote);
        section.appendChild(saveButton);

        this.container.appendChild(section);
    }

    renderDataManagementSection(): void {
        const section = document.createElement('div');
        section.className = 'settings-section';

        const title = document.createElement('div');
        title.className = 'settings-section-title';
        title.textContent = 'Data Management';

        // Data size display container
        const dataSizeContainer = document.createElement('div');
        dataSizeContainer.className = 'data-size-container';
        dataSizeContainer.style.cssText = `
            margin: 16px 0;
            padding: 16px;
            background: rgba(0, 0, 0, 0.05);
            border-radius: 8px;
        `;

        const dataSizeTitle = document.createElement('div');
        dataSizeTitle.style.cssText = `
            font-weight: 600;
            margin-bottom: 12px;
            color: #333;
        `;
        dataSizeTitle.textContent = '📊 Current Storage Usage';

        const dataSizeContent = document.createElement('div');
        dataSizeContent.id = 'data-size-content';
        dataSizeContent.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;
        dataSizeContent.innerHTML = '<div style="color: #666;">Loading storage information...</div>';

        dataSizeContainer.appendChild(dataSizeTitle);
        dataSizeContainer.appendChild(dataSizeContent);

        // Clear data button
        const clearButton = document.createElement('button');
        clearButton.className = 'action-button secondary';
        clearButton.textContent = '🗑️ Clear All Data';
        clearButton.addEventListener('click', async () => {
            await this.showClearDataDialog();
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
        section.appendChild(dataSizeContainer);
        section.appendChild(clearDescription);
        section.appendChild(clearButton);
        section.appendChild(document.createElement('br'));
        section.appendChild(resetDescription);
        section.appendChild(resetButton);

        this.container.appendChild(section);

        // Load and display data size
        this.updateDataSizeDisplay();
    }

    private async showClearDataDialog(): Promise<void> {
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        // Create dialog
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 24px;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        `;

        const dialogTitle = document.createElement('h3');
        dialogTitle.style.cssText = `
            margin: 0 0 16px 0;
            font-size: 20px;
            color: #d32f2f;
        `;
        dialogTitle.textContent = '⚠️ Clear All Data';

        const dialogMessage = document.createElement('p');
        dialogMessage.style.cssText = `
            margin: 0 0 16px 0;
            color: #666;
            line-height: 1.5;
        `;
        dialogMessage.textContent = 'This will permanently delete:';

        const dataList = document.createElement('ul');
        dataList.style.cssText = `
            margin: 0 0 16px 0;
            padding-left: 24px;
            color: #666;
        `;
        dataList.innerHTML = `
            <li>All conversation threads and messages</li>
            <li>All settings and preferences</li>
            <li>All cached models and assets</li>
        `;

        const dataSizeInfo = document.createElement('div');
        dataSizeInfo.style.cssText = `
            margin: 16px 0;
            padding: 12px;
            background: rgba(211, 47, 47, 0.1);
            border-radius: 8px;
            font-weight: 600;
            color: #d32f2f;
        `;
        dataSizeInfo.innerHTML = '<div>Loading data size...</div>';

        const warningText = document.createElement('p');
        warningText.style.cssText = `
            margin: 16px 0;
            color: #d32f2f;
            font-weight: 600;
        `;
        warningText.textContent = 'This action cannot be undone!';

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 12px;
            justify-content: flex-end;
        `;

        const cancelButton = document.createElement('button');
        cancelButton.style.cssText = `
            padding: 10px 20px;
            border: 1px solid #ccc;
            background: white;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
        `;
        cancelButton.textContent = 'Cancel';
        cancelButton.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });

        const confirmButton = document.createElement('button');
        confirmButton.style.cssText = `
            padding: 10px 20px;
            border: none;
            background: #d32f2f;
            color: white;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
        `;
        confirmButton.textContent = 'Clear All Data';
        confirmButton.addEventListener('click', async () => {
            confirmButton.disabled = true;
            confirmButton.textContent = 'Clearing...';
            confirmButton.style.opacity = '0.6';

            try {
                await this.callbacks.onClearData();
                document.body.removeChild(overlay);
                // Update data size display after clearing
                this.updateDataSizeDisplay();
            } catch (error) {
                alert('Failed to clear data: ' + (error instanceof Error ? error.message : 'Unknown error'));
                confirmButton.disabled = false;
                confirmButton.textContent = 'Clear All Data';
                confirmButton.style.opacity = '1';
            }
        });

        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(confirmButton);

        dialog.appendChild(dialogTitle);
        dialog.appendChild(dialogMessage);
        dialog.appendChild(dataList);
        dialog.appendChild(dataSizeInfo);
        dialog.appendChild(warningText);
        dialog.appendChild(buttonContainer);

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // Load data size for dialog
        try {
            const dataSize = await this.getDataSize();
            dataSizeInfo.innerHTML = `
                <div style="font-size: 16px;">Total Storage: ${this.formatBytes(dataSize.total)}</div>
                <div style="font-size: 14px; margin-top: 4px; font-weight: normal;">
                    Conversations: ${this.formatBytes(dataSize.conversations)} | 
                    Settings: ${this.formatBytes(dataSize.settings)} | 
                    Assets: ${this.formatBytes(dataSize.assets)}
                </div>
            `;
        } catch (error) {
            dataSizeInfo.innerHTML = '<div>Unable to calculate data size</div>';
        }
    }

    private async updateDataSizeDisplay(): Promise<void> {
        const contentElement = document.getElementById('data-size-content');
        if (!contentElement) return;

        try {
            const dataSize = await this.getDataSize();

            contentElement.innerHTML = `
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(0, 0, 0, 0.1);">
                    <span style="color: #666;">💬 Conversations:</span>
                    <span style="font-weight: 600; color: #333;">${this.formatBytes(dataSize.conversations)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(0, 0, 0, 0.1);">
                    <span style="color: #666;">⚙️ Settings:</span>
                    <span style="font-weight: 600; color: #333;">${this.formatBytes(dataSize.settings)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(0, 0, 0, 0.1);">
                    <span style="color: #666;">📁 Assets:</span>
                    <span style="font-weight: 600; color: #333;">${this.formatBytes(dataSize.assets)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(0, 0, 0, 0.1);">
                    <span style="color: #666;">🗄️ Model Cache:</span>
                    <span style="font-weight: 600; color: #333;">${this.formatBytes(dataSize.modelCache)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 12px 0 0 0; margin-top: 8px; border-top: 2px solid rgba(0, 0, 0, 0.2);">
                    <span style="font-weight: 600; color: #333;">Total Storage:</span>
                    <span style="font-weight: 700; color: #1976d2; font-size: 16px;">${this.formatBytes(dataSize.total)}</span>
                </div>
            `;
        } catch (error) {
            contentElement.innerHTML = '<div style="color: #d32f2f;">Failed to load storage information</div>';
            console.error('Failed to get data size:', error);
        }
    }

    private async getDataSize(): Promise<{ conversations: number; settings: number; assets: number; modelCache: number; total: number }> {
        // This will be implemented by calling the ClearDataOperation.getDataSize() method
        // For now, we'll use a placeholder that will be wired up in the component
        if ((window as any).__getDataSize) {
            return await (window as any).__getDataSize();
        }

        // Fallback to storage estimate
        if (navigator.storage && navigator.storage.estimate) {
            const estimate = await navigator.storage.estimate();
            return {
                conversations: 0,
                settings: 0,
                assets: 0,
                modelCache: 0,
                total: estimate.usage || 0
            };
        }

        return {
            conversations: 0,
            settings: 0,
            assets: 0,
            modelCache: 0,
            total: 0
        };
    }

    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }
}
