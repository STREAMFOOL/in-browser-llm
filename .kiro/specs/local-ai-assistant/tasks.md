# Implementation Plan: Local AI Assistant

## Overview

This implementation plan breaks down the Local AI Assistant into discrete, incremental coding tasks. The approach follows a phased strategy: starting with core text chat functionality, then adding the provider abstraction layer for cross-browser support, followed by multimodal capabilities, and finally implementing advanced features like RAG and web search. Each task builds on previous work, ensuring no orphaned code.

The implementation uses TypeScript with Vite for bundling, Web Components for encapsulation, and fast-check for property-based testing. The hybrid model provider architecture supports Chrome's built-in Gemini Nano, WebLLM for cross-browser local inference (Brave, Firefox), and optional external API providers as fallback.

## Tasks

- [x] 1. Project Setup and Core Infrastructure
  - _Requirements: 5.1, 5.2_

- [x] 1.1 Write property test for Web Component structure
  - **Property: Web Component Registration**
  - **Validates: Requirements 5.1, 5.2**
  - Verify custom element is registered and has closed Shadow DOM

- [x] 2. Browser Environment Validation
  - [x] 2.1 Implement browser compatibility checker
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2.2 Write property test for version validation
  - **Property 1: Version Validation Correctness**
  - **Validates: Requirements 1.1, 1.5**

- [x] 2.3 Write property test for storage threshold validation
  - **Property 2: Storage Threshold Validation**
  - **Validates: Requirements 1.3, 1.6**

- [x] 2.4 Write unit tests for environment validation
  - _Requirements: 1.2, 1.5, 1.6_

- [x] 3. Storage Layer Implementation
  - [x] 3.1 Set up IndexedDB with Dexie.js
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 3.2 Implement OPFS integration
    - _Requirements: 7.5, 10.6_

  - [x] 3.3 Write property test for storage round-trip consistency
    - **Property 7: Storage Round-Trip Consistency**
    - **Validates: Requirements 4.1, 4.2, 4.5, 7.5, 9.6, 10.6, 12.3, 12.4**

  - [x] 3.4 Write property test for thread identifier uniqueness
    - **Property 8: Thread Identifier Uniqueness**
    - **Validates: Requirements 4.4, 13.2**

  - [x] 3.5 Write unit tests for storage operations
    - _Requirements: 4.3, 4.6_

- [x] 4. Gemini Nano Integration
  - [x] 4.1 Implement GeminiController
    - _Requirements: 2.1, 2.4, 3.1, 3.2, 3.5_

- [x] 4.2 Implement context window management
  - _Requirements: 3.4_

- [x] 4.3 Write property test for session lifecycle management
  - **Property 3: Session Lifecycle Management**
  - **Validates: Requirements 3.1, 3.5**

- [x] 4.4 Write property test for context window management
  - **Property 5: Context Window Management**
  - **Validates: Requirements 3.4**

- [x] 4.5 Write unit tests for model availability states
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 5. Basic Chat UI Implementation
  - [x] 5.1 Create chat interface components
    - _Requirements: 3.2, 3.3_

- [x] 5.2 Implement streaming response rendering
  - _Requirements: 3.3, 14.1, 14.2, 14.3_

- [x] 5.3 Implement stream cancellation
  - _Requirements: 14.4, 14.5_

- [x] 5.4 Write property test for streaming incremental rendering
  - **Property 4: Streaming Incremental Rendering**
  - **Validates: Requirements 3.3, 14.1, 14.2**

- [x] 5.5 Write property test for stream cancellation
  - **Property 31: Stream Cancellation**
  - **Validates: Requirements 14.4, 14.5**

- [x] 5.6 Write unit test for incomplete code block handling
  - _Requirements: 14.3_

- [x] 6. Checkpoint - Basic Chat Functionality
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6.5. Model Provider Abstraction Layer
  - [x] 6.5.1 Define ModelProvider interface and types
    - _Requirements: 16.1_

  - [x] 6.5.2 Implement ProviderManager
    - _Requirements: 16.2, 16.3, 16.4, 16.5, 16.7, 16.8_

  - [x] 6.5.3 Refactor GeminiController into ChromeProvider
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6_

  - [x] 6.5.4 Write property test for provider interface consistency
    - **Property 33: Provider Interface Consistency**
    - **Validates: Requirements 16.1, 16.2**

  - [x] 6.5.5 Write property test for provider selection priority
    - **Property 34: Provider Selection Priority**
    - **Validates: Requirements 16.2, 16.3, 16.4, 16.5**

  - [x] 6.5.6 Write unit tests for ProviderManager
    - _Requirements: 16.2, 16.7, 16.8_

