import { getBaseStyles } from './base-styles';
import { getComponentStyles } from './component-styles';
import { getThemeStyles } from './theme-styles';
import { getAnimationStyles } from './animation-styles';

export function getMainStyles() {
    return getBaseStyles() + getComponentStyles() + getThemeStyles() + getAnimationStyles();
}

// Re-export individual style functions for flexibility
export { getBaseStyles } from './base-styles';
export { getComponentStyles } from './component-styles';
export { getThemeStyles } from './theme-styles';
export { getAnimationStyles } from './animation-styles';
