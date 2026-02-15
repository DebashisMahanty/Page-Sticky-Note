export const FREE_NOTE_LIMIT = 5;

export function canCreateNote(meta) {
  if (meta?.isPro) {
    return true;
  }
  return (meta?.noteCount || 0) < FREE_NOTE_LIMIT;
}

export function formatUsage(meta) {
  const used = meta?.noteCount || 0;
  const limit = meta?.isPro ? '∞' : FREE_NOTE_LIMIT;
  return `Notes used: ${used} / ${limit}`;
}
