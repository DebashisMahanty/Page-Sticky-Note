/** Simple debounce helper for high-frequency events like typing. */
export function debounce(fn, delay = 300) {
  let timeout = null;
  return (...args) => {
    window.clearTimeout(timeout);
    timeout = window.setTimeout(() => fn(...args), delay);
  };
}

/** Trims note content for compact preview text. */
export function makePreview(text, max = 120) {
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return 'Empty note';
  }
  return normalized.length > max ? `${normalized.slice(0, max)}…` : normalized;
}
