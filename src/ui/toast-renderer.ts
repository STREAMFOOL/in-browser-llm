/**
 * Toast Renderer
 * Handles DOM rendering and animations for toast notifications
 */

import type { Notification, NotificationType, StorageInfo, NotificationAction } from './notification-types';

export interface ToastRenderer {
    render(notification: Notification, index: number): void;
    animateOut(id: string, onComplete: () => void): void;
    remove(id: string): void;
    updatePosition(id: string, index: number): void;
    pauseTimer(id: string): void;
    resumeTimer(id: string): void;
    setTimerCallbacks(id: string, pause: () => void, resume: () => void): void;
}

export class ToastRendererImpl implements ToastRenderer {
    private container: HTMLElement;
    private readonly TOAST_HEIGHT = 100;
    private readonly ANIMATION_DURATION = 300;
    private timerCallbacks: Map<string, { pause: () => void; resume: () => void }> = new Map();

    constructor(shadowRoot: ShadowRoot) {
        this.container = this.createContainer(shadowRoot);
    }

    private createContainer(shadowRoot: ShadowRoot): HTMLElement {
        const container = document.createElement('div');
        container.className = `
            fixed bottom-4 right-4 z-50
            flex flex-col-reverse gap-2
            pointer-events-none
        `;

        // Add inline styles to ensure proper positioning
        container.style.cssText = `
            position: fixed;
            bottom: 1rem;
            right: 1rem;
            z-index: 50;
            display: flex;
            flex-direction: column-reverse;
            gap: 0.5rem;
            pointer-events: none;
        `;

        shadowRoot.appendChild(container);
        return container;
    }

