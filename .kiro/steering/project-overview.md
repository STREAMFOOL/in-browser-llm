---
inclusion: always
---

# Local AI Assistant - Project Overview

## What This Project Is

A privacy-first, browser-based conversational AI assistant that runs entirely on the user's device. The system uses a hybrid model provider architecture:

1. **Chrome Provider** (Priority 1): Uses Chrome's built-in Gemini Nano via the Prompt API
2. **WebLLM Provider** (Priority 2): Cross-browser local inference via WebGPU
3. **API Provider** (Priority 3): Optional fallback to external APIs (OpenAI, Anthropic, Ollama)

## Key Architecture Decisions

### Web Component with Shadow DOM
- The assistant is implemented as `<local-ai-assistant>` custom element
- Uses **closed Shadow DOM** for complete style isolation
- Can be embedded on any website without CSS conflicts

### Styling Approach
- **Tailwind CSS v4** loaded from CDN: `https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4`
- All styling uses Tailwind utility classes inline on elements
- Minimal CSS only for custom animations (fadeIn, blink) in Shadow DOM
- No external CSS files - `src/style.css` has been removed

### Storage Architecture
- **IndexedDB**: Conversations, thread metadata, settings, model weights
- **OPFS**: Large binary assets (images, audio)
- Uses `navigator.storage.persist()` for persistent storage

## Project Structure

```
src/
├── local-ai-assistant.ts   # Main web component
├── chat-ui.ts              # Chat interface (messages, input, loading)
├── markdown-renderer.ts    # Incremental markdown parsing
├── gemini-controller.ts    # Chrome Gemini Nano integration
├── provider-manager.ts     # Model provider detection/selection
├── chrome-provider.ts      # Chrome built-in AI provider
├── webllm-provider.ts      # WebLLM cross-browser provider
├── storage-manager.ts      # IndexedDB operations
├── opfs-manager.ts         # OPFS file operations
├── context-window-manager.ts # Context window handling
├── browser-compatibility.ts # Browser/hardware detection
└── main.ts                 # Entry point
```

## Browser Requirements

- **Chrome 127+** with flags enabled for Gemini Nano
- **Any browser with WebGPU** for WebLLM provider
- Minimum 22GB storage for local models
- WebGPU-capable GPU recommended

## Key Specs

- `.kiro/specs/local-ai-assistant/` - Core assistant functionality
- `.kiro/specs/tailwind-css-conversion/` - CSS to Tailwind migration
