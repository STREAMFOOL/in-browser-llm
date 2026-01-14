import { RAGProcessor, type DocumentMetadata } from '../core/rag-processor';
import { notify } from './notification-api';

export interface DocumentUploadCallbacks {
    onDocumentUploaded?: (documentId: string) => void;
    onDocumentDeleted?: (documentId: string) => void;
}

export class DocumentUploadUI {
    private container: HTMLElement;
    private ragProcessor: RAGProcessor;
    private callbacks: DocumentUploadCallbacks;
    private documentsListElement: HTMLElement | null = null;
    private uploadButton: HTMLButtonElement | null = null;

    constructor(
        container: HTMLElement,
        ragProcessor: RAGProcessor,
        callbacks: DocumentUploadCallbacks = {}
    ) {
        this.container = container;
        this.ragProcessor = ragProcessor;
        this.callbacks = callbacks;
    }

    render(): void {
        this.container.innerHTML = '';

        const wrapper = document.createElement('div');
        wrapper.className = 'p-4 border-b border-gray-700';

        const header = document.createElement('div');
        header.className = 'flex items-center justify-between mb-3';

        const title = document.createElement('h3');
        title.className = 'text-sm font-semibold text-gray-200';
        title.textContent = 'Documents';

        this.uploadButton = document.createElement('button');
        this.uploadButton.className = `
      px-3 py-1.5
      bg-blue-600 hover:bg-blue-700
      text-white text-xs font-medium
      rounded border-none
      cursor-pointer transition-colors
    `;
        this.uploadButton.textContent = 'Upload';
        this.uploadButton.addEventListener('click', () => this.handleUploadClick());

        header.appendChild(title);
        header.appendChild(this.uploadButton);

        this.documentsListElement = document.createElement('div');
        this.documentsListElement.className = 'space-y-2';

        wrapper.appendChild(header);
        wrapper.appendChild(this.documentsListElement);

        this.container.appendChild(wrapper);

        this.loadDocuments();
    }

    private async loadDocuments(): Promise<void> {
        if (!this.documentsListElement) return;

        try {
            const documents = await this.ragProcessor.listDocuments();

            if (documents.length === 0) {
                this.documentsListElement.innerHTML = `
          <p class="text-xs text-gray-400 italic">No documents uploaded</p>
        `;
                return;
            }

            this.documentsListElement.innerHTML = '';

            for (const doc of documents) {
                const docElement = this.createDocumentElement(doc);
                this.documentsListElement.appendChild(docElement);
            }
        } catch (error) {
            notify({
                type: 'error',
                title: 'Failed to Load Documents',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    private createDocumentElement(doc: DocumentMetadata): HTMLElement {
        const element = document.createElement('div');
        element.className = `
      p-2 rounded
      bg-gray-800 hover:bg-gray-750
      border border-gray-700
      transition-colors
    `;

        const header = document.createElement('div');
        header.className = 'flex items-start justify-between gap-2';

        const info = document.createElement('div');
        info.className = 'flex-1 min-w-0';

        const filename = document.createElement('div');
        filename.className = 'text-xs font-medium text-gray-200 truncate';
        filename.textContent = doc.filename;
        filename.title = doc.filename;

        const metadata = document.createElement('div');
        metadata.className = 'text-xs text-gray-400 mt-1';
        metadata.textContent = `${doc.chunkCount} chunks • ${this.formatDate(doc.uploadedAt)}`;

        info.appendChild(filename);
        info.appendChild(metadata);

        const deleteButton = document.createElement('button');
        deleteButton.className = `
      px-2 py-1
      text-xs text-red-400 hover:text-red-300
      border-none bg-transparent
      cursor-pointer transition-colors
    `;
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => this.handleDeleteDocument(doc.id));

        header.appendChild(info);
        header.appendChild(deleteButton);

        element.appendChild(header);

        return element;
    }

    private handleUploadClick(): void {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt,.md,.text';
        input.multiple = false;

        input.addEventListener('change', async () => {
            if (input.files && input.files.length > 0) {
                await this.handleFileUpload(input.files[0]);
            }
        });

        input.click();
    }

    private async handleFileUpload(file: File): Promise<void> {
        if (this.uploadButton) {
            this.uploadButton.disabled = true;
            this.uploadButton.textContent = 'Uploading...';
        }

        try {
            const handle = await this.ragProcessor.ingestDocument(file);

            notify({
                type: 'info',
                title: 'Document Uploaded',
                message: `${file.name} uploaded successfully (${handle.chunkCount} chunks)`
            });

            await this.loadDocuments();

            if (this.callbacks.onDocumentUploaded) {
                this.callbacks.onDocumentUploaded(handle.id);
            }
        } catch (error) {
            notify({
                type: 'error',
                title: 'Upload Failed',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        } finally {
            if (this.uploadButton) {
                this.uploadButton.disabled = false;
                this.uploadButton.textContent = 'Upload';
            }
        }
    }

    private async handleDeleteDocument(documentId: string): Promise<void> {
        try {
            await this.ragProcessor.deleteDocument(documentId);

            notify({
                type: 'info',
                title: 'Document Deleted',
                message: 'Document removed successfully'
            });

            await this.loadDocuments();

            if (this.callbacks.onDocumentDeleted) {
                this.callbacks.onDocumentDeleted(documentId);
            }
        } catch (error) {
            notify({
                type: 'error',
                title: 'Delete Failed',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    private formatDate(timestamp: number): string {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString();
    }

    destroy(): void {
        this.container.innerHTML = '';
    }
}
