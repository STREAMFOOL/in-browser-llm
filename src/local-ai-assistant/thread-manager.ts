import { StorageManager, type Thread, type Message as StorageMessage } from '../storage-manager';
import { ThreadListUI } from '../thread-list-ui';
import { type Message } from '../chat-ui';

export interface ThreadManagerCallbacks {
    onThreadSwitch: (threadId: string, messages: Message[]) => void;
    onThreadDelete: (threadId: string) => void;
    onNewThread: () => void;
    onThreadCreated: (threadId: string) => void;
}

export class ThreadManager {
    private storageManager: StorageManager;
    private threadListUI: ThreadListUI | null = null;
    private currentThreadId: string | null = null;
    private callbacks: ThreadManagerCallbacks;

    constructor(
        storageManager: StorageManager,
        callbacks: ThreadManagerCallbacks
    ) {
        this.storageManager = storageManager;
        this.callbacks = callbacks;
    }

    initializeUI(container: HTMLElement): void {
        this.threadListUI = new ThreadListUI(container, {
            onThreadSelect: (threadId) => this.handleThreadSelect(threadId),
            onThreadDelete: (threadId) => this.handleThreadDelete(threadId),
            onNewThread: () => this.handleNewThread()
        });
    }

    getCurrentThreadId(): string | null {
        return this.currentThreadId;
    }

    async toggleThreadList(): Promise<void> {
        if (!this.threadListUI) return;

        const threads = await this.storageManager.listThreads();
        this.threadListUI.render(threads, this.currentThreadId);
        this.threadListUI.toggle();
    }

    async createNewThread(firstMessage?: string, settings?: Thread['settings']): Promise<string> {
        const threadId = this.generateThreadId();
        const now = Date.now();

        const thread: Thread = {
            id: threadId,
            title: firstMessage ? this.generateThreadTitle(firstMessage) : 'New Conversation',
            createdAt: now,
            updatedAt: now,
            messageCount: 0,
            settings: settings || {
                temperature: 0.7,
                topK: 40,
                systemPrompt: '',
                enabledFeatures: ['text-chat']
            }
        };

        await this.storageManager.createThread(thread);
        this.currentThreadId = threadId;
        this.callbacks.onThreadCreated(threadId);

        console.log('Created new thread:', threadId);
        return threadId;
    }

    async saveMessageToThread(message: Message, settings?: Thread['settings']): Promise<void> {
        if (!this.currentThreadId) {
            await this.createNewThread(
                message.role === 'user' ? message.content : undefined,
                settings
            );
        }

        const storageMessage: StorageMessage = {
            id: message.id,
            threadId: this.currentThreadId!,
            role: message.role,
            content: message.content,
            timestamp: message.timestamp,
            attachments: [],
            metadata: {}
        };

        await this.storageManager.saveMessage(this.currentThreadId!, storageMessage);
    }

    private async handleThreadSelect(threadId: string): Promise<void> {
        if (!this.threadListUI) return;

        this.threadListUI.close();

        const messages = await this.storageManager.loadThread(threadId);
        const chatMessages: Message[] = messages
            .filter(msg => msg.role !== 'system')
            .map(msg => ({
                id: msg.id,
                role: msg.role as 'user' | 'assistant',
                content: msg.content,
                timestamp: msg.timestamp
            }));

        this.currentThreadId = threadId;
        this.callbacks.onThreadSwitch(threadId, chatMessages);

        console.log('Loaded thread:', threadId, 'with', messages.length, 'messages');
    }

    private async handleThreadDelete(threadId: string): Promise<void> {
        try {
            await this.storageManager.deleteThread(threadId);

            const wasCurrentThread = threadId === this.currentThreadId;
            if (wasCurrentThread) {
                this.currentThreadId = null;
            }

            this.callbacks.onThreadDelete(threadId);

            if (this.threadListUI) {
                const threads = await this.storageManager.listThreads();
                this.threadListUI.render(threads, this.currentThreadId);
            }

            console.log('Deleted thread:', threadId);
        } catch (error) {
            console.error('Failed to delete thread:', error);
            throw error;
        }
    }

    private handleNewThread(): void {
        if (!this.threadListUI) return;

        this.threadListUI.close();
        this.currentThreadId = null;
        this.callbacks.onNewThread();

        console.log('Started new thread');
    }

    private generateThreadId(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    private generateThreadTitle(firstMessage: string): string {
        const maxLength = 50;
        const cleaned = firstMessage.trim().replace(/\s+/g, ' ');

        if (cleaned.length <= maxLength) {
            return cleaned;
        }

        return cleaned.substring(0, maxLength - 3) + '...';
    }

    dispose(): void {
        this.threadListUI = null;
        this.currentThreadId = null;
    }
}
