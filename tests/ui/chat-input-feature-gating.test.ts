import { describe, it, expect, beforeEach } from 'vitest';
import { ChatUI } from '../../src/ui/chat-ui';

describe('ChatUI - Feature Gating', () => {
    let container: HTMLElement;
    let chatUI: ChatUI;
    let sendMessageCalled: boolean;

    beforeEach(() => {
        container = document.createElement('div');
        sendMessageCalled = false;
        chatUI = new ChatUI(container, {
            onSendMessage: () => {
                sendMessageCalled = true;
            }
        });
    });

    it('should enable input by default', () => {
        expect(chatUI.isInputCurrentlyEnabled()).toBe(true);
    });

    it('should disable input when text-chat feature is disabled', () => {
        chatUI.disableInput('feature-disabled');
        expect(chatUI.isInputCurrentlyEnabled()).toBe(false);
    });

    it('should show overlay message when disabled due to feature', () => {
        chatUI.disableInput('feature-disabled');
        const overlay = container.querySelector('.input-overlay');
        expect(overlay).toBeTruthy();
        expect(overlay?.textContent).toContain('Text chat is disabled');
    });

    it('should show overlay message when disabled due to error', () => {
        chatUI.disableInput('error');
        const overlay = container.querySelector('.input-overlay');
        expect(overlay).toBeTruthy();
        expect(overlay?.textContent).toContain('temporarily unavailable');
    });

    it('should show custom error message when provided', () => {
        const customMessage = 'Custom error message';
        chatUI.disableInput('error', customMessage);
        const overlay = container.querySelector('.input-overlay');
        expect(overlay?.textContent).toBe(customMessage);
    });

    it('should re-enable input after being disabled', () => {
        chatUI.disableInput('feature-disabled');
        expect(chatUI.isInputCurrentlyEnabled()).toBe(false);

        chatUI.enableInput();
        expect(chatUI.isInputCurrentlyEnabled()).toBe(true);
    });

    it('should hide overlay when input is re-enabled', () => {
        chatUI.disableInput('feature-disabled');
        const overlay = container.querySelector('.input-overlay') as HTMLElement;
        expect(overlay.style.display).toBe('flex');

        chatUI.enableInput();
        expect(overlay.style.display).toBe('none');
    });

    it('should disable textarea and button when input is disabled', () => {
        chatUI.disableInput('feature-disabled');

        const textarea = container.querySelector('textarea');
        const button = container.querySelector('button');

        expect(textarea?.disabled).toBe(true);
        expect(button?.disabled).toBe(true);
    });

    it('should enable textarea and button when input is enabled', () => {
        chatUI.disableInput('feature-disabled');
        chatUI.enableInput();

        const textarea = container.querySelector('textarea');
        const button = container.querySelector('button');

        expect(textarea?.disabled).toBe(false);
        expect(button?.disabled).toBe(false);
    });

    it('should prevent message sending when input is disabled', () => {
        const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
        const button = container.querySelector('button') as HTMLButtonElement;

        textarea.value = 'Test message';
        chatUI.disableInput('feature-disabled');

        button.click();
        expect(sendMessageCalled).toBe(false);
    });

    it('should allow message sending when input is enabled', () => {
        const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
        const button = container.querySelector('button') as HTMLButtonElement;

        textarea.value = 'Test message';
        button.click();

        expect(sendMessageCalled).toBe(true);
    });
});
