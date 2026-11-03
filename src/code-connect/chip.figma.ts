// url=https://www.figma.com/design/6GpuVqt4LiguAOdOwcS8OT/Untitled?node-id=13-11
// Discovery verified 2026-11-03 (fileKey 6GpuVqt4LiguAOdOwcS8OT, component-set node). Library NOT published yet: not publishable until the library publish gate clears.
// Library published 2026-11-03 (this component included). Mapping publish still gated on Monny's YES + Secure Vault FIGMA_ACCESS_TOKEN.
// source=src/app/components/ui/badge.tsx
// component=Badge

import figma from 'figma'

const instance = figma.selectedInstance

const label = instance.getString('Label')

export default {
  example: figma.code`<Badge>${label}</Badge>`,
  imports: ['import { Badge } from "../components/ui/badge"'],
  id: 'cr8w-chip',
  metadata: {
    nestable: true,
  },
}
