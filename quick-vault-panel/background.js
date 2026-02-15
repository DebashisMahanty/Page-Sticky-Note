import { ensureStorageDefaults, getSettings } from './utils/storage.js';

async function configurePanelBehavior() {
  try {
    const settings = await getSettings();
    await chrome.sidePanel.setPanelBehavior({
      openPanelOnActionClick: Boolean(settings.enabled)
    });
  } catch (error) {
    console.error('Failed to configure side panel behavior:', error);
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await ensureStorageDefaults();
  await configurePanelBehavior();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureStorageDefaults();
  await configurePanelBehavior();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'SET_VAULT_ENABLED') {
    (async () => {
      await chrome.sidePanel.setPanelBehavior({
        openPanelOnActionClick: Boolean(message.enabled)
      });
      sendResponse({ ok: true });
    })().catch((error) => {
      console.error('Failed to set panel behavior from message:', error);
      sendResponse({ ok: false });
    });

    return true;
  }

  return false;
});
