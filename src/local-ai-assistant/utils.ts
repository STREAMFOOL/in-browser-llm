
/**
 * Generate a thread title from the first user message
 * Requirements: 13.5
 */
export function generateThreadTitle(firstMessage: string): string {
    // Take first 50 characters and add ellipsis if longer
    const maxLength = 50;
    const trimmed = firstMessage.trim();

    if (trimmed.length <= maxLength) {
        return trimmed;
    }

    // Try to break at a word boundary
    const truncated = trimmed.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > maxLength * 0.7) {
        return truncated.substring(0, lastSpace) + '...';
    }

    return truncated + '...';
}