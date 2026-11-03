// url=https://www.figma.com/design/6GpuVqt4LiguAOdOwcS8OT/Untitled?node-id=13-7
// Discovery verified 2026-11-03 (fileKey 6GpuVqt4LiguAOdOwcS8OT, component-set node). Library NOT published yet: not publishable until the library publish gate clears.
// Library published 2026-11-03 (this component included). Mapping publish still gated on Monny's YES + Secure Vault FIGMA_ACCESS_TOKEN.
// source=src/app/components/ui/card.tsx
// component=Card

import figma from 'figma'

const instance = figma.selectedInstance

const title = instance.getString('Title')
const content = instance.getSlot('Content')

export default {
  example: figma.code`<Card>
  <CardHeader>
    <CardTitle>${title}</CardTitle>
  </CardHeader>
  <CardContent>${content}</CardContent>
</Card>`,
  imports: [
    'import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"',
  ],
  id: 'cr8w-card',
  metadata: {
    nestable: true,
  },
}
