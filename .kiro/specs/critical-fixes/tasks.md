# Implementation Plan: Critical Fixes

## Overview

This implementation plan addresses critical issues in priority order: hardware detection (affects all users), default settings (first-time experience), Whisper integration (voice input broken), image generation (feature non-functional), Gemini Nano (Chrome-specific), and logging (developer experience).

The implementation uses TypeScript with existing project patterns. All fixes maintain backward compatibility with existing settings and data.

## Tasks

- [x] 1. Fix Cross-Browser Hardware Detection
  - [x] 1.1 Update RAM detection to return null when unavailable
    - Modify `detectCapabilities()` to return `null` instead of defaulting to 4GB
    - Add `ramDetectionMethod` field to track how RAM was detected
    - Update `canSupport()` to treat `null` RAM as "unknown" not "insufficient"
    - _Requirements: 1.1_

  - [x] 1.2 Fix storage detection for Brave/Firefox
    - Handle restricted quota APIs that return 0 or negative values
    - Add `storageDetectionMethod` field to track detection approach
    - Ensure text-chat is never disabled due to storage issues
    - _Requirements: 1.2, 1.3_

  - [x] 1.3 Add browser detection to hardware diagnostics
    - Detect browser name (Chrome, Brave, Firefox, Edge, Safari)
    - Include browser name in all diagnostic logs
    - _Requirements: 1.4_

  - [x] 1.4 Add detailed logging for hardware checks
    - Log each hardware check with result, method, and browser
    - Log feature gate decisions during initialization
    - _Requirements: 1.4, 1.5, 5.5_

  - [x] 1.5 Write property test for hardware graceful degradation
    - **Property 1: Hardware Detection Graceful Degradation**
    - **Validates: Requirements 1.1, 1.3**

  - [x] 1.6 Write property test for storage non-blocking
    - **Property 2: Storage Detection Non-Blocking**
    - **Validates: Requirements 1.2, 1.3**

- [x] 2. Checkpoint - Hardware Detection Complete
  - Ensure all tests pass, ask the user if questions arise.

- [-] 3. Fix Default Feature Settings
  - [x] 3.1 Update default settings calculation
    - Enable text chat by default (always)
    - Enable image generation by default when hardware supports it
    - Enable vision by default when hardware supports it
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 3.2 Implement settings persistence
    - Save all settings to IndexedDB on change
    - Restore settings on page load
    - Handle migration from old settings format
    - _Requirements: 6.4, 6.5_

  - [x] 3.3 Add hardware-based defaults calculator
    - Calculate defaults based on hardware profile
    - Only apply defaults on first run (respect user changes)
    - Store hardware profile hash to detect changes
    - _Requirements: 6.2, 6.3, 6.6_

  - [x] 3.4 Write property test for settings round-trip
    - **Property 7: Settings Persistence Round-Trip**
    - **Validates: Requirements 6.4**

  - [x] 3.5 Write property test for hardware-based defaults
    - **Property 8: Hardware-Based Default Enablement**
    - **Validates: Requirements 6.2, 6.3**

- [x] 4. Checkpoint - Default Settings Complete
  - Ensure all tests pass, ask the user if questions arise.

- [-] 5. Implement Whisper ASR Integration
  - [ ] 5.1 Add @xenova/transformers dependency
    - Install transformers.js package
    - Configure for WebGPU acceleration
    - _Requirements: 2.1_

  - [ ] 5.2 Create WhisperPipeline class
    - Initialize Whisper model from Hugging Face
    - Implement model caching in IndexedDB
    - Add progress reporting during download
    - _Requirements: 2.1, 2.2, 2.4_

  - [ ] 5.3 Update SpeechWorker to use WhisperPipeline
    - Replace placeholder `executeASR()` with actual Whisper inference
    - Convert audio format to Float32Array for Whisper
    - Return actual transcription text
    - _Requirements: 2.1, 2.3_

  - [ ] 5.4 Update VoiceInputUI error handling
    - Disable voice button on initialization failure
    - Show clear error messages for failures
    - _Requirements: 2.5_

  - [ ] 5.5 Write property test for Whisper output
    - **Property 3: Whisper Transcription Output**
    - **Validates: Requirements 2.1, 2.3**

- [ ] 6. Checkpoint - Whisper Integration Complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Fix Image Generation
  - [ ] 7.1 Create ImageIntentDetector
    - Implement pattern matching for image generation phrases
    - Return confidence score and matched pattern
    - _Requirements: 3.3_

  - [ ] 7.2 Integrate intent detection into message handling
    - Check for image generation intent before sending to LLM
    - Route to image generation worker when intent detected
    - _Requirements: 3.2, 3.3_

  - [ ] 7.3 Add image generation decision logging
    - Log format: "🎨 Image generation check: {shouldGenerate, isEnabled, prompt}"
    - Log warning when would trigger but disabled
    - _Requirements: 3.4, 3.5, 5.1_

  - [ ] 7.4 Write property test for intent detection
    - **Property 4: Image Generation Intent Detection**
    - **Validates: Requirements 3.3**

- [ ] 8. Checkpoint - Image Generation Complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Fix Gemini Nano Availability
  - [ ] 9.1 Enhance browser detection in GeminiController
    - Detect Chrome vs Brave vs Edge accurately
    - Check Chrome version correctly
    - _Requirements: 4.2_

  - [ ] 9.2 Implement detailed availability diagnostics
    - Check window.ai existence
    - Check languageModel API availability
    - Check capabilities() callable
    - Return specific failure reason
    - _Requirements: 4.1, 4.4_

  - [ ] 9.3 Add specific instructions for each failure mode
    - Instructions for enabling Chrome flags
    - Instructions for downloading model
    - Link to chrome://on-device-internals
    - _Requirements: 4.3_

  - [ ] 9.4 Implement automatic fallback to WebLLM
    - Detect Gemini Nano unavailable
    - Auto-select WebLLM provider
    - Log fallback decision
    - _Requirements: 4.5_

  - [ ] 9.5 Write property test for state differentiation
    - **Property 5: Gemini Nano State Differentiation**
    - **Validates: Requirements 4.4**

- [ ] 10. Checkpoint - Gemini Nano Complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Add Multimodal Decision Logging
  - [ ] 11.1 Create MultimodalLogger utility
    - Implement logImageGenerationCheck()
    - Implement logVisionCheck()
    - Implement logSpeechCheck()
    - Implement logFeatureGate()
    - Implement logDisabledWarning()
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 11.2 Integrate logging into component lifecycle
    - Add logging to message handling flow
    - Add logging to feature initialization
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 11.3 Write property test for logging format
    - **Property 6: Multimodal Decision Logging Format**
    - **Validates: Requirements 5.1, 5.2, 5.3**

- [ ] 12. Final Checkpoint - All Critical Fixes Complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at major milestones
- Property tests validate universal correctness properties across all inputs
- Unit tests validate specific examples, edge cases, and error conditions
- Priority order: Hardware → Settings → Whisper → Image Gen → Gemini → Logging
- All fixes maintain backward compatibility with existing user data
