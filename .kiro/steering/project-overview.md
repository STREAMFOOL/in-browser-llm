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
├── main.ts                          # Entry point
├── component/                       # Web component implementation
│   ├── index.ts                    # Main component registration
│   ├── component-core.ts           # Core rendering and DOM manipulation
│   ├── component-lifecycle.ts      # Lifecycle hooks
│   ├── session-manager.ts          # Session management
│   ├── thread-manager.ts           # Thread management
│   ├── settings.ts                 # Component settings
│   ├── troubleshoot.ts             # Troubleshooting utilities
│   └── utils.ts                    # Component utilities
├── ui/                              # User interface components
│   ├── chat-ui.ts                  # Chat interface (messages, input, loading)
│   ├── settings-ui.ts              # Settings interface orchestration
│   ├── settings-ui-sections.ts     # Individual settings sections
│   ├── thread-list-ui.ts           # Thread list interface
│   └── markdown-renderer.ts        # Incremental markdown parsing
├── styles/                          # Styling modules
│   ├── index.ts                    # Style exports
│   ├── base-styles.ts              # Base/layout styles
│   ├── component-styles.ts         # Component-specific styles
│   ├── theme-styles.ts             # Theme/color styles
│   └── animation-styles.ts         # Animation definitions
├── providers/                       # Model providers
│   ├── provider-manager.ts         # Provider detection/selection
│   ├── model-provider.ts           # Provider interface
│   ├── chrome-provider.ts          # Chrome built-in AI provider
│   ├── webllm-provider.ts          # WebLLM cross-browser provider
│   ├── api-provider.ts             # External API provider
│   └── gemini-controller.ts        # Chrome Gemini Nano integration
├── storage/                         # Data persistence
│   ├── storage-manager.ts          # IndexedDB operations
│   └── opfs-manager.ts             # OPFS file operations
├── core/                            # Core system modules
│   ├── context-window-manager.ts   # Context window handling
│   └── recovery-manager.ts         # Error recovery
└── utils/                           # Utilities
    ├── browser-compatibility.ts    # Browser/hardware detection
    ├── hardware-diagnostics.ts     # Hardware checks
    └── error-handler.ts            # Error handling
```

## Browser Requirements

- **Chrome 127+** with flags enabled for Gemini Nano
- **Any browser with WebGPU** for WebLLM provider
- Minimum 22GB storage for local models
- WebGPU-capable GPU recommended

## Key Specs

- `.kiro/specs/local-ai-assistant/` - Core assistant functionality
- `.kiro/specs/tailwind-css-conversion/` - CSS to Tailwind migration
- `.kiro/specs/code-reorganization/` - Codebase modular reorganization
