import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { LocalAIAssistant } from '../../src/component';

// Feature: local-ai-assistant, Property: Web Component Registration
// Validates: Requirements 5.1, 5.2

// Feature: code-reorganization, Property 8: Export API Preservation
// Validates: Requirements 5.2

describe('Web Component Structure Properties', () => {
    beforeEach(() => {
        // Clean up DOM before each test
        document.body.innerHTML = '';
    });

    it('should always register as a custom element with closed Shadow DOM', () => {
        // Property: For any number of times we check, the custom element should be registered
        // and instances should have closed Shadow DOM

        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 10 }), // Number of instances to create
                (instanceCount) => {
                    // Verify custom element is registered
                    const elementClass = customElements.get('local-ai-assistant');
                    expect(elementClass).toBeDefined();
                    expect(elementClass).toBe(LocalAIAssistant);

                    // Create multiple instances and verify each has closed Shadow DOM
                    const instances: LocalAIAssistant[] = [];

                    for (let i = 0; i < instanceCount; i++) {
                        const element = document.createElement('local-ai-assistant') as LocalAIAssistant;
                        document.body.appendChild(element);
                        instances.push(element);

                        // Verify instance is correct type
                        expect(element).toBeInstanceOf(LocalAIAssistant);
                        expect(element).toBeInstanceOf(HTMLElement);

                        // Verify Shadow DOM is closed (shadowRoot should be null from outside)
                        expect(element.shadowRoot).toBeNull();
                    }

                    // Clean up
                    instances.forEach(el => el.remove());

                    return true;
                }
            ),
            { numRuns: 100 } // Run 100 iterations as per design requirements
        );
    });

    it('should maintain closed Shadow DOM regardless of creation method', () => {
        // Property: For any valid creation method, Shadow DOM should remain closed

        fc.assert(
            fc.property(
                fc.constantFrom(
                    'createElement',
                    'constructor',
                    'innerHTML'
                ),
                (creationMethod) => {
                    let element: LocalAIAssistant;

                    switch (creationMethod) {
                        case 'createElement':
                            element = document.createElement('local-ai-assistant') as LocalAIAssistant;
                            break;
                        case 'constructor':
                            element = new LocalAIAssistant();
                            break;
                        case 'innerHTML':
                            document.body.innerHTML = '<local-ai-assistant></local-ai-assistant>';
                            element = document.querySelector('local-ai-assistant') as LocalAIAssistant;
                            break;
                    }

                    document.body.appendChild(element);

                    // Verify Shadow DOM is closed regardless of creation method
                    expect(element.shadowRoot).toBeNull();
                    expect(element).toBeInstanceOf(LocalAIAssistant);

                    element.remove();

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should preserve custom element registration across multiple checks', () => {
        // Property: For any sequence of registration checks, the element should remain registered

        fc.assert(
            fc.property(
                fc.array(fc.boolean(), { minLength: 1, maxLength: 50 }), // Random sequence of checks
                (checkSequence) => {
                    // Perform multiple registration checks
                    for (const _ of checkSequence) {
                        const elementClass = customElements.get('local-ai-assistant');

                        // Element should always be registered
                        expect(elementClass).toBeDefined();
                        expect(elementClass).toBe(LocalAIAssistant);
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should create independent instances with isolated Shadow DOM', () => {
        // Property: For any number of instances, each should have its own isolated Shadow DOM

        fc.assert(
            fc.property(
                fc.integer({ min: 2, max: 5 }), // Create multiple instances
                (instanceCount) => {
                    const instances: LocalAIAssistant[] = [];

                    // Create instances
                    for (let i = 0; i < instanceCount; i++) {
                        const element = document.createElement('local-ai-assistant') as LocalAIAssistant;
                        document.body.appendChild(element);
                        instances.push(element);
                    }

                    // Verify each instance is independent
                    for (let i = 0; i < instances.length; i++) {
                        const instance = instances[i];

                        // Each should be a valid instance
                        expect(instance).toBeInstanceOf(LocalAIAssistant);

                        // Each should have closed Shadow DOM
                        expect(instance.shadowRoot).toBeNull();

                        // Each should be a different object
                        for (let j = i + 1; j < instances.length; j++) {
                            expect(instance).not.toBe(instances[j]);
                        }
                    }

                    // Clean up
                    instances.forEach(el => el.remove());

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    // Property 8: Export API Preservation
    // Validates that LocalAIAssistant export is available after component split
    it('should preserve LocalAIAssistant export from component module', () => {
        // Property: For any attempt to import LocalAIAssistant from the component module,
        // the export should be available and be the correct class

        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 20 }), // Number of import verification attempts
                (verificationCount) => {
                    // Verify the export is available multiple times
                    for (let i = 0; i < verificationCount; i++) {
                        // Verify LocalAIAssistant is exported
                        expect(LocalAIAssistant).toBeDefined();

                        // Verify it's a constructor function (class)
                        expect(typeof LocalAIAssistant).toBe('function');

                        // Verify it extends HTMLElement
                        expect(LocalAIAssistant.prototype).toBeInstanceOf(HTMLElement);

                        // Verify we can instantiate it
                        const instance = new LocalAIAssistant();
                        expect(instance).toBeInstanceOf(LocalAIAssistant);
                        expect(instance).toBeInstanceOf(HTMLElement);

                        // Verify it has the expected methods from the split
                        expect(typeof instance.connectedCallback).toBe('function');
                        expect(typeof instance.disconnectedCallback).toBe('function');

                        // Clean up
                        if (instance.parentNode) {
                            instance.remove();
                        }
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should maintain LocalAIAssistant export API consistency across component lifecycle', () => {
        // Property: For any sequence of component creation and destruction,
        // the export should remain consistent and functional

        fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        action: fc.constantFrom('create', 'destroy', 'verify'),
                        count: fc.integer({ min: 1, max: 3 })
                    }),
                    { minLength: 5, maxLength: 15 }
                ),
                (actions) => {
                    const instances: LocalAIAssistant[] = [];

                    for (const { action, count } of actions) {
                        switch (action) {
                            case 'create':
                                for (let i = 0; i < count; i++) {
                                    // Verify export is available before creation
                                    expect(LocalAIAssistant).toBeDefined();

                                    const instance = new LocalAIAssistant();
                                    expect(instance).toBeInstanceOf(LocalAIAssistant);
                                    instances.push(instance);
                                }
                                break;

                            case 'destroy':
                                for (let i = 0; i < count && instances.length > 0; i++) {
                                    const instance = instances.pop();
                                    if (instance && instance.parentNode) {
                                        instance.remove();
                                    }
                                }
                                break;

                            case 'verify':
                                // Verify export is still available
                                expect(LocalAIAssistant).toBeDefined();
                                expect(typeof LocalAIAssistant).toBe('function');

                                // Verify all existing instances are still valid
                                instances.forEach(instance => {
                                    expect(instance).toBeInstanceOf(LocalAIAssistant);
                                });
                                break;
                        }
                    }

                    // Clean up remaining instances
                    instances.forEach(instance => {
                        if (instance.parentNode) {
                            instance.remove();
                        }
                    });

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});
