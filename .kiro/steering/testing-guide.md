---
inclusion: fileMatch
fileMatchPattern: "**/*.test.ts"
---

# Testing Guide

## Test Framework

- **Vitest** for test runner
- **fast-check** for property-based testing
- Tests located in `tests/` directory

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/storage-manager.test.ts

# Run with coverage
npm test -- --coverage
```

## Test Organization

```
tests/
├── *.test.ts              # Unit tests
├── properties/            # Property-based tests
│   ├── *-properties.test.ts
└── setup.ts               # Test setup/mocks
```

## Unit Test Patterns

### Basic Structure
```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('ComponentName', () => {
  beforeEach(() => {
    // Setup
  });

  it('should do something specific', () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = doSomething(input);
    
    // Assert
    expect(result).toBe('expected');
  });
});
```

### Mocking Browser APIs
```typescript
// Mock window.ai for Chrome provider tests
vi.stubGlobal('ai', {
  languageModel: {
    capabilities: vi.fn().mockResolvedValue({ available: 'readily' }),
    create: vi.fn().mockResolvedValue(mockSession)
  }
});

// Mock navigator.gpu for WebGPU tests
vi.stubGlobal('navigator', {
  gpu: {
    requestAdapter: vi.fn().mockResolvedValue(mockAdapter)
  }
});
```

## Property-Based Testing

### Structure
```typescript
import { describe, it } from 'vitest';
import * as fc from 'fast-check';

describe('Property Tests', () => {
  // Feature: local-ai-assistant, Property 7: Storage Round-Trip Consistency
  it('should preserve data through storage round-trip', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          content: fc.string(),
          timestamp: fc.integer({ min: 0 })
        }),
        async (message) => {
          await storage.save(message);
          const loaded = await storage.load(message.id);
          expect(loaded).toEqual(message);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Common Arbitraries
```typescript
// Message arbitrary
const messageArb = fc.record({
  id: fc.uuid(),
  role: fc.constantFrom('user', 'assistant'),
  content: fc.string({ minLength: 1 }),
  timestamp: fc.integer({ min: 0 })
});

// Thread arbitrary
const threadArb = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 100 }),
  createdAt: fc.integer({ min: 0 }),
  updatedAt: fc.integer({ min: 0 })
});

// Settings arbitrary
const settingsArb = fc.record({
  temperature: fc.float({ min: 0, max: 1 }),
  topK: fc.integer({ min: 1, max: 100 })
});
```

### Property Tagging
Always tag property tests with feature and property number:

```typescript
// Feature: tailwind-css-conversion, Property 1: ChatUI Elements Have Tailwind Classes
it('ChatUI elements should have Tailwind classes', () => {
  // ...
});
```

## Testing Challenges

### WebGPU Not Available
```typescript
it.skipIf(!navigator.gpu)('requires WebGPU', async () => {
  // Test that needs real GPU
});
```

### Async Operations
```typescript
it('should handle async storage', async () => {
  await expect(storage.save(data)).resolves.not.toThrow();
});
```

### DOM Testing
```typescript
it('should create element with correct classes', () => {
  const element = createMessageElement(message);
  expect(element.className).toContain('bg-blue-500');
  expect(element.className).toContain('rounded-xl');
});
```

## Coverage Goals

- Unit tests: Focus on edge cases and error conditions
- Property tests: Focus on invariants and round-trip consistency
- Aim for high coverage on core logic (providers, storage, rendering)
