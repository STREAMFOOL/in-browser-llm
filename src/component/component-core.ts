import type { Message } from '../ui/chat-ui';
import type { ModelProvider } from '../providers/model-provider';
import type { SettingsConfig } from '../ui/settings-ui';
import type { HardwareProfile, Feature } from '../utils/hardware-diagnostics';
import { HardwareDiagnostics } from '../utils/hardware-diagnostics';

export class ComponentCore {
    private shadow: ShadowRoot;
    private headerText: HTMLElement | null = null;
    private messageIdCounter: number;

    constructor(shadow: ShadowRoot, messageIdCounter: number = 0) {
        this.shadow = shadow;
        this.messageIdCounter = messageIdCounter;
    }

    getMessageIdCounter(): number {
        return this.messageIdCounter;
    }

    incrementMessageIdCounter(): number {
        return this.messageIdCounter++;
    }

    setHeaderText(element: HTMLElement): void {
        this.headerText = element;
    }

    updateHeaderText(text: string): void {
        if (this.headerText) {
            this.headerText.textContent = text;
        }
    }

    updateProviderIndicator(provider: ModelProvider): void {
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

    validateFeatures(
        config: SettingsConfig,
        hardwareProfile: HardwareProfile | null
    ): { validConfig: SettingsConfig; invalidFeatures: Feature[] } {
        if (!hardwareProfile) {
            return { validConfig: config, invalidFeatures: [] };
        }

        const invalidFeatures: Feature[] = [];
        for (const feature of config.enabledFeatures) {
            if (!HardwareDiagnostics.canSupport(feature, hardwareProfile)) {
                invalidFeatures.push(feature);
            }
        }

        if (invalidFeatures.length > 0) {
            const validConfig = {
                ...config,
                enabledFeatures: config.enabledFeatures.filter(
                    f => !invalidFeatures.includes(f)
                )
            };
            return { validConfig, invalidFeatures };
        }

        return { validConfig: config, invalidFeatures: [] };
    }

    createWarningMessage(invalidFeatures: Feature[]): Message {
        return {
            id: `msg-${this.messageIdCounter++}`,
            role: 'assistant',
            content: `⚠️ **Hardware Limitation**\n\nThe following features were disabled due to insufficient hardware:\n\n${invalidFeatures.map(f => `- ${f}`).join('\n')}\n\nPlease check the hardware requirements in settings.`,
            timestamp: Date.now()
        };
    }

    createWelcomeMessage(): Message {
        return {
            id: `msg-${this.messageIdCounter++}`,
            role: 'assistant',
            content: '👋 Hello! I\'m your local AI assistant. How can I help you today?',
            timestamp: Date.now()
        };
    }

    createProviderSwitchMessage(providerDescription: string): Message {
        return {
            id: `msg-${this.messageIdCounter++}`,
            role: 'assistant',
            content: `✅ Switched to **${providerDescription}**. All future messages will use this provider.`,
            timestamp: Date.now()
        };
    }

    createDataClearedMessage(): Message {
        return {
            id: `msg-${this.messageIdCounter++}`,
            role: 'assistant',
            content: '✅ **All data cleared successfully**\n\nAll conversations, cached models, and settings have been deleted.',
            timestamp: Date.now()
        };
    }

    createDataClearErrorMessage(error: unknown): Message {
        return {
            id: `msg-${this.messageIdCounter++}`,
            role: 'assistant',
            content: `⚠️ **Failed to clear data**: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: Date.now()
        };
    }

    createNoProviderMessage(): Message {
        return {
            id: `msg-${this.messageIdCounter++}`,
            role: 'assistant',
            content: '⚠️ **AI Model Not Available**\n\nNo AI provider is currently available. This could be because:\n\n- Chrome built-in AI is not enabled in your browser\n- WebLLM couldn\'t initialize (WebGPU not available)\n- The model is still downloading\n\nPlease check the initialization status above for more details.',
            timestamp: Date.now()
        };
    }

    createGPURecoveryMessage(): Message {
        return {
            id: `msg-${this.messageIdCounter++}`,
            role: 'assistant',
            content: '🔄 **GPU Recovery in Progress**\n\nThe GPU connection was lost and is being reinitialized. Please wait...',
            timestamp: Date.now()
        };
    }

    createGPURecoverySuccessMessage(): Message {
        return {
            id: `msg-${this.messageIdCounter++}`,
            role: 'assistant',
            content: '✅ **GPU Recovery Successful**\n\nThe GPU has been reinitialized. You can continue using the assistant.',
            timestamp: Date.now()
        };
    }

    createGPURecoveryFailureMessage(): Message {
        return {
            id: `msg-${this.messageIdCounter++}`,
            role: 'assistant',
            content: '⚠️ **GPU Recovery Failed**\n\nThe GPU could not be reinitialized. You may need to reset the application or restart your browser.',
            timestamp: Date.now()
        };
    }
}
