import React, { useState, useEffect, useRef } from 'react';

// ── MBody Prompt Pools ─────────────────────────────────────────────────────────

const CATEGORIES = [
  {
    id: 'breathwork',
    label: 'Breathwork',
    emoji: '🌬️',
    color: '#3A6A8A',       // monny-deep — calm, readable on warm surfaces
    bgTint: '#3A6A8A12',
    borderTint: '#3A6A8A25',
    prompts: [
      "stop scrolling. close your eyes. 4 counts in, 7 hold, 8 out. your nervous system is literally begging you.",
      "you've been chest-breathing for hours. drop it into your belly. breathe like you actually want to be alive.",
      "box breathing. 4-4-4-4. do it three times. you're not too busy, you're just avoidant.",
      "inhale through nose, exhale through mouth like you're fogging a mirror. do it 5 times. let the jaw unclench.",
      "put your hand on your chest. breathe into it. feel your own heartbeat. you're still here. that matters.",
    ],
  },
  {
    id: 'movement',
    label: 'Mindful Movement',
    emoji: '🏋️',
    color: '#7BA89D',       // sage green — primary brand
    bgTint: '#7BA89D10',
    borderTint: '#7BA89D22',
    prompts: [
      "roll your neck. slowly. like you actually respect the body carrying you through this chaos.",
      "stand up. shake your whole body for 30 seconds. you're not a statue, stop acting like one.",
      "stretch your hip flexors right now. they're holding every emotion you refused to process.",
      "do 10 slow squats. not for aesthetics. because your legs literally carry you and you never thank them.",
      "walk to the nearest window. look outside. remind yourself the world exists beyond your screen.",
    ],
  },
  {
    id: 'eating',
    label: 'Mindful Eating',
    emoji: '🌿',
    color: '#6A4A28',       // bingle-deep — earthy, grounded
    bgTint: '#6A4A2810',
    borderTint: '#6A4A2820',
    prompts: [
      "when's the last time you ate? not snacked — actually ate? go handle that.",
      "drink water. right now. not later. your brain is 75% water and you're running it on fumes.",
      "next meal, put your phone down for the first 5 bites. taste your food like it's the first time.",
      "if you're stress-eating, pause. ask yourself what you actually need. food might not be it — but it also might be. no judgment.",
      "eat something green today. not because diet culture said so, but because your gut literally communicates with your brain and it's asking for nutrients.",
    ],
  },
] as const;

type Category = typeof CATEGORIES[number];

