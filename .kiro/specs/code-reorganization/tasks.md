# Implementation Plan: Code Reorganization

## Overview

This plan reorganizes the Local AI Assistant codebase from a flat structure into a logical, maintainable hierarchy with 7 modules. The implementation follows a 6-phase approach that moves files in dependency order, splits oversized files, and validates at each checkpoint.

## Tasks

- [x] 1. Create target directory structure
  - Create all module directories: `src/component/`, `src/ui/`, `src/styles/`, `src/providers/`, `src/storage/`, `src/core/`, `src/utils/`
  - Create git checkpoint: "Phase 0: Directory structure created"
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 4.1_

- [x] 2. Phase 1: Migrate leaf node files (no dependencies)
  - [x] 2.1 Move model-provider.ts to providers/model-provider.ts
    - Update any imports in dependent files
    - _Requirements: 2.1, 5.1_
  
  - [x] 2.2 Move opfs-manager.ts to storage/opfs-manager.ts
    - Update imports in storage-manager.ts
    - _Requirements: 2.3, 5.1_
  
  - [x] 2.3 Move browser-compatibility.ts to utils/browser-compatibility.ts
    - Update imports in provider-manager.ts and settings-ui.ts
    - _Requirements: 2.4, 5.1_
  
  - [x] 2.4 Move hardware-diagnostics.ts to utils/hardware-diagnostics.ts
    - Update imports in settings-ui.ts
    - _Requirements: 2.4, 5.1_
  
  - [x] 2.5 Move error-handler.ts to utils/error-handler.ts
    - Update imports in local-ai-assistant/index.ts
    - _Requirements: 2.4, 5.1_
  
  - [x] 2.6 Create git checkpoint and validate
    - Commit: "Phase 1: Leaf node files migrated"
    - Run TypeScript compilation: `npx tsc --noEmit`
    - Verify no compilation errors
    - _Requirements: 6.2_

- [x] 3. Phase 2: Migrate mid-level modules
  - [x] 3.1 Move chrome-provider.ts to providers/chrome-provider.ts
    - Update imports (model-provider from new location)
    - Update imports in provider-manager.ts
    - _Requirements: 2.1, 5.1_
  
  - [x] 3.2 Move webllm-provider.ts to providers/webllm-provider.ts
    - Update imports (model-provider from new location)
    - Update imports in provider-manager.ts
    - _Requirements: 2.1, 5.1_
  
  - [x] 3.3 Move api-provider.ts to providers/api-provider.ts
    - Update imports (model-provider from new location)
    - Update imports in provider-manager.ts
    - _Requirements: 2.1, 5.1_
  
  - [x] 3.4 Move gemini-controller.ts to providers/gemini-controller.ts
    - Update imports in chrome-provider.ts
    - _Requirements: 2.1, 5.1_
  
  - [x] 3.5 Move storage-manager.ts to storage/storage-manager.ts
    - Update imports (opfs-manager from new location)
    - Update imports in local-ai-assistant/index.ts, settings-ui.ts, thread-list-ui.ts, recovery-manager.ts
    - _Requirements: 2.3, 5.1_
  
  - [x] 3.6 Move markdown-renderer.ts to ui/markdown-renderer.ts
    - Update imports in chat-ui.ts
    - _Requirements: 2.2, 5.1_
  
  - [x] 3.7 Create git checkpoint and validate
    - Commit: "Phase 2: Mid-level modules migrated"
    - Run TypeScript compilation: `npx tsc --noEmit`
    - Verify no compilation errors
    - _Requirements: 6.2_

- [ ] 4. Phase 3: Migrate high-level modules
  - [ ] 4.1 Move provider-manager.ts to providers/provider-manager.ts
    - Update imports (all providers from new locations)
    - Update imports in local-ai-assistant/index.ts
    - _Requirements: 2.1, 5.1_
  
  - [ ] 4.2 Move context-window-manager.ts to core/context-window-manager.ts
    - Update imports in local-ai-assistant/index.ts
    - _Requirements: 2.6, 5.1_
  
  - [ ] 4.3 Move recovery-manager.ts to core/recovery-manager.ts
    - Update imports (storage-manager from new location)
    - Update imports in local-ai-assistant/index.ts
    - _Requirements: 2.6, 5.1_
  
  - [ ] 4.4 Move chat-ui.ts to ui/chat-ui.ts
    - Update imports (markdown-renderer from new location)
    - Update imports in local-ai-assistant/index.ts
    - _Requirements: 2.2, 5.1_
  
  - [ ] 4.5 Move thread-list-ui.ts to ui/thread-list-ui.ts
    - Update imports (storage-manager from new location)
    - Update imports in local-ai-assistant/index.ts
    - _Requirements: 2.2, 5.1_
  
  - [ ] 4.6 Create git checkpoint and validate
    - Commit: "Phase 3: High-level modules migrated"
    - Run TypeScript compilation: `npx tsc --noEmit`
    - Verify no compilation errors
    - _Requirements: 6.2_

