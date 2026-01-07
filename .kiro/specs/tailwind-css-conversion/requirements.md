# Requirements Document

## Introduction

This specification covers the conversion of all CSS styling in the Local AI Assistant project from traditional CSS (external stylesheets and inline styles) to Tailwind CSS utility classes. The goal is to reduce CSS file size, improve maintainability, and leverage Tailwind's CDN-based browser runtime for rapid development. Tailwind CSS v4 will be loaded directly from CDN using the browser build.

## Glossary

- **Tailwind_CSS**: A utility-first CSS framework that provides low-level utility classes for building custom designs
- **CDN**: Content Delivery Network, used to load Tailwind CSS directly in the browser without build steps
- **Utility_Classes**: Single-purpose CSS classes that apply one specific style property
- **Shadow_DOM**: Encapsulated DOM tree used by web components for style isolation
- **Style_Sheet**: CSS file or inline style block containing styling rules
- **Web_Component**: Custom HTML element with encapsulated functionality and styling

## Requirements

### Requirement 1: CDN Integration

**User Story:** As a developer, I want to load Tailwind CSS from CDN, so that I can use utility classes without a build step.

#### Acceptance Criteria

1. WHEN the application loads, THE index.html SHALL include the Tailwind CSS browser script from `https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4`
2. THE index.html SHALL remove all inline `<style>` blocks after Tailwind conversion
3. WHEN Tailwind CSS loads, THE Utility_Classes SHALL be available for use throughout the application

### Requirement 2: Global Style Removal

**User Story:** As a developer, I want to remove the external CSS file, so that all styling is handled by Tailwind utility classes.

#### Acceptance Criteria

1. THE Style_Sheet `src/style.css` SHALL be deleted after all styles are converted to Tailwind classes
2. THE main.ts SHALL NOT import `style.css` after conversion
3. WHEN global styles are needed, THE index.html body and container elements SHALL use Tailwind utility classes directly

### Requirement 3: Chat UI Component Conversion

**User Story:** As a developer, I want the Chat UI styles converted to Tailwind, so that the component uses utility classes instead of CSS strings.

#### Acceptance Criteria

1. THE ChatUI class SHALL NOT contain a `getStyles()` method returning CSS strings after conversion
2. WHEN creating DOM elements, THE ChatUI class SHALL apply Tailwind utility classes via `className` property
3. THE message-list element SHALL use Tailwind classes for flex layout, overflow, padding, and gap
4. THE message elements SHALL use Tailwind classes for flex layout, gap, and animation
5. THE message-avatar elements SHALL use Tailwind classes for sizing, border-radius, flex alignment, and background colors
6. THE message-content elements SHALL use Tailwind classes for padding, border-radius, background, and text colors
7. THE input-container elements SHALL use Tailwind classes for flex layout, gap, padding, and border
8. THE message-input textarea SHALL use Tailwind classes for flex, padding, border, border-radius, and focus states
9. THE send-button SHALL use Tailwind classes for padding, background, color, border-radius, and hover states
10. THE loading-indicator SHALL use Tailwind classes for flex layout, gap, padding, background, and border-radius

### Requirement 4: Markdown Renderer Conversion

**User Story:** As a developer, I want the Markdown Renderer styles converted to Tailwind, so that rendered content uses utility classes.

#### Acceptance Criteria

1. THE MarkdownRenderer class SHALL NOT contain a `getStyles()` method returning CSS strings after conversion
2. WHEN rendering markdown elements, THE MarkdownRenderer SHALL inject Tailwind utility classes into the generated HTML
3. THE rendered headers (h1-h6) SHALL include Tailwind classes for margin, font-weight, line-height, and font-size
4. THE rendered code blocks SHALL include Tailwind classes for background, color, padding, border-radius, and overflow
5. THE rendered inline code SHALL include Tailwind classes for background, padding, border-radius, and font-family
6. THE rendered lists (ul, ol) SHALL include Tailwind classes for margin and padding
7. THE rendered links SHALL include Tailwind classes for color and text-decoration
8. THE incomplete code block indicator SHALL use Tailwind classes for border styling and animation

