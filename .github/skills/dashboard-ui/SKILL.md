---
name: dashboard-ui
description: 'Branded dashboard and client portal UI: This skill must be invoked for requests such as "build a dashboard component", "create a client portal", "design a dashboard card", or "make this portal mobile-friendly".'
---

# Branded dashboard and client portal components

1. Build with TypeScript and React, following the repository's existing component and styling patterns.
2. Use token-based theming for color, spacing, typography, borders, and state changes instead of hard-coded visual values.
3. Design mobile-first, then add layouts for larger viewports.
4. Verify accessible contrast, semantic structure, keyboard access, focus states, and useful labels.
5. Deliver the component file plus a concise usage snippet showing required props and realistic content.

## Example output

```tsx
// ClientStatusCard.tsx
export function ClientStatusCard({ name, status }: { name: string; status: string }) {
  return (
    <section aria-label={`${name} client status`} className="card card--status">
      <h2>{name}</h2>
      <p>{status}</p>
    </section>
  );
}
```

```tsx
<ClientStatusCard name="Maya Santos" status="Ready for review" />
```