- [ ] 5. Checkpoint: Verify build and tests
  - Run full test suite: `npm test`
  - Run Vite build: `npm run build`
  - Ensure all tests pass and build succeeds
  - _Requirements: 5.3, 6.1, 6.2_

- [ ] 6. Phase 4: Split large files
  - [ ] 6.1 Split styles.ts into 4 files
    - Create `src/styles/base-styles.ts` with layout, spacing, typography classes
    - Create `src/styles/component-styles.ts` with button, input, card, modal styles
    - Create `src/styles/theme-styles.ts` with color schemes and theme variables
    - Create `src/styles/animation-styles.ts` with animation definitions
    - Create `src/styles/index.ts` that re-exports all styles
    - Verify all exports are preserved (check original exports list)
    - Delete original `src/local-ai-assistant/styles.ts`
    - _Requirements: 3.2, 3.3, 5.2_
  
  - [ ] 6.2 Write property test for styles split
    - **Property 8: Export API Preservation**
    - Verify all original style exports are available from new structure
    - **Validates: Requirements 5.2**
  
  - [ ] 6.3 Split settings-ui.ts into 2 files
    - Create `src/ui/settings-ui.ts` with main orchestration and layout (~320 lines)
    - Create `src/ui/settings-ui-sections.ts` with individual section renderers (~320 lines)
    - Update imports to use SettingsSections class
    - Verify all exports are preserved
    - _Requirements: 3.2, 3.3, 5.2_
  
  - [ ] 6.4 Write property test for settings-ui split
    - **Property 8: Export API Preservation**
    - Verify all original SettingsUI exports are available
    - **Validates: Requirements 5.2**
  
  - [ ] 6.5 Create git checkpoint and validate
    - Commit: "Phase 4: Large files split"
    - Run TypeScript compilation: `npx tsc --noEmit`
    - Verify no compilation errors
    - _Requirements: 6.2_

- [ ] 7. Phase 5: Reorganize component module
  - [ ] 7.1 Move local-ai-assistant files to component directory
    - Move `src/local-ai-assistant/session-manager.ts` to `src/component/session-manager.ts`
    - Move `src/local-ai-assistant/thread-manager.ts` to `src/component/thread-manager.ts`
    - Move `src/local-ai-assistant/settings.ts` to `src/component/settings.ts`
    - Move `src/local-ai-assistant/troubleshoot.ts` to `src/component/troubleshoot.ts`
    - Move `src/local-ai-assistant/utils.ts` to `src/component/utils.ts`
    - Update all imports in these files to reference new module locations
    - _Requirements: 2.5, 5.1, 7.1_
  
  - [ ] 7.2 Split local-ai-assistant/index.ts into 3 files
    - Create `src/component/component-core.ts` with core rendering and DOM manipulation (~230 lines)
    - Create `src/component/component-lifecycle.ts` with lifecycle hooks (~230 lines)
    - Create `src/component/index.ts` with component registration and main structure (~230 lines)
    - Update imports to reference all reorganized modules (ui, providers, storage, core, utils, styles)
    - Verify LocalAIAssistant class is properly exported
    - Delete original `src/local-ai-assistant/` directory
    - _Requirements: 3.2, 3.3, 5.2, 7.1_
  
  - [ ] 7.3 Write property test for component split
    - **Property 8: Export API Preservation**
    - Verify LocalAIAssistant export is available
    - **Validates: Requirements 5.2**
  
  - [ ] 7.4 Create git checkpoint and validate
    - Commit: "Phase 5: Component module reorganized"
    - Run TypeScript compilation: `npx tsc --noEmit`
    - Verify no compilation errors
    - _Requirements: 6.2_

