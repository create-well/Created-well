// url=https://www.figma.com/design/6GpuVqt4LiguAOdOwcS8OT/Untitled?node-id=14-2
// Discovery verified 2026-11-03 (fileKey 6GpuVqt4LiguAOdOwcS8OT, component-set node). Library NOT published yet: not publishable until the library publish gate clears.
// Library published 2026-11-03 (this component included; mapping stays provisional, composition not 1:1 code). Mapping publish still gated on Monny's YES + Secure Vault FIGMA_ACCESS_TOKEN.
// source=src/app/components/HomePanels.tsx
// component=EventCard (composition — no 1:1 code component exists)

// HONESTY NOTE (registry of record, templates/registry.json): there is no
// EventCard component in the repo. Event cards render inside HomePanels /
// CommunityEventsView from the CMS gatherings payload (title, start, rsvp_url).
// This template documents the composition an agent should reproduce; its
// registry status stays provisional until a real card component is extracted.

import figma from 'figma'

const instance = figma.selectedInstance

const title = instance.getString('Title')

export default {
  example: figma.code`<Card>
  <CardHeader>
    <CardTitle>${title}</CardTitle>
  </CardHeader>
  <CardContent>
    {/* date, location and capacity render from the gatherings payload */}
    <Button asChild>
      <a href={event.rsvp_url}>RSVP</a>
    </Button>
  </CardContent>
</Card>`,
  imports: [
    'import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"',
    'import { Button } from "../components/ui/button"',
  ],
  id: 'cr8w-eventcard',
  metadata: {
    nestable: true,
  },
}