export function MBodyWidget() {
  const [result, setResult] = useState<{ category: Category; prompt: string } | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [shuffleText, setShuffleText] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function spin() {
    setShowPrompt(false);
    setIsSpinning(true);

    const cat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    const prompt = cat.prompts[Math.floor(Math.random() * cat.prompts.length)];

    let count = 0;
    const totalCycles = 12;
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      count++;
      const randCat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
      const randPrompt = randCat.prompts[Math.floor(Math.random() * randCat.prompts.length)];
      setShuffleText(`${randCat.emoji} ${randPrompt.slice(0, 40)}...`);

      if (count >= totalCycles) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setResult({ category: cat, prompt });
        setIsSpinning(false);
        setShuffleText('');
        setTimeout(() => setShowPrompt(true), 80);
      }
    }, 100);
  }

  return (
    <div
      style={{
        background: 'var(--bg-card, #FFDEC2)',
        border: '1px solid var(--border-soft, #D4C4B0)',
        borderRadius: 'var(--cr-radius-md, 14px)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm, 0 1px 5px rgba(44,28,16,0.12))',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px 12px',
          borderBottom: '1px solid var(--border-soft, #D4C4B0)',
          background: 'linear-gradient(135deg, rgba(123,168,157,0.06) 0%, rgba(184,169,212,0.06) 100%)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-display, Fredoka, sans-serif)',
            fontSize: '1.1rem',
            fontWeight: 600,
            color: 'var(--text-primary, #2C1C10)',
            marginBottom: 2,
          }}
        >
          🧘‍♀️ MBody
        </div>
        <div
          style={{
            fontFamily: 'var(--font-body, Montserrat, sans-serif)',
            fontSize: '0.76rem',
            color: 'var(--text-muted, #624030)',
            fontStyle: 'italic',
            letterSpacing: '0.01em',
          }}
        >
          your body is trying to tell you something
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '16px 20px 20px' }}>
        {/* Spin Button — initial state */}
        {!result && !isSpinning && (
          <button
            onClick={spin}
            style={{
              width: '100%',
              padding: '18px 20px',
              borderRadius: 'var(--cr-radius-sm, 8px)',
              border: '2px solid var(--primary, #7BA89D)',
              background: 'var(--bg-elevated, #FFF4EC)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
            onMouseOver={e => {
              const btn = e.currentTarget as HTMLButtonElement;
              btn.style.background = 'rgba(123,168,157,0.08)';
              btn.style.boxShadow = '0 2px 12px rgba(123,168,157,0.15)';
            }}
            onMouseOut={e => {
              const btn = e.currentTarget as HTMLButtonElement;
              btn.style.background = 'var(--bg-elevated, #FFF4EC)';
              btn.style.boxShadow = 'none';
            }}
          >
            <span style={{ fontSize: '2rem' }}>🎰</span>
            <span
              style={{
                fontFamily: 'var(--font-display, Fredoka, sans-serif)',
                fontSize: '1rem',
                fontWeight: 700,
                color: 'var(--primary, #7BA89D)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}
            >
              SPIN
            </span>
            <span
              style={{
                fontFamily: 'var(--font-body, Montserrat, sans-serif)',
                fontSize: '0.7rem',
                color: 'var(--text-muted, #624030)',
                fontWeight: 500,
              }}
            >
              breathwork · movement · eating
            </span>
          </button>
        )}

        {/* Shuffling state */}
        {isSpinning && (
          <div
            style={{
              padding: '20px 16px',
              borderRadius: 'var(--cr-radius-sm, 8px)',
              background: 'var(--bg-elevated, #FFF4EC)',
              border: '1px solid var(--border-soft, #D4C4B0)',
              textAlign: 'center',
              minHeight: 100,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                fontSize: '1.8rem',
                animation: 'mbody-spin 0.6s linear infinite',
              }}
            >
              🎰
            </div>
            <div
              style={{
                fontFamily: 'var(--font-body, Montserrat, sans-serif)',
                fontSize: '0.78rem',
                color: 'var(--text-muted, #624030)',
                fontStyle: 'italic',
                maxWidth: 280,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                transition: 'opacity 0.05s',
              }}
            >
              {shuffleText}
            </div>
          </div>
        )}

        {/* Result card */}
        {result && showPrompt && (
          <div
            style={{
              borderRadius: 'var(--cr-radius-sm, 8px)',
              overflow: 'hidden',
              animation: 'mbody-reveal 0.4s cubic-bezier(0.16,1,0.3,1)',
              border: `1.5px solid ${result.category.borderTint}`,
            }}
          >
            {/* Category bar */}
            <div
              style={{
                padding: '10px 16px',
                background: result.category.bgTint,
                borderBottom: `1px solid ${result.category.borderTint}`,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>{result.category.emoji}</span>
              <span
                style={{
                  fontFamily: 'var(--font-label, Blinker, sans-serif)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: result.category.color,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                {result.category.label}
              </span>
            </div>

            {/* Prompt text */}
            <div
              style={{
                padding: '18px 18px 16px',
                background: 'var(--bg-elevated, #FFF4EC)',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-body, Montserrat, sans-serif)',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  color: 'var(--text-primary, #2C1C10)',
                  lineHeight: 1.75,
                  fontStyle: 'italic',
                  letterSpacing: '0.005em',
                }}
              >
                &ldquo;{result.prompt}&rdquo;
              </div>
            </div>

            {/* Spin again */}
            <button
              onClick={spin}
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: 0,
                border: 'none',
                borderTop: `1px solid ${result.category.borderTint}`,
                background: result.category.bgTint,
                cursor: 'pointer',
                fontFamily: 'var(--font-label, Blinker, sans-serif)',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: result.category.color,
                letterSpacing: '0.04em',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
              onMouseOver={e => {
                (e.currentTarget as HTMLButtonElement).style.background = `${result.category.borderTint}`;
              }}
              onMouseOut={e => {
                (e.currentTarget as HTMLButtonElement).style.background = result.category.bgTint;
              }}
            >
              <span style={{ fontSize: '0.85rem' }}>🎰</span> spin again
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes mbody-spin {
          0% { transform: rotateY(0deg); }
          100% { transform: rotateY(360deg); }
        }
        @keyframes mbody-reveal {
          0% { opacity: 0; transform: translateY(8px) scale(0.97); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
