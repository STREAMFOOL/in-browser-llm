import { describe, it, expect, beforeEach } from 'vitest';
import { LocalAIAssistant } from '../src/local-ai-assistant';

describe('LocalAIAssistant Web Component', () => {
    beforeEach(() => {
        // Clean up any existing instances
        document.body.innerHTML = '';
    });

    it('should be registered as a custom element', () => {
        // Requirement 5.1: Web Component with custom HTML tag
        const elementClass = customElements.get('local-ai-assistant');
        expect(elementClass).toBeDefined();
        expect(elementClass).toBe(LocalAIAssistant);
    });

    it('should create an instance with closed Shadow DOM', () => {
        // Requirement 5.2: Closed Shadow DOM
        const element = document.createElement('local-ai-assistant') as LocalAIAssistant;
        document.body.appendChild(element);

        expect(element).toBeInstanceOf(LocalAIAssistant);
        expect(element).toBeInstanceOf(HTMLElement);

        // Verify Shadow DOM is closed (shadowRoot should be null)
        expect(element.shadowRoot).toBeNull();
    });

    it('should be embeddable in the DOM', () => {
        const element = document.createElement('local-ai-assistant') as LocalAIAssistant;
        document.body.appendChild(element);

        const found = document.querySelector('local-ai-assistant');
        expect(found).toBe(element);
    });

    it('should have proper lifecycle callbacks', () => {
        const element = new LocalAIAssistant();

        // Should have connectedCallback
        expect(typeof element.connectedCallback).toBe('function');

        // Should have disconnectedCallback
        expect(typeof element.disconnectedCallback).toBe('function');
    });
});
