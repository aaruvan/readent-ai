/**
 * Swift Insight Reader - Background Service Worker (Manifest V3)
 * Handles context menu, keyboard commands, popup messages. Injects content script when needed.
 */

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'swift-insight-read-selection',
    title: 'Speed Read Selection',
    contexts: ['selection'],
  });
});

// Inject content script if needed, then send message. Returns response if any.
async function ensureAndSend(tabId, message) {
  function send() {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(response);
      });
    });
  }
  try {
    return await send();
  } catch (e) {
    if (!e?.message?.includes('Receiving end does not exist')) throw e;
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    await chrome.scripting.insertCSS({ target: { tabId }, files: ['content.css'] });
    await new Promise((r) => setTimeout(r, 50));
    return await send();
  }
}

// Context menu: right-click selected text → Speed Read Selection
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'swift-insight-read-selection' && info.selectionText?.trim() && tab?.id) {
    try {
      await ensureAndSend(tab.id, { action: 'startReader', text: info.selectionText.trim() });
    } catch (_) {
      // Restricted page (chrome://, etc.)
    }
  }
});

// Keyboard: Alt+R → toggle reader, Alt+Space → play/pause
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (!tab?.id) return;
  try {
    if (command === 'toggle-reader') {
      await ensureAndSend(tab.id, { action: 'toggleReader' });
    } else if (command === 'toggle-play') {
      await ensureAndSend(tab.id, { action: 'togglePlay' });
    }
  } catch (_) {
    // Restricted page
  }
});

// Popup: startReaderFromPopup with captured text
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'startReaderFromPopup') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]?.id && request.text?.trim()) {
        try {
          await ensureAndSend(tabs[0].id, { action: 'startReader', text: request.text.trim() });
        } catch (_) {}
      }
    });
  }
});
