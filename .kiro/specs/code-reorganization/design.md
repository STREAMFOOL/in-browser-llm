# Design Document: Code Reorganization

## Overview

This design outlines the approach for reorganizing the Local AI Assistant codebase from a flat structure into a logical, maintainable hierarchy. The reorganization will group related files into modules, split oversized files to meet the 500-line limit, and update all import paths while preserving functionality.

The current structure has 27 TypeScript files, with most at the root level. Three files exceed the 500-line limit and require refactoring. The target structure will use 1-level nesting with clear module boundaries.

## Architecture

### Current Structure Analysis

```
src/
├── local-ai-assistant/     # Only organized module (7 files)
├── [23 files at root]      # Flat structure, no grouping
└── main.ts                 # Entry point
```

**Files Exceeding Line Limits:**
- `local-ai-assistant/styles.ts` (1030 lines) - 206% over limit
- `local-ai-assistant/index.ts` (686 lines) - 137% over limit  
- `settings-ui.ts` (643 lines) - 129% over limit

### Target Structure

```
src/
├── main.ts                          # Entry point (stays at root)
├── component/                       # Web component (renamed from local-ai-assistant)
│   ├── index.ts                    # Main component (split from 686 lines)
│   ├── component-core.ts           # Core component logic (extracted)
│   ├── component-lifecycle.ts      # Lifecycle methods (extracted)
│   ├── session-manager.ts          # Session management
│   ├── thread-manager.ts           # Thread management
│   ├── settings.ts                 # Component settings
│   ├── troubleshoot.ts             # Troubleshooting utilities
│   └── utils.ts                    # Component utilities
├── ui/                              # UI components
│   ├── chat-ui.ts                  # Chat interface
│   ├── settings-ui.ts              # Settings interface (split from 643 lines)
│   ├── settings-ui-sections.ts     # Settings sections (extracted)
│   ├── thread-list-ui.ts           # Thread list interface
│   └── markdown-renderer.ts        # Markdown rendering
├── styles/                          # Styling modules
│   ├── index.ts                    # Style exports
│   ├── base-styles.ts              # Base/layout styles (extracted)
│   ├── component-styles.ts         # Component-specific styles (extracted)
│   ├── theme-styles.ts             # Theme/color styles (extracted)
│   └── animation-styles.ts         # Animation definitions (extracted)
├── providers/                       # Model providers
│   ├── provider-manager.ts         # Provider orchestration
│   ├── model-provider.ts           # Provider interface
│   ├── chrome-provider.ts          # Chrome Gemini Nano
│   ├── webllm-provider.ts          # WebLLM provider
│   ├── api-provider.ts             # External API provider
│   └── gemini-controller.ts        # Gemini-specific logic
├── storage/                         # Data persistence
│   ├── storage-manager.ts          # IndexedDB operations
│   └── opfs-manager.ts             # OPFS file operations
├── core/                            # Core system modules
│   ├── context-window-manager.ts   # Context window handling
│   └── recovery-manager.ts         # Error recovery
└── utils/                           # Utilities
    ├── browser-compatibility.ts    # Browser detection
    ├── hardware-diagnostics.ts     # Hardware checks
    └── error-handler.ts            # Error handling
```

### Module Responsibilities