    render(notification: Notification, index: number): void {
        const toast = this.createToast(notification);
        toast.style.transform = `translateY(${-index * this.TOAST_HEIGHT}px)`;
        toast.style.animation = 'slideInRight 0.3s ease-out';

        // Wire up event handlers
        toast.addEventListener('mouseenter', () => this.pauseTimer(notification.id));
        toast.addEventListener('mouseleave', () => this.resumeTimer(notification.id));

        const closeButton = toast.querySelector('.toast-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                // This will be handled by the manager
                const event = new CustomEvent('toast-close', { detail: { id: notification.id } });
                toast.dispatchEvent(event);
            });
        }

        const actionButton = toast.querySelector('.toast-action');
        if (actionButton && notification.action) {
            actionButton.addEventListener('click', () => {
                notification.action!.callback();
            });
        }

        this.container.appendChild(toast);
    }

    private createToast(notification: Notification): HTMLElement {
        const toast = document.createElement('div');
        toast.id = `toast-${notification.id}`;
        toast.className = this.getToastClasses(notification.type);

        // Add inline styles to ensure proper sizing (fallback for Tailwind)
        toast.style.cssText = `
            width: 320px;
            max-width: 90vw;
            padding: 1rem;
            border-radius: 0.5rem;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
            transition: transform 0.3s;
        `;

        toast.innerHTML = `
            <div class="flex items-start gap-3" style="display: flex; align-items: flex-start; gap: 0.75rem;">
                ${this.getIcon(notification.type)}
                <div class="flex-1 min-w-0" style="flex: 1; min-width: 0;">
                    <h4 class="font-semibold text-sm" style="font-weight: 600; font-size: 0.875rem; line-height: 1.25rem;">${this.escapeHtml(notification.title)}</h4>
                    <p class="text-sm opacity-90 mt-1" style="font-size: 0.875rem; line-height: 1.25rem; opacity: 0.9; margin-top: 0.25rem;">${this.renderMarkdown(notification.message)}</p>
                    ${this.renderStorageInfo(notification.storageInfo)}
                    ${this.renderAction(notification.action)}
                </div>
                <button class="toast-close opacity-60 hover:opacity-100 transition-opacity" style="opacity: 0.6; transition: opacity 0.2s; background: none; border: none; cursor: pointer; padding: 0; color: inherit;">
                    <svg class="w-4 h-4" style="width: 1rem; height: 1rem;" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                    </svg>
                </button>
            </div>
        `;

        return toast;
    }

    private getToastClasses(type: NotificationType): string {
        const base = `
            pointer-events-auto
            w-80 p-4 rounded-lg shadow-lg
            transition-transform duration-300
        `;

        const typeClasses = {
            error: 'bg-red-600 text-white',
            warning: 'bg-yellow-500 text-gray-900',
            info: 'bg-blue-600 text-white',
        };

        return `${base} ${typeClasses[type]}`;
    }

    private getIcon(type: NotificationType): string {
        const iconStyle = 'width: 1.25rem; height: 1.25rem; flex-shrink: 0;';
        const icons = {
            error: `<svg style="${iconStyle}" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
            </svg>`,
            warning: `<svg style="${iconStyle}" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>`,
            info: `<svg style="${iconStyle}" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
            </svg>`,
        };
        return icons[type];
    }

    private renderStorageInfo(info?: StorageInfo): string {
        if (!info) return '';

        const formatGB = (bytes: number) => (bytes / 1024 / 1024 / 1024).toFixed(2);

        return `
            <div style="margin-top: 0.5rem; font-size: 0.75rem; line-height: 1rem; opacity: 0.8;">
                <div>Required: ${formatGB(info.required)} GB</div>
                <div>Current: ${formatGB(info.current)} GB / ${formatGB(info.quota)} GB</div>
                ${info.breakdown ? this.renderBreakdown(info.breakdown) : ''}
            </div>
        `;
    }

    private renderBreakdown(breakdown: { models: number; conversations: number; cache: number }): string {
        const formatGB = (bytes: number) => (bytes / 1024 / 1024 / 1024).toFixed(2);

        return `
            <div style="margin-top: 0.25rem;">
                <div>• Models: ${formatGB(breakdown.models)} GB</div>
                <div>• Conversations: ${formatGB(breakdown.conversations)} GB</div>
                <div>• Cache: ${formatGB(breakdown.cache)} GB</div>
            </div>
        `;
    }

    private renderAction(action?: NotificationAction): string {
        if (!action) return '';

        return `
            <button class="toast-action" style="margin-top: 0.5rem; padding: 0.25rem 0.75rem; background-color: rgba(255, 255, 255, 0.2); border-radius: 0.25rem; font-size: 0.875rem; font-weight: 500; transition: background-color 0.2s; border: none; cursor: pointer; color: inherit;">
                ${this.escapeHtml(action.label)}
            </button>
        `;
    }

    private renderMarkdown(message: string): string {
        // Basic markdown support: **bold**, *italic*, `code`
        let html = this.escapeHtml(message);

        // Bold
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // Italic
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

        // Code
        html = html.replace(/`(.+?)`/g, '<code class="bg-black bg-opacity-20 px-1 rounded">$1</code>');

        return html;
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    animateOut(id: string, onComplete: () => void): void {
        const toast = this.container.querySelector(`#toast-${id}`) as HTMLElement;
        if (!toast) return;

        toast.style.animation = 'slideOutRight 0.3s ease-in forwards';
        setTimeout(onComplete, this.ANIMATION_DURATION);
    }

    remove(id: string): void {
        const toast = this.container.querySelector(`#toast-${id}`);
        if (toast) {
            toast.remove();
        }
        this.timerCallbacks.delete(id);
    }

    updatePosition(id: string, index: number): void {
        const toast = this.container.querySelector(`#toast-${id}`) as HTMLElement;
        if (toast) {
            toast.style.transform = `translateY(${-index * this.TOAST_HEIGHT}px)`;
        }
    }

    pauseTimer(id: string): void {
        const callbacks = this.timerCallbacks.get(id);
        if (callbacks) {
            callbacks.pause();
        }
    }

    resumeTimer(id: string): void {
        const callbacks = this.timerCallbacks.get(id);
        if (callbacks) {
            callbacks.resume();
        }
    }

    setTimerCallbacks(id: string, pause: () => void, resume: () => void): void {
        this.timerCallbacks.set(id, { pause, resume });
    }
}