### Requirement 5: Local AI Assistant Component Conversion

**User Story:** As a developer, I want the Local AI Assistant component styles converted to Tailwind, so that the web component uses utility classes.

#### Acceptance Criteria

1. THE LocalAIAssistant component SHALL minimize inline CSS in the Shadow DOM style element
2. THE ai-assistant-container SHALL use Tailwind classes for flex layout, sizing, background, border, and border-radius
3. THE ai-assistant-header SHALL use Tailwind classes for padding, background gradient, color, border, and flex alignment
4. THE status-indicator SHALL use Tailwind classes for sizing, border-radius, background, and animation
5. THE ai-assistant-content SHALL use Tailwind classes for flex layout and overflow
6. THE ai-assistant-footer SHALL use Tailwind classes for padding, border, background, flex alignment, font-size, and color
7. WHEN the Shadow DOM requires Tailwind, THE component SHALL include necessary Tailwind configuration for Shadow DOM support

### Requirement 6: Index HTML Conversion

**User Story:** As a developer, I want the index.html styles converted to Tailwind, so that the demo page uses utility classes.

#### Acceptance Criteria

1. THE body element SHALL use Tailwind classes for margin, padding, font-family, and background
2. THE demo-container element SHALL use Tailwind classes for max-width and margin
3. THE h1 element SHALL use Tailwind classes for text-align and color
4. THE local-ai-assistant element SHALL use Tailwind classes for height and display
5. THE index.html SHALL NOT contain any `<style>` blocks after conversion

### Requirement 7: Animation Preservation

**User Story:** As a developer, I want all animations preserved during conversion, so that the UI maintains its visual feedback.

#### Acceptance Criteria

1. WHEN converting the fadeIn animation, THE Chat_UI SHALL use Tailwind's animation utilities or custom animation classes
2. WHEN converting the pulse animation, THE status-indicator SHALL use Tailwind's `animate-pulse` or equivalent
3. WHEN converting the spin animation, THE loading spinner SHALL use Tailwind's `animate-spin`
4. WHEN converting the blink animation, THE incomplete code block indicator SHALL use custom Tailwind animation or CSS keyframes
5. IF custom animations are required, THEN THE component SHALL define them using Tailwind's configuration or minimal inline CSS

### Requirement 8: Color Scheme Preservation

**User Story:** As a developer, I want all colors preserved during conversion, so that the UI maintains its visual design.

#### Acceptance Criteria

1. THE user message background color (#3b82f6) SHALL be converted to Tailwind's `bg-blue-500`
2. THE assistant message background color (#f3f4f6) SHALL be converted to Tailwind's `bg-gray-100`
3. THE header gradient (from #667eea to #764ba2) SHALL be preserved using Tailwind gradient utilities
4. THE code block background (#1e1e1e) SHALL be converted to appropriate Tailwind dark background class
5. THE link colors (#3b82f6, #2563eb) SHALL be converted to Tailwind's blue color scale

### Requirement 9: Responsive Design

**User Story:** As a developer, I want the converted styles to maintain responsive behavior, so that the UI works on different screen sizes.

#### Acceptance Criteria

1. THE message-input max-height (150px) SHALL be preserved using Tailwind's max-height utilities
2. THE container max-width (1280px) SHALL be preserved using Tailwind's max-width utilities
3. THE minimum width constraints SHALL be preserved using Tailwind's min-width utilities

### Requirement 10: Accessibility Preservation

**User Story:** As a developer, I want all accessibility features preserved during conversion, so that the UI remains accessible.

#### Acceptance Criteria

1. THE focus states on interactive elements SHALL be preserved using Tailwind's focus utilities
2. THE focus ring on message-input SHALL use Tailwind's `focus:ring` utilities
3. THE button focus states SHALL use Tailwind's focus utilities
4. THE ARIA attributes on elements SHALL remain unchanged after conversion
