import {
  ensureStorageDefaults,
  getVaultNotes,
  createNote,
  updateNote,
  deleteNote,
  getSettings
} from './utils/storage.js';
import { debounce, makePreview } from './utils/dom.js';

const notesList = document.getElementById('notesList');
const emptyState = document.getElementById('emptyState');
const newNoteBtn = document.getElementById('newNoteBtn');
const subText = document.getElementById('subText');
const noteCardTemplate = document.getElementById('noteCardTemplate');

const saveHandlers = new Map();
const copyCooldownIds = new Set();

let isEnabled = true;

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString();
}

function updatePanelState() {
  if (isEnabled) {
    subText.textContent = 'Global notes available across all websites.';
    newNoteBtn.disabled = false;
  } else {
    subText.textContent = 'Vault is OFF. Turn it on from popup to edit notes.';
    newNoteBtn.disabled = true;
  }
}

function bindAutosave(noteId, textarea, previewEl, metaEl, copyBtn) {
  if (!saveHandlers.has(noteId)) {
    saveHandlers.set(
      noteId,
      debounce(async (text) => {
        const updated = await updateNote(noteId, text);
        if (!updated) {
          return;
        }

        previewEl.textContent = makePreview(updated.text);
        metaEl.textContent = `Updated: ${formatTime(updated.updatedAt)}`;
        copyBtn.disabled = !updated.text.trim() || !isEnabled;
      }, 500)
    );
  }

  textarea.addEventListener('input', () => {
    const value = textarea.value;
    previewEl.textContent = makePreview(value);
    copyBtn.disabled = !value.trim() || !isEnabled;

    const handler = saveHandlers.get(noteId);
    if (handler) {
      handler(value);
    }
  });
}

function createNoteCard(note) {
  const card = noteCardTemplate.content.firstElementChild.cloneNode(true);
  const textarea = card.querySelector('.note-editor');
  const previewEl = card.querySelector('.note-preview');
  const metaEl = card.querySelector('.note-meta');
  const copyBtn = card.querySelector('.copy-btn');
  const editBtn = card.querySelector('.edit-btn');
  const deleteBtn = card.querySelector('.delete-btn');

  textarea.value = note.text;
  textarea.disabled = !isEnabled;
  previewEl.textContent = makePreview(note.text);
  metaEl.textContent = `Updated: ${formatTime(note.updatedAt)}`;
  copyBtn.disabled = !note.text.trim() || !isEnabled;
  editBtn.disabled = !isEnabled;
  deleteBtn.disabled = !isEnabled;

  bindAutosave(note.id, textarea, previewEl, metaEl, copyBtn);

  editBtn.addEventListener('click', () => {
    if (!isEnabled) {
      return;
    }
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  });

  deleteBtn.addEventListener('click', async () => {
    if (!isEnabled) {
      return;
    }

    const confirmed = window.confirm('Delete this note permanently?');
    if (!confirmed) {
      return;
    }

    await deleteNote(note.id);
    await render();
  });

  copyBtn.addEventListener('click', async () => {
    if (!isEnabled || !textarea.value.trim() || copyCooldownIds.has(note.id)) {
      return;
    }

    copyCooldownIds.add(note.id);
    copyBtn.disabled = true;

    const originalLabel = copyBtn.textContent;

    try {
      await navigator.clipboard.writeText(textarea.value);
      copyBtn.textContent = 'Copied!';
    } catch (error) {
      console.error('Clipboard copy failed:', error);
      copyBtn.textContent = 'Copy failed';
    }

    window.setTimeout(() => {
      copyCooldownIds.delete(note.id);
      copyBtn.textContent = originalLabel;
      copyBtn.disabled = !textarea.value.trim() || !isEnabled;
    }, 1500);
  });

  return card;
}

async function render() {
  const settings = await getSettings();
  isEnabled = Boolean(settings.enabled);
  updatePanelState();

  const notes = await getVaultNotes();
  notesList.innerHTML = '';

  emptyState.hidden = notes.length !== 0;

  for (const note of notes) {
    notesList.appendChild(createNoteCard(note));
  }
}

newNoteBtn.addEventListener('click', async () => {
  if (!isEnabled) {
    return;
  }

  const note = await createNote();
  await render();

  // Focus the newly created note editor.
  const firstCard = notesList.firstElementChild;
  const textarea = firstCard?.querySelector('.note-editor');
  if (textarea && note) {
    textarea.focus();
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') {
    return;
  }

  if (changes.vaultNotes || changes.vaultSettings) {
    render().catch((error) => {
      console.error('Failed to re-render side panel after storage change:', error);
    });
  }
});

(async function initialize() {
  try {
    await ensureStorageDefaults();
    await render();
  } catch (error) {
    console.error('Failed to initialize side panel:', error);
    subText.textContent = 'Initialization failed. Please reload extension.';
  }
})();
