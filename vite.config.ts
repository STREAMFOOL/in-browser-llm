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
        },
        // WebLLM compatibility: ensure WASM files are handled correctly
        target: 'esnext'
    },
    // WebLLM uses Web Workers and WASM
    worker: {
        format: 'es'
    },
    optimizeDeps: {
        // Exclude WebLLM from pre-bundling to avoid WASM issues
        exclude: ['@mlc-ai/web-llm']
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
