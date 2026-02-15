import { ensureStorageDefaults, getMeta, setMeta } from './utils/storage.js';
import { formatUsage } from './utils/freemium.js';

const statusText = document.getElementById('statusText');
const usageText = document.getElementById('usageText');
const enabledToggle = document.getElementById('enabledToggle');
const addNoteBtn = document.getElementById('addNoteBtn');

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function refreshUi() {
  await ensureStorageDefaults();
  const meta = await getMeta();

  enabledToggle.checked = Boolean(meta.enabled);
  usageText.textContent = formatUsage(meta);
  statusText.textContent = meta.enabled
    ? 'Sticky notes are enabled on this browser.'
    : 'Sticky notes are disabled.';
}

async function notifyActiveTab() {
  const tab = await getActiveTab();
  if (!tab?.id) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'REFRESH_NOTE_STATE' });
  } catch (error) {
    // Harmless for pages that block content scripts (e.g. chrome:// pages).
    console.debug('Unable to reach content script in active tab:', error);
  }
}

enabledToggle.addEventListener('change', async () => {
  const nextEnabled = enabledToggle.checked;
  await setMeta({ enabled: nextEnabled });
  await refreshUi();
  await notifyActiveTab();
});

addNoteBtn.addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!tab?.id) {
    return;
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'CREATE_NOTE_FOR_PAGE' });
    if (response?.reason === 'limit') {
      statusText.textContent = 'Free limit reached. Check the upgrade page.';
    } else if (response?.reason === 'disabled') {
      statusText.textContent = 'Enable sticky notes to add one on this page.';
    } else if (response?.ok) {
      statusText.textContent = response.reason === 'exists' ? 'Note already exists on this page.' : 'Note created.';
    }
  } catch (error) {
    statusText.textContent = 'Cannot add notes on this page.';
    console.debug('Add note request failed:', error);
  }

  await refreshUi();
});

refreshUi().catch((error) => {
  console.error('Popup failed to initialize:', error);
  statusText.textContent = 'Something went wrong. Please reload extension.';
});
