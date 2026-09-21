import React, { useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  Clock3,
  LockKeyhole,
  Mic2,
  Radio,
  Send,
  Sparkles,
  Video,
  Volume2,
} from "lucide-react";
import { useDashboard } from "../../contexts/DashboardContext";
import type { CoFlowDate } from "./api";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Switch } from "./ui/switch";

// ── Constants ──────────────────────────────────────────────────────────────────
const SUNSHINE = "#C25B38";
const UPCOMING = new Set<CoFlowDate["status"]>(["idea", "ready", "approved", "scheduled"]);
const ARCHIVED = new Set<CoFlowDate["status"]>(["happened", "wrapped", "cancelled"]);

const STATUS_LABELS: Record<CoFlowDate["status"], string> = {
  idea: "Idea", ready: "Ready", approved: "Approved", scheduled: "Scheduled",
  happened: "Happened", wrapped: "Wrapped", cancelled: "Cancelled",
};

const EVENT_TYPES = [
  "Podyap", "Open Studio", "Book Club", "Workshop",
  "Pop-Up", "Surprise-ment", "Geyser", "Internal",
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────────
function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function weekDays(anchor: Date) {
  const monday = getMonday(anchor);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      iso:     d.toISOString().slice(0, 10),
      short:   d.toLocaleDateString("en-US", { weekday: "short" }),
      num:     d.getDate(),
      isToday: d.toDateString() === anchor.toDateString(),
    };
  });
}

function displayDate(date?: string) {
  if (!date) return "Recording day to be named";
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" }).format(
    new Date(`${date}T12:00:00`),
  );
}

