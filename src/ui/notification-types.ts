/**
 * Notification system type definitions
 * Defines all interfaces for the toast notification system
 */

export type NotificationType = 'error' | 'warning' | 'info';

export interface NotificationAction {
    label: string;
    callback: () => void;
}

export interface StorageBreakdown {
    models: number;
    conversations: number;
    cache: number;
}

export interface StorageInfo {
    required: number;            // Bytes needed
    current: number;             // Current usage
    quota: number;               // Total quota
    breakdown?: StorageBreakdown;
}

export interface NotificationOptions {
    type: NotificationType;
    title: string;
    message: string;
    duration?: number;           // Default: 5000ms
    action?: NotificationAction;
    storageInfo?: StorageInfo;   // For storage-related notifications
}

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    timestamp: number;
    duration: number;
    action?: NotificationAction;
    storageInfo?: StorageInfo;
}

export interface LoggedNotification extends Notification {
    loggedAt: number;
}
