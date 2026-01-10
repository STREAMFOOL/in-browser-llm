# Implementation Plan: UI Notification System

## Overview

This plan implements a toast-style notification system with persistent logging and storage quota management. The implementation follows a bottom-up approach: core types first, then rendering, then management, then integration.

## Tasks

- [ ] 1. Create notification types and interfaces
  - Create `src/ui/notification-types.ts` with all TypeScript interfaces
  - Define NotificationType, NotificationOptions, Notification, StorageInfo
  - Define LoggedNotification for persistence
  - Export all types for use across modules
  - _Requirements: 7.2_

- [ ] 2. Implement Toast Renderer
  - [ ] 2.1 Create toast container and base rendering
    - Create `src/ui/toast-renderer.ts`
    - Implement createContainer() for Shadow DOM
    - Implement createToast() with Tailwind classes
    - Implement type-specific styling (error/warning/info colors)
    - Implement type-specific icons (SVG)
    - _Requirements: 1.1, 1.5, 1.6_

  - [ ] 2.2 Implement toast animations and positioning
    - Add slideInRight and slideOutRight CSS animations to component styles
    - Implement render() with entry animation
    - Implement animateOut() with exit animation
    - Implement updatePosition() for stacking
    - Implement remove() for DOM cleanup
    - _Requirements: 1.2, 1.3, 1.4, 2.5_

  - [ ] 2.3 Implement storage info rendering
    - Implement renderStorageInfo() with GB formatting
    - Implement renderBreakdown() for detailed storage view
    - Implement renderAction() for action buttons
    - Implement renderMarkdown() for message formatting
    - _Requirements: 3.1, 3.3, 3.4, 5.4_

  - [ ]* 2.4 Write property test for notification type styling
    - **Property 1: Notification Type Styling Consistency**
    - **Validates: Requirements 1.5, 1.6**

- [ ] 3. Implement Notification Logger
  - [ ] 3.1 Create IndexedDB store for notification log
    - Create `src/ui/notification-logger.ts`
    - Add 'notificationLog' store to IndexedDB schema
    - Implement getDB() with store creation
    - Implement log() to persist notifications
    - _Requirements: 4.1, 4.2_

  - [ ] 3.2 Implement log retrieval and filtering
    - Implement getAll() to retrieve all logged notifications
    - Implement getByType() for type filtering
    - Implement clear() to remove all entries
    - _Requirements: 4.4, 4.5, 4.6_

  - [ ] 3.3 Implement log size limit enforcement
    - Implement enforceLimit() to cap at 100 entries
    - Remove oldest entries when limit exceeded
    - _Requirements: 4.7_

  - [ ]* 3.4 Write property tests for notification logger
    - **Property 4: Notification Log Round-Trip**
    - **Property 5: Notification Log Filtering**
    - **Property 6: Notification Log Size Limit**
    - **Validates: Requirements 4.1, 4.4, 4.5, 4.7**

- [ ] 4. Implement Notification Manager
  - [ ] 4.1 Create notification manager core
    - Create `src/ui/notification-manager.ts`
    - Implement show() to display notifications
    - Implement dismiss() to remove notifications
    - Implement dismissAll() to clear all active
    - Implement createNotification() to generate IDs
    - _Requirements: 1.1, 2.4_

  - [ ] 4.2 Implement timer management
    - Implement startTimer() for auto-dismiss
    - Implement pauseTimer() for hover pause
    - Implement resumeTimer() for hover resume
    - Wire up mouseenter/mouseleave events
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 4.3 Implement deduplication
    - Track recent notifications with timestamps
    - Implement isDuplicate() to check 5-second window
    - Skip duplicate notifications
    - _Requirements: 7.4_

  - [ ] 4.4 Implement queueing
    - Implement queue for excess notifications (>5 active)
    - Implement processQueue() on dismiss
    - Implement restack() to update positions
    - _Requirements: 7.5, 7.6_

  - [ ]* 4.5 Write property tests for notification manager
    - **Property 2: Notification Stacking Order**
    - **Property 7: Notification Deduplication**
    - **Property 8: Notification Queue Processing**
    - **Validates: Requirements 1.2, 7.4, 7.5, 7.6**

