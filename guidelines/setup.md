# Setup

## 1. CSS imports

Add both files to your project's entry stylesheet (or `main.tsx`):

```css
/* fonts.css — Google Fonts import */
@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@300;400;500;600;700&family=Blinker:wght@300;400;600;700;900&family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500&display=swap');
```

```css
/* theme.css — all CSS custom properties and @theme inline block */
/* Must be imported before any Tailwind utilities */
```

In `src/styles/index.css` (or your Tailwind entry):

```css
@import "tailwindcss";
@import "./fonts.css";
@import "./theme.css";

@source "../app/**/*.{ts,tsx}";
```

## 2. Tailwind 4 configuration

This kit targets **Tailwind CSS v4**. No `tailwind.config.js` is required.  
Token-to-utility mapping is handled by the `@theme inline` block in `theme.css`.  
Add `@source` rules pointing at any additional directories your project uses.

## 3. Font stack

Apply fonts via Tailwind utilities or CSS variables:

```css
font-family: 'Fredoka', sans-serif;    /* display headings */
font-family: 'Blinker', sans-serif;    /* UI labels, nav items, buttons */
font-family: 'Montserrat', sans-serif; /* body text, captions */
```

No custom font-face declarations are needed — fonts are served from Google Fonts.

## 4. Required utilities

```bash
pnpm add class-variance-authority clsx tailwind-merge
pnpm add @radix-ui/react-slot
pnpm add lucide-react
```

All Radix UI primitives used by this kit are already listed in `package.json`.  
The `cn()` utility is exported from `src/app/components/ui/utils.ts`.

## 5. Verify

After setup, confirm:
- `bg-background` renders white (`#ffffff`)
- `text-primary` renders sage green (`#7BA89D`)
- `rounded-lg` produces `0.625rem` corners
- Fredoka loads in display headings
