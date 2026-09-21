import React, { useState, useMemo } from 'react';
import { Users, UserPlus, AlertCircle, Heart, Search, ChevronDown, Check, X, ShieldAlert, Clock } from 'lucide-react';
import type { Station } from './api';
import { NotionSyncChip } from './NotionSyncChip';
import { PERSONS, capitalize } from './data';

export const PATHWAY_STAGES = [
  'Arrive',
  'Exhale',
  'Come Home',
  'Return',
  'Deepen',
  'Paused',
  'Do Not Contact',
] as const;

export type PathwayStage = typeof PATHWAY_STAGES[number];

const STAGE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  'Arrive': { bg: 'rgba(123, 168, 157, 0.12)', color: '#3A7A6E', border: 'rgba(123, 168, 157, 0.3)' },
  'Exhale': { bg: 'rgba(169, 214, 248, 0.15)', color: '#2A6890', border: 'rgba(169, 214, 248, 0.4)' },
  'Come Home': { bg: 'rgba(212, 165, 165, 0.15)', color: '#8A4A4A', border: 'rgba(212, 165, 165, 0.4)' },
  'Return': { bg: 'rgba(212, 165, 116, 0.15)', color: '#8A5A20', border: 'rgba(212, 165, 116, 0.4)' },
  'Deepen': { bg: 'rgba(184, 169, 212, 0.15)', color: '#5A4580', border: 'rgba(184, 169, 212, 0.4)' },
  'Paused': { bg: 'rgba(168, 152, 136, 0.12)', color: '#6E665E', border: 'rgba(168, 152, 136, 0.3)' },
  'Do Not Contact': { bg: 'rgba(196, 113, 113, 0.15)', color: '#A82828', border: 'rgba(196, 113, 113, 0.45)' },
};

interface CarePeopleRegistryProps {
  stations: Station[];
  onUpdateStationField: (id: number, updates: Partial<Station>) => void;
  onAddStation?: (s: Omit<Station, 'id' | 'created_at'>) => void;
  onDeleteStation?: (id: number) => void;
}