- [ ] 8. Phase 6: Update entry point and configuration
  - [ ] 8.1 Update main.ts imports
    - Update import path: `from './local-ai-assistant/index'` to `from './component/index'`
    - Verify export structure is maintained
    - _Requirements: 5.1, 7.3_
  
  - [ ] 8.2 Update vite.config.ts if needed
    - Check for any hardcoded paths referencing old structure
    - Update any path references to new structure
    - _Requirements: 6.4_
  
  - [ ] 8.3 Update tsconfig.json if needed
    - Add path aliases if relative imports become unwieldy
    - Configure paths for @ui, @providers, @storage, @core, @utils, @component, @styles
    - _Requirements: 6.3_
  
  - [ ] 8.4 Create git checkpoint and validate
    - Commit: "Phase 6: Entry point and configuration updated"
    - Run TypeScript compilation: `npx tsc --noEmit`
    - Run Vite build: `npm run build`
    - Verify no errors
    - _Requirements: 6.1, 6.2_

- [ ] 9. Final validation and testing
  - [ ] 9.1 Run full test suite
    - Execute: `npm test`
    - Verify all existing tests pass
    - _Requirements: 5.3_
  
  - [ ] 9.2 Verify web component functionality
    - Build project: `npm run build`
    - Start dev server: `npm run dev`
    - Open browser and verify component loads
    - Test chat functionality
    - Test settings UI
    - Test thread management
    - Verify no console errors
    - _Requirements: 7.4_
  
  - [ ] 9.3 Verify requirement traceability
    - Search for all "Requirements: X.Y" comments in codebase
    - Verify comments are preserved in moved files
    - _Requirements: 5.4_
  
  - [ ] 9.4 Write property test for requirement comment preservation
    - **Property 9: Requirement Comment Preservation**
    - Verify all requirement comments are present after reorganization
    - **Validates: Requirements 5.4**

- [ ] 10. Documentation and cleanup
  - [ ] 10.1 Update project-overview.md
    - Update project structure section with new directory layout
    - Update file descriptions with new paths
    - _Requirements: 3.4_
  
  - [ ] 10.2 Update coding-standards.md if needed
    - Add guidance on new module structure
    - Document import conventions for new structure
    - _Requirements: 3.4_
  
  - [ ] 10.3 Remove obsolete files
    - Delete `src/counter.ts` if unused
    - Delete `src/typescript.svg` if unused
    - Clean up any temporary files
    - _Requirements: 12.6 (from original spec)_
  
  - [ ] 10.4 Create final git commit
    - Commit: "Code reorganization complete"
    - Tag: "v2.0-reorganized"
    - Push to repository

- [ ] 11. Property-based test suite (comprehensive testing)
  - [ ] 11.1 Write property test for file discovery
    - **Property 1: File Discovery Completeness**
    - Generate random directory structures, verify all files found
    - **Validates: Requirements 1.1**
  
  - [ ] 11.2 Write property test for file size flagging
    - **Property 2: File Size Flagging Accuracy**
    - Generate files with random line counts, verify correct flagging
    - **Validates: Requirements 1.2**
  
  - [ ] 11.3 Write property test for dependency mapping
    - **Property 3: Dependency Mapping Correctness**
    - Generate files with random imports, verify dependency graph
    - **Validates: Requirements 1.3**
  
  - [ ] 11.4 Write property test for file placement
    - **Property 4: File Placement Correctness**
    - Verify all files are in correct directories after reorganization
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**
  
  - [ ] 11.5 Write property test for import resolution
    - **Property 7: Import Path Resolution**
    - Verify all imports resolve correctly after reorganization
    - **Validates: Requirements 5.1, 7.2**
  
  - [ ] 11.6 Write property test for configuration updates
    - **Property 10: Configuration Path Updates**
    - Verify no old paths remain in configuration files
    - **Validates: Requirements 6.3, 6.4**

## Notes

- All tasks are required for comprehensive reorganization
- Each phase includes a git checkpoint for easy rollback if needed
- TypeScript compilation is verified after each phase to catch errors early
- The full test suite runs at checkpoint (task 5) and final validation (task 9)
- Property tests validate universal correctness properties across many inputs
- Manual browser testing ensures the web component works end-to-end
