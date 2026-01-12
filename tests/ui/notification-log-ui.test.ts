import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsSections } from '../../src/ui/settings-ui-sections';
import type { SettingsConfig, SettingsCallbacks } from '../../src/ui/settings-ui';
import { NotificationLogger } from '../../src/ui/notification-logger';

describe('Notification Log UI', () => {
    let container: HTMLElement;
    let callbacks: SettingsCallbacks;
    let config: SettingsConfig;
    let sections: SettingsSections;

    beforeEach(() => {
        container = document.createElement('div');
        callbacks = {
            onProviderSwitch: vi.fn(),
            onSettingsChange: vi.fn(),
            onClearData: vi.fn(),
            onResetApplication: vi.fn(),
        };
        config = {
            temperature: 0.7,
            topK: 40,
            enabledFeatures: ['text-chat'],
        };
        sections = new SettingsSections(container, callbacks, null, config);
    });

    it('should render notification log section with filter and clear button', async () => {
        await sections.renderNotificationLogSection();

        expect(container.querySelector('.settings-section-title')?.textContent).toBe('Notification Log');

        const filterSelect = container.querySelector('select') as HTMLSelectElement;
        expect(filterSelect).toBeTruthy();
        expect(filterSelect.options.length).toBe(4);
        expect(filterSelect.options[0].value).toBe('all');
        expect(filterSelect.options[1].value).toBe('error');
        expect(filterSelect.options[2].value).toBe('warning');
        expect(filterSelect.options[3].value).toBe('info');

        const clearButton = container.querySelector('button');
        expect(clearButton?.textContent).toContain('Clear Log');

        const logContainer = container.querySelector('.notification-log-container');
        expect(logContainer).toBeTruthy();
    });

    it('should display empty state when no notifications exist', async () => {
        await sections.renderNotificationLogSection();

        const logContainer = container.querySelector('.notification-log-container');
        expect(logContainer?.textContent).toContain('No notifications to display');
    });

    it('should display notifications with correct formatting', async () => {
        const logger = new NotificationLogger();

        await logger.log({
            id: 'test-1',
            type: 'error',
            title: 'Test Error',
            message: 'This is a test error message',
            timestamp: Date.now(),
            duration: 5000,
        });

        await sections.renderNotificationLogSection();

        const logContainer = container.querySelector('.notification-log-container');
        expect(logContainer?.textContent).toContain('Test Error');
        expect(logContainer?.textContent).toContain('This is a test error message');
    });

    it('should filter notifications by type', async () => {
        const logger = new NotificationLogger();

        await logger.log({
            id: 'test-error',
            type: 'error',
            title: 'Error Notification',
            message: 'Error message',
            timestamp: Date.now(),
            duration: 5000,
        });

        await logger.log({
            id: 'test-warning',
            type: 'warning',
            title: 'Warning Notification',
            message: 'Warning message',
            timestamp: Date.now(),
            duration: 5000,
        });

        await sections.renderNotificationLogSection();

        const filterSelect = container.querySelector('select') as HTMLSelectElement;
        filterSelect.value = 'error';
        filterSelect.dispatchEvent(new Event('change'));

        await new Promise(resolve => setTimeout(resolve, 100));

        const logContainer = container.querySelector('.notification-log-container');
        expect(logContainer?.textContent).toContain('Error Notification');
        expect(logContainer?.textContent).not.toContain('Warning Notification');
    });
});
