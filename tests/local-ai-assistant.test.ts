import { describe, it, expect, beforeEach } from 'vitest';
import { LocalAIAssistant } from '../src/local-ai-assistant/index';

describe('LocalAIAssistant Web Component', () => {
    beforeEach(() => {
        // Clean up any existing instances
        document.body.innerHTML = '';
    });

    it('should be registered as a custom element', () => {
        // Requirement 5.1: Web Component with custom HTML tag
        const elementClass = customElements.get('local-ai-assistant');
        expect(elementClass).toBeDefined();
        expect(elementClass).toBe(LocalAIAssistant);
    });

    it('should create an instance with closed Shadow DOM', () => {
        // Requirement 5.2: Closed Shadow DOM
        const element = document.createElement('local-ai-assistant') as LocalAIAssistant;
        document.body.appendChild(element);

        expect(element).toBeInstanceOf(LocalAIAssistant);
        expect(element).toBeInstanceOf(HTMLElement);

        // Verify Shadow DOM is closed (shadowRoot should be null)
        expect(element.shadowRoot).toBeNull();
    });

    it('should be embeddable in the DOM', () => {
        const element = document.createElement('local-ai-assistant') as LocalAIAssistant;
        document.body.appendChild(element);

        const found = document.querySelector('local-ai-assistant');
        expect(found).toBe(element);
    });

    it('should have proper lifecycle callbacks', () => {
        const element = new LocalAIAssistant();

        // Should have connectedCallback
        expect(typeof element.connectedCallback).toBe('function');

        // Should have disconnectedCallback
        expect(typeof element.disconnectedCallback).toBe('function');
    });
});

