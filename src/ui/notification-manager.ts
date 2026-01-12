/**
 * Notification Manager
 * Orchestrates notification lifecycle and state
 */

import type { Notification, NotificationOptions } from './notification-types';
import { ToastRendererImpl, type ToastRenderer } from './toast-renderer';
import { NotificationLogger } from './notification-logger';

export class NotificationManager {
    private active: Map<string, Notification> = new Map();
    private queued: Notification[] = [];
    private timers: Map<string, number> = new Map();
    private pausedTimers: Map<string, { remaining: number; pausedAt: number }> = new Map();
    private recentNotifications: Map<string, number> = new Map();
    private renderer: ToastRenderer;
    private logger: NotificationLogger;
    private readonly MAX_ACTIVE = 5;
    private readonly DEFAULT_DURATION = 5000;
    private readonly DUPLICATE_WINDOW = 5000;

    constructor(shadowRoot: ShadowRoot) {
        this.renderer = new ToastRendererImpl(shadowRoot);
        this.logger = new NotificationLogger();
    }

    show(options: NotificationOptions): string {
        const notification = this.createNotification(options);

        // Check for duplicate
        if (this.isDuplicate(notification)) {
            return notification.id;
        }

        // Track recent notification
        const key = this.getNotificationKey(notification);
        this.recentNotifications.set(key, Date.now());

        // Log to persistent storage
        this.logger.log(notification);

        if (this.active.size >= this.MAX_ACTIVE) {
            this.queued.push(notification);
            return notification.id;
        }

        this.activate(notification);
        return notification.id;
    }

    dismiss(id: string): void {
        const notification = this.active.get(id);
        if (!notification) return;

        // Clear timer
        const timer = this.timers.get(id);
        if (timer) {
            clearTimeout(timer);
        }
        this.timers.delete(id);
        this.pausedTimers.delete(id);

        // Remove from active
        this.active.delete(id);

        // Animate out
        this.renderer.animateOut(id, () => {
            this.renderer.remove(id);
            this.restack();
            this.processQueue();
        });
    }

    dismissAll(): void {
        const ids = Array.from(this.active.keys());
        ids.forEach(id => this.dismiss(id));
    }

    getActive(): Notification[] {
        return Array.from(this.active.values());
    }

    getQueued(): Notification[] {
        return [...this.queued];
    }

    private createNotification(options: NotificationOptions): Notification {
        return {
            id: this.generateId(),
            type: options.type,
            title: options.title,
            message: options.message,
            timestamp: Date.now(),
            duration: options.duration ?? this.DEFAULT_DURATION,
            action: options.action,
            storageInfo: options.storageInfo,
        };
    }

    private generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private activate(notification: Notification): void {
        this.active.set(notification.id, notification);
        this.renderer.render(notification, this.active.size - 1);
        this.startTimer(notification);

        // Set up timer callbacks for pause/resume
        this.renderer.setTimerCallbacks(
            notification.id,
            () => this.pauseTimer(notification.id),
            () => this.resumeTimer(notification.id)
        );

        // Listen for close button clicks
        const toast = document.querySelector(`#toast-${notification.id}`);
        if (toast) {
            toast.addEventListener('toast-close', () => {
                this.dismiss(notification.id);
            });
        }
    }

    private startTimer(notification: Notification): void {
        const timer = window.setTimeout(() => {
            this.dismiss(notification.id);
        }, notification.duration);
        this.timers.set(notification.id, timer);
    }

    private pauseTimer(id: string): void {
        const timer = this.timers.get(id);
        if (!timer) return;

        const notification = this.active.get(id);
        if (!notification) return;

        // Clear the existing timer
        clearTimeout(timer);
        this.timers.delete(id);

        // Calculate remaining time
        const pausedTimer = this.pausedTimers.get(id);
        if (pausedTimer) {
            // Already paused, keep existing remaining time
            return;
        }

        const elapsed = Date.now() - notification.timestamp;
        const remaining = Math.max(0, notification.duration - elapsed);

        this.pausedTimers.set(id, {
            remaining,
            pausedAt: Date.now(),
        });
    }

    private resumeTimer(id: string): void {
        const pausedTimer = this.pausedTimers.get(id);
        if (!pausedTimer) return;

        this.pausedTimers.delete(id);

        // Start a new timer with the remaining time
        const timer = window.setTimeout(() => {
            this.dismiss(id);
        }, pausedTimer.remaining);

        this.timers.set(id, timer);
    }

    private isDuplicate(notification: Notification): boolean {
        const key = this.getNotificationKey(notification);
        const lastShown = this.recentNotifications.get(key);

        if (!lastShown) return false;

        const timeSinceLastShown = Date.now() - lastShown;
        return timeSinceLastShown < this.DUPLICATE_WINDOW;
    }

    private getNotificationKey(notification: Notification): string {
        return `${notification.type}:${notification.title}:${notification.message}`;
    }

    private processQueue(): void {
        if (this.queued.length > 0 && this.active.size < this.MAX_ACTIVE) {
            const next = this.queued.shift()!;
            this.activate(next);
        }
    }

    private restack(): void {
        let index = 0;
        for (const [id] of this.active) {
            this.renderer.updatePosition(id, index);
            index++;
        }
    }

    async dispose(): Promise<void> {
        // Clear all timers
        for (const timer of this.timers.values()) {
            clearTimeout(timer);
        }
        this.timers.clear();
        this.pausedTimers.clear();

        // Clear active and queued notifications
        this.active.clear();
        this.queued = [];
        this.recentNotifications.clear();

        // Dispose logger (closes IndexedDB connection)
        await this.logger.dispose();
    }
}
