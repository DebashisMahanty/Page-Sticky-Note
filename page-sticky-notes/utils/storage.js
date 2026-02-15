const DEFAULT_META = {
  noteCount: 0,
  isPro: false,
  enabled: true
};

const DEFAULT_STATE = {
  notes: {},
  meta: DEFAULT_META
};

function getFromStorage(keys) {
  return chrome.storage.local.get(keys);
}

function setInStorage(value) {
  return chrome.storage.local.set(value);
}

export async function ensureStorageDefaults() {
  const current = await getFromStorage(['notes', 'meta']);

  const notes = current.notes && typeof current.notes === 'object' ? current.notes : {};
  const meta = { ...DEFAULT_META, ...(current.meta || {}) };

  const correctedCount = Object.keys(notes).length;
  if (meta.noteCount !== correctedCount) {
    meta.noteCount = correctedCount;
  }

  await setInStorage({ notes, meta });
  return { notes, meta };
}

export async function getState() {
  const state = await getFromStorage(['notes', 'meta']);
  return {
    notes: state.notes || { ...DEFAULT_STATE.notes },
    meta: { ...DEFAULT_META, ...(state.meta || {}) }
  };
}

export async function getNotes() {
  const { notes } = await getState();
  return notes;
}

export async function getMeta() {
  const { meta } = await getState();
  return meta;
}

export async function setMeta(nextMeta) {
  const { meta } = await getState();
  const merged = { ...meta, ...nextMeta };
  await setInStorage({ meta: merged });
  return merged;
}

export async function upsertNote(pageKey, noteData) {
  const { notes, meta } = await getState();
  const hadNote = Boolean(notes[pageKey]);

  notes[pageKey] = {
    ...notes[pageKey],
    ...noteData,
    updatedAt: Date.now()
  };

  const noteCount = hadNote ? meta.noteCount : meta.noteCount + 1;
  const nextMeta = { ...meta, noteCount };

  await setInStorage({ notes, meta: nextMeta });
  return { notes, meta: nextMeta, created: !hadNote };
}

export async function deleteNote(pageKey) {
  const { notes, meta } = await getState();
  const hadNote = Boolean(notes[pageKey]);

  if (!hadNote) {
    return { notes, meta, deleted: false };
  }

  delete notes[pageKey];
  const noteCount = Math.max(0, meta.noteCount - 1);
  const nextMeta = { ...meta, noteCount };

  await setInStorage({ notes, meta: nextMeta });
  return { notes, meta: nextMeta, deleted: true };
}

export function getPageKey(url = window.location) {
  return `${url.hostname}${url.pathname}`;
}
