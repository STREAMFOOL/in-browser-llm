

import type { AISession } from './providers/gemini-controller';
import type { Message } from './storage/storage-manager';

export interface ContextWindowConfig {
    maxTokens: number;
    summarizationThreshold: number; // Percentage of maxTokens (e.g., 0.8 for 80%)
}

export interface TokenUsage {
    currentTokens: number;
    maxTokens: number;
    percentageUsed: number;
    needsSummarization: boolean;
}


export class ContextWindowManager {
    private static readonly DEFAULT_MAX_TOKENS = 4096;
    private static readonly DEFAULT_THRESHOLD = 0.8;
    private static readonly TOKENS_PER_CHAR = 0.25; // Rough estimate: 4 chars per token

    private config: ContextWindowConfig;
    private currentTokenCount: number = 0;

    constructor(config?: Partial<ContextWindowConfig>) {
        this.config = {
            maxTokens: config?.maxTokens ?? ContextWindowManager.DEFAULT_MAX_TOKENS,
            summarizationThreshold: config?.summarizationThreshold ?? ContextWindowManager.DEFAULT_THRESHOLD
        };
    }


    private estimateTokens(text: string): number {
        return Math.ceil(text.length * ContextWindowManager.TOKENS_PER_CHAR);
    }


    private calculateMessageTokens(messages: Message[]): number {
        return messages.reduce((total, msg) => {
            return total + this.estimateTokens(msg.content);
        }, 0);
    }


    monitorTokenUsage(messages: Message[]): TokenUsage {
        this.currentTokenCount = this.calculateMessageTokens(messages);
        const percentageUsed = this.currentTokenCount / this.config.maxTokens;
        const needsSummarization = percentageUsed >= this.config.summarizationThreshold;

        return {
            currentTokens: this.currentTokenCount,
            maxTokens: this.config.maxTokens,
            percentageUsed,
            needsSummarization
        };
    }


    async summarizeMessages(
        session: AISession,
        messages: Message[],
        keepRecentCount: number = 5
    ): Promise<Message[]> {
        if (messages.length <= keepRecentCount) {
            return messages;
        }

        // Keep the most recent messages
        const recentMessages = messages.slice(-keepRecentCount);
        const oldMessages = messages.slice(0, -keepRecentCount);

        // Create a summary of old messages
        const summaryPrompt = this.buildSummaryPrompt(oldMessages);

        try {
            const summary = await session.prompt(summaryPrompt);

            // Create a system message with the summary
            const summaryMessage: Message = {
                id: `summary-${Date.now()}`,
                threadId: messages[0]?.threadId || '',
                role: 'system',
                content: `Previous conversation summary:\n${summary}`,
                timestamp: Date.now(),
                metadata: {
                    tokenCount: this.estimateTokens(summary)
                }
            };

            return [summaryMessage, ...recentMessages];
        } catch (error) {
            console.error('Failed to summarize messages:', error);
            // Fallback: just keep recent messages
            return recentMessages;
        }
    }


    private buildSummaryPrompt(messages: Message[]): string {
        const conversationText = messages
            .map(msg => `${msg.role}: ${msg.content}`)
            .join('\n\n');

        return `Please provide a concise summary of the following conversation, capturing the key points and context:\n\n${conversationText}\n\nSummary:`;
    }


    needsSummarization(messages: Message[]): boolean {
        const usage = this.monitorTokenUsage(messages);
        return usage.needsSummarization;
    }


    getCurrentTokenCount(): number {
        return this.currentTokenCount;
    }


    getMaxTokens(): number {
        return this.config.maxTokens;
    }


    updateConfig(config: Partial<ContextWindowConfig>): void {
        this.config = {
            ...this.config,
            ...config
        };
    }
}
