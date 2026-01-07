import { describe, it, expect } from 'vitest';

describe('Test Setup', () => {
    it('should run basic tests', () => {
        expect(true).toBe(true);
    });

    it('should have access to DOM', () => {
        const div = document.createElement('div');
        expect(div).toBeInstanceOf(HTMLElement);
    });
});
