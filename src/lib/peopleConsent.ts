// ── People consent posture (Phase 3, packet M §1/§7, packet P L7) ───────────
// The gate's application point, isolated as ONE named switch (the A7
// pin fork). D1 was decided by Monny 2026-11-19: shape (b),
// CTA-scoped. Flipping this one constant to 'global' restores the
// pre-Phase-3 wiring (whole-surface restricted until the PEOPLE
// census reaches zero consent gaps); nothing else in the phase
// changes. The census derivation itself (careConsentGranted /
// peopleCareCounts) is untouched by this phase and is not read here
// beyond the boolean DashboardContext already publishes.
//
// Posture rules (packet M §7, A1):
// - A person's contact/scheduling actions are available only when
//   their own consent is captured: consentCaptured === true.
// - An ABSENT consentCaptured field (cached/older payload) suppresses
//   exactly like a false one: absence never reads as permission.
// - A "Do Not Contact" pathway stage suppresses every contact
//   affordance regardless of captured consent.

export type PeopleGateMode = 'cta-scoped' | 'global';

export const PEOPLE_GATE_MODE: PeopleGateMode = 'cta-scoped';

/**
 * Whole-surface restriction (the not-granted case, packet M §7).
 * The mode parameter exists so the pin set can prove both fork
 * positions; production callers pass only the census boolean and
 * read the shipped constant.
 */
export function peopleSurfaceRestricted(
  careConsent: boolean,
  mode: PeopleGateMode = PEOPLE_GATE_MODE,
): boolean {
  return mode === 'global' && !careConsent;
}

export interface ConsentPosture {
  consentCaptured?: boolean;
  status?: string;
}

export function isDoNotContact(person: ConsentPosture): boolean {
  return person.status === 'Do Not Contact';
}

/**
 * True when every contact/scheduling affordance for this person must
 * be suppressed: consent not captured (false OR absent), or the
 * person is filed Do Not Contact.
 */
export function contactSuppressed(person: ConsentPosture): boolean {
  if (isDoNotContact(person)) return true;
  return person.consentCaptured !== true;
}