**component/** - Web component implementation
- Main `<local-ai-assistant>` custom element
- Component lifecycle and state management
- Session and thread coordination
- Component-specific utilities

**ui/** - User interface components
- Reusable UI building blocks
- Chat, settings, and thread list interfaces
- Markdown rendering for messages

**styles/** - Styling system
- Tailwind CSS class definitions
- Animation styles
- Theme configurations
- Split from 1030-line monolithic file

**providers/** - Model provider implementations
- Provider detection and selection
- Chrome, WebLLM, and API provider implementations
- Provider-specific controllers

**storage/** - Data persistence layer
- IndexedDB operations for structured data
- OPFS operations for binary assets
- Storage abstraction interfaces

**core/** - Core system functionality
- Context window management
- Recovery and error handling coordination
- Cross-cutting concerns

**utils/** - Shared utilities
- Browser and hardware detection
- Error handling utilities
- Common helper functions

## Components and Interfaces

### File Split Strategy

#### 1. styles.ts (1030 lines → ~250 lines each)

**Split Rationale:** The file contains distinct style categories that can be cleanly separated.

**Target Files:**
- `styles/base-styles.ts` - Layout, spacing, typography base classes
- `styles/component-styles.ts` - Button, input, card, modal styles
- `styles/theme-styles.ts` - Color schemes, dark mode, theme variables
- `styles/animation-styles.ts` - Animation definitions and transitions
- `styles/index.ts` - Re-exports all styles with organized structure

**Interface:**
```typescript
// styles/index.ts
export { baseStyles } from './base-styles';
export { componentStyles } from './component-styles';
export { themeStyles } from './theme-styles';
export { animationStyles } from './animation-styles';

// Aggregate export for backward compatibility
export const styles = {
  ...baseStyles,
  ...componentStyles,
  ...themeStyles,
  ...animationStyles
};
```

#### 2. local-ai-assistant/index.ts (686 lines → ~230 lines each)

**Split Rationale:** The web component has distinct lifecycle phases and rendering logic.

**Target Files:**
- `component/index.ts` - Component registration, constructor, main structure
- `component/component-core.ts` - Core rendering and DOM manipulation
- `component/component-lifecycle.ts` - Lifecycle hooks (connectedCallback, disconnectedCallback, etc.)

**Interface:**
```typescript
// component/index.ts
import { ComponentCore } from './component-core';
import { ComponentLifecycle } from './component-lifecycle';

export class LocalAIAssistant extends HTMLElement {
  private core: ComponentCore;
  private lifecycle: ComponentLifecycle;
  
  constructor() {
    super();
    this.core = new ComponentCore(this);
    this.lifecycle = new ComponentLifecycle(this, this.core);
  }
  
  connectedCallback() {
    this.lifecycle.onConnected();
  }
  
  disconnectedCallback() {
    this.lifecycle.onDisconnected();
  }
}

customElements.define('local-ai-assistant', LocalAIAssistant);
```

#### 3. settings-ui.ts (643 lines → ~320 lines each)

**Split Rationale:** Settings UI has multiple sections that can be separated.

**Target Files:**
- `ui/settings-ui.ts` - Main settings UI orchestration and layout
- `ui/settings-ui-sections.ts` - Individual settings sections (model, storage, advanced)

**Interface:**
```typescript
// ui/settings-ui.ts
import { SettingsSections } from './settings-ui-sections';

export class SettingsUI {
  private sections: SettingsSections;
  
  render(): HTMLElement {
    const container = this.createContainer();
    container.appendChild(this.sections.renderModelSection());
    container.appendChild(this.sections.renderStorageSection());
    container.appendChild(this.sections.renderAdvancedSection());
    return container;
  }
}
```

### Import Path Updates

**Pattern:** All imports will use relative paths from the new structure.

**Examples:**
```typescript
// Before
import { ChatUI } from './chat-ui';
import { StorageManager } from './storage-manager';
import { ChromeProvider } from './chrome-provider';

// After
import { ChatUI } from '../ui/chat-ui';
import { StorageManager } from '../storage/storage-manager';
import { ChromeProvider } from '../providers/chrome-provider';
```

**Path Alias Option:** If relative paths become unwieldy, add to `tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@ui/*": ["./src/ui/*"],
      "@providers/*": ["./src/providers/*"],
      "@storage/*": ["./src/storage/*"],
      "@core/*": ["./src/core/*"],
      "@utils/*": ["./src/utils/*"],
      "@component/*": ["./src/component/*"],
      "@styles/*": ["./src/styles/*"]
    }
  }
}
```

## Data Models

### File Migration Mapping

```typescript
interface FileMigration {
  sourcePath: string;
  targetPath: string;
  requiresSplit: boolean;
  splitTargets?: string[];
  dependencies: string[];
  dependents: string[];
}

const migrationPlan: FileMigration[] = [
  // Providers module
  {
    sourcePath: 'src/chrome-provider.ts',
    targetPath: 'src/providers/chrome-provider.ts',
    requiresSplit: false,
    dependencies: ['model-provider.ts'],
    dependents: ['provider-manager.ts']
  },
  {
    sourcePath: 'src/webllm-provider.ts',
    targetPath: 'src/providers/webllm-provider.ts',
    requiresSplit: false,
    dependencies: ['model-provider.ts'],
    dependents: ['provider-manager.ts']
  },
  {
    sourcePath: 'src/api-provider.ts',
    targetPath: 'src/providers/api-provider.ts',
    requiresSplit: false,
    dependencies: ['model-provider.ts'],
    dependents: ['provider-manager.ts']
  },
  {
    sourcePath: 'src/provider-manager.ts',
    targetPath: 'src/providers/provider-manager.ts',
    requiresSplit: false,
    dependencies: ['chrome-provider.ts', 'webllm-provider.ts', 'api-provider.ts'],
    dependents: ['local-ai-assistant/index.ts']
  },
  {
    sourcePath: 'src/model-provider.ts',
    targetPath: 'src/providers/model-provider.ts',
    requiresSplit: false,
    dependencies: [],
    dependents: ['chrome-provider.ts', 'webllm-provider.ts', 'api-provider.ts']
  },
  {
    sourcePath: 'src/gemini-controller.ts',
    targetPath: 'src/providers/gemini-controller.ts',
    requiresSplit: false,
    dependencies: [],
    dependents: ['chrome-provider.ts']
  },
  
  // UI module
  {
    sourcePath: 'src/chat-ui.ts',
    targetPath: 'src/ui/chat-ui.ts',
    requiresSplit: false,
    dependencies: ['markdown-renderer.ts'],
    dependents: ['local-ai-assistant/index.ts']
  },
  {
    sourcePath: 'src/settings-ui.ts',
    targetPath: 'src/ui/settings-ui.ts',
    requiresSplit: true,
    splitTargets: ['src/ui/settings-ui.ts', 'src/ui/settings-ui-sections.ts'],
    dependencies: ['storage-manager.ts', 'browser-compatibility.ts'],
    dependents: ['local-ai-assistant/index.ts']
  },
  {
    sourcePath: 'src/thread-list-ui.ts',
    targetPath: 'src/ui/thread-list-ui.ts',
    requiresSplit: false,
    dependencies: ['storage-manager.ts'],
    dependents: ['local-ai-assistant/index.ts']
  },
  {
    sourcePath: 'src/markdown-renderer.ts',
    targetPath: 'src/ui/markdown-renderer.ts',
    requiresSplit: false,
    dependencies: [],
    dependents: ['chat-ui.ts']
  },
  
  // Storage module
  {
    sourcePath: 'src/storage-manager.ts',
    targetPath: 'src/storage/storage-manager.ts',
    requiresSplit: false,
    dependencies: ['opfs-manager.ts'],
    dependents: ['local-ai-assistant/index.ts', 'settings-ui.ts', 'thread-list-ui.ts']
  },
  {
    sourcePath: 'src/opfs-manager.ts',
    targetPath: 'src/storage/opfs-manager.ts',
    requiresSplit: false,
    dependencies: [],
    dependents: ['storage-manager.ts']
  },
  
  // Core module
  {
    sourcePath: 'src/context-window-manager.ts',
    targetPath: 'src/core/context-window-manager.ts',
    requiresSplit: false,
    dependencies: [],
    dependents: ['local-ai-assistant/index.ts']
  },
  {
    sourcePath: 'src/recovery-manager.ts',
    targetPath: 'src/core/recovery-manager.ts',
    requiresSplit: false,
    dependencies: ['storage-manager.ts'],
    dependents: ['local-ai-assistant/index.ts']
  },
  
  // Utils module
  {
    sourcePath: 'src/browser-compatibility.ts',
    targetPath: 'src/utils/browser-compatibility.ts',
    requiresSplit: false,
    dependencies: [],
    dependents: ['provider-manager.ts', 'settings-ui.ts']
  },
  {
    sourcePath: 'src/hardware-diagnostics.ts',
    targetPath: 'src/utils/hardware-diagnostics.ts',
    requiresSplit: false,
    dependencies: [],
    dependents: ['settings-ui.ts']
  },
  {
    sourcePath: 'src/error-handler.ts',
    targetPath: 'src/utils/error-handler.ts',
    requiresSplit: false,
    dependencies: [],
    dependents: ['local-ai-assistant/index.ts']
  },
  
  // Styles module (requires split)
  {
    sourcePath: 'src/local-ai-assistant/styles.ts',
    targetPath: 'src/styles/index.ts',
    requiresSplit: true,
    splitTargets: [
      'src/styles/base-styles.ts',
      'src/styles/component-styles.ts',
      'src/styles/theme-styles.ts',
      'src/styles/animation-styles.ts',
      'src/styles/index.ts'
    ],
    dependencies: [],
    dependents: ['local-ai-assistant/index.ts']
  },
  
  // Component module (rename from local-ai-assistant)
  {
    sourcePath: 'src/local-ai-assistant/index.ts',
    targetPath: 'src/component/index.ts',
    requiresSplit: true,
    splitTargets: [
      'src/component/index.ts',
      'src/component/component-core.ts',
      'src/component/component-lifecycle.ts'
    ],
    dependencies: [
      'session-manager.ts',
      'thread-manager.ts',
      'settings.ts',
      'styles.ts',
      'chat-ui.ts',
      'provider-manager.ts',
      'storage-manager.ts'
    ],
    dependents: ['main.ts']
  },
  {
    sourcePath: 'src/local-ai-assistant/session-manager.ts',
    targetPath: 'src/component/session-manager.ts',
    requiresSplit: false,
    dependencies: [],
    dependents: ['local-ai-assistant/index.ts']
  },
  {
    sourcePath: 'src/local-ai-assistant/thread-manager.ts',
    targetPath: 'src/component/thread-manager.ts',
    requiresSplit: false,
    dependencies: ['storage-manager.ts'],
    dependents: ['local-ai-assistant/index.ts']
  },
  {
    sourcePath: 'src/local-ai-assistant/settings.ts',
    targetPath: 'src/component/settings.ts',
    requiresSplit: false,
    dependencies: [],
    dependents: ['local-ai-assistant/index.ts']
  },
  {
    sourcePath: 'src/local-ai-assistant/troubleshoot.ts',
    targetPath: 'src/component/troubleshoot.ts',
    requiresSplit: false,
    dependencies: [],
    dependents: ['local-ai-assistant/index.ts']
  },
  {
    sourcePath: 'src/local-ai-assistant/utils.ts',
    targetPath: 'src/component/utils.ts',
    requiresSplit: false,
    dependencies: [],
    dependents: ['local-ai-assistant/index.ts']
  }
];
```

### Migration Order Strategy

Files will be migrated in dependency order to minimize breaking changes:

1. **Phase 1: Leaf nodes** (no dependencies)
   - model-provider.ts → providers/
   - opfs-manager.ts → storage/
   - browser-compatibility.ts → utils/
   - hardware-diagnostics.ts → utils/
   - error-handler.ts → utils/

2. **Phase 2: Mid-level modules** (depend on Phase 1)
   - chrome-provider.ts → providers/
   - webllm-provider.ts → providers/
   - api-provider.ts → providers/
   - gemini-controller.ts → providers/
   - storage-manager.ts → storage/
   - markdown-renderer.ts → ui/

3. **Phase 3: High-level modules** (depend on Phase 1-2)
   - provider-manager.ts → providers/
   - context-window-manager.ts → core/
   - recovery-manager.ts → core/
   - chat-ui.ts → ui/
   - thread-list-ui.ts → ui/

4. **Phase 4: Split large files**
   - Split styles.ts → styles/ (4 files)
   - Split settings-ui.ts → ui/ (2 files)

5. **Phase 5: Component module** (depends on everything)
   - Split local-ai-assistant/index.ts → component/ (3 files)
   - Move remaining local-ai-assistant/* → component/

6. **Phase 6: Update entry point**
   - Update main.ts imports


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: File Discovery Completeness
*For any* directory structure containing TypeScript files, the analysis system should identify all `.ts` files within the src directory, with no files missed or duplicated.
**Validates: Requirements 1.1**

### Property 2: File Size Flagging Accuracy
*For any* set of TypeScript files with varying line counts, the analysis system should correctly flag all files exceeding 500 lines and not flag files at or below 500 lines.
**Validates: Requirements 1.2**

### Property 3: Dependency Mapping Correctness
*For any* set of TypeScript files with import statements, the dependency analysis should correctly map all import relationships, where each import statement creates exactly one dependency edge in the graph.
**Validates: Requirements 1.3**

### Property 4: File Placement Correctness
*For any* file in the migration plan, after reorganization the file should exist in its designated target directory according to the module grouping rules (providers, ui, storage, utils, core, component, styles).
**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**

### Property 5: Migration Plan Completeness
*For any* source file in the codebase, the migration plan should specify: (1) a target path, (2) whether it requires splitting, and (3) all necessary import path updates.
**Validates: Requirements 4.2, 4.3, 4.5**

### Property 6: Dependency-Ordered Migration
*For any* two files A and B where A imports B, the migration plan should order B's migration before or simultaneously with A's migration, ensuring dependencies are never broken.
**Validates: Requirements 4.4**

### Property 7: Import Path Resolution
*For any* file after reorganization, all import statements should resolve to valid file paths, with no broken imports or circular dependencies introduced.
**Validates: Requirements 5.1, 7.2**

### Property 8: Export API Preservation
*For any* file that is split into multiple files, the combined exports from the new files should include all exports that existed in the original file, maintaining the public API.
**Validates: Requirements 5.2**

### Property 9: Requirement Comment Preservation
*For any* file containing requirement traceability comments (matching pattern `Requirements: X.Y`), after moving the file, all such comments should still be present in the moved file.
**Validates: Requirements 5.4**

### Property 10: Configuration Path Updates
*For any* configuration file (tsconfig.json, vite.config.ts) containing file paths, after reorganization all paths should be updated to reflect the new structure, with no references to old paths remaining.
**Validates: Requirements 6.3, 6.4**

## Error Handling

### Migration Errors

**Circular Dependency Detection:**
- Before migration, analyze the dependency graph for cycles
- If cycles exist, report them to the user with file paths
- Suggest refactoring to break cycles before proceeding

**Import Resolution Failures:**
- After each file move, verify all imports resolve
- If imports fail, roll back the move and report the issue
- Provide suggested import path corrections

**File Split Failures:**
- If a file cannot be cleanly split at 500 lines, report the issue
- Suggest manual refactoring or allow proceeding with larger files
- Document exceptions in the migration log

### Build Validation Errors

**TypeScript Compilation Errors:**
- After reorganization, run `tsc --noEmit` to check for errors
- If errors exist, categorize them (import errors, type errors, etc.)
- Provide actionable error messages with file locations

**Vite Build Errors:**
- After reorganization, run `vite build` to verify production build
- If build fails, capture error output and suggest fixes
- Check for common issues (missing files, incorrect paths)

### Rollback Strategy

**Checkpoint System:**
- Create git commits after each migration phase
- Allow rolling back to any checkpoint if issues arise
- Maintain a migration log with all changes

**Validation Gates:**
- After each phase, run tests and build validation
- Only proceed to next phase if validation passes
- Provide clear error messages if validation fails

## Testing Strategy

### Unit Tests

Unit tests will verify specific examples and edge cases:

**File Analysis Tests:**
- Test file discovery with known directory structures
- Test file size calculation with files of various sizes
- Test dependency parsing with different import syntaxes (relative, absolute, aliased)

**Migration Plan Tests:**
- Test migration plan generation with sample codebases
- Test dependency ordering with various dependency graphs
- Test import path calculation with different directory depths

**File Operations Tests:**
- Test file moving with various source/target combinations
- Test file splitting with different split strategies
- Test import statement updates with various import formats

**Build Validation Tests:**
- Test TypeScript compilation with reorganized structure
- Test Vite build with reorganized structure
- Test component registration after reorganization

### Property-Based Tests

Property-based tests will verify universal properties across many generated inputs. Each test will run a minimum of 100 iterations.

**Test Configuration:**
- Library: fast-check (JavaScript/TypeScript property testing)
- Iterations: 100 minimum per property
- Seed: Randomized (for reproducibility on failure)

**Property Test Suite:**

1. **File Discovery Property Test**
   - Generate random directory structures with TypeScript files
   - Verify all files are discovered (Property 1)
   - Tag: `Feature: code-reorganization, Property 1: File Discovery Completeness`

2. **File Size Flagging Property Test**
   - Generate files with random line counts (0-1000 lines)
   - Verify correct flagging at 500-line threshold (Property 2)
   - Tag: `Feature: code-reorganization, Property 2: File Size Flagging Accuracy`

3. **Dependency Mapping Property Test**
   - Generate files with random import statements
   - Verify dependency graph correctness (Property 3)
   - Tag: `Feature: code-reorganization, Property 3: Dependency Mapping Correctness`

4. **File Placement Property Test**
   - Generate random file sets with various types (provider, ui, storage, etc.)
   - Verify correct directory placement after migration (Property 4)
   - Tag: `Feature: code-reorganization, Property 4: File Placement Correctness`

5. **Migration Plan Completeness Property Test**
   - Generate random codebases with various file structures
   - Verify migration plan includes all required information (Property 5)
   - Tag: `Feature: code-reorganization, Property 5: Migration Plan Completeness`

6. **Dependency Ordering Property Test**
   - Generate random dependency graphs
   - Verify migration order respects dependencies (Property 6)
   - Tag: `Feature: code-reorganization, Property 6: Dependency-Ordered Migration`

7. **Import Resolution Property Test**
   - Generate files with random imports, move them, update imports
   - Verify all imports resolve correctly (Property 7)
   - Tag: `Feature: code-reorganization, Property 7: Import Path Resolution`

8. **Export Preservation Property Test**
   - Generate files with random exports, split them
   - Verify all exports are preserved (Property 8)
   - Tag: `Feature: code-reorganization, Property 8: Export API Preservation`

9. **Comment Preservation Property Test**
   - Generate files with requirement comments, move them
   - Verify comments are preserved (Property 9)
   - Tag: `Feature: code-reorganization, Property 9: Requirement Comment Preservation`

10. **Configuration Update Property Test**
    - Generate configuration files with random paths, reorganize files
    - Verify all paths are updated (Property 10)
    - Tag: `Feature: code-reorganization, Property 10: Configuration Path Updates`

### Integration Tests

Integration tests will verify the end-to-end reorganization process:

**Full Reorganization Test:**
- Start with the current codebase structure
- Run the complete reorganization process
- Verify all tests pass, build succeeds, component works

**Incremental Migration Test:**
- Test each migration phase independently
- Verify checkpoints work correctly
- Test rollback functionality

**Real-World Validation:**
- Run the reorganization on the actual codebase
- Verify the web component loads in a browser
- Test all major features (chat, settings, thread management)
- Verify no console errors or warnings
