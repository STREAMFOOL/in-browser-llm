/**
 * Thread List UI Component
 * Sidebar/drawer for managing conversation threads
 * Requirements: 13.1, 13.3, 13.4, 13.6
 */

import type { ThreadMetadata } from './storage-manager';

export interface ThreadListCallbacks {
    onThreadSelect: (threadId: string) => void;
    onThreadDelete: (threadId: string) => void;
    onNewThread: () => void;
}

export class ThreadListUI {
    private container: HTMLElement;
    private callbacks: ThreadListCallbacks;
    private isOpen: boolean = false;
    private currentThreadId: string | null = null;

    constructor(container: HTMLElement, callbacks: ThreadListCallbacks) {
        this.container = container;
        this.callbacks = callbacks;
    }

    /**
     * Render the thread list
     * Requirements: 13.1, 13.6
     */
    render(threads: ThreadMetadata[], currentThreadId: string | null): void {
        this.currentThreadId = currentThreadId;

        // Clear container
        this.container.innerHTML = '';

        // Create header
        const header = document.createElement('div');
        header.className = 'thread-list-header';

        const title = document.createElement('h3');
        title.className = 'thread-list-title';
        title.textContent = 'Conversations';

        const newButton = document.createElement('button');
        newButton.className = 'thread-new-button';
        newButton.innerHTML = '➕';
        newButton.title = 'New conversation';
        newButton.setAttribute('aria-label', 'Start new conversation');
        newButton.addEventListener('click', () => {
            this.callbacks.onNewThread();
        });

        header.appendChild(title);
        header.appendChild(newButton);

        // Create thread list
        const list = document.createElement('div');
        list.className = 'thread-list-items';
        list.setAttribute('role', 'list');

        if (threads.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'thread-list-empty';
            empty.textContent = 'No conversations yet';
            list.appendChild(empty);
        } else {
            threads.forEach(thread => {
                const item = this.createThreadItem(thread);
                list.appendChild(item);
            });
        }

        this.container.appendChild(header);
        this.container.appendChild(list);
    }

    /**
     * Create a thread list item
     * Requirements: 13.1, 13.3, 13.6
     */
    private createThreadItem(thread: ThreadMetadata): HTMLElement {
        const item = document.createElement('div');
        item.className = 'thread-item';
        item.setAttribute('role', 'listitem');
        item.setAttribute('data-thread-id', thread.id);

        if (thread.id === this.currentThreadId) {
            item.classList.add('active');
        }

        // Thread content (clickable)
        const content = document.createElement('div');
        content.className = 'thread-item-content';
        content.addEventListener('click', () => {
            this.callbacks.onThreadSelect(thread.id);
        });

        const titleEl = document.createElement('div');
        titleEl.className = 'thread-item-title';
        titleEl.textContent = thread.title;

        const meta = document.createElement('div');
        meta.className = 'thread-item-meta';

        const timestamp = document.createElement('span');
        timestamp.className = 'thread-item-timestamp';
        timestamp.textContent = this.formatTimestamp(thread.lastMessageTime);

        const messageCount = document.createElement('span');
        messageCount.className = 'thread-item-count';
        messageCount.textContent = `${thread.messageCount} message${thread.messageCount !== 1 ? 's' : ''}`;

        meta.appendChild(timestamp);
        meta.appendChild(document.createTextNode(' • '));
        meta.appendChild(messageCount);

        content.appendChild(titleEl);
        content.appendChild(meta);

        // Delete button
        const deleteButton = document.createElement('button');
        deleteButton.className = 'thread-item-delete';
        deleteButton.innerHTML = '🗑️';
        deleteButton.title = 'Delete conversation';
        deleteButton.setAttribute('aria-label', `Delete conversation: ${thread.title}`);
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Delete conversation "${thread.title}"?`)) {
                this.callbacks.onThreadDelete(thread.id);
            }
        });

        item.appendChild(content);
        item.appendChild(deleteButton);

        return item;
    }

    /**
     * Format timestamp for display
     * Requirements: 13.6
     */
    private formatTimestamp(timestamp: number): string {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) {
            return 'Just now';
        } else if (diffMins < 60) {
            return `${diffMins}m ago`;
        } else if (diffHours < 24) {
            return `${diffHours}h ago`;
        } else if (diffDays < 7) {
            return `${diffDays}d ago`;
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    }

    /**
     * Toggle sidebar visibility
     */
    toggle(): void {
        this.isOpen = !this.isOpen;
        if (this.isOpen) {
            this.container.classList.add('open');
        } else {
            this.container.classList.remove('open');
        }
    }

    /**
     * Open sidebar
     */
    open(): void {
        this.isOpen = true;
        this.container.classList.add('open');
    }

    /**
     * Close sidebar
     */
    close(): void {
        this.isOpen = false;
        this.container.classList.remove('open');
    }
}