- [ ] 5. Implement Global Notification API
  - [ ] 5.1 Create global notify function
    - Create `src/ui/notification-api.ts`
    - Implement notify() as global entry point
    - Implement dismissNotification() helper
    - Implement clearAllNotifications() helper
    - Validate required parameters
    - _Requirements: 7.1, 7.2_

  - [ ] 5.2 Initialize notification system in component
    - Update `src/component/index.ts` to initialize NotificationManager
    - Pass Shadow DOM root to ToastRenderer
    - Export notify function for global access
    - _Requirements: 7.1_

  - [ ]* 5.3 Write property test for API parameter acceptance
    - **Property 9: API Parameter Acceptance**
    - **Validates: Requirements 7.2**

- [ ] 6. Checkpoint - Core notification system
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement Storage Quota Manager
  - [ ] 7.1 Create storage quota monitoring
    - Create `src/storage/storage-quota-manager.ts`
    - Implement checkQuota() using navigator.storage.estimate()
    - Implement getStorageBreakdown() for detailed usage
    - Calculate percentage used and thresholds
    - _Requirements: 5.1_

  - [ ] 7.2 Implement quota warning notifications
    - Implement showWarning() at 80% threshold
    - Include storage amounts in GB
    - Include action button to manage storage
    - _Requirements: 5.1, 5.4, 5.5_

  - [ ] 7.3 Implement quota request flow
    - Implement requestMoreStorage() using persist() API
    - Implement handleExceeded() for quota exceeded
    - Show success notification on grant
    - Show error notification with alternatives on denial
    - _Requirements: 5.2, 5.3, 5.6, 5.7, 6.1_

  - [ ] 7.4 Implement fallback for unsupported browsers
    - Detect when persist() API unavailable
    - Show custom dialog explaining storage need
    - Provide alternative suggestions
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6_

- [ ] 8. Implement Notification Log UI in Settings
  - [ ] 8.1 Create notification log section
    - Update `src/ui/settings-ui-sections.ts`
    - Add "Notification Log" section to settings
    - Display notifications with timestamps
    - Format timestamps as relative time
    - _Requirements: 4.3, 4.4_

  - [ ] 8.2 Implement log filtering UI
    - Add filter dropdown for notification types
    - Implement filter change handler
    - Update display on filter change
    - _Requirements: 4.5_

  - [ ] 8.3 Implement log clearing UI
    - Add "Clear Log" button
    - Confirm before clearing
    - Update display after clearing
    - _Requirements: 4.6_

- [ ] 9. Integrate notifications across components
  - [ ] 9.1 Update error handling in storage manager
    - Update `src/storage/storage-manager.ts`
    - Replace console.error with notify() calls
    - Add storage quota checks before operations
    - _Requirements: 7.3_

  - [ ] 9.2 Update error handling in providers
    - Update provider files to use notify()
    - Show appropriate error notifications
    - Include troubleshooting suggestions
    - _Requirements: 3.2, 7.3_

  - [ ] 9.3 Update error handling in chat UI
    - Update `src/ui/chat-ui.ts` to use notify()
    - Show notifications for send failures
    - Show notifications for streaming errors
    - _Requirements: 7.3_

- [ ] 10. Checkpoint - Full integration
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 11. Write property test for content rendering
  - **Property 3: Notification Content Rendering**
  - **Validates: Requirements 3.1, 3.3, 3.4**

- [ ] 12. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.
  - Verify notifications appear correctly in Firefox
  - Verify storage quota requests work as expected
  - Verify notification log is accessible from settings

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The notification container must be inside Shadow DOM for style isolation
- Tailwind classes are used for all styling per project standards
