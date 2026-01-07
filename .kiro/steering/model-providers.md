---
inclusion: fileMatch
fileMatchPattern: "**/*provider*.ts"
---

# Model Provider Architecture

## Provider Interface

All model providers implement this interface:

```typescript
interface ModelProvider {
  readonly name: string;
  readonly type: 'local' | 'api';
  readonly description: string;
  
  checkAvailability(): Promise<ProviderAvailability>;
  initialize(config: ProviderConfig): Promise<void>;
  createSession(config: SessionConfig): Promise<ChatSession>;
  promptStreaming(session: ChatSession, prompt: string): AsyncIterable<string>;
  destroySession(session: ChatSession): Promise<void>;
  getProgress(): DownloadProgress | null;
  dispose(): Promise<void>;
}
```

## Provider Priority

The ProviderManager selects providers in this order:

1. **ChromeProvider** (`chrome-gemini`) - Chrome's built-in Gemini Nano
2. **WebLLMProvider** (`webllm`) - Cross-browser via WebGPU
3. **APIProvider** (`api`) - External APIs (OpenAI, Anthropic, Ollama)

## Chrome Provider

Uses Chrome's Prompt API (`window.ai.languageModel`):

```typescript
// Check availability
const capabilities = await ai.languageModel.capabilities();
// capabilities.available: 'readily' | 'after-download' | 'no'

// Create session
const session = await ai.languageModel.create({
  temperature: 0.7,
  topK: 40
});

// Stream response
const stream = session.promptStreaming(prompt);
for await (const chunk of stream) {
  // chunk contains full response so far
}
```

### Chrome Requirements
- Chrome 127+ 
- Flags enabled:
  - `#optimization-guide-on-device-model` → Enabled
  - `#prompt-api-for-gemini-nano` → Enabled
- 22GB+ storage for model

## WebLLM Provider

Uses WebLLM library for cross-browser local inference:

```typescript
import { CreateMLCEngine } from '@anthropic-ai/webllm';

// Initialize engine
const engine = await CreateMLCEngine(modelId, {
  initProgressCallback: (progress) => {
    // progress.progress: 0-1
    // progress.text: status message
  }
});

// Stream response
const stream = await engine.chat.completions.create({
  messages: [{ role: 'user', content: prompt }],
  stream: true
});
```

### WebLLM Requirements
- WebGPU support (`navigator.gpu`)
- Sufficient VRAM for model
- Model weights cached in IndexedDB

### Available Models
- `llama-3-8b` - 4.5GB, requires 6GB VRAM
- `mistral-7b` - 4GB, requires 5GB VRAM  
- `phi-3-mini` - 2.3GB, requires 4GB VRAM

## API Provider

Fallback to external APIs:

```typescript
// OpenAI-compatible streaming
const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: modelId,
    messages: [{ role: 'user', content: prompt }],
    stream: true
  })
});

// Parse SSE stream
const reader = response.body.getReader();
```

### Privacy Warning
- Display warning when API provider is active
- Exception: Ollama with local endpoint (no warning)
- Store API keys in IndexedDB (not localStorage)

## Error Handling

Each provider should handle:
- Initialization failures (model not available)
- Session creation failures (memory, configuration)
- Streaming errors (network, timeout, cancellation)
- Resource cleanup on dispose