- [x] 6.6. WebLLM Provider Implementation
  - [x] 6.6.1 Install and configure WebLLM dependency
    - _Requirements: 18.1_

  - [x] 6.6.2 Implement WebLLMProvider class
    - _Requirements: 18.1, 18.2, 18.5_

  - [x] 6.6.3 Implement model download and caching
    - _Requirements: 18.3, 18.4, 18.7_

  - [x] 6.6.4 Implement streaming inference
    - _Requirements: 18.6_

  - [x] 6.6.5 Write property test for streaming equivalence
    - **Property 35: Provider Streaming Equivalence**
    - **Validates: Requirements 16.1, 17.6, 18.6, 19.5**

  - [x] 6.6.6 Write property test for model caching
    - **Property 36: WebLLM Model Caching**
    - **Validates: Requirements 18.3, 18.7**

  - [x] 6.6.7 Write unit tests for WebLLMProvider
    - _Requirements: 18.2, 18.5, 18.8_

- [-] 6.7. API Provider Implementation (Optional Fallback)
  - [x] 6.7.1 Implement APIProvider class
    - Implement ModelProvider interface
    - Support OpenAI, Anthropic, and Ollama backends
    - _Requirements: 19.1_

  - [x] 6.7.2 Implement secure API key storage
    - Store API keys in IndexedDB (not LocalStorage)
    - Provide key management UI in settings
    - _Requirements: 19.2, 19.4_

  - [x] 6.7.3 Implement streaming API calls
    - Use fetch with streaming response
    - Parse Server-Sent Events for OpenAI/Anthropic
    - Handle Ollama streaming format
    - _Requirements: 19.5_

  - [x] 6.7.4 Add privacy warning for external APIs
    - Display warning when API provider is active
    - Exclude warning for local Ollama endpoint
    - _Requirements: 19.3, 19.6_

  - [x] 6.7.5 Write property test for API key security
    - **Property 37: API Key Security**
    - **Validates: Requirements 19.4**

  - [x] 6.7.6 Write unit tests for APIProvider
    - Test API key validation
    - Test streaming response parsing
    - Test privacy warning display
    - _Requirements: 19.1, 19.3, 19.5_

- [x] 6.8. Update UI for Provider Selection
  - [x] 6.8.1 Add provider indicator to chat header
    - _Requirements: 16.7_

  - [x] 6.8.2 Add provider selection to settings
    - _Requirements: 16.8, 18.5, 18.8_

  - [x] 6.8.3 Update error messages for provider-specific issues
    - _Requirements: 16.6_

  - [x] 6.8.4 Write unit tests for provider UI
    - _Requirements: 16.7, 16.8_

- [x] 6.9. Checkpoint - Provider Abstraction Complete
  - Ensure all tests pass, ask the user if questions arise.
  - Verify Chrome provider works as before
  - Verify WebLLM provider works in Brave/Firefox
  - Verify API provider works as fallback

- [-] 7. Thread Management Implementation
  - [x] 7.1 Implement thread creation and storage
    - Generate unique thread IDs
    - Auto-generate titles from first message
    - Store threads in IndexedDB
    - _Requirements: 4.4, 13.2, 13.5_

- [x] 7.2 Create thread list UI
  - Sidebar/drawer with thread list
  - Display title and last message timestamp
  - Thread selection and deletion
  - _Requirements: 13.1, 13.3, 13.4, 13.6_

- [x] 7.3 Write property test for thread list completeness
  - **Property 27: Thread List Completeness**
  - **Validates: Requirements 13.1, 13.6**

- [ ] 7.4 Write property test for thread message ordering
  - **Property 28: Thread Message Ordering**
  - **Validates: Requirements 13.3**

- [ ] 7.5 Write property test for thread deletion completeness
  - **Property 29: Thread Deletion Completeness**
  - **Validates: Requirements 13.4**

- [ ] 7.6 Write property test for thread title generation
  - **Property 30: Thread Title Generation**
  - **Validates: Requirements 13.5**

- [x] 8. Error Handling and Recovery
  - [x] 8.1 Implement error handling system
    - _Requirements: 3.6, 15.1, 15.2, 15.3, 15.4_

- [x] 8.2 Implement recovery mechanisms
  - _Requirements: 15.5, 15.6_

- [x] 8.3 Write property test for error handling consistency
  - **Property 6: Error Handling Consistency**
  - **Validates: Requirements 3.6, 15.4**

- [x] 8.4 Write unit tests for specific error scenarios
  - _Requirements: 15.1, 15.2, 15.3, 15.5, 15.6_

