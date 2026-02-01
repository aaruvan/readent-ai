// Swift Insight Reader Popup

document.addEventListener('DOMContentLoaded', async () => {
  const selectionPreview = document.getElementById('selection-preview');
  const wordCount = document.getElementById('word-count');
  const startBtn = document.getElementById('speed-read');
  const wpmSlider = document.getElementById('default-wpm');
  const wpmDisplay = document.getElementById('wpm-display');
  const eyeToggle = document.getElementById('eye-tracking-toggle');

  let selectedText = '';

  // Load saved WPM
  chrome.storage.sync.get(['rsvpSettings'], (result) => {
    if (result.rsvpSettings?.wpm) {
      wpmSlider.value = result.rsvpSettings.wpm;
      wpmDisplay.textContent = result.rsvpSettings.wpm;
    }
    if (typeof result.rsvpSettings?.eyeTrackingEnabled === 'boolean') {
      eyeToggle.checked = result.rsvpSettings.eyeTrackingEnabled;
    }
  });

  // Ensure content script is loaded, inject if needed. Returns { ok, response }.
  async function ensureContentScript(tabId) {
    function sendGetSelection() {
      return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, { action: 'getSelection' }, (response) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve(response);
        });
      });
    }
    try {
      const response = await sendGetSelection();
      return { ok: true, response };
    } catch (e) {
      if (!e?.message?.includes('Receiving end does not exist')) throw e;
      try {
        await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
        await chrome.scripting.insertCSS({ target: { tabId }, files: ['content.css'] });
        await new Promise((r) => setTimeout(r, 50));
        const response = await sendGetSelection();
        return { ok: true, response };
      } catch (_) {
        return { ok: false };
      }
    }
  }

  // Fetch selection from active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  const { ok, response } = await ensureContentScript(tab.id);
  if (!ok) {
    selectionPreview.innerHTML = '<p class="error">Cannot access this page. Try a regular webpage.</p>';
    startBtn.disabled = true;
    return;
  }

  if (response?.text) {
    selectedText = response.text;
    const words = selectedText.split(/\s+/).filter((w) => w.length > 0);
    const preview = selectedText.length > 150 ? selectedText.substring(0, 150) + '...' : selectedText;

    selectionPreview.innerHTML = `<p class="preview-text">${escapeHtml(preview)}</p>`;
    wordCount.textContent = `${words.length} words • ~${Math.ceil(words.length / 300)} min at 300 WPM`;
    startBtn.disabled = false;
  } else {
    selectionPreview.innerHTML = '<p class="placeholder">Select text on any webpage, then press <kbd>Alt+R</kbd> or click below</p>';
    startBtn.disabled = true;
  }

  // Start Reading button
  startBtn.addEventListener('click', () => {
    if (selectedText) {
      chrome.runtime.sendMessage({ action: 'startReaderFromPopup', text: selectedText });
      window.close();
    }
  });

  // WPM slider
  wpmSlider.addEventListener('input', (e) => {
    const wpm = parseInt(e.target.value, 10);
    wpmDisplay.textContent = wpm;
    chrome.storage.sync.get(['rsvpSettings'], (result) => {
      const settings = result.rsvpSettings || {};
      settings.wpm = wpm;
      chrome.storage.sync.set({ rsvpSettings: settings });
    });
  });

  eyeToggle.addEventListener('change', () => {
    chrome.storage.sync.get(['rsvpSettings'], (result) => {
      const settings = result.rsvpSettings || {};
      settings.eyeTrackingEnabled = eyeToggle.checked;
      chrome.storage.sync.set({ rsvpSettings: settings });
    });
  });
});

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
