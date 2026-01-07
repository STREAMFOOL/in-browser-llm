---
inclusion: always
---

# Coding Standards

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

### Property-Based Tests
- Use fast-check for property testing
- Minimum 100 iterations per property
- Tag with: `// Feature: {feature}, Property {N}: {description}`

### Unit Tests
- Co-locate with source when possible (`*.test.ts`)
- Focus on edge cases and error conditions
- Mock external APIs (window.ai, navigator.gpu)
