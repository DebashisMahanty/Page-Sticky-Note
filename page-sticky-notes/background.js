import { ensureStorageDefaults, getMeta } from './utils/storage.js';

chrome.runtime.onInstalled.addListener(async () => {
  await ensureStorageDefaults();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureStorageDefaults();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'OPEN_PAYWALL') {
    chrome.tabs.create({ url: chrome.runtime.getURL('paywall.html') }).catch((error) => {
      console.error('Failed to open paywall tab:', error);
    });

    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === 'GET_META') {
    (async () => {
      const meta = await getMeta();
      sendResponse({ ok: true, meta });
    })().catch((error) => {
      console.error('Failed to get meta in background:', error);
      sendResponse({ ok: false });
    });

    return true;
  }

  return false;
});
