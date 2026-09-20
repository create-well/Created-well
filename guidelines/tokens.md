# Design Tokens

All tokens are CSS custom properties defined in `src/styles/theme.css`.  
They are mapped to Tailwind utilities via the `@theme inline` block.  
**Never use raw hex or oklch values in component code — always reference a token.**

## Color tokens — Light mode

| Token | Value | Tailwind class |
|---|---|---|
| `--background` | `#ffffff` | `bg-background` |
| `--foreground` | `oklch(0.145 0 0)` | `text-foreground` |
| `--card` | `#ffffff` | `bg-card` |
| `--card-foreground` | `oklch(0.145 0 0)` | `text-card-foreground` |
| `--popover` | `oklch(1 0 0)` | `bg-popover` |
| `--popover-foreground` | `oklch(0.145 0 0)` | `text-popover-foreground` |
| `--primary` | `#7BA89D` | `bg-primary`, `text-primary` |
| `--primary-foreground` | `#ffffff` | `text-primary-foreground` |
| `--secondary` | `#B8A9D4` | `bg-secondary`, `text-secondary` |
| `--secondary-foreground` | `#2D2438` | `text-secondary-foreground` |
| `--muted` | `#ececf0` | `bg-muted` |
| `--muted-foreground` | `#717182` | `text-muted-foreground` |
| `--accent` | `#e9ebef` | `bg-accent` |
| `--accent-foreground` | `#030213` | `text-accent-foreground` |
| `--destructive` | `#d4183d` | `bg-destructive`, `text-destructive` |
| `--destructive-foreground` | `#ffffff` | `text-destructive-foreground` |
| `--border` | `rgba(0,0,0,0.1)` | `border-border` |
| `--input` | `transparent` | `border-input` |
| `--input-background` | `#f3f3f5` | `bg-input-background` |
| `--switch-background` | `#cbced4` | `bg-switch-background` |
| `--ring` | `oklch(0.708 0 0)` | `ring-ring` |

## Chart tokens

| Token | Tailwind class | Hue note |
|---|---|---|
| `--chart-1` | `text-chart-1` | Warm orange |
| `--chart-2` | `text-chart-2` | Teal |
| `--chart-3` | `text-chart-3` | Navy |
| `--chart-4` | `text-chart-4` | Yellow |
| `--chart-5` | `text-chart-5` | Amber |

## Sidebar tokens

| Token | Tailwind class |
|---|---|
| `--sidebar` | `bg-sidebar` |
| `--sidebar-foreground` | `text-sidebar-foreground` |
| `--sidebar-primary` | `bg-sidebar-primary` |
| `--sidebar-primary-foreground` | `text-sidebar-primary-foreground` |
| `--sidebar-accent` | `bg-sidebar-accent` |
| `--sidebar-accent-foreground` | `text-sidebar-accent-foreground` |
| `--sidebar-border` | `border-sidebar-border` |
| `--sidebar-ring` | `ring-sidebar-ring` |

## Radius tokens

| Token | Resolves to | Tailwind class |
|---|---|---|
| `--radius-sm` | `calc(var(--radius) - 4px)` = 6 px | `rounded-sm` |
| `--radius-md` | `calc(var(--radius) - 2px)` = 8 px | `rounded-md` |
| `--radius-lg` | `var(--radius)` = 10 px | `rounded-lg` |
| `--radius-xl` | `calc(var(--radius) + 4px)` = 14 px | `rounded-xl` |

Default corner for most components: **`rounded-lg`** (10 px).

## Typography tokens

| Token | Value |
|---|---|
| `--font-size` | `16px` (base `html` font size) |
| `--font-weight-medium` | `500` |
| `--font-weight-normal` | `400` |

## HTML base styles (`@layer base`)

The kit applies these by default — do not override with utilities unless intentional:

| Element | Size | Weight |
|---|---|---|
| `h1` | `text-2xl` | 500 |
| `h2` | `text-xl` | 500 |
| `h3` | `text-lg` | 500 |
| `h4` | `text-base` | 500 |
| `label` | `text-base` | 500 |
| `button` | `text-base` | 500 |
| `input` | `text-base` | 400 |

## Dark mode

Toggled by adding the `.dark` class to any ancestor element.  
The `@custom-variant dark (&:is(.dark *))` declaration in `theme.css` wires this.  
In dark mode, `--primary` shifts to near-white; sage/lavender brand colors are not maintained.  
Dark mode is intentionally minimal — this dashboard is primarily a light-mode product.

## Token anti-patterns

```ts
// ❌ never
className="bg-[#7BA89D]"
style={{ color: '#B8A9D4' }}
className="text-[oklch(0.145_0_0)]"

// ✓ always
className="bg-primary"
className="text-secondary"
className="text-foreground"
```
