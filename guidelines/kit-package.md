# `@cr8w/design-system` — Published Kit Package

Package: `@cr8w/design-system@0.0.2`  
Registry: Figma private registry (`ce4a3132-d671-4eb3-86fc-c586bacd062c`)  
Status: **Early stage — v0.0.2.** One component shipped. More in development.

---

## Brand voice

> Calm, grounded, warm. Never clinical, never loud.

Create Well is a wellness and nervous-system education platform. The design language  
reflects that: generous whitespace, one primary action per screen, 200 ms ease-out  
transitions or none at all. No bounce, no spring, no parallax.

---

## Install

```bash
npm install @cr8w/design-system
```

Registry config (add to `.npmrc`):

```
@cr8w:registry=https://registry.figma.com/npm/ce4a3132-d671-4eb3-86fc-c586bacd062c/registry/
//registry.figma.com/npm/ce4a3132-d671-4eb3-86fc-c586bacd062c/registry/:_authToken=${FIGMA_REGISTRY_TOKEN}
```

---

## CSS import

Add once at the app root — **never in individual components**:

```ts
import '@cr8w/design-system/styles.css';
```

This workspace already has this import in `src/app/App.tsx`.

---

## Tokens

All tokens are CSS custom properties on `:root`. Reference with `var()`. Never hardcode.

### Color

| Token | Value | Role |
|---|---|---|
| `--cw-brand-primary` | `#2F2A26` | Primary actions, headings |

### Spacing

| Token | Value | Role |
|---|---|---|
| `--cw-space-md` | `16px` | Default gap between related elements |

### Radius

| Token | Value | Role |
|---|---|---|
| `--cw-corner-md` | `8px` | Cards, buttons, inputs |

**Rules:**
- If you need a value with no token, use the closest existing `--cw-*` token
- Correct: `padding: var(--cw-space-md)`
- Wrong: `padding: 16px`

---

## Components

### `Button`

The only component in v0.0.2.

```ts
import { Button } from '@cr8w/design-system';
```

| Prop | Type | Values | Default |
|---|---|---|---|
| `variant` | string | `primary` \| `secondary` \| `ghost` | `primary` |

**Rules:**
- One `primary` Button per screen maximum
- Label must be a verb phrase ("Save changes", "Connect calendar")
- Never use a raw `<button>` element for a user-facing action — use `<Button>`
- Correct: `<Button variant="primary">Save changes</Button>`
- Wrong: `<button className="…">Save changes</button>`

**Current status:** `Button` returns `null` in `dist/index.js` (stub, v0.0.2).  
Implementation is in progress. Wire the import now so it activates without code changes  
when the next version ships.

---

## Core rules (from kit guidelines)

1. Always use `@cr8w/design-system` components over raw HTML elements
2. Never hardcode pixel values — use `--cw-*` spacing tokens
3. Never hardcode hex colors — use `--cw-*` color tokens
4. Do not use Figma Make defaults, shadcn, Material, Chakra, or Bootstrap for  
   anything the kit already covers

---

## Token reconciliation with workspace tokens

This workspace also uses a separate token layer in `src/styles/theme.css`  
(`--primary: #7BA89D`, `--secondary: #B8A9D4`, etc.). These are **parallel systems**:

| Layer | Prefix | File | Role |
|---|---|---|---|
| Workspace | `--primary`, `--secondary` … | `src/styles/theme.css` | Current dashboard components |
| Kit package | `--cw-brand-primary` … | `dist/index.css` (injected) | `@cr8w/design-system` components |

Use workspace tokens in `src/app/components/ui/` components.  
Use `--cw-*` tokens inside `@cr8w/design-system` components once they're implemented.  
Do not mix the two namespaces on the same element.

---

## Package exports

```json
{
  ".": "./dist/index.js",
  "./styles.css": "./dist/index.css"
}
```

Named imports only. Never import from deep paths like `@cr8w/design-system/dist/index.js`.
