import React, { useState, useEffect } from 'react';
import cwLogoImg from 'figma:asset/26b5a4fd9027610adb3ddb9ed89749cb683707dd.png';
import { PERSONS } from './data';

interface WelcomeModalProps {
  activeUser: string;
  onDismiss: () => void;
}

const SECTIONS = [
  {
    id: 'welcome',
    title: 'Welcome',
    icon: '👋',
  },
  {
    id: 'whats-here',
    title: "What's Here",
    icon: '🗺️',
  },
  {
    id: 'add-to-iphone',
    title: 'Add to iPhone',
    icon: '📱',
  },
  {
    id: 'how-it-works',
    title: 'How It Works',
    icon: '💡',
  },
];

const DASHBOARD_SECTIONS = [
  {
    emoji: '🏠',
    name: 'Hub',
    desc: 'Your daily view — calendar, countdown, brain dump, and collective synergy.',
  },
  {
    emoji: '💬',
    name: 'CR8W Chat',
    desc: 'Real-time team messages, system notifications, and well drops.',
  },
  {
    emoji: '⛲️',
    name: 'Geyser Dashboard',
    desc: 'Tasks, stations, and timeline for all projects.',
  },
  {
    emoji: '🎯',
    name: 'PlayD8s',
    desc: 'Weekly check-ins and creative play scheduling.',
  },
  {
    emoji: '🌊',
    name: 'The Well',
    desc: 'Our shared forum for longer thoughts and reflections.',
  },
];

const IPHONE_STEPS = [
  {
    num: '1',
    text: (
      <>
        Open <strong>createwell.monnyfest.co</strong> in{' '}
        <strong>Safari</strong> on your iPhone
      </>
    ),
  },
  {
    num: '2',
    text: (
      <>
        Tap the <strong>Share button</strong>{' '}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            borderRadius: 5,
            background: 'rgba(123,168,157,0.1)',
            verticalAlign: 'middle',
            fontSize: '0.75rem',
          }}
        >
          ↑
        </span>{' '}
        at the bottom of Safari
      </>
    ),
  },
  {
    num: '3',
    text: (
      <>
        Scroll down and tap{' '}
        <strong>"Add to Home Screen"</strong>
      </>
    ),
  },
  {
    num: '4',
    text: (
      <>
        Name it <strong>"CR8W"</strong> or{' '}
        <strong>"Create Well"</strong> and tap Add
      </>
    ),
  },
  {
    num: '5',
    text: 'It will now appear as an app icon on your home screen',
  },
];

const HOW_IT_WORKS = [
  {
    icon: '🌐',
    text: 'This is a web app (PWA), not a native app store download.',
  },
  {
    icon: '📲',
    text: 'It works best when added to your home screen for the full-screen experience.',
  },
  {
    icon: '🔔',
    text: "You'll get system notifications in CR8W Chat for calendar events, reminders, and updates.",
  },
  {
    icon: '🧠',
    text: 'The Brain Dump is your quick-capture tool — drop thoughts anytime.',
  },
  {
    icon: '🪷',
    text: 'Check The Well for longer posts and reflections from the collective.',
  },
];

