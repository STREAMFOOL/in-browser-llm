import { StorageManager, type Document, type Chunk } from '../storage/storage-manager';

export interface DocumentHandle {
    id: string;
    filename: string;
    chunkCount: number;
    sizeBytes: number;
    uploadedAt: number;
}

export interface RetrievedChunk {
    id: string;
    documentId: string;
    content: string;
    startOffset: number;
    endOffset: number;
    relevanceScore: number;
}

export interface DocumentMetadata {
    id: string;
    filename: string;
    chunkCount: number;
    sizeBytes: number;
    uploadedAt: number;
}

export class RAGProcessor {
    private storage: StorageManager;

    constructor(storage: StorageManager) {
        this.storage = storage;
    }

    async ingestDocument(file: File): Promise<DocumentHandle> {
        const content = await this.readFileContent(file);
        const documentId = this.generateId();
        const chunks = this.chunkDocument(content, documentId);

        const document: Document = {
            id: documentId,
            filename: file.name,
            chunkCount: chunks.length,
            createdAt: Date.now()
        };

        await this.storage.saveDocument(document);

        for (const chunk of chunks) {
            await this.storage.saveChunk(chunk);
        }

        return {
            id: document.id,
            filename: document.filename,
            chunkCount: document.chunkCount,
            sizeBytes: content.length,
            uploadedAt: document.createdAt
        };
    }

    async retrieveContext(query: string, documentIds: string[]): Promise<RetrievedChunk[]> {
        const allChunks: Chunk[] = [];

        for (const documentId of documentIds) {
            const chunks = await this.storage.getChunks(documentId);
            allChunks.push(...chunks);
        }

        const rankedChunks = this.rankChunksByRelevance(query, allChunks);

        return rankedChunks.slice(0, 3).map(({ chunk, score }) => ({
            id: chunk.id,
            documentId: chunk.documentId,
            content: chunk.content,
            startOffset: chunk.startOffset,
            endOffset: chunk.endOffset,
            relevanceScore: score
        }));
    }

    async deleteDocument(documentId: string): Promise<void> {
        await this.storage.deleteDocument(documentId);
    }

    async listDocuments(): Promise<DocumentMetadata[]> {
        const documents = await this.storage.listDocuments();

        return documents.map(doc => ({
            id: doc.id,
            filename: doc.filename,
            chunkCount: doc.chunkCount,
            sizeBytes: 0,
            uploadedAt: doc.createdAt
        }));
    }

    formatContextForPrompt(chunks: RetrievedChunk[], documents: Map<string, string>): string {
        if (chunks.length === 0) {
            return '';
        }

        let context = '\n\n--- Retrieved Context ---\n\n';

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const filename = documents.get(chunk.documentId) || 'Unknown Document';

            context += `[Source ${i + 1}: ${filename}, offset ${chunk.startOffset}-${chunk.endOffset}]\n`;
            context += `${chunk.content}\n\n`;
        }

        context += '--- End Context ---\n\n';
        return context;
    }

    extractCitationsFromResponse(response: string, chunks: RetrievedChunk[], documents: Map<string, string>): string {
        let citedResponse = response;

        const citations = chunks.map((chunk, i) => {
            const filename = documents.get(chunk.documentId) || 'Unknown Document';
            return `[${i + 1}] ${filename} (offset ${chunk.startOffset}-${chunk.endOffset})`;
        });

        if (citations.length > 0) {
            citedResponse += '\n\n**Sources:**\n';
            citedResponse += citations.join('\n');
        }

        return citedResponse;
    }

    private async readFileContent(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
                if (typeof reader.result === 'string') {
                    resolve(reader.result);
                } else {
                    reject(new Error('Failed to read file as text'));
                }
            };

            reader.onerror = () => {
                reject(new Error('File reading failed'));
            };

            reader.readAsText(file);
        });
    }

    private chunkDocument(content: string, documentId: string): Chunk[] {
        const CHUNK_SIZE = 512;
        const OVERLAP = 50;
        const chunks: Chunk[] = [];

        const tokens = this.tokenize(content);
        let offset = 0;

        while (offset < tokens.length) {
            const chunkTokens = tokens.slice(offset, offset + CHUNK_SIZE);
            const chunkContent = chunkTokens.join(' ');
            const keywords = Array.from(this.extractKeywords(chunkContent));

            chunks.push({
                id: this.generateId(),
                documentId,
                content: chunkContent,
                startOffset: offset,
                endOffset: offset + chunkTokens.length,
                keywords
            });

            offset += CHUNK_SIZE - OVERLAP;
        }

        return chunks;
    }

    private tokenize(text: string): string[] {
        return text.split(/\s+/).filter(token => token.length > 0);
    }

    private rankChunksByRelevance(query: string, chunks: Chunk[]): Array<{ chunk: Chunk; score: number }> {
        const queryKeywords = this.extractKeywords(query);

        const scored = chunks.map(chunk => {
            const chunkKeywords = this.extractKeywords(chunk.content);
            const score = this.calculateRelevanceScore(queryKeywords, chunkKeywords);
            return { chunk, score };
        });

        return scored
            .filter(({ score }) => score > 0)
            .sort((a, b) => b.score - a.score);
    }

    private extractKeywords(text: string): Set<string> {
        const words = text.toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 3);

        return new Set(words);
    }

    private calculateRelevanceScore(queryKeywords: Set<string>, chunkKeywords: Set<string>): number {
        let matches = 0;

        for (const keyword of queryKeywords) {
            if (chunkKeywords.has(keyword)) {
                matches++;
            }
        }

        return matches;
    }

    private generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }
}
