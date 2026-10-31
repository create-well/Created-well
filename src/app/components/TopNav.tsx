import React, { useState, useRef, useEffect, useId } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { createPopper } from '@popperjs/core';
import cwLogoImg from 'figma:asset/26b5a4fd9027610adb3ddb9ed89749cb683707dd.png';
import { PERSONS } from './data';
import { VisibilityDial } from './VisibilityDial';
import { SensorySettings } from './SensorySettings';
import { ThemeSelector } from './ThemeSelector';
import { useDashboard } from '../../contexts/DashboardContext';

const NAV_ITEMS: { path: string; label: string; emoji: string; end?: boolean }[] = [
  { path: '/',           label: 'This Week', emoji: '💧', end: true },
  { path: '/moves',      label: 'Moves',     emoji: '⛲️' },
  { path: '/care',       label: 'Care',      emoji: '🫧' },
  { path: '/money',      label: 'Money',     emoji: '💰' },
  { path: '/decisions',  label: 'Decisions', emoji: '⚡' },
  { path: '/system',     label: 'System',    emoji: '🔧' },
];

const FLOW_DESTINATIONS = [
  { path: '/podyaps', label: 'Podyaps' },
  { path: '/workshops', label: 'Workshops' },
] as const;
const FLOW_PATHS = ['/flows', '/podyaps', '/workshops'] as const;
const MOBILE_DRAWER_FOCUSABLE_SELECTOR = 'a[href], button, input, select, textarea, [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

const CO_FOUNDERS = Object.entries(PERSONS) as [string, typeof PERSONS[keyof typeof PERSONS]][];

interface TopNavProps {
  onSignOut?: () => void;
}

