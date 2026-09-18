import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, Plus, Search, X, Sparkles, Brain, Sprout, Palette, ParkingCircle, Trash2, Zap, HelpCircle, BookOpen, Shuffle } from 'lucide-react';
import { showToast } from './Toast';
import * as api from './api';
import type { ParkingLotItem } from './api';

/* ─── Types ─────────────────────────────────────────────────── */
interface GlossaryTerm { id: string; word: string; definition: string; ts: number; }
interface BrainLump { id: string; text: string; ts: number; }
interface Seed { id: string; text: string; area: string; ts: number; }
interface BrandLabItem { id: string; text: string; tab: 'voice' | 'visual'; ts: number; }
interface ParkingItem { id: string; text: string; ts: number; }

interface PlaygroundData {
  glossary: GlossaryTerm[];
  brainLumps: BrainLump[];
  seeds: Seed[];
  brandLab: BrandLabItem[];
  parking: ParkingItem[];
}

const LS_KEY = 'cr8w_playground';
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const DEFAULT_GLOSSARY: GlossaryTerm[] = [
  { id: uid(), word: 'wellstreaming', definition: 'The practice of openly sharing your creative process in real-time, letting others witness the flow before it becomes polished.', ts: Date.now() },
  { id: uid(), word: 'decomprocessing', definition: 'Intentionally breaking down a finished creative output to understand the emotional and cognitive layers that built it.', ts: Date.now() },
  { id: uid(), word: 'ofcoursement', definition: 'The moment of recognition when something you created feels inevitable, like it was always supposed to exist.', ts: Date.now() },
  { id: uid(), word: 'co-hoerence', definition: 'The state of creative alignment between collaborators where individual voices merge into a unified yet multi-textured output.', ts: Date.now() },
  { id: uid(), word: 'titrationship', definition: 'The calibrated practice of adjusting how much of yourself you share in creative spaces — finding the right dose of vulnerability.', ts: Date.now() },
  { id: uid(), word: 'restoryation', definition: 'The act of revisiting and rewriting personal narratives to reclaim agency over your creative identity.', ts: Date.now() },
  { id: uid(), word: 'IndividiWell', definition: 'Your unique creative wellspring — the intersection of your lived experience, instincts, and expressive style that no one else can replicate.', ts: Date.now() },
  { id: uid(), word: 'wellmates', definition: 'Creative collaborators who draw from the same well of inspiration and hold space for each other\'s process.', ts: Date.now() },
  { id: uid(), word: 'softlanding', definition: 'A gentle re-entry practice after deep creative immersion, allowing the maker to transition back without jarring context-switches.', ts: Date.now() },
  { id: uid(), word: 'monshiniverse', definition: 'The personal constellation of ideas, aesthetics, and references that orbit around a single creative mind — Monny\'s signature cosmos.', ts: Date.now() },
  { id: uid(), word: 'ginhawa', definition: 'A Filipino concept of inner breath or ease — the feeling when creative work flows without resistance, when making feels like breathing.', ts: Date.now() },
  { id: uid(), word: 'firstlanguage', definition: 'The primary creative medium through which someone naturally thinks and communicates — be it music, movement, words, or visual form.', ts: Date.now() },
];

function loadData(): PlaygroundData {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { glossary: DEFAULT_GLOSSARY, brainLumps: [], seeds: [], brandLab: [], parking: [] };
}
function saveData(d: PlaygroundData) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(d));
  } catch {
    showToast('\u26A0\uFE0F couldn\u2019t save \u2014 try again', 'alert');
  }
}