- [x] 9. Settings and Hardware Diagnostics
  - [x] 9.1 Implement HardwareDiagnostics module
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 9.2 Create settings UI
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 12.1, 12.2, 12.5_

  - [x] 9.3 Implement feature gating based on hardware
    - _Requirements: 6.5, 6.6, 7.6_

  - [ ]* 9.4 Write property test for hardware-based feature gating
    - **Property 12: Hardware-Based Feature Gating**
    - **Validates: Requirements 6.5, 6.6, 7.6**

  - [ ]* 9.5 Write property test for settings persistence
    - **Property 25: Settings Persistence**
    - **Validates: Requirements 12.3, 12.4**

  - [ ]* 9.6 Write unit tests for hardware display
    - Test RAM, CPU, storage, GPU display
    - Test feature toggles
    - Test clear data button
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 12.2, 12.5_

- [x] 10. Checkpoint - Core Features Complete
  - All 171 tests passing successfully
  - Core features validated: Web Components, browser compatibility, storage, Gemini Nano integration, chat UI, provider abstraction, WebLLM provider, error handling, and settings

- [x] 11. Web Worker Infrastructure
  - [x] 11.1 Create InferenceWorkerManager
    - Initialize workers for different model types
    - Implement worker pool (max 2 concurrent)
    - Handle progress callbacks
    - Implement cancellation via AbortController
    - _Requirements: 7.2, 8.5_

  - [x] 11.2 Set up WebGPU context in workers
    - Initialize WebGPU adapter and device
    - Handle GPU context loss
    - _Requirements: 7.1, 10.1_

  - [x] 11.3 Write property test for worker non-blocking execution
    - **Property 13: Worker Non-Blocking Execution**
    - **Validates: Requirements 7.2, 7.3, 8.5**

- [ ] 12. Image Generation Implementation
  - [ ] 12.1 Integrate Web-Stable-Diffusion
    - Load Stable Diffusion model weights
    - Implement progressive loading with caching
    - Execute diffusion pipeline in worker
    - _Requirements: 7.1, 7.2_

- [ ] 12.2 Create image generation UI
  - Prompt input for image generation
    - Progress indicator for diffusion steps
    - Canvas rendering for results
    - Save to OPFS
    - _Requirements: 7.3, 7.4, 7.5_

- [ ] 12.3 Write property test for image generation output
  - **Property 14: Image Generation Output**
  - **Validates: Requirements 7.4**

- [ ] 12.4 Write unit test for image generation model loading
  - Test model loading on image generation request
  - Test VRAM check and feature disabling
  - _Requirements: 7.1, 7.6_

- [ ] 13. Speech Input and Output
  - [ ] 13.1 Implement ASR with Whisper
    - Integrate Transformers.js with Whisper model
    - Capture audio via MediaDevices API
    - Process audio in worker
    - Insert transcription into input field
    - _Requirements: 8.1, 8.2, 8.3_

- [ ] 13.2 Implement TTS with Kokoro
    - Integrate Kokoro-82M model
    - Generate speech in worker
    - Play audio through browser audio system
    - _Requirements: 8.4, 8.5, 8.6_

- [ ] 13.3 Write property test for audio processing pipeline
  - **Property 15: Audio Processing Pipeline**
  - **Validates: Requirements 8.2, 8.3**

- [ ] 13.4 Write property test for TTS output generation
  - **Property 16: TTS Output Generation**
  - **Validates: Requirements 8.4, 8.6**

- [ ] 13.5 Write unit test for audio capture
  - Test MediaDevices API call on voice activation
  - _Requirements: 8.1_

- [ ] 14. Document Ingestion and RAG
  - [ ] 14.1 Implement RAGProcessor
    - Read text files via File API
    - Chunk documents with overlap
    - Store chunks in IndexedDB with full-text search
    - _Requirements: 9.1, 9.2, 9.6_

- [ ] 14.2 Implement retrieval and context injection
    - Retrieve relevant chunks for queries
    - Include chunks in prompt context
    - Add source citations to responses
    - _Requirements: 9.3, 9.4, 9.5_

- [ ] 14.3 Write property test for document chunking validity
  - **Property 17: Document Chunking Validity**
  - **Validates: Requirements 9.2**

- [ ] 14.4 Write property test for retrieval relevance
  - **Property 18: Retrieval Relevance**
  - **Validates: Requirements 9.3**

- [ ] 14.5 Write property test for context injection completeness
  - **Property 19: Context Injection Completeness**
  - **Validates: Requirements 9.4, 10.3, 11.2**

