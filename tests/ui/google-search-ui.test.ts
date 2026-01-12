/**
 * Tests for Google Custom Search UI Configuration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsSections } from '../../src/ui/settings-ui-sections';
import type { SettingsConfig, SettingsCallbacks } from '../../src/ui/settings-ui';

describe('Google Custom Search UI Configuration', () => {
    let container: HTMLElement;
    let callbacks: SettingsCallbacks;
    let settingsSections: SettingsSections;
    let currentConfig: SettingsConfig;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);

        currentConfig = {
            temperature: 0.7,
            topK: 40,
            enabledFeatures: [],
        };

        callbacks = {
            onSettingsChange: vi.fn(),
            onProviderSwitch: vi.fn(),
            onSearchToggle: vi.fn(),
            onSearchApiKeyChange: vi.fn(),
            onClearData: vi.fn(),
            onResetApplication: vi.fn(),
        };

        settingsSections = new SettingsSections(
            container,
            callbacks,
            null,
            currentConfig
        );

        // Mock window functions for search settings
        (window as any).__getSearchEnabled = vi.fn().mockResolvedValue(false);
        (window as any).__getSearchProvider = vi.fn().mockResolvedValue('brave');
        (window as any).__getSearchApiKey = vi.fn().mockResolvedValue('');
        (window as any).__getGoogleSearchApiKey = vi.fn().mockResolvedValue('');
        (window as any).__getGoogleSearchEngineId = vi.fn().mockResolvedValue('');
        (window as any).__setGoogleSearchCredentials = vi.fn().mockResolvedValue(undefined);
        (window as any).__setSearchProvider = vi.fn().mockResolvedValue(undefined);
    });

    describe('Google Custom Search Fields', () => {
        it('should render Google API key input field', async () => {
            settingsSections.renderSearchSection();

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 50));

            const googleApiKeyInput = container.querySelector('#google-api-key') as HTMLInputElement;
            expect(googleApiKeyInput).toBeTruthy();
            expect(googleApiKeyInput.type).toBe('password');
            expect(googleApiKeyInput.placeholder).toContain('Google API key');
        });

        it('should render Search Engine ID (cx) input field', async () => {
            settingsSections.renderSearchSection();

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 50));

            const googleCxInput = container.querySelector('#google-cx') as HTMLInputElement;
            expect(googleCxInput).toBeTruthy();
            expect(googleCxInput.type).toBe('text');
            expect(googleCxInput.placeholder).toContain('Search Engine ID');
        });

        it('should display Google-specific setup instructions', async () => {
            settingsSections.renderSearchSection();

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 50));

            const googleFields = container.querySelector('#google-fields');
            expect(googleFields).toBeTruthy();

            const noteText = googleFields?.textContent || '';
            expect(noteText).toContain('Google Cloud Console');
            expect(noteText).toContain('Programmable Search Engine');
            expect(noteText).toContain('Search Engine ID');
            expect(noteText).toContain('cx parameter');
        });

        it('should include links to Google setup pages', async () => {
            settingsSections.renderSearchSection();

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 50));

            const googleFields = container.querySelector('#google-fields');
            const links = googleFields?.querySelectorAll('a');

            expect(links).toBeTruthy();
            expect(links!.length).toBeGreaterThanOrEqual(2);

            const linkUrls = Array.from(links!).map(link => link.href);
            expect(linkUrls.some(url => url.includes('console.cloud.google.com'))).toBe(true);
            expect(linkUrls.some(url => url.includes('programmablesearchengine.google.com'))).toBe(true);
        });

        it('should display security notice for credentials', async () => {
            settingsSections.renderSearchSection();

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 50));

            const googleFields = container.querySelector('#google-fields');
            const noteText = googleFields?.textContent || '';

            expect(noteText).toContain('stored securely in IndexedDB');
            expect(noteText).toContain('never sent to external servers');
        });

        it('should have save button for Google credentials', async () => {
            settingsSections.renderSearchSection();

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 50));

            const googleFields = container.querySelector('#google-fields');
            const saveButton = Array.from(googleFields?.querySelectorAll('button') || [])
                .find(btn => btn.textContent?.includes('Save Google Credentials'));

            expect(saveButton).toBeTruthy();
        });

        it('should call setGoogleSearchCredentials when save button is clicked', async () => {
            settingsSections.renderSearchSection();

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 50));

            const googleApiKeyInput = container.querySelector('#google-api-key') as HTMLInputElement;
            const googleCxInput = container.querySelector('#google-cx') as HTMLInputElement;

            googleApiKeyInput.value = 'test-api-key';
            googleCxInput.value = 'test-cx-id';

            const googleFields = container.querySelector('#google-fields');
            const saveButton = Array.from(googleFields?.querySelectorAll('button') || [])
                .find(btn => btn.textContent?.includes('Save Google Credentials')) as HTMLButtonElement;

            saveButton.click();

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 50));

            expect((window as any).__setGoogleSearchCredentials).toHaveBeenCalledWith(
                'test-api-key',
                'test-cx-id'
            );
        });

        it('should not save when API key is missing', async () => {
            settingsSections.renderSearchSection();

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 50));

            const googleCxInput = container.querySelector('#google-cx') as HTMLInputElement;
            googleCxInput.value = 'test-cx-id';

            const googleFields = container.querySelector('#google-fields');
            const saveButton = Array.from(googleFields?.querySelectorAll('button') || [])
                .find(btn => btn.textContent?.includes('Save Google Credentials')) as HTMLButtonElement;

            // Mock alert
            const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => { });

            saveButton.click();

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(alertSpy).toHaveBeenCalledWith('Please enter both API key and Search Engine ID');
            expect((window as any).__setGoogleSearchCredentials).not.toHaveBeenCalled();

            alertSpy.mockRestore();
        });

        it('should not save when Search Engine ID is missing', async () => {
            settingsSections.renderSearchSection();

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 50));

            const googleApiKeyInput = container.querySelector('#google-api-key') as HTMLInputElement;
            googleApiKeyInput.value = 'test-api-key';

            const googleFields = container.querySelector('#google-fields');
            const saveButton = Array.from(googleFields?.querySelectorAll('button') || [])
                .find(btn => btn.textContent?.includes('Save Google Credentials')) as HTMLButtonElement;

            // Mock alert
            const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => { });

            saveButton.click();

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(alertSpy).toHaveBeenCalledWith('Please enter both API key and Search Engine ID');
            expect((window as any).__setGoogleSearchCredentials).not.toHaveBeenCalled();

            alertSpy.mockRestore();
        });
    });

    describe('Provider Selection and Field Visibility', () => {
        it('should show Google fields when Google provider is selected', async () => {
            (window as any).__getSearchProvider = vi.fn().mockResolvedValue('google');

            settingsSections.renderSearchSection();

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 50));

            const googleFields = container.querySelector('#google-fields') as HTMLElement;
            const braveFields = container.querySelector('#brave-fields') as HTMLElement;

            expect(googleFields.style.display).not.toBe('none');
            expect(braveFields.style.display).toBe('none');
        });

        it('should hide Google fields when Brave provider is selected', async () => {
            (window as any).__getSearchProvider = vi.fn().mockResolvedValue('brave');

            settingsSections.renderSearchSection();

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 50));

            const googleFields = container.querySelector('#google-fields') as HTMLElement;
            const braveFields = container.querySelector('#brave-fields') as HTMLElement;

            expect(googleFields.style.display).toBe('none');
            expect(braveFields.style.display).not.toBe('none');
        });

        it('should switch fields when provider selection changes', async () => {
            settingsSections.renderSearchSection();

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 50));

            const providerSelect = container.querySelector('#search-provider-select') as HTMLSelectElement;
            const googleFields = container.querySelector('#google-fields') as HTMLElement;
            const braveFields = container.querySelector('#brave-fields') as HTMLElement;

            // Initially Brave should be selected
            expect(braveFields.style.display).not.toBe('none');
            expect(googleFields.style.display).toBe('none');

            // Change to Google
            providerSelect.value = 'google';
            providerSelect.dispatchEvent(new Event('change'));

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(googleFields.style.display).not.toBe('none');
            expect(braveFields.style.display).toBe('none');
        });

        it('should save provider preference when changed', async () => {
            settingsSections.renderSearchSection();

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 50));

            const providerSelect = container.querySelector('#search-provider-select') as HTMLSelectElement;

            providerSelect.value = 'google';
            providerSelect.dispatchEvent(new Event('change'));

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 50));

            expect((window as any).__setSearchProvider).toHaveBeenCalledWith('google');
        });
    });

    describe('Credential Loading', () => {
        it('should load existing Google API key on render', async () => {
            (window as any).__getGoogleSearchApiKey = vi.fn().mockResolvedValue('existing-api-key');

            settingsSections.renderSearchSection();

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 50));

            const googleApiKeyInput = container.querySelector('#google-api-key') as HTMLInputElement;
            expect(googleApiKeyInput.value).toBe('existing-api-key');
        });

        it('should load existing Search Engine ID on render', async () => {
            (window as any).__getGoogleSearchEngineId = vi.fn().mockResolvedValue('existing-cx-id');

            settingsSections.renderSearchSection();

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 50));

            const googleCxInput = container.querySelector('#google-cx') as HTMLInputElement;
            expect(googleCxInput.value).toBe('existing-cx-id');
        });
    });
});
