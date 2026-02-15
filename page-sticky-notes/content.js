(async () => {
  const { ensureStorageDefaults, getState, getPageKey, upsertNote, deleteNote } = await import(
    chrome.runtime.getURL('utils/storage.js')
  );
  const { canCreateNote } = await import(chrome.runtime.getURL('utils/freemium.js'));
  const { debounce, clampPosition } = await import(chrome.runtime.getURL('utils/dom.js'));

  const NOTE_ID = 'psn-sticky-note';
  let currentPageKey = getPageKey();
  let noteRoot = null;
  let isEnabled = true;
  let copyCooldown = false;

  await ensureStorageDefaults();

  async function initForCurrentPage() {
    const { notes, meta } = await getState();
    isEnabled = Boolean(meta.enabled);

    if (!isEnabled) {
      removeNote();
      return;
    }

    const savedNote = notes[currentPageKey];
    if (savedNote) {
      renderNote(savedNote);
    } else {
      removeNote();
    }
  }

  function removeNote() {
    if (noteRoot) {
      noteRoot.remove();
      noteRoot = null;
    }
  }

  function renderNote(noteData) {
    if (noteRoot) {
      noteRoot.remove();
    }

    const note = document.createElement('section');
    note.id = NOTE_ID;
    note.className = 'psn-note';
    note.setAttribute('aria-label', 'Page sticky note');

    const position = clampPosition(noteData.position || {});
    note.style.left = `${position.x}px`;
    note.style.top = `${position.y}px`;

    note.innerHTML = `
      <header class="psn-header">
        <strong class="psn-title">Sticky Note</strong>
        <div class="psn-actions">
          <button type="button" class="psn-btn psn-copy" title="Copy note text">📋 Copy</button>
          <button type="button" class="psn-btn psn-delete" title="Delete note">🗑 Delete</button>
        </div>
      </header>
      <textarea class="psn-text" placeholder="Write something useful..."></textarea>
    `;

    const textArea = note.querySelector('.psn-text');
    const copyButton = note.querySelector('.psn-copy');
    const deleteButton = note.querySelector('.psn-delete');
    const header = note.querySelector('.psn-header');

    textArea.value = noteData.text || '';
    copyButton.disabled = !textArea.value.trim();

    const debouncedSave = debounce(async () => {
      await upsertNote(currentPageKey, {
        text: textArea.value,
        position: {
          x: parseFloat(note.style.left),
          y: parseFloat(note.style.top)
        }
      });
    }, 500);

    textArea.addEventListener('input', () => {
      copyButton.disabled = !textArea.value.trim();
      debouncedSave();
    });

    deleteButton.addEventListener('click', async () => {
      await deleteNote(currentPageKey);
      removeNote();
    });

    copyButton.addEventListener('click', async () => {
      if (copyCooldown || !textArea.value.trim()) {
        return;
      }

      copyCooldown = true;
      copyButton.disabled = true;

      const originalLabel = copyButton.textContent;
      try {
        await navigator.clipboard.writeText(textArea.value);
        copyButton.textContent = 'Copied!';
      } catch (error) {
        console.error('Copy to clipboard failed:', error);
        copyButton.textContent = 'Copy failed';
      }

      window.setTimeout(() => {
        copyButton.textContent = originalLabel;
        copyButton.disabled = !textArea.value.trim();
        copyCooldown = false;
      }, 1500);
    });

    makeDraggable(note, header, async () => {
      await upsertNote(currentPageKey, {
        text: textArea.value,
        position: {
          x: parseFloat(note.style.left),
          y: parseFloat(note.style.top)
        }
      });
    });

    document.body.appendChild(note);
    noteRoot = note;
  }

  function makeDraggable(note, dragHandle, onDrop) {
    let dragging = false;
    let startOffsetX = 0;
    let startOffsetY = 0;

    dragHandle.addEventListener('pointerdown', (event) => {
      if (event.target.closest('button')) {
        return;
      }

      dragging = true;
      note.setPointerCapture(event.pointerId);
      const rect = note.getBoundingClientRect();
      startOffsetX = event.clientX - rect.left;
      startOffsetY = event.clientY - rect.top;
      note.classList.add('is-dragging');
    });

    note.addEventListener('pointermove', (event) => {
      if (!dragging) {
        return;
      }

      const x = event.clientX - startOffsetX;
      const y = event.clientY - startOffsetY;
      const next = clampPosition({ x, y });

      note.style.left = `${next.x}px`;
      note.style.top = `${next.y}px`;
    });

    note.addEventListener('pointerup', async (event) => {
      if (!dragging) {
        return;
      }

      dragging = false;
      note.releasePointerCapture(event.pointerId);
      note.classList.remove('is-dragging');
      await onDrop();
    });
  }

  async function tryCreateNote() {
    const { notes, meta } = await getState();
    isEnabled = Boolean(meta.enabled);

    if (!isEnabled) {
      return { ok: false, reason: 'disabled' };
    }

    if (notes[currentPageKey]) {
      renderNote(notes[currentPageKey]);
      return { ok: true, reason: 'exists' };
    }

    if (!canCreateNote(meta)) {
      chrome.runtime.sendMessage({ type: 'OPEN_PAYWALL' });
      return { ok: false, reason: 'limit' };
    }

    const newNote = {
      text: '',
      position: clampPosition({}),
      updatedAt: Date.now()
    };

    await upsertNote(currentPageKey, newNote);
    renderNote(newNote);

    return { ok: true, reason: 'created' };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'CREATE_NOTE_FOR_PAGE') {
      tryCreateNote()
        .then((result) => sendResponse(result))
        .catch((error) => {
          console.error('Failed to create note:', error);
          sendResponse({ ok: false, reason: 'error' });
        });
      return true;
    }

    if (message?.type === 'REFRESH_NOTE_STATE') {
      initForCurrentPage()
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
      return true;
    }

    return false;
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') {
      return;
    }

    if (changes.meta || changes.notes) {
      initForCurrentPage().catch((error) => {
        console.error('Failed to refresh note after storage change:', error);
      });
    }
  });

  const observeUrlChange = () => {
    let previousHref = window.location.href;
    window.setInterval(() => {
      if (window.location.href !== previousHref) {
        previousHref = window.location.href;
        currentPageKey = getPageKey();
        initForCurrentPage().catch((error) => {
          console.error('Failed to reinitialize on URL change:', error);
        });
      }
    }, 500);
  };

  observeUrlChange();
  await initForCurrentPage();
})();