function nextFriday(): string {
  const d = new Date();
  const delta = (5 - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function pickNextFlow(flows: CoFlowDate[]): CoFlowDate | undefined {
  const today = new Date().toISOString().slice(0, 10);
  return flows
    .filter((f) => UPCOMING.has(f.status) && (!f.date || f.date >= today))
    .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"))[0];
}

function getRecoveryHours(flows: CoFlowDate[]): number | null {
  const now = Date.now();
  const MAX_MS = 72 * 60 * 60 * 1000;
  for (const f of flows) {
    if (f.date && ARCHIVED.has(f.status)) {
      const end = new Date(`${f.date}T22:00:00`).getTime();
      const elapsed = now - end;
      if (elapsed > 0 && elapsed < MAX_MS) {
        return Math.ceil((MAX_MS - elapsed) / (60 * 60 * 1000));
      }
    }
  }
  return null;
}

function syncTime(lastSynced: Date | null): string {
  if (!lastSynced) return "never";
  return lastSynced.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// ── Section 7: Sync Provenance Chip ───────────────────────────────────────────
function SyncProvenanceChip({ lastSynced, syncStatus }: { lastSynced: Date | null; syncStatus: string }) {
  const fresh = syncStatus === "fresh";
  const dotColor = fresh ? "var(--color-success, #437a22)" : "var(--color-warning, #964219)";
  return (
    <div className="flex items-center gap-1.5 self-start rounded-lg border border-border bg-card px-3 py-1.5 md:self-auto">
      <span className="size-2 shrink-0 rounded-full" style={{ background: dotColor }} aria-hidden="true" />
      <span className="font-['Blinker'] text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground">
        Synced from Notion FLOWS
      </span>
      <span className="hidden font-['Montserrat'] text-[11px] text-muted-foreground sm:inline">
        · {syncTime(lastSynced)}
      </span>
    </div>
  );
}

// ── Section 6: Recovery Lock Banner ───────────────────────────────────────────
function RecoveryLockBanner({ hours }: { hours: number }) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl border px-4 py-3"
      style={{ borderColor: "var(--color-warning, #964219)", background: "var(--color-warning-bg, rgba(150,66,25,0.08))" }}
    >
      <LockKeyhole
        className="mt-0.5 size-5 shrink-0"
        style={{ color: "var(--color-warning, #964219)" }}
        aria-hidden="true"
      />
      <p className="font-['Montserrat'] text-sm leading-5" style={{ color: "var(--color-warning, #964219)" }}>
        <span className="font-['Blinker'] font-bold uppercase tracking-[0.08em]">
          Space in Recovery Lock
        </span>
        {" — "}metrics unlock in {hours}h
      </p>
    </div>
  );
}

// ── Section 1: Weekly Rhythm Strip ────────────────────────────────────────────
function WeeklyRhythmStrip({ flows }: { flows: CoFlowDate[] }) {
  const days = useMemo(() => weekDays(new Date()), []);

  const flowByDate = useMemo(() => {
    const m: Record<string, CoFlowDate> = {};
    flows.forEach((f) => { if (f.date) m[f.date] = f; });
    return m;
  }, [flows]);

  return (
    <Card className="gap-0 overflow-hidden border-border shadow-none">
      <CardHeader className="gap-2 border-b border-border px-5 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-primary" aria-hidden="true" />
          <CardTitle className="font-['Blinker'] text-base font-semibold text-foreground">
            This week's rhythm
          </CardTitle>
        </div>
        <CardDescription className="font-['Montserrat'] text-xs leading-5">
          Seven beats that keep the room held without tightening it.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-7 gap-px bg-border p-px">
        {days.map(({ iso, short, num, isToday }) => {
          const flow = flowByDate[iso];
          const status = flow?.status;
          const isGathering = status && UPCOMING.has(status);
          const isArchived = status && ARCHIVED.has(status);

          return (
            <div
              key={iso}
              className="min-h-28 bg-card p-3"
              style={
                isGathering
                  ? { background: "rgba(194,91,56,0.07)", borderTop: `2px solid ${SUNSHINE}` }
                  : isToday
                  ? { background: "var(--muted)" }
                  : {}
              }
            >
              <div className="flex flex-col gap-0.5">
                <span
                  className="font-['Blinker'] text-[11px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: isGathering ? SUNSHINE : isToday ? "var(--foreground)" : "var(--muted-foreground)" }}
                >
                  {short}
                </span>
                <span
                  className="font-['Montserrat'] text-xs"
                  style={{ color: isGathering ? SUNSHINE : "var(--muted-foreground)" }}
                >
                  {num}
                </span>
              </div>
              {status && (
                <div className="mt-2">
                  {isGathering && (
                    <span
                      className="inline-block rounded px-1.5 py-0.5 font-['Blinker'] text-[10px] font-bold uppercase tracking-[0.08em]"
                      style={{ background: SUNSHINE, color: "#fff" }}
                    >
                      {STATUS_LABELS[status]}
                    </span>
                  )}
                  {isArchived && (
                    <span className="inline-block rounded bg-muted px-1.5 py-0.5 font-['Blinker'] text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                      {STATUS_LABELS[status]}
                    </span>
                  )}
                  {flow?.theme && (
                    <p className="mt-1 line-clamp-2 font-['Montserrat'] text-[10px] leading-4 text-muted-foreground">
                      {flow.theme}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function FlowCommandCenter() {
  const { data } = useDashboard();

  const [anonymous, setAnonymous]             = useState(false);
  const [dropped, setDropped]                 = useState(false);
  const [resonance, setResonance]             = useState<"mmm-hmm" | "unh-unh" | null>(null);
  const [resonanceCounts, setResonanceCounts] = useState({ "mmm-hmm": 0, "unh-unh": 0 });
  const [selectedType, setSelectedType]       = useState<typeof EVENT_TYPES[number]>("Podyap");

  const flow          = useMemo(() => pickNextFlow(data.coFlowDates), [data.coFlowDates]);
  const recordingDate = flow?.date || nextFriday();
  const topic         = flow?.theme || "How do we make room for the work before it has a name?";
  const recoveryHours = useMemo(() => getRecoveryHours(data.coFlowDates), [data.coFlowDates]);

  function castResonance(vote: "mmm-hmm" | "unh-unh") {
    if (resonance === vote) return;
    setResonanceCounts((prev) => ({
      ...prev,
      [vote]: prev[vote] + 1,
      ...(resonance ? { [resonance]: Math.max(0, prev[resonance as keyof typeof prev] - 1) } : {}),
    }));
    setResonance(vote);
  }

  return (
    <section className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">

      {/* Header + Section 7: Sync Provenance Chip (top-right, always visible) */}
      <div className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 font-['Blinker'] text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            <Sparkles className="size-4" aria-hidden="true" /> Flow room
          </div>
          <h1 className="font-['Fredoka'] text-3xl font-semibold leading-none tracking-[-0.02em] text-foreground sm:text-4xl">
            Weekly Production &amp; Flow Command Center
          </h1>
          <p className="max-w-2xl font-['Montserrat'] text-sm leading-6 text-muted-foreground">
            A calm operational rhythm for the Podyaps crew — flowing &gt; forcing.
          </p>
        </div>
        <SyncProvenanceChip lastSynced={data.lastSynced} syncStatus={data.syncStatus} />
      </div>

      {/* Section 6: Recovery Lock Banner (conditional — 0–72h post-gathering) */}
      {recoveryHours !== null && <RecoveryLockBanner hours={recoveryHours} />}

      {/* Section 1: Weekly Rhythm Strip */}
      <WeeklyRhythmStrip flows={data.coFlowDates} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="space-y-5">

          {/* Section 2: Topic Well & Question Bank */}
          <Card className="border-border shadow-none">
            <CardHeader className="px-5 py-5 sm:px-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="font-['Fredoka'] text-xl font-medium text-foreground">
                    The well
                  </CardTitle>
                  <CardDescription className="font-['Montserrat'] text-xs leading-5">
                    A question bank with room for the unnamed.
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="font-['Blinker'] text-[11px] uppercase tracking-[0.1em]">
                  {selectedType}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 px-5 pb-5 sm:px-6 sm:pb-6">

              {/* Topic category pills */}
              <div className="flex flex-wrap gap-2">
                {EVENT_TYPES.map((type) => (
                  <Button
                    key={type}
                    variant={selectedType === type ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedType(type)}
                    className="font-['Blinker'] text-xs"
                  >
                    {type}
                  </Button>
                ))}
              </div>

              {/* Drop it in */}
              <div className="rounded-lg border border-border bg-muted/45 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="font-['Blinker'] text-sm font-semibold text-foreground">
                      Drop something into the well
                    </p>
                    <p className="font-['Montserrat'] text-xs leading-5 text-muted-foreground">
                      {anonymous
                        ? "Anonymous: Monny sees the content only — no member identity shown anywhere in the stack."
                        : "Your name is visible to the gathering hosts."}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Switch checked={anonymous} onCheckedChange={setAnonymous} aria-label="Anonymous drop" />
                    <span className="font-['Blinker'] text-xs font-semibold uppercase tracking-[0.08em] text-foreground">
                      Anonymous
                    </span>
                  </div>
                </div>
                <Button
                  variant="default"
                  className="mt-4 w-full font-['Blinker'] uppercase tracking-[0.08em] sm:w-auto"
                  style={!dropped ? { background: SUNSHINE, color: "#fff", border: "none" } : {}}
                  onClick={() => setDropped(true)}
                >
                  <Send className="size-4" aria-hidden="true" />
                  {dropped ? "Dropped into the well" : "drop it in"}
                </Button>
              </div>

              {/* Flow Keeper Override banner */}
              <div className="rounded-lg border border-secondary/60 bg-secondary/15 p-4">
                <span className="font-['Blinker'] text-[11px] font-bold uppercase tracking-[0.13em] text-secondary-foreground">
                  Flow Keeper override
                </span>
                <p className="mt-1 font-['Montserrat'] text-sm leading-6 text-foreground">
                  Flow Keeper's gut overrode the vote. The topic is{" "}
                  <span className="font-semibold">{topic}</span>
                </p>
              </div>

              {/* Collective resonance with live counts */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <span className="font-['Blinker'] text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Collective resonance
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={resonance === "mmm-hmm" ? "default" : "outline"}
                    onClick={() => castResonance("mmm-hmm")}
                    className="font-['Blinker'] gap-1.5"
                  >
                    mmm-hmm
                    {resonanceCounts["mmm-hmm"] > 0 && (
                      <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[10px] leading-none">
                        {resonanceCounts["mmm-hmm"]}
                      </span>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant={resonance === "unh-unh" ? "secondary" : "outline"}
                    onClick={() => castResonance("unh-unh")}
                    className="font-['Blinker'] gap-1.5"
                  >
                    unh-unh
                    {resonanceCounts["unh-unh"] > 0 && (
                      <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[10px] leading-none">
                        {resonanceCounts["unh-unh"]}
                      </span>
                    )}
                  </Button>
                </div>
              </div>

              {/* Question Bank with depth indicators */}
              <Accordion type="single" collapsible className="border-t border-border">
                <AccordionItem value="questions">
                  <AccordionTrigger className="font-['Blinker'] text-sm font-semibold text-foreground hover:no-underline">
                    Community question bank
                  </AccordionTrigger>
                  <AccordionContent className="space-y-2">
                    {[
                      { depth: "Surface",  q: "What are you noticing in the room?" },
                      { depth: "Cultural", q: "Who does this ritual make space for?" },
                      { depth: "Somatic",  q: "What does enough feel like in your body?" },
                    ].map(({ depth, q }) => (
                      <div key={q} className="flex items-start gap-2 rounded-md bg-muted px-3 py-2">
                        <span className="mt-px shrink-0 font-['Blinker'] text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                          {depth}
                        </span>
                        <span className="font-['Montserrat'] text-xs leading-5 text-foreground">{q}</span>
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          {/* Section 5: Weeecording Timeline + Same-Day Decomprocessing */}
          <Card className="border-border shadow-none">
            <CardHeader className="px-5 py-5 sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="font-['Fredoka'] text-xl font-medium text-foreground">
                    The Weeecording
                  </CardTitle>
                  <CardDescription className="mt-1 font-['Montserrat'] text-xs">
                    {displayDate(recordingDate)} · {flow?.timeRange || "Time to be named"}
                  </CardDescription>
                </div>
                <Badge className="font-['Blinker'] text-[11px] uppercase tracking-[0.1em]">
                  Locked topic
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 px-5 pb-5 sm:px-6 sm:pb-6">
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { time: "00:00", label: "Arrive",        detail: "Room tone, settle in." },
                  { time: "25:00", label: "Breath marker", detail: "DJI cutaway — dialogue keeps flowing, uninterrupted." },
                  { time: "50:00", label: "Benediction",   detail: "Close with what wants to travel." },
                ].map(({ time, label, detail }, i) => (
                  <div
                    key={time}
                    className="rounded-lg border p-4"
                    style={i === 1
                      ? { borderColor: SUNSHINE, background: "rgba(194,91,56,0.07)" }
                      : { borderColor: "var(--border)" }}
                  >
                    <span
                      className="font-['Blinker'] text-xs font-bold tracking-[0.1em]"
                      style={{ color: i === 1 ? SUNSHINE : "var(--primary)" }}
                    >
                      {time}
                    </span>
                    <p className="mt-2 font-['Blinker'] text-sm font-semibold text-foreground">{label}</p>
                    <p className="mt-1 font-['Montserrat'] text-xs leading-5 text-muted-foreground">{detail}</p>
                  </div>
                ))}
              </div>

              {/* Same-Day Decomprocessing */}
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex gap-3">
                  <Clock3 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <p className="font-['Blinker'] text-sm font-semibold text-foreground">Decomprocessing</p>
                    <p className="mt-1 font-['Montserrat'] text-xs leading-5 text-muted-foreground">
                      30 minutes, same day, Flow Keeper leads: "what flowed, what flooded" — feeds next Monday's pooling.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <aside className="space-y-5">

          {/* Section 3: Rotating Roles Card */}
          <Card className="border-border shadow-none">
            <CardHeader className="px-5 py-5 sm:px-6">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="font-['Fredoka'] text-xl font-medium text-foreground">
                    Episode roles
                  </CardTitle>
                  <CardDescription className="mt-1 font-['Montserrat'] text-xs">
                    Rotating holds — not static job titles.
                  </CardDescription>
                </div>
                <Badge className="shrink-0 font-['Blinker'] text-[11px] uppercase tracking-[0.1em]">
                  Locked topic
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">
              {[
                { role: "Flow Keeper", person: flow?.host || "Monny" },
                { role: "Closer",      person: "Sunshine" },
                { role: "Benediction", person: "Bingle" },
                { role: "Tech Anchor", person: "Omar" },
              ].map(({ role, person }) => (
                <div
                  key={role}
                  className="flex items-center justify-between border-b border-border py-3 last:border-0"
                >
                  <span className="font-['Blinker'] text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    {role}
                  </span>
                  <span className="font-['Montserrat'] text-sm font-medium text-foreground">{person}</span>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-2 pt-3">
                <span className="font-['Blinker'] text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Recording
                </span>
                <span className="rounded-md bg-muted px-2 py-0.5 font-['Montserrat'] text-xs text-foreground">
                  {displayDate(recordingDate)} · {flow?.timeRange || "TBD"}
                </span>
                <span
                  className="rounded-md px-2 py-0.5 font-['Blinker'] text-[11px] font-bold uppercase tracking-[0.08em]"
                  style={{ background: "rgba(194,91,56,0.1)", color: SUNSHINE }}
                >
                  Omar's Gear
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Section 4: Live Gear Card */}
          <Card className="border-border shadow-none">
            <CardHeader className="px-5 py-5 sm:px-6">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="font-['Fredoka'] text-xl font-medium text-foreground">
                  Live gear
                </CardTitle>
                <Badge variant="outline" className="font-['Blinker'] text-[11px] uppercase tracking-[0.1em]">
                  <Check className="mr-1 size-3" aria-hidden="true" /> Omar ready
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 px-5 pb-5 sm:px-6 sm:pb-6">
              {[
                { Icon: Volume2, label: "Rodecaster Pro", detail: "Noise Gate OFF · Compressor ON · Limiter ON −3 dB" },
                { Icon: Mic2,    label: "Mics",           detail: "Boom stands + pop filters · calibrated −16 dB to −12 dB" },
                { Icon: Video,   label: "DJI Osmo",       detail: "Synced · battery 100% · backup audio rolling" },
              ].map(({ Icon, label, detail }) => (
                <div key={label} className="flex gap-3 rounded-lg bg-muted/55 p-3">
                  <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <p className="font-['Blinker'] text-sm font-semibold text-foreground">{label}</p>
                    <p className="mt-0.5 font-['Montserrat'] text-xs leading-5 text-muted-foreground">{detail}</p>
                  </div>
                </div>
              ))}
              <div className="rounded-lg border border-secondary/60 bg-secondary/15 p-3">
                <p className="font-['Blinker'] text-xs font-bold uppercase tracking-[0.1em] text-secondary-foreground">
                  Omar's shortcut of the week
                </p>
                <p className="mt-1 font-['Montserrat'] text-xs leading-5 text-foreground">
                  Clap once on every camera after rolling — the edit finds the sync point fast.
                </p>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Data source provenance */}
      <div className="flex items-center gap-2 border-t border-border pt-3 font-['Blinker'] text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        <Radio className="size-3 text-primary" aria-hidden="true" />
        Data source · cr8w_coflow_dates · GET /api/server/sync · useDashboard().data.coFlowDates
      </div>
    </section>
  );
}