describe('Provider UI Features', () => {
    let element: LocalAIAssistant;

    beforeEach(() => {
        document.body.innerHTML = '';
        element = document.createElement('local-ai-assistant') as LocalAIAssistant;
        document.body.appendChild(element);
    });

    describe('Provider Indicator Display', () => {
        it('should have a provider indicator element in the shadow DOM', () => {
            // Requirement 16.7: Display active provider name in UI
            // Access shadow DOM through internal property for testing
            const shadow = (element as any).shadow as ShadowRoot;
            expect(shadow).toBeDefined();

            const indicator = shadow.querySelector('[data-provider-indicator]');
            expect(indicator).toBeDefined();
        });

        it('should initially hide the provider indicator', () => {
            // Provider indicator should be hidden until a provider is initialized
            const shadow = (element as any).shadow as ShadowRoot;
            const indicator = shadow.querySelector('[data-provider-indicator]') as HTMLElement;

            expect(indicator).toBeDefined();
            expect(indicator.style.display).toBe('none');
        });

        it('should show provider indicator with correct styling for local providers', () => {
            // Requirement 16.7: Display provider type (local/api)
            const shadow = (element as any).shadow as ShadowRoot;
            const indicator = shadow.querySelector('[data-provider-indicator]') as HTMLElement;

            // Simulate provider initialization with a local provider
            const mockProvider = {
                name: 'chrome-gemini',
                type: 'local' as const,
                description: 'Chrome Built-in AI'
            };

            (element as any).updateProviderIndicator(mockProvider);

            expect(indicator.style.display).toBe('flex');
            expect(indicator.classList.contains('local')).toBe(true);
            expect(indicator.classList.contains('api')).toBe(false);
        });

        it('should show provider indicator with privacy warning for API providers', () => {
            // Requirement 16.7: Show privacy indicator for API providers
            const shadow = (element as any).shadow as ShadowRoot;
            const indicator = shadow.querySelector('[data-provider-indicator]') as HTMLElement;

            // Simulate provider initialization with an API provider
            const mockProvider = {
                name: 'api',
                type: 'api' as const,
                description: 'External API'
            };

            (element as any).updateProviderIndicator(mockProvider);

            expect(indicator.style.display).toBe('flex');
            expect(indicator.classList.contains('api')).toBe(true);
            expect(indicator.classList.contains('local')).toBe(false);

            // Check for privacy warning
            const privacyWarning = indicator.querySelector('.privacy-warning');
            expect(privacyWarning).toBeDefined();
            expect(privacyWarning?.textContent).toContain('⚠️');
        });

        it('should display the provider description in the indicator', () => {
            // Requirement 16.7: Display active provider name
            const shadow = (element as any).shadow as ShadowRoot;
            const indicator = shadow.querySelector('[data-provider-indicator]') as HTMLElement;

            const mockProvider = {
                name: 'webllm',
                type: 'local' as const,
                description: 'WebLLM Local Inference'
            };

            (element as any).updateProviderIndicator(mockProvider);

            const badge = indicator.querySelector('.provider-badge');
            expect(badge).toBeDefined();
            expect(badge?.textContent).toContain('WebLLM Local Inference');
        });
    });

    describe('Provider Switching UI', () => {
        it('should have a settings button in the header', () => {
            // Requirement 16.8: Allow manual provider switching
            const shadow = (element as any).shadow as ShadowRoot;
            const settingsButton = shadow.querySelector('.settings-button');

            expect(settingsButton).toBeDefined();
            expect(settingsButton?.getAttribute('aria-label')).toBe('Open settings');
        });

        it('should have a settings panel that is initially hidden', () => {
            // Requirement 16.8: Settings interface for provider selection
            const shadow = (element as any).shadow as ShadowRoot;
            const settingsPanel = shadow.querySelector('[data-settings-panel]') as HTMLElement;

            expect(settingsPanel).toBeDefined();
            expect(settingsPanel.classList.contains('hidden')).toBe(true);
        });

        it('should toggle settings panel visibility when settings button is clicked', () => {
            // Requirement 16.8: Allow manual provider switching
            const shadow = (element as any).shadow as ShadowRoot;
            const settingsButton = shadow.querySelector('.settings-button') as HTMLButtonElement;
            const settingsPanel = shadow.querySelector('[data-settings-panel]') as HTMLElement;

            expect(settingsPanel.classList.contains('hidden')).toBe(true);

            // Click to open
            settingsButton.click();
            expect(settingsPanel.classList.contains('hidden')).toBe(false);

            // Click to close
            settingsButton.click();
            expect(settingsPanel.classList.contains('hidden')).toBe(true);
        });

        it('should have a settings content container in the settings panel', async () => {
            // Requirement 16.8: Settings UI with provider list and hardware diagnostics
            const shadow = (element as any).shadow as ShadowRoot;
            const settingsContent = shadow.querySelector('.settings-content');

            expect(settingsContent).toBeDefined();
            expect(settingsContent).not.toBeNull();

            // Settings content should be a container that will be populated by SettingsUI
            expect(settingsContent?.className).toBe('settings-content');
        });

        it('should close settings panel when close button is clicked', () => {
            // Requirement 16.8: Settings UI interaction
            const shadow = (element as any).shadow as ShadowRoot;
            const settingsButton = shadow.querySelector('.settings-button') as HTMLButtonElement;
            const settingsPanel = shadow.querySelector('[data-settings-panel]') as HTMLElement;
            const closeButton = shadow.querySelector('.settings-close') as HTMLButtonElement;

            // Open settings
            settingsButton.click();
            expect(settingsPanel.classList.contains('hidden')).toBe(false);

            // Close via close button
            closeButton.click();
            expect(settingsPanel.classList.contains('hidden')).toBe(true);
        });

        it('should have proper ARIA labels for accessibility', () => {
            // Accessibility requirement
            const shadow = (element as any).shadow as ShadowRoot;
            const settingsButton = shadow.querySelector('.settings-button');
            const closeButton = shadow.querySelector('.settings-close');

            expect(settingsButton?.getAttribute('aria-label')).toBe('Open settings');
            expect(closeButton?.getAttribute('aria-label')).toBe('Close settings');
        });
    });
});
