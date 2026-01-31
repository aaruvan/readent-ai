// Background service worker for RSVP Speed Reader

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'rsvp-read-selection',
    title: 'Speed Read Selection',
    contexts: ['selection']
  });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'rsvp-read-selection' && info.selectionText) {
    chrome.tabs.sendMessage(tab.id, {
      action: 'startReader',
      text: info.selectionText
    });
  }
});

// Handle keyboard commands
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'toggle-reader') {
    chrome.tabs.sendMessage(tab.id, { action: 'toggleReader' });
  } else if (command === 'toggle-play') {
    chrome.tabs.sendMessage(tab.id, { action: 'togglePlay' });
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSelectedText') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'getSelection' }, (response) => {
          sendResponse(response);
        });
      }
    });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'startReaderFromPopup') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'startReader',
          text: request.text
        });
      }
    });
  }
});
