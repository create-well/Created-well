# CR8W Create Well — Make Kit

This is the authoring workspace for the CR8W Create Well design system kit.  
Components live in `src/app/components/ui/`. Barrel export is `src/index.ts`.

## Required reading order

1. **[setup.md](./setup.md)** — CSS imports, font wiring, Tailwind 4 config
2. **[overview.md](./overview.md)** — brand character, design philosophy, density
3. **[tokens.md](./tokens.md)** — all color, radius, and typography tokens
4. **[components.md](./components.md)** — full component catalog (44 components)
5. **[icons.md](./icons.md)** — icon system rules

## MUST READ before writing any code

- `setup.md` — ensures fonts and tokens are wired before anything renders
- `tokens.md` — no raw hex anywhere; always use CSS custom property names
- `components.md` — scan the catalog before reaching for raw HTML

## Kit import paths (within this workspace)

```ts
import { Button } from "@/app/components/ui/button";
import { Card, CardHeader, CardContent } from "@/app/components/ui/card";
import { cn } from "@/app/components/ui/utils";
```

All components are also barrel-exported from `src/index.ts`.

## Brand identity at a glance

| | |
|---|---|
| Primary | Sage green `#7BA89D` |
| Secondary | Lavender `#B8A9D4` |
| Accent/CTA | Brand orange `#C25B38` |
| Dark base | Deep purple `#2D2438` |
| Radius | `0.625rem` (10 px) |
| Display font | Fredoka (300–700) |
| UI font | Blinker (300–900) |
| Body font | Montserrat (300–700, italic) |
