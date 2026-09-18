import React, { useState, useRef, useEffect } from 'react';
import { showToast } from './Toast';

/* ─── Types ─────────────────────────────────────────────────── */
type InputMode = 'write' | 'voice' | 'video';

interface DecomprocessEntry {
  happened: string;
  body: string;
  carryForward: string;
  timestamp: string;
  type?: InputMode;
  mediaData?: string; // legacy base64 data URI (kept for backward compat)
  mediaKey?: string;  // IndexedDB key for blob storage
  transcript?: string;
}

const BODY_OPTIONS = [
  { key: 'tension', emoji: '\uD83D\uDE24', label: 'tension' },
  { key: 'release', emoji: '\uD83D\uDE0C', label: 'release' },
  { key: 'unsure', emoji: '\uD83E\uDD37', label: 'unsure' },
];

const BODY_EMOJI_MAP: Record<string, string> = {
  tension: '\uD83D\uDE24',
  release: '\uD83D\uDE0C',
  unsure: '\uD83E\uDD37',
};

function formatRelativeDate(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ─── Shared colors (sage-green palette) ─── */
const PRIMARY = '#7BA89D';
const PRIMARY_DARK = '#5F8D82';
const PRIMARY_BG = 'rgba(123,168,157,0.12)';
const PRIMARY_BORDER = 'rgba(123,168,157,0.15)';
const TEXT_MAIN = '#2D2438';

/* ─── IndexedDB helpers for media blob storage ─── */
const IDB_NAME = 'decomprocess_media';
const IDB_STORE = 'blobs';
const IDB_VERSION = 1;

function openMediaDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveMediaBlob(key: string, blob: Blob): Promise<void> {
  const db = await openMediaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(blob, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function getMediaBlob(key: string): Promise<Blob | null> {
  try {
    const db = await openMediaDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  } catch {
    return null;
  }
}

async function clearAllMediaBlobs(): Promise<void> {
  try {
    const db = await openMediaDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).clear();
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch { /* silent */ }
}

/* ═══════════════════════════════════════════════════════════════
   Voice Input — file picker for audio
   No getUserMedia or SpeechRecognition needed — both are blocked
   in sandboxed iframe contexts. File picker always works.
   ═══════════════════════════════════════════════════════════════ */
function VoiceInput({
  onFileBlob,
  onTranscript,
}: {
  onFileBlob: (blob: Blob | null) => void;
  onTranscript: (text: string) => void;
}) {
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [manualNote, setManualNote] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      showToast('\u26A0\uFE0F file too large — max 50 MB', 'alert');
      return;
    }
    setFileName(file.name);
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    onFileBlob(file);
  }

  function clearFile() {
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFilePreview(null);
    setFileName('');
    onFileBlob(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0' }}>
      {/* Hidden file input — no capture attribute (blocked in iframes) */}
      <input
        ref={fileRef}
        type="file"
        accept="audio/*,.m4a,.mp3,.wav,.ogg,.webm,.aac"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {!filePreview ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              width: 72, height: 72, borderRadius: '50%', border: 'none',
              background: PRIMARY, color: '#fff', fontSize: '1.8rem',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(123,168,157,0.35)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {'\uD83C\uDFA4'}
          </button>
          <div style={{ fontFamily: "var(--font-label)", fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
            record a voice memo on your device, then upload it here
          </div>
          <div style={{
            fontFamily: "var(--font-label)", fontSize: '0.68rem',
            color: 'rgba(45,36,56,0.35)', textAlign: 'center',
          }}>
            supports .m4a, .mp3, .wav, .ogg, .webm
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
          <audio controls src={filePreview} style={{ width: '100%', height: 40, borderRadius: 8 }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: "var(--font-label)", fontSize: '0.75rem', color: PRIMARY_DARK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
              {'\uD83C\uDFA4'} {fileName}
            </span>
            <button
              onClick={clearFile}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: "var(--font-label)", fontSize: '0.7rem', color: '#FF453A',
                fontWeight: 600,
              }}
            >remove</button>
          </div>
        </div>
      )}

      {/* Optional text note alongside the recording */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontFamily: "var(--font-label)", fontSize: '0.68rem', color: 'var(--text-muted)',
      }}>
        <div style={{ flex: 1, height: 1, background: 'rgba(45,36,56,0.08)' }} />
        add a note (optional)
        <div style={{ flex: 1, height: 1, background: 'rgba(45,36,56,0.08)' }} />
      </div>
      <textarea
        value={manualNote}
        onChange={e => { setManualNote(e.target.value); onTranscript(e.target.value); }}
        placeholder="quick context for this recording..."
        style={{
          fontFamily: "var(--font-label)", fontSize: '0.85rem', color: TEXT_MAIN,
          background: 'rgba(255,255,255,0.7)', border: `1px solid ${PRIMARY_BORDER}`,
          borderRadius: 10, padding: '10px 12px', minHeight: 56,
          resize: 'vertical', outline: 'none', lineHeight: 1.5,
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Video Input — file picker for video
   No getUserMedia needed. File picker always works.
   On mobile: opens camera roll. On desktop: opens file chooser.
   ═══════════════════════════════════════════════════════════════ */
function VideoInput({
  onFileBlob,
}: {
  onFileBlob: (blob: Blob | null) => void;
}) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      showToast('\u26A0\uFE0F file too large — max 100 MB', 'alert');
      return;
    }
    setFileName(file.name);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    onFileBlob(file);
  }

  function clearFile() {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    setFileName('');
    onFileBlob(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '4px 0' }}>
      {/* No capture attribute — it triggers getUserMedia in some browsers */}
      <input
        ref={fileRef}
        type="file"
        accept="video/*,.mp4,.mov,.webm,.m4v"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {!videoUrl ? (
        <>
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              width: 72, height: 72, borderRadius: '50%', border: 'none',
              background: PRIMARY, color: '#fff', fontSize: '1.8rem',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(123,168,157,0.35)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {'\uD83C\uDFA5'}
          </button>
          <div style={{ fontFamily: "var(--font-label)", fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
            record a video on your device, then upload it here
          </div>
          <div style={{
            fontFamily: "var(--font-label)", fontSize: '0.68rem',
            color: 'rgba(45,36,56,0.35)', textAlign: 'center',
          }}>
            supports .mp4, .mov, .webm, .m4v
          </div>
        </>
      ) : (
        <>
          <video
            controls
            src={videoUrl}
            style={{ width: '100%', maxHeight: 200, borderRadius: 12, background: '#000', objectFit: 'cover' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span style={{
              fontFamily: "var(--font-label)", fontSize: '0.75rem', color: PRIMARY_DARK,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%',
            }}>
              {'\uD83C\uDFA5'} {fileName}
            </span>
            <button
              onClick={clearFile}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: "var(--font-label)", fontSize: '0.7rem', color: '#FF453A',
                fontWeight: 600,
              }}
            >redo</button>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Mode Selector Pills
   ═══════════════════════════════════════════════════════════════ */
const MODES: { key: InputMode; emoji: string; label: string }[] = [
  { key: 'write', emoji: '\u270F\uFE0F', label: 'write' },
  { key: 'voice', emoji: '\uD83C\uDFA4', label: 'voice' },
  { key: 'video', emoji: '\uD83C\uDFA5', label: 'video' },
];

function ModeSelector({ mode, onChange }: { mode: InputMode; onChange: (m: InputMode) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 14 }}>
      {MODES.map(m => (
        <button
          key={m.key}
          onClick={() => onChange(m.key)}
          style={{
            padding: '5px 14px',
            borderRadius: 20,
            border: mode === m.key ? `1.5px solid ${PRIMARY}` : '1.5px solid rgba(45,36,56,0.12)',
            background: mode === m.key ? PRIMARY_BG : 'rgba(255,255,255,0.5)',
            color: mode === m.key ? PRIMARY_DARK : 'var(--text-muted)',
            fontFamily: "var(--font-label)",
            fontSize: '0.75rem',
            fontWeight: mode === m.key ? 700 : 500,
            cursor: 'pointer',
            transition: 'all 0.15s',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span style={{ fontSize: '0.8rem' }}>{m.emoji}</span> {m.label}
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   History Media Player — loads blob from IndexedDB
   ═══════════════════════════════════════════════════════════════ */
function HistoryMediaPlayer({ entry }: { entry: DecomprocessEntry }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let revoke: string | null = null;

    (async () => {
      if (entry.mediaKey) {
        const blob = await getMediaBlob(entry.mediaKey);
        if (blob) {
          const u = URL.createObjectURL(blob);
          revoke = u;
          setUrl(u);
          setLoading(false);
          return;
        }
      }
      if (entry.mediaData) {
        setUrl(entry.mediaData);
        setLoading(false);
        return;
      }
      setLoading(false);
    })();

    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [entry.mediaKey, entry.mediaData]);

  if (loading) {
    return (
      <div style={{ fontFamily: "var(--font-label)", fontSize: '0.78rem', color: 'var(--text-muted)', padding: '8px 0' }}>
        loading recording...
      </div>
    );
  }

  // Show transcript if present
  const hasTranscript = entry.transcript && entry.transcript.trim().length > 0;

  return (
    <div>
      {hasTranscript && (
        <div style={{
          fontFamily: "var(--font-label)", fontSize: '0.82rem',
          color: TEXT_MAIN, lineHeight: 1.5, marginBottom: url ? 8 : 0,
        }}>
          {entry.transcript}
        </div>
      )}
      {url ? (
        entry.type === 'voice'
          ? <audio controls src={url} style={{ width: '100%', height: 36 }} />
          : <video controls src={url} style={{ width: '100%', maxHeight: 180, borderRadius: 8, background: '#000' }} />
      ) : !hasTranscript ? (
        <div style={{ fontFamily: "var(--font-label)", fontSize: '0.78rem', color: 'var(--text-muted)', padding: '8px 0', fontStyle: 'italic' }}>
          recording no longer available
        </div>
      ) : null}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main FAB + Bottom Sheet
   
   Positioned bottom-LEFT to avoid colliding with the CR8W Chat
   bubble which lives bottom-RIGHT. Quiet architecture: two
   anchored actions on opposite sides, clean breathing room.
   ═══════════════════════════════════════════════════════════════ */
export function DecomprocessFAB() {
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<InputMode>('write');
  const [happened, setHappened] = useState('');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [mediaBlob, setMediaBlob] = useState<Blob | null>(null);
  const [body, setBody] = useState('');
  const [carryForward, setCarryForward] = useState('');
  const [sealed, setSealed] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null);

  function handleOpen() {
    setOpen(true);
    setShowHistory(false);
    setStep(1);
    setMode('write');
    setHappened('');
    setVoiceTranscript('');
    setMediaBlob(null);
    setBody('');
    setCarryForward('');
    setSealed(false);
  }

  function handleOpenHistory() {
    setOpen(true);
    setShowHistory(true);
    setExpandedEntry(null);
  }

  function handleBodySelect(value: string) {
    setBody(value);
    setTimeout(() => setStep(3), 400);
  }

  const canAdvance =
    mode === 'write'
      ? happened.trim().length > 0
      : mode === 'voice'
        ? voiceTranscript.trim().length > 0 || mediaBlob !== null
        : mediaBlob !== null;

  function resetInputs() {
    setHappened('');
    setVoiceTranscript('');
    setMediaBlob(null);
    setBody('');
    setCarryForward('');
  }

  async function handleSeal() {
    const ts = new Date().toISOString();
    let mediaKey: string | undefined;

    if (mediaBlob) {
      mediaKey = `decomp_${ts}_${mode}`;
      try {
        await saveMediaBlob(mediaKey, mediaBlob);
      } catch (err) {
        console.error('Failed to save media to IndexedDB:', err);
        showToast('\u26A0\uFE0F couldn\u2019t save recording \u2014 try write mode', 'alert');
        return;
      }
    }

    const happenedText =
      mode === 'write'
        ? happened
        : mode === 'voice'
          ? voiceTranscript || '[voice recording]'
          : '[video recording]';

    const entry: DecomprocessEntry = {
      happened: happenedText,
      body,
      carryForward,
      timestamp: ts,
      type: mode,
      mediaKey,
      transcript: mode === 'voice' && voiceTranscript ? voiceTranscript : undefined,
    };
    try {
      const log = JSON.parse(localStorage.getItem('decomprocess_log') || '[]');
      log.push(entry);
      localStorage.setItem('decomprocess_log', JSON.stringify(log));
    } catch (err) {
      console.error('Failed to save decomprocess entry:', err);
      showToast('\u26A0\uFE0F couldn\u2019t save \u2014 try again', 'alert');
      return;
    }
    setSealed(true);
    setTimeout(() => {
      setOpen(false);
      setSealed(false);
    }, 2200);
    showToast('\uD83C\uDF00 sealed. you processed that.');
  }

  function getHistory(): DecomprocessEntry[] {
    try {
      const log = JSON.parse(localStorage.getItem('decomprocess_log') || '[]');
      return (log as DecomprocessEntry[]).reverse();
    } catch { return []; }
  }

  function clearHistory() {
    if (confirm('clear all decomprocess entries? this can\u2019t be undone.')) {
      localStorage.removeItem('decomprocess_log');
      clearAllMediaBlobs();
      setExpandedEntry(null);
    }
  }

  const historyEntries = showHistory ? getHistory() : [];

  return (
    <>
      {/* Pulsing keyframe */}
      <style>{`
        @keyframes decomRecordPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.06); opacity: 0.85; }
        }
      `}</style>

      {/* ── FAB cluster: bottom-LEFT (chat is bottom-RIGHT) ── */}
      <div style={{
        position: 'fixed',
        bottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
        left: 18,
        zIndex: 899,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
      }}>
        {/* History mini-button */}
        <button
          onClick={handleOpenHistory}
          title="decomprocess history"
          style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            border: 'none',
            background: PRIMARY_BG,
            color: PRIMARY,
            fontSize: '0.65rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        >{'\uD83D\uDCDC'}</button>

        {/* Main FAB */}
        <button
          onClick={handleOpen}
          title="decomprocess"
          className="decomprocess-fab"
          style={{
            position: 'relative',
            animation: 'decomFabPulse 3s ease-in-out infinite',
          }}
        >{'\uD83C\uDF00'}</button>
      </div>

      {/* ── Backdrop + Bottom Sheet ── */}
      {open && (
        <>
          <div
            onClick={() => !sealed && setOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(44,28,16,0.35)',
              zIndex: 1000,
              animation: 'cw-fadeInUp 0.2s ease',
            }}
          />
          <div className="decomprocess-sheet" style={{
            animation: 'decomSlideUp 0.3s ease',
            maxHeight: showHistory ? '70vh' : undefined,
            overflowY: showHistory ? 'auto' : undefined,
          }}>
            {/* Tab toggle */}
            <div style={{
              display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1.5px solid rgba(44,28,16,0.08)',
            }}>
              <button
                onClick={() => { setShowHistory(false); setStep(1); setMode('write'); resetInputs(); }}
                style={{
                  flex: 1, padding: '8px 0', border: 'none', background: 'none', cursor: 'pointer',
                  fontFamily: "var(--font-display)", fontSize: '0.82rem', fontWeight: !showHistory ? 600 : 400,
                  color: !showHistory ? PRIMARY : 'rgba(44,28,16,0.4)',
                  borderBottom: !showHistory ? `2px solid ${PRIMARY}` : '2px solid transparent',
                  transition: 'all 0.15s',
                }}
              >{'\uD83C\uDF00'} decomprocess</button>
              <button
                onClick={() => { setShowHistory(true); setExpandedEntry(null); }}
                style={{
                  flex: 1, padding: '8px 0', border: 'none', background: 'none', cursor: 'pointer',
                  fontFamily: "var(--font-display)", fontSize: '0.82rem', fontWeight: showHistory ? 600 : 400,
                  color: showHistory ? PRIMARY : 'rgba(44,28,16,0.4)',
                  borderBottom: showHistory ? `2px solid ${PRIMARY}` : '2px solid transparent',
                  transition: 'all 0.15s',
                }}
              >{'\uD83D\uDCDC'} history</button>
            </div>

            {/* ─── New decomprocess flow ─── */}
            {!showHistory && (
              <>
                {sealed ? (
                  <div className="decomprocess-seal-msg" style={{
                    textAlign: 'center', padding: '40px 0',
                    fontFamily: "var(--font-display)", fontSize: '1.05rem',
                    color: TEXT_MAIN, lineHeight: 1.5,
                  }}>
                    sealed. you processed that. {'\uD83C\uDF00'}
                  </div>
                ) : (
                  <>
                    {/* Step indicator */}
                    <div className="decomprocess-step-bar">
                      {[1, 2, 3].map(s => (
                        <div key={s} className={`decomprocess-step-pip ${step >= s ? 'active' : 'inactive'}`} />
                      ))}
                    </div>

                    {step === 1 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{
                          fontFamily: "var(--font-display)", fontSize: '1.05rem',
                          color: TEXT_MAIN, textAlign: 'center',
                        }}>what just happened?</div>

                        <ModeSelector mode={mode} onChange={m => {
                          setMode(m);
                          setMediaBlob(null);
                          setVoiceTranscript('');
                        }} />

                        {mode === 'write' && (
                          <textarea
                            value={happened}
                            onChange={e => setHappened(e.target.value)}
                            placeholder="dump it here. no editing. no judgment."
                            autoFocus
                            style={{
                              fontFamily: "var(--font-label)", fontSize: '0.9rem', color: TEXT_MAIN,
                              background: 'rgba(255,255,255,0.7)', border: `1px solid ${PRIMARY_BORDER}`,
                              borderRadius: 12, padding: '12px 14px', minHeight: 100,
                              resize: 'vertical', outline: 'none', lineHeight: 1.5,
                            }}
                          />
                        )}

                        {mode === 'voice' && (
                          <VoiceInput onFileBlob={setMediaBlob} onTranscript={setVoiceTranscript} />
                        )}

                        {mode === 'video' && (
                          <VideoInput onFileBlob={setMediaBlob} />
                        )}

                        <button
                          onClick={() => canAdvance && setStep(2)}
                          disabled={!canAdvance}
                          style={{
                            alignSelf: 'flex-end', padding: '8px 20px', borderRadius: 10,
                            border: 'none',
                            background: canAdvance ? PRIMARY : 'rgba(123,168,157,0.3)',
                            color: '#fff', fontFamily: 'var(--font-label)',
                            fontSize: '0.78rem', fontWeight: 700,
                            cursor: canAdvance ? 'pointer' : 'default',
                            letterSpacing: '0.02em',
                          }}
                        >next {'\u2192'}</button>
                      </div>
                    )}

                    {step === 2 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
                        <div style={{
                          fontFamily: "var(--font-display)", fontSize: '1.05rem', color: TEXT_MAIN,
                        }}>what's still in your body?</div>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                          {BODY_OPTIONS.map(o => (
                            <button
                              key={o.key}
                              onClick={() => handleBodySelect(o.key)}
                              className="decomprocess-body-pill"
                              style={{
                                padding: '12px 20px', borderRadius: 16,
                                border: body === o.key ? `2px solid ${PRIMARY}` : '1.5px solid rgba(44,28,16,0.12)',
                                background: body === o.key ? PRIMARY_BG : 'rgba(255,255,255,0.6)',
                                cursor: 'pointer', fontSize: '1.1rem',
                                fontFamily: "var(--font-label)", fontWeight: 500,
                                color: TEXT_MAIN, transition: 'all 0.15s',
                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                                gap: 4, minWidth: 80,
                              }}
                            >
                              <span style={{ fontSize: '1.5rem' }}>{o.emoji}</span>
                              <span style={{ fontSize: '0.75rem' }}>{o.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {step === 3 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{
                          fontFamily: "var(--font-display)", fontSize: '1.05rem',
                          color: TEXT_MAIN, textAlign: 'center',
                        }}>one thing to carry forward:</div>
                        <input
                          type="text"
                          value={carryForward}
                          onChange={e => setCarryForward(e.target.value)}
                          placeholder="just one thing..."
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Enter' && carryForward.trim()) handleSeal(); }}
                          style={{
                            fontFamily: "var(--font-label)", fontSize: '0.9rem', color: TEXT_MAIN,
                            background: 'rgba(255,255,255,0.7)', border: `1px solid ${PRIMARY_BORDER}`,
                            borderRadius: 12, padding: '12px 14px', outline: 'none',
                          }}
                        />
                        <button
                          onClick={handleSeal}
                          disabled={!carryForward.trim()}
                          style={{
                            alignSelf: 'center', padding: '10px 24px', borderRadius: 12,
                            border: 'none',
                            background: carryForward.trim() ? PRIMARY : 'rgba(123,168,157,0.3)',
                            color: '#fff', fontFamily: 'var(--font-label)',
                            fontSize: '0.82rem', fontWeight: 700,
                            cursor: carryForward.trim() ? 'pointer' : 'default',
                            letterSpacing: '0.02em',
                          }}
                        >seal it {'\uD83E\uDEE7'}</button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* ─── History view ─── */}
            {showHistory && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {historyEntries.length === 0 ? (
                  <div style={{
                    textAlign: 'center', padding: '32px 0',
                    fontFamily: "var(--font-label)", fontSize: '0.88rem',
                    color: 'rgba(44,28,16,0.4)', fontStyle: 'italic',
                  }}>
                    nothing sealed yet. that's okay.{'\n'}you'll know when you need it. {'\uD83C\uDF00'}
                  </div>
                ) : (
                  <>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      marginBottom: 12, padding: '0 2px',
                    }}>
                      <span style={{
                        fontFamily: 'var(--font-label)', fontSize: '0.62rem', fontWeight: 600,
                        color: 'var(--text-muted)', letterSpacing: '0.03em', textTransform: 'uppercase',
                      }}>
                        {historyEntries.length} sealed {historyEntries.length === 1 ? 'entry' : 'entries'}
                      </span>
                      <button
                        onClick={clearHistory}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontFamily: 'var(--font-label)', fontSize: '0.6rem', fontWeight: 600,
                          color: 'rgba(123,168,157,0.5)', letterSpacing: '0.02em',
                        }}
                      >clear all</button>
                    </div>

                    {historyEntries.map((entry, idx) => {
                      const isExpanded = expandedEntry === idx;
                      const bodyEmoji = BODY_EMOJI_MAP[entry.body] || '\uD83E\uDD37';
                      const typeLabel = entry.type && entry.type !== 'write'
                        ? ` \u00B7 ${entry.type === 'voice' ? '\uD83C\uDFA4' : '\uD83C\uDFA5'}`
                        : '';
                      return (
                        <div
                          key={idx}
                          onClick={() => setExpandedEntry(isExpanded ? null : idx)}
                          style={{
                            padding: '12px 14px',
                            borderBottom: '1px solid rgba(44,28,16,0.06)',
                            cursor: 'pointer',
                            transition: 'background 0.15s',
                            background: isExpanded ? PRIMARY_BG : 'transparent',
                            borderRadius: isExpanded ? 10 : 0,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: '0.9rem' }}>{bodyEmoji}</span>
                            <span style={{
                              fontFamily: "var(--font-label)", fontSize: '0.82rem',
                              color: TEXT_MAIN, flex: 1,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isExpanded ? 'normal' : 'nowrap',
                            }}>
                              {entry.happened.length > 60 && !isExpanded
                                ? entry.happened.slice(0, 60) + '...'
                                : entry.happened}
                              {typeLabel}
                            </span>
                            <span style={{
                              fontFamily: 'var(--font-label)', fontSize: '0.58rem',
                              color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0,
                            }}>
                              {formatRelativeDate(entry.timestamp)}
                            </span>
                            <span style={{
                              fontSize: '0.6rem', color: 'var(--text-muted)',
                              transition: 'transform 0.2s',
                              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            }}>{'\u25BC'}</span>
                          </div>

                          {isExpanded && (
                            <div style={{
                              marginTop: 10, padding: '10px 12px',
                              background: 'rgba(255,255,255,0.6)',
                              borderRadius: 10, animation: 'cw-fadeInUp 0.2s ease',
                            }}>
                              <div style={{ marginBottom: 8 }}>
                                <div style={{
                                  fontFamily: 'var(--font-label)', fontSize: '0.58rem', fontWeight: 700,
                                  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em',
                                  marginBottom: 4,
                                }}>what happened</div>
                                {(entry.type === 'voice' || entry.type === 'video') && (entry.mediaKey || entry.mediaData || entry.transcript) ? (
                                  <HistoryMediaPlayer entry={entry} />
                                ) : (
                                  <div style={{
                                    fontFamily: "var(--font-label)", fontSize: '0.82rem',
                                    color: TEXT_MAIN, lineHeight: 1.5,
                                  }}>{entry.happened}</div>
                                )}
                              </div>
                              <div style={{ marginBottom: 8 }}>
                                <div style={{
                                  fontFamily: 'var(--font-label)', fontSize: '0.58rem', fontWeight: 700,
                                  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em',
                                  marginBottom: 4,
                                }}>body state</div>
                                <div style={{
                                  fontFamily: "var(--font-label)", fontSize: '0.82rem',
                                  color: TEXT_MAIN, display: 'flex', alignItems: 'center', gap: 5,
                                }}>
                                  {bodyEmoji} {entry.body}
                                </div>
                              </div>
                              <div>
                                <div style={{
                                  fontFamily: 'var(--font-label)', fontSize: '0.58rem', fontWeight: 700,
                                  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em',
                                  marginBottom: 4,
                                }}>carrying forward</div>
                                <div style={{
                                  fontFamily: "var(--font-label)", fontSize: '0.88rem',
                                  color: PRIMARY, fontWeight: 600, fontStyle: 'italic',
                                }}>
                                  &ldquo;{entry.carryForward}&rdquo;
                                </div>
                              </div>
                              <div style={{
                                marginTop: 8, textAlign: 'right',
                                fontFamily: 'var(--font-label)', fontSize: '0.55rem',
                                color: 'var(--text-muted)',
                              }}>
                                {new Date(entry.timestamp).toLocaleDateString('en-US', {
                                  weekday: 'short', month: 'short', day: 'numeric',
                                })} at {new Date(entry.timestamp).toLocaleTimeString('en-US', {
                                  hour: 'numeric', minute: '2-digit',
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
