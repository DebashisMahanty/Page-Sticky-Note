const STORAGE_KEYS = {
  notes: 'vaultNotes',
  settings: 'vaultSettings'
};

const DEFAULT_SETTINGS = {
  enabled: true
};

/** Creates a lightweight unique ID without external dependencies. */
function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function ensureStorageDefaults() {
  const state = await chrome.storage.local.get([STORAGE_KEYS.notes, STORAGE_KEYS.settings]);

  const notes = Array.isArray(state[STORAGE_KEYS.notes]) ? state[STORAGE_KEYS.notes] : [];
  const settings = { ...DEFAULT_SETTINGS, ...(state[STORAGE_KEYS.settings] || {}) };

  await chrome.storage.local.set({
    [STORAGE_KEYS.notes]: notes,
    [STORAGE_KEYS.settings]: settings
  });

  return { notes, settings };
}

export async function getVaultNotes() {
  const state = await chrome.storage.local.get(STORAGE_KEYS.notes);
  return Array.isArray(state[STORAGE_KEYS.notes]) ? state[STORAGE_KEYS.notes] : [];
}

export async function saveVaultNotes(notes) {
  await chrome.storage.local.set({ [STORAGE_KEYS.notes]: notes });
  return notes;
}

export async function getSettings() {
  const state = await chrome.storage.local.get(STORAGE_KEYS.settings);
  return { ...DEFAULT_SETTINGS, ...(state[STORAGE_KEYS.settings] || {}) };
}

export async function setSettings(nextSettings) {
  const current = await getSettings();
  const merged = { ...current, ...nextSettings };
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: merged });
  return merged;
}

export async function createNote() {
  const notes = await getVaultNotes();
  const now = Date.now();

  const note = {
    id: createId(),
    text: '',
    createdAt: now,
    updatedAt: now
  };

  const next = [note, ...notes];
  await saveVaultNotes(next);
  return note;
}

export async function updateNote(noteId, text) {
  const notes = await getVaultNotes();
  const now = Date.now();

  const next = notes.map((note) =>
    note.id === noteId
      ? {
          ...note,
          text,
          updatedAt: now
        }
      : note
  );

  await saveVaultNotes(next);
  return next.find((note) => note.id === noteId) || null;
}

export async function deleteNote(noteId) {
  const notes = await getVaultNotes();
  const next = notes.filter((note) => note.id !== noteId);
  await saveVaultNotes(next);
  return next;
}
