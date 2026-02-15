import { ensureStorageDefaults, getSettings, setSettings } from './utils/storage.js';

const statusText = document.getElementById('statusText');
const vaultToggle = document.getElementById('vaultToggle');
const openVaultBtn = document.getElementById('openVaultBtn');

function updateStatus(enabled) {
  statusText.textContent = enabled ? 'Vault status: ON' : 'Vault status: OFF';
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function refreshPopup() {
  await ensureStorageDefaults();
  const settings = await getSettings();
  vaultToggle.checked = Boolean(settings.enabled);
  updateStatus(Boolean(settings.enabled));
}

vaultToggle.addEventListener('change', async () => {
  const enabled = vaultToggle.checked;

  await setSettings({ enabled });
  updateStatus(enabled);

  try {
    await chrome.runtime.sendMessage({ type: 'SET_VAULT_ENABLED', enabled });
  } catch (error) {
    console.error('Failed to sync toggle to background:', error);
  }
});

openVaultBtn.addEventListener('click', async () => {
  const settings = await getSettings();
  if (!settings.enabled) {
    updateStatus(false);
    return;
  }

  const activeTab = await getActiveTab();
  if (!activeTab?.windowId) {
    statusText.textContent = 'Unable to open panel in this window.';
    return;
  }

  try {
    await chrome.sidePanel.open({ windowId: activeTab.windowId });
    statusText.textContent = 'Vault opened.';
  } catch (error) {
    console.error('Failed to open side panel:', error);
    statusText.textContent = 'Could not open vault here.';
  }
});

refreshPopup().catch((error) => {
  console.error('Popup initialization failed:', error);
  statusText.textContent = 'Initialization error.';
});