- [ ] 14.6 Write property test for source citation presence
  - **Property 20: Source Citation Presence**
  - **Validates: Requirements 9.5, 11.3**

- [ ] 14.7 Write unit test for file reading
  - Test File API usage for text files
  - _Requirements: 9.1_

- [ ] 15. Vision and Image Understanding
  - [ ] 15.1 Integrate Florence-2 vision model
    - Load Florence-2 via WebGPU
    - Process uploaded images
    - Generate captions and descriptions
    - _Requirements: 10.1, 10.2_

- [ ] 15.2 Implement image analysis UI
    - Image upload and thumbnail display
    - Bounding box visualization for detected objects
    - Include analysis in prompt context
    - _Requirements: 10.3, 10.4, 10.5_

- [ ] 15.3 Write property test for vision model output
  - **Property 21: Vision Model Output**
  - **Validates: Requirements 10.2**

- [ ] 15.4 Write property test for object detection visualization
  - **Property 22: Object Detection Visualization**
  - **Validates: Requirements 10.5**

- [ ] 15.5 Write unit test for vision model loading
  - Test model loading on image upload
  - _Requirements: 10.1_

- [ ] 16. Checkpoint - Multimodal Features Complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. Web Search Integration
  - [ ] 17.1 Implement search API integration
    - Add Brave Search API client
    - Implement conditional search based on toggle
    - Include search snippets in context
    - Add source URL citations
    - _Requirements: 11.1, 11.2, 11.3_

- [ ] 17.2 Create web search UI controls
    - Toggle to enable/disable search
    - Visual indicator when search is active
    - Display search results in UI
    - _Requirements: 11.4, 11.6_

- [ ] 17.3 Write property test for conditional search API calls
  - **Property 23: Conditional Search API Calls**
  - **Validates: Requirements 11.1, 11.5**

- [ ] 17.4 Write property test for search status indicator
  - **Property 24: Search Status Indicator**
  - **Validates: Requirements 11.6**

- [ ] 17.5 Write unit test for search toggle
  - Test toggle existence and state changes
  - _Requirements: 11.4_

- [ ] 18. Embeddability and Configuration
  - [ ] 18.1 Implement configuration API
    - Accept configuration from host pages
    - Apply theme and feature customization
    - Validate configuration objects
    - _Requirements: 5.5_

- [ ] 18.2 Ensure style isolation
    - Verify Shadow DOM prevents style leakage
    - Test on sample host pages
    - _Requirements: 5.3, 5.4_

- [ ] 18.3 Configure CORS headers for resources
    - Ensure all fetches include appropriate headers
    - _Requirements: 5.6_

- [ ] 18.4 Write property test for style isolation
  - **Property 9: Style Isolation**
  - **Validates: Requirements 5.3**

- [ ] 18.5 Write property test for configuration API validity
  - **Property 10: Configuration API Validity**
  - **Validates: Requirements 5.5**

- [ ] 18.6 Write property test for resource loading headers
  - **Property 11: Resource Loading Headers**
  - **Validates: Requirements 5.6**

- [ ] 18.7 Write unit test for Shadow DOM security
  - Test that shadowRoot is inaccessible from host
  - _Requirements: 5.4_

- [ ] 19. Data Management Features
  - [ ] 19.1 Implement clear data functionality
    - Clear all IndexedDB stores
    - Clear all OPFS files
    - Reset application state
    - _Requirements: 12.6_

- [ ] 19.2 Write property test for data clearing completeness
  - **Property 26: Data Clearing Completeness**
  - **Validates: Requirements 12.6**

- [ ] 19.3 Write property test for stream completion persistence
  - **Property 32: Stream Completion Persistence**
  - **Validates: Requirements 14.6**

- [ ] 20. Final Integration and Polish
  - [ ] 20.1 Wire all components together
    - Connect UI to all controllers
    - Ensure proper event flow
    - Add loading states and transitions
    - _Requirements: All_

- [ ] 20.2 Optimize bundle size
    - Tree-shake unused code
    - Lazy-load heavy models
    - Compress assets

- [ ] 20.3 Run full integration tests
    - Test end-to-end workflows
    - Test cross-component interactions

- [ ] 21. Final Checkpoint - Complete System
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at major milestones
- Property tests validate universal correctness properties across all inputs
- Unit tests validate specific examples, edge cases, and error conditions
- The implementation prioritizes core text chat first, then adds provider abstraction for cross-browser support, then multimodal capabilities incrementally
- **Browser Support**: Chrome uses built-in Gemini Nano, Brave/Firefox use WebLLM, other browsers can use API fallback
- **Provider Priority**: Chrome Provider → WebLLM Provider → API Provider
