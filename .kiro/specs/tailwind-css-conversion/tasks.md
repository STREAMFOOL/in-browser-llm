# Implementation Plan: Tailwind CSS Conversion

## Overview

This implementation plan converts all CSS in the Local AI Assistant project to Tailwind CSS utility classes loaded from CDN. The conversion follows a component-by-component approach, ensuring the application remains functional throughout the migration.

## Tasks

- [x] 1. Set up Tailwind CDN and remove global styles
  - [x] 1.1 Add Tailwind CDN script to index.html
    - Add `<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>` to head
    - _Requirements: 1.1_
  - [x] 1.2 Convert index.html inline styles to Tailwind classes
    - Replace body styles with `class="m-0 p-5 font-sans bg-gray-100"`
    - Replace demo-container with `class="max-w-3xl mx-auto"`
    - Replace h1 styles with `class="text-center text-gray-800"`
    - Replace local-ai-assistant styles with `class="h-[600px] block"`
    - Remove the `<style>` block entirely
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [x] 1.3 Remove style.css import from main.ts
    - Delete the `import './style.css'` line
    - _Requirements: 2.2_
  - [x] 1.4 Delete src/style.css file
    - Remove the file from the project
    - _Requirements: 2.1_

- [ ] 2. Convert ChatUI component styles
  - [ ] 2.1 Convert message-list element to Tailwind
    - Replace CSS with `class="flex-1 overflow-y-auto p-4 flex flex-col gap-4 scroll-smooth"`
    - _Requirements: 3.3_
  - [ ] 2.2 Convert message elements to Tailwind
    - Replace CSS with `class="flex gap-3 animate-fadeIn"` (fadeIn defined in Shadow DOM)
    - _Requirements: 3.4_
  - [ ] 2.3 Convert message-avatar elements to Tailwind
    - Base: `class="w-9 h-9 rounded-full flex items-center justify-center text-xl flex-shrink-0 bg-gray-100"`
    - User variant: add `bg-blue-100`
    - Assistant variant: add `bg-purple-100`
    - _Requirements: 3.5_
  - [ ] 2.4 Convert message-content elements to Tailwind
    - Base: `class="p-3 px-4 rounded-xl bg-gray-50 text-gray-900 leading-normal break-words whitespace-pre-wrap"`
    - User variant: `class="bg-blue-500 text-white"`
    - Assistant variant: `class="bg-gray-100 text-gray-900 whitespace-normal"`
    - _Requirements: 3.6_
  - [ ] 2.5 Convert input-container to Tailwind
    - Replace CSS with `class="flex gap-2 p-4 border-t border-gray-200 bg-white"`
    - _Requirements: 3.7_
  - [ ] 2.6 Convert message-input textarea to Tailwind
    - Replace CSS with `class="flex-1 p-3 px-4 border border-gray-300 rounded-lg font-sans text-sm resize-none outline-none transition-colors min-h-[44px] max-h-[150px] focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/10"`
    - _Requirements: 3.8, 10.2_
  - [ ] 2.7 Convert send-button to Tailwind
    - Replace CSS with `class="py-3 px-6 bg-blue-500 text-white border-none rounded-lg font-semibold cursor-pointer transition-colors whitespace-nowrap hover:bg-blue-600 active:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-2 focus:outline-blue-500"`
    - _Requirements: 3.9, 10.3_
  - [ ] 2.8 Convert loading-indicator to Tailwind
    - Replace CSS with `class="flex items-center gap-2 p-3 px-4 mx-4 bg-gray-100 rounded-lg text-sm text-gray-500"`
    - Hidden state: add `hidden` class
    - Spinner: `class="w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin"`
    - _Requirements: 3.10, 7.3_
  - [ ] 2.9 Remove getStyles() method from ChatUI class
    - Delete the static getStyles() method entirely
    - _Requirements: 3.1, 3.2_
  - [ ]* 2.10 Write property test for ChatUI Tailwind classes
    - **Property 1: ChatUI Elements Have Tailwind Classes**
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10**