export function WelcomeModal({ activeUser, onDismiss }: WelcomeModalProps) {
  const [step, setStep] = useState(0);
  const [fadeIn, setFadeIn] = useState(false);

  const person = PERSONS[activeUser];
  const name = person?.name || 'Co-Creator';
  const emoji = person?.emoji || '🌀';
  const color = person?.color || '#7BA89D';

  useEffect(() => {
    requestAnimationFrame(() => setFadeIn(true));
  }, []);

  const totalSteps = SECTIONS.length;
  const currentSection = SECTIONS[step];
  const isLast = step === totalSteps - 1;

  function handleDismiss() {
    localStorage.setItem(`cr8w_onboarded_${activeUser}`, 'true');
    onDismiss();
  }

  function handleNext() {
    if (isLast) {
      handleDismiss();
    } else {
      setStep(step + 1);
    }
  }

  function handleBack() {
    if (step > 0) setStep(step - 1);
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(20,14,10,0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        opacity: fadeIn ? 1 : 0,
        transition: 'opacity 0.35s ease',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) return; // don't dismiss on backdrop click
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          maxHeight: 'calc(100dvh - 32px)',
          borderRadius: 20,
          background: 'var(--bg-card, #2A201A)',
          border: '1px solid rgba(196,164,132,0.15)',
          boxShadow:
            '0 24px 80px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transform: fadeIn ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.97)',
          transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px 24px 16px',
            background:
              'linear-gradient(135deg, rgba(123,168,157,0.08) 0%, rgba(184,169,212,0.06) 100%)',
            borderBottom: '1px solid rgba(196,164,132,0.1)',
            textAlign: 'center',
            flexShrink: 0,
          }}
        >
          <img
            src={cwLogoImg}
            alt="CR8W"
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              objectFit: 'cover',
              marginBottom: 10,
              border: '2px solid rgba(123,168,157,0.2)',
            }}
          />
          <div
            style={{
              fontFamily: 'var(--font-display, "Playfair Display", serif)',
              fontSize: '1.35rem',
              fontWeight: 600,
              color: 'var(--text-primary, #EAE3DB)',
              marginBottom: 2,
            }}
          >
            {step === 0 ? (
              <>
                Welcome, {emoji} {name}!
              </>
            ) : (
              <>
                {currentSection.icon} {currentSection.title}
              </>
            )}
          </div>
          {step === 0 && (
            <div
              style={{
                fontFamily: 'var(--font-body, Montserrat, sans-serif)',
                fontSize: '0.82rem',
                color: 'var(--text-secondary, #B5A99A)',
                lineHeight: 1.55,
                marginTop: 6,
              }}
            >
              This is your collective home base — where we plan, sync, and
              create together.
            </div>
          )}
        </div>

        {/* Step indicator */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 6,
            padding: '12px 24px 4px',
            flexShrink: 0,
          }}
        >
          {SECTIONS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setStep(i)}
              style={{
                width: i === step ? 24 : 8,
                height: 8,
                borderRadius: 4,
                border: 'none',
                cursor: 'pointer',
                background:
                  i === step
                    ? 'var(--primary, #7BA89D)'
                    : i < step
                    ? `${color}66`
                    : 'rgba(196,164,132,0.15)',
                transition: 'all 0.25s ease',
              }}
              aria-label={`Go to ${s.title}`}
            />
          ))}
        </div>

        {/* Body — scrollable */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 24px 20px',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {step === 0 && <WelcomeStep name={name} color={color} />}
          {step === 1 && <WhatsHereStep />}
          {step === 2 && <AddToIphoneStep />}
          {step === 3 && <HowItWorksStep />}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 24px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderTop: '1px solid rgba(196,164,132,0.08)',
            flexShrink: 0,
          }}
        >
          {step > 0 ? (
            <button
              onClick={handleBack}
              style={{
                padding: '10px 18px',
                borderRadius: 12,
                border: '1px solid rgba(196,164,132,0.15)',
                background: 'transparent',
                color: 'var(--text-secondary, #B5A99A)',
                fontFamily: 'var(--font-label, Montserrat, sans-serif)',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              Back
            </button>
          ) : (
            <button
              onClick={handleDismiss}
              style={{
                padding: '10px 14px',
                borderRadius: 12,
                border: 'none',
                background: 'transparent',
                color: 'var(--text-muted, #8A7D72)',
                fontFamily: 'var(--font-label, Montserrat, sans-serif)',
                fontSize: '0.78rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Skip
            </button>
          )}
          <button
            onClick={handleNext}
            style={{
              flex: 1,
              padding: '12px 20px',
              borderRadius: 12,
              border: 'none',
              background: isLast
                ? 'linear-gradient(135deg, #7BA89D 0%, #B8A9D4 100%)'
                : 'var(--primary, #7BA89D)',
              color: '#fff',
              fontFamily: 'var(--font-label, Montserrat, sans-serif)',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '0.02em',
              transition: 'all 0.15s',
              boxShadow: isLast
                ? '0 4px 16px rgba(123,168,157,0.3)'
                : '0 2px 8px rgba(123,168,157,0.2)',
            }}
          >
            {isLast ? "Let's go ✨" : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Step Panels ──────────────────────────────────────────────────── */

function WelcomeStep({ name, color }: { name: string; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          fontFamily: 'var(--font-body, Montserrat, sans-serif)',
          fontSize: '0.84rem',
          color: 'var(--text-secondary, #B5A99A)',
          lineHeight: 1.65,
        }}
      >
        Hey {name} — we're so glad you're here. This quick walkthrough will
        show you around the CR8W Dashboard so you know where everything lives.
      </div>
      <div
        style={{
          background: `${color}0C`,
          border: `1px solid ${color}22`,
          borderRadius: 12,
          padding: '14px 16px',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-label, Montserrat, sans-serif)',
            fontSize: '0.68rem',
            fontWeight: 700,
            color,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: 6,
          }}
        >
          What you'll learn
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {SECTIONS.slice(1).map((s) => (
            <div
              key={s.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '0.8rem',
                color: 'var(--text-secondary, #B5A99A)',
              }}
            >
              <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>
                {s.icon}
              </span>
              <span>{s.title}</span>
            </div>
          ))}
        </div>
      </div>
      <div
        style={{
          textAlign: 'center',
          fontFamily: 'var(--font-display, "Playfair Display", serif)',
          fontSize: '0.85rem',
          fontStyle: 'italic',
          color: 'var(--primary, #7BA89D)',
          opacity: 0.7,
          paddingTop: 4,
        }}
      >
        "Here, is where you fall in love with the process."
      </div>
    </div>
  );
}

function WhatsHereStep() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          fontFamily: 'var(--font-body, Montserrat, sans-serif)',
          fontSize: '0.82rem',
          color: 'var(--text-secondary, #B5A99A)',
          lineHeight: 1.55,
          marginBottom: 4,
        }}
      >
        Here's what each section of the dashboard does:
      </div>
      {DASHBOARD_SECTIONS.map((s) => (
        <div
          key={s.name}
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
            padding: '10px 12px',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          <span
            style={{
              fontSize: '1.05rem',
              flexShrink: 0,
              marginTop: 1,
            }}
          >
            {s.emoji}
          </span>
          <div>
            <div
              style={{
                fontFamily: 'var(--font-label, Montserrat, sans-serif)',
                fontSize: '0.76rem',
                fontWeight: 700,
                color: 'var(--text-primary, #EAE3DB)',
                marginBottom: 2,
              }}
            >
              {s.name}
            </div>
            <div
              style={{
                fontSize: '0.78rem',
                color: 'var(--text-muted, #8A7D72)',
                lineHeight: 1.5,
              }}
            >
              {s.desc}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AddToIphoneStep() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        style={{
          fontFamily: 'var(--font-body, Montserrat, sans-serif)',
          fontSize: '0.82rem',
          color: 'var(--text-secondary, #B5A99A)',
          lineHeight: 1.55,
        }}
      >
        Add CR8W to your iPhone home screen for the best experience:
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {IPHONE_STEPS.map((s) => (
          <div
            key={s.num}
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              padding: '8px 12px',
              borderRadius: 10,
              background: 'rgba(123,168,157,0.04)',
              border: '1px solid rgba(123,168,157,0.08)',
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: 'var(--primary, #7BA89D)',
                color: '#fff',
                fontSize: '0.68rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: 1,
                fontFamily: 'var(--font-label, Montserrat, sans-serif)',
              }}
            >
              {s.num}
            </span>
            <div
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-secondary, #B5A99A)',
                lineHeight: 1.55,
              }}
            >
              {s.text}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          background: 'rgba(255,159,10,0.08)',
          border: '1px solid rgba(255,159,10,0.18)',
          borderRadius: 8,
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontSize: '0.85rem' }}>⚠️</span>
        <span
          style={{
            fontFamily: 'var(--font-label, Montserrat, sans-serif)',
            fontSize: '0.72rem',
            color: '#FF9F0A',
            fontWeight: 600,
            lineHeight: 1.5,
          }}
        >
          Use Safari specifically — this won't work from Chrome or other
          browsers on iPhone.
        </span>
      </div>
    </div>
  );
}

function HowItWorksStep() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        style={{
          fontFamily: 'var(--font-body, Montserrat, sans-serif)',
          fontSize: '0.82rem',
          color: 'var(--text-secondary, #B5A99A)',
          lineHeight: 1.55,
        }}
      >
        A few things to know as you get started:
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {HOW_IT_WORKS.map((item, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.04)',
            }}
          >
            <span
              style={{
                fontSize: '0.9rem',
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              {item.icon}
            </span>
            <div
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-secondary, #B5A99A)',
                lineHeight: 1.55,
              }}
            >
              {item.text}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          textAlign: 'center',
          padding: '10px 0 0',
          fontFamily: 'var(--font-display, "Playfair Display", serif)',
          fontSize: '0.9rem',
          color: 'var(--primary, #7BA89D)',
          fontWeight: 500,
        }}
      >
        You're all set — let's create well together.
      </div>
    </div>
  );
}

/** Check if a user should see the onboarding modal */
export function shouldShowOnboarding(activeUser: string): boolean {
  if (activeUser !== 'sunshine' && activeUser !== 'bingle') return false;
  return !localStorage.getItem(`cr8w_onboarded_${activeUser}`);
}
