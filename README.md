# Local AI Assistant

A privacy-first, browser-based conversational AI system that runs entirely on the user's device using Chrome's built-in Gemini Nano model and WebGPU.

## Features

- 🔒 **Privacy-First**: All inference and data storage occur on your device
- 🚀 **Zero Latency**: No server round-trips for responses
- 📦 **Embeddable**: Web Component that works on any website
- 🎨 **Style Isolated**: Uses Shadow DOM to prevent CSS conflicts
- 🧪 **Well Tested**: Property-based testing with fast-check

## Requirements

- Chrome 127 or higher
- At least 22 GB available storage
- WebGPU support

## Development

### Install Dependencies

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

Visit http://localhost:5173 to see the demo.

### Build for Production

```bash
npm run build
```

This creates embeddable library files in the `dist/` directory:
- `local-ai-assistant.es.js` - ES module format
- `local-ai-assistant.umd.js` - UMD format for broader compatibility

### Run Tests

```bash
# Run tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Usage

### As a Standalone App

Open `index.html` in Chrome 127+ to use the assistant.

### As an Embeddable Widget

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module" src="local-ai-assistant.es.js"></script>
</head>
<body>
  <local-ai-assistant style="width: 800px; height: 600px;"></local-ai-assistant>
</body>
</html>
```

### Programmatic Usage

```typescript
import { LocalAIAssistant } from 'local-ai-assistant';

// The component is automatically registered
const assistant = document.createElement('local-ai-assistant');
document.body.appendChild(assistant);
```

## Architecture

The assistant is built as a Web Component with:
- **Closed Shadow DOM** for complete style isolation
- **TypeScript** for type safety
- **Vite** for fast builds and development
- **Vitest** for unit testing
- **fast-check** for property-based testing

## Project Structure

```
├── src/
│   ├── main.ts                    # Entry point
│   └── local-ai-assistant.ts      # Web Component implementation
├── tests/
│   ├── setup.ts                   # Test configuration
│   ├── setup.test.ts              # Basic test suite
│   └── local-ai-assistant.test.ts # Component tests
├── dist/                          # Build output
├── index.html                     # Demo page
├── vite.config.ts                 # Vite configuration
├── tsconfig.json                  # TypeScript config
└── tsconfig.build.json            # Build-specific TS config
```
