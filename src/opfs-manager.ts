

export class OPFSManager {
    private root: FileSystemDirectoryHandle | null = null;


    private async getRoot(): Promise<FileSystemDirectoryHandle> {
        if (this.root) {
            return this.root;
        }

        if (!navigator.storage || !navigator.storage.getDirectory) {
            throw new Error('OPFS not supported in this browser');
        }

        this.root = await navigator.storage.getDirectory();
        return this.root;
    }


    async saveAsset(assetId: string, data: Blob): Promise<void> {
        try {
            const root = await this.getRoot();
            const fileHandle = await root.getFileHandle(assetId, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(data);
            await writable.close();
        } catch (error) {
            console.error('Failed to save asset to OPFS:', error);
            throw new Error(`Failed to save asset ${assetId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }


    async loadAsset(assetId: string): Promise<Blob> {
        try {
            const root = await this.getRoot();
            const fileHandle = await root.getFileHandle(assetId);
            const file = await fileHandle.getFile();
            return file;
        } catch (error) {
            console.error('Failed to load asset from OPFS:', error);
            throw new Error(`Failed to load asset ${assetId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }


    async deleteAsset(assetId: string): Promise<void> {
        try {
            const root = await this.getRoot();
            await root.removeEntry(assetId);
        } catch (error) {
            console.error('Failed to delete asset from OPFS:', error);
            throw new Error(`Failed to delete asset ${assetId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }


    async assetExists(assetId: string): Promise<boolean> {
        try {
            const root = await this.getRoot();
            await root.getFileHandle(assetId);
            return true;
        } catch {
            return false;
        }
    }


    async listAssets(): Promise<string[]> {
        try {
            const root = await this.getRoot();
            const assets: string[] = [];

            // @ts-ignore - TypeScript doesn't have full OPFS types yet
            for await (const entry of root.values()) {
                if (entry.kind === 'file') {
                    assets.push(entry.name);
                }
            }

            return assets;
        } catch (error) {
            console.error('Failed to list assets from OPFS:', error);
            return [];
        }
    }


    async clearAllAssets(): Promise<void> {
        try {
            const assets = await this.listAssets();
            for (const assetId of assets) {
                await this.deleteAsset(assetId);
            }
        } catch (error) {
            // Silently ignore if OPFS is not supported
            if (error instanceof Error && error.message.includes('OPFS not supported')) {
                return;
            }
            console.error('Failed to clear assets from OPFS:', error);
            throw new Error(`Failed to clear assets: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
