// RSVP Speed Reader Popup Script

document.addEventListener('DOMContentLoaded', () => {
  const selectionPreview = document.getElementById('selection-preview');
  const wordCount = document.getElementById('word-count');
  const startBtn = document.getElementById('start-btn');
  const wpmSlider = document.getElementById('default-wpm');
  const wpmDisplay = document.getElementById('wpm-display');

  let selectedText = '';

  // Load saved WPM setting
  chrome.storage.sync.get(['rsvpSettings'], (result) => {
    if (result.rsvpSettings?.wpm) {
      wpmSlider.value = result.rsvpSettings.wpm;
      wpmDisplay.textContent = result.rsvpSettings.wpm;
    }
  });

  // Get selected text from active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'getSelection' }, (response) => {
        if (chrome.runtime.lastError) {
          selectionPreview.innerHTML = '<p class="error">Cannot access this page. Try a regular webpage.</p>';
          startBtn.disabled = true;
          return;
        }

        if (response?.text) {
          selectedText = response.text;
          const words = selectedText.split(/\s+/).filter(w => w.length > 0);
          const preview = selectedText.length > 150 
            ? selectedText.substring(0, 150) + '...' 
            : selectedText;
          
          selectionPreview.innerHTML = `<p class="preview-text">${escapeHtml(preview)}</p>`;
          wordCount.textContent = `${words.length} words • ~${Math.ceil(words.length / 300)} min at 300 WPM`;
          startBtn.disabled = false;
        } else {
          selectionPreview.innerHTML = '<p class="placeholder">Select text on any webpage, then click "Start Reading"</p>';
          startBtn.disabled = true;
        }
      });
    }
  });

  // Start reading button
  startBtn.addEventListener('click', () => {
    if (selectedText) {
      chrome.runtime.sendMessage({
        action: 'startReaderFromPopup',
        text: selectedText
      });
      window.close();
    }
  });

  // WPM slider
  wpmSlider.addEventListener('input', (e) => {
    const wpm = parseInt(e.target.value);
    wpmDisplay.textContent = wpm;
    
    chrome.storage.sync.get(['rsvpSettings'], (result) => {
      const settings = result.rsvpSettings || {};
      settings.wpm = wpm;
      chrome.storage.sync.set({ rsvpSettings: settings });
    });
  });
});

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
