# Requirements Document

## Introduction

This document specifies critical fixes and improvements for the Local AI Assistant. The issues include cross-browser hardware detection inconsistencies, incomplete Whisper ASR integration, non-functional image generation, Gemini Nano availability issues, and insufficient logging for multimodal feature decisions. These fixes are essential for a functional user experience across different browsers.

## Glossary

- **Local_AI_Assistant**: The complete browser-based application system
- **Hardware_Diagnostics**: Module responsible for detecting RAM, storage, CPU, and GPU capabilities
- **Whisper**: OpenAI's automatic speech recognition model for speech-to-text
- **Transformers_JS**: JavaScript library for running ML models in the browser
- **Gemini_Nano**: Chrome's built-in AI model accessible via the Prompt API
- **Feature_Gate**: System that enables/disables features based on hardware capabilities
- **Storage_API**: Browser API for estimating available storage quota
- **WebGPU**: Modern browser API for GPU-accelerated computation

## Requirements

### Requirement 1: Cross-Browser Hardware Detection

**User Story:** As a user on any WebGPU-capable browser, I want accurate hardware detection, so that features are correctly enabled based on my actual system capabilities.

#### Acceptance Criteria

1. WHEN detecting RAM on browsers without navigator.deviceMemory, THE Hardware_Diagnostics SHALL use alternative detection methods or display "Unknown" instead of defaulting to 4GB
2. WHEN detecting storage quota on Brave or Firefox, THE Hardware_Diagnostics SHALL handle restricted quota APIs gracefully and not report 0GB when storage is available
3. WHEN storage quota returns 0 or negative values, THE Hardware_Diagnostics SHALL not disable features that don't require storage
4. THE Hardware_Diagnostics SHALL log detailed diagnostic information for each hardware check including browser name and detection method used
5. WHEN hardware detection fails, THE Hardware_Diagnostics SHALL display a clear message indicating which specific check failed and why

### Requirement 2: Whisper ASR Integration

**User Story:** As a user, I want voice input to actually transcribe my speech, so that I can interact with the assistant hands-free.

#### Acceptance Criteria

1. WHEN audio is captured, THE Local_AI_Assistant SHALL process it using Whisper via Transformers.js
2. WHEN initializing the ASR worker, THE Local_AI_Assistant SHALL download and cache the Whisper model weights
3. WHEN transcription completes, THE Local_AI_Assistant SHALL return the actual transcribed text instead of placeholder text
4. WHEN Whisper model is loading, THE Local_AI_Assistant SHALL display download progress to the user
5. IF Whisper initialization fails, THEN THE Local_AI_Assistant SHALL display a clear error message and disable the voice input button

### Requirement 3: Image Generation Functionality

**User Story:** As a user, I want image generation to actually produce images, so that I can create visual content locally.

#### Acceptance Criteria

1. THE Local_AI_Assistant SHALL enable image generation by default when hardware requirements are met
2. WHEN a user requests image generation, THE Local_AI_Assistant SHALL invoke the image generation worker instead of responding with text
3. THE Local_AI_Assistant SHALL detect image generation intent from user prompts (e.g., "generate an image of", "draw", "create a picture")
4. WHEN image generation is triggered, THE Local_AI_Assistant SHALL log the decision similar to web search logging
5. IF image generation is disabled in settings but would trigger, THEN THE Local_AI_Assistant SHALL log a warning message

### Requirement 4: Gemini Nano Availability

**User Story:** As a Chrome user, I want Gemini Nano to work when my browser supports it, so that I can use the fastest local inference option.

#### Acceptance Criteria

1. WHEN checking Gemini Nano availability, THE Local_AI_Assistant SHALL provide detailed diagnostic information about why it's unavailable
2. THE Local_AI_Assistant SHALL check for Chrome version 127+ correctly across all Chrome-based browsers
3. WHEN the Prompt API is not available, THE Local_AI_Assistant SHALL display specific instructions for enabling required Chrome flags
4. THE Local_AI_Assistant SHALL distinguish between "API not available", "flags not enabled", and "model not downloaded" states
5. WHEN Gemini Nano is unavailable, THE Local_AI_Assistant SHALL automatically fall back to WebLLM provider without user intervention

### Requirement 5: Multimodal Decision Logging

**User Story:** As a developer, I want clear logging of multimodal feature decisions, so that I can debug why features trigger or don't trigger.

#### Acceptance Criteria

1. WHEN evaluating whether to generate an image, THE Local_AI_Assistant SHALL log the decision with format: "🎨 Image generation check: {shouldGenerate, isEnabled, prompt}"
2. WHEN evaluating whether to use vision analysis, THE Local_AI_Assistant SHALL log the decision with format: "👁️ Vision check: {shouldAnalyze, isEnabled, hasImage}"
3. WHEN evaluating whether to use speech features, THE Local_AI_Assistant SHALL log the decision with format: "🎤 Speech check: {isRecording, isEnabled}"
4. WHEN a multimodal feature would trigger but is disabled, THE Local_AI_Assistant SHALL log a warning message indicating the feature is disabled in settings
5. THE Local_AI_Assistant SHALL log all feature gate decisions during initialization

### Requirement 6: Default Feature Settings

**User Story:** As a user, I want multimodal features enabled by default when my hardware supports them, so that I can use the full capabilities without manual configuration.

#### Acceptance Criteria

1. THE Local_AI_Assistant SHALL enable text chat by default
2. WHEN hardware meets image generation requirements, THE Local_AI_Assistant SHALL enable image generation by default
3. WHEN hardware meets vision requirements, THE Local_AI_Assistant SHALL enable image understanding by default
4. THE Local_AI_Assistant SHALL persist all user settings to IndexedDB and restore them on page reload
5. THE Local_AI_Assistant SHALL persist user preference changes to override defaults
6. WHEN hardware requirements are not met, THE Local_AI_Assistant SHALL disable the feature and display the reason