export function TopNav({ onSignOut }: TopNavProps) {
  const { data, ui } = useDashboard();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopFlowsOpen, setDesktopFlowsOpen] = useState(false);
  const [mobileFlowsOpen, setMobileFlowsOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showWellSettings, setShowWellSettings] = useState(false);
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);
  const flowIdBase = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const desktopFlowPanelId = `${flowIdBase}-desktop-flow-panel`;
  const mobileFlowPanelId = `${flowIdBase}-mobile-flow-panel`;
  const mobileMenuId = `${flowIdBase}-mobile-navigation`;
  const desktopFlowGroupRef = useRef<HTMLDivElement>(null);
  const desktopFlowsLinkRef = useRef<HTMLAnchorElement>(null);
  const desktopFlowTriggerRef = useRef<HTMLButtonElement>(null);
  const desktopFlowPanelRef = useRef<HTMLDivElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const mobileCloseButtonRef = useRef<HTMLButtonElement>(null);
  const mobileOpenRef = useRef(false);
  const previousPathRef = useRef(location.pathname);
  const profileRef = useRef<HTMLDivElement>(null);
  const [visibilityDial, setVisibilityDial] = useState<number>(() => {
    const stored = localStorage.getItem('visibilityDial');
    return stored ? parseInt(stored) : 1;
  });

  const { syncStatus } = data;
  const isFlowRoute = FLOW_PATHS.some(path => path === location.pathname);
  const isFlowChildRoute = FLOW_DESTINATIONS.some(({ path }) => path === location.pathname);
  const syncDot = syncStatus === 'fresh'
    ? { color: '#30D158', title: 'Synced' }
    : syncStatus === 'failed'
    ? { color: '#FF453A', title: 'Offline' }
    : syncStatus === 'stale'
    ? { color: '#FF9F0A', title: 'Stale' }
    : { color: '#FFD60A', title: 'Syncing…' };

  function closeMobileDrawer() {
    const wasOpen = mobileOpenRef.current;
    mobileOpenRef.current = false;
    setMobileOpen(false);
    if (wasOpen) {
      window.requestAnimationFrame(() => mobileMenuButtonRef.current?.focus());
    }
  }

  function toggleMobileDrawer() {
    if (mobileOpenRef.current) {
      closeMobileDrawer();
      return;
    }
    setDesktopFlowsOpen(false);
    setMobileFlowsOpen(isFlowChildRoute);
    mobileOpenRef.current = true;
    setMobileOpen(true);
  }

  function handleMobileDrawerKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMobileDrawer();
      return;
    }
    if (event.key !== 'Tab') return;

    const drawer = mobileMenuRef.current;
    if (!drawer) return;
    const focusable = Array.from(
      drawer.querySelectorAll<HTMLElement>(MOBILE_DRAWER_FOCUSABLE_SELECTOR),
    ).filter(element =>
      element.getClientRects().length > 0
      && !element.matches(':disabled')
      && window.getComputedStyle(element).visibility !== 'hidden',
    );
    if (focusable.length === 0) {
      event.preventDefault();
      drawer.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !drawer.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !drawer.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  // Close profile card on outside click
  useEffect(() => {
    if (!expandedProfile) return;
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setExpandedProfile(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [expandedProfile]);

  useEffect(() => {
    if (!mobileOpen) return;
    const frame = window.requestAnimationFrame(() => mobileCloseButtonRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [mobileOpen]);

  // Full modal inertness while the drawer is open (flow-nav follow-up):
  // the top nav's own controls and every app-shell sibling outside the
  // drawer overlay become inert, so keyboard, switch, and pointer input
  // can only reach the dialog. Cleanup removes exactly what was applied
  // and runs when mobileOpen flips, before any focus() call on close
  // (closeMobileDrawer and the resize handler focus inside a frame).
  useEffect(() => {
    if (!mobileOpen) return;
    const shell = mobileMenuRef.current?.closest('.cr8w-app');
    if (!shell) return;
    const applied: HTMLElement[] = [];
    shell.childNodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      if (mobileMenuRef.current && node.contains(mobileMenuRef.current)) return;
      if (!node.hasAttribute('inert')) {
        node.setAttribute('inert', '');
        applied.push(node);
      }
    });
    return () => {
      applied.forEach((el) => el.removeAttribute('inert'));
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (previousPathRef.current === location.pathname) return;
    previousPathRef.current = location.pathname;
    setDesktopFlowsOpen(false);
    setMobileFlowsOpen(false);
    if (mobileOpenRef.current) closeMobileDrawer();
  }, [location.pathname]);

  useEffect(() => {
    const desktopMedia = window.matchMedia('(min-width: 1101px)');
    function closeHiddenNavigation(event: MediaQueryListEvent) {
      if (event.matches) {
        const drawerWasOpen = mobileOpenRef.current;
        const focusWasInMobileNav = mobileMenuButtonRef.current === document.activeElement
          || Boolean(mobileMenuRef.current?.contains(document.activeElement));
        if (drawerWasOpen) {
          mobileOpenRef.current = false;
          setMobileOpen(false);
        }
        if (drawerWasOpen || focusWasInMobileNav) {
          window.requestAnimationFrame(() => desktopFlowsLinkRef.current?.focus());
        }
        setMobileFlowsOpen(false);
      } else {
        const focusWasInDesktopNav = Boolean(document.querySelector('.nav-links')?.contains(document.activeElement));
        setDesktopFlowsOpen(false);
        if (focusWasInDesktopNav) {
          window.requestAnimationFrame(() => mobileMenuButtonRef.current?.focus());
        }
      }
    }
    desktopMedia.addEventListener('change', closeHiddenNavigation);
    return () => desktopMedia.removeEventListener('change', closeHiddenNavigation);
  }, [desktopFlowsOpen]);

  useEffect(() => {
    if (!desktopFlowsOpen) return;
    const trigger = desktopFlowTriggerRef.current;
    const panel = desktopFlowPanelRef.current;
    if (!trigger || !panel) return;

    const popper = createPopper(trigger, panel, {
      placement: 'bottom-start',
      modifiers: [
        { name: 'offset', options: { offset: [0, 8] } },
        { name: 'flip', options: { fallbackPlacements: ['bottom-end', 'top-start', 'top-end'] } },
        { name: 'preventOverflow', options: { padding: 8, altAxis: true } },
      ],
    });
    return () => popper.destroy();
  }, [desktopFlowsOpen]);

  useEffect(() => {
    if (!desktopFlowsOpen) return;
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!desktopFlowGroupRef.current?.contains(event.target as Node)) {
        setDesktopFlowsOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setDesktopFlowsOpen(false);
      desktopFlowTriggerRef.current?.focus();
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [desktopFlowsOpen]);

  function openPerson(key: string) {
    ui.setActivePerson(key);
    setExpandedProfile(null);
    closeMobileDrawer();
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `nav-link${isActive ? ' active' : ''}`;

  return (
    <>
      <nav className="top-nav">
        {/* Logo / Home */}
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `nav-left${isActive ? ' nav-left-active' : ''}`
          }
          style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
        >
          <img
            src={cwLogoImg}
            alt="Create Well"
            className="nav-logo-img"
            style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
          />
          <span className="nav-brand-name">create well</span>
          <span
            title={syncDot.title}
            style={{
              width: 6, height: 6, borderRadius: '50%',
              background: syncDot.color, flexShrink: 0,
              boxShadow: `0 0 4px ${syncDot.color}88`,
              transition: 'background 0.3s',
            }}
          />
        </NavLink>

        {/* Desktop Nav Links */}
        <div className="nav-links">
          {NAV_ITEMS.slice(0, 3).map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={navLinkClass}
            >
              {item.path === '/moves' && <span className="geyser-pulse-dot" />}
              {item.emoji} {item.label}
            </NavLink>
          ))}
          <div className={`flow-nav-group${isFlowRoute ? ' is-active' : ''}`} ref={desktopFlowGroupRef}>
            <NavLink
              ref={desktopFlowsLinkRef}
              to="/flows"
              end
              className={({ isActive }) => `nav-link flow-nav-link${isActive ? ' active' : ''}`}
            >
              Flows
            </NavLink>
            <button
              ref={desktopFlowTriggerRef}
              type="button"
              className={`flow-nav-disclosure${desktopFlowsOpen ? ' open' : ''}`}
              aria-label={desktopFlowsOpen ? 'Hide Flow destinations' : 'Show Flow destinations'}
              aria-expanded={desktopFlowsOpen}
              aria-controls={desktopFlowPanelId}
              onClick={() => setDesktopFlowsOpen(open => !open)}
            >
              <span aria-hidden="true">⌄</span>
            </button>
            <div
              id={desktopFlowPanelId}
              ref={desktopFlowPanelRef}
              className="flow-nav-popover"
              role="region"
              aria-label="Flow destinations"
              hidden={!desktopFlowsOpen}
            >
              {FLOW_DESTINATIONS.map(destination => (
                <NavLink
                  key={destination.path}
                  to={destination.path}
                  end
                  className={({ isActive }) => `flow-nav-popover-link${isActive ? ' active' : ''}`}
                  onClick={() => setDesktopFlowsOpen(false)}
                >
                  {destination.label}
                </NavLink>
              ))}
            </div>
          </div>
          {NAV_ITEMS.slice(3).map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={navLinkClass}
            >
              {item.path === '/moves' && <span className="geyser-pulse-dot" />}
              {item.emoji} {item.label}
            </NavLink>
          ))}
        </div>

        {/* Co-founder Avatars */}
        <div className="nav-avatars" ref={profileRef}>
          <div className="nav-avatar-stack">
            {CO_FOUNDERS.map(([key, person], i) => (
              <button
                key={key}
                className={`nav-avatar-circle ${ui.activePerson === key ? 'nav-avatar-active' : ''}`}
                onClick={() => setExpandedProfile(expandedProfile === key ? null : key)}
                title={person.name}
                style={{
                  background: person.color,
                  zIndex: CO_FOUNDERS.length - i,
                  marginLeft: i > 0 ? -8 : 0,
                  border: ui.activePerson === key ? '2px solid #fff' : '2px solid rgba(255,255,255,0.6)',
                }}
              >
                <span style={{ fontSize: '0.7rem', lineHeight: 1 }}>{person.emoji}</span>
              </button>
            ))}
          </div>

          {/* Expanded Profile Card */}
          {expandedProfile && (() => {
            const person = PERSONS[expandedProfile];
            if (!person) return null;
            return (
              <div className="nav-profile-card" style={{ borderTopColor: person.color }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', background: person.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.1rem', flexShrink: 0,
                    border: '2px solid var(--cr8w-surface, #FAF8F5)',
                  }}>
                    {person.emoji}
                  </div>
                  <div>
                    <div style={{
                      fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 600,
                      color: 'var(--cr8w-text, #2D2438)',
                    }}>
                      {person.name}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-label)', fontSize: '0.65rem',
                      color: 'var(--text-muted, #6B5F7A)', letterSpacing: '0.02em',
                    }}>
                      {person.role}
                    </div>
                  </div>
                </div>
                <div style={{
                  fontFamily: 'var(--font-label)', fontSize: '0.68rem',
                  color: 'var(--text-secondary, #443855)',
                  marginBottom: 8, lineHeight: 1.4,
                }}>
                  {person.expression}
                </div>
                <div style={{
                  background: `${person.color}18`,
                  border: `1px solid ${person.color}30`,
                  borderRadius: 8, padding: '8px 10px', marginBottom: 10,
                }}>
                  <div style={{
                    fontFamily: 'var(--font-label)', fontSize: '0.6rem', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    color: person.color, marginBottom: 3,
                  }}>
                    {person.energyReminder.type}
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-body)', fontSize: '0.68rem',
                    color: 'var(--cr8w-text, #2D2438)', lineHeight: 1.4,
                  }}>
                    {person.energyReminder.text}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    energy
                  </span>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(45,36,56,0.08)', overflow: 'hidden' }}>
                    <div style={{
                      width: expandedProfile === 'bingle' ? '55%' : expandedProfile === 'monny' ? '75%' : '65%',
                      height: '100%', borderRadius: 3,
                      background: `linear-gradient(90deg, ${person.color}, ${person.color}AA)`,
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                </div>
                <button
                  onClick={() => openPerson(expandedProfile)}
                  style={{
                    width: '100%', padding: '7px 0', borderRadius: 8,
                    background: 'var(--cr8w-primary, #7BA89D)',
                    color: '#fff', fontFamily: 'var(--font-label)',
                    fontSize: '0.72rem', fontWeight: 600,
                    letterSpacing: '0.04em', textTransform: 'uppercase',
                    cursor: 'pointer', border: 'none',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--cr8w-btn-hover, #5F8D82)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--cr8w-primary, #7BA89D)')}
                >
                  open {person.name.toLowerCase()}'s well
                </button>
              </div>
            );
          })()}
        </div>

        {/* Desktop sign-out */}
        {onSignOut && (
          <button
            className="nav-signout-desktop"
            onClick={onSignOut}
            title="Sign out"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'none', border: '1px solid var(--border-soft, rgba(196,164,132,0.3))',
              borderRadius: 8, padding: '5px 10px', marginLeft: 10, cursor: 'pointer',
              fontFamily: 'var(--font-label, sans-serif)', fontSize: '0.68rem', fontWeight: 600,
              color: 'var(--text-muted, #6B5F7A)', transition: 'all 0.15s', flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#C25B38'; e.currentTarget.style.borderColor = '#C25B38'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted, #6B5F7A)'; e.currentTarget.style.borderColor = 'var(--border-soft, rgba(196,164,132,0.3))'; }}
          >
            ⏻ sign out
          </button>
        )}

        <button
          ref={mobileMenuButtonRef}
          type="button"
          className="hamburger"
          aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileOpen}
          aria-controls={mobileMenuId}
          onClick={toggleMobileDrawer}
        >
          <span></span><span></span><span></span>
        </button>
      </nav>

      {/* Mobile Menu */}
      <div
        className={`mobile-menu-overlay ${mobileOpen ? 'open' : ''}`}
        aria-hidden={!mobileOpen}
        onClick={closeMobileDrawer}
      >
        <div
          id={mobileMenuId}
          ref={mobileMenuRef}
          className="mobile-menu"
          role="dialog"
          aria-modal={mobileOpen ? 'true' : undefined}
          aria-label="Primary navigation"
          tabIndex={-1}
          onKeyDown={handleMobileDrawerKeyDown}
          onClick={e => e.stopPropagation()}
        >
          <div className="mobile-menu-header" onClick={() => { navigate('/'); closeMobileDrawer(); }} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              ref={mobileCloseButtonRef}
              type="button"
              className="mobile-menu-close"
              aria-label="Close navigation menu"
              onClick={(e) => { e.stopPropagation(); closeMobileDrawer(); }}
            >
              <span aria-hidden="true">×</span>
            </button>
            <img
              src={cwLogoImg}
              alt="Create Well"
              style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
            />
            <span className="mobile-menu-brand">create well</span>
            <div style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto' }} onClick={e => e.stopPropagation()}>
              {CO_FOUNDERS.map(([key, person], i) => (
                <button
                  key={key}
                  onClick={(e) => { e.stopPropagation(); setExpandedProfile(expandedProfile === key ? null : key); }}
                  title={person.name}
                  style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: person.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    border: ui.activePerson === key ? '2px solid var(--cr8w-primary, #7BA89D)' : '2px solid var(--cr8w-card-bg, #F4F1ED)',
                    marginLeft: i > 0 ? -6 : 0,
                    zIndex: CO_FOUNDERS.length - i,
                    padding: 0, flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: '0.6rem', lineHeight: 1 }}>{person.emoji}</span>
                </button>
              ))}
            </div>
          </div>

          {NAV_ITEMS.slice(0, 3).map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `mobile-menu-link${item.path === '/moves' ? ' mobile-menu-link-geyser' : ''}${isActive ? ' active' : ''}`
              }
              onClick={closeMobileDrawer}
            >
              {item.path === '/moves' && <span className="geyser-pulse-dot" />}
              {item.emoji} {item.label}
            </NavLink>
          ))}
          <div className={`mobile-flow-group${isFlowRoute ? ' is-active' : ''}`}>
            <div className="mobile-flow-row">
              <NavLink
                to="/flows"
                end
                className={({ isActive }) => `mobile-menu-link mobile-flow-link${isActive ? ' active' : ''}`}
                onClick={closeMobileDrawer}
              >
                Flows
              </NavLink>
              <button
                type="button"
                className={`mobile-flow-disclosure${mobileFlowsOpen ? ' open' : ''}`}
                aria-label={mobileFlowsOpen ? 'Hide Flow destinations' : 'Show Flow destinations'}
                aria-expanded={mobileFlowsOpen}
                aria-controls={mobileFlowPanelId}
                onClick={() => setMobileFlowsOpen(open => !open)}
              >
                <span aria-hidden="true">⌄</span>
              </button>
            </div>
            <div id={mobileFlowPanelId} className="mobile-flow-children" hidden={!mobileFlowsOpen}>
              {FLOW_DESTINATIONS.map(destination => (
                <NavLink
                  key={destination.path}
                  to={destination.path}
                  end
                  className={({ isActive }) => `mobile-menu-link mobile-flow-child-link${isActive ? ' active' : ''}`}
                  onClick={closeMobileDrawer}
                >
                  {destination.label}
                </NavLink>
              ))}
            </div>
          </div>
          {NAV_ITEMS.slice(3).map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `mobile-menu-link${item.path === '/moves' ? ' mobile-menu-link-geyser' : ''}${isActive ? ' active' : ''}`
              }
              onClick={closeMobileDrawer}
            >
              {item.path === '/moves' && <span className="geyser-pulse-dot" />}
              {item.emoji} {item.label}
            </NavLink>
          ))}

          {/* Co-founders section */}
          <div style={{ borderTop: '1px solid var(--border-soft, rgba(196,164,132,0.12))', margin: '8px 0', padding: '8px 0 0' }}>
            <div style={{
              fontFamily: 'var(--font-label)', fontSize: '0.65rem', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.1em',
              color: 'var(--text-muted)', padding: '0 16px 6px',
            }}>
              co-h0es
            </div>
            {CO_FOUNDERS.map(([key, person]) => (
              <button
                key={key}
                className={`mobile-menu-link${ui.activePerson === key ? ' active' : ''}`}
                onClick={() => openPerson(key)}
              >
                <span style={{
                  width: 20, height: 20, borderRadius: '50%', background: person.color,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.65rem', flexShrink: 0,
                }}>
                  {person.emoji}
                </span>
                {person.name}
              </button>
            ))}
          </div>

          {/* Share Link */}
          <div style={{ borderTop: '1px solid var(--border-soft, rgba(196,164,132,0.12))', margin: '8px 0', padding: '8px 0 0' }}>
            <button
              className="mobile-menu-link"
              onClick={() => {
                try {
                  const ta = document.createElement('textarea');
                  ta.value = window.location.href;
                  ta.style.position = 'fixed'; ta.style.left = '-9999px';
                  document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
                  setLinkCopied(true);
                  setTimeout(() => setLinkCopied(false), 2000);
                } catch (_) {}
              }}
              style={{ color: linkCopied ? '#30D158' : 'var(--cr8w-primary, #7BA89D)', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {linkCopied ? (
                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#30D158" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>Link Copied!</>
              ) : (
                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>Share Dashboard Link</>
              )}
            </button>
          </div>

          {/* Well Settings */}
          <div style={{ borderTop: '1px solid var(--border-soft, rgba(196,164,132,0.12))', margin: '4px 0', padding: '4px 0 0' }}>
            <button
              className="mobile-menu-link"
              onClick={() => setShowWellSettings(!showWellSettings)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--cr8w-text, var(--text-primary))' }}
            >
              <span style={{ fontSize: '0.9rem' }}>⚙️</span> your well settings
              <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)', transition: 'transform 0.2s', transform: showWellSettings ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
            </button>
            {showWellSettings && (
              <div className="titration-settings-panel">
                <ThemeSelector />
                <div style={{ borderTop: '1px solid rgba(45,36,56,0.08)', margin: '14px 0 10px' }} />
                <VisibilityDial
                  value={visibilityDial}
                  onChange={(idx) => {
                    setVisibilityDial(idx);
                    localStorage.setItem('visibilityDial', String(idx));
                    window.dispatchEvent(new StorageEvent('storage', { key: 'visibilityDial', newValue: String(idx) }));
                  }}
                />
                <div style={{ borderTop: '1px solid rgba(45,36,56,0.08)', margin: '14px 0 10px' }} />
                <SensorySettings />
              </div>
            )}
          </div>

          {/* Sign out */}
          {onSignOut && (
            <div style={{ borderTop: '1px solid var(--border-soft, rgba(196,164,132,0.12))', margin: '8px 0 0', padding: '8px 0 0' }}>
              <button
                className="mobile-menu-link"
                onClick={() => { setMobileOpen(false); onSignOut(); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#C25B38' }}
              >
                <span style={{ fontSize: '0.9rem' }}>⏻</span> sign out
                {ui.chatActiveUser && (
                  <span style={{ marginLeft: 'auto', fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'var(--font-label)' }}>
                    signed in as {ui.chatActiveUser}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
