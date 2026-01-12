/**
 * Notification Logger
 * Persists notifications to IndexedDB for later review
 */

import Dexie, { type Table } from 'dexie';
import type { Notification, LoggedNotification, NotificationType } from './notification-types';

class NotificationDatabase extends Dexie {
    notificationLog!: Table<LoggedNotification, string>;

    constructor() {
        super('LocalAIAssistant');

        this.version(1).stores({
            threads: 'id, updatedAt',
            messages: 'id, threadId, timestamp',
            documents: 'id, filename',
            chunks: 'id, documentId, content',
            settings: 'key'
        });

        this.version(2).stores({
            threads: 'id, updatedAt',
            messages: 'id, threadId, timestamp',
            documents: 'id, filename',
            chunks: 'id, documentId, content',
            settings: 'key',
            notificationLog: 'id, type, loggedAt'
        });
    }
}

export class NotificationLogger {
    private db: NotificationDatabase;
    private readonly MAX_ENTRIES = 100;

    constructor() {
        this.db = new NotificationDatabase();
    }

    async log(notification: Notification): Promise<void> {
        const logged: LoggedNotification = {
            ...notification,
            loggedAt: Date.now(),
        };

        try {
            await this.db.notificationLog.put(logged);
            await this.enforceLimit();
        } catch (error) {
            console.error('Failed to log notification:', error);
        }
    }

    async getAll(): Promise<LoggedNotification[]> {
        try {
            return await this.db.notificationLog
                .orderBy('loggedAt')
                .reverse()
                .toArray();
        } catch (error) {
            console.error('Failed to retrieve notification log:', error);
            return [];
        }
    }

    async getByType(type: NotificationType): Promise<LoggedNotification[]> {
        try {
            return await this.db.notificationLog
                .where('type')
                .equals(type)
                .reverse()
                .sortBy('loggedAt');
        } catch (error) {
            console.error('Failed to retrieve notifications by type:', error);
            return [];
        }
    }

    async clear(): Promise<void> {
        try {
            await this.db.notificationLog.clear();
        } catch (error) {
            console.error('Failed to clear notification log:', error);
        }
    }

    private async enforceLimit(): Promise<void> {
        try {
            const count = await this.db.notificationLog.count();

            if (count > this.MAX_ENTRIES) {
                const toDelete = count - this.MAX_ENTRIES;
                const oldest = await this.db.notificationLog
                    .orderBy('loggedAt')
                    .limit(toDelete)
                    .toArray();

                const idsToDelete = oldest.map(n => n.id);
                await this.db.notificationLog.bulkDelete(idsToDelete);
            }
        } catch (error) {
            console.error('Failed to enforce notification log limit:', error);
        }
    }

    async dispose(): Promise<void> {
        try {
            await this.db.close();
        } catch (error) {
            console.error('Failed to close notification logger database:', error);
        }
    }
}
