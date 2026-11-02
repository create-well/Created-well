// The accessible description for a Move's assignee marker. QA's
// Phase A closing audit observed that task-row accessibility
// descriptions could carry raw record identifiers: the person dot
// fell back to the stored person value, and legacy records can
// store an identifier rather than a known slug. This is the single
// place that description is composed, and it never echoes the raw
// stored value: a known role names the person, an empty assignee
// reads Unassigned (the form's own word since the 2026-11-02
// ruling), and anything else reads as an unlisted assignee.

export function assigneeDescription(
  person: string,
  roleName?: string,
  roleSub?: string,
): string {
  if (roleName) return roleSub ? `${roleName} — ${roleSub}` : roleName;
  if (!person || !person.trim()) return 'Unassigned';
  return 'Assignee not listed';
}
