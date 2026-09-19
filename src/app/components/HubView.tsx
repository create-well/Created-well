import React, { useState, useEffect, useRef } from 'react';
import cwLogoImg from 'figma:asset/26b5a4fd9027610adb3ddb9ed89749cb683707dd.png';
import { showToast } from './Toast';
import {
  CALENDAR_EVENTS, PERSONS, getDaysToLaunch, formatTimestamp, capitalize,
  GCAL_CLIENT_ID,
  type BrainDump, type Announcement
} from './data';
import { MBodyWidget } from './MBodyWidget';
import { NotesFromTheWell } from './NotesFromTheWell';
import { ArriveState, shouldShowArriveState } from './ArriveState';
import type { Task, Station, WellNote, Workshop, CoFlowDate, CoFlowCheckin, InviteCounts, CalendarEventKV } from './api';
import * as api from './api';

// ── Wellshop category → workshop tag matching ────────────────────────────────
const WELLSHOP_TAG_MAP: Record<string, string[]> = {
  wellshop: ['wellshop', 'reflection', 'grounding', 'journaling', 'inner', 'nurture', 'decomprocess'],
  expresshop: ['expresshop', 'expression', 'sharing', 'presenting', 'pitching', 'storytelling', 'outer'],
  playshop: ['playshop', 'play', 'creative', 'show-and-tell', 'experiment', 'fun'],
};

function matchesCategory(workshop: Workshop, categoryKey: string): boolean {
  const keywords = WELLSHOP_TAG_MAP[categoryKey] || [];
  const titleLower = workshop.title.toLowerCase();
  const descLower = workshop.description.toLowerCase();
  const tagSet = (workshop.tags || []).map(t => t.toLowerCase());
  return keywords.some(kw =>
    tagSet.includes(kw) || titleLower.includes(kw) || descLower.includes(kw)
  );
}

interface HubViewProps {
  onNavigate: (view: string) => void;
  onNavigateGeyserStations: () => void;
  announcements: Announcement[];
  brainDumps: BrainDump[];
  onAddBrainDump: (dump: Omit<BrainDump, 'id' | 'created_at'>) => void;
  onDeleteBrainDump: (id: number) => void;
  syncTime: string;
  activeUser?: string;
  wellNotes: WellNote[];
  onAddWellNote: (content: string) => void;
  onLandWellNote: (id: number) => void;
  workshops?: Workshop[];
  coFlowDates?: CoFlowDate[];
  coFlowCheckins?: CoFlowCheckin[];
  actionItems?: Task[];
  stations?: Station[];
}

// ── Brand logo SVGs ──────────────────────────────────────────────────────────

function LogoCW({ size = 28 }: { size?: number }) {
  return (
    <img
      src={cwLogoImg}
      alt="CW"
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
    />
  );
}

function LogoGoogleDrive({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
      <path d="M43.65 25L29.9 0c-1.35.8-2.5 1.9-3.3 3.3L1.2 48.5c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
      <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75L86.1 57c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 11.5z" fill="#ea4335"/>
      <path d="M43.65 25L57.4 0H29.9z" fill="#00832d"/>
      <path d="M59.8 53H87.3l-13.75-23.8L59.8 53z" fill="#2684fc"/>
      <path d="M27.5 53l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h51.8c1.6 0 3.15-.45 4.5-1.2L59.8 53H27.5z" fill="#ffba00"/>
    </svg>
  );
}

function LogoNotion({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="18" fill="#fff"/>
      <path d="M21.4 20.9c3.3 2.7 4.5 2.5 10.7 2.1l58.1-3.5c1.2 0 .2-1.2-.4-1.4l-9.9-7.1c-1.9-1.4-4.4-3-9.3-2.6L14.5 12c-2 .2-2.4 1.2-1.6 2z" fill="#e8e3da"/>
      <path d="M24.4 31.4v55.7c0 3 1.5 4.1 4.9 3.9l63.9-3.7c3.4-.2 4.2-2.3 4.2-4.9V27.2c0-2.6-1-4-3.3-3.7l-66.4 4c-2.5.1-3.3 1.4-3.3 3.9z" fill="#fffef9"/>
      <path d="M68.8 30.6l-30.4 1.8c-1.5.1-2 1-2 2.1v38.4c0 1.2.6 1.8 1.9 1.6l32.4-1.9c1.3-.1 1.9-1 1.9-2.1V32.5c0-1.1-.5-2-3.8-1.9z" fill="#e8e3da"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M38.1 37.6c-.9.5-.9 1.7-.3 2.2l20 13.7v27.6c0 1.3 1 1.8 1.8 1.2l9.5-5.7c.8-.5 1.2-1.5 1.2-2.5V46.9L52.7 34.4c-1.2-.9-2.9-.8-4 .2l-10.6 3z" fill="#1d1c1d"/>
    </svg>
  );
}

function LogoGmail({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 75 75" xmlns="http://www.w3.org/2000/svg">
      <rect width="75" height="75" rx="14" fill="#fff"/>
      <path d="M10 22l27.5 18L65 22" stroke="#EA4335" strokeWidth="2" fill="none"/>
      <path d="M10 22v31h55V22L37.5 40z" fill="#fff" stroke="#ccc" strokeWidth="1"/>
      <path d="M10 22l27.5 18L65 22V18c0-2.2-1.8-4-4-4H14c-2.2 0-4 1.8-4 4v4z" fill="#EA4335"/>
      <path d="M10 53V22l0 0v31c0 2.2 1.8 4 4 4h5V26L10 22z" fill="#C5221F"/>
      <path d="M65 22v31c0 2.2-1.8 4-4 4h-5V26l9-4z" fill="#C5221F"/>
      <path d="M19 26v31h37V26L37.5 40z" fill="#FFFFFF"/>
    </svg>
  );
}

function LogoGCal({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 75 75" xmlns="http://www.w3.org/2000/svg">
      <rect width="75" height="75" rx="14" fill="#fff"/>
      <rect x="10" y="18" width="55" height="47" rx="4" fill="#fff" stroke="#E0E0E0" strokeWidth="1.5"/>
      <rect x="10" y="18" width="55" height="18" rx="4" fill="#1A73E8"/>
      <rect x="10" y="30" width="55" height="6" fill="#1A73E8"/>
      <text x="37.5" y="28" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700" fontFamily="sans-serif">CAL</text>
      <line x1="10" y1="44" x2="65" y2="44" stroke="#E0E0E0" strokeWidth="1"/>
      <line x1="10" y1="54" x2="65" y2="54" stroke="#E0E0E0" strokeWidth="1"/>
      <line x1="27" y1="36" x2="27" y2="65" stroke="#E0E0E0" strokeWidth="1"/>
      <line x1="44" y1="36" x2="44" y2="65" stroke="#E0E0E0" strokeWidth="1"/>
      <rect x="36" y="46" width="8" height="7" rx="1" fill="#EA4335" opacity="0.9"/>
      <text x="13" y="52" fill="#555" fontSize="6" fontFamily="sans-serif">S</text>
      <text x="20" y="52" fill="#555" fontSize="6" fontFamily="sans-serif">M</text>
    </svg>
  );
}

// ── Tool data ────────────────────────────────────────────────────────────────

const WORKSPACE_TOOLS = [
  { id: 'gmail',    label: 'Gmail',            Logo: LogoGmail,       href: 'https://mail.google.com' },
  { id: 'gcal',     label: 'Google Calendar',  Logo: LogoGCal,        href: 'https://calendar.google.com/calendar/u/0/r' },
  { id: 'drive',    label: 'CW Drive',         Logo: LogoGoogleDrive, href: 'https://drive.google.com/drive/folders/1d9OyYZusS0yyYsfwtjLkz1ss0KYPzl5a' },
];

// ── Shared Team Calendar embed URL ──────────────────────────────────────────
const TEAM_CALENDAR_EMBED = 'https://calendar.google.com/calendar/embed?height=400&wkst=1&ctz=America%2FLos_Angeles&src=ODUyODMxYTc1MDhkYWZjMmUwYjNhYjcyOGZkYzczMWU3YmQ0NWI1NjhiNGFiOGIwZmQ3NjU3YTVlNTc3MTkzNEBncm91cC5jYWxlbmRhci5nb29nbGUuY29t&color=%23f4be40';

// ── Synergy data ─────────────────────────────────────────────────────────────

