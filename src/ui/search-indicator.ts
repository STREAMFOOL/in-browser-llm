/**
 * Search Indicator Component
 * Displays a visual indicator when web search is active
 */

export class SearchIndicator {
    private container: HTMLElement;
    private indicator: HTMLElement | null = null;

    constructor(container: HTMLElement) {
        this.container = container;
    }

    /**
     * Show the search indicator with animation
     */
    show(): void {
        if (this.indicator) {
            this.indicator.style.display = 'flex';
            return;
        }

        this.indicator = document.createElement('div');
        this.indicator.className = 'search-indicator';
        this.indicator.innerHTML = `
            <div class="search-indicator-content">
                <span class="search-indicator-icon">🔍</span>
                <span class="search-indicator-text">Searching web...</span>
            </div>
        `;

        this.indicator.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 500;
            animation: fadeIn 0.3s ease-in-out;
        `;

        this.container.appendChild(this.indicator);
    }

    /**
     * Hide the search indicator
     */
    hide(): void {
        if (this.indicator) {
            this.indicator.style.display = 'none';
        }
    }

    /**
     * Remove the search indicator from DOM
     */
    remove(): void {
        if (this.indicator && this.indicator.parentNode) {
            this.indicator.parentNode.removeChild(this.indicator);
            this.indicator = null;
        }
    }

    /**
     * Check if indicator is currently visible
     */
    isVisible(): boolean {
        return this.indicator !== null && this.indicator.style.display !== 'none';
    }
}
