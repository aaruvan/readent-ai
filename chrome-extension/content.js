// RSVP Speed Reader Content Script
// Injects overlay and handles reading logic

(function() {
  'use strict';

  // State
  let overlay = null;
  let words = [];
  let currentIndex = 0;
  let isPlaying = false;
  let timer = null;
  let settings = {
    wpm: 300,
    fontSize: 48,
    wordsAtATime: 1
  };

  // Load saved settings
  chrome.storage.sync.get(['rsvpSettings'], (result) => {
    if (result.rsvpSettings) {
      settings = { ...settings, ...result.rsvpSettings };
    }
  });

  // Save settings
  function saveSettings() {
    chrome.storage.sync.set({ rsvpSettings: settings });
  }

  // ORP (Optimal Recognition Point) calculation
  function getORPIndex(word) {
    const cleanWord = word.replace(/[^a-zA-Z0-9]/g, '');
    if (cleanWord.length <= 1) return 0;
    if (cleanWord.length <= 3) return 1;
    return Math.floor(cleanWord.length * 0.3);
  }

  // Split word into ORP parts
  function splitWordORP(word) {
    if (!word) return { before: '', focal: '', after: '' };
    
    const words = word.split(' ');
    if (words.length > 1) {
      const midIndex = Math.floor(words.length / 2);
      const targetWord = words[midIndex];
      const orpIndex = getORPIndex(targetWord);
      const beforeWords = words.slice(0, midIndex).join(' ');
      const afterWords = words.slice(midIndex + 1).join(' ');
      
      return {
        before: beforeWords + (beforeWords ? ' ' : '') + targetWord.slice(0, orpIndex),
        focal: targetWord[orpIndex] || '',
        after: targetWord.slice(orpIndex + 1) + (afterWords ? ' ' + afterWords : '')
      };
    }
    
    const orpIndex = getORPIndex(word);
    return {
      before: word.slice(0, orpIndex),
      focal: word[orpIndex] || '',
      after: word.slice(orpIndex + 1)
    };
  }

  // Adaptive pacing - calculate delay based on word
  function calculateWordDelay(word, baseDelay) {
    let multiplier = 1;
    
    // Longer words need more time
    if (word.length > 8) multiplier += 0.3;
    if (word.length > 12) multiplier += 0.2;
    
    // Punctuation pauses
    if (/[.!?]$/.test(word)) multiplier += 0.5;
    if (/[,;:]$/.test(word)) multiplier += 0.25;
    
    // Numbers need more processing
    if (/\d/.test(word)) multiplier += 0.2;
    
    // Capitalized words
    if (/^[A-Z]/.test(word) && word.length > 1) multiplier += 0.1;
    
    return baseDelay * multiplier;
  }

  // Format time
  function formatTime(seconds) {
    if (seconds < 60) return `${Math.ceil(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }

  // Create the overlay UI
  function createOverlay() {
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.id = 'rsvp-reader-overlay';
    overlay.innerHTML = `
      <div class="rsvp-container">
        <button class="rsvp-close" title="Close (Esc)">&times;</button>
        
        <div class="rsvp-header">
          <div class="rsvp-stat">
            <span class="rsvp-stat-value" id="rsvp-wpm">${settings.wpm}</span>
            <span class="rsvp-stat-label">WPM</span>
          </div>
          <div class="rsvp-stat">
            <span class="rsvp-stat-value" id="rsvp-progress">0%</span>
            <span class="rsvp-stat-label">Progress</span>
          </div>
          <div class="rsvp-stat">
            <span class="rsvp-stat-value" id="rsvp-time">0s</span>
            <span class="rsvp-stat-label">Remaining</span>
          </div>
        </div>

        <div class="rsvp-word-area">
          <div class="rsvp-guide-line"></div>
          <div class="rsvp-word" id="rsvp-word" style="font-size: ${settings.fontSize}px">
            <span class="rsvp-ready">Select text and press play</span>
          </div>
        </div>

        <div class="rsvp-progress-bar">
          <div class="rsvp-progress-fill" id="rsvp-progress-fill"></div>
          <input type="range" class="rsvp-seek" id="rsvp-seek" min="0" max="100" value="0">
        </div>

        <div class="rsvp-controls">
          <button class="rsvp-btn" id="rsvp-back" title="Back (←)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="19 20 9 12 19 4 19 20"></polygon>
              <line x1="5" y1="19" x2="5" y2="5"></line>
            </svg>
          </button>
          <button class="rsvp-btn rsvp-btn-play" id="rsvp-play" title="Play/Pause (Space)">
            <svg id="rsvp-play-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            <svg id="rsvp-pause-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: none;">
              <rect x="6" y="4" width="4" height="16"></rect>
              <rect x="14" y="4" width="4" height="16"></rect>
            </svg>
          </button>
          <button class="rsvp-btn" id="rsvp-forward" title="Forward (→)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5 4 15 12 5 20 5 4"></polygon>
              <line x1="19" y1="5" x2="19" y2="19"></line>
            </svg>
          </button>
          <button class="rsvp-btn" id="rsvp-stop" title="Stop (R)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="6" y="6" width="12" height="12"></rect>
            </svg>
          </button>
        </div>

        <div class="rsvp-settings">
          <div class="rsvp-setting">
            <label>Speed</label>
            <input type="range" id="rsvp-wpm-slider" min="100" max="1000" value="${settings.wpm}" step="25">
            <span id="rsvp-wpm-value">${settings.wpm}</span>
          </div>
          <div class="rsvp-setting">
            <label>Font Size</label>
            <input type="range" id="rsvp-font-slider" min="24" max="96" value="${settings.fontSize}" step="4">
            <span id="rsvp-font-value">${settings.fontSize}</span>
          </div>
        </div>

        <div class="rsvp-shortcuts">
          <span>Space: Play/Pause</span>
          <span>←→: Skip</span>
          <span>↑↓: Speed</span>
          <span>Esc: Close</span>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    attachEventListeners();
  }

  // Update word display
  function updateWordDisplay() {
    const wordEl = document.getElementById('rsvp-word');
    if (!wordEl) return;

    if (words.length === 0) {
      wordEl.innerHTML = '<span class="rsvp-ready">Select text and press play</span>';
      return;
    }

    const displayWords = words.slice(currentIndex, currentIndex + settings.wordsAtATime);
    const word = displayWords.join(' ');
    const { before, focal, after } = splitWordORP(word);

    wordEl.innerHTML = `
      <span class="rsvp-before">${before}</span>
      <span class="rsvp-focal">${focal}</span>
      <span class="rsvp-after">${after}</span>
    `;

    // Update progress
    const progress = words.length > 0 ? (currentIndex / words.length) * 100 : 0;
    const progressEl = document.getElementById('rsvp-progress');
    const progressFill = document.getElementById('rsvp-progress-fill');
    const seekEl = document.getElementById('rsvp-seek');
    
    if (progressEl) progressEl.textContent = `${Math.round(progress)}%`;
    if (progressFill) progressFill.style.width = `${progress}%`;
    if (seekEl) seekEl.value = progress;

    // Update time remaining
    const wordsRemaining = Math.max(0, words.length - currentIndex);
    const secondsRemaining = (wordsRemaining / settings.wpm) * 60;
    const timeEl = document.getElementById('rsvp-time');
    if (timeEl) timeEl.textContent = formatTime(secondsRemaining);
  }

  // Schedule next word
  function scheduleNextWord() {
    if (timer) clearTimeout(timer);
    if (!isPlaying || currentIndex >= words.length) {
      if (currentIndex >= words.length) {
        isPlaying = false;
        updatePlayButton();
      }
      return;
    }

    const displayWords = words.slice(currentIndex, currentIndex + settings.wordsAtATime);
    const word = displayWords.join(' ');
    const baseDelay = (60 / settings.wpm) * 1000 * settings.wordsAtATime;
    const delay = calculateWordDelay(word, baseDelay);

    timer = setTimeout(() => {
      currentIndex += settings.wordsAtATime;
      if (currentIndex < words.length) {
        updateWordDisplay();
        scheduleNextWord();
      } else {
        isPlaying = false;
        updatePlayButton();
        updateWordDisplay();
      }
    }, delay);
  }

  // Update play/pause button
  function updatePlayButton() {
    const playIcon = document.getElementById('rsvp-play-icon');
    const pauseIcon = document.getElementById('rsvp-pause-icon');
    if (playIcon && pauseIcon) {
      playIcon.style.display = isPlaying ? 'none' : 'block';
      pauseIcon.style.display = isPlaying ? 'block' : 'none';
    }
  }

  // Play/Pause
  function togglePlay() {
    if (words.length === 0) return;
    
    if (currentIndex >= words.length) {
      currentIndex = 0;
    }
    
    isPlaying = !isPlaying;
    updatePlayButton();
    
    if (isPlaying) {
      updateWordDisplay();
      scheduleNextWord();
    } else if (timer) {
      clearTimeout(timer);
    }
  }

  // Stop
  function stop() {
    isPlaying = false;
    if (timer) clearTimeout(timer);
    currentIndex = 0;
    updatePlayButton();
    updateWordDisplay();
  }

  // Skip forward
  function skipForward() {
    const skip = Math.max(10, Math.floor(words.length * 0.05));
    currentIndex = Math.min(currentIndex + skip, words.length - 1);
    updateWordDisplay();
    if (isPlaying) {
      if (timer) clearTimeout(timer);
      scheduleNextWord();
    }
  }

  // Skip backward
  function skipBackward() {
    const skip = Math.max(10, Math.floor(words.length * 0.05));
    currentIndex = Math.max(currentIndex - skip, 0);
    updateWordDisplay();
    if (isPlaying) {
      if (timer) clearTimeout(timer);
      scheduleNextWord();
    }
  }

  // Set WPM
  function setWPM(wpm) {
    settings.wpm = Math.max(100, Math.min(1000, wpm));
    document.getElementById('rsvp-wpm').textContent = settings.wpm;
    document.getElementById('rsvp-wpm-value').textContent = settings.wpm;
    document.getElementById('rsvp-wpm-slider').value = settings.wpm;
    saveSettings();
  }

  // Set font size
  function setFontSize(size) {
    settings.fontSize = Math.max(24, Math.min(96, size));
    document.getElementById('rsvp-word').style.fontSize = `${settings.fontSize}px`;
    document.getElementById('rsvp-font-value').textContent = settings.fontSize;
    document.getElementById('rsvp-font-slider').value = settings.fontSize;
    saveSettings();
  }

  // Seek to position
  function seekTo(percent) {
    const index = Math.floor((percent / 100) * words.length);
    currentIndex = Math.max(0, Math.min(index, words.length - 1));
    updateWordDisplay();
    if (isPlaying) {
      if (timer) clearTimeout(timer);
      scheduleNextWord();
    }
  }

  // Close overlay
  function closeOverlay() {
    if (overlay) {
      isPlaying = false;
      if (timer) clearTimeout(timer);
      overlay.remove();
      overlay = null;
    }
  }

  // Set text to read
  function setText(text) {
    words = text.split(/\s+/).filter(w => w.length > 0);
    currentIndex = 0;
    isPlaying = false;
    if (timer) clearTimeout(timer);
    updatePlayButton();
    updateWordDisplay();
  }

  // Attach event listeners
  function attachEventListeners() {
    // Close button
    overlay.querySelector('.rsvp-close').addEventListener('click', closeOverlay);

    // Control buttons
    document.getElementById('rsvp-play').addEventListener('click', togglePlay);
    document.getElementById('rsvp-stop').addEventListener('click', stop);
    document.getElementById('rsvp-back').addEventListener('click', skipBackward);
    document.getElementById('rsvp-forward').addEventListener('click', skipForward);

    // Sliders
    document.getElementById('rsvp-wpm-slider').addEventListener('input', (e) => {
      setWPM(parseInt(e.target.value));
    });

    document.getElementById('rsvp-font-slider').addEventListener('input', (e) => {
      setFontSize(parseInt(e.target.value));
    });

    document.getElementById('rsvp-seek').addEventListener('input', (e) => {
      seekTo(parseFloat(e.target.value));
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeydown);

    // Click outside to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeOverlay();
    });
  }

  // Handle keydown
  function handleKeydown(e) {
    if (!overlay) return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        togglePlay();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        skipBackward();
        break;
      case 'ArrowRight':
        e.preventDefault();
        skipForward();
        break;
      case 'ArrowUp':
        e.preventDefault();
        setWPM(settings.wpm + 25);
        break;
      case 'ArrowDown':
        e.preventDefault();
        setWPM(settings.wpm - 25);
        break;
      case 'Escape':
        closeOverlay();
        break;
      case 'KeyR':
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          stop();
        }
        break;
    }
  }

  // Get selected text
  function getSelectedText() {
    return window.getSelection().toString().trim();
  }

  // Listen for messages from background/popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
      case 'startReader':
        createOverlay();
        if (request.text) {
          setText(request.text);
        }
        break;
      
      case 'toggleReader':
        if (overlay) {
          closeOverlay();
        } else {
          createOverlay();
          const selectedText = getSelectedText();
          if (selectedText) {
            setText(selectedText);
          }
        }
        break;
      
      case 'togglePlay':
        if (overlay) {
          togglePlay();
        }
        break;
      
      case 'getSelection':
        sendResponse({ text: getSelectedText() });
        break;
    }
  });

})();
