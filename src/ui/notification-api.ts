/**
 * Global Notification API
 * Provides global entry point for triggering notifications
 */

import type { NotificationOptions } from './notification-types';
import { NotificationManager } from './notification-manager';

let notificationManager: NotificationManager | null = null;

/**
 * Initialize the notification system with a Shadow DOM root
 * This should be called once during component initialization
 */
export function initializeNotificationSystem(shadowRoot: ShadowRoot): void {
    notificationManager = new NotificationManager(shadowRoot);
}

/**
 * Display a notification
 * @param options Notification configuration
 * @returns Notification ID
 * @throws Error if notification system is not initialized or required parameters are missing
 */
export function notify(options: NotificationOptions): string {
    // Validate notification system is initialized
    if (!notificationManager) {
        throw new Error('Notification system not initialized. Call initializeNotificationSystem() first.');
    }

    // Validate required parameters
    if (!options.type) {
        throw new Error('Notification type is required');
    }

    if (!options.title) {
        throw new Error('Notification title is required');
    }

    if (!options.message) {
        throw new Error('Notification message is required');
    }

    // Validate type is one of the allowed values
    const validTypes = ['error', 'warning', 'info'];
    if (!validTypes.includes(options.type)) {
        throw new Error(`Invalid notification type: ${options.type}. Must be one of: ${validTypes.join(', ')}`);
    }

    return notificationManager.show(options);
}

/**
 * Dismiss a specific notification by ID
 * @param id Notification ID to dismiss
 */
export function dismissNotification(id: string): void {
    if (!notificationManager) {
        console.warn('Notification system not initialized');
        return;
    }

    notificationManager.dismiss(id);
}

/**
 * Clear all active notifications
 */
export function clearAllNotifications(): void {
    if (!notificationManager) {
        console.warn('Notification system not initialized');
        return;
    }

    notificationManager.dismissAll();
}

/**
 * Get the notification manager instance (for internal use)
 * @internal
 */
export function getNotificationManager(): NotificationManager | null {
    return notificationManager;
}

/**
 * Dispose the notification system and clean up resources
 * @internal
 */
export async function disposeNotificationSystem(): Promise<void> {
    if (notificationManager) {
        await notificationManager.dispose();
        notificationManager = null;
    }
}
