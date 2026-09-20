# Icon System

## Source

This kit uses **`lucide-react`** as its icon library. No custom icon set is shipped.

## Import pattern

Always import named icons — never use default imports or barrel `*` imports.

```ts
import { Calendar, ChevronDown, X, Search, User } from "lucide-react";
```

## Sizing

Icons default to `1em` (inherits parent `font-size`). Override with size utilities:

```tsx
<Search className="size-4" />   {/* 16px — small / inline */}
<Search className="size-5" />   {/* 20px — default button icon */}
<Search className="size-6" />   {/* 24px — standalone / prominent */}
```

Use `size-4` for icons inside buttons and inputs.  
Use `size-5` or `size-6` for standalone action icons.

## Color

Icons inherit `currentColor`. Use text utilities to color them:

```tsx
<ChevronDown className="text-muted-foreground" />
<CheckIcon className="text-primary" />
```

Never set icon color with raw hex or `style={{ color }}`.

## Icons used internally by kit components

These are imported inside component files — you do not need to import them in your own code unless using them independently:

| Icon | Used by |
|---|---|
| `ChevronDownIcon` | Select, Accordion |
| `ChevronUpIcon` | Select scroll button |
| `ChevronLeftIcon` | Calendar |
| `ChevronRightIcon` | Calendar, Carousel |
| `CheckIcon` | Checkbox, Select item |
| `XIcon` | Dialog close, Toast |
| `PanelLeftIcon` | SidebarTrigger |
| `CircleIcon` | RadioGroupItem |
| `GripVerticalIcon` | ResizableHandle |
| `EllipsisIcon` | Carousel, Pagination |
| `OctagonAlertIcon` | Alert (destructive) |

## Common icon names — verify before using

Lucide icon names are PascalCase with no `Icon` suffix in the import destructure:

```ts
// ✓ correct
import { Search, Calendar, User, Settings, ChevronDown } from "lucide-react";

// ✗ wrong — these don't exist
import { SearchIcon } from "lucide-react";    // no "Icon" suffix
import { search } from "lucide-react";        // must be PascalCase
```

Some icons have non-obvious names. When unsure, check https://lucide.dev/icons or search the `node_modules/lucide-react/dist/esm/icons/` directory.

## Accessibility

Always provide `aria-label` when an icon is the only content of an interactive element:

```tsx
<button aria-label="Close dialog"><X className="size-4" /></button>
```

For decorative icons alongside text, add `aria-hidden="true"`:

```tsx
<Search className="size-4" aria-hidden="true" />
<span>Search</span>
```
