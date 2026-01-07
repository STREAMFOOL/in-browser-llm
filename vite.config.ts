import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'src/main.ts'),
            name: 'LocalAIAssistant',
            fileName: (format) => `local-ai-assistant.${format}.js`,
            formats: ['es', 'umd']
        },
        rollupOptions: {
            output: {
                assetFileNames: 'assets/[name][extname]',
                exports: 'named'
            }
        }
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './tests/setup.ts',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html']
        }
    }
});
