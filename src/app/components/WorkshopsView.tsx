import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Plus, X, Users, Calendar, MapPin, ExternalLink, FileText, Video, StickyNote, BookOpen, ChevronDown, ChevronUp, Trash2, GripVertical, Tag, RefreshCw, Unlink, Edit3, Clock, Check } from 'lucide-react';
import { PERSONS, GCAL_CLIENT_ID } from './data';
import type { Workshop, WorkshopProgram, WorkshopResource, CalendarEventKV } from './api';
import { getSetting, setSetting, getCalendarEvents } from './api';

// ── Types ─────────────────────────────────────────────────────────────────────
type WorkshopTab = 'pipeline' | 'programs' | 'facilitators' | 'resources' | 'calendar';

const PIPELINE_COLUMNS: { key: Workshop['status']; label: string; color: string; emoji: string }[] = [
  { key: 'ideation', label: 'Seeds', color: '#D4A771', emoji: '🌱' },
  { key: 'planning', label: 'Tending', color: '#A9D6F8', emoji: '💧' },
  { key: 'scheduled', label: 'In Bloom', color: 'var(--cr8w-primary, #7BA89D)', emoji: '🌸' },
  { key: 'completed', label: 'Harvested', color: '#7AB87A', emoji: '🧺' },
];

const FACILITATOR_COLORS: Record<string, string> = {
  monny: 'var(--monny)',
  sunshine: 'var(--sunshine)',
  bingle: 'var(--bingle)',
};

const FACILITATOR_SPECIALTIES: Record<string, string[]> = {
  monny: ['Embodiment', 'Sacral Practices', 'Bridging & Integration', 'Sound & Movement'],
  sunshine: ['Ideation Workshops', 'Emotional Wave Work', 'Creative Expression', 'Vision Casting'],
  bingle: ['Distillation Sessions', 'HD Readings', 'Strategy & Systems', 'Network Facilitation'],
};

const RESOURCE_ICONS: Record<string, React.ReactNode> = {
  'google-doc': <FileText size={16} />,
  'meeting-notes': <StickyNote size={16} />,
  'template': <BookOpen size={16} />,
  'recording': <Video size={16} />,
};

const RESOURCE_LABELS: Record<string, string> = {
  'google-doc': 'Google Doc',
  'meeting-notes': 'Meeting Notes',
  'template': 'Template',
  'recording': 'Recording',
};

interface WorkshopsViewProps {
  workshops: Workshop[];
  programs: WorkshopProgram[];
  resources: WorkshopResource[];
  onAddWorkshop: (w: Omit<Workshop, 'id' | 'created_at'>) => void;
  onUpdateWorkshop: (id: number, updates: Partial<Workshop>) => void;
  onDeleteWorkshop: (id: number) => void;
  onAddProgram: (p: Omit<WorkshopProgram, 'id' | 'created_at'>) => void;
  onUpdateProgram: (id: number, updates: Partial<WorkshopProgram>) => void;
  onDeleteProgram: (id: number) => void;
  onAddResource: (r: Omit<WorkshopResource, 'id' | 'created_at'>) => void;
  onDeleteResource: (id: number) => void;
}

