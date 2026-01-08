export function getBaseStyles() {
    return `
      :host {
        display: block;
        width: 100%;
        height: 100%;
        font-family: system-ui, -apple-system, sans-serif;
      }

      /* Container styles */
      .ai-assistant-container {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        background-color: white;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        overflow: hidden;
      }

      /* Content area */
      .ai-assistant-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      /* Footer styles */
      .ai-assistant-footer {
        padding: 0.75rem 1rem;
        border-top: 1px solid #e5e7eb;
        background-color: #f9fafb;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.75rem;
        color: #6b7280;
      }

      .footer-icon {
        font-size: 1rem;
      }
    `;
}
