// url=https://www.figma.com/design/6GpuVqt4LiguAOdOwcS8OT/Untitled?node-id=13-6
// Discovery verified 2026-11-03 (fileKey 6GpuVqt4LiguAOdOwcS8OT, component-set node). Library NOT published yet: not publishable until the library publish gate clears.
// Button published 2026-11-03 after the layer-name fix (variant layers renamed "=primary" / "=secondary" to "Variant=Primary" / "Variant=Secondary"; republished, verified). Mapping publish still gated on Monny's YES + Secure Vault FIGMA_ACCESS_TOKEN.
// source=src/app/components/ui/button.tsx
// component=Button

import figma from 'figma'

const instance = figma.selectedInstance

const label = instance.getString('Label')

// Figma Button ships Primary / Secondary variants (design system build 2026-10-13).
// Code Button variants of record: default, destructive, outline, secondary, ghost, link.
const variant = instance.getEnum('Variant', {
  Primary: 'default',
  Secondary: 'secondary',
})

export default {
  example: figma.code`<Button variant={${variant}}>${label}</Button>`,
  imports: ['import { Button } from "../components/ui/button"'],
  id: 'cr8w-button',
  metadata: {
    nestable: true,
  },
}
