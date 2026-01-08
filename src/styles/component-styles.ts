export function getComponentStyles() {
  return `
      /* Header styles */
      .ai-assistant-header {
        padding: 1rem;
        background: linear-gradient(to bottom right, #6366f1, #9333ea);
        color: white;
        border-bottom: 1px solid #e5e7eb;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .status-indicator {
        width: 0.5rem;
        height: 0.5rem;
        border-radius: 9999px;
        background-color: #86efac;
        animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      }

      .provider-indicator {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.75rem;
        font-weight: 500;
        padding: 0.375rem 0.75rem;
        border-radius: 0.375rem;
        background-color: rgba(255, 255, 255, 0.2);
      }

      .provider-indicator.local {
        background-color: rgba(134, 239, 172, 0.3);
      }

      .provider-indicator.api {
        background-color: rgba(251, 191, 36, 0.3);
      }

      .provider-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
      }

      .privacy-warning {
        font-size: 0.875rem;
        color: #fbbf24;
      }

      .settings-button {
        background: none;
        border: none;
        color: white;
        font-size: 1.25rem;
        cursor: pointer;
        padding: 0.5rem;
        border-radius: 0.375rem;
        transition: background-color 0.15s;
      }

      .settings-button:hover {
        background-color: rgba(255, 255, 255, 0.2);
      }

      .settings-button:focus {
        outline: 2px solid white;
        outline-offset: 2px;
      }

      /* Settings panel */
      .settings-panel {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: white;
        z-index: 1000;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .settings-panel.hidden {
        display: none;
      }

      .settings-header {
        padding: 1rem;
        background: linear-gradient(to bottom right, #6366f1, #9333ea);
        color: white;
        border-bottom: 1px solid #e5e7eb;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .settings-close {
        background: none;
        border: none;
        color: white;
        font-size: 1.5rem;
        cursor: pointer;
        padding: 0.25rem 0.5rem;
        border-radius: 0.375rem;
        transition: background-color 0.15s;
      }

      .settings-close:hover {
        background-color: rgba(255, 255, 255, 0.2);
      }

      .settings-content {
        flex: 1;
        overflow-y: auto;
        padding: 1.5rem;
      }

      .settings-section {
        margin-bottom: 2rem;
      }

      .settings-section-title {
        font-size: 1.125rem;
        font-weight: 600;
        margin-bottom: 1rem;
        color: #111827;
      }

      .provider-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .provider-item {
        padding: 1rem;
        border: 2px solid #e5e7eb;
        border-radius: 0.5rem;
        cursor: pointer;
        transition: all 0.15s;
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .provider-item:hover {
        border-color: #6366f1;
        background-color: #f9fafb;
      }

      .provider-item.active {
        border-color: #6366f1;
        background-color: #eff6ff;
      }

      .provider-item.unavailable {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .provider-item.unavailable:hover {
        border-color: #e5e7eb;
        background-color: white;
      }

      .provider-icon {
        font-size: 1.5rem;
        flex-shrink: 0;
      }

      .provider-details {
        flex: 1;
      }

      .provider-name {
        font-weight: 600;
        color: #111827;
        margin-bottom: 0.25rem;
      }

      .provider-description {
        font-size: 0.875rem;
        color: #6b7280;
      }

      .provider-status {
        font-size: 0.75rem;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        font-weight: 500;
      }

      .provider-status.available {
        background-color: #d1fae5;
        color: #065f46;
      }

      .provider-status.unavailable {
        background-color: #fee2e2;
        color: #991b1b;
      }

      .provider-status.active {
        background-color: #dbeafe;
        color: #1e40af;
      }

      /* Model selection styles */
      .model-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        margin-top: 1rem;
      }

      .model-card {
        padding: 1rem;
        border: 2px solid #e5e7eb;
        border-radius: 0.5rem;
        transition: all 0.15s;
        background-color: white;
      }

      .model-card:hover:not(.active) {
        border-color: #6366f1;
        background-color: #f9fafb;
      }

      .model-card.active {
        border-color: #6366f1;
        background-color: #eff6ff;
      }

      .model-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
      }

      .model-name {
        font-weight: 600;
        color: #111827;
        font-size: 1rem;
      }

      .model-badge {
        font-size: 0.75rem;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        font-weight: 500;
        background-color: #dbeafe;
        color: #1e40af;
      }

      .model-card:not(.active) .model-badge {
        background-color: #f3f4f6;
        color: #6b7280;
      }

      .model-description {
        font-size: 0.875rem;
        color: #6b7280;
        margin-bottom: 0.5rem;
        line-height: 1.4;
      }

      .model-specs {
        display: flex;
        gap: 1rem;
        font-size: 0.75rem;
        color: #9ca3af;
      }

      .model-spec {
        display: flex;
        align-items: center;
        gap: 0.25rem;
      }

      /* Reset button styles */
      .reset-button {
        width: 100%;
        padding: 0.75rem 1rem;
        background-color: #ef4444;
        color: white;
        border: none;
        border-radius: 0.5rem;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.15s;
        margin-top: 0.75rem;
      }

      .reset-button:hover {
        background-color: #dc2626;
      }

      .reset-button:active {
        background-color: #b91c1c;
      }

      .reset-description {
        font-size: 0.875rem;
        color: #6b7280;
        line-height: 1.5;
      }

      /* Hardware diagnostics styles */
      .hardware-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 0.75rem;
        margin-bottom: 1rem;
      }

      .hardware-card {
        padding: 1rem;
        border: 2px solid #e5e7eb;
        border-radius: 0.5rem;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        position: relative;
      }

      .hardware-card.good {
        border-color: #10b981;
        background-color: #f0fdf4;
      }

      .hardware-card.warning {
        border-color: #f59e0b;
        background-color: #fffbeb;
      }

      .hardware-card.poor {
        border-color: #ef4444;
        background-color: #fef2f2;
      }

      .hardware-icon {
        font-size: 1.5rem;
        flex-shrink: 0;
      }

      .hardware-details {
        flex: 1;
        min-width: 0;
      }

      .hardware-label {
        font-size: 0.75rem;
        color: #6b7280;
        font-weight: 500;
        margin-bottom: 0.25rem;
      }

      .hardware-value {
        font-size: 1rem;
        font-weight: 600;
        color: #111827;
      }

      .hardware-indicator {
        font-size: 1.25rem;
        flex-shrink: 0;
      }

      .hardware-indicator.good {
        color: #10b981;
      }

      .hardware-indicator.warning {
        color: #f59e0b;
      }

      .hardware-indicator.poor {
        color: #ef4444;
      }

      .performance-info {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1rem;
        background-color: #f3f4f6;
        border-radius: 0.5rem;
        font-size: 0.875rem;
      }

      .perf-label {
        color: #6b7280;
        font-weight: 500;
      }

      .perf-score {
        color: #111827;
        font-weight: 600;
      }

      /* Slider control styles */
      .slider-control {
        margin-bottom: 1.5rem;
      }

      .slider-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
      }

      .slider-label {
        font-weight: 600;
        color: #111827;
        font-size: 0.875rem;
      }

      .slider-value {
        font-weight: 600;
        color: #3b82f6;
        font-size: 0.875rem;
      }

      .slider {
        width: 100%;
        height: 6px;
        border-radius: 3px;
        background: #e5e7eb;
        outline: none;
        -webkit-appearance: none;
        appearance: none;
      }

      .slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #3b82f6;
        cursor: pointer;
        transition: background-color 0.15s;
      }

      .slider::-webkit-slider-thumb:hover {
        background: #2563eb;
      }

      .slider::-moz-range-thumb {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #3b82f6;
        cursor: pointer;
        border: none;
        transition: background-color 0.15s;
      }

      .slider::-moz-range-thumb:hover {
        background: #2563eb;
      }

      .slider-description {
        font-size: 0.75rem;
        color: #6b7280;
        margin-top: 0.5rem;
        line-height: 1.4;
      }

      /* Feature toggle styles */
      .feature-toggle {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        margin-bottom: 0.75rem;
        transition: background-color 0.15s;
      }

      .feature-toggle:hover {
        background-color: #f9fafb;
      }

      .feature-toggle.disabled {
        opacity: 0.6;
        background-color: #f9fafb;
      }

      .feature-details {
        flex: 1;
      }

      .feature-label {
        font-weight: 600;
        color: #111827;
        margin-bottom: 0.25rem;
      }

      .feature-description {
        font-size: 0.75rem;
        color: #6b7280;
        line-height: 1.4;
      }

      .feature-warning {
        color: #f59e0b;
        font-weight: 500;
        margin-top: 0.25rem;
      }

      /* Toggle switch styles */
      .switch {
        position: relative;
        display: inline-block;
        width: 48px;
        height: 24px;
        flex-shrink: 0;
      }

      .switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }

      .switch-slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #d1d5db;
        transition: 0.3s;
        border-radius: 24px;
      }

      .switch-slider:before {
        position: absolute;
        content: "";
        height: 18px;
        width: 18px;
        left: 3px;
        bottom: 3px;
        background-color: white;
        transition: 0.3s;
        border-radius: 50%;
      }

      .switch input:checked + .switch-slider {
        background-color: #3b82f6;
      }

      .switch input:checked + .switch-slider:before {
        transform: translateX(24px);
      }

      .switch input:disabled + .switch-slider {
        cursor: not-allowed;
        opacity: 0.5;
      }

      /* Action button styles */
      .action-button {
        width: 100%;
        padding: 0.75rem 1rem;
        border: none;
        border-radius: 0.5rem;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.15s;
        margin-top: 0.75rem;
        font-size: 0.875rem;
      }

      .action-button.secondary {
        background-color: #6b7280;
        color: white;
      }

      .action-button.secondary:hover {
        background-color: #4b5563;
      }

      .action-button.danger {
        background-color: #ef4444;
        color: white;
      }

      .action-button.danger:hover {
        background-color: #dc2626;
      }

      .action-button.danger:active {
        background-color: #b91c1c;
      }

      .action-description {
        font-size: 0.875rem;
        color: #6b7280;
        line-height: 1.5;
        margin-top: 0.5rem;
      }

      /* ChatUI styles - comprehensive CSS for all chat elements */
      .message-list {
        flex: 1;
        overflow-y: auto;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        scroll-behavior: smooth;
        min-height: 0;
      }

      .message {
        display: flex;
        gap: 0.75rem;
        animation: fadeIn 0.3s ease-in;
      }

      .message-avatar {
        width: 2.25rem;
        height: 2.25rem;
        border-radius: 9999px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.25rem;
        flex-shrink: 0;
      }

      .message-avatar.user {
        background-color: #dbeafe;
      }

      .message-avatar.assistant {
        background-color: #f3e8ff;
      }

      .message-content-wrapper {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .message-content {
        padding: 0.75rem 1rem;
        border-radius: 0.75rem;
        line-height: 1.5;
        word-break: break-word;
      }

      .message-content.user {
        background-color: #3b82f6;
        color: white;
        white-space: pre-wrap;
      }

      .message-content.assistant {
        background-color: #f3f4f6;
        color: #111827;
        white-space: normal;
      }

      .message-timestamp {
        font-size: 0.6875rem;
        color: #9ca3af;
        padding: 0 0.25rem;
      }

      .input-container {
        display: flex;
        gap: 0.5rem;
        padding: 1rem;
        border-top: 1px solid #e5e7eb;
        background-color: white;
      }

      .message-input {
        flex: 1;
        padding: 0.75rem 1rem;
        border: 1px solid #d1d5db;
        border-radius: 0.5rem;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 0.875rem;
        resize: none;
        outline: none;
        transition: border-color 0.15s, box-shadow 0.15s;
        min-height: 44px;
        max-height: 150px;
      }

      .message-input:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }

      .send-button {
        padding: 0.75rem 1.5rem;
        background-color: #3b82f6;
        color: white;
        border: none;
        border-radius: 0.5rem;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.15s;
        white-space: nowrap;
      }

      .send-button:hover {
        background-color: #2563eb;
      }

      .send-button:active {
        background-color: #1d4ed8;
      }

      .send-button:disabled {
        background-color: #9ca3af;
        cursor: not-allowed;
      }

      .send-button:focus {
        outline: 2px solid #3b82f6;
        outline-offset: 2px;
      }

      .loading-indicator {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        margin: 0 1rem;
        background-color: #f3f4f6;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        color: #6b7280;
      }

      .loading-indicator.hidden {
        display: none;
      }

      .loading-spinner {
        width: 1rem;
        height: 1rem;
        border: 2px solid #e5e7eb;
        border-top-color: #3b82f6;
        border-radius: 9999px;
        animation: spin 1s linear infinite;
      }

      /* Markdown styles */
      .message-content h1,
      .message-content h2,
      .message-content h3,
      .message-content h4,
      .message-content h5,
      .message-content h6 {
        margin: 1rem 0 0.5rem 0;
        font-weight: 600;
        line-height: 1.25;
      }

      .message-content h1 { font-size: 1.875rem; }
      .message-content h2 { font-size: 1.5rem; }
      .message-content h3 { font-size: 1.25rem; }
      .message-content h4 { font-size: 1.125rem; }
      .message-content h5 { font-size: 1rem; }
      .message-content h6 { font-size: 0.875rem; }

      .message-content p {
        margin: 0.5rem 0;
      }

      .message-content pre {
        background-color: #1e1e1e;
        color: #d4d4d4;
        padding: 1rem;
        border-radius: 0.5rem;
        overflow-x: auto;
        margin: 0.75rem 0;
      }

      .message-content pre.incomplete {
        border-bottom: 2px dashed #3b82f6;
        position: relative;
      }

      .message-content pre code {
        background-color: transparent;
        padding: 0;
      }

      .message-content code {
        background-color: rgba(0, 0, 0, 0.05);
        padding: 0.125rem 0.375rem;
        border-radius: 0.25rem;
        font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
        font-size: 0.875rem;
      }

      .message-content ul,
      .message-content ol {
        margin: 0.5rem 0;
        padding-left: 1.5rem;
      }

      .message-content li {
        margin: 0.25rem 0;
      }

      .message-content a {
        color: #3b82f6;
        text-decoration: underline;
      }

      .message-content a:hover {
        color: #2563eb;
      }

      .message-content strong {
        font-weight: 600;
      }

      .message-content em {
        font-style: italic;
      }

      .message-content blockquote {
        border-left: 4px solid #e5e7eb;
        padding-left: 1rem;
        margin: 0.75rem 0;
        color: #6b7280;
      }

      /* Thread list sidebar styles */
      .thread-list-sidebar {
        position: absolute;
        top: 0;
        left: -300px;
        width: 300px;
        height: 100%;
        background-color: white;
        border-right: 1px solid #e5e7eb;
        transition: left 0.3s ease;
        z-index: 100;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .thread-list-sidebar.open {
        left: 0;
      }

      .thread-list-header {
        padding: 1rem;
        border-bottom: 1px solid #e5e7eb;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background-color: #f9fafb;
      }

      .thread-list-title {
        font-size: 1.125rem;
        font-weight: 600;
        color: #111827;
        margin: 0;
      }

      .thread-new-button {
        background: none;
        border: none;
        font-size: 1.25rem;
        cursor: pointer;
        padding: 0.25rem 0.5rem;
        border-radius: 0.375rem;
        transition: background-color 0.15s;
      }

      .thread-new-button:hover {
        background-color: #e5e7eb;
      }

      .thread-list-items {
        flex: 1;
        overflow-y: auto;
        padding: 0.5rem;
      }

      .thread-list-empty {
        padding: 2rem 1rem;
        text-align: center;
        color: #9ca3af;
        font-size: 0.875rem;
      }

      .thread-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem;
        border-radius: 0.5rem;
        margin-bottom: 0.5rem;
        cursor: pointer;
        transition: background-color 0.15s;
        border: 1px solid transparent;
      }

      .thread-item:hover {
        background-color: #f3f4f6;
      }

      .thread-item.active {
        background-color: #eff6ff;
        border-color: #3b82f6;
      }

      .thread-item-content {
        flex: 1;
        min-width: 0;
      }

      .thread-item-title {
        font-weight: 500;
        color: #111827;
        font-size: 0.875rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        margin-bottom: 0.25rem;
      }

      .thread-item-meta {
        font-size: 0.75rem;
        color: #6b7280;
        display: flex;
        align-items: center;
        gap: 0.25rem;
      }

      .thread-item-timestamp {
        flex-shrink: 0;
      }

      .thread-item-count {
        flex-shrink: 0;
      }

      .thread-item-delete {
        background: none;
        border: none;
        font-size: 1rem;
        cursor: pointer;
        padding: 0.25rem;
        border-radius: 0.25rem;
        opacity: 0;
        transition: opacity 0.15s, background-color 0.15s;
        flex-shrink: 0;
      }

      .thread-item:hover .thread-item-delete {
        opacity: 1;
      }

      .thread-item-delete:hover {
        background-color: #fee2e2;
      }

      .thread-toggle-button {
        background: none;
        border: none;
        color: white;
        font-size: 1.25rem;
        cursor: pointer;
        padding: 0.5rem;
        border-radius: 0.375rem;
        transition: background-color 0.15s;
        margin-right: 0.5rem;
      }

      .thread-toggle-button:hover {
        background-color: rgba(255, 255, 255, 0.2);
      }

      .thread-toggle-button:focus {
        outline: 2px solid white;
        outline-offset: 2px;
      }
    `;
}
