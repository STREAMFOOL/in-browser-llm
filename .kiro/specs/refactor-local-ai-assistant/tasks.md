# Implementation Plan: Refactor Local AI Assistant Component

## Overview

This implementation plan breaks down the refactoring of `src/local-ai-assistant.ts` (2,485 lines) into a modular structure within `src/local-ai-assistant/` folder. The refactoring follows an 8-phase migration strategy, extracting logical components into separate modules while preserving all existing functionality.

Each phase is designed to be independently testable, ensuring the component continues to work after each extraction. The main component will remain the orchestrator, maintaining all state and delegating to specialized modules.

## Tasks

- [x] 1. Create folder structure and prepare main component
  - Create `src/local-ai-assistant/` directory
  - Copy `src/local-ai-assistant.ts` to `src/local-ai-assistant/index.ts`
  - Verify the component still works from the new location
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. Extract Styles Module (Phase 1)
  - [ ] 2.1 Create styles module with CSS extraction
    - Create `src/local-ai-assistant/styles.ts`
    - Extract all CSS from `initializeComponent` method into `getComponentStyles()` function
    - Export the function with proper JSDoc comments
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [ ] 2.2 Update main component to use styles module
    - Import `getComponentStyles` in `index.ts`
    - Replace inline CSS with call to `getComponentStyles()`
    - Remove extracted CSS from `initializeComponent` method
    - _Requirements: 2.4, 2.6_

  - [ ] 2.3 Verify styles work correctly
    - Run the application and verify all styling appears correctly
    - Check Shadow DOM contains the style element
    - Verify animations (fadeIn, blink) work
    - _Requirements: 2.5, 2.6_

- [ ] 3. Extract UI Renderer Module (Phase 2)
  - [ ] 3.1 Create UI renderer module
    - Create `src/local-ai-assistant/ui-renderer.ts`
    - Extract `renderInitializationStatus` method as pure function
    - Extract `renderFallbackStatus` method as pure function
    - Extract `getTroubleshootingGuide` method as pure function
    - Extract `getNoProviderGuide` method as pure function
    - Add proper TypeScript types and JSDoc comments
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ] 3.2 Update main component to use UI renderer
    - Import all renderer functions in `index.ts`
    - Replace method calls with function calls
    - Remove extracted methods from main component
    - _Requirements: 4.7, 4.8_

  - [ ] 3.3 Verify UI rendering works correctly
    - Test initialization status messages appear correctly
    - Test fallback status messages render properly
    - Verify troubleshooting guides display correctly
    - _Requirements: 4.8_

- [ ] 4. Extract Initialization Module (Phase 3)
  - [ ] 4.1 Create initialization module
    - Create `src/local-ai-assistant/initialization.ts`
    - Define `InitializationContext` and `InitializationResult` interfaces
    - Extract `initializeSession` method as async function
    - Extract `tryWebLLMFallback` method as async function
    - Extract `startModelDownload` method as async function
    - Add proper TypeScript types and JSDoc comments
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ] 4.2 Update main component to use initialization module
    - Import initialization functions and types in `index.ts`
    - Create context objects for initialization calls
    - Replace method calls with function calls
    - Update state from returned results
    - Remove extracted methods from main component
    - _Requirements: 3.6, 3.7_

  - [ ] 4.3 Verify initialization works correctly
    - Test Chrome provider detection and initialization
    - Test WebLLM fallback when Chrome unavailable
    - Test model download progress tracking
    - Verify error handling during initialization
    - _Requirements: 3.7_

- [ ] 5. Checkpoint - Ensure core modules work
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Extract Message Handler Module (Phase 4)
  - [ ] 6.1 Create message handler module
    - Create `src/local-ai-assistant/message-handler.ts`
    - Define `MessageContext` and `MessageResult` interfaces
    - Extract `handleSendMessage` method as async function
    - Extract `handleCancelStream` method as function
    - Extract `saveMessageToThread` method as async function
    - Add proper TypeScript types and JSDoc comments
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 6.2 Update main component to use message handler
    - Import message handler functions and types in `index.ts`
    - Create context objects for message handler calls
    - Replace method calls with function calls
    - Update state from returned results
    - Remove extracted methods from main component
    - _Requirements: 5.6, 5.7, 5.8_

  - [ ] 6.3 Verify message handling works correctly
    - Test sending user messages
    - Test streaming assistant responses
    - Test message cancellation
    - Test message persistence to threads
    - Verify error handling during streaming
    - _Requirements: 5.7, 5.8_

