// Reaction toggling for chat messages (Fix 3 promotion): reactions live
// on the message record itself (Message.reactions, emoji → person keys)
// and write through the messages resource. This replaces the drawer's
// former localStorage-only map, which presented as shared content but
// synced nowhere.

/** Return a NEW reactions map with personKey toggled under emoji.
 *  Empty emoji lists are dropped; an empty result is a valid map. */
export function toggleReactionMap(
  reactions: Record<string, string[]> | undefined,
  emoji: string,
  personKey: string,
): Record<string, string[]> {
  const next: Record<string, string[]> = {};
  for (const [key, users] of Object.entries(reactions || {})) {
    if (users.length > 0) next[key] = [...users];
  }
  const users = next[emoji] ? [...next[emoji]] : [];
  const idx = users.indexOf(personKey);
  if (idx >= 0) users.splice(idx, 1);
  else users.push(personKey);
  if (users.length > 0) next[emoji] = users;
  else delete next[emoji];
  return next;
}