export function WorkshopsView({
  workshops, programs, resources,
  onAddWorkshop, onUpdateWorkshop, onDeleteWorkshop,
  onAddProgram, onUpdateProgram, onDeleteProgram,
  onAddResource, onDeleteResource,
}: WorkshopsViewProps) {
  const [tab, setTab] = useState<WorkshopTab>('pipeline');
  const [showAddWorkshop, setShowAddWorkshop] = useState(false);
  const [showAddProgram, setShowAddProgram] = useState(false);
  const [showAddResource, setShowAddResource] = useState(false);
  const [expandedProgram, setExpandedProgram] = useState<number | null>(null);

  const tabs: { key: WorkshopTab; label: string; emoji: string }[] = [
    { key: 'pipeline', label: 'The Flow', emoji: '🔄' },
    { key: 'programs', label: 'Offerings', emoji: '📖' },
    { key: 'facilitators', label: 'Guides', emoji: '🤝' },
    { key: 'resources', label: 'The Toolkit', emoji: '📁' },
    { key: 'calendar', label: 'Rhythm', emoji: '📆' },
  ];

  return (
    <div className="cr-view" style={{ paddingTop: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--cr8w-primary)', marginBottom: 4 }}>
          the co-creation studio
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>
          where ideas become experiences worth gathering for
        </p>
      </div>

      {/* Sub-tabs */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 24, overflowX: 'auto', paddingBottom: 4,
        scrollbarWidth: 'none',
      }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 'var(--cr-radius-lg)',
              fontFamily: 'var(--font-label)', fontSize: '0.78rem', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.5px',
              whiteSpace: 'nowrap', cursor: 'pointer', border: 'none',
              background: tab === t.key ? 'var(--cr8w-primary)' : 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.08)',
              color: tab === t.key ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.25s ease',
            }}
          >
            <span>{t.emoji}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'pipeline' && (
        <PipelineSection
          workshops={workshops}
          onUpdateWorkshop={onUpdateWorkshop}
          onDeleteWorkshop={onDeleteWorkshop}
          showAddForm={showAddWorkshop}
          onToggleAdd={() => setShowAddWorkshop(!showAddWorkshop)}
          onAddWorkshop={(w) => { onAddWorkshop(w); setShowAddWorkshop(false); }}
        />
      )}
      {tab === 'programs' && (
        <ProgramsSection
          programs={programs}
          showAddForm={showAddProgram}
          onToggleAdd={() => setShowAddProgram(!showAddProgram)}
          onAddProgram={(p) => { onAddProgram(p); setShowAddProgram(false); }}
          onDeleteProgram={onDeleteProgram}
          expandedProgram={expandedProgram}
          onToggleExpand={(id) => setExpandedProgram(expandedProgram === id ? null : id)}
        />
      )}
      {tab === 'facilitators' && (
        <FacilitatorsSection workshops={workshops} />
      )}
      {tab === 'resources' && (
        <ResourcesSection
          resources={resources}
          showAddForm={showAddResource}
          onToggleAdd={() => setShowAddResource(!showAddResource)}
          onAddResource={(r) => { onAddResource(r); setShowAddResource(false); }}
          onDeleteResource={onDeleteResource}
        />
      )}
      {tab === 'calendar' && (
        <CalendarSection workshops={workshops} />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PIPELINE
// ══════════════════════════════════════════════════════════════════════════════

function PipelineSection({ workshops, onUpdateWorkshop, onDeleteWorkshop, showAddForm, onToggleAdd, onAddWorkshop }: {
  workshops: Workshop[];
  onUpdateWorkshop: (id: number, u: Partial<Workshop>) => void;
  onDeleteWorkshop: (id: number) => void;
  showAddForm: boolean;
  onToggleAdd: () => void;
  onAddWorkshop: (w: Omit<Workshop, 'id' | 'created_at'>) => void;
}) {
  const [dragId, setDragId] = useState<number | null>(null);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontFamily: 'var(--font-label)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', margin: 0 }}>
          The Flow
        </h2>
        <button
          onClick={onToggleAdd}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 'var(--cr-radius-md)',
            background: 'var(--cr8w-primary)', color: '#fff',
            fontFamily: 'var(--font-label)', fontSize: '0.8rem', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', border: 'none',
          }}
        >
          {showAddForm ? <X size={14} /> : <Plus size={14} />}
          {showAddForm ? 'Cancel' : '+ new workshop'}
        </button>
      </div>

      {showAddForm && <AddWorkshopForm onSubmit={onAddWorkshop} />}

      {/* Kanban columns */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 16,
      }}>
        {PIPELINE_COLUMNS.map(col => {
          const colWorkshops = workshops.filter(w => w.status === col.key);
          return (
            <div
              key={col.key}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.06)'; }}
              onDragLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              onDrop={e => {
                e.preventDefault();
                e.currentTarget.style.background = 'transparent';
                if (dragId !== null) {
                  onUpdateWorkshop(dragId, { status: col.key });
                  setDragId(null);
                }
              }}
              style={{
                background: 'transparent',
                borderRadius: 'var(--cr-radius-md)',
                padding: 12,
                border: `1.5px dashed ${col.color}44`,
                minHeight: 200,
                transition: 'background 0.2s',
              }}
            >
              {/* Column header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
                paddingBottom: 8, borderBottom: `2px solid ${col.color}`,
              }}>
                <span>{col.emoji}</span>
                <span style={{
                  fontFamily: 'var(--font-label)', fontSize: '0.75rem', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '1px', color: col.color,
                }}>
                  {col.label}
                </span>
                <span style={{
                  marginLeft: 'auto', background: `${col.color}22`, color: col.color,
                  borderRadius: 12, padding: '2px 8px',
                  fontFamily: 'var(--font-label)', fontSize: '0.7rem', fontWeight: 700,
                }}>
                  {colWorkshops.length}
                </span>
              </div>

              {/* Cards */}
              {colWorkshops.map(w => (
                <WorkshopCard
                  key={w.id}
                  workshop={w}
                  onDragStart={() => setDragId(w.id)}
                  onDelete={() => onDeleteWorkshop(w.id)}
                />
              ))}

              {colWorkshops.length === 0 && (
                <div style={{
                  textAlign: 'center', padding: '24px 12px',
                  color: 'var(--text-muted)', fontSize: '0.8rem',
                  fontFamily: 'var(--font-body)', opacity: 0.6,
                }}>
                  plant something here
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WorkshopCard({ workshop: w, onDragStart, onDelete }: {
  workshop: Workshop;
  onDragStart: () => void;
  onDelete: () => void;
}) {
  const person = PERSONS[w.facilitator];
  const dateStr = w.date ? new Date(w.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

  return (
    <div
      draggable
      onDragStart={onDragStart}
      style={{
        background: 'var(--bg-card)',
        borderRadius: 'var(--cr-radius-md)',
        padding: 14,
        marginBottom: 10,
        boxShadow: 'var(--shadow-sm)',
        cursor: 'grab',
        border: `1px solid var(--border-soft)`,
        transition: 'box-shadow 0.2s, transform 0.2s',
      }}
      onMouseOver={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
      }}
      onMouseOut={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)';
        (e.currentTarget as HTMLElement).style.transform = 'none';
      }}
    >
      {/* Title + delete */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 600,
          color: 'var(--text-primary)', lineHeight: 1.3,
        }}>
          {w.title}
        </span>
        <button onClick={onDelete} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 2,
          color: 'var(--text-muted)', opacity: 0.5,
        }} title="Delete">
          <X size={13} />
        </button>
      </div>

      {/* Facilitator badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '2px 8px', borderRadius: 10,
        background: `${person?.color || '#ccc'}22`,
        marginBottom: 8,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: person?.color || '#ccc' }} />
        <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
          {person?.name || w.facilitator}
        </span>
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        {dateStr && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Calendar size={11} /> {dateStr}
          </span>
        )}
        {w.location && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <MapPin size={11} /> {w.location}
          </span>
        )}
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Users size={11} /> {w.participants}/{w.capacity}
        </span>
      </div>

      {/* Tags */}
      {w.tags?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
          {w.tags.map((tag, i) => (
            <span key={i} style={{
              padding: '1px 7px', borderRadius: 8,
              background: 'var(--sandstone)', color: 'var(--text-muted)',
              fontFamily: 'var(--font-label)', fontSize: '0.62rem', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.3px',
            }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Google Doc link */}
      {w.googleDocLink && (
        <a
          href={w.googleDocLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            marginTop: 8, fontSize: '0.72rem', color: 'var(--cr8w-primary)',
            fontFamily: 'var(--font-label)', fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          <ExternalLink size={11} /> Google Doc
        </a>
      )}
    </div>
  );
}

function AddWorkshopForm({ onSubmit }: { onSubmit: (w: Omit<Workshop, 'id' | 'created_at'>) => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [facilitator, setFacilitator] = useState<'monny' | 'sunshine' | 'bingle'>('monny');
  const [date, setDate] = useState('');
  const [capacity, setCapacity] = useState('20');
  const [location, setLocation] = useState('');
  const [tags, setTags] = useState('');
  const [googleDocLink, setGoogleDocLink] = useState('');
  const [status, setStatus] = useState<Workshop['status']>('ideation');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      facilitator,
      date,
      capacity: parseInt(capacity) || 20,
      participants: 0,
      location: location.trim(),
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      googleDocLink: googleDocLink.trim() || undefined,
      status,
    });
    setTitle(''); setDescription(''); setDate(''); setCapacity('20'); setLocation(''); setTags(''); setGoogleDocLink('');
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px',
    borderRadius: 'var(--cr-radius-sm)',
    border: '1.5px solid var(--border-soft)',
    background: 'var(--bg-elevated)',
    fontFamily: 'var(--font-body)', fontSize: '0.85rem',
    color: 'var(--text-primary)',
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-label)', fontSize: '0.72rem',
    textTransform: 'uppercase', letterSpacing: '0.5px',
    color: 'var(--text-muted)', marginBottom: 4, display: 'block', fontWeight: 600,
  };

  return (
    <form onSubmit={handleSubmit} style={{
      background: 'var(--bg-card)', borderRadius: 'var(--cr-radius-md)',
      padding: 20, marginBottom: 20, boxShadow: 'var(--shadow-sm)',
      border: '1px solid var(--border-soft)',
      animation: 'cw-fadeInUp 0.3s ease',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Title *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Workshop title..." style={inputStyle} required />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What's this workshop about..." style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} />
        </div>
        <div>
          <label style={labelStyle}>Facilitator</label>
          <select value={facilitator} onChange={e => setFacilitator(e.target.value as any)} style={inputStyle}>
            <option value="monny">Monny</option>
            <option value="sunshine">Sunshine</option>
            <option value="bingle">Bingle</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Status</label>
          <select value={status} onChange={e => setStatus(e.target.value as Workshop['status'])} style={inputStyle}>
            {PIPELINE_COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Capacity</label>
          <input type="number" value={capacity} onChange={e => setCapacity(e.target.value)} style={inputStyle} min="1" />
        </div>
        <div>
          <label style={labelStyle}>Location</label>
          <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Taverna Costera" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Tags (comma-separated)</label>
          <input value={tags} onChange={e => setTags(e.target.value)} placeholder="somatic, breathwork" style={inputStyle} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Google Doc Link</label>
          <input value={googleDocLink} onChange={e => setGoogleDocLink(e.target.value)} placeholder="https://docs.google.com/..." style={inputStyle} />
        </div>
      </div>
      <button type="submit" style={{
        marginTop: 16, padding: '10px 24px',
        borderRadius: 'var(--cr-radius-md)',
        background: 'var(--cr8w-primary)', color: '#fff',
        fontFamily: 'var(--font-label)', fontSize: '0.82rem', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', border: 'none',
      }}>
        + new workshop
      </button>
    </form>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PROGRAMS
// ══════════════════════════════════════════════════════════════════════════════

function ProgramsSection({ programs, showAddForm, onToggleAdd, onAddProgram, onDeleteProgram, expandedProgram, onToggleExpand }: {
  programs: WorkshopProgram[];
  showAddForm: boolean;
  onToggleAdd: () => void;
  onAddProgram: (p: Omit<WorkshopProgram, 'id' | 'created_at'>) => void;
  onDeleteProgram: (id: number) => void;
  expandedProgram: number | null;
  onToggleExpand: (id: number) => void;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontFamily: 'var(--font-label)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', margin: 0 }}>
          Offerings
        </h2>
        <button onClick={onToggleAdd} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 16px', borderRadius: 'var(--cr-radius-md)',
          background: 'var(--cr8w-primary)', color: '#fff',
          fontFamily: 'var(--font-label)', fontSize: '0.8rem', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', border: 'none',
        }}>
          {showAddForm ? <X size={14} /> : <Plus size={14} />}
          {showAddForm ? 'Cancel' : '+ new offering'}
        </button>
      </div>

      {showAddForm && <AddProgramForm onSubmit={onAddProgram} />}

      {programs.length === 0 && !showAddForm && (
        <div style={{
          background: 'var(--bg-card)', borderRadius: 'var(--cr-radius-md)',
          padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)',
          fontFamily: 'var(--font-body)', fontSize: '0.9rem',
          border: '1px solid var(--border-soft)',
        }}>
          No offerings yet. Plant one to start growing your workshop series.
        </div>
      )}

      {programs.map(prog => (
        <div key={prog.id} style={{
          background: 'var(--bg-card)', borderRadius: 'var(--cr-radius-md)',
          marginBottom: 12, boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--border-soft)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div
            onClick={() => onToggleExpand(prog.id)}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px 18px', cursor: 'pointer',
            }}
          >
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0 }}>
                {prog.seriesName}
              </h3>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                {prog.sessionOutline?.length || 0} sessions · {prog.facilitator}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={(e) => { e.stopPropagation(); onDeleteProgram(prog.id); }} style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                color: 'var(--text-muted)', opacity: 0.5,
              }}>
                <Trash2 size={14} />
              </button>
              {expandedProgram === prog.id ? <ChevronUp size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
            </div>
          </div>

          {/* Expanded content */}
          {expandedProgram === prog.id && (
            <div style={{ padding: '0 18px 18px', borderTop: '1px solid var(--border-soft)' }}>
              {/* Description */}
              {prog.description && (
                <div style={{ marginTop: 14 }}>
                  <label style={{ fontFamily: 'var(--font-label)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Description
                  </label>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 0', lineHeight: 1.6 }}>
                    {prog.description}
                  </p>
                </div>
              )}

              {/* Learning Objectives */}
              {prog.learningObjectives?.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <label style={{ fontFamily: 'var(--font-label)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Learning Objectives
                  </label>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
                    {prog.learningObjectives.map((obj, i) => (
                      <li key={i} style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 4, lineHeight: 1.5 }}>
                        {obj}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Session Outline */}
              {prog.sessionOutline?.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <label style={{ fontFamily: 'var(--font-label)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Session Outline
                  </label>
                  <div style={{ marginTop: 8 }}>
                    {prog.sessionOutline.map((session, i) => (
                      <div key={i} style={{
                        display: 'flex', gap: 12, marginBottom: 10, alignItems: 'flex-start',
                      }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: 'var(--cr8w-primary)', color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 700,
                          flexShrink: 0,
                        }}>
                          {session.number}
                        </div>
                        <div>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                            {session.title}
                          </div>
                          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5 }}>
                            {session.description}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Target Audience & Materials */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 14 }}>
                {prog.targetAudience && (
                  <div>
                    <label style={{ fontFamily: 'var(--font-label)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                      Target Audience
                    </label>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                      {prog.targetAudience}
                    </p>
                  </div>
                )}
                {prog.materialsNeeded?.length > 0 && (
                  <div>
                    <label style={{ fontFamily: 'var(--font-label)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                      Materials Needed
                    </label>
                    <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                      {prog.materialsNeeded.map((m, i) => (
                        <li key={i} style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 2 }}>
                          {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AddProgramForm({ onSubmit }: { onSubmit: (p: Omit<WorkshopProgram, 'id' | 'created_at'>) => void }) {
  const [seriesName, setSeriesName] = useState('');
  const [description, setDescription] = useState('');
  const [objectives, setObjectives] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [materials, setMaterials] = useState('');
  const [facilitator, setFacilitator] = useState('monny');
  const [sessions, setSessions] = useState<{ title: string; description: string }[]>([{ title: '', description: '' }]);

  function addSession() { setSessions([...sessions, { title: '', description: '' }]); }
  function updateSession(idx: number, field: string, value: string) {
    const updated = [...sessions];
    (updated[idx] as any)[field] = value;
    setSessions(updated);
  }
  function removeSession(idx: number) { setSessions(sessions.filter((_, i) => i !== idx)); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!seriesName.trim()) return;
    onSubmit({
      seriesName: seriesName.trim(),
      description: description.trim(),
      learningObjectives: objectives.split('\n').map(o => o.trim()).filter(Boolean),
      sessionOutline: sessions.filter(s => s.title.trim()).map((s, i) => ({ number: i + 1, title: s.title.trim(), description: s.description.trim() })),
      targetAudience: targetAudience.trim(),
      materialsNeeded: materials.split('\n').map(m => m.trim()).filter(Boolean),
      facilitator,
    });
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px',
    borderRadius: 'var(--cr-radius-sm)', border: '1.5px solid var(--border-soft)',
    background: 'var(--bg-elevated)', fontFamily: 'var(--font-body)', fontSize: '0.85rem',
    color: 'var(--text-primary)',
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-label)', fontSize: '0.72rem',
    textTransform: 'uppercase', letterSpacing: '0.5px',
    color: 'var(--text-muted)', marginBottom: 4, display: 'block', fontWeight: 600,
  };

  return (
    <form onSubmit={handleSubmit} style={{
      background: 'var(--bg-card)', borderRadius: 'var(--cr-radius-md)',
      padding: 20, marginBottom: 20, boxShadow: 'var(--shadow-sm)',
      border: '1px solid var(--border-soft)', animation: 'cw-fadeInUp 0.3s ease',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Series Name *</label>
          <input value={seriesName} onChange={e => setSeriesName(e.target.value)} placeholder="e.g. Embodied Expression Series" style={inputStyle} required />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Program overview..." style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} />
        </div>
        <div>
          <label style={labelStyle}>Facilitator</label>
          <select value={facilitator} onChange={e => setFacilitator(e.target.value)} style={inputStyle}>
            <option value="monny">Monny</option>
            <option value="sunshine">Sunshine</option>
            <option value="bingle">Bingle</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Target Audience</label>
          <input value={targetAudience} onChange={e => setTargetAudience(e.target.value)} placeholder="e.g. Creative professionals" style={inputStyle} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Learning Objectives (one per line)</label>
          <textarea value={objectives} onChange={e => setObjectives(e.target.value)} placeholder="One objective per line..." style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Materials Needed (one per line)</label>
          <textarea value={materials} onChange={e => setMaterials(e.target.value)} placeholder="One material per line..." style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }} />
        </div>
      </div>

      {/* Session outline builder */}
      <div style={{ marginTop: 16 }}>
        <label style={labelStyle}>Session Outline</label>
        {sessions.map((s, i) => (
          <div key={i} style={{
            display: 'flex', gap: 8, marginTop: 8, alignItems: 'flex-start',
          }}>
            <span style={{
              width: 24, height: 24, borderRadius: '50%',
              background: 'var(--cr8w-primary)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700,
              flexShrink: 0, marginTop: 8,
            }}>
              {i + 1}
            </span>
            <div style={{ flex: 1 }}>
              <input value={s.title} onChange={e => updateSession(i, 'title', e.target.value)} placeholder="Session title" style={{ ...inputStyle, marginBottom: 4 }} />
              <input value={s.description} onChange={e => updateSession(i, 'description', e.target.value)} placeholder="Brief description" style={{ ...inputStyle, fontSize: '0.8rem' }} />
            </div>
            {sessions.length > 1 && (
              <button type="button" onClick={() => removeSession(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', marginTop: 10, color: 'var(--text-muted)', opacity: 0.5 }}>
                <X size={14} />
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={addSession} style={{
          marginTop: 8, display: 'flex', alignItems: 'center', gap: 4,
          padding: '6px 12px', borderRadius: 'var(--cr-radius-sm)',
          background: 'var(--sandstone)', color: 'var(--text-muted)',
          fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 600,
          textTransform: 'uppercase', cursor: 'pointer', border: 'none',
        }}>
          <Plus size={12} /> Add Session
        </button>
      </div>

      <button type="submit" style={{
        marginTop: 16, padding: '10px 24px',
        borderRadius: 'var(--cr-radius-md)',
        background: 'var(--cr8w-primary)', color: '#fff',
        fontFamily: 'var(--font-label)', fontSize: '0.82rem', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', border: 'none',
      }}>
        + new offering
      </button>
    </form>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FACILITATORS
// ══════════════════════════════════════════════════════════════════════════════

type CoFlowProfile = {
  energyType: string;
  bestDays: string[];
  flowWindow: string;
  commitment: string;
  synergies: { with: string; note: string }[];
};

const DEFAULT_COFLOW_PROFILES: Record<string, CoFlowProfile> = {
  monny: {
    energyType: 'Sacral — Sustained Builder',
    bestDays: ['Tuesday', 'Wednesday', 'Thursday'],
    flowWindow: 'mid-morning → early afternoon',
    commitment: 'I commit to holding space with grounded, embodied presence — matching the rhythm of whoever needs me most that day.',
    synergies: [
      { with: 'sunshine', note: 'Sunshine sparks the idea, I build the container to hold it' },
      { with: 'bingle', note: 'Bingle maps the system, I bring it into the body' },
    ],
  },
  sunshine: {
    energyType: 'Emotional — Creative Wave Rider',
    bestDays: ['Monday', 'Wednesday', 'Friday'],
    flowWindow: 'late morning → sunset',
    commitment: 'I commit to riding the wave honestly — showing up with whatever emotion is true, and channeling it into creative fuel for the group.',
    synergies: [
      { with: 'monny', note: 'Monny grounds what I ignite — together we make ideas livable' },
      { with: 'bingle', note: 'Bingle gives my visions structure so they actually land' },
    ],
  },
  bingle: {
    energyType: 'Ego — Willpower Distiller',
    bestDays: ['Tuesday', 'Thursday', 'Saturday'],
    flowWindow: 'early morning → midday',
    commitment: 'I commit to translating instinct into clarity — distilling what we sense together into something we can see, name, and act on.',
    synergies: [
      { with: 'monny', note: 'Monny embodies what I articulate — together we close the knowing-doing gap' },
      { with: 'sunshine', note: 'Sunshine brings the emotional truth I sometimes skip — together we get the full picture' },
    ],
  },
};

function FacilitatorsSection({ workshops }: { workshops: Workshop[] }) {
  const facilitators = ['monny', 'sunshine', 'bingle'] as const;
  const [expandedGuide, setExpandedGuide] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Record<string, CoFlowProfile>>(DEFAULT_COFLOW_PROFILES);
  const [editingField, setEditingField] = useState<{ person: string; field: string } | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const profilesLoaded = useRef(false);

  // Load profiles from KV on mount
  useEffect(() => {
    if (profilesLoaded.current) return;
    profilesLoaded.current = true;
    getSetting<Record<string, CoFlowProfile>>('coflow_profiles').then(res => {
      if (res?.value) {
        // Merge with defaults to ensure all keys exist
        const merged = { ...DEFAULT_COFLOW_PROFILES };
        for (const k of Object.keys(merged)) {
          if (res.value[k]) merged[k] = { ...merged[k], ...res.value[k] };
        }
        setProfiles(merged);
      }
    }).catch(e => console.error('Failed to load co-flow profiles:', e));
  }, []);

  // Save a single profile field
  function saveProfileField(person: string, field: keyof CoFlowProfile, value: any) {
    const updated = { ...profiles, [person]: { ...profiles[person], [field]: value } };
    setProfiles(updated);
    setSetting('coflow_profiles', updated).catch(e => console.error('Failed to save co-flow profiles:', e));
  }

  function startEdit(person: string, field: string, currentValue: string) {
    setEditingField({ person, field });
    setEditDraft(currentValue);
  }

  function commitEdit(person: string, field: keyof CoFlowProfile) {
    if (editDraft.trim()) {
      saveProfileField(person, field, editDraft.trim());
    }
    setEditingField(null);
    setEditDraft('');
  }

  // Find overlapping best days
  const sharedDays = profiles.monny.bestDays.filter(
    d => profiles.sunshine.bestDays.includes(d) || profiles.bingle.bestDays.includes(d)
  );

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-label)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', margin: '0 0 8px' }}>
        Guide Profiles
      </h2>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
        three guides, one flow — each committed to showing up in alignment with their energy and each other's
      </p>

      {/* ── Co-Flow Alignment Banner ── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(var(--cr8w-primary-rgb, 123,168,157),0.08), rgba(var(--cr8w-secondary-rgb, 184,169,212),0.08))',
        borderRadius: 'var(--cr-radius-md)', padding: '16px 20px', marginBottom: 20,
        border: '1px solid rgba(var(--cr8w-primary-rgb, 123,168,157),0.15)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
        }}>
          <span style={{ fontSize: '1.1rem' }}>🤝</span>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 600,
            color: 'var(--cr8w-primary)',
          }}>
            co-flow commitment
          </span>
        </div>
        <p style={{
          fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-secondary)',
          margin: '0 0 12px', lineHeight: 1.6, fontStyle: 'italic',
        }}>
          "we don't just show up for ourselves — we show up for each other's energy. our co-flow days are where all three rhythms meet."
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {sharedDays.map(day => (
            <span key={day} style={{
              padding: '4px 12px', borderRadius: 10,
              background: 'var(--cr8w-primary)', color: '#fff',
              fontFamily: 'var(--font-label)', fontSize: '0.68rem', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.3px',
            }}>
              {day}
            </span>
          ))}
          <span style={{
            padding: '4px 12px', borderRadius: 10,
            background: 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.12)',
            color: 'var(--cr8w-primary)',
            fontFamily: 'var(--font-label)', fontSize: '0.68rem', fontWeight: 600,
            letterSpacing: '0.3px',
          }}>
            ✨ aligned days
          </span>
        </div>
      </div>

      {/* ── Guide Dropdown Cards ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {facilitators.map(key => {
          const person = PERSONS[key];
          const profile = profiles[key];
          const personWorkshops = workshops.filter(w => w.facilitator === key);
          const upcoming = personWorkshops.filter(w => w.status === 'scheduled');
          const completed = personWorkshops.filter(w => w.status === 'completed');
          const specialties = FACILITATOR_SPECIALTIES[key] || [];
          const isExpanded = expandedGuide === key;

          return (
            <div key={key} style={{
              background: 'var(--bg-card)', borderRadius: 'var(--cr-radius-md)',
              boxShadow: 'var(--shadow-sm)',
              border: isExpanded ? `1.5px solid ${person.color}66` : '1.5px solid var(--border-soft)',
              position: 'relative', overflow: 'hidden',
              transition: 'border-color 0.3s ease',
            }}>
              {/* Accent bar */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                background: `linear-gradient(90deg, ${person.color}, ${person.color}66)`,
              }} />

              {/* ── Clickable Header ── */}
              <button
                onClick={() => setExpandedGuide(isExpanded ? null : key)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '16px 18px', paddingTop: 19, cursor: 'pointer',
                  background: 'none', border: 'none', textAlign: 'left',
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                  background: `linear-gradient(135deg, ${person.color}, ${person.color}88)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.3rem',
                }}>
                  {person.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {person.name}
                  </div>
                  <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.68rem', color: person.color, fontWeight: 600, letterSpacing: '0.3px' }}>
                    {profile.energyType}
                  </div>
                </div>
                {/* Stats mini */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--cr8w-primary)', fontWeight: 700 }}>
                      {upcoming.length}
                    </div>
                    <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.55rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      upcoming
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: '#7AB87A', fontWeight: 700 }}>
                      {completed.length}
                    </div>
                    <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.55rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      done
                    </div>
                  </div>
                </div>
                {/* Chevron */}
                <div style={{ flexShrink: 0, color: 'var(--text-muted)', transition: 'transform 0.3s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }}>
                  <ChevronDown size={18} />
                </div>
              </button>

              {/* ── Expanded Content ── */}
              {isExpanded && (
                <div style={{
                  padding: '0 18px 20px', borderTop: '1px solid var(--border-soft)',
                  animation: 'cw-fadeInUp 0.25s ease',
                }}>
                  {/* Expression */}
                  <div style={{
                    fontFamily: 'var(--font-body)', fontSize: '0.78rem',
                    color: person.color, fontWeight: 600, marginTop: 14, marginBottom: 14,
                    fontStyle: 'italic',
                  }}>
                    "{person.expression}"
                  </div>

                  {/* Co-Flow Commitment */}
                  <div style={{
                    background: `${person.color}0C`, borderRadius: 10,
                    padding: '14px 16px', marginBottom: 16,
                    border: `1px solid ${person.color}22`,
                  }}>
                    <div style={{
                      fontFamily: 'var(--font-label)', fontSize: '0.65rem', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.5px',
                      color: person.color, marginBottom: 8,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <span>🫶</span> my co-flow commitment
                    </div>
                    {editingField?.person === key && editingField?.field === 'commitment' ? (
                      <textarea
                        value={editDraft}
                        onChange={e => setEditDraft(e.target.value)}
                        onBlur={() => commitEdit(key, 'commitment')}
                        onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditDraft(''); } }}
                        autoFocus
                        rows={3}
                        style={{
                          width: '100%', padding: '6px 8px', borderRadius: 6,
                          border: `1px solid ${person.color}44`, fontFamily: 'var(--font-body)',
                          fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'transparent',
                          resize: 'vertical', outline: 'none', fontStyle: 'italic', lineHeight: 1.6,
                        }}
                      />
                    ) : (
                      <p
                        onClick={() => startEdit(key, 'commitment', profile.commitment)}
                        title="Click to edit"
                        style={{
                          fontFamily: 'var(--font-body)', fontSize: '0.8rem',
                          color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6,
                          fontStyle: 'italic', cursor: 'text',
                        }}
                      >
                        "{profile.commitment}"
                      </p>
                    )}
                  </div>

                  {/* Best Days + Flow Window */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div>
                      <label style={{ fontFamily: 'var(--font-label)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                        best co-flow days
                      </label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                          const active = profile.bestDays.includes(day);
                          return (
                            <button
                              key={day}
                              onClick={() => {
                                const next = active
                                  ? profile.bestDays.filter(d => d !== day)
                                  : [...profile.bestDays, day];
                                saveProfileField(key, 'bestDays', next);
                              }}
                              style={{
                                padding: '3px 9px', borderRadius: 8, border: 'none', cursor: 'pointer',
                                background: active ? `${person.color}18` : 'var(--sandstone)',
                                color: active ? person.color : 'var(--text-muted)',
                                fontFamily: 'var(--font-label)', fontSize: '0.66rem', fontWeight: 600,
                                opacity: active ? 1 : 0.5, transition: 'all 0.15s',
                              }}
                            >
                              {day.slice(0, 3)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <label style={{ fontFamily: 'var(--font-label)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                        flow window
                      </label>
                      {editingField?.person === key && editingField?.field === 'flowWindow' ? (
                        <input
                          value={editDraft}
                          onChange={e => setEditDraft(e.target.value)}
                          onBlur={() => commitEdit(key, 'flowWindow')}
                          onKeyDown={e => { if (e.key === 'Enter') commitEdit(key, 'flowWindow'); if (e.key === 'Escape') { setEditingField(null); setEditDraft(''); } }}
                          autoFocus
                          style={{
                            width: '100%', marginTop: 6, padding: '4px 6px', borderRadius: 4,
                            border: `1px solid ${person.color}44`, fontFamily: 'var(--font-body)',
                            fontSize: '0.82rem', color: 'var(--text-primary)', background: 'transparent',
                            outline: 'none', fontWeight: 500,
                          }}
                        />
                      ) : (
                        <div
                          onClick={() => startEdit(key, 'flowWindow', profile.flowWindow)}
                          title="Click to edit"
                          style={{
                            marginTop: 6, fontFamily: 'var(--font-body)', fontSize: '0.82rem',
                            color: 'var(--text-primary)', fontWeight: 500, cursor: 'text',
                          }}
                        >
                          {profile.flowWindow}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Synergies */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontFamily: 'var(--font-label)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                      energy synergies
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                      {profile.synergies.map((syn, i) => {
                        const partner = PERSONS[syn.with];
                        return (
                          <div key={i} style={{
                            display: 'flex', alignItems: 'flex-start', gap: 8,
                            padding: '8px 10px', borderRadius: 8,
                            background: 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.04)',
                          }}>
                            <span style={{
                              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                              background: partner?.color || '#ccc',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.65rem',
                            }}>
                              {partner?.emoji}
                            </span>
                            {editingField?.person === key && editingField?.field === `synergy-${i}` ? (
                              <input
                                value={editDraft}
                                onChange={e => setEditDraft(e.target.value)}
                                onBlur={() => {
                                  const updated = [...profile.synergies];
                                  updated[i] = { ...updated[i], note: editDraft.trim() || updated[i].note };
                                  saveProfileField(key, 'synergies', updated);
                                  setEditingField(null); setEditDraft('');
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') { e.currentTarget.blur(); }
                                  if (e.key === 'Escape') { setEditingField(null); setEditDraft(''); }
                                }}
                                autoFocus
                                style={{
                                  flex: 1, padding: '2px 4px', borderRadius: 4,
                                  border: `1px solid ${person.color}44`, fontFamily: 'var(--font-body)',
                                  fontSize: '0.76rem', color: 'var(--text-secondary)', background: 'transparent',
                                  outline: 'none', lineHeight: 1.5,
                                }}
                              />
                            ) : (
                              <span
                                onClick={() => startEdit(key, `synergy-${i}`, syn.note)}
                                title="Click to edit"
                                style={{
                                  fontFamily: 'var(--font-body)', fontSize: '0.76rem',
                                  color: 'var(--text-secondary)', lineHeight: 1.5, cursor: 'text',
                                }}
                              >
                                {syn.note}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Specialties */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontFamily: 'var(--font-label)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                      specialties
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                      {specialties.map((s, i) => (
                        <span key={i} style={{
                          padding: '3px 10px', borderRadius: 10,
                          background: `${person.color}18`, color: person.color,
                          fontFamily: 'var(--font-label)', fontSize: '0.66rem', fontWeight: 600,
                        }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Upcoming workshops list */}
                  {upcoming.length > 0 && (
                    <div>
                      <label style={{ fontFamily: 'var(--font-label)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                        upcoming workshops
                      </label>
                      {upcoming.slice(0, 3).map(w => (
                        <div key={w.id} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '6px 0', borderBottom: '1px solid var(--border-soft)',
                          fontSize: '0.78rem', fontFamily: 'var(--font-body)',
                        }}>
                          <span style={{ color: 'var(--text-primary)' }}>{w.title}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                            {w.date ? new Date(w.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// RESOURCES
// ══════════════════════════════════════════════════════════════════════════════

function ResourcesSection({ resources, showAddForm, onToggleAdd, onAddResource, onDeleteResource }: {
  resources: WorkshopResource[];
  showAddForm: boolean;
  onToggleAdd: () => void;
  onAddResource: (r: Omit<WorkshopResource, 'id' | 'created_at'>) => void;
  onDeleteResource: (id: number) => void;
}) {
  const grouped = useMemo(() => {
    const groups: Record<string, WorkshopResource[]> = {};
    resources.forEach(r => {
      if (!groups[r.type]) groups[r.type] = [];
      groups[r.type].push(r);
    });
    return groups;
  }, [resources]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontFamily: 'var(--font-label)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', margin: 0 }}>
          Workshop Resources
        </h2>
        <button onClick={onToggleAdd} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 16px', borderRadius: 'var(--cr-radius-md)',
          background: 'var(--cr8w-primary)', color: '#fff',
          fontFamily: 'var(--font-label)', fontSize: '0.8rem', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', border: 'none',
        }}>
          {showAddForm ? <X size={14} /> : <Plus size={14} />}
          {showAddForm ? 'Cancel' : 'Add Resource'}
        </button>
      </div>

      {showAddForm && <AddResourceForm onSubmit={onAddResource} />}

      {resources.length === 0 && !showAddForm && (
        <div style={{
          background: 'var(--bg-card)', borderRadius: 'var(--cr-radius-md)',
          padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)',
          fontFamily: 'var(--font-body)', fontSize: '0.9rem',
          border: '1px solid var(--border-soft)',
        }}>
          No resources yet. Add Google Docs, meeting notes, templates, or recordings.
        </div>
      )}

      {/* Resource cards by type */}
      {Object.entries(grouped).map(([type, items]) => (
        <div key={type} style={{ marginBottom: 20 }}>
          <h3 style={{
            fontFamily: 'var(--font-label)', fontSize: '0.72rem', textTransform: 'uppercase',
            letterSpacing: '0.8px', color: 'var(--cr8w-primary)', marginBottom: 10,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {RESOURCE_ICONS[type]} {RESOURCE_LABELS[type] || type}s
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
            {items.map(r => (
              <div key={r.id} style={{
                background: 'var(--bg-card)', borderRadius: 'var(--cr-radius-sm)',
                padding: '14px 16px', boxShadow: 'var(--shadow-sm)',
                border: '1px solid var(--border-soft)',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <a href={r.url} target="_blank" rel="noopener noreferrer" style={{
                    fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 600,
                    color: 'var(--cr8w-primary)', textDecoration: 'none',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {RESOURCE_ICONS[r.type]} {r.title}
                    <ExternalLink size={11} />
                  </a>
                  <button onClick={() => onDeleteResource(r.id)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                    color: 'var(--text-muted)', opacity: 0.4,
                  }}>
                    <X size={13} />
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-label)' }}>
                  <span>by {r.author}</span>
                  <span>{r.lastUpdated ? new Date(r.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AddResourceForm({ onSubmit }: { onSubmit: (r: Omit<WorkshopResource, 'id' | 'created_at'>) => void }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<WorkshopResource['type']>('google-doc');
  const [url, setUrl] = useState('');
  const [author, setAuthor] = useState('monny');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;
    onSubmit({
      title: title.trim(), type, url: url.trim(),
      lastUpdated: new Date().toISOString(), author,
    });
    setTitle(''); setUrl('');
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px',
    borderRadius: 'var(--cr-radius-sm)', border: '1.5px solid var(--border-soft)',
    background: 'var(--bg-elevated)', fontFamily: 'var(--font-body)', fontSize: '0.85rem',
    color: 'var(--text-primary)',
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-label)', fontSize: '0.72rem',
    textTransform: 'uppercase', letterSpacing: '0.5px',
    color: 'var(--text-muted)', marginBottom: 4, display: 'block', fontWeight: 600,
  };

  return (
    <form onSubmit={handleSubmit} style={{
      background: 'var(--bg-card)', borderRadius: 'var(--cr-radius-md)',
      padding: 20, marginBottom: 20, boxShadow: 'var(--shadow-sm)',
      border: '1px solid var(--border-soft)', animation: 'cw-fadeInUp 0.3s ease',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Title *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Resource title..." style={inputStyle} required />
        </div>
        <div>
          <label style={labelStyle}>Type</label>
          <select value={type} onChange={e => setType(e.target.value as WorkshopResource['type'])} style={inputStyle}>
            <option value="google-doc">Google Doc</option>
            <option value="meeting-notes">Meeting Notes</option>
            <option value="template">Template</option>
            <option value="recording">Recording</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Author</label>
          <select value={author} onChange={e => setAuthor(e.target.value)} style={inputStyle}>
            <option value="monny">Monny</option>
            <option value="sunshine">Sunshine</option>
            <option value="bingle">Bingle</option>
          </select>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>URL *</label>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." style={inputStyle} required />
        </div>
      </div>
      <button type="submit" style={{
        marginTop: 16, padding: '10px 24px', borderRadius: 'var(--cr-radius-md)',
        background: 'var(--cr8w-primary)', color: '#fff',
        fontFamily: 'var(--font-label)', fontSize: '0.82rem', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', border: 'none',
      }}>
        Add Resource
      </button>
    </form>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CALENDAR — Google Calendar integrated
// ══════════════════════════════════════════════════════════════════════════════

interface GCalEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  htmlLink?: string;
}

function CalendarSection({ workshops }: { workshops: Workshop[] }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // ── KV Calendar Events: workshop-filtered Rhythm timeline ────────────────
  const [kvCalEvents, setKvCalEvents] = useState<CalendarEventKV[]>([]);
  const [kvCalLoading, setKvCalLoading] = useState(true);

  useEffect(() => {
    getCalendarEvents()
      .then(events => setKvCalEvents(Array.isArray(events) ? events : []))
      .catch(e => console.error('Rhythm calendar fetch error:', e))
      .finally(() => setKvCalLoading(false));
  }, []);

  const WORKSHOP_KEYWORDS = /workshop|wellshop|expresshop|playshop/i;
  const workshopCalEvents = useMemo(() => {
    return kvCalEvents
      .filter(ev => WORKSHOP_KEYWORDS.test(ev.title || '') || WORKSHOP_KEYWORDS.test(ev.description || ''))
      .sort((a, b) => a.start.localeCompare(b.start));
  }, [kvCalEvents]);

  // ── Google Calendar state ────────────────────────────────────────────────
  const [gcalConnected, setGcalConnected] = useState(() => !!localStorage.getItem('gcal_token_MONNY'));
  const [gcalEvents, setGcalEvents] = useState<GCalEvent[]>([]);
  const [gcalLoading, setGcalLoading] = useState(false);
  const [gcalError, setGcalError] = useState('');
  const [gcalCalName, setGcalCalName] = useState(() => localStorage.getItem('gcal_name_MONNY') || '');

  // Event editor state
  const [editingEvent, setEditingEvent] = useState<GCalEvent | null>(null);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [eventForm, setEventForm] = useState({ title: '', date: '', startTime: '10:00', endTime: '11:00', description: '', location: '' });
  const [saving, setSaving] = useState(false);

  const mountFetchedRef = useRef(false);

  // ── Token helpers ────────────────────────────────────────────────────────
  // Try all stored tokens (MONNY, SUNSHINE, BINGLE, or generic)
  function getStoredToken(): string | null {
    for (const k of ['MONNY', 'SUNSHINE', 'BINGLE']) {
      const t = localStorage.getItem(`gcal_token_${k}`);
      if (t) return t;
    }
    return localStorage.getItem('gcal_access_token');
  }

  function getTokenUserKey(): string {
    for (const k of ['MONNY', 'SUNSHINE', 'BINGLE']) {
      if (localStorage.getItem(`gcal_token_${k}`)) return k;
    }
    return 'MONNY';
  }

  // ── PKCE helpers ─────────────────────────────────────────────────────────
  function generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }

  async function generateCodeChallenge(verifier: string): Promise<string> {
    const data = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  // ── Fetch events for the current month ───────────────────────────────────
  const fetchGcalEvents = useCallback(async (token: string) => {
    setGcalLoading(true);
    setGcalError('');
    try {
      const timeMin = new Date(currentMonth.year, currentMonth.month, 1).toISOString();
      const timeMax = new Date(currentMonth.year, currentMonth.month + 1, 0, 23, 59, 59).toISOString();
      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=250`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) {
        // Token expired
        setGcalConnected(false);
        setGcalError('Session expired — reconnect Google Calendar');
        return;
      }
      if (!res.ok) throw new Error(`Google Calendar API error ${res.status}`);
      const data = await res.json();
      setGcalEvents(data.items || []);

      // Also fetch calendar name
      if (!gcalCalName) {
        const calRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (calRes.ok) {
          const calData = await calRes.json();
          const name = calData.summary || calData.id || 'Google Calendar';
          setGcalCalName(name);
          localStorage.setItem(`gcal_name_${getTokenUserKey()}`, name);
        }
      }
    } catch (e: any) {
      console.error('GCal fetch error:', e);
      setGcalError(e.message || 'Failed to load events');
    } finally {
      setGcalLoading(false);
    }
  }, [currentMonth, gcalCalName]);

  // ── On mount + month change: load events ─────────────────────────────────
  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      setGcalConnected(true);
      fetchGcalEvents(token);
    } else {
      setGcalConnected(false);
      setGcalEvents([]);
    }
  }, [fetchGcalEvents]);

  // ── Poll for token exchange completion on mount ──────────────────────────
  useEffect(() => {
    if (mountFetchedRef.current) return;
    mountFetchedRef.current = true;
    const flag = localStorage.getItem('gcal_token_fresh');
    if (flag === 'pending') {
      setGcalLoading(true);
      const pollId = setInterval(() => {
        const status = localStorage.getItem('gcal_token_fresh');
        if (status === 'ready') {
          clearInterval(pollId);
          localStorage.removeItem('gcal_token_fresh');
          const token = getStoredToken();
          if (token) { setGcalConnected(true); fetchGcalEvents(token); }
          else setGcalLoading(false);
        } else if (status === 'error') {
          clearInterval(pollId);
          const err = localStorage.getItem('gcal_token_error') || 'Token exchange failed';
          localStorage.removeItem('gcal_token_fresh');
          localStorage.removeItem('gcal_token_error');
          setGcalLoading(false);
          setGcalError(err);
        }
      }, 200);
      setTimeout(() => { clearInterval(pollId); if (localStorage.getItem('gcal_token_fresh') === 'pending') { localStorage.removeItem('gcal_token_fresh'); setGcalLoading(false); setGcalError('Token exchange timed out.'); } }, 30_000);
    }
  }, [fetchGcalEvents]);

  // ── Connect Google Calendar ──────────────────────────────────────────────
  async function connectGcal() {
    const REDIRECT_URI = window.location.origin;
    const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events';
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    localStorage.setItem('gcal_pkce_verifier', codeVerifier);
    localStorage.setItem('gcal_oauth_user', 'monny');
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

  // ── Disconnect ───────────────────────────────────────────────────────────
  function disconnectGcal() {
    const token = getStoredToken();
    if (token) {
      fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }).catch(() => {});
    }
    for (const k of ['MONNY', 'SUNSHINE', 'BINGLE']) {
      localStorage.removeItem(`gcal_token_${k}`);
      localStorage.removeItem(`gcal_name_${k}`);
    }
    localStorage.removeItem('gcal_access_token');
    localStorage.removeItem('gcal_pkce_verifier');
    localStorage.removeItem('gcal_token_fresh');
    setGcalConnected(false);
    setGcalEvents([]);
    setGcalCalName('');
  }

  // ── Create event on Google Calendar ──────────────────────────────────────
  async function createGcalEvent(form: typeof eventForm) {
    const token = getStoredToken();
    if (!token) return;
    setSaving(true);
    try {
      const body: any = {
        summary: form.title,
        description: form.description || undefined,
        location: form.location || undefined,
      };
      if (form.startTime && form.endTime) {
        body.start = { dateTime: `${form.date}T${form.startTime}:00`, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
        body.end = { dateTime: `${form.date}T${form.endTime}:00`, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
      } else {
        body.start = { date: form.date };
        body.end = { date: form.date };
      }
      const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Create failed: ${res.status}`);
      const created = await res.json();
      setGcalEvents(prev => [...prev, created]);
      setShowAddEvent(false);
      setEventForm({ title: '', date: '', startTime: '10:00', endTime: '11:00', description: '', location: '' });
    } catch (e: any) {
      console.error('Create event error:', e);
      setGcalError(e.message || 'Failed to create event');
    } finally {
      setSaving(false);
    }
  }

  // ── Update event on Google Calendar ──────────────────────────────────────
  async function updateGcalEvent(eventId: string, form: typeof eventForm) {
    const token = getStoredToken();
    if (!token) return;
    setSaving(true);
    try {
      const body: any = {
        summary: form.title,
        description: form.description || undefined,
        location: form.location || undefined,
      };
      if (form.startTime && form.endTime) {
        body.start = { dateTime: `${form.date}T${form.startTime}:00`, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
        body.end = { dateTime: `${form.date}T${form.endTime}:00`, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
      } else {
        body.start = { date: form.date };
        body.end = { date: form.date };
      }
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Update failed: ${res.status}`);
      const updated = await res.json();
      setGcalEvents(prev => prev.map(e => e.id === eventId ? updated : e));
      setEditingEvent(null);
    } catch (e: any) {
      console.error('Update event error:', e);
      setGcalError(e.message || 'Failed to update event');
    } finally {
      setSaving(false);
    }
  }

  // ── Delete event from Google Calendar ────────────────────────────────────
  async function deleteGcalEvent(eventId: string) {
    const token = getStoredToken();
    if (!token) return;
    if (!confirm('Remove this event from Google Calendar?')) return;
    try {
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok && res.status !== 204 && res.status !== 410) throw new Error(`Delete failed: ${res.status}`);
      setGcalEvents(prev => prev.filter(e => e.id !== eventId));
      setEditingEvent(null);
    } catch (e: any) {
      console.error('Delete event error:', e);
      setGcalError(e.message || 'Failed to delete event');
    }
  }

  // ── Calendar math ────────────────────────────────────────────────────────
  const daysInMonth = new Date(currentMonth.year, currentMonth.month + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentMonth.year, currentMonth.month, 1).getDay();
  const monthName = new Date(currentMonth.year, currentMonth.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const workshopsByDate = useMemo(() => {
    const map: Record<string, Workshop[]> = {};
    workshops.forEach(w => {
      if (!w.date) return;
      const d = new Date(w.date + 'T00:00:00');
      if (d.getFullYear() === currentMonth.year && d.getMonth() === currentMonth.month) {
        const key = d.getDate().toString();
        if (!map[key]) map[key] = [];
        map[key].push(w);
      }
    });
    return map;
  }, [workshops, currentMonth]);

  const gcalByDate = useMemo(() => {
    const map: Record<string, GCalEvent[]> = {};
    gcalEvents.forEach(ev => {
      const dateStr = ev.start?.dateTime?.slice(0, 10) || ev.start?.date;
      if (!dateStr) return;
      const d = new Date(dateStr + 'T00:00:00');
      if (d.getFullYear() === currentMonth.year && d.getMonth() === currentMonth.month) {
        const key = d.getDate().toString();
        if (!map[key]) map[key] = [];
        map[key].push(ev);
      }
    });
    return map;
  }, [gcalEvents, currentMonth]);

  function prevMonth() {
    setCurrentMonth(prev => {
      const m = prev.month - 1;
      return m < 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: m };
    });
  }
  function nextMonth() {
    setCurrentMonth(prev => {
      const m = prev.month + 1;
      return m > 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: m };
    });
  }

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === currentMonth.year && today.getMonth() === currentMonth.month;

  function formatEventTime(ev: GCalEvent): string {
    if (ev.start?.dateTime) {
      return new Date(ev.start.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
    }
    return 'all day';
  }

  function openAddEventForDay(day: number) {
    const m = (currentMonth.month + 1).toString().padStart(2, '0');
    const d = day.toString().padStart(2, '0');
    setEventForm({ title: '', date: `${currentMonth.year}-${m}-${d}`, startTime: '10:00', endTime: '11:00', description: '', location: '' });
    setShowAddEvent(true);
    setSelectedDay(day);
  }

  function openEditEvent(ev: GCalEvent) {
    const dateStr = ev.start?.dateTime?.slice(0, 10) || ev.start?.date || '';
    const startTime = ev.start?.dateTime ? new Date(ev.start.dateTime).toTimeString().slice(0, 5) : '';
    const endTime = ev.end?.dateTime ? new Date(ev.end.dateTime).toTimeString().slice(0, 5) : '';
    setEventForm({
      title: ev.summary || '',
      date: dateStr,
      startTime,
      endTime,
      description: ev.description || '',
      location: ev.location || '',
    });
    setEditingEvent(ev);
  }

  // ── Upcoming events list (next 14 days from today) ───────────────────────
  const upcomingEvents = useMemo(() => {
    const nowDate = new Date();
    nowDate.setHours(0, 0, 0, 0);
    const twoWeeksOut = new Date(nowDate);
    twoWeeksOut.setDate(twoWeeksOut.getDate() + 14);

    return gcalEvents
      .map(ev => {
        const dateStr = ev.start?.dateTime || ev.start?.date || '';
        const d = new Date(dateStr);
        return { ...ev, _date: d };
      })
      .filter(ev => ev._date >= nowDate && ev._date <= twoWeeksOut)
      .sort((a, b) => a._date.getTime() - b._date.getTime())
      .slice(0, 8);
  }, [gcalEvents]);

  // ── Inline styles ────────────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-card)', borderRadius: 'var(--cr-radius-md)',
    padding: 20, boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-soft)',
  };
  const btnSmall: React.CSSProperties = {
    background: 'var(--sandstone)', border: 'none', borderRadius: 'var(--cr-radius-sm)',
    padding: '6px 12px', cursor: 'pointer', fontFamily: 'var(--font-label)', fontSize: '0.8rem', color: 'var(--text-secondary)',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: 'var(--cr-radius-sm)',
    border: '1px solid var(--border-soft)', fontFamily: 'var(--font-body)',
    fontSize: '0.82rem', background: 'var(--bg-card)', color: 'var(--text-primary)',
    outline: 'none',
  };
  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-label)', fontSize: '0.62rem', textTransform: 'uppercase' as const,
    letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4,
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontFamily: 'var(--font-label)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', margin: 0 }}>
          Workshop Calendar
        </h2>
        {/* GCal connection controls */}
        {gcalConnected ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontFamily: 'var(--font-label)', fontSize: '0.65rem', color: 'var(--cr8w-primary)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7AB87A' }} />
              {gcalCalName || 'Google Calendar'}
            </span>
            <button onClick={() => { const t = getStoredToken(); if (t) fetchGcalEvents(t); }} title="Refresh" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}>
              <RefreshCw size={14} className={gcalLoading ? 'animate-spin' : ''} />
            </button>
            <button onClick={disconnectGcal} title="Disconnect" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}>
              <Unlink size={14} />
            </button>
          </div>
        ) : (
          <button onClick={connectGcal} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 'var(--cr-radius-md)',
            background: 'var(--cr8w-primary)', color: '#fff', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.3px',
          }}>
            <Calendar size={14} /> Connect Google Cal
          </button>
        )}
      </div>

      {gcalError && (
        <div style={{
          background: 'rgba(212,107,107,0.08)', border: '1px solid rgba(212,107,107,0.2)',
          borderRadius: 'var(--cr-radius-sm)', padding: '8px 12px', marginBottom: 12,
          fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#D46B6B',
        }}>
          {gcalError}
          <button onClick={() => setGcalError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D46B6B', marginLeft: 8, fontSize: '1rem' }}>&times;</button>
        </div>
      )}

      {/* ── Workshop Rhythm Timeline (KV calendar events) ── */}
      <div style={{
        ...cardStyle, marginBottom: 16,
        borderLeft: '4px solid var(--cr8w-secondary, #B8A9D4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: '1.1rem' }}>📆</span>
          <span style={{
            fontFamily: 'var(--font-label)', fontSize: '0.72rem', textTransform: 'uppercase',
            letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600,
          }}>
            workshop rhythm
          </span>
          <span style={{
            fontFamily: 'var(--font-label)', fontSize: '0.62rem', fontWeight: 700,
            background: 'rgba(var(--cr8w-secondary-rgb, 184,169,212),0.15)', color: 'var(--cr8w-secondary, #B8A9D4)',
            padding: '2px 8px', borderRadius: 10,
          }}>
            {workshopCalEvents.length}
          </span>
        </div>
        {kvCalLoading ? (
          <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: '0.82rem' }}>
            loading rhythm events...
          </div>
        ) : workshopCalEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: '0.85rem', fontStyle: 'italic' }}>
            no rhythm events on the calendar yet
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {workshopCalEvents.map(ev => {
              const startDate = ev.start ? new Date(ev.start) : null;
              const dateLabel = startDate
                ? startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                : '';
              const timeLabel = startDate && ev.start.includes('T')
                ? startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()
                : 'all day';
              const endDate = ev.end ? new Date(ev.end) : null;
              const endLabel = endDate && ev.end.includes('T')
                ? endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()
                : '';
              const isPast = startDate ? startDate < new Date() : false;

              return (
                <div key={ev.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '10px 12px',
                  borderRadius: 'var(--cr-radius-sm, 8px)',
                  background: isPast ? 'transparent' : 'rgba(var(--cr8w-secondary-rgb, 184,169,212),0.04)',
                  opacity: isPast ? 0.55 : 1,
                  transition: 'background 0.15s',
                }}>
                  {/* Date column */}
                  <div style={{ flexShrink: 0, width: 48, textAlign: 'center', paddingTop: 2 }}>
                    <div style={{
                      fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 700,
                      color: isPast ? 'var(--text-muted)' : 'var(--cr8w-secondary, #B8A9D4)',
                      lineHeight: 1,
                    }}>
                      {startDate ? startDate.getDate() : '?'}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-label)', fontSize: '0.55rem',
                      color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px',
                    }}>
                      {startDate ? startDate.toLocaleDateString('en-US', { month: 'short' }) : ''}
                    </div>
                  </div>
                  {/* Timeline dot + line */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 6 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: isPast ? 'var(--text-muted)' : 'var(--cr8w-secondary, #B8A9D4)',
                    }} />
                    <div style={{ width: 1, flex: 1, background: 'var(--border-soft)', minHeight: 20 }} />
                  </div>
                  {/* Event details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'var(--font-body)', fontSize: '0.84rem', fontWeight: 500,
                      color: 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {ev.title}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-label)', fontSize: '0.68rem', color: 'var(--text-muted)',
                      display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2,
                    }}>
                      <span>{dateLabel}</span>
                      <span>{timeLabel}{endLabel ? ` – ${endLabel}` : ''}</span>
                      {ev.location && <span>📍 {ev.location}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Upcoming Events (GCal integrated) ── */}
      {gcalConnected && (
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
              upcoming (next 14 days)
            </span>
            <button onClick={() => { const m = (today.getMonth() + 1).toString().padStart(2, '0'); const d = today.getDate().toString().padStart(2, '0'); setEventForm({ title: '', date: `${today.getFullYear()}-${m}-${d}`, startTime: '10:00', endTime: '11:00', description: '', location: '' }); setShowAddEvent(true); }} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 10px', borderRadius: 'var(--cr-radius-sm)',
              background: 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.1)', color: 'var(--cr8w-primary)',
              border: 'none', cursor: 'pointer', fontFamily: 'var(--font-label)', fontSize: '0.68rem', fontWeight: 600,
            }}>
              <Plus size={12} /> Add Event
            </button>
          </div>
          {gcalLoading && upcomingEvents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: '0.82rem' }}>
              Loading events...
            </div>
          ) : upcomingEvents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: '0.82rem', fontStyle: 'italic' }}>
              no upcoming events in the next 14 days
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {upcomingEvents.map(ev => {
                const dateLabel = ev._date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                const timeLabel = formatEventTime(ev);
                const diffDays = Math.ceil((ev._date.getTime() - new Date().setHours(0,0,0,0)) / (86400000));
                const relLabel = diffDays === 0 ? 'today' : diffDays === 1 ? 'tomorrow' : `in ${diffDays}d`;
                return (
                  <div key={ev.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                    borderRadius: 8, background: 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.04)',
                    cursor: 'pointer', transition: 'background 0.15s',
                  }}
                  onClick={() => openEditEvent(ev)}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.10)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.04)'}
                  >
                    <div style={{ flexShrink: 0, width: 36, textAlign: 'center' }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--cr8w-primary)', lineHeight: 1 }}>
                        {ev._date.getDate()}
                      </div>
                      <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        {ev._date.toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.summary || '(No title)'}
                      </div>
                      <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                        {timeLabel}{ev.location ? ` · ${ev.location}` : ''}
                      </div>
                    </div>
                    <div style={{
                      flexShrink: 0, padding: '2px 8px', borderRadius: 6,
                      background: diffDays === 0 ? 'var(--cr8w-primary)' : 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.12)',
                      color: diffDays === 0 ? '#fff' : 'var(--cr8w-primary)',
                      fontFamily: 'var(--font-label)', fontSize: '0.6rem', fontWeight: 600,
                    }}>
                      {relLabel}
                    </div>
                    <Edit3 size={12} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Not connected empty state ── */}
      {!gcalConnected && (
        <div style={{
          ...cardStyle, textAlign: 'center', padding: '32px 20px', marginBottom: 16,
          background: 'linear-gradient(135deg, rgba(var(--cr8w-primary-rgb, 123,168,157),0.04), rgba(var(--cr8w-secondary-rgb, 184,169,212),0.04))',
        }}>
          <Calendar size={32} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
            Connect Google Calendar to sync events
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.76rem', color: 'var(--text-muted)', margin: 0 }}>
            add, edit, and remove events directly from the dashboard — everything syncs back to Google Calendar
          </p>
        </div>
      )}

      {/* ── Calendar Grid ── */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <button onClick={prevMonth} style={btnSmall}>&larr;</button>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 600 }}>
            {monthName}
          </span>
          <button onClick={nextMonth} style={btnSmall}>&rarr;</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} style={{
              textAlign: 'center', fontFamily: 'var(--font-label)', fontSize: '0.65rem',
              textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', padding: '4px 0',
            }}>{d}</div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} style={{ minHeight: 56 }} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayWorkshops = workshopsByDate[day.toString()] || [];
            const dayGcal = gcalByDate[day.toString()] || [];
            const isToday = isCurrentMonth && today.getDate() === day;
            const hasEvents = dayWorkshops.length > 0 || dayGcal.length > 0;

            return (
              <div
                key={day}
                onClick={() => gcalConnected && openAddEventForDay(day)}
                style={{
                  minHeight: 56, padding: 4, borderRadius: 'var(--cr-radius-sm)',
                  background: isToday ? 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.08)' : 'transparent',
                  border: isToday ? '1.5px solid var(--cr8w-primary)' : '1px solid transparent',
                  cursor: gcalConnected ? 'pointer' : 'default',
                  transition: 'background 0.15s',
                  position: 'relative',
                }}
                onMouseEnter={e => { if (gcalConnected) e.currentTarget.style.background = isToday ? 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.12)' : 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.04)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = isToday ? 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.08)' : 'transparent'; }}
              >
                <div style={{
                  fontFamily: 'var(--font-body)', fontSize: '0.72rem',
                  color: isToday ? 'var(--cr8w-primary)' : 'var(--text-secondary)',
                  fontWeight: isToday ? 700 : 400, marginBottom: 2,
                }}>
                  {day}
                </div>
                {/* Workshop dots */}
                {dayWorkshops.map(w => (
                  <div key={w.id} title={`${w.title} — ${PERSONS[w.facilitator]?.name || w.facilitator}`} style={{
                    width: '100%', height: 4, borderRadius: 2,
                    background: FACILITATOR_COLORS[w.facilitator] || 'var(--cr8w-primary)',
                    marginBottom: 2,
                  }} />
                ))}
                {/* Google Cal event dots */}
                {dayGcal.slice(0, 3).map((ev, idx) => (
                  <div
                    key={ev.id}
                    title={ev.summary || '(No title)'}
                    onClick={(e) => { e.stopPropagation(); openEditEvent(ev); }}
                    style={{
                      width: '100%', height: 4, borderRadius: 2,
                      background: 'var(--cr8w-secondary, #B8A9D4)',
                      marginBottom: 2, cursor: 'pointer',
                    }}
                  />
                ))}
                {dayGcal.length > 3 && (
                  <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.5rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                    +{dayGcal.length - 3}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
          {(['monny', 'sunshine', 'bingle'] as const).map(key => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', fontFamily: 'var(--font-label)', color: 'var(--text-muted)' }}>
              <span style={{ width: 10, height: 4, borderRadius: 2, background: FACILITATOR_COLORS[key] }} />
              {PERSONS[key].name}
            </div>
          ))}
          {gcalConnected && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', fontFamily: 'var(--font-label)', color: 'var(--text-muted)' }}>
              <span style={{ width: 10, height: 4, borderRadius: 2, background: 'var(--cr8w-secondary, #B8A9D4)' }} />
              Google Calendar
            </div>
          )}
        </div>
      </div>

      {/* ── Add / Edit Event Modal ── */}
      {(showAddEvent || editingEvent) && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 20,
        }}
        onClick={() => { setShowAddEvent(false); setEditingEvent(null); }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)', borderRadius: 'var(--cr-radius-md)',
              padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0 }}>
                {editingEvent ? 'Edit Event' : 'Add Event'}
              </h3>
              <button onClick={() => { setShowAddEvent(false); setEditingEvent(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.2rem' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>Title</label>
                <input value={eventForm.title} onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))} placeholder="Event name" style={inputStyle} autoFocus />
              </div>
              <div>
                <label style={labelStyle}>Date</label>
                <input type="date" value={eventForm.date} onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={labelStyle}>Start Time</label>
                  <input type="time" value={eventForm.startTime} onChange={e => setEventForm(f => ({ ...f, startTime: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>End Time</label>
                  <input type="time" value={eventForm.endTime} onChange={e => setEventForm(f => ({ ...f, endTime: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Location (optional)</label>
                <input value={eventForm.location} onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))} placeholder="Where" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Description (optional)</label>
                <textarea value={eventForm.description} onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))} placeholder="Details..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'space-between' }}>
              {editingEvent && (
                <button onClick={() => deleteGcalEvent(editingEvent.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '8px 14px', borderRadius: 'var(--cr-radius-sm)',
                  background: 'rgba(212,107,107,0.08)', color: '#D46B6B',
                  border: '1px solid rgba(212,107,107,0.2)', cursor: 'pointer',
                  fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 600,
                }}>
                  <Trash2 size={13} /> Delete
                </button>
              )}
              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                <button onClick={() => { setShowAddEvent(false); setEditingEvent(null); }} style={{
                  padding: '8px 16px', borderRadius: 'var(--cr-radius-sm)',
                  background: 'var(--sandstone)', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-label)', fontSize: '0.78rem', fontWeight: 600,
                }}>
                  Cancel
                </button>
                <button
                  disabled={!eventForm.title.trim() || !eventForm.date || saving}
                  onClick={() => editingEvent ? updateGcalEvent(editingEvent.id, eventForm) : createGcalEvent(eventForm)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '8px 18px', borderRadius: 'var(--cr-radius-sm)',
                    background: !eventForm.title.trim() || !eventForm.date || saving ? 'var(--text-muted)' : 'var(--cr8w-primary)',
                    color: '#fff', border: 'none', cursor: !eventForm.title.trim() || !eventForm.date || saving ? 'not-allowed' : 'pointer',
                    fontFamily: 'var(--font-label)', fontSize: '0.78rem', fontWeight: 600,
                  }}
                >
                  {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                  {editingEvent ? 'Update' : 'Create'}
                </button>
              </div>
            </div>

            {editingEvent?.htmlLink && (
              <a href={editingEvent.htmlLink} target="_blank" rel="noopener noreferrer" style={{
                display: 'flex', alignItems: 'center', gap: 4, marginTop: 12,
                fontFamily: 'var(--font-label)', fontSize: '0.68rem', color: 'var(--cr8w-primary)',
                textDecoration: 'none',
              }}>
                <ExternalLink size={11} /> Open in Google Calendar
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}