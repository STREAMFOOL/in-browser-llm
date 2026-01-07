

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { GeminiController, type SessionConfig, type AISession } from '../../src/gemini-controller';

describe('Gemini Controller Properties', () => {
    let controller: GeminiController;
    let createdSessions: AISession[] = [];

    beforeEach(() => {
        controller = new GeminiController();
        createdSessions = [];
    });

    afterEach(async () => {
        // Clean up all created sessions
        for (const session of createdSessions) {
            try {
                await controller.destroySession(session);
            } catch (e) {
                // Ignore cleanup errors
            }
        }
        createdSessions = [];
    });


    it('should create new sessions with specified configuration and allow destruction', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    temperature: fc.double({ min: 0, max: 1, noNaN: true }),
                    topK: fc.integer({ min: 1, max: 100 }),
                    systemPrompt: fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: undefined })
                }),
                async (config: SessionConfig) => {
                    // Check availability first
                    const availability = await controller.checkAvailability();

                    // Skip test if model is not available
                    if (availability.status === 'no') {
                        return true;
                    }

                    // Create a session with the configuration
                    const session = await controller.createSession(config);
                    createdSessions.push(session);

                    // Verify session was created (it should be a valid object)
                    expect(session).toBeDefined();
                    expect(typeof session).toBe('object');
                    expect(typeof session.prompt).toBe('function');
                    expect(typeof session.promptStreaming).toBe('function');
                    expect(typeof session.destroy).toBe('function');

                    // Destroy the session
                    await controller.destroySession(session);

                    // Remove from tracking since we destroyed it
                    createdSessions = createdSessions.filter(s => s !== session);

                    // Session destruction should not throw
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });


    it('should clone sessions creating independent copies', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    temperature: fc.double({ min: 0, max: 1, noNaN: true }),
                    topK: fc.integer({ min: 1, max: 100 })
                }),
                async (config: SessionConfig) => {
                    // Check availability first
                    const availability = await controller.checkAvailability();

                    if (availability.status === 'no') {
                        return true;
                    }

                    // Create original session
                    const originalSession = await controller.createSession(config);
                    createdSessions.push(originalSession);

                    // Clone the session
                    const clonedSession = await controller.cloneSession(originalSession);
                    createdSessions.push(clonedSession);

                    // Both sessions should be valid objects
                    expect(clonedSession).toBeDefined();
                    expect(typeof clonedSession).toBe('object');
                    expect(clonedSession).not.toBe(originalSession); // Different instances

                    // Both should have the required methods
                    expect(typeof clonedSession.prompt).toBe('function');
                    expect(typeof clonedSession.promptStreaming).toBe('function');
                    expect(typeof clonedSession.destroy).toBe('function');

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });


    it('should safely handle multiple destroy calls on the same session', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    temperature: fc.double({ min: 0, max: 1, noNaN: true }),
                    topK: fc.integer({ min: 1, max: 100 })
                }),
                async (config: SessionConfig) => {
                    const availability = await controller.checkAvailability();

                    if (availability.status === 'no') {
                        return true;
                    }

                    const session = await controller.createSession(config);

                    // Destroy the session multiple times
                    await controller.destroySession(session);
                    await controller.destroySession(session);
                    await controller.destroySession(session);

                    // Should not throw errors
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});
