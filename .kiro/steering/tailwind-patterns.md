---
inclusion: fileMatch
fileMatchPattern: "**/*.ts"
---

# Tailwind CSS Patterns

## CDN Setup

The project uses Tailwind CSS v4 browser runtime loaded via CDN in `index.html`:

```html
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
```

## Common Class Mappings

### Layout
| Purpose | Tailwind Classes |
|---------|-----------------|
| Flex column | `flex flex-col` |
| Flex row centered | `flex items-center gap-2` |
| Full size | `w-full h-full` |
| Overflow scroll | `overflow-y-auto` |

### Spacing
| Size | Padding | Margin | Gap |
|------|---------|--------|-----|
| 4px | `p-1` | `m-1` | `gap-1` |
| 8px | `p-2` | `m-2` | `gap-2` |
| 12px | `p-3` | `m-3` | `gap-3` |
| 16px | `p-4` | `m-4` | `gap-4` |

### Colors (Project Palette)
| Use Case | Background | Text |
|----------|------------|------|
| User message | `bg-blue-500` | `text-white` |
| Assistant message | `bg-gray-100` | `text-gray-900` |
| Code block | `bg-gray-900` | `text-gray-300` |
| Muted text | - | `text-gray-500` |
| Links | - | `text-blue-500` |

### Interactive States
```typescript
// Button pattern
"bg-blue-500 hover:bg-blue-600 active:bg-blue-700 disabled:bg-gray-400"

// Input focus pattern  
"focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/10"
```

### Borders & Radius
| Style | Class |
|-------|-------|
| Standard border | `border border-gray-200` |
| Top border only | `border-t border-gray-200` |
| Small radius | `rounded` |
| Medium radius | `rounded-lg` |
| Large radius | `rounded-xl` |
| Circle | `rounded-full` |

## Component Patterns

### Message List
```typescript
list.className = "flex-1 overflow-y-auto p-4 flex flex-col gap-4 scroll-smooth";
```

### Message Bubble (User)
```typescript
content.className = "p-3 px-4 rounded-xl bg-blue-500 text-white leading-normal break-words whitespace-pre-wrap";
```

### Message Bubble (Assistant)
```typescript
content.className = "p-3 px-4 rounded-xl bg-gray-100 text-gray-900 leading-normal break-words whitespace-normal";
```

### Input Field
```typescript
textarea.className = `
  flex-1 p-3 px-4 
  border border-gray-300 rounded-lg 
  font-sans text-sm resize-none outline-none 
  transition-colors min-h-[44px] max-h-[150px]
  focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/10
`;
```

### Loading Spinner
```typescript
spinner.className = "w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin";
```

## Arbitrary Values

Use bracket notation for custom values:
- `h-[600px]` - exact height
- `max-h-[150px]` - max height
- `min-h-[44px]` - min height
- `focus:ring-[3px]` - custom ring width
- `focus:ring-blue-500/10` - color with opacity

## Shadow DOM Considerations

Tailwind classes work inside Shadow DOM because the browser runtime processes them. Only custom animations need CSS:

```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fadeIn { animation: fadeIn 0.3s ease-in; }
```