const SYNERGY_SECTIONS_DATA: { id: string; icon: string; title: string; content: React.ReactNode }[] = [
  {
    id: 'energy',
    icon: '\u26A1',
    title: 'Energy Flow & Task Delegation',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
          How energy types translate into practical task routing:
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ background: 'rgba(196,164,132,0.08)', border: '1px solid rgba(196,164,132,0.15)', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.68rem', fontWeight: 700, color: '#C4A484', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
              {'\u2600\uFE0F'} Sunshine & {'\uD83C\uDF0A'} Monny — ManiGen + Generator
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <strong>Execution, building, iterating.</strong> These two generate the life force energy. Route hands-on tasks, production work, content creation, vendor follow-ups, and build sprints their way. They thrive when they're <em>doing</em>.
            </div>
          </div>
          <div style={{ background: 'rgba(168,152,136,0.08)', border: '1px solid rgba(168,152,136,0.15)', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.68rem', fontWeight: 700, color: '#A89888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
              {'\u2728'} Bingle — Projector
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <strong>Strategic direction, client-facing guidance, team alignment.</strong> Bingle sees the big picture and guides where energy goes. Route high-level decisions, client strategy, and team coordination here.
            </div>
          </div>
        </div>
        <div style={{ background: 'rgba(255,159,10,0.08)', border: '1px solid rgba(255,159,10,0.18)', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.9rem' }}>{'\u26A0\uFE0F'}</span>
          <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', color: '#FF9F0A', fontWeight: 600, lineHeight: 1.5 }}>
            Projector Protocol: Bingle must be <em>invited</em> before leading. Don't assign Bingle to direct a workstream uninvited — ask first, then watch the magic.
          </span>
        </div>
      </div>
    ),
  },
  {
    id: 'decisions',
    icon: '\uD83C\uDF0A',
    title: 'Decision-Making Protocols',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
          For big pivots, new partnerships, or major creative direction shifts:
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          {[
            { emoji: '\u2600\uFE0F', name: 'Sunshine', color: '#C4A484', rule: '72-hour emotional wave', detail: 'Must sleep on it. No pressure for instant answers. The clarity comes after the wave passes.' },
            { emoji: '\uD83C\uDF0A', name: 'Monny', color: '#8BA5B5', rule: 'Sacral yes/no check', detail: 'Gut response only. If the body says "uh-huh" it\'s a yes. If it\'s "unh-unh" or silence, it\'s a no. No rationalizing past a sacral no.' },
            { emoji: '\u2728', name: 'Bingle', color: '#A89888', rule: 'Ego/willpower filter', detail: '"Does this serve the collective? Do I have the energy and will for this?" Bingle\'s conviction is the green light.' },
          ].map(p => (
            <div key={p.name} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 12px', background: `${p.color}0A`, borderRadius: 8, borderLeft: `3px solid ${p.color}` }}>
              <span style={{ fontSize: '0.85rem', flexShrink: 0, marginTop: 2 }}>{p.emoji}</span>
              <div>
                <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.68rem', fontWeight: 700, color: p.color, marginBottom: 2 }}>{p.name} — {p.rule}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{p.detail}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.18)', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.9rem' }}>{'\uD83D\uDED1'}</span>
          <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', color: '#FF453A', fontWeight: 600, lineHeight: 1.5 }}>
            Hard Rule: No major collective decisions in under 24 hours. Sleep on it. Always.
          </span>
        </div>
      </div>
    ),
  },
  {
    id: 'communication',
    icon: '\uD83D\uDCAC',
    title: 'Communication & Conflict Style',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          {[
            { emoji: '\u2600\uFE0F', name: 'Sunshine', color: '#C4A484', style: 'Processes externally', detail: 'Needs to talk it out. Thinking happens through conversation. Give Sunshine space to verbalize without treating it as a final decision.' },
            { emoji: '\uD83C\uDF0A', name: 'Monny', color: '#8BA5B5', style: 'Processes internally first', detail: 'Sacral check before verbal. Monny needs a moment to feel the gut response before sharing. Don\'t push for an immediate verbal answer.' },
            { emoji: '\u2728', name: 'Bingle', color: '#A89888', style: 'Observes patterns before speaking', detail: 'Waits for the invitation. Bingle sees the dynamics clearly but needs to be asked. Create space: "Bingle, what are you seeing here?"' },
          ].map(p => (
            <div key={p.name} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 12px', background: `${p.color}0A`, borderRadius: 8, borderLeft: `3px solid ${p.color}` }}>
              <span style={{ fontSize: '0.85rem', flexShrink: 0, marginTop: 2 }}>{p.emoji}</span>
              <div>
                <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.68rem', fontWeight: 700, color: p.color, marginBottom: 2 }}>{p.name} — {p.style}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{p.detail}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ background: 'rgba(48,209,88,0.08)', border: '1px solid rgba(48,209,88,0.18)', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.9rem' }}>{'\uD83E\uDD32'}</span>
          <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', color: '#30D158', fontWeight: 600, lineHeight: 1.5 }}>
            When tension arises: Pause. Each person processes individually first. Revisit together only after everyone has had space to check in with their own authority.
          </span>
        </div>
      </div>
    ),
  },
  {
    id: 'strengths',
    icon: '\uD83D\uDD2E',
    title: 'Creative Strengths & Blind Spots',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ background: 'rgba(196,164,132,0.08)', border: '1px solid rgba(196,164,132,0.15)', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.68rem', fontWeight: 700, color: '#C4A484', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
              {'\u2600\uFE0F'} + {'\uD83C\uDF0A'} Sunshine & Monny — 5/1 Heretic-Investigators
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <strong>Strength:</strong> Deep research and practical problem-solving. They dig into details, test assumptions, and build real solutions from the ground up. Together they're an unstoppable execution engine.
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 4, fontStyle: 'italic' }}>
              Watch for: May over-investigate before acting. Set time-boxes on research phases to keep momentum.
            </div>
          </div>
          <div style={{ background: 'rgba(168,152,136,0.08)', border: '1px solid rgba(168,152,136,0.15)', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.68rem', fontWeight: 700, color: '#A89888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
              {'\u2728'} Bingle — 2/4 Hermit-Opportunist
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <strong>Strength:</strong> Natural talent and network activation. Bingle operates on instinct and draws the right people in at the right time. Connections happen effortlessly.
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 4, fontStyle: 'italic' }}>
              Watch for: Needs alone time to recharge. Don't over-schedule Bingle's social bandwidth — the hermit needs the cave.
            </div>
          </div>
        </div>
        <div style={{ background: 'rgba(255,214,10,0.08)', border: '1px solid rgba(255,214,10,0.18)', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ fontSize: '0.9rem', marginTop: 2 }}>{'\uD83D\uDCA1'}</span>
          <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', color: '#FFD60A', fontWeight: 600, lineHeight: 1.5 }}>
            Collective Blind Spot: All three may avoid confrontation. Build in structured feedback rituals — monthly "real talk" check-ins where honesty is the norm, not the exception.
          </span>
        </div>
      </div>
    ),
  },
  {
    id: 'alignment',
    icon: '\uD83C\uDFAF',
    title: 'Weekly Alignment Check-In',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
          At each weekly sync, every co-creator answers their signature question:
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          {[
            { emoji: '\u2600\uFE0F', name: 'Sunshine', color: '#C4A484', question: 'Am I feeling satisfaction + peace?', detail: 'ManiGen signature: satisfaction from doing, peace from emotional clarity. Both must be present.' },
            { emoji: '\uD83C\uDF0A', name: 'Monny', color: '#8BA5B5', question: 'Am I feeling deep satisfaction?', detail: 'Generator signature: that full-body "this is right" feeling. Not just busy, but fulfilled.' },
            { emoji: '\u2728', name: 'Bingle', color: '#A89888', question: 'Am I feeling recognized success?', detail: 'Projector signature: being seen, valued, and invited into the right role. Success through recognition.' },
          ].map(p => (
            <div key={p.name} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 14px', background: `${p.color}0A`, borderRadius: 10, borderLeft: `3px solid ${p.color}` }}>
              <span style={{ fontSize: '0.85rem', flexShrink: 0, marginTop: 2 }}>{p.emoji}</span>
              <div>
                <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 700, color: p.color, marginBottom: 3 }}>{p.name}: "{p.question}"</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{p.detail}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ background: 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.08)', border: '1px solid rgba(var(--cr8w-primary-rgb, 123,168,157),0.18)', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.9rem' }}>{'\uD83D\uDEA9'}</span>
          <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', color: 'var(--cr8w-primary, #7BA89D)', fontWeight: 600, lineHeight: 1.5 }}>
            If any answer is "no" — flag it immediately at the next sync. Don't push through misalignment. Recalibrate before continuing.
          </span>
        </div>
      </div>
    ),
  },
  {
    id: 'metrics',
    icon: '\uD83D\uDCCA',
    title: 'Synergy Metrics',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
          Track these to make synergy visible and measurable:
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          {[
            { icon: '\uD83C\uDFB5', label: 'Projects completed on rhythm', detail: 'Not rushed, not dragged. Delivered at the pace that honored all three decision timelines.', color: '#30D158' },
            { icon: '\uD83D\uDC8C', label: 'Invitations extended to Bingle', detail: 'Before major decisions or direction changes — was Bingle asked first?', color: '#A89888' },
            { icon: '\uD83C\uDF0A', label: 'Emotional wave windows honored', detail: 'Did Sunshine get the full 72 hours before committing to big calls?', color: '#C4A484' },
            { icon: '\uD83E\uDDE0', label: 'Sacral responses logged', detail: 'Is Monny checking gut responses before saying yes? Are we tracking when sacral says no?', color: '#8BA5B5' },
          ].map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '0.85rem', flexShrink: 0, marginTop: 2 }}>{m.icon}</span>
              <div>
                <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.68rem', fontWeight: 700, color: m.color, marginBottom: 2 }}>{m.label}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{m.detail}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '4px 0', fontFamily: 'var(--font-body)' }}>
          Review monthly at behind h0es doors. What's working? What needs recalibrating?
        </div>
      </div>
    ),
  },
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function HubView({ onNavigate, onNavigateGeyserStations, announcements, brainDumps, onAddBrainDump, onDeleteBrainDump, syncTime, activeUser, wellNotes, onAddWellNote, onLandWellNote, workshops = [], coFlowDates = [], coFlowCheckins = [], actionItems = [], stations = [] }: HubViewProps) {
  const [showSynergy, setShowSynergy] = useState(false);
  const [openSynergySections, setOpenSynergySections] = useState<Set<string>>(new Set());
  const [showAllDumps, setShowAllDumps] = useState(false);
  const [dumpAuthor, setDumpAuthor] = useState('monny');
  const [dumpContent, setDumpContent] = useState('');
  const [dumpTags, setDumpTags] = useState('');
  const [dumpFilter, setDumpFilter] = useState('all');
  const [dumpTag, setDumpTag] = useState<string | null>(null);

  // ── Brain Dump: localStorage-backed state for playground sends, archives, timer resets ──
  const [sentToPlayground, setSentToPlayground] = useState<Set<number>>(() => {
    try { const r = localStorage.getItem('cr8w_dump_sent_pg'); return r ? new Set(JSON.parse(r)) : new Set(); } catch { return new Set(); }
  });
  const [archivedDumps, setArchivedDumps] = useState<Set<number>>(() => {
    try { const r = localStorage.getItem('dump_archive'); return r ? new Set(JSON.parse(r)) : new Set(); } catch { return new Set(); }
  });
  const [resetTimestamps, setResetTimestamps] = useState<Record<number, string>>(() => {
    try { const r = localStorage.getItem('cr8w_dump_reset_ts'); return r ? JSON.parse(r) : {}; } catch { return {}; }
  });
  const [linkCopied, setLinkCopied] = useState(false);
  const [showArriveCard, setShowArriveCard] = useState(() => shouldShowArriveState());

  // Invite counts from Google Sheet (via KV)
  const [inviteCounts, setInviteCounts] = useState<InviteCounts>({ confirmed: 0, pending: 0, declined: 0, maybe: 0, total: 0 });
  const [inviteLoaded, setInviteLoaded] = useState(false);
  useEffect(() => {
    api.getInviteCounts()
      .then(data => { setInviteCounts(data); setInviteLoaded(true); })
      .catch(e => { if (!(e instanceof TypeError)) console.error(e); setInviteLoaded(true); });
  }, []);

  // Calendar events from KV (synced from shared Google Calendar)
  const [kvCalEvents, setKvCalEvents] = useState<CalendarEventKV[]>([]);
  const [kvCalLoaded, setKvCalLoaded] = useState(false);
  const [icalSyncing, setIcalSyncing] = useState(false);
  const [icalSyncMsg, setIcalSyncMsg] = useState('');
  useEffect(() => {
    api.getCalendarEvents()
      .then(data => { setKvCalEvents(data || []); setKvCalLoaded(true); })
      .catch(e => { if (!(e instanceof TypeError)) console.error(e); setKvCalLoaded(true); });
  }, []);

  async function syncIcalCalendar() {
    setIcalSyncing(true);
    setIcalSyncMsg('');
    try {
      const apiBase = (import.meta.env.VITE_API_BASE as string | undefined)
        ?? (() => {
          const h = window.location.hostname;
          return (h.endsWith('.vercel.app') || h === 'createwell.monnyfest.co' || h === 'localhost')
            ? '/api/server' : 'https://cr8w-home-v2.vercel.app/api/server';
        })();
      const res = await fetch(`${apiBase}/calendar-ical-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer sb_publishable_9iKcrLqFPwPnKmZ4JC3RIg_C15YWSbk` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Sync failed');
      setIcalSyncMsg(`Synced ${data.count} event${data.count !== 1 ? 's' : ''} ✓`);
      // Re-fetch calendar events to refresh the list
      const updated = await api.getCalendarEvents();
      setKvCalEvents(updated || []);
    } catch (e: any) {
      setIcalSyncMsg(`Sync error: ${e?.message ?? e}`);
    }
    setIcalSyncing(false);
    setTimeout(() => setIcalSyncMsg(''), 4000);
  }

  const [calendarTab, setCalendarTab] = useState<'calendar' | 'wellshop'>('calendar');
  const [notifyTick, setNotifyTick] = useState(0);
  const [expandedWellshopCategory, setExpandedWellshopCategory] = useState<string | null>(null);
  const [expandedEventIdx, setExpandedEventIdx] = useState<number | null>(null);

  // ── Wellshop enhanced state ──
  interface WellshopHistoryEntry { id: string; date: string; title: string; reflection: string; }
  const [wellshopNextDesc, setWellshopNextDesc] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const k of ['wellshop', 'expresshop', 'playshop']) {
      try { out[k] = localStorage.getItem(`wellshop_next_${k}`) || ''; } catch { out[k] = ''; }
    }
    return out;
  });
  const [wellshopRsvp, setWellshopRsvp] = useState<Record<string, Record<string, boolean>>>(() => {
    const out: Record<string, Record<string, boolean>> = {};
    for (const k of ['wellshop', 'expresshop', 'playshop']) {
      try { const r = localStorage.getItem(`wellshop_rsvp_${k}`); out[k] = r ? JSON.parse(r) : {}; } catch { out[k] = {}; }
    }
    return out;
  });
  const [wellshopHistory, setWellshopHistory] = useState<Record<string, WellshopHistoryEntry[]>>(() => {
    const out: Record<string, WellshopHistoryEntry[]> = {};
    for (const k of ['wellshop', 'expresshop', 'playshop']) {
      try { const r = localStorage.getItem(`wellshop_history_${k}`); out[k] = r ? JSON.parse(r) : []; } catch { out[k] = []; }
    }
    return out;
  });
  const [wellshopShowHistory, setWellshopShowHistory] = useState<Record<string, boolean>>({});
  const [wellshopLogForm, setWellshopLogForm] = useState<string | null>(null);
  const [wellshopLogData, setWellshopLogData] = useState({ date: '', title: '', reflection: '' });

  // ── Co-founder expandable profile cards ──
  const [expandedProfileKey, setExpandedProfileKey] = useState<string | null>(null);
  const [profileHolding, setProfileHolding] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const k of ['sunshine', 'monny', 'bingle']) {
      try { out[k] = localStorage.getItem(`profile_holding_${k}`) || ''; } catch { out[k] = ''; }
    }
    return out;
  });
  const PROFILE_META: Record<string, { hdType: string; zone: string; craft: string }> = {
    sunshine: { hdType: 'ManiGen 5/1', zone: 'internal expression — the atmosphere architect', craft: 'space, atmosphere, playlists' },
    monny: { hdType: 'Generator 5/1', zone: 'systems, narrative, somatic', craft: 'systems, narrative, somatic' },
    bingle: { hdType: 'Projector 2/4', zone: 'lens, identity, visual story', craft: 'lens, identity, visual story' },
  };

  // Close profile card on outside click
  useEffect(() => {
    if (!expandedProfileKey) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.profile-card-expanded') && !target.closest('.hub-avatar-circle')) {
        setExpandedProfileKey(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [expandedProfileKey]);

  // Read Titration Dial value for visibility-aware Brain Dump submissions
  const [visibilityDial, setVisibilityDial] = useState(() => {
    const stored = localStorage.getItem('visibilityDial');
    return stored ? parseInt(stored) : 1;
  });
  // Listen for dial changes from TopNav (storage events + periodic check)
  useEffect(() => {
    const handler = () => {
      const v = localStorage.getItem('visibilityDial');
      if (v !== null) setVisibilityDial(parseInt(v));
    };
    window.addEventListener('storage', handler);
    const interval = setInterval(handler, 2000);
    return () => { window.removeEventListener('storage', handler); clearInterval(interval); };
  }, []);

  // ── Per-user Google Calendar OAuth (Authorization Code + PKCE) ─────────────
  // Each co-creator (Sunshine / Monny / Bingle) can independently connect their
  // personal Google Calendar.  Tokens are stored per-user in localStorage as
  // gcal_token_SUNSHINE, gcal_token_MONNY, gcal_token_BINGLE, etc.
  // The shared team calendar (embed) is always visible — no auth needed.
  const userKey = activeUser?.toUpperCase() || '';
  const userTokenKey = `gcal_token_${userKey}`;
  const userNameKey = `gcal_name_${userKey}`;

  const [showPersonalEvents, setShowPersonalEvents] = useState(() => !!localStorage.getItem(userTokenKey));
  const [gcalConnected, setGcalConnected] = useState(() => !!localStorage.getItem(userTokenKey));
  const [gcalEvents, setGcalEvents] = useState<{ date: string; time: string; name: string }[]>([]);
  const [gcalLoading, setGcalLoading] = useState(() => localStorage.getItem('gcal_token_fresh') === 'pending');
  const [gcalError, setGcalError] = useState('');
  const [gcalCalendarName, setGcalCalendarName] = useState(() => localStorage.getItem(userNameKey) || '');
  const mountFetchedRef = useRef(false);
  const prevUserRef = useRef(userKey);

  // ── Reset personal calendar state when active user changes ─────────────────
  useEffect(() => {
    if (prevUserRef.current === userKey) return;
    prevUserRef.current = userKey;
    mountFetchedRef.current = false; // allow re-fetch for new user
    const hasToken = !!localStorage.getItem(userTokenKey);
    setGcalConnected(hasToken);
    setShowPersonalEvents(hasToken);
    setGcalCalendarName(localStorage.getItem(userNameKey) || '');
    setGcalEvents([]);
    setGcalError('');
    setGcalLoading(false);
  }, [userKey, userTokenKey, userNameKey]);

  // ── PKCE helpers ───────────────────────────────────────────────────────────
  function generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }

  async function generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  // ── Fetch calendar events helper ───────────────────────────────────────────
  const fetchCalendarEvents = React.useCallback(async (token: string) => {
    setGcalLoading(true);
    setGcalError('');
    try {
      // Fetch calendar metadata for display name
      const calRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (calRes.ok) {
        const calData = await calRes.json();
        const name = calData.summary || calData.id || 'Google Calendar';
        setGcalCalendarName(name);
        localStorage.setItem(userNameKey, name);
      }

      // Fetch upcoming events for the next 90 days, including all-day events.
      const now = new Date();
      const timeMin = now.toISOString();
      const timeMax = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate()).toISOString();
      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=250`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        localStorage.removeItem(userTokenKey);
        localStorage.removeItem(userNameKey);
        localStorage.removeItem('gcal_token_fresh');
        setGcalConnected(false);
        setGcalCalendarName('');
        setGcalError('Session expired — reconnect Google Calendar');
        return;
      }
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Google Calendar API error ${res.status}: ${errText}`);
      }
      const data = await res.json();
      const events = (data.items || []).map((ev: any) => {
        const start = ev.start?.dateTime || ev.start?.date;
        const date = start
          ? new Date(`${start}${ev.start?.dateTime ? '' : 'T00:00:00'}`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : '';
        const time = ev.start?.dateTime
          ? new Date(ev.start.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()
          : 'All day';
        return { date, time, name: ev.summary || '(No title)' };
      });
      setGcalEvents(events);
    } catch (e: any) {
      console.error('Google Calendar fetch error:', e);
      setGcalError(e.message || 'Failed to load events');
    } finally {
      setGcalLoading(false);
      // Clear the fresh-token flag now that we've processed it
      localStorage.removeItem('gcal_token_fresh');
    }
  }, [userNameKey, userTokenKey]);

  // ── On mount: poll for token exchange completion OR use stored token ────────
  // App.tsx IIFE fires the async token exchange and writes gcal_token_fresh.
  // We poll localStorage briefly to detect when the exchange finishes.
  useEffect(() => {
    if (mountFetchedRef.current) return;
    mountFetchedRef.current = true;

    const freshFlag = localStorage.getItem('gcal_token_fresh');

    if (freshFlag === 'pending') {
      // Token exchange is in progress — poll until it resolves
      setGcalLoading(true);
      setGcalError('');
      const pollId = setInterval(() => {
        const status = localStorage.getItem('gcal_token_fresh');
        if (status === 'ready') {
          clearInterval(pollId);
          localStorage.removeItem('gcal_token_fresh');
          const token = localStorage.getItem(userTokenKey);
          if (token) {
            setGcalConnected(true);
            fetchCalendarEvents(token);
          } else {
            setGcalLoading(false);
            setGcalError('Token exchange produced no token. Try reconnecting.');
          }
        } else if (status === 'error') {
          clearInterval(pollId);
          const errMsg = localStorage.getItem('gcal_token_error') || 'Token exchange failed';
          localStorage.removeItem('gcal_token_fresh');
          localStorage.removeItem('gcal_token_error');
          setGcalLoading(false);
          setGcalError(errMsg);
        }
        // else still 'pending' — keep polling
      }, 200);
      // Safety: stop polling after 30s
      setTimeout(() => {
        clearInterval(pollId);
        if (localStorage.getItem('gcal_token_fresh') === 'pending') {
          localStorage.removeItem('gcal_token_fresh');
          setGcalLoading(false);
          setGcalError('Token exchange timed out. Try reconnecting.');
        }
      }, 30_000);
      return;
    }

    if (freshFlag === 'ready') {
      // Exchange already completed before mount (unlikely but handle it)
      localStorage.removeItem('gcal_token_fresh');
    }

    // Check for existing token from a previous session
    const storedToken = localStorage.getItem(userTokenKey);
    if (storedToken) {
      setGcalConnected(true);
      fetchCalendarEvents(storedToken);
    }
  }, [fetchCalendarEvents, userTokenKey]);

  // ── Connect: redirect to Google OAuth (authorization code + PKCE) ──────────
  async function connectGoogleCalendar() {
    const REDIRECT_URI = window.location.origin;
    const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events';

    // Generate PKCE code_verifier and code_challenge
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Store code_verifier — App.tsx IIFE will read it on redirect return
    localStorage.setItem('gcal_pkce_verifier', codeVerifier);
    // Store which user initiated the OAuth so App.tsx can assign the token
    localStorage.setItem('gcal_oauth_user', activeUser || 'monny');

    const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth'
      + `?client_id=${encodeURIComponent(GCAL_CLIENT_ID)}`
      + `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`
      + `&response_type=code`
      + `&scope=${encodeURIComponent(SCOPES)}`
      + `&code_challenge=${encodeURIComponent(codeChallenge)}`
      + `&code_challenge_method=S256`
      + `&access_type=online`
      + `&prompt=consent`;

    window.location.href = authUrl;
  }

  // ── Disconnect: revoke token via Google endpoint, clear local state ────────
  function disconnectGoogleCalendar() {
    const token = localStorage.getItem(userTokenKey);
    if (token) {
      fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }).catch(() => {});
    }
    localStorage.removeItem(userTokenKey);
    localStorage.removeItem(userNameKey);
    localStorage.removeItem('gcal_pkce_verifier');
    localStorage.removeItem('gcal_token_fresh');
    localStorage.removeItem('gcal_token_error');
    setGcalConnected(false);
    setGcalEvents([]);
    setGcalError('');
    setGcalCalendarName('');
  }

  const daysToLaunch = getDaysToLaunch();

  // today reference for event computations
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const now = new Date();
  const dateLabel = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  function submitBrainDump() {
    if (!dumpContent.trim()) return;
    // Titration Dial: quiet mode (0) → submit anonymously
    const author = visibilityDial === 0 ? 'anonymous' : dumpAuthor;
    const tagStr = dumpTag || dumpTags.trim();
    onAddBrainDump({ author, content: dumpContent.trim(), tags: tagStr, drive_link: '' });
    setDumpContent(''); setDumpTags(''); setDumpTag(null);
    showToast('\uD83E\uDDE0 dumped.');
  }

  // ── Brain Dump tag pill definitions ──
  const DUMP_TAG_PILLS: { key: string; label: string; icon: string }[] = [
    { key: 'idea',       label: 'Idea',       icon: '\u{1F4A1}' },
    { key: 'question',   label: 'Question',   icon: '\u2753' },
    { key: 'urgent',     label: 'Urgent',     icon: '\u{1F525}' },
    { key: 'playground', label: 'Playground', icon: '\u26FA' },
    { key: 'process',    label: 'Process',    icon: '\u{1F300}' },
  ];

  // ── Send dump to Playground Brain Lumps ──
  function sendDumpToPlayground(dump: BrainDump) {
    try {
      const raw = localStorage.getItem('cr8w_playground');
      const pgData = raw ? JSON.parse(raw) : { glossary: [], brainLumps: [], seeds: [], brandLab: [], parking: [] };
      const newLump = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text: dump.content, ts: Date.now() };
      pgData.brainLumps = [newLump, ...(pgData.brainLumps || [])];
      localStorage.setItem('cr8w_playground', JSON.stringify(pgData));
      const next = new Set(sentToPlayground); next.add(dump.id);
      setSentToPlayground(next);
      localStorage.setItem('cr8w_dump_sent_pg', JSON.stringify([...next]));
      showToast('\u26FA sent to Playground Brain Lumps', 'well');
    } catch {
      showToast('\u26A0\uFE0F couldn\u2019t send \u2014 try again', 'alert');
    }
  }

  // ── Bubbling up: archive a dump ──
  function archiveDump(id: number) {
    const next = new Set(archivedDumps); next.add(id);
    setArchivedDumps(next);
    localStorage.setItem('dump_archive', JSON.stringify([...next]));
    showToast('\u{1FAA6} resting now.');
  }

  // ── Bubbling up: reset timer (still alive) ──
  function resetDumpTimer(id: number) {
    const next = { ...resetTimestamps, [id]: new Date().toISOString() };
    setResetTimestamps(next);
    localStorage.setItem('cr8w_dump_reset_ts', JSON.stringify(next));
    showToast('\u{1F331} still alive \u2014 timer reset.');
  }

  // ── Bubbling up: find one qualifying untagged item older than 5 days ──
  const bubblingUpItem = React.useMemo(() => {
    const fiveDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000;
    return brainDumps.find(d => {
      if (archivedDumps.has(d.id)) return false;
      if (sentToPlayground.has(d.id)) return false;
      // Must be untagged (no tag or empty)
      const tag = d.tags?.trim();
      if (tag && DUMP_TAG_PILLS.some(t => t.key === tag)) return false;
      // Use reset timestamp if available, else created_at
      const effectiveTime = resetTimestamps[d.id]
        ? new Date(resetTimestamps[d.id]).getTime()
        : d.created_at ? new Date(d.created_at).getTime() : Date.now();
      return effectiveTime < fiveDaysAgo;
    }) || null;
  }, [brainDumps, archivedDumps, sentToPlayground, resetTimestamps]);

  const bubblingUpDaysAgo = bubblingUpItem ? (() => {
    const ts = resetTimestamps[bubblingUpItem.id]
      ? new Date(resetTimestamps[bubblingUpItem.id]).getTime()
      : bubblingUpItem.created_at ? new Date(bubblingUpItem.created_at).getTime() : Date.now();
    return Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000));
  })() : 0;

  const filteredDumps = (dumpFilter === 'all' ? brainDumps : brainDumps.filter(d => d.author === dumpFilter)).filter(d => !archivedDumps.has(d.id));
  const visibleDumps = showAllDumps ? filteredDumps : filteredDumps.slice(0, 3);

  return (
    <section className="cr-view hub-calm">

      {/* Arrive State — emotional onboarding (once per day) */}
      {showArriveCard && (
        <ArriveState onDismiss={() => setShowArriveCard(false)} />
      )}
      {!showArriveCard && !shouldShowArriveState() && (() => {
        const todayMood = localStorage.getItem('arriveState');
        const MOOD_MAP: Record<string, { emoji: string; label: string }> = {
          flowing: { emoji: '🌊', label: 'flowing' },
          foggy: { emoji: '🌫️', label: 'foggy' },
          fired: { emoji: '🔥', label: 'fired up' },
        };
        const mood = todayMood ? MOOD_MAP[todayMood] : null;
        return (
          <div className="hub-mood-breadcrumb">
            <span>you're back 🫶</span>
            {mood && (
              <>
                <span style={{ margin: '0 2px', opacity: 0.3 }}>·</span>
                <span className="mood-emoji">{mood.emoji}</span>
                <span className="mood-label">{mood.label}</span>
                <span style={{ opacity: 0.4 }}>today</span>
              </>
            )}
          </div>
        );
      })()}

      {/* Greeting + Date */}
      <div className="hub-greeting-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {activeUser && PERSONS[activeUser] && (
            <span style={{
              width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0,
              background: `${PERSONS[activeUser].color}22`,
              border: `2px solid ${PERSONS[activeUser].color}55`,
            }}>{PERSONS[activeUser].emoji}</span>
          )}
          <span className="hub-greeting">
            {getGreeting()}{activeUser && PERSONS[activeUser] ? `, ${PERSONS[activeUser].name}` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="hub-greeting-date">{dateLabel}</span>
          <button
            onClick={() => {
              try {
                const ta = document.createElement('textarea');
                ta.value = window.location.href;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2000);
              } catch (_) {}
            }}
            title="Copy dashboard link"
            style={{
              background: linkCopied ? 'rgba(48,209,88,0.12)' : 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.08)',
              border: linkCopied ? '1px solid rgba(48,209,88,0.3)' : '1px solid rgba(var(--cr8w-primary-rgb, 123,168,157),0.2)',
              borderRadius: 8,
              padding: '5px 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: '0.7rem',
              fontFamily: 'var(--font-label, Montserrat, sans-serif)',
              fontWeight: 600,
              color: linkCopied ? '#30D158' : 'var(--cr8w-primary, #7BA89D)',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {linkCopied ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#30D158" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Copied!
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                Share Link
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Top hero: 2×2 Geyser mini-cards ── */}
      {(() => {
        const openTasks = actionItems.filter(t => t.status !== 'done');
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const doneThisWeek = actionItems.filter(t => t.status === 'done' && t.created_at && new Date(t.created_at).getTime() > oneWeekAgo).length;
        const confirmedStations = stations.filter(s => s.status === 'Confirmed').length;
        const totalStations = stations.length || 6;
        // Find next upcoming milestone from CALENDAR_EVENTS + KV events
        const todayStr = new Date().toISOString().split('T')[0];
        const staticMilestone = CALENDAR_EVENTS
          .filter(e => e.date >= todayStr && e.type !== 'personal')
          .sort((a, b) => a.date.localeCompare(b.date))[0];
        const kvMilestone = kvCalEvents
          .filter(e => (e.start?.split('T')[0] || '') >= todayStr)
          .sort((a, b) => a.start.localeCompare(b.start))[0];
        const nextMilestone = staticMilestone
          ? staticMilestone
          : kvMilestone
            ? { title: kvMilestone.title, date: kvMilestone.start.split('T')[0] }
            : null;
        const nextMilestoneLabel = nextMilestone
          ? `${nextMilestone.title.replace(/\s*🚀/, '')} · ${new Date(nextMilestone.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
          : 'Launch day approaching';
        // Team role check
        const assignedRoles = ['sunshine', 'monny', 'bingle'].filter(p => stations.some(s => s.owner === p));
        const rolesLabel = assignedRoles.length >= 3 ? 'roles assigned' : 'needs update';

        const cardBase: React.CSSProperties = {
          borderRadius: 12, padding: 12, background: '#fff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)', cursor: 'pointer',
          transition: 'transform 0.15s, box-shadow 0.15s',
          display: 'flex', flexDirection: 'column', gap: 4,
          minHeight: 0, border: 'none',
          textAlign: 'left', fontFamily: 'var(--font-label)',
        };

        function MiniCard({ emoji, title, borderColor, badge, subtitle, onClick, children }: {
          emoji: string; title: string; borderColor: string; badge?: number | string; subtitle: string;
          onClick: () => void; children?: React.ReactNode;
        }) {
          return (
            <button
              onClick={onClick}
              style={{ ...cardBase, borderLeft: `3px solid ${borderColor}` }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,0.10)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '1rem' }}>{emoji}</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--cr8w-text, #2D2438)', letterSpacing: '0.01em' }}>{title}</span>
                </div>
                {badge !== undefined && (
                  <span style={{
                    background: borderColor, color: '#fff', borderRadius: 10,
                    padding: '1px 8px', fontSize: '0.66rem', fontWeight: 700,
                    minWidth: 20, textAlign: 'center',
                  }}>{badge}</span>
                )}
              </div>
              {children}
              <div style={{ fontSize: '0.66rem', color: 'var(--text-muted, #8A7D72)', fontWeight: 500, lineHeight: 1.3 }}>{subtitle}</div>
            </button>
          );
        }

        return (
          <div className="geyser-mini-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 10,
            margin: '0 0 8px',
          }}>
            <style>{`@media (max-width: 520px) { .geyser-mini-grid { grid-template-columns: 1fr !important; } }`}</style>
            {/* Moves */}
            <MiniCard
              emoji={'\u{1F4CB}'}
              title="Moves"
              borderColor="var(--cr8w-primary, #7BA89D)"
              badge={openTasks.length}
              subtitle={`${openTasks.length} in motion this week`}
              onClick={() => onNavigate('geyser')}
            />
            {/* Stations */}
            <MiniCard
              emoji={'\u{1F4CD}'}
              title="Stations"
              borderColor="var(--cr8w-secondary, #B8A9D4)"
              badge={confirmedStations}
              subtitle={`${confirmedStations} of ${totalStations} confirmed`}
              onClick={() => onNavigateGeyserStations()}
            />
            {/* Guests */}
            <MiniCard
              emoji={'\u{1F4E8}'}
              title="Guests"
              borderColor="#6BAF6B"
              badge={inviteLoaded ? inviteCounts.confirmed : '—'}
              subtitle={inviteLoaded && inviteCounts.total > 0 ? `${inviteCounts.confirmed} confirmed of ${inviteCounts.total}` : 'synced from invite sheet'}
              onClick={() => onNavigate('geyser')}
            />
            {/* Team */}
            <MiniCard
              emoji={'\u{1F465}'}
              title="Team"
              borderColor="#E8C875"
              subtitle={rolesLabel}
              onClick={() => onNavigate('geyser')}
            >
              <div style={{ display: 'flex', marginTop: 2, marginBottom: 2 }}>
                {[
                  { key: 'sunshine', emoji: '☀️', color: '#D4A5A5' },
                  { key: 'monny', emoji: '🌊', color: '#7BA89D' },
                  { key: 'bingle', emoji: '✨', color: '#B8A9D4' },
                ].map((p, i) => (
                  <div key={p.key} style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: `${p.color}33`, border: `1.5px solid ${p.color}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.7rem', marginLeft: i > 0 ? -4 : 0,
                    position: 'relative', zIndex: 3 - i,
                  }}>{p.emoji}</div>
                ))}
              </div>
            </MiniCard>
            {/* Timeline */}
            <MiniCard
              emoji={'\u23F1\uFE0F'}
              title="Timeline"
              borderColor="#D4A0A0"
              subtitle={nextMilestoneLabel}
              onClick={() => onNavigate('geyser')}
            >
              <div style={{
                fontSize: '1.2rem', fontWeight: 800, color: 'var(--cr8w-text, #2D2438)',
                fontFamily: "var(--font-display)", lineHeight: 1.1,
                marginTop: 1, marginBottom: 1,
              }}>{daysToLaunch} days</div>
            </MiniCard>
          </div>
        );
      })()}

      {/* ── Two-column: Calendar + sidebar (Tools, Avatars, Next Meeting) ── */}
      <div className="hub-columns">
        <div className="hub-col-primary">
          <div className="hub-schedule-card">
        {/* Calendar / Wellshop Menu tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 12 }}>
          {([
            { key: 'calendar' as const, label: '\uD83D\uDCC5 calendar' },
            { key: 'wellshop' as const, label: '\uD83C\uDFA8 workshop menu' },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setCalendarTab(t.key)}
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: t.key === 'calendar' ? '10px 0 0 10px' : '0 10px 10px 0',
                border: calendarTab === t.key ? '1.5px solid var(--cr8w-primary)' : '1px solid var(--border-soft)',
                background: calendarTab === t.key ? 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.08)' : 'transparent',
                color: calendarTab === t.key ? 'var(--cr8w-primary)' : 'var(--text-muted)',
                fontFamily: 'var(--font-label)',
                fontSize: '0.72rem',
                fontWeight: calendarTab === t.key ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
                letterSpacing: '0.02em',
              }}
            >{t.label}</button>
          ))}
        </div>

        {calendarTab === 'calendar' && (
          <>
        <div className="hub-section-header">
          <span className="hub-section-title">Calendar</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={syncIcalCalendar}
              disabled={icalSyncing}
              style={{ padding: '4px 12px', borderRadius: 8, border: '1px solid rgba(194,91,56,0.35)', background: 'rgba(194,91,56,0.08)', color: '#C25B38', fontFamily: 'var(--font-label)', fontSize: '0.7rem', fontWeight: 600, cursor: icalSyncing ? 'default' : 'pointer', opacity: icalSyncing ? 0.6 : 1, whiteSpace: 'nowrap' }}
            >
              {icalSyncing ? 'Syncing…' : '⟳ Sync Calendar'}
            </button>
            {icalSyncMsg && (
              <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.68rem', color: icalSyncMsg.startsWith('Sync error') ? '#C03020' : '#3A7A3A' }}>{icalSyncMsg}</span>
            )}
            <a
              href="https://calendar.google.com/calendar/u/0/r"
              target="_blank" rel="noopener noreferrer"
              className="hub-gcal-open"
            >Open ↗</a>
          </div>
        </div>

        {/* Layer 1: Shared Team Calendar embed (always visible, no auth) */}
        <iframe
          src={TEAM_CALENDAR_EMBED}
          title="CR8W Shared Team Calendar"
          style={{
            width: '100%',
            height: 400,
            borderRadius: 12,
            border: '1px solid rgba(0,0,0,0.1)',
            marginBottom: 0,
          }}
          frameBorder="0"
          scrolling="no"
        />

        {/* Divider */}
        <div style={{
          height: 1,
          background: 'var(--border-soft)',
          margin: '14px 0 10px',
        }} />

        {/* Layer 2: Personal Calendar Overlay (opt-in per user) */}
        <label style={{
          display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
          fontFamily: 'var(--font-label)', fontSize: '0.78rem', fontWeight: 600,
          color: showPersonalEvents ? (gcalConnected ? '#3A7A3A' : 'var(--text-primary)') : 'var(--text-muted)',
          userSelect: 'none',
        }}>
          <input
            type="checkbox"
            checked={showPersonalEvents}
            onChange={e => {
              setShowPersonalEvents(e.target.checked);
              // If toggling on and already connected, fetch events
              if (e.target.checked && gcalConnected && gcalEvents.length === 0) {
                const token = localStorage.getItem(userTokenKey);
                if (token) fetchCalendarEvents(token);
              }
            }}
            style={{ accentColor: '#1A73E8', width: 16, height: 16 }}
          />
          Show my personal events
          {activeUser && PERSONS[activeUser] && (
            <span style={{
              fontSize: '0.72rem', fontWeight: 500,
              color: PERSONS[activeUser].color, opacity: 0.8,
            }}>
              ({PERSONS[activeUser].emoji} {PERSONS[activeUser].name})
            </span>
          )}
        </label>

        {showPersonalEvents && (
          <div style={{ marginTop: 10 }}>
            {!gcalConnected ? (
              <>
                <button
                  onClick={connectGoogleCalendar}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8,
                    background: 'rgba(26,115,232,0.1)', border: '1px solid rgba(26,115,232,0.3)',
                    color: '#1A73E8', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                    fontFamily: 'var(--font-label)', letterSpacing: '0.02em',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    transition: 'all 0.15s',
                  }}
                >
                  <LogoGCal size={18} /> Connect Google Calendar
                </button>
                {gcalError && (
                  <div style={{ fontSize: '0.72rem', color: '#D46B6B', marginTop: 6, fontFamily: 'var(--font-label)' }}>
                    {gcalError}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* YOUR SCHEDULE header */}
                <div style={{
                  fontFamily: 'var(--font-label)', fontSize: '0.62rem', color: '#3A7A3A',
                  textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#3A7A3A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  YOUR SCHEDULE{gcalCalendarName ? ` \u00b7 ${gcalCalendarName}` : ''}
                  <button
                    onClick={disconnectGoogleCalendar}
                    style={{
                      marginLeft: 'auto', background: 'none', border: 'none',
                      color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.6rem',
                      fontFamily: 'var(--font-label)', textDecoration: 'underline',
                    }}
                  >Disconnect</button>
                </div>

                {gcalLoading ? (
                  <div style={{ padding: '12px 0', textAlign: 'center', color: '#1A73E8', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                      <circle cx="12" cy="12" r="10" stroke="#1A73E8" strokeWidth="2.5" fill="none" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                    </svg>
                    {localStorage.getItem('gcal_token_fresh') === 'pending' ? 'Connecting to Google Calendar...' : 'Loading events...'}
                  </div>
                ) : gcalError ? (
                  <div style={{ fontSize: '0.72rem', color: '#D46B6B', padding: '8px 0', fontFamily: 'var(--font-label)' }}>
                    {gcalError}
                    <button onClick={connectGoogleCalendar} style={{ marginLeft: 8, background: 'none', border: 'none', color: '#1A73E8', cursor: 'pointer', textDecoration: 'underline', fontSize: 'inherit', fontFamily: 'inherit' }}>Reconnect</button>
                  </div>
                ) : gcalEvents.length === 0 ? (
                  <div style={{ padding: '12px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-body)' }}>No upcoming personal events in the next 90 days</div>
                ) : (
                  <div className="hub-schedule-list">
                    {gcalEvents.map((ev, i) => (
                      <div key={i} className="hub-schedule-item">
                        <span className="hub-schedule-dot" style={{ background: '#1A73E8' }} />
                        <span className="hub-schedule-time">{ev.date} · {ev.time}</span>
                        <span className="hub-schedule-name">{ev.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
          </>
        )}

        {calendarTab === 'wellshop' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {([
              { key: 'wellshop', emoji: '\uD83E\uDEB7', title: 'wellshop', subtitle: 'inner nurture', accent: '#A8B5A0', desc: 'journaling, reflection, grounding, decomprocessing' },
              { key: 'expresshop', emoji: '\uD83C\uDFA4', title: 'expresshop', subtitle: 'outer expression', accent: '#E8967D', desc: 'sharing, presenting, pitching, storytelling' },
              { key: 'playshop', emoji: '\uD83C\uDFAA', title: 'playshop', subtitle: 'pure play', accent: '#E8C875', desc: 'make whatever tf you want, then show & tell' },
            ]).map(cat => {
              const notifyKey = `wellshop_notify_${cat.key}`;
              const isNotified = localStorage.getItem(notifyKey) === '1';
              const historyEntries = wellshopHistory[cat.key] || [];
              const historyCount = historyEntries.length;
              const rsvpData = wellshopRsvp[cat.key] || {};
              const RSVP_PEOPLE = [
                { key: 'sunshine', emoji: '\u2600\uFE0F', color: '#D4A5A5' },
                { key: 'monny', emoji: '\uD83C\uDF0A', color: '#7BA89D' },
                { key: 'bingle', emoji: '\u2728', color: '#B8A9D4' },
              ];
              return (
                <div key={cat.key} className="wellshop-category-card" style={{
                  background: `${cat.accent}12`,
                  border: `1.5px solid ${cat.accent}40`,
                }}>
                  {/* ── Card header with count badge ── */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                      <span style={{ fontSize: '1.1rem', marginRight: 6 }}>{cat.emoji}</span>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: '0.95rem', color: 'var(--cr8w-text, #2C1C10)', fontWeight: 500 }}>{cat.title}</span>
                      {historyCount > 0 && (
                        <span style={{
                          marginLeft: 6, padding: '1px 7px', borderRadius: 10, fontSize: '0.6rem',
                          fontFamily: 'var(--font-label)', fontWeight: 700,
                          background: `${cat.accent}25`, color: cat.accent,
                        }}>({historyCount})</span>
                      )}
                      <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.68rem', color: cat.accent, marginLeft: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{cat.subtitle}</span>
                    </div>
                    <button
                      onClick={() => {
                        if (isNotified) localStorage.removeItem(notifyKey);
                        else localStorage.setItem(notifyKey, '1');
                        setNotifyTick(t => t + 1);
                      }}
                      className="wellshop-notify-btn"
                      style={{
                        padding: '4px 10px',
                        borderRadius: 8,
                        border: isNotified ? `1px solid ${cat.accent}` : '1px solid var(--border-soft)',
                        background: isNotified ? `${cat.accent}20` : 'transparent',
                        color: isNotified ? cat.accent : 'var(--text-muted)',
                        fontFamily: 'var(--font-label)',
                        fontSize: '0.62rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >{isNotified ? '\u2705 notifying' : '\uD83D\uDD14 notify me'}</button>
                  </div>
                  <div style={{ fontFamily: "var(--font-label)", fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    {cat.desc}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <span
                      className="wellshop-see-upcoming"
                      onClick={() => setExpandedWellshopCategory(expandedWellshopCategory === cat.key ? null : cat.key)}
                      style={{ fontFamily: 'var(--font-label)', fontSize: '0.65rem', color: cat.accent, fontWeight: 600, cursor: 'pointer' }}
                    >{expandedWellshopCategory === cat.key ? 'hide \u2191' : 'see upcoming \u2192'}</span>
                  </div>

                  {/* Expanded content */}
                  {expandedWellshopCategory === cat.key && (
                    <div style={{ animation: 'cw-fadeInUp 0.25s ease' }}>

                    {/* ── Next Session preview ── */}
                    <div style={{
                      marginTop: 10, padding: '10px 12px',
                      background: 'rgba(255,255,255,0.7)', borderRadius: 10,
                      border: `1px dashed ${cat.accent}50`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.6rem', fontWeight: 700, color: cat.accent, textTransform: 'uppercase', letterSpacing: '0.04em' }}>next session</span>
                        <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.6rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>next: TBD</span>
                      </div>
                      <input
                        type="text"
                        placeholder={`session theme for next ${cat.title}...`}
                        value={wellshopNextDesc[cat.key] || ''}
                        onChange={e => {
                          const val = e.target.value;
                          setWellshopNextDesc(prev => ({ ...prev, [cat.key]: val }));
                          try { localStorage.setItem(`wellshop_next_${cat.key}`, val); } catch {}
                        }}
                        style={{
                          width: '100%', border: '1px solid var(--border-soft)', borderRadius: 8,
                          padding: '5px 10px', fontSize: '0.78rem', fontFamily: "var(--font-label)",
                          color: 'var(--cr8w-text, #2D2438)', background: 'var(--cr8w-surface, #fff)', outline: 'none',
                          marginBottom: 8, boxSizing: 'border-box',
                        }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.58rem', color: 'var(--text-muted)', fontWeight: 600, marginRight: 4 }}>RSVP</span>
                        {RSVP_PEOPLE.map(p => {
                          const attending = !!rsvpData[p.key];
                          return (
                            <button
                              key={p.key}
                              onClick={() => {
                                const next = { ...rsvpData, [p.key]: !attending };
                                setWellshopRsvp(prev => ({ ...prev, [cat.key]: next }));
                                try { localStorage.setItem(`wellshop_rsvp_${cat.key}`, JSON.stringify(next)); } catch {}
                              }}
                              title={`${p.key} — ${attending ? 'attending' : 'not attending'}`}
                              style={{
                                width: 26, height: 26, borderRadius: '50%', cursor: 'pointer',
                                border: attending ? `2px solid ${p.color}` : '2px solid #ccc',
                                background: attending ? `${p.color}30` : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.68rem', padding: 0, transition: 'all 0.15s',
                                position: 'relative',
                              }}
                            >
                              {p.emoji}
                              {attending && (
                                <span style={{
                                  position: 'absolute', bottom: -2, right: -2,
                                  fontSize: '0.5rem', background: p.color, color: '#fff',
                                  borderRadius: '50%', width: 12, height: 12,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontWeight: 700,
                                }}>{'\u2713'}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* ── Upcoming workshops from real data ── */}
                    {(() => {
                      const matched = workshops
                        .filter(w => matchesCategory(w, cat.key) && (w.status === 'scheduled' || w.status === 'planning'))
                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                        .slice(0, 4);
                      return matched.length > 0 ? (
                        <div style={{
                          marginTop: 8, padding: '8px 12px',
                          background: 'rgba(255,255,255,0.6)', borderRadius: 10,
                          border: `1px solid ${cat.accent}25`,
                        }}>
                          {matched.map(w => (
                            <div key={w.id} style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '6px 0',
                              borderBottom: '1px solid rgba(44,28,16,0.05)',
                            }}>
                              <span style={{
                                fontFamily: 'var(--font-label)', fontSize: '0.6rem', fontWeight: 700,
                                color: cat.accent, textTransform: 'uppercase', minWidth: 55,
                              }}>
                                {new Date(w.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                              <span style={{
                                fontFamily: "var(--font-label)", fontSize: '0.82rem',
                                color: '#2C1C10', flex: 1,
                              }}>{w.title}</span>
                              <span style={{
                                fontFamily: 'var(--font-label)', fontSize: '0.58rem', fontWeight: 600,
                                color: 'var(--text-muted)', textTransform: 'uppercase',
                              }}>{w.status}</span>
                            </div>
                          ))}
                          <div style={{ textAlign: 'center', marginTop: 6 }}>
                            <span
                              style={{ fontFamily: 'var(--font-label)', fontSize: '0.6rem', color: cat.accent, fontWeight: 600, cursor: 'pointer' }}
                              onClick={() => onNavigate('workshops')}
                            >view all in workshops {'\u2192'}</span>
                          </div>
                        </div>
                      ) : (
                        <div style={{
                          marginTop: 8, padding: '8px 12px',
                          fontFamily: "var(--font-label)", fontSize: '0.78rem',
                          color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center',
                        }}>
                          no upcoming {cat.key}s yet — <span
                            style={{ color: cat.accent, cursor: 'pointer', fontWeight: 600, fontStyle: 'normal' }}
                            onClick={() => onNavigate('workshops')}
                          >add one in workshops</span>
                        </div>
                      );
                    })()}

                    {/* ── Past Sessions ── */}
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span
                          onClick={() => setWellshopShowHistory(prev => ({ ...prev, [cat.key]: !prev[cat.key] }))}
                          style={{
                            fontFamily: 'var(--font-label)', fontSize: '0.62rem', fontWeight: 700,
                            color: cat.accent, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.03em',
                          }}
                        >
                          {wellshopShowHistory[cat.key] ? '\u25BE' : '\u25B8'} past sessions {historyCount > 0 ? `(${historyCount})` : ''}
                        </span>
                        <button
                          onClick={() => {
                            if (wellshopLogForm === cat.key) {
                              setWellshopLogForm(null);
                            } else {
                              setWellshopLogForm(cat.key);
                              setWellshopLogData({ date: new Date().toISOString().split('T')[0], title: '', reflection: '' });
                              setWellshopShowHistory(prev => ({ ...prev, [cat.key]: true }));
                            }
                          }}
                          style={{
                            padding: '3px 10px', borderRadius: 10, fontSize: '0.6rem',
                            fontFamily: 'var(--font-label)', fontWeight: 700, cursor: 'pointer',
                            border: `1px solid ${cat.accent}60`, background: 'transparent',
                            color: cat.accent, transition: 'all 0.15s',
                          }}
                        >{wellshopLogForm === cat.key ? '\u2715 cancel' : '+ log session'}</button>
                      </div>

                      {/* Log session form */}
                      {wellshopLogForm === cat.key && (
                        <div style={{
                          padding: '10px 12px', background: 'rgba(255,255,255,0.8)', borderRadius: 10,
                          border: `1px solid ${cat.accent}30`, marginBottom: 8,
                          display: 'flex', flexDirection: 'column', gap: 6,
                          animation: 'cw-fadeInUp 0.2s ease',
                        }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input
                              type="date"
                              value={wellshopLogData.date}
                              onChange={e => setWellshopLogData(prev => ({ ...prev, date: e.target.value }))}
                              style={{
                                border: '1px solid var(--border-soft)', borderRadius: 8, padding: '4px 8px',
                                fontSize: '0.72rem', fontFamily: 'var(--font-label)', color: 'var(--cr8w-text, #2D2438)',
                                background: 'var(--cr8w-surface, #fff)', outline: 'none', flex: '0 0 auto',
                              }}
                            />
                            <input
                              type="text"
                              placeholder="session title..."
                              value={wellshopLogData.title}
                              onChange={e => setWellshopLogData(prev => ({ ...prev, title: e.target.value }))}
                              style={{
                                flex: 1, border: '1px solid var(--border-soft)', borderRadius: 8,
                                padding: '4px 8px', fontSize: '0.78rem', fontFamily: "var(--font-label)",
                                color: 'var(--cr8w-text, #2D2438)', background: 'var(--cr8w-surface, #fff)', outline: 'none',
                              }}
                            />
                          </div>
                          <textarea
                            placeholder="reflection (optional)..."
                            value={wellshopLogData.reflection}
                            onChange={e => setWellshopLogData(prev => ({ ...prev, reflection: e.target.value }))}
                            rows={2}
                            style={{
                              border: '1px solid var(--border-soft)', borderRadius: 8, padding: '6px 8px',
                              fontSize: '0.76rem', fontFamily: "var(--font-label)", color: 'var(--cr8w-text, #2D2438)',
                              background: 'var(--cr8w-surface, #fff)', outline: 'none', resize: 'vertical',
                            }}
                          />
                          <button
                            onClick={() => {
                              if (!wellshopLogData.title.trim()) { showToast('add a title first', 'alert'); return; }
                              const entry: WellshopHistoryEntry = {
                                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                                date: wellshopLogData.date || new Date().toISOString().split('T')[0],
                                title: wellshopLogData.title.trim(),
                                reflection: wellshopLogData.reflection.trim(),
                              };
                              const updated = [entry, ...historyEntries];
                              setWellshopHistory(prev => ({ ...prev, [cat.key]: updated }));
                              try { localStorage.setItem(`wellshop_history_${cat.key}`, JSON.stringify(updated)); } catch {}
                              setWellshopLogForm(null);
                              setWellshopLogData({ date: '', title: '', reflection: '' });
                              showToast(`\u{1F4DA} session logged to ${cat.title}`);
                            }}
                            style={{
                              alignSelf: 'flex-end', padding: '5px 16px', borderRadius: 10,
                              fontSize: '0.68rem', fontFamily: 'var(--font-label)', fontWeight: 700,
                              border: 'none', background: cat.accent, color: '#fff', cursor: 'pointer',
                              transition: 'opacity 0.15s',
                            }}
                          >save</button>
                        </div>
                      )}

                      {/* History list */}
                      {wellshopShowHistory[cat.key] && historyEntries.length > 0 && (
                        <div style={{
                          padding: '6px 0', display: 'flex', flexDirection: 'column', gap: 4,
                        }}>
                          {historyEntries.sort((a, b) => b.date.localeCompare(a.date)).map(entry => (
                            <div key={entry.id} style={{
                              padding: '6px 12px', background: 'rgba(255,255,255,0.6)',
                              borderRadius: 8, border: `1px solid ${cat.accent}15`,
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{
                                  fontFamily: 'var(--font-label)', fontSize: '0.58rem', fontWeight: 700,
                                  color: cat.accent, textTransform: 'uppercase', minWidth: 50,
                                }}>
                                  {new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                                <span style={{
                                  fontFamily: "var(--font-label)", fontSize: '0.8rem',
                                  color: 'var(--cr8w-text, #2D2438)', flex: 1,
                                }}>{entry.title}</span>
                                <button
                                  onClick={() => {
                                    const updated = historyEntries.filter(e => e.id !== entry.id);
                                    setWellshopHistory(prev => ({ ...prev, [cat.key]: updated }));
                                    try { localStorage.setItem(`wellshop_history_${cat.key}`, JSON.stringify(updated)); } catch {}
                                  }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.62rem', opacity: 0.4, padding: '2px' }}
                                  title="delete entry"
                                >{'\uD83D\uDDD1\uFE0F'}</button>
                              </div>
                              {entry.reflection && (
                                <div style={{
                                  fontFamily: "var(--font-label)", fontSize: '0.72rem',
                                  color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 3,
                                  paddingLeft: 58, lineHeight: 1.4,
                                }}>{entry.reflection}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {wellshopShowHistory[cat.key] && historyEntries.length === 0 && (
                        <div style={{
                          fontFamily: "var(--font-label)", fontSize: '0.74rem',
                          color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 0',
                        }}>no sessions logged yet</div>
                      )}
                    </div>

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>{/* end .hub-schedule-card */}

          {/* ── Next Up: Upcoming Events Preview ── */}
          {(() => {
            const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
            // Build unified upcoming events list: calendar events + coFlowDates
            type UpcomingEvent = {
              key: string;
              date: Date;
              dateStr: string;
              title: string;
              time: string;
              location?: string;
              type: 'bhd' | 'cr8w' | 'personal' | 'launch';
              persons: string[];
              // BHD-specific enrichment from coFlowDates
              coFlowDate?: CoFlowDate;
              hasCheckin?: boolean;
              checkinCount?: number;
            };

            // Static calendar events from data.ts (legacy — empty array)
            const staticCalEvents: UpcomingEvent[] = CALENDAR_EVENTS
              .map(e => ({ ...e, dateObj: new Date(e.date + 'T00:00:00') }))
              .filter(e => e.dateObj >= todayDate)
              .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
              .slice(0, 8)
              .map((e, i) => {
                let coFlowMatch: CoFlowDate | undefined;
                if (e.type === 'bhd') {
                  coFlowMatch = coFlowDates.find(cf =>
                    cf.date === e.date && (cf.status === 'upcoming' || cf.status === 'active')
                  );
                }
                const checkins = coFlowMatch
                  ? coFlowCheckins.filter(c => c.weekOf === coFlowMatch!.date)
                  : [];
                return {
                  key: `cal-${i}-${e.date}`,
                  date: e.dateObj,
                  dateStr: e.date,
                  title: e.title,
                  time: e.time || '',
                  location: e.location,
                  type: e.type,
                  persons: e.persons,
                  coFlowDate: coFlowMatch,
                  hasCheckin: checkins.length > 0,
                  checkinCount: checkins.length,
                };
              });

            // KV calendar events — deduplicate by canonical ID (strip kv- prefix)
            const kvSeen = new Set<string>();
            const kvCalDeduped = kvCalEvents.filter(ev => {
              const canonical = ev.id.replace(/^kv-/, '');
              if (kvSeen.has(canonical)) return false;
              kvSeen.add(canonical);
              return true;
            });
            const kvEvents: UpcomingEvent[] = kvCalDeduped
              .map(ev => {
                const startDate = new Date(ev.start);
                const dateStr = ev.start.split('T')[0] || startDate.toISOString().split('T')[0];
                const time = startDate.getTime() ? startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase() : '';
                return {
                  key: `kv-${ev.id}`,
                  date: startDate,
                  dateStr,
                  title: ev.title,
                  time,
                  location: ev.location || undefined,
                  type: 'cr8w' as const,
                  persons: ev.creator ? [ev.creator] : [],
                  description: ev.description,
                };
              })
              .filter(e => e.date >= todayDate);

            // Merge, dedup by title+date
            const seenKeys = new Set(staticCalEvents.map(e => `${e.dateStr}::${e.title}`));
            const dedupedKv = kvEvents.filter(e => !seenKeys.has(`${e.dateStr}::${e.title}`));
            const calEvents = [...staticCalEvents, ...dedupedKv];

            // Also add any coFlowDates that don't overlap with calendar BHD events
            const calBhdDates = new Set(calEvents.filter(e => e.type === 'bhd').map(e => e.dateStr));
            const extraCoFlow: UpcomingEvent[] = coFlowDates
              .filter(cf => !calBhdDates.has(cf.date) && (cf.status === 'upcoming' || cf.status === 'active'))
              .filter(cf => new Date(cf.date + 'T00:00:00') >= todayDate)
              .map((cf, i) => {
                const checkins = coFlowCheckins.filter(c => c.weekOf === cf.date);
                return {
                  key: `cf-${cf.id}`,
                  date: new Date(cf.date + 'T00:00:00'),
                  dateStr: cf.date,
                  title: cf.theme ? `behind h0es doors — "${cf.theme}"` : 'behind h0es doors',
                  time: cf.startTime && cf.endTime ? `${cf.startTime} – ${cf.endTime}` : cf.timeRange || '',
                  location: cf.location,
                  type: 'bhd' as const,
                  persons: ['sunshine', 'monny', 'bingle'],
                  coFlowDate: cf,
                  hasCheckin: checkins.length > 0,
                  checkinCount: checkins.length,
                };
              });

            const allUpcoming = [...calEvents, ...extraCoFlow]
              .sort((a, b) => a.date.getTime() - b.date.getTime())
              .slice(0, 5);

            if (allUpcoming.length === 0) return null;

            const TYPE_BADGE: Record<string, { emoji: string; label: string; bg: string; color: string }> = {
              bhd: { emoji: '🚪', label: 'BHD', bg: 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.1)', color: 'var(--cr8w-primary, #7BA89D)' },
              cr8w: { emoji: '🌀', label: 'CR8W', bg: 'rgba(var(--cr8w-secondary-rgb, 184,169,212),0.15)', color: '#8A6A20' },
              personal: { emoji: '🧘', label: 'Personal', bg: 'rgba(139,181,196,0.12)', color: '#3A6A8A' },
              launch: { emoji: '🚀', label: 'LAUNCH', bg: 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.15)', color: 'var(--cr8w-primary, #7BA89D)' },
            };

            function formatRelDate(d: Date): string {
              const diff = Math.ceil((d.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
              if (diff === 0) return 'Today';
              if (diff === 1) return 'Tomorrow';
              const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
              const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              return diff <= 6 ? `${dayName}, ${dateStr}` : dateStr;
            }

            function buildGCalUrl(ev: UpcomingEvent): string {
              const d = ev.dateStr.replace(/-/g, '');
              return `https://www.google.com/calendar/event?action=TEMPLATE&text=${encodeURIComponent(ev.title)}&dates=${d}/${d}&details=${encodeURIComponent('CR8W Dashboard Event')}`;
            }

            return (
              <div style={{
                background: 'var(--cr8w-surface, #FFF8F2)',
                border: '1.5px solid rgba(var(--cr8w-primary-rgb, 123,168,157),0.1)',
                borderRadius: 16,
                padding: '14px 16px',
                marginTop: 12,
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 10,
                }}>
                  <span style={{
                    fontFamily: "var(--font-display)", fontSize: '0.92rem',
                    fontWeight: 600, color: 'var(--cr8w-text, #2C1C10)',
                  }}>📅 next up</span>
                  <span style={{
                    fontFamily: 'var(--font-label)', fontSize: '0.58rem',
                    color: 'var(--text-muted)', fontWeight: 500,
                  }}>{allUpcoming.length} upcoming</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {allUpcoming.map((ev, idx) => {
                    const badge = TYPE_BADGE[ev.type] || TYPE_BADGE.personal;
                    const isExpanded = expandedEventIdx === idx;
                    const relDate = formatRelDate(ev.date);
                    const isToday = relDate === 'Today';
                    const isTomorrow = relDate === 'Tomorrow';
                    const isBHD = ev.type === 'bhd';
                    const needsCheckin = isBHD && ev.coFlowDate && !ev.hasCheckin;

                    return (
                      <div key={ev.key} style={{
                        background: isToday ? 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.06)' : 'var(--cr8w-surface, #fff)',
                        border: isToday
                          ? '1.5px solid rgba(var(--cr8w-primary-rgb, 123,168,157),0.25)'
                          : '1px solid rgba(var(--cr8w-text-rgb, 44,28,16),0.06)',
                        borderRadius: 12,
                        overflow: 'hidden',
                        transition: 'all 0.15s',
                      }}>
                        {/* Main event row */}
                        <div
                          onClick={() => setExpandedEventIdx(isExpanded ? null : idx)}
                          style={{
                            padding: '10px 12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          {/* Date chip */}
                          <div style={{
                            background: isToday ? 'var(--cr8w-primary, #7BA89D)' : isTomorrow ? 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.15)' : 'rgba(var(--cr8w-text-rgb, 44,28,16),0.05)',
                            color: isToday ? '#fff' : isTomorrow ? 'var(--cr8w-primary, #7BA89D)' : 'var(--cr8w-text, #2C1C10)',
                            borderRadius: 8,
                            padding: '4px 8px',
                            fontFamily: 'var(--font-label)',
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            letterSpacing: '0.02em',
                          }}>{relDate}</div>

                          {/* Type badge */}
                          <span style={{
                            background: badge.bg, color: badge.color,
                            borderRadius: 6, padding: '2px 6px',
                            fontFamily: 'var(--font-label)', fontSize: '0.55rem',
                            fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
                            letterSpacing: '0.03em', textTransform: 'uppercase',
                          }}>{badge.emoji} {badge.label}</span>

                          {/* Title + time */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontFamily: "var(--font-label)", fontSize: '0.82rem',
                              color: '#2C1C10', fontWeight: 600,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>{ev.title}</div>
                            <div style={{
                              fontFamily: 'var(--font-label)', fontSize: '0.6rem',
                              color: 'var(--text-muted)',
                              display: 'flex', gap: 6, alignItems: 'center', marginTop: 1,
                            }}>
                              {ev.time && <span>{ev.time}</span>}
                              {ev.location && <><span style={{ opacity: 0.3 }}>·</span><span>{ev.location}</span></>}
                            </div>
                          </div>

                          {/* Checkin needed indicator */}
                          {needsCheckin && (
                            <span style={{
                              width: 8, height: 8, borderRadius: '50%',
                              background: '#FF9500', flexShrink: 0,
                            }} title="Check-in needed" />
                          )}

                          {/* Expand chevron */}
                          <span style={{
                            fontSize: '0.6rem', color: 'var(--text-muted)',
                            transition: 'transform 0.2s',
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            flexShrink: 0,
                          }}>▼</span>
                        </div>

                        {/* Expanded dropdown */}
                        {isExpanded && (
                          <div style={{
                            borderTop: '1px solid rgba(44,28,16,0.06)',
                            padding: '10px 12px 12px',
                            background: 'rgba(255,255,255,0.5)',
                            animation: 'cw-fadeInUp 0.2s ease',
                          }}>
                            {/* Event overview */}
                            <div style={{ marginBottom: 10 }}>
                              {isBHD && ev.coFlowDate && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {ev.coFlowDate.theme && (
                                    <div style={{
                                      fontFamily: "var(--font-label)", fontSize: '0.82rem',
                                      color: 'var(--cr8w-primary, #7BA89D)', fontStyle: 'italic',
                                    }}>"{ev.coFlowDate.theme}"</div>
                                  )}
                                  {ev.coFlowDate.host && (
                                    <div style={{
                                      fontFamily: 'var(--font-label)', fontSize: '0.62rem',
                                      color: 'var(--text-muted)',
                                    }}>
                                      Hosted by <strong style={{ color: PERSONS[ev.coFlowDate.host]?.color || '#2C1C10' }}>
                                        {PERSONS[ev.coFlowDate.host]?.emoji} {capitalize(ev.coFlowDate.host)}
                                      </strong>
                                    </div>
                                  )}
                                  <div style={{
                                    display: 'flex', gap: 8, flexWrap: 'wrap',
                                    fontFamily: 'var(--font-label)', fontSize: '0.6rem',
                                    color: 'var(--text-muted)',
                                  }}>
                                    {ev.coFlowDate.location && (
                                      <span>📍 {ev.coFlowDate.location}</span>
                                    )}
                                    {ev.coFlowDate.agendaItems?.length > 0 && (
                                      <span>📋 {ev.coFlowDate.agendaItems.length} agenda item{ev.coFlowDate.agendaItems.length !== 1 ? 's' : ''}</span>
                                    )}
                                    {ev.checkinCount !== undefined && ev.checkinCount > 0 && (
                                      <span>✅ {ev.checkinCount}/3 check-in{ev.checkinCount !== 1 ? 's' : ''}</span>
                                    )}
                                    {/* RSVP summary */}
                                    {ev.coFlowDate.rsvp && Object.keys(ev.coFlowDate.rsvp).length > 0 && (
                                      <span>
                                        {Object.entries(ev.coFlowDate.rsvp).map(([person, status]) => (
                                          <span key={person} style={{ marginRight: 4 }} title={`${capitalize(person)}: ${status}`}>
                                            {PERSONS[person]?.emoji || '👤'}
                                            {status === 'yes' ? '✓' : status === 'no' ? '✕' : '?'}
                                          </span>
                                        ))}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}

                              {!isBHD && (
                                <div style={{
                                  fontFamily: 'var(--font-label)', fontSize: '0.62rem',
                                  color: 'var(--text-muted)', display: 'flex', gap: 6, flexWrap: 'wrap',
                                }}>
                                  {ev.persons.map(p => (
                                    <span key={p} style={{ color: PERSONS[p]?.color || '#2C1C10' }}>
                                      {PERSONS[p]?.emoji} {capitalize(p)}
                                    </span>
                                  ))}
                                  {ev.location && <span>📍 {ev.location}</span>}
                                </div>
                              )}
                            </div>

                            {/* Notification CTA for BHD events needing check-in */}
                            {needsCheckin && (
                              <div
                                onClick={() => onNavigate('coflow')}
                                style={{
                                  background: 'rgba(255,149,0,0.08)',
                                  border: '1px solid rgba(255,149,0,0.25)',
                                  borderRadius: 10,
                                  padding: '8px 12px',
                                  marginBottom: 10,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                }}
                              >
                                <span style={{ fontSize: '0.9rem' }}>⚠️</span>
                                <div>
                                  <div style={{
                                    fontFamily: "var(--font-display)", fontSize: '0.78rem',
                                    color: '#8A6A20', fontWeight: 600,
                                  }}>Check-in needed</div>
                                  <div style={{
                                    fontFamily: 'var(--font-label)', fontSize: '0.58rem',
                                    color: 'rgba(138,106,32,0.7)',
                                  }}>Submit your PlayD8s check-in: time confirmation, agenda items & vibe</div>
                                </div>
                                <span style={{ fontSize: '0.7rem', color: '#8A6A20', flexShrink: 0, fontWeight: 600 }}>→</span>
                              </div>
                            )}

                            {/* Action buttons row */}
                            <div style={{
                              display: 'flex', gap: 8, flexWrap: 'wrap',
                            }}>
                              {/* Google Calendar link */}
                              <a
                                href={buildGCalUrl(ev)}
                                target="_blank" rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 5,
                                  padding: '6px 12px', borderRadius: 8,
                                  background: 'rgba(26,115,232,0.08)',
                                  border: '1px solid rgba(26,115,232,0.2)',
                                  color: '#1A73E8',
                                  fontFamily: 'var(--font-label)', fontSize: '0.62rem',
                                  fontWeight: 600, textDecoration: 'none',
                                  cursor: 'pointer', transition: 'all 0.15s',
                                  letterSpacing: '0.02em',
                                }}
                              >
                                📅 Google Calendar
                              </a>

                              {/* In-app PlayD8s link (BHD events only) */}
                              {isBHD && (
                                <button
                                  onClick={e => { e.stopPropagation(); onNavigate('coflow'); }}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 5,
                                    padding: '6px 12px', borderRadius: 8,
                                    background: 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.08)',
                                    border: '1px solid rgba(var(--cr8w-primary-rgb, 123,168,157),0.2)',
                                    color: 'var(--cr8w-primary, #7BA89D)',
                                    fontFamily: 'var(--font-label)', fontSize: '0.62rem',
                                    fontWeight: 600, cursor: 'pointer',
                                    transition: 'all 0.15s',
                                    letterSpacing: '0.02em',
                                  }}
                                >
                                  🚪 Open PlayD8s
                                </button>
                              )}

                              {/* Geyser link for CR8W/launch events */}
                              {(ev.type === 'cr8w' || ev.type === 'launch') && (
                                <button
                                  onClick={e => { e.stopPropagation(); onNavigate('geyser'); }}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 5,
                                    padding: '6px 12px', borderRadius: 8,
                                    background: 'rgba(212,167,113,0.1)',
                                    border: '1px solid rgba(212,167,113,0.25)',
                                    color: '#8A6A20',
                                    fontFamily: 'var(--font-label)', fontSize: '0.62rem',
                                    fontWeight: 600, cursor: 'pointer',
                                    transition: 'all 0.15s',
                                    letterSpacing: '0.02em',
                                  }}
                                >
                                  ⛲️ Open Geyser
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>{/* end .hub-col-primary */}

        <div className="hub-col-secondary">
          {/* ── TOOLS ─────────────────────────────── */}
          <div className="hub-section-sm">
            <div className="hub-section-header">
              <span className="hub-section-title">Tools</span>
            </div>

            {/* CR8W cluster: Invite List · Stations */}
            <div className="hub-tools-grid hub-tools-grid-2">
              <a
                href="https://docs.google.com/spreadsheets/d/1yTemDgbFQG3SdkD8uy-0v1Ogc0XIyS2sWj-iR-xLToc/edit"
                target="_blank" rel="noopener noreferrer"
                className="hub-tool-tile hub-tool-tile-internal"
              >
                <div className="hub-tool-tile-logo" style={{ fontSize: '1.6rem', lineHeight: 1 }}>📋</div>
                <span className="hub-tool-tile-label">Invite List</span>
              </a>
              <button
                className="hub-tool-tile hub-tool-tile-internal"
                onClick={() => onNavigateGeyserStations()}
              >
                <div className="hub-tool-tile-logo" style={{ fontSize: '1.6rem', lineHeight: 1 }}>📍</div>
                <span className="hub-tool-tile-label">Stations</span>
              </button>
            </div>

            {/* Workspace tools */}
            <div className="hub-tools-grid hub-tools-grid-3">
              {WORKSPACE_TOOLS.map(({ id, label, Logo, href }) => (
                <a
                  key={id}
                  href={href}
                  target="_blank" rel="noopener noreferrer"
                  className={`hub-tool-tile${id === 'gcal' ? ' hub-tool-tile-gcal' : ''}`}
                  style={{ position: 'relative' }}
                >
                  {id === 'gcal' && gcalConnected && (
                    <span className="hub-gcal-connected-badge">Connected</span>
                  )}
                  <div className="hub-tool-tile-logo"><Logo size={28} /></div>
                  <span className="hub-tool-tile-label">{label}</span>
                </a>
              ))}
            </div>
          </div>

          {/* 3 Avatar Circles — expandable profile cards */}
          <div className="hub-avatars-row" style={{ position: 'relative' }}>
            {Object.entries(PERSONS).map(([key, p]) => {
              const isExpanded = expandedProfileKey === key;
              const meta = PROFILE_META[key];
              // Energy battery from arrive state
              const arriveVal = localStorage.getItem('arriveState');
              const energyLevel = arriveVal === 'fired' ? 3 : arriveVal === 'flowing' ? 2 : arriveVal === 'foggy' ? 1 : 0;
              return (
                <div key={key} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <button
                    className="hub-avatar-circle"
                    style={{ background: `${p.color}28`, borderColor: p.color, transition: 'transform 0.2s, box-shadow 0.2s', ...(isExpanded ? { transform: 'scale(1.12)', boxShadow: `0 0 0 3px ${p.color}40` } : {}) }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedProfileKey(isExpanded ? null : key);
                    }}
                    title={`${p.name}'s Profile`}
                  >
                    <span className="hub-avatar-emoji">{p.emoji}</span>
                    <span className="hub-avatar-name">{p.name}</span>
                  </button>

                  {/* Expanded Profile Card */}
                  {isExpanded && (
                    <div
                      className="profile-card-expanded"
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 260,
                        marginTop: 8,
                        background: '#fff',
                        borderRadius: 14,
                        border: `1.5px solid ${p.color}40`,
                        boxShadow: `0 8px 28px rgba(0,0,0,0.10), 0 0 0 1px ${p.color}15`,
                        padding: '14px 16px',
                        zIndex: 50,
                        overflow: 'hidden',
                        animation: 'profileCardIn 0.3s ease',
                      }}
                      onClick={e => e.stopPropagation()}
                    >
                      <style>{`
                        @keyframes profileCardIn {
                          from { opacity: 0; max-height: 0; transform: translateX(-50%) translateY(-6px); }
                          to { opacity: 1; max-height: 400px; transform: translateX(-50%) translateY(0); }
                        }
                      `}</style>

                      {/* Name + HD Type */}
                      <div style={{
                        fontFamily: "var(--font-display)", fontSize: '14px', fontWeight: 600,
                        color: 'var(--cr8w-text, #2D2438)', marginBottom: 4, lineHeight: 1.3,
                      }}>
                        {p.name} <span style={{ color: p.color, fontWeight: 500 }}>— {meta?.hdType}</span>
                      </div>

                      {/* Zone description */}
                      <div style={{
                        fontFamily: "var(--font-label)", fontSize: '12px', fontStyle: 'italic',
                        color: 'var(--text-muted, #8A7D72)', lineHeight: 1.4, marginBottom: 10,
                      }}>
                        {meta?.zone}
                      </div>

                      {/* Currently holding — editable */}
                      <div style={{ marginBottom: 10 }}>
                        <label style={{
                          fontFamily: 'var(--font-label)', fontSize: '0.56rem', fontWeight: 700,
                          color: p.color, textTransform: 'uppercase', letterSpacing: '0.04em',
                          display: 'block', marginBottom: 3,
                        }}>currently holding</label>
                        <input
                          type="text"
                          value={profileHolding[key] || ''}
                          placeholder="what are you holding this week?"
                          onChange={e => {
                            const val = e.target.value;
                            setProfileHolding(prev => ({ ...prev, [key]: val }));
                            try { localStorage.setItem(`profile_holding_${key}`, val); } catch {}
                          }}
                          style={{
                            width: '100%', border: '1px solid var(--border-soft, #e0dcd7)',
                            borderRadius: 8, padding: '5px 10px', fontSize: '0.78rem',
                            fontFamily: "var(--font-label)", color: 'var(--cr8w-text, #2D2438)',
                            background: 'var(--cr8w-surface, #FAFAF8)', outline: 'none', boxSizing: 'border-box',
                            transition: 'border-color 0.15s',
                          }}
                          onFocus={e => e.currentTarget.style.borderColor = p.color}
                          onBlur={e => e.currentTarget.style.borderColor = 'var(--border-soft, #e0dcd7)'}
                        />
                      </div>

                      {/* Energy battery — 3 segments */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                        <span style={{
                          fontFamily: 'var(--font-label)', fontSize: '0.56rem', fontWeight: 700,
                          color: 'var(--text-muted, #8A7D72)', textTransform: 'uppercase', letterSpacing: '0.03em',
                        }}>energy</span>
                        <div style={{ display: 'flex', gap: 3 }}>
                          {[1, 2, 3].map(seg => (
                            <div key={seg} style={{
                              width: 22, height: 10, borderRadius: 3,
                              border: `1.5px solid ${energyLevel >= seg ? p.color : '#D5D0CB'}`,
                              background: energyLevel >= seg ? `${p.color}50` : 'transparent',
                              transition: 'all 0.2s',
                            }} />
                          ))}
                        </div>
                        <span style={{
                          fontFamily: 'var(--font-label)', fontSize: '0.52rem',
                          color: 'var(--text-muted, #8A7D72)', fontStyle: 'italic',
                        }}>
                          {energyLevel === 3 ? 'fired up' : energyLevel === 2 ? 'flowing' : energyLevel === 1 ? 'foggy' : 'not set'}
                        </span>
                      </div>

                      {/* Craft one-liner */}
                      <div style={{
                        fontFamily: "var(--font-label)", fontSize: '0.72rem',
                        color: 'var(--cr8w-text, #2D2438)', opacity: 0.5, lineHeight: 1.3,
                        borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: 8,
                      }}>
                        {meta?.craft}
                      </div>

                      {/* Go to dashboard link */}
                      <button
                        onClick={() => { setExpandedProfileKey(null); onNavigate(key); }}
                        style={{
                          marginTop: 8, width: '100%', padding: '6px 0',
                          borderRadius: 8, border: `1px solid ${p.color}40`,
                          background: `${p.color}10`, color: p.color,
                          fontFamily: 'var(--font-label)', fontSize: '0.62rem',
                          fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                          textTransform: 'uppercase', letterSpacing: '0.03em',
                        }}
                      >open {p.name.toLowerCase()}'s dashboard →</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>{/* end .hub-col-secondary */}
      </div>{/* end .hub-columns */}

      {/* ── Two-column: Brain Dump + MBody ── */}
      <div className="hub-columns">
        <div className="hub-col-primary">
      {/* Brain Dump */}
      <div className="hub-section-sm">
        <div className="hub-section-header">
          <span className="hub-section-title">Brain Dump</span>
          {brainDumps.length > 3 && (
            <button className="hub-see-all" onClick={() => setShowAllDumps(!showAllDumps)}>
              {showAllDumps ? 'show less' : `see all ${brainDumps.length}`}
            </button>
          )}
        </div>
        <div className="hub-dump-card">
          {/* Titration Dial: quiet mode indicator */}
          {visibilityDial === 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px',
              background: 'rgba(139,181,196,0.1)',
              borderRadius: '10px 10px 0 0',
              borderBottom: '1px solid rgba(139,181,196,0.15)',
              fontFamily: 'var(--font-label)',
              fontSize: '0.62rem',
              color: '#8BB5C4',
              fontWeight: 600,
              letterSpacing: '0.02em',
              animation: 'cw-fadeInUp 0.3s ease',
            }}>
              🫧 quiet mode — your dump will post anonymously
            </div>
          )}
          {visibilityDial === 2 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px',
              background: 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.08)',
              borderRadius: '10px 10px 0 0',
              borderBottom: '1px solid rgba(var(--cr8w-primary-rgb, 123,168,157),0.12)',
              fontFamily: 'var(--font-label)',
              fontSize: '0.62rem',
              color: 'var(--cr8w-primary, #7BA89D)',
              fontWeight: 600,
              letterSpacing: '0.02em',
              animation: 'cw-fadeInUp 0.3s ease',
            }}>
              🔥 open mode — your presence is fully visible
            </div>
          )}
          <div className="hub-dump-input-row">
            <select
              className="hub-dump-select"
              value={visibilityDial === 0 ? 'anonymous' : dumpAuthor}
              onChange={e => setDumpAuthor(e.target.value)}
              disabled={visibilityDial === 0}
              style={visibilityDial === 0 ? { opacity: 0.5 } : undefined}
            >
              {visibilityDial === 0 ? (
                <option value="anonymous">🫧 Anonymous</option>
              ) : (
                <>
              <option value="sunshine">☀️ Sunshine</option>
              <option value="monny">🌊 Monny</option>
              <option value="bingle">✨ Bingle</option>
              <option value="collective">🌀 Collective</option>
                </>
              )}
            </select>
            <input
              type="text"
              className="hub-dump-input"
              placeholder="Quick thought, idea, or brain dump..."
              value={dumpContent}
              onChange={e => setDumpContent(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitBrainDump(); }}
            />
            <button className="hub-dump-btn" onClick={submitBrainDump}>Dump 🧠</button>
          </div>
          {/* Tag pills */}
          <div style={{ display: 'flex', gap: 4, padding: '4px 12px 6px', flexWrap: 'wrap' }}>
            {DUMP_TAG_PILLS.map(t => (
              <button
                key={t.key}
                onClick={() => setDumpTag(dumpTag === t.key ? null : t.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 3,
                  padding: '3px 10px', borderRadius: 14, fontSize: '0.66rem',
                  fontFamily: 'var(--font-label)', fontWeight: 600, cursor: 'pointer',
                  border: dumpTag === t.key ? '1.5px solid var(--cr8w-primary, #7BA89D)' : '1px solid var(--border-soft)',
                  background: dumpTag === t.key ? 'var(--cr8w-primary, #7BA89D)' : 'transparent',
                  color: dumpTag === t.key ? '#fff' : 'var(--text-muted)',
                  transition: 'all 0.15s',
                }}
              ><span style={{ fontSize: '0.72rem' }}>{t.icon}</span> {t.label}</button>
            ))}
          </div>
          {/* Filter pills */}
          <div style={{ display: 'flex', gap: 4, padding: '2px 12px 4px', flexWrap: 'wrap' }}>
            {[
              { key: 'all', label: '🌀 All' },
              { key: 'sunshine', label: '☀️ Sunshine' },
              { key: 'monny', label: '🌊 Monny' },
              { key: 'bingle', label: '✨ Bingle' },
              { key: 'collective', label: '🌀 Collective' },
              ...(brainDumps.some(d => d.author === 'anonymous') ? [{ key: 'anonymous', label: '🫧 Anon' }] : []),
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setDumpFilter(f.key)}
                style={{
                  padding: '3px 10px', borderRadius: 14, fontSize: '0.68rem',
                  fontFamily: 'var(--font-label)', fontWeight: 600, cursor: 'pointer',
                  border: dumpFilter === f.key ? '1.5px solid var(--cr8w-primary, #7BA89D)' : '1px solid var(--border-soft)',
                  background: dumpFilter === f.key ? 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.12)' : 'transparent',
                  color: dumpFilter === f.key ? 'var(--cr8w-primary, #7BA89D)' : 'var(--text-muted)',
                  transition: 'all 0.15s',
                }}
              >{f.label}</button>
            ))}
          </div>
          {/* ── Bubbling Up section ── */}
          {bubblingUpItem && (
            <div style={{
              margin: '8px 12px', padding: '10px 14px',
              border: '1.5px dashed rgba(var(--cr8w-primary-rgb, 123,168,157),0.5)',
              borderRadius: 14, background: 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.04)',
              animation: 'cw-fadeInUp 0.35s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: '0.72rem' }}>{'\u{1FAE7}'}</span>
                <span style={{
                  fontFamily: 'var(--font-label)', fontSize: '0.62rem', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--cr8w-primary, #7BA89D)',
                }}>Bubbling Up</span>
                <span style={{
                  fontFamily: 'var(--font-label)', fontSize: '0.58rem', color: 'var(--text-muted)',
                  fontStyle: 'italic',
                }}>dropped {bubblingUpDaysAgo} day{bubblingUpDaysAgo !== 1 ? 's' : ''} ago</span>
              </div>
              <div style={{
                fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-primary)',
                lineHeight: 1.5, marginBottom: 10,
              }}>{bubblingUpItem.content}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => resetDumpTimer(bubblingUpItem.id)}
                  title="Still alive — reset timer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '4px 10px', borderRadius: 12, fontSize: '0.64rem',
                    fontFamily: 'var(--font-label)', fontWeight: 600, cursor: 'pointer',
                    border: '1px solid var(--border-soft)', background: 'transparent',
                    color: 'var(--text-primary)', transition: 'all 0.15s',
                  }}
                >{'\u{1F331}'} still alive</button>
                <button
                  onClick={() => sendDumpToPlayground(bubblingUpItem)}
                  title="Send to Playground"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '4px 10px', borderRadius: 12, fontSize: '0.64rem',
                    fontFamily: 'var(--font-label)', fontWeight: 600, cursor: 'pointer',
                    border: '1px solid var(--border-soft)', background: 'transparent',
                    color: 'var(--text-primary)', transition: 'all 0.15s',
                  }}
                >{'\u26FA'} send to playground</button>
                <button
                  onClick={() => archiveDump(bubblingUpItem.id)}
                  title="Let it rest — archive"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '4px 10px', borderRadius: 12, fontSize: '0.64rem',
                    fontFamily: 'var(--font-label)', fontWeight: 600, cursor: 'pointer',
                    border: '1px solid var(--border-soft)', background: 'transparent',
                    color: 'var(--text-muted)', transition: 'all 0.15s',
                  }}
                >{'\u{1FAA6}'} let it rest</button>
              </div>
            </div>
          )}

          {filteredDumps.length === 0 && brainDumps.length > 0 ? (
            <div className="hub-empty-dump">No dumps from {dumpFilter} yet</div>
          ) : brainDumps.length === 0 ? (
            <div className="hub-empty-dump">No brain dumps yet — be the first to drop a thought 🧠</div>
          ) : (
            <div className="hub-dump-list">
              {visibleDumps.map(d => {
                const isAnon = d.author === 'anonymous';
                const p = PERSONS[d.author];
                const color = isAnon ? '#8BB5C4' : (p ? p.color : 'var(--cr8w-primary, #7BA89D)');
                const emoji = isAnon ? '🫧' : (p ? p.emoji : '🌀');
                const displayName = isAnon ? 'anonymous' : capitalize(d.author);
                const tagKey = d.tags?.trim();
                const tagPill = DUMP_TAG_PILLS.find(t => t.key === tagKey);
                const isSentToPg = sentToPlayground.has(d.id);
                return (
                  <div key={d.id} className="hub-dump-entry" style={{
                    opacity: isSentToPg ? 0.5 : 1,
                    textDecoration: isSentToPg ? 'line-through' : 'none',
                    transition: 'opacity 0.2s',
                  }}>
                    <span className="hub-dump-author" style={{ color, fontStyle: isAnon ? 'italic' : 'normal' }}>{emoji} {displayName}</span>
                    <span className="hub-dump-content">{d.content}</span>
                    {tagPill && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 2,
                        padding: '1px 7px', borderRadius: 10, fontSize: '0.58rem',
                        fontFamily: 'var(--font-label)', fontWeight: 600,
                        background: 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.12)', color: 'var(--cr8w-primary, #7BA89D)',
                        border: '1px solid rgba(var(--cr8w-primary-rgb, 123,168,157),0.25)',
                        marginLeft: 4, textDecoration: 'none',
                      }}>{tagPill.icon} {tagPill.label}</span>
                    )}
                    <span className="hub-dump-time">{formatTimestamp(d.created_at)}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      {tagKey === 'playground' && !isSentToPg && (
                        <button
                          onClick={() => sendDumpToPlayground(d)}
                          title="Send to Playground Brain Lumps"
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: '0.78rem', padding: '2px 4px', opacity: 0.7,
                            transition: 'opacity 0.15s', textDecoration: 'none',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
                        >{'\u2197\uFE0F'}{'\u26FA'}</button>
                      )}
                      <button className="hub-dump-delete" onClick={() => onDeleteBrainDump(d.id)}>🗑️</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

        </div>{/* end .hub-col-primary (brain dump) */}

        <div className="hub-col-secondary">
          {/* MBody — wellness roulette */}
          <div className="hub-section-sm">
            <MBodyWidget />
          </div>
        </div>{/* end .hub-col-secondary (mbody) */}
      </div>{/* end .hub-columns (brain dump + mbody) */}

      {/* Notes from the Well — community exchange */}
      <NotesFromTheWell wellNotes={wellNotes} onAddNote={onAddWellNote} onLandNote={onLandWellNote} />

      {/* Collective Synergy */}
      <div className="hub-section-sm">
        <div
          className="hub-synergy-header"
          onClick={() => setShowSynergy(!showSynergy)}
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setShowSynergy(!showSynergy); }}
        >
          <span>✨ Collective Synergy</span>
          <span className="hub-synergy-summary">ManiGen + Generator + Projector = Complete Creative Engine</span>
          <span className={`hub-chevron ${showSynergy ? 'open' : ''}`}>›</span>
        </div>
        <div className={`hub-synergy-body ${showSynergy ? 'open' : ''}`}>
          <div>
            <div className="hub-synergy-trio">
              {Object.entries(PERSONS).map(([key, p]) => (
                <button key={key} className="hub-synergy-member" style={{ borderTop: `3px solid ${p.color}` }} onClick={() => onNavigate(key)}>
                  <span className="hub-synergy-emoji">{p.emoji}</span>
                  <div className="hub-synergy-name">{p.name}</div>
                  <div className="hub-synergy-role">{p.role.split('·')[0].trim()}</div>
                </button>
              ))}
            </div>
            <div className="hub-synergy-insights">
              {SYNERGY_SECTIONS_DATA.map((s) => {
                const isOpen = openSynergySections.has(s.id);
                return (
                  <div key={s.id} style={{ marginBottom: 6 }}>
                    <button
                      onClick={() => {
                        const newSet = new Set(openSynergySections);
                        if (newSet.has(s.id)) newSet.delete(s.id);
                        else newSet.add(s.id);
                        setOpenSynergySections(newSet);
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                        background: isOpen ? 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.06)' : 'transparent',
                        border: isOpen ? '1px solid rgba(var(--cr8w-primary-rgb, 123,168,157),0.15)' : '1px solid var(--border-soft)',
                        borderRadius: 10, padding: '10px 14px', cursor: 'pointer',
                        textAlign: 'left', transition: 'all 0.2s',
                      }}
                    >
                      <span style={{ fontSize: '1rem', flexShrink: 0 }}>{s.icon}</span>
                      <span style={{
                        flex: 1, fontFamily: 'var(--font-label)', fontSize: '0.78rem',
                        fontWeight: 700, color: isOpen ? 'var(--cr8w-primary)' : 'var(--text-primary)',
                        letterSpacing: '0.02em',
                      }}>
                        {s.title}
                      </span>
                      <span style={{
                        fontSize: '0.7rem', color: 'var(--text-muted)',
                        transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s',
                      }}>›</span>
                    </button>
                    {isOpen && (
                      <div style={{
                        padding: '14px 14px 10px',
                        borderLeft: '2px solid rgba(var(--cr8w-primary-rgb, 123,168,157),0.2)',
                        marginLeft: 18,
                        marginTop: 4,
                      }}>
                        {s.content}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="hub-footer">
        <div className="hub-footer-brand">create well collective</div>
        <div className="hub-footer-quote">"Here, is where you fall in love with the process."</div>
      </footer>
    </section>
  );
}