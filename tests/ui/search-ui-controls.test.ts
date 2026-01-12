import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SearchIndicator } from '../../src/ui/search-indicator';
import { SettingsSections } from '../../src/ui/settings-ui-sections';
import type { SettingsConfig, SettingsCallbacks } from '../../src/ui/settings-ui';

describe('Search UI Controls', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    describe('SearchIndicator', () => {
        describe('Visibility Control', () => {
            // Requirement 1.6: Display visual indicator when search is active
            it('should show indicator when show() is called', () => {
                const indicator = new SearchIndicator(container);
                indicator.show();

                expect(indicator.isVisible()).toBe(true);
                expect(container.querySelector('.search-indicator')).toBeTruthy();
            });

            it('should hide indicator when hide() is called', () => {
                const indicator = new SearchIndicator(container);
                indicator.show();
                indicator.hide();

                expect(indicator.isVisible()).toBe(false);
                const element = container.querySelector('.search-indicator') as HTMLElement | null;
                expect(element?.style.display).toBe('none');
            });

            it('should remove indicator from DOM when remove() is called', () => {
                const indicator = new SearchIndicator(container);
                indicator.show();
                indicator.remove();

                expect(indicator.isVisible()).toBe(false);
                expect(container.querySelector('.search-indicator')).toBeFalsy();
            });

            it('should not create duplicate indicators when show() is called multiple times', () => {
                const indicator = new SearchIndicator(container);
                indicator.show();
                indicator.show();

                const indicators = container.querySelectorAll('.search-indicator');
                expect(indicators.length).toBe(1);
            });

            it('should display search icon and text', () => {
                const indicator = new SearchIndicator(container);
                indicator.show();

                const element = container.querySelector('.search-indicator');
                expect(element?.textContent).toContain('🔍');
                expect(element?.textContent).toContain('Searching web...');
            });

            it('should handle show after remove', () => {
                const indicator = new SearchIndicator(container);
                indicator.show();
                indicator.remove();
                indicator.show();

                expect(indicator.isVisible()).toBe(true);
                expect(container.querySelector('.search-indicator')).toBeTruthy();
            });
        });

        describe('Indicator Styling', () => {
            it('should have the search-indicator class', () => {
                const indicator = new SearchIndicator(container);
                indicator.show();

                const element = container.querySelector('.search-indicator');
                expect(element).toBeTruthy();
                expect(element?.className).toBe('search-indicator');
            });

            it('should contain the search icon and text', () => {
                const indicator = new SearchIndicator(container);
                indicator.show();

                const element = container.querySelector('.search-indicator');
                expect(element?.textContent).toContain('🔍');
                expect(element?.textContent).toContain('Searching web...');
            });
        });
    });

    describe('Search Toggle in Settings', () => {
        let callbacks: SettingsCallbacks;
        let settingsSections: SettingsSections;
        const mockConfig: SettingsConfig = {
            temperature: 0.7,
            topK: 40,
            enabledFeatures: [],
        };

        beforeEach(() => {
            callbacks = {
                onSettingsChange: vi.fn(),
                onProviderSwitch: vi.fn(),
                onWebLLMModelChange: vi.fn(),
                onApiConfigChange: vi.fn(),
                onSearchToggle: vi.fn(),
                onSearchApiKeyChange: vi.fn(),
                onClearData: vi.fn(),
                onResetApplication: vi.fn(),
            };

            settingsSections = new SettingsSections(
                container,
                callbacks,
                null,
                mockConfig
            );
        });

        describe('Toggle State Changes', () => {
            // Requirement 1.4: Provide UI toggle to enable/disable web search
            it('should render search toggle in settings', () => {
                settingsSections.renderSearchSection();

                const toggle = container.querySelector('#search-toggle') as HTMLInputElement;
                expect(toggle).toBeTruthy();
                expect(toggle.type).toBe('checkbox');
            });

            it('should call onSearchToggle callback when toggle is changed', async () => {
                settingsSections.renderSearchSection();

                const toggle = container.querySelector('#search-toggle') as HTMLInputElement;
                toggle.checked = true;
                toggle.dispatchEvent(new Event('change'));

                // Wait for async callback
                await new Promise(resolve => setTimeout(resolve, 10));

                expect(callbacks.onSearchToggle).toHaveBeenCalledWith(true);
            });

            it('should handle toggle state changes from false to true', async () => {
                settingsSections.renderSearchSection();

                const toggle = container.querySelector('#search-toggle') as HTMLInputElement;
                expect(toggle.checked).toBe(false);

                toggle.checked = true;
                toggle.dispatchEvent(new Event('change'));

                await new Promise(resolve => setTimeout(resolve, 10));

                expect(callbacks.onSearchToggle).toHaveBeenCalledWith(true);
            });

            it('should handle toggle state changes from true to false', async () => {
                settingsSections.renderSearchSection();

                const toggle = container.querySelector('#search-toggle') as HTMLInputElement;
                toggle.checked = true;
                toggle.dispatchEvent(new Event('change'));

                await new Promise(resolve => setTimeout(resolve, 10));

                toggle.checked = false;
                toggle.dispatchEvent(new Event('change'));

                await new Promise(resolve => setTimeout(resolve, 10));

                expect(callbacks.onSearchToggle).toHaveBeenCalledWith(false);
            });

            it('should display toggle label and description', () => {
                settingsSections.renderSearchSection();

                const section = container.querySelector('.settings-section');
                expect(section?.textContent).toContain('Enable Web Search');
                expect(section?.textContent).toContain('Allow the assistant to search the web');
            });
        });

        describe('API Key Storage', () => {
            // Requirement 1.1: Store API key securely
            it('should render API key input field', () => {
                settingsSections.renderSearchSection();

                const apiKeyInput = container.querySelector('#search-api-key') as HTMLInputElement;
                expect(apiKeyInput).toBeTruthy();
                expect(apiKeyInput.type).toBe('password');
            });

            it('should call onSearchApiKeyChange when save button is clicked', async () => {
                settingsSections.renderSearchSection();

                const apiKeyInput = container.querySelector('#search-api-key') as HTMLInputElement;
                apiKeyInput.value = 'test-api-key-123';

                const saveButton = Array.from(container.querySelectorAll('button')).find(
                    btn => btn.textContent?.includes('Save API Key')
                ) as HTMLButtonElement;

                expect(saveButton).toBeTruthy();

                saveButton.click();

                await new Promise(resolve => setTimeout(resolve, 10));

                expect(callbacks.onSearchApiKeyChange).toHaveBeenCalledWith('test-api-key-123');
            });

            it('should trim whitespace from API key', async () => {
                settingsSections.renderSearchSection();

                const apiKeyInput = container.querySelector('#search-api-key') as HTMLInputElement;
                apiKeyInput.value = '  test-api-key-123  ';

                const saveButton = Array.from(container.querySelectorAll('button')).find(
                    btn => btn.textContent?.includes('Save API Key')
                ) as HTMLButtonElement;

                saveButton.click();

                await new Promise(resolve => setTimeout(resolve, 10));

                expect(callbacks.onSearchApiKeyChange).toHaveBeenCalledWith('test-api-key-123');
            });

            it('should display security notice for API key', () => {
                settingsSections.renderSearchSection();

                const section = container.querySelector('.settings-section');
                expect(section?.textContent).toContain('🔒');
                expect(section?.textContent).toContain('stored securely in IndexedDB');
            });

            it('should display link to get API key', () => {
                settingsSections.renderSearchSection();

                const link = container.querySelector('a[href="https://api.search.brave.com/"]') as HTMLAnchorElement;
                expect(link).toBeTruthy();
                expect(link.textContent).toContain('api.search.brave.com');
            });

            it('should not save empty API key', async () => {
                settingsSections.renderSearchSection();

                const apiKeyInput = container.querySelector('#search-api-key') as HTMLInputElement;
                apiKeyInput.value = '';

                const saveButton = Array.from(container.querySelectorAll('button')).find(
                    btn => btn.textContent?.includes('Save API Key')
                ) as HTMLButtonElement;

                // Mock alert to prevent test output
                const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => { });

                saveButton.click();

                await new Promise(resolve => setTimeout(resolve, 10));

                expect(alertSpy).toHaveBeenCalledWith('Please enter an API key');
                expect(callbacks.onSearchApiKeyChange).not.toHaveBeenCalled();

                alertSpy.mockRestore();
            });

            it('should handle API key save errors gracefully', async () => {
                const error = new Error('Storage failed');
                (callbacks.onSearchApiKeyChange as any).mockRejectedValueOnce(error);

                settingsSections.renderSearchSection();

                const apiKeyInput = container.querySelector('#search-api-key') as HTMLInputElement;
                apiKeyInput.value = 'test-key';

                const saveButton = Array.from(container.querySelectorAll('button')).find(
                    btn => btn.textContent?.includes('Save API Key')
                ) as HTMLButtonElement;

                const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => { });

                saveButton.click();

                await new Promise(resolve => setTimeout(resolve, 10));

                expect(alertSpy).toHaveBeenCalledWith(
                    expect.stringContaining('Failed to save API key')
                );

                alertSpy.mockRestore();
            });
        });

        describe('Search Section Layout', () => {
            it('should render search section with correct title', () => {
                settingsSections.renderSearchSection();

                const title = container.querySelector('.settings-section-title');
                expect(title?.textContent).toBe('Web Search');
            });

            it('should render both toggle and API key sections', () => {
                settingsSections.renderSearchSection();

                const toggleContainer = container.querySelector('.feature-toggle');
                const apiKeyContainer = container.querySelector('.input-container');

                expect(toggleContainer).toBeTruthy();
                expect(apiKeyContainer).toBeTruthy();
            });

            it('should have proper spacing between sections', () => {
                settingsSections.renderSearchSection();

                const apiKeyContainer = container.querySelector('.input-container') as HTMLElement;
                expect(apiKeyContainer.style.marginTop).toBe('16px');
            });
        });
    });

    describe('Integration Tests', () => {
        it('should coordinate between toggle and indicator', () => {
            const indicator = new SearchIndicator(container);

            // Simulate search starting
            indicator.show();
            expect(indicator.isVisible()).toBe(true);

            // Simulate search completing
            indicator.hide();
            expect(indicator.isVisible()).toBe(false);
        });

        it('should handle rapid toggle changes', async () => {
            const callbacks: SettingsCallbacks = {
                onSettingsChange: vi.fn(),
                onProviderSwitch: vi.fn(),
                onWebLLMModelChange: vi.fn(),
                onApiConfigChange: vi.fn(),
                onSearchToggle: vi.fn(),
                onSearchApiKeyChange: vi.fn(),
                onClearData: vi.fn(),
                onResetApplication: vi.fn(),
            };

            const settingsSections = new SettingsSections(
                container,
                callbacks,
                null,
                { temperature: 0.7, topK: 40, enabledFeatures: [] }
            );

            settingsSections.renderSearchSection();

            const toggle = container.querySelector('#search-toggle') as HTMLInputElement;

            // Rapid toggles
            toggle.checked = true;
            toggle.dispatchEvent(new Event('change'));
            toggle.checked = false;
            toggle.dispatchEvent(new Event('change'));
            toggle.checked = true;
            toggle.dispatchEvent(new Event('change'));

            await new Promise(resolve => setTimeout(resolve, 50));

            expect(callbacks.onSearchToggle).toHaveBeenCalledTimes(3);
        });
    });
});