- [ ] 7. Extract Thread Manager Module (Phase 5)
  - [ ] 7.1 Create thread manager module
    - Create `src/local-ai-assistant/thread-manager.ts`
    - Define `ThreadContext` and `ThreadResult` interfaces
    - Extract `generateThreadId` method as pure function
    - Extract `generateThreadTitle` method as pure function
    - Extract `createNewThread` method as async function
    - Extract `handleThreadSelect` method as async function
    - Extract `handleThreadDelete` method as async function
    - Extract `handleNewThread` method as async function
    - Extract `toggleThreadList` method as async function
    - Add proper TypeScript types and JSDoc comments
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9_

  - [ ] 7.2 Update main component to use thread manager
    - Import thread manager functions and types in `index.ts`
    - Create context objects for thread manager calls
    - Replace method calls with function calls
    - Update state from returned results
    - Remove extracted methods from main component
    - _Requirements: 6.10, 6.11_

  - [ ] 7.3 Write property test for thread ID generation
    - **Property 1: Thread ID uniqueness**
    - **Validates: Requirements 6.2**
    - Test that generating multiple thread IDs produces unique values
    - Use fast-check with 100+ iterations

  - [ ] 7.4 Write unit tests for thread manager
    - Test thread title generation with various message lengths
    - Test thread creation with and without initial messages
    - Test thread selection updates UI correctly
    - Test thread deletion removes from storage
    - _Requirements: 6.11_

- [ ] 8. Extract Settings Manager Module (Phase 6)
  - [ ] 8.1 Create settings manager module
    - Create `src/local-ai-assistant/settings-manager.ts`
    - Define `SettingsContext` and `SettingsResult` interfaces
    - Extract `createSettingsPanel` method as function
    - Extract `toggleSettings` method as function
    - Extract `populateProviderList` method as async function
    - Extract `switchProvider` method as async function
    - Extract `handleSettingsChange` method as async function
    - Extract `clearAllData` method as async function
    - Add proper TypeScript types and JSDoc comments
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

  - [ ] 8.2 Update main component to use settings manager
    - Import settings manager functions and types in `index.ts`
    - Create context objects for settings manager calls
    - Replace method calls with function calls
    - Update state from returned results
    - Remove extracted methods from main component
    - _Requirements: 7.9, 7.10_

  - [ ] 8.3 Verify settings management works correctly
    - Test settings panel creation and display
    - Test provider list population
    - Test provider switching
    - Test settings persistence
    - Test data clearing functionality
    - _Requirements: 7.10_

- [ ] 9. Extract Provider Management Module (Phase 7)
  - [ ] 9.1 Create provider management module
    - Create `src/local-ai-assistant/provider-management.ts`
    - Define `ProviderContext` and `ProviderResult` interfaces
    - Extract `updateProviderIndicator` method as function
    - Extract `handleGPURecovery` method as async function
    - Extract `handleApplicationReset` method as async function
    - Extract `resetApplication` method as async function
    - Add proper TypeScript types and JSDoc comments
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ] 9.2 Update main component to use provider management
    - Import provider management functions and types in `index.ts`
    - Create context objects for provider management calls
    - Replace method calls with function calls
    - Update state from returned results
    - Remove extracted methods from main component
    - _Requirements: 8.6, 8.7, 8.8_

  - [ ] 9.3 Verify provider management works correctly
    - Test provider indicator updates in header
    - Test GPU recovery after context loss
    - Test application reset functionality
    - _Requirements: 8.8_

- [ ] 10. Checkpoint - Ensure all modules work together
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Update import paths across codebase (Phase 8)
  - [ ] 11.1 Identify files importing local-ai-assistant
    - Search for imports from `src/local-ai-assistant.ts`
    - List all files that need import updates
    - _Requirements: 11.1_

  - [ ] 11.2 Update import statements
    - Change imports to `src/local-ai-assistant/index.ts` or `src/local-ai-assistant`
    - Verify all imported symbols are still available
    - Ensure no broken imports remain
    - _Requirements: 11.2, 11.3, 11.4_

  - [ ] 11.3 Verify build succeeds
    - Run TypeScript compiler to check for errors
    - Run build process to ensure no issues
    - _Requirements: 11.5_

- [ ] 12. Clean up and verify
  - [ ] 12.1 Remove original file
    - Delete `src/local-ai-assistant.ts` (now replaced by modular structure)
    - Verify application still works without the old file
    - _Requirements: 1.1_

  - [ ] 12.2 Verify all JSDoc comments preserved
    - Check that all requirement references are maintained
    - Ensure all function documentation is complete
    - _Requirements: 12.1, 12.3_

  - [ ] 12.3 Run linter and fix any issues
    - Run ESLint on all new module files
    - Fix any linting errors or warnings
    - _Requirements: 12.6_

  - [ ] 12.4 Run full test suite
    - Run all existing unit tests
    - Run all property-based tests
    - Verify all tests pass without modification
    - _Requirements: 10.10_

  - [ ] 12.5 Write property test for module function purity
    - **Property 1: Module Function Purity**
    - **Validates: Requirements 9.3, 12.4**
    - Test that pure functions produce consistent outputs for same inputs
    - Test render functions, title generation, etc.

  - [ ] 12.6 Write property test for state preservation
    - **Property 2: State Preservation**
    - **Validates: Requirements 9.1, 9.2, 10.1**
    - Test that module function calls only modify explicitly returned state
    - Verify main component state integrity

- [ ] 13. Final checkpoint - Complete refactoring verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Each phase builds on the previous one - complete phases in order
- Checkpoints ensure incremental validation after major milestones
- All existing tests should continue to pass without modification
- The refactoring preserves all functionality - no behavior changes
- Each module extraction follows the same pattern: create module, update main component, verify
- Property tests validate correctness properties from the design document
- Unit tests focus on edge cases and specific behaviors