export function CarePeopleRegistry({
  stations,
  onUpdateStationField,
  onAddStation,
  onDeleteStation,
}: CarePeopleRegistryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStage, setFilterStage] = useState<string>('all');
  const [filterOwner, setFilterOwner] = useState<string>('all');
  const [editingInvitationId, setEditingInvitationId] = useState<number | null>(null);
  const [invitationDraft, setInvitationDraft] = useState('');
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [newPerson, setNewPerson] = useState({
    name: '',
    owner: 'monny',
    pathwayStage: 'Arrive' as PathwayStage,
    nextInvitation: '',
    description: '',
  });

  // Priority Queue: People with blank/missing Next Invitation (excluding "Do Not Contact")
  const needsInvitationQueue = useMemo(() => {
    return stations.filter(s => {
      const stage = s.pathwayStage || s.status;
      if (stage === 'Do Not Contact') return false;
      return !s.nextInvitation || s.nextInvitation.trim() === '';
    });
  }, [stations]);

  // Filtered directory list
  const filteredStations = useMemo(() => {
    return stations.filter(s => {
      const currentStage = s.pathwayStage || s.status;
      if (filterStage !== 'all' && currentStage !== filterStage) return false;
      if (filterOwner !== 'all' && s.owner?.toLowerCase() !== filterOwner.toLowerCase()) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = s.name.toLowerCase().includes(q);
        const matchDesc = s.description?.toLowerCase().includes(q);
        const matchInvite = s.nextInvitation?.toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchInvite) return false;
      }
      return true;
    });
  }, [stations, filterStage, filterOwner, searchQuery]);

  function handleSaveInvitation(id: number) {
    onUpdateStationField(id, { nextInvitation: invitationDraft.trim() });
    setEditingInvitationId(null);
    setInvitationDraft('');
  }

  function handleStageChange(id: number, newStage: string) {
    onUpdateStationField(id, {
      pathwayStage: newStage,
      status: newStage,
    });
  }

  function handleCreatePerson(e: React.FormEvent) {
    e.preventDefault();
    if (!newPerson.name.trim() || !onAddStation) return;
    onAddStation({
      emoji: '👤',
      name: newPerson.name.trim(),
      owner: newPerson.owner,
      status: newPerson.pathwayStage,
      pathwayStage: newPerson.pathwayStage,
      nextInvitation: newPerson.nextInvitation.trim(),
      description: newPerson.description.trim(),
    });
    setNewPerson({
      name: '',
      owner: 'monny',
      pathwayStage: 'Arrive',
      nextInvitation: '',
      description: '',
    });
    setShowAddPersonModal(false);
  }

  return (
    <div style={{ marginBottom: 32 }}>
      {/* ── PRIORITY QUEUE: Needs Next Invitation ── */}
      {needsInvitationQueue.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(194,91,56,0.08), rgba(212,167,113,0.08))',
          border: '1.5px solid rgba(194,91,56,0.25)',
          borderRadius: 'var(--cr-radius-md, 12px)',
          padding: '16px 20px',
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={18} color="#C25B38" />
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: '#C25B38' }}>
                Priority Care Queue — Needs Next Invitation ({needsInvitationQueue.length})
              </span>
            </div>
            <span style={{
              fontFamily: 'var(--font-label)',
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              fontStyle: 'italic',
            }}>
              "Blank means nobody gets contacted."
            </span>
          </div>

          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.82rem',
            color: 'var(--text-secondary)',
            margin: '0 0 14px',
            lineHeight: 1.5,
          }}>
            These community members have active relational momentum but no scheduled invitation. Set a prompt or touchpoint rhythm to keep the water flowing.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {needsInvitationQueue.slice(0, 5).map(person => (
              <div
                key={person.id}
                style={{
                  background: 'var(--bg-card, #FFFFFF)',
                  border: '1px solid var(--border-soft, #E0DBD5)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 160 }}>
                  <span style={{ fontSize: '1.1rem' }}>{person.emoji || '👤'}</span>
                  <div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {person.name}
                    </div>
                    <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      Holder: {PERSONS[person.owner]?.name || person.owner || 'team'}
                    </div>
                  </div>
                </div>

                {/* Inline Next Invitation Editor */}
                <div style={{ flex: 1, minWidth: 240, display: 'flex', gap: 8 }}>
                  {editingInvitationId === person.id ? (
                    <>
                      <input
                        value={invitationDraft}
                        onChange={e => setInvitationDraft(e.target.value)}
                        placeholder="e.g. Invite to next Open Studio (Oct 3)..."
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveInvitation(person.id); }}
                        autoFocus
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '1.5px solid var(--cr8w-primary, #C25B38)',
                          fontFamily: 'var(--font-body)',
                          fontSize: '0.8rem',
                          background: 'var(--bg-elevated, #FAF7F5)',
                          color: 'var(--text-primary)',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveInvitation(person.id)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          background: 'var(--cr8w-primary, #C25B38)',
                          color: '#fff',
                          border: 'none',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Set
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingInvitationId(null)}
                        style={{
                          padding: '6px 8px',
                          borderRadius: 6,
                          background: 'none',
                          border: '1px solid var(--border-soft)',
                          color: 'var(--text-muted)',
                          fontSize: '0.72rem',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingInvitationId(person.id);
                        setInvitationDraft(person.nextInvitation || '');
                      }}
                      style={{
                        flex: 1,
                        textAlign: 'left',
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: '1px dashed rgba(194,91,56,0.4)',
                        background: 'rgba(194,91,56,0.04)',
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-body)',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                      }}
                    >
                      + Add Next Invitation (blank)
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 10,
                    fontSize: '0.68rem',
                    fontFamily: 'var(--font-label)',
                    fontWeight: 700,
                    background: STAGE_COLORS[person.pathwayStage || person.status]?.bg || '#f0f0f0',
                    color: STAGE_COLORS[person.pathwayStage || person.status]?.color || '#555',
                  }}>
                    {person.pathwayStage || person.status || 'Arrive'}
                  </span>
                  <NotionSyncChip sync={person.notionSync} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MAIN PEOPLE & PATHWAYS REGISTRY ── */}
      <div style={{
        background: 'var(--bg-card, #FFFFFF)',
        borderRadius: 'var(--cr-radius-md, 12px)',
        border: '1px solid var(--border-soft, #E0DBD5)',
        padding: 20,
        boxShadow: 'var(--shadow-sm)',
      }}>
        {/* Header & Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={18} color="var(--cr8w-primary, #C25B38)" />
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--text-primary)', margin: 0 }}>
                People & Pathway Registry
              </h2>
            </div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              The relational ecosystem of Create Well — tracking invitation rhythms, stations, and pathway transitions.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {onAddStation && (
              <button
                type="button"
                onClick={() => setShowAddPersonModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  borderRadius: 8,
                  background: 'var(--cr8w-primary, #C25B38)',
                  color: '#fff',
                  border: 'none',
                  fontFamily: 'var(--font-label)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <UserPlus size={14} />
                <span>Add Person / Station</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters bar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search box */}
          <div style={{ position: 'relative', flex: '1 1 200px' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name, role, or invitation..."
              style={{
                width: '100%',
                padding: '8px 12px 8px 30px',
                borderRadius: 8,
                border: '1px solid var(--border-soft, #E0DBD5)',
                background: 'var(--bg-elevated, #FAF7F5)',
                fontSize: '0.8rem',
                fontFamily: 'var(--font-body)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Stage Filter */}
          <select
            value={filterStage}
            onChange={e => setFilterStage(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--border-soft)',
              background: 'var(--bg-elevated)',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-label)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <option value="all">All Stages ({stations.length})</option>
            {PATHWAY_STAGES.map(stage => (
              <option key={stage} value={stage}>{stage}</option>
            ))}
          </select>

          {/* Owner Filter */}
          <select
            value={filterOwner}
            onChange={e => setFilterOwner(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--border-soft)',
              background: 'var(--bg-elevated)',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-label)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <option value="all">All Holders</option>
            {Object.entries(PERSONS).map(([key, p]) => (
              <option key={key} value={key}>{p.emoji} {p.name}</option>
            ))}
          </select>
        </div>

        {/* People Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid var(--border-soft)', color: 'var(--text-muted)', fontFamily: 'var(--font-label)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '10px 12px' }}>Person / Station</th>
                <th style={{ padding: '10px 12px', minWidth: 150 }}>Pathway Stage</th>
                <th style={{ padding: '10px 12px', minWidth: 220 }}>Next Invitation</th>
                <th style={{ padding: '10px 12px' }}>Holder</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Sync</th>
              </tr>
            </thead>
            <tbody>
              {filteredStations.map(person => {
                const currentStage = (person.pathwayStage || person.status || 'Arrive') as PathwayStage;
                const isDoNotContact = currentStage === 'Do Not Contact';
                const stageStyle = STAGE_COLORS[currentStage] || STAGE_COLORS.Arrive;
                const isBlankInvite = !person.nextInvitation || person.nextInvitation.trim() === '';

                return (
                  <tr
                    key={person.id}
                    style={{
                      borderBottom: '1px solid var(--border-soft, #E0DBD5)',
                      background: isDoNotContact ? 'rgba(196, 113, 113, 0.04)' : 'transparent',
                    }}
                  >
                    {/* Name & Roles */}
                    <td style={{ padding: '12px 12px', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '1.1rem' }}>{person.emoji || '👤'}</span>
                        <div>
                          <div style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: '0.88rem',
                            fontWeight: 600,
                            color: isDoNotContact ? '#A82828' : 'var(--text-primary)',
                          }}>
                            {person.name}
                          </div>
                          {person.description && (
                            <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: 'var(--text-muted)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {person.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Inline Pathway Stage Select */}
                    <td style={{ padding: '12px 12px', verticalAlign: 'top' }}>
                      <select
                        value={currentStage}
                        onChange={e => handleStageChange(person.id, e.target.value)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 8,
                          border: `1px solid ${stageStyle.border}`,
                          background: stageStyle.bg,
                          color: stageStyle.color,
                          fontFamily: 'var(--font-label)',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          outline: 'none',
                        }}
                      >
                        {PATHWAY_STAGES.map(st => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                      {isDoNotContact && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, color: '#A82828', fontSize: '0.65rem', fontFamily: 'var(--font-label)', fontWeight: 600 }}>
                          <ShieldAlert size={10} />
                          <span>Strict boundary</span>
                        </div>
                      )}
                    </td>

                    {/* Inline Next Invitation Editor */}
                    <td style={{ padding: '12px 12px', verticalAlign: 'top' }}>
                      {isDoNotContact ? (
                        <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', color: '#A82828', fontStyle: 'italic' }}>
                          No invitations (Do Not Contact)
                        </span>
                      ) : editingInvitationId === person.id ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input
                            value={invitationDraft}
                            onChange={e => setInvitationDraft(e.target.value)}
                            placeholder="Next touchpoint or invitation..."
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveInvitation(person.id); }}
                            autoFocus
                            style={{
                              flex: 1,
                              padding: '4px 8px',
                              borderRadius: 6,
                              border: '1.5px solid var(--cr8w-primary, #C25B38)',
                              fontSize: '0.78rem',
                              fontFamily: 'var(--font-body)',
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveInvitation(person.id)}
                            style={{ padding: '4px 8px', borderRadius: 4, background: 'var(--cr8w-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.7rem' }}
                          >
                            <Check size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingInvitationId(null)}
                            style={{ padding: '4px 8px', borderRadius: 4, background: 'none', border: '1px solid var(--border-soft)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.7rem' }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => {
                            setEditingInvitationId(person.id);
                            setInvitationDraft(person.nextInvitation || '');
                          }}
                          style={{
                            cursor: 'pointer',
                            padding: '4px 8px',
                            borderRadius: 6,
                            background: isBlankInvite ? 'rgba(194,91,56,0.06)' : 'transparent',
                            border: isBlankInvite ? '1px dashed rgba(194,91,56,0.3)' : '1px solid transparent',
                            color: isBlankInvite ? '#C25B38' : 'var(--text-secondary)',
                            fontFamily: 'var(--font-body)',
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                          title="Click to edit Next Invitation"
                        >
                          <span>{person.nextInvitation || '— Set next invitation —'}</span>
                          {isBlankInvite && (
                            <span style={{ fontSize: '0.62rem', fontFamily: 'var(--font-label)', fontWeight: 700, color: '#C25B38' }}>
                              BLANK
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Holder */}
                    <td style={{ padding: '12px 12px', verticalAlign: 'top' }}>
                      <span style={{
                        fontFamily: 'var(--font-label)',
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}>
                        {PERSONS[person.owner]?.emoji || '👤'} {PERSONS[person.owner]?.name || person.owner || 'team'}
                      </span>
                    </td>

                    {/* Sync Status Chip */}
                    <td style={{ padding: '12px 12px', verticalAlign: 'top', textAlign: 'right' }}>
                      <NotionSyncChip sync={person.notionSync} />
                    </td>
                  </tr>
                );
              })}

              {filteredStations.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', fontFamily: 'var(--font-body)', fontSize: '0.85rem' }}>
                    No community members match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── ADD PERSON MODAL ── */}
      {showAddPersonModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: 20,
        }} onClick={() => setShowAddPersonModal(false)}>
          <div style={{
            background: 'var(--bg-card, #FFFFFF)',
            borderRadius: 12,
            padding: 24,
            maxWidth: 440,
            width: '100%',
            boxShadow: 'var(--shadow-lg)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', margin: 0, color: 'var(--text-primary)' }}>
                Add Person to Care Registry
              </h3>
              <button
                type="button"
                onClick={() => setShowAddPersonModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreatePerson} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                  Full Name / Community Handle
                </label>
                <input
                  required
                  value={newPerson.name}
                  onChange={e => setNewPerson({ ...newPerson, name: e.target.value })}
                  placeholder="e.g. Jordan River"
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 6,
                    border: '1px solid var(--border-soft)', background: 'var(--bg-elevated)',
                    fontFamily: 'var(--font-body)', fontSize: '0.85rem',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                    Relationship Holder
                  </label>
                  <select
                    value={newPerson.owner}
                    onChange={e => setNewPerson({ ...newPerson, owner: e.target.value })}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 6,
                      border: '1px solid var(--border-soft)', background: 'var(--bg-elevated)',
                      fontFamily: 'var(--font-label)', fontSize: '0.75rem',
                    }}
                  >
                    {Object.entries(PERSONS).map(([k, p]) => (
                      <option key={k} value={k}>{p.emoji} {p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                    Pathway Stage
                  </label>
                  <select
                    value={newPerson.pathwayStage}
                    onChange={e => setNewPerson({ ...newPerson, pathwayStage: e.target.value as PathwayStage })}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 6,
                      border: '1px solid var(--border-soft)', background: 'var(--bg-elevated)',
                      fontFamily: 'var(--font-label)', fontSize: '0.75rem',
                    }}
                  >
                    {PATHWAY_STAGES.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                  Next Invitation
                </label>
                <input
                  value={newPerson.nextInvitation}
                  onChange={e => setNewPerson({ ...newPerson, nextInvitation: e.target.value })}
                  placeholder="e.g. Invite to next Book Club..."
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 6,
                    border: '1px solid var(--border-soft)', background: 'var(--bg-elevated)',
                    fontFamily: 'var(--font-body)', fontSize: '0.85rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                  Station / Roles / Notes
                </label>
                <textarea
                  value={newPerson.description}
                  onChange={e => setNewPerson({ ...newPerson, description: e.target.value })}
                  placeholder="e.g. Tea Station anchor, audio assistance..."
                  rows={2}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 6,
                    border: '1px solid var(--border-soft)', background: 'var(--bg-elevated)',
                    fontFamily: 'var(--font-body)', fontSize: '0.82rem',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowAddPersonModal(false)}
                  style={{
                    padding: '8px 16px', borderRadius: 6,
                    background: 'none', border: '1px solid var(--border-soft)',
                    color: 'var(--text-muted)', fontSize: '0.78rem', cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 18px', borderRadius: 6,
                    background: 'var(--cr8w-primary, #C25B38)', border: 'none',
                    color: '#fff', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
                  }}
                >
                  Save Person
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
