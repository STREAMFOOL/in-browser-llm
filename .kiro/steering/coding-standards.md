---
inclusion: always
---

# Coding Standards

## Making changes

Code changes should be made directly, unless user prompt posed a question. If user asks something in their prompt, then no changes should be made. All questions should be answered and confirmed by the user before we proceed to coding.

### History

We use git as our main VCS. In order to preserve history if we are moving files between folders, we should be using 'git mv [-v] [-f] [-n] [-k] <source> <destination>' command. It is also much more efficient in terms of tomen consumption.

## TypeScript Guidelines

### Type Safety
- Use strict TypeScript configuration
- Prefer interfaces over type aliases for object shapes
- Always type function parameters and return values
- Use `unknown` instead of `any` when type is truly unknown

### Naming Conventions
- Classes: PascalCase (`ChatUI`, `GeminiController`)
- Interfaces: PascalCase (`ModelProvider`, `SessionConfig`)
- Functions/methods: camelCase (`createSession`, `handleSendMessage`)
- Constants: UPPER_SNAKE_CASE for true constants, camelCase for config objects
- Files: kebab-case (`chat-ui.ts`, `gemini-controller.ts`)

### Code Organization
- One class per file (with related interfaces in same file)
- Group imports: external libraries, then internal modules
- Export interfaces alongside their implementations
- **File size limits** (excluding test files):
  - **Hard limit**: 500 lines maximum
  - **Target**: Keep files under 200 lines ideally
  - Extract related functionality into separate modules when files grow large
  - Exception: Files may exceed limits if functionality is truly inseparable
  - Consider splitting by: UI components, business logic, utilities, types

### Module Structure
The codebase is organized into logical modules with clear responsibilities:

- **component/** - Web component implementation and lifecycle
- **ui/** - User interface components (chat, settings, thread list)
- **styles/** - Styling system (base, component, theme, animations)
- **providers/** - Model provider implementations (Chrome, WebLLM, API)
- **storage/** - Data persistence layer (IndexedDB, OPFS)
- **core/** - Core system functionality (context window, recovery)
- **utils/** - Shared utilities (browser detection, error handling)

### Import Conventions
- Use relative imports within the same module: `import { X } from './sibling-file'`
- Use relative imports across modules: `import { X } from '../ui/chat-ui'`
- Group imports by module in this order:
  1. External libraries (e.g., `fast-check`)
  2. Component module imports
  3. UI module imports
  4. Styles module imports
  5. Providers module imports
  6. Storage module imports
  7. Core module imports
  8. Utils module imports


### Monitoring File Sizes
Use this command to check the 20 largest files in the project:
```bash
find . -type f \( -name "*.ts" -o -name "*.css" -o -name "*.js" -o -name "*.html" \) -not -path "./node_modules/*" -not -path "./dist/*" -not -path "./.git/*" -exec wc -l {} + | sort -rn | head -21
```
Review output regularly to identify files that need refactoring.

## Styling with Tailwind CSS

### Class Application
- Apply Tailwind classes directly via `element.className = "..."`
- Use template literals for conditional classes
- Group related utilities logically (layout → spacing → colors → typography)

### Example Pattern
```typescript
const button = document.createElement('button');
button.className = `
  py-3 px-6 
  bg-blue-500 hover:bg-blue-600 active:bg-blue-700
  text-white font-semibold
  rounded-lg border-none
  cursor-pointer transition-colors
  focus:outline-2 focus:outline-blue-500
`;
```

### Custom Animations
Only these animations require CSS (defined in Shadow DOM):
- `animate-fadeIn` - message appearance
- `animate-blink` - incomplete code block indicator

Use Tailwind built-ins for:
- `animate-pulse` - status indicator
- `animate-spin` - loading spinner

## Web Component Patterns

### Shadow DOM
- Always use `mode: 'closed'` for security
- Keep style element minimal (animations only)
- Apply Tailwind classes to all elements

### Event Handling
- Use arrow functions for event handlers to preserve `this`
- Clean up event listeners in `disconnectedCallback`
- Use AbortController for cancellable operations

## Comments

### When to Comment
- **Critical tradeoffs**: Explain non-obvious architectural decisions
- **Magic numbers**: Document why specific values are used (e.g., `22GB` storage requirement)
- **Complex algorithms**: Clarify non-trivial logic that isn't self-explanatory
- **Workarounds**: Explain temporary fixes or browser-specific hacks
- **Requirements tracing**: Link to spec requirements only when mandated by project

### When NOT to Comment
- **Self-descriptive code**: Method names and variable names should explain themselves
- **Obvious operations**: Don't comment "create button" above `document.createElement('button')`
- **Type information**: TypeScript types already document parameters and return values
- **Redundant descriptions**: Avoid repeating what the code clearly shows

### Example
```typescript
// BAD: Redundant comments
// Create a button element
const button = document.createElement('button');
// Set the button text
button.textContent = 'Click me';

// GOOD: Only comment non-obvious decisions
const STORAGE_THRESHOLD_GB = 22; // Minimum for Gemini Nano model + cache
const button = document.createElement('button');
button.textContent = 'Click me';
```

## Error Handling

### User-Facing Errors
- Display friendly messages in the UI
- Use markdown formatting for error messages
- Include troubleshooting steps when applicable

### Technical Errors
- Log detailed info to console with `console.error`
- Include context (component name, operation, parameters)
- Never expose stack traces to users

## Testing

Run tests using `npm test --silent` by default.
- `--silent` is important to manage context size
- running specific sub-set of tests should be prefered, 
    example: `npm test -- tests/properties/worker-properties.test --silent`

### Property-Based Tests
- Use fast-check for property testing
- Minimum 100 iterations per property
- Tag with: `// Feature: {feature}, Property {N}: {description}`

### Unit Tests
- Co-locate with source when possible (`*.test.ts`)
- Focus on edge cases and error conditions
- Mock external APIs (window.ai, navigator.gpu)