- [ ] 3. Convert MarkdownRenderer component styles
  - [ ] 3.1 Update header rendering to include Tailwind classes
    - h1: `class="my-4 mb-2 font-semibold leading-tight text-3xl"`
    - h2: `class="my-4 mb-2 font-semibold leading-tight text-2xl"`
    - h3: `class="my-4 mb-2 font-semibold leading-tight text-xl"`
    - h4: `class="my-4 mb-2 font-semibold leading-tight text-lg"`
    - h5: `class="my-4 mb-2 font-semibold leading-tight text-base"`
    - h6: `class="my-4 mb-2 font-semibold leading-tight text-sm"`
    - _Requirements: 4.3_
  - [ ] 3.2 Update code block rendering to include Tailwind classes
    - pre: `class="bg-gray-900 text-gray-300 p-4 rounded-lg overflow-x-auto my-3"`
    - pre.incomplete: add `border-b-2 border-dashed border-blue-500 relative`
    - code inside pre: `class="bg-transparent p-0"`
    - _Requirements: 4.4, 4.8_
  - [ ] 3.3 Update inline code rendering to include Tailwind classes
    - code: `class="bg-black/5 py-0.5 px-1.5 rounded font-mono text-sm"`
    - _Requirements: 4.5_
  - [ ] 3.4 Update list rendering to include Tailwind classes
    - ul/ol: `class="my-2 pl-6"`
    - li: `class="my-1"`
    - _Requirements: 4.6_
  - [ ] 3.5 Update link rendering to include Tailwind classes
    - a: `class="text-blue-500 underline hover:text-blue-600"`
    - _Requirements: 4.7_
  - [ ] 3.6 Update paragraph rendering to include Tailwind classes
    - p: `class="my-2"`
    - _Requirements: 4.2_
  - [ ] 3.7 Update bold/italic/blockquote rendering
    - strong: `class="font-semibold"`
    - em: `class="italic"`
    - blockquote: `class="border-l-4 border-gray-200 pl-4 my-3 text-gray-500"`
    - _Requirements: 4.2_
  - [ ] 3.8 Remove getStyles() method from MarkdownRenderer class
    - Delete the static getStyles() method entirely
    - _Requirements: 4.1_
  - [ ]* 3.9 Write property test for Markdown rendering Tailwind classes
    - **Property 2: Markdown Renderer Output Contains Tailwind Classes**
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8**

- [ ] 4. Convert LocalAIAssistant component styles
  - [ ] 4.1 Create minimal Shadow DOM style for custom animations
    - Keep only @keyframes fadeIn and blink animations
    - Define .animate-fadeIn and .animate-blink classes
    - Remove all other CSS from the style element
    - _Requirements: 5.1, 7.1, 7.4_
  - [ ] 4.2 Convert ai-assistant-container to Tailwind
    - Replace CSS with `class="flex flex-col w-full h-full bg-white border border-gray-200 rounded-lg overflow-hidden"`
    - _Requirements: 5.2_
  - [ ] 4.3 Convert ai-assistant-header to Tailwind
    - Replace CSS with `class="p-4 bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-b border-gray-200 font-semibold flex items-center gap-3"`
    - _Requirements: 5.3, 8.3_
  - [ ] 4.4 Convert status-indicator to Tailwind
    - Replace CSS with `class="w-2 h-2 rounded-full bg-green-400 animate-pulse"`
    - _Requirements: 5.4, 7.2_
  - [ ] 4.5 Convert ai-assistant-content to Tailwind
    - Replace CSS with `class="flex-1 flex flex-col overflow-hidden"`
    - _Requirements: 5.5_
  - [ ] 4.6 Convert ai-assistant-footer to Tailwind
    - Replace CSS with `class="py-3 px-4 border-t border-gray-200 bg-gray-50 flex items-center gap-2 text-xs text-gray-500"`
    - _Requirements: 5.6_
  - [ ] 4.7 Remove ChatUI.getStyles() call from LocalAIAssistant
    - Update the style element to not include ChatUI.getStyles()
    - _Requirements: 5.1_
  - [ ]* 4.8 Write property test for LocalAIAssistant Tailwind classes
    - **Property 3: LocalAIAssistant Container Elements Have Tailwind Classes**
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6**

- [ ] 5. Checkpoint - Verify core conversion
  - Ensure all tests pass, ask the user if questions arise.
  - Verify the application renders correctly with Tailwind classes
  - Check that animations work (pulse, spin, fadeIn)

- [ ]* 6. Write additional property tests
  - [ ]* 6.1 Write property test for animation classes
    - **Property 4: Animated Elements Have Animation Classes**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**
  - [ ]* 6.2 Write property test for color classes
    - **Property 5: Colored Elements Use Tailwind Color Classes**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**
  - [ ]* 6.3 Write property test for focus utilities
    - **Property 6: Interactive Elements Have Focus Utilities**
    - **Validates: Requirements 10.1, 10.2, 10.3**

- [ ] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Verify visual appearance matches original design
  - Confirm accessibility features are preserved

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- The conversion maintains backward compatibility throughout the process
