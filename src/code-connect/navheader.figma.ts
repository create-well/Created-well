// url=https://www.figma.com/design/6GpuVqt4LiguAOdOwcS8OT/Untitled?node-id=14-14
// Discovery verified 2026-11-03 (fileKey 6GpuVqt4LiguAOdOwcS8OT, component-set node). Library NOT published yet: not publishable until the library publish gate clears.
// Library published 2026-11-03 (this component included). Mapping publish still gated on Monny's YES + Secure Vault FIGMA_ACCESS_TOKEN.
// source=src/app/components/TopNav.tsx
// component=TopNav

import figma from 'figma'

// TopNav reads its state from the dashboard context (useDashboard) and router;
// its only prop is the optional onSignOut handler. The design component is static
// chrome (per the 2026-10-13 Notion data map: NavHeader ← static), so the snippet
// is the bare component.
export default {
  example: figma.code`<TopNav />`,
  imports: ['import { TopNav } from "../components/TopNav"'],
  id: 'cr8w-navheader',
  metadata: {
    nestable: false,
  },
}