/* ─── Accordion wrapper ─────────────────────────────────────── */
function Section({ title, icon, barColor, open, onToggle, count, children }: {
  title: string; icon: React.ReactNode; barColor: string;
  open: boolean; onToggle: () => void; count: number;
  children: React.ReactNode;
}) {
  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-sm)', background: '#fff' }}>
      <button
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, width: '100%',
          padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer',
          borderLeft: `5px solid ${barColor}`, textAlign: 'left',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-warm)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      >
        <span style={{ fontSize: '1.15rem', display: 'flex' }}>{icon}</span>
        <span style={{ flex: 1, fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          {title}
        </span>
        <span style={{
          fontFamily: 'var(--font-label)', fontSize: '0.7rem', fontWeight: 700,
          background: `${barColor}22`, color: barColor, padding: '3px 10px',
          borderRadius: 12, letterSpacing: '0.04em',
        }}>
          {count}
        </span>
        <ChevronDown size={18} style={{
          color: 'var(--text-muted)', transition: 'transform 0.25s',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        }} />
      </button>
      <div style={{
        maxHeight: open ? 2000 : 0, overflow: 'hidden',
        transition: 'max-height 0.4s ease, opacity 0.25s ease',
        opacity: open ? 1 : 0,
        borderLeft: `5px solid ${barColor}`,
        borderTop: open ? '1px solid var(--border-soft)' : 'none',
      }}>
        <div style={{ padding: '16px 20px 20px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ─── Inline add form ──────────────────────────────────────── */
function InlineAdd({ placeholder, onAdd, fields }: {
  placeholder: string;
  onAdd: (vals: Record<string, string>) => void;
  fields?: { key: string; placeholder: string; options?: string[] }[];
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const mainKey = fields?.[0]?.key || 'text';

  function submit() {
    if (!(values[mainKey] || '').trim()) return;
    onAdd(values);
    setValues({});
  }

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {(fields || [{ key: 'text', placeholder }]).map(f => (
        f.options ? (
          <select
            key={f.key}
            value={values[f.key] || ''}
            onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
            style={{
              fontFamily: 'var(--font-body)', fontSize: '0.82rem', padding: '8px 10px',
              border: '1.5px solid var(--border-soft)', borderRadius: 8,
              background: 'var(--bg-warm)', color: 'var(--text-primary)', cursor: 'pointer',
            }}
          >
            <option value="">{f.placeholder}</option>
            {f.options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input
            key={f.key}
            value={values[f.key] || ''}
            onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder={f.placeholder}
            style={{
              flex: 1, minWidth: 140,
              fontFamily: 'var(--font-body)', fontSize: '0.84rem', padding: '8px 12px',
              border: '1.5px solid var(--border-soft)', borderRadius: 8,
              background: 'var(--bg-warm)', color: 'var(--text-primary)',
            }}
          />
        )
      ))}
      <button
        onClick={submit}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '8px 16px', background: 'var(--cr8w-primary, #7BA89D)', color: '#fff',
          border: 'none', borderRadius: 8, fontFamily: 'var(--font-label)',
          fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer',
          letterSpacing: '0.4px', textTransform: 'uppercase',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--cr8w-btn-hover, #5F8D82)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--cr8w-primary, #7BA89D)')}
      >
        <Plus size={14} /> Add
      </button>
    </div>
  );
}

function relativeTime(ts: number) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ═══ Main Component ═══════════════════════════════════════════ */
export function PlaygroundView() {
  const [data, setData] = useState<PlaygroundData>(loadData);
  const [search, setSearch] = useState('');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [brandTab, setBrandTab] = useState<'voice' | 'visual'>('voice');

  const persist = useCallback((updater: (prev: PlaygroundData) => PlaygroundData) => {
    setData(prev => {
      const next = updater(prev);
      saveData(next);
      return next;
    });
  }, []);

  const toggle = (key: string) => setOpenSections(s => ({ ...s, [key]: !s[key] }));

  const q = search.toLowerCase().trim();

  const filteredGlossary = useMemo(() =>
    q ? data.glossary.filter(t => t.word.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q)) : data.glossary,
  [data.glossary, q]);

  const filteredLumps = useMemo(() =>
    q ? data.brainLumps.filter(l => l.text.toLowerCase().includes(q)) : data.brainLumps,
  [data.brainLumps, q]);

  const filteredSeeds = useMemo(() =>
    q ? data.seeds.filter(s => s.text.toLowerCase().includes(q) || s.area.toLowerCase().includes(q)) : data.seeds,
  [data.seeds, q]);

  const filteredBrand = useMemo(() =>
    q ? data.brandLab.filter(b => b.text.toLowerCase().includes(q)) : data.brandLab,
  [data.brandLab, q]);

  const filteredParking = useMemo(() =>
    q ? data.parking.filter(p => p.text.toLowerCase().includes(q)) : data.parking,
  [data.parking, q]);

  const totalResults = q ? filteredGlossary.length + filteredLumps.length + filteredSeeds.length + filteredBrand.length + filteredParking.length : -1;

  // Auto-open sections that have search results
  useEffect(() => {
    if (!q) return;
    const opens: Record<string, boolean> = {};
    if (filteredGlossary.length) opens.glossary = true;
    if (filteredLumps.length) opens.brainLumps = true;
    if (filteredSeeds.length) opens.seeds = true;
    if (filteredBrand.length) opens.brandLab = true;
    if (filteredParking.length) opens.parking = true;
    setOpenSections(s => ({ ...s, ...opens }));
  }, [q]);

  function removeItem(section: keyof PlaygroundData, id: string) {
    persist(prev => ({
      ...prev,
      [section]: (prev[section] as any[]).filter((x: any) => x.id !== id),
    }));
  }

  const SEED_AREAS = ['brand', 'content', 'product', 'community', 'personal', 'tech', 'other'];

  // ── KV-backed Parking Lot state ──────────────────────────────────────────
  const [kvParking, setKvParking] = useState<ParkingLotItem[]>([]);
  const [kvParkingLoading, setKvParkingLoading] = useState(true);
  const [plText, setPlText] = useState('');
  const [plCategory, setPlCategory] = useState<ParkingLotItem['category']>('spark');
  const [plSaving, setPlSaving] = useState(false);

  const CATEGORY_META: Record<string, { emoji: string; color: string; icon: React.ReactNode }> = {
    'spark': { emoji: '⚡', color: '#E8C875', icon: <Zap size={13} /> },
    'question': { emoji: '❓', color: '#B8A9D4', icon: <HelpCircle size={13} /> },
    'resource': { emoji: '📚', color: '#7BA89D', icon: <BookOpen size={13} /> },
    'wild card': { emoji: '🃏', color: '#D4A0A0', icon: <Shuffle size={13} /> },
  };

  useEffect(() => {
    api.getParkingLot()
      .then(items => setKvParking(Array.isArray(items) ? items : []))
      .catch(e => console.error('Parking lot fetch error:', e))
      .finally(() => setKvParkingLoading(false));
  }, []);

  async function submitParkingItem() {
    const text = plText.trim();
    if (!text) return;
    setPlSaving(true);
    try {
      const res = await api.addParkingLotItem({ text, category: plCategory, author: 'monny' });
      if (res.item) {
        setKvParking(prev => [res.item, ...prev]);
      }
      setPlText('');
      showToast('🅿️ parked.');
    } catch (e: any) {
      console.error('Parking lot save error:', e);
      showToast('⚠️ couldn\u2019t park that \u2014 try again', 'alert');
    } finally {
      setPlSaving(false);
    }
  }

  async function removeParkingItem(id: string) {
    setKvParking(prev => prev.filter(p => p.id !== id));
    try {
      await api.deleteParkingLotItem(id);
    } catch (e) {
      console.error('Parking lot delete error:', e);
    }
  }

  return (
    <div className="cr-view" style={{ animation: 'cw-fadeInUp 0.4s ease' }}>
      {/* Header */}
      <div style={{ padding: '28px 0 8px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--text-primary)', marginBottom: 4 }}>
          playground
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
          where ideas live before they are ready
        </p>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 20, marginTop: 12 }}>
        <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search all sections..."
          style={{
            width: '100%', padding: '10px 38px 10px 40px',
            border: '1.5px solid var(--border-soft)', borderRadius: 12,
            background: '#fff', color: 'var(--text-primary)',
            fontFamily: 'var(--font-body)', fontSize: '0.88rem',
            transition: 'border-color 0.2s', boxSizing: 'border-box',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = 'var(--cr8w-primary, #7BA89D)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-soft)')}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
              display: 'flex', padding: 4,
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>
      {q && totalResults >= 0 && (
        <div style={{
          fontFamily: 'var(--font-label)', fontSize: '0.74rem', color: 'var(--text-muted)',
          marginBottom: 14, letterSpacing: '0.02em',
        }}>
          {totalResults} result{totalResults !== 1 ? 's' : ''} for "{search}"
        </div>
      )}

      {/* ── KV-backed Parking Lot quick-capture ── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(var(--cr8w-primary-rgb, 123,168,157),0.06), rgba(var(--cr8w-secondary-rgb, 184,169,212),0.04))',
        border: '1px solid var(--border-soft)',
        borderRadius: 14, padding: '18px 20px', marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <ParkingCircle size={18} style={{ color: 'var(--cr8w-primary, #7BA89D)' }} />
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            parking lot
          </h2>
          <span style={{
            fontFamily: 'var(--font-label)', fontSize: '0.65rem', fontWeight: 700,
            background: 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.12)', color: 'var(--cr8w-primary)',
            padding: '2px 8px', borderRadius: 10,
          }}>
            {kvParking.length}
          </span>
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: '0 0 14px' }}>
          drop it here, sort it later
        </p>

        {/* Input bar */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: kvParking.length > 0 ? 16 : 0 }}>
          <input
            value={plText}
            onChange={e => setPlText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitParkingItem()}
            placeholder="what's on your mind?"
            disabled={plSaving}
            style={{
              flex: 1, minWidth: 160,
              fontFamily: 'var(--font-body)', fontSize: '0.84rem', padding: '9px 14px',
              border: '1.5px solid var(--border-soft)', borderRadius: 10,
              background: '#fff', color: 'var(--text-primary)',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--cr8w-primary, #7BA89D)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-soft)')}
          />
          <select
            value={plCategory}
            onChange={e => setPlCategory(e.target.value as ParkingLotItem['category'])}
            style={{
              fontFamily: 'var(--font-label)', fontSize: '0.78rem', padding: '8px 10px',
              border: '1.5px solid var(--border-soft)', borderRadius: 10,
              background: '#fff', color: 'var(--text-primary)', cursor: 'pointer',
            }}
          >
            <option value="spark">⚡ spark</option>
            <option value="question">❓ question</option>
            <option value="resource">📚 resource</option>
            <option value="wild card">🃏 wild card</option>
          </select>
          <button
            onClick={submitParkingItem}
            disabled={plSaving || !plText.trim()}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '9px 18px', background: !plText.trim() || plSaving ? 'var(--text-muted)' : 'var(--cr8w-primary, #7BA89D)',
              color: '#fff', border: 'none', borderRadius: 10,
              fontFamily: 'var(--font-label)', fontSize: '0.76rem', fontWeight: 700,
              cursor: !plText.trim() || plSaving ? 'not-allowed' : 'pointer',
              letterSpacing: '0.3px', textTransform: 'uppercase',
              transition: 'background 0.15s, opacity 0.15s',
              opacity: plSaving ? 0.6 : 1,
            }}
          >
            <Plus size={14} /> toss it in
          </button>
        </div>

        {/* Items list */}
        {kvParkingLoading && kvParking.length === 0 && (
          <div style={{ textAlign: 'center', padding: '8px 0', color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
            loading...
          </div>
        )}
        {kvParking.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {kvParking.map(item => {
              const cat = CATEGORY_META[item.category] || CATEGORY_META['spark'];
              const ts = item.created_at ? new Date(item.created_at) : null;
              const timeLabel = ts ? relativeTime(ts.getTime()) : '';
              return (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 14px', background: '#fff', borderRadius: 10,
                  border: '1px solid var(--border-soft)',
                  transition: 'box-shadow 0.15s',
                }}>
                  <span style={{
                    flexShrink: 0, width: 26, height: 26, borderRadius: '50%',
                    background: `${cat.color}18`, color: cat.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.85rem',
                  }}>
                    {cat.emoji}
                  </span>
                  <span style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: '0.84rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    {item.text}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-label)', fontSize: '0.62rem', fontWeight: 600,
                    color: cat.color, background: `${cat.color}14`, padding: '2px 8px',
                    borderRadius: 8, textTransform: 'uppercase', letterSpacing: '0.3px',
                    flexShrink: 0,
                  }}>
                    {item.category}
                  </span>
                  {timeLabel && (
                    <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.65rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {timeLabel}
                    </span>
                  )}
                  <button
                    onClick={() => removeParkingItem(item.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, opacity: 0.4, flexShrink: 0 }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
                    title="Remove"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* 1. Wellspring Glossary */}
        <Section
          title="the wellspring glossary"
          icon={<Sparkles size={20} color="var(--cr8w-primary, #7BA89D)" />}
          barColor="var(--cr8w-primary, #7BA89D)"
          open={!!openSections.glossary}
          onToggle={() => toggle('glossary')}
          count={filteredGlossary.length}
        >
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', marginBottom: 16 }}>
            {filteredGlossary.map(t => (
              <div key={t.id} style={{
                padding: '14px 16px', background: 'var(--bg-warm)', borderRadius: 10,
                border: '1px solid var(--border-soft)', position: 'relative',
                transition: 'box-shadow 0.15s',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{
                    fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 600,
                    color: 'var(--cr8w-primary, #7BA89D)',
                  }}>
                    {t.word}
                  </span>
                  <button
                    onClick={() => removeItem('glossary', t.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, opacity: 0.5, transition: 'opacity 0.15s', flexShrink: 0 }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
                    title="Remove"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <p style={{
                  fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-secondary)',
                  lineHeight: 1.6, margin: '6px 0 0',
                }}>
                  {t.definition}
                </p>
              </div>
            ))}
          </div>
          <InlineAdd
            placeholder="new term"
            onAdd={vals => {
              persist(d => ({
                ...d,
                glossary: [...d.glossary, { id: uid(), word: vals.word || '', definition: vals.def || '', ts: Date.now() }],
              }));
              showToast('\uD83D\uDCD6 added to the grimmerie.');
            }}
            fields={[
              { key: 'word', placeholder: 'new term' },
              { key: 'def', placeholder: 'definition...' },
            ]}
          />
        </Section>

        {/* 2. Brain Lumps */}
        <Section
          title="brain lumps"
          icon={<Brain size={20} color="#E8C875" />}
          barColor="#E8C875"
          open={!!openSections.brainLumps}
          onToggle={() => toggle('brainLumps')}
          count={filteredLumps.length}
        >
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 12px', fontStyle: 'italic' }}>
            Unformed thoughts. Half-baked notions. Things that aren't ideas yet.
          </p>
          {filteredLumps.length === 0 && (
            <div style={{ textAlign: 'center', padding: '10px 0', color: 'var(--text-muted)', fontSize: '0.84rem', fontStyle: 'italic' }}>
              No lumps yet. Drop one in.
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {filteredLumps.slice().sort((a, b) => b.ts - a.ts).map(l => (
              <div key={l.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 14px', background: 'var(--bg-warm)', borderRadius: 8,
                border: '1px solid var(--border-soft)',
              }}>
                <span style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: '0.84rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  {l.text}
                </span>
                <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {relativeTime(l.ts)}
                </span>
                <button
                  onClick={() => removeItem('brainLumps', l.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, opacity: 0.4, flexShrink: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <InlineAdd
            placeholder="drop a brain lump..."
            onAdd={vals => persist(d => ({
              ...d,
              brainLumps: [...d.brainLumps, { id: uid(), text: vals.text || '', ts: Date.now() }],
            }))}
          />
        </Section>

        {/* 3. Seeds */}
        <Section
          title="seeds"
          icon={<Sprout size={20} color="#A8B5A0" />}
          barColor="#A8B5A0"
          open={!!openSections.seeds}
          onToggle={() => toggle('seeds')}
          count={filteredSeeds.length}
        >
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 12px', fontStyle: 'italic' }}>
            Ideas with a direction. Tag them by area.
          </p>
          {filteredSeeds.length === 0 && (
            <div style={{ textAlign: 'center', padding: '10px 0', color: 'var(--text-muted)', fontSize: '0.84rem', fontStyle: 'italic' }}>
              Plant your first seed.
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {filteredSeeds.slice().sort((a, b) => b.ts - a.ts).map(s => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 14px', background: 'var(--bg-warm)', borderRadius: 8,
                border: '1px solid var(--border-soft)',
              }}>
                <span style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: '0.84rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  {s.text}
                </span>
                {s.area && (
                  <span style={{
                    fontFamily: 'var(--font-label)', fontSize: '0.65rem', fontWeight: 700,
                    padding: '2px 9px', borderRadius: 10,
                    background: 'rgba(var(--cr8w-secondary-rgb, 184,169,212),0.2)', color: '#7B6E95',
                    textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    {s.area}
                  </span>
                )}
                <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {relativeTime(s.ts)}
                </span>
                <button
                  onClick={() => removeItem('seeds', s.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, opacity: 0.4, flexShrink: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <InlineAdd
            placeholder="plant a seed..."
            onAdd={vals => persist(d => ({
              ...d,
              seeds: [...d.seeds, { id: uid(), text: vals.text || '', area: vals.area || '', ts: Date.now() }],
            }))}
            fields={[
              { key: 'text', placeholder: 'plant a seed...' },
              { key: 'area', placeholder: 'area', options: SEED_AREAS },
            ]}
          />
        </Section>

        {/* 4. Brand Lab */}
        <Section
          title="brand lab"
          icon={<Palette size={20} color="#D4A0A0" />}
          barColor="#D4A0A0"
          open={!!openSections.brandLab}
          onToggle={() => toggle('brandLab')}
          count={filteredBrand.length}
        >
          {/* Sub-tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {(['voice', 'visual'] as const).map(t => (
              <button
                key={t}
                onClick={() => setBrandTab(t)}
                style={{
                  fontFamily: 'var(--font-label)', fontSize: '0.75rem', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                  padding: '6px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: brandTab === t ? '#D4A0A0' : 'var(--bg-warm)',
                  color: brandTab === t ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.15s',
                }}
              >
                {t === 'voice' ? 'Voice & Tone' : 'Visual & Aesthetic'}
              </button>
            ))}
          </div>
          {filteredBrand.filter(b => b.tab === brandTab).length === 0 && (
            <div style={{ textAlign: 'center', padding: '10px 0', color: 'var(--text-muted)', fontSize: '0.84rem', fontStyle: 'italic' }}>
              Nothing in {brandTab} yet.
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {filteredBrand.filter(b => b.tab === brandTab).sort((a, b) => b.ts - a.ts).map(b => (
              <div key={b.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 14px', background: 'var(--bg-warm)', borderRadius: 8,
                border: '1px solid var(--border-soft)',
              }}>
                <span style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: '0.84rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  {b.text}
                </span>
                <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {relativeTime(b.ts)}
                </span>
                <button
                  onClick={() => removeItem('brandLab', b.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, opacity: 0.4, flexShrink: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <InlineAdd
            placeholder={brandTab === 'voice' ? 'voice note, tone idea...' : 'visual direction, mood ref...'}
            onAdd={vals => persist(d => ({
              ...d,
              brandLab: [...d.brandLab, { id: uid(), text: vals.text || '', tab: brandTab, ts: Date.now() }],
            }))}
          />
        </Section>
      </div>

      {/* Footer */}
      <div style={{
        textAlign: 'center', marginTop: 32, paddingTop: 16,
        borderTop: '1px solid var(--border-soft)',
      }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          this is your permission to play.
        </span>
      </div>
    </div>
  );
}