import browser from 'webextension-polyfill';

/**
 * Popup script to show connection status
 */
async function updateStatus() {
  const statusEl = document.getElementById('status');
  if (!statusEl) return;

  try {
    // Get status from background script
    const response = await browser.runtime.sendMessage({ type: 'GET_STATUS' });

    if (response.connected) {
      statusEl.className = 'status connected';
      statusEl.querySelector('.status-text')!.textContent = 'Connected to backend ✓';
    } else {
      statusEl.className = 'status disconnected';
      if (response.reconnectAttempts > 0) {
        statusEl.querySelector('.status-text')!.textContent =
          `Reconnecting... (${response.reconnectAttempts}/10)`;
      } else {
        statusEl.querySelector('.status-text')!.textContent = 'Disconnected from backend';
      }
    }
  } catch (error) {
    statusEl.className = 'status disconnected';
    statusEl.querySelector('.status-text')!.textContent = 'Error checking status';
  }
}

// Update status on load and every 2 seconds
updateStatus();
setInterval(updateStatus, 2000);
