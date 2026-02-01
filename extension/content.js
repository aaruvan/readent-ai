/**
 * Swift Insight Reader - Content Script
 * Listens for openReader; gets selection, injects overlay, runs RSVP with ORP highlight and adaptive pacing.
 */

(function () {
  const OVERLAY_ID = 'swift-insight-reader-root';
  const TOAST_ID = 'swift-insight-reader-toast';

  // Supabase config for smart-pacer edge function
  const SUPABASE_URL = 'https://qtefbcruzqrzsswsegpx.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0ZWZiY3J1enFyenNzd3NlZ3B4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MDIzMzgsImV4cCI6MjA4NTQ3ODMzOH0.kyNdPWAH6pGge9TC2ys1L2aoZKLikWSTnX8_iBwCxIY';

  // --- Helpers (same logic as web demo) ---

  function getORPIndex(word) {
    const clean = word.replace(/[^a-zA-Z0-9]/g, '');
    if (clean.length <= 1) return 0;
    if (clean.length <= 3) return 1;
    return Math.floor(clean.length * 0.3);
  }

  function splitORP(word) {
    if (!word) return { before: '', focal: '', after: '' };
    const parts = word.split(' ');
    if (parts.length > 1) {
      const mid = Math.floor(parts.length / 2);
      const target = parts[mid];
      const orp = getORPIndex(target);
      const beforeWords = parts.slice(0, mid).join(' ');
      const afterWords = parts.slice(mid + 1).join(' ');
      return {
        before: (beforeWords ? beforeWords + ' ' : '') + target.slice(0, orp),
        focal: target[orp] || '',
        after: target.slice(orp + 1) + (afterWords ? ' ' + afterWords : ''),
      };
    }
    const orp = getORPIndex(word);
    return {
      before: word.slice(0, orp),
      focal: word[orp] || '',
      after: word.slice(orp + 1),
    };
  }

  function calculateWordDelay(word, baseDelay, aiMultiplier) {
    let multiplier = aiMultiplier;
    if (multiplier == null || !Number.isFinite(multiplier)) {
      multiplier = 1;
      if (word.length > 8) multiplier += 0.3;
      if (word.length > 12) multiplier += 0.2;
      if (/[.!?]$/.test(word)) multiplier += 0.5;
      if (/[,;:]$/.test(word)) multiplier += 0.25;
      if (/\d/.test(word)) multiplier += 0.2;
      if (/^[A-Z]/.test(word) && word.length > 1) multiplier += 0.1;
    }
    multiplier = Math.max(0.5, Math.min(2, multiplier));
    return baseDelay * multiplier;
  }

  function formatTime(seconds) {
    if (seconds < 60) return Math.ceil(seconds) + 's';
    const mins = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    return secs > 0 ? mins + 'm ' + secs + 's' : mins + 'm';
  }

  function showToast(message) {
    let el = document.getElementById(TOAST_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = TOAST_ID;
      el.className = 'sir-toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.style.display = 'block';
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      el.style.display = 'none';
    }, 2500);
  }

  let keydownHandler = null;

  function closeOverlay() {
    if (keydownHandler) {
      document.removeEventListener('keydown', keydownHandler);
      keydownHandler = null;
    }
    const root = document.getElementById(OVERLAY_ID);
    if (root) root.remove();
  }

  function createOverlay(text) {
    if (document.getElementById(OVERLAY_ID)) {
      closeOverlay();
    }

    const words = text.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) {
      showToast('No text to read.');
      return;
    }

    // Load saved settings from storage
    const defaultSettings = { wpm: 300, wordsAtATime: 1, fontSize: 48 };
    const smartPacerOpts = { industry: null, comprehension: 'normal', goal: 'maintain' };
    chrome.storage.sync.get(['rsvpSettings'], (result) => {
      const stored = result.rsvpSettings || {};
      if (stored.wpm) defaultSettings.wpm = Math.max(50, Math.min(1200, stored.wpm));
      if (stored.industry && stored.industry !== 'general') smartPacerOpts.industry = stored.industry;
      if (stored.comprehension) smartPacerOpts.comprehension = stored.comprehension;
      if (stored.goal) smartPacerOpts.goal = stored.goal;
      const smartPacerOn = stored.smartPacerDefault !== false;
      createOverlayWithSettings(words, defaultSettings, smartPacerOn, smartPacerOpts);
    });
  }

  function createOverlayWithSettings(words, defaultSettings, smartPacerOnByDefault, smartPacerOpts) {
    if (document.getElementById(OVERLAY_ID)) closeOverlay();

    const state = {
      words,
      currentIndex: 0,
      isPlaying: false,
      timerId: null,
      settings: { ...defaultSettings },
      pacingData: null,
      smartPacerEnabled: smartPacerOnByDefault,
      smartPacerLoading: false,
      industry: smartPacerOpts.industry,
      comprehension: smartPacerOpts.comprehension,
      goal: smartPacerOpts.goal,
    };

    const root = document.createElement('div');
    root.id = OVERLAY_ID;

    // Control bar
    const controlBar = document.createElement('div');
    controlBar.className = 'sir-control-bar';

    const timeLeftEl = document.createElement('span');
    timeLeftEl.className = 'sir-time sir-time-left';

    const controlGroup = document.createElement('div');
    controlGroup.className = 'sir-control-group';

    const wpmWrap = document.createElement('div');
    wpmWrap.className = 'sir-control-item';
    wpmWrap.innerHTML = '<label>WPM</label><button type="button" class="sir-btn-adj sir-wpm-down" aria-label="Decrease WPM">−</button><span class="sir-value sir-wpm-value">300</span><button type="button" class="sir-btn-adj sir-wpm-up" aria-label="Increase WPM">+</button>';
    const wpmValueEl = wpmWrap.querySelector('.sir-wpm-value');
    const wpmSliderWrap = document.createElement('div');
    const wpmSlider = document.createElement('input');
    wpmSlider.type = 'range';
    wpmSlider.min = 50;
    wpmSlider.max = 1200;
    wpmSlider.step = 25;
    wpmSlider.value = state.settings.wpm;
    wpmSlider.className = 'sir-wpm-slider';
    wpmSliderWrap.appendChild(wpmSlider);

    const wordsWrap = document.createElement('div');
    wordsWrap.className = 'sir-control-item';
    wordsWrap.innerHTML = '<label>Words</label><button type="button" class="sir-btn-adj sir-words-down">−</button><span class="sir-value sir-words-value">1</span><button type="button" class="sir-btn-adj sir-words-up">+</button>';
    const wordsValueEl = wordsWrap.querySelector('.sir-words-value');

    const fontWrap = document.createElement('div');
    fontWrap.className = 'sir-control-item';
    fontWrap.innerHTML = '<label>Size</label><button type="button" class="sir-btn-adj sir-font-down">−</button><span class="sir-value sir-font-value">48</span><button type="button" class="sir-btn-adj sir-font-up">+</button>';
    const fontValueEl = fontWrap.querySelector('.sir-font-value');

    controlGroup.appendChild(timeLeftEl);
    controlGroup.appendChild(wpmWrap);
    controlGroup.appendChild(wpmSliderWrap);
    controlGroup.appendChild(wordsWrap);
    controlGroup.appendChild(fontWrap);

    const smartPacerBtn = document.createElement('button');
    smartPacerBtn.type = 'button';
    smartPacerBtn.className = 'sir-smart-pacer-btn';
    smartPacerBtn.title = 'AI Smart Pacer: analyze text for adaptive pacing';
    smartPacerBtn.innerHTML = '<span class="sir-smart-pacer-icon">🧠</span><span class="sir-smart-pacer-label">Smart</span>';

    const settingsBtn = document.createElement('button');
    settingsBtn.type = 'button';
    settingsBtn.className = 'sir-settings-btn';
    settingsBtn.title = 'Smart Pacer settings';
    settingsBtn.innerHTML = '⚙';
    const settingsPopover = document.createElement('div');
    settingsPopover.className = 'sir-settings-popover sir-hidden';
    settingsPopover.innerHTML = `
      <div class="sir-settings-row"><label>Industry</label>
        <select class="sir-settings-industry">
          <option value="">General</option>
          <option value="legal">Legal</option>
          <option value="medical">Medical</option>
          <option value="technical">Technical</option>
        </select>
      </div>
      <div class="sir-settings-row"><label>Comprehension</label>
        <select class="sir-settings-comprehension">
          <option value="skim">Skim</option>
          <option value="normal" selected>Normal</option>
          <option value="deep">Deep</option>
        </select>
      </div>
      <div class="sir-settings-row"><label>Goal</label>
        <select class="sir-settings-goal">
          <option value="maintain" selected>Maintain</option>
          <option value="improve">Improve</option>
        </select>
      </div>
    `;

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'sir-close-btn';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', () => { stop(); closeOverlay(); });

    const settingsWrap = document.createElement('div');
    settingsWrap.className = 'sir-settings-wrap';
    settingsWrap.appendChild(settingsBtn);
    settingsWrap.appendChild(settingsPopover);

    controlBar.appendChild(controlGroup);
    controlBar.appendChild(smartPacerBtn);
    controlBar.appendChild(settingsWrap);
    controlBar.appendChild(closeBtn);

    // Word area
    const wordArea = document.createElement('div');
    wordArea.className = 'sir-word-area';
    const wordInner = document.createElement('div');
    wordInner.className = 'sir-word-inner';
    const orpLine = document.createElement('div');
    orpLine.className = 'sir-orp-line';
    const keyTermBadge = document.createElement('div');
    keyTermBadge.className = 'sir-key-term-badge';
    keyTermBadge.style.display = 'none';
    keyTermBadge.textContent = 'Key Term';
    const wordBox = document.createElement('div');
    wordBox.className = 'sir-word-box';
    const spanBefore = document.createElement('span');
    spanBefore.className = 'before';
    const spanFocal = document.createElement('span');
    spanFocal.className = 'focal';
    const spanAfter = document.createElement('span');
    spanAfter.className = 'after';
    wordBox.appendChild(spanBefore);
    wordBox.appendChild(spanFocal);
    wordBox.appendChild(spanAfter);
    wordInner.appendChild(orpLine);
    wordInner.appendChild(keyTermBadge);
    wordInner.appendChild(wordBox);
    wordArea.appendChild(wordInner);

    // Playback
    const playback = document.createElement('div');
    playback.className = 'sir-playback';
    const progressWrap = document.createElement('div');
    progressWrap.className = 'sir-progress-wrap';
    const progressBar = document.createElement('input');
    progressBar.type = 'range';
    progressBar.className = 'sir-progress-bar';
    progressBar.min = 0;
    progressBar.max = 100;
    progressBar.step = 0.1;
    progressBar.value = 0;
    const progressLabels = document.createElement('div');
    progressLabels.className = 'sir-progress-labels';
    const progressLabelsSpan = document.createElement('span');
    const progressPct = document.createElement('span');
    progressLabels.appendChild(progressLabelsSpan);
    progressLabels.appendChild(progressPct);
    progressWrap.appendChild(progressBar);
    progressWrap.appendChild(progressLabels);

    const buttons = document.createElement('div');
    buttons.className = 'sir-buttons';
    const btnBack = document.createElement('button');
    btnBack.type = 'button';
    btnBack.className = 'sir-btn-icon sir-skip-back';
    btnBack.innerHTML = '⏪';
    btnBack.title = 'Skip backward';
    const btnPlay = document.createElement('button');
    btnPlay.type = 'button';
    btnPlay.className = 'sir-btn-icon sir-btn-play sir-play-pause';
    btnPlay.innerHTML = '▶';
    btnPlay.title = 'Play';
    const btnFwd = document.createElement('button');
    btnFwd.type = 'button';
    btnFwd.className = 'sir-btn-icon sir-skip-fwd';
    btnFwd.innerHTML = '⏩';
    btnFwd.title = 'Skip forward';
    const btnStop = document.createElement('button');
    btnStop.type = 'button';
    btnStop.className = 'sir-btn-icon sir-stop';
    btnStop.innerHTML = '⏹';
    btnStop.title = 'Restart';
    buttons.appendChild(btnBack);
    buttons.appendChild(btnPlay);
    buttons.appendChild(btnFwd);
    buttons.appendChild(btnStop);
    playback.appendChild(progressWrap);
    playback.appendChild(buttons);

    root.appendChild(controlBar);
    root.appendChild(wordArea);
    root.appendChild(playback);
    document.body.appendChild(root);

    // --- Update UI from state ---
    function getDisplayWords() {
      const { words: w, currentIndex: i, settings: s } = state;
      return w.slice(i, i + s.wordsAtATime).join(' ');
    }

    function updateWordDisplay() {
      const word = getDisplayWords();
      if (!word) {
        wordBox.classList.remove('sir-key-term');
        keyTermBadge.style.display = 'none';
        spanBefore.textContent = '';
        spanFocal.textContent = '';
        spanAfter.textContent = '';
        wordBox.style.fontSize = state.settings.fontSize + 'px';
        const ready = wordInner.querySelector('.sir-ready-msg') || document.createElement('span');
        ready.className = 'sir-ready-msg';
        ready.textContent = 'Ready to read';
        if (!ready.parentNode) wordInner.appendChild(ready);
        return;
      }
      const ready = wordInner.querySelector('.sir-ready-msg');
      if (ready) ready.remove();
      const { before, focal, after } = splitORP(word);
      spanBefore.textContent = before;
      spanFocal.textContent = focal;
      spanAfter.textContent = after;
      wordBox.style.fontSize = state.settings.fontSize + 'px';
      keyTermBadge.style.display = 'none';
      wordBox.classList.remove('sir-key-term');
    }

    function updateTimeAndProgress() {
      const { words: w, currentIndex: i, settings: s } = state;
      const remaining = Math.max(0, w.length - i);
      const secs = (remaining / s.wpm) * 60;
      timeLeftEl.textContent = formatTime(secs);
      const pct = w.length ? (i / w.length) * 100 : 0;
      progressBar.value = pct;
      progressLabelsSpan.textContent = i + ' / ' + w.length + ' words';
      progressPct.textContent = Math.round(pct) + '%';
    }

    function updateControls() {
      wpmValueEl.textContent = state.settings.wpm;
      wpmSlider.value = state.settings.wpm;
      wordsValueEl.textContent = state.settings.wordsAtATime;
      fontValueEl.textContent = state.settings.fontSize;
      btnPlay.innerHTML = state.isPlaying ? '⏸' : '▶';
      btnPlay.title = state.isPlaying ? 'Pause' : 'Play';
      smartPacerBtn.classList.toggle('sir-smart-pacer-active', state.smartPacerEnabled);
      smartPacerBtn.classList.toggle('sir-smart-pacer-loading', state.smartPacerLoading);
      smartPacerBtn.disabled = state.smartPacerLoading;
    }

    async function fetchSmartPacing(silent) {
      if (state.smartPacerLoading) return;
      state.smartPacerLoading = true;
      state.pacingData = null;
      updateControls();
      if (!silent) showToast('Analyzing text for smart pacing...');
      try {
        const text = state.words.join(' ');
        const res = await fetch(SUPABASE_URL + '/functions/v1/smart-pacer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            text,
            user_wpm: state.settings.wpm,
            industry: state.industry || null,
            comprehension: state.comprehension,
            goal: state.goal,
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        if (data.result && Array.isArray(data.result) && data.result.length > 0) {
          state.pacingData = data.result;
          state.smartPacerEnabled = true;
          if (!silent) showToast('Smart pacing enabled');
        } else {
          throw new Error('No pacing data returned');
        }
      } catch (err) {
        state.smartPacerEnabled = false;
        state.pacingData = null;
        showToast(err instanceof Error ? err.message : 'Smart pacing failed');
      } finally {
        state.smartPacerLoading = false;
        updateControls();
      }
    }

    function toggleSmartPacer() {
      if (state.smartPacerEnabled) {
        state.smartPacerEnabled = false;
        state.pacingData = null;
        showToast('Smart pacing off');
        chrome.storage.sync.get(['rsvpSettings'], (result) => {
          const s = result.rsvpSettings || {};
          s.smartPacerDefault = false;
          chrome.storage.sync.set({ rsvpSettings: s });
        });
      } else {
        state.smartPacerEnabled = true;
        fetchSmartPacing(false);
        chrome.storage.sync.get(['rsvpSettings'], (result) => {
          const s = result.rsvpSettings || {};
          s.smartPacerDefault = true;
          chrome.storage.sync.set({ rsvpSettings: s });
        });
      }
      updateControls();
    }

    // --- RSVP logic ---
    function stop() {
      if (state.timerId) {
        clearTimeout(state.timerId);
        state.timerId = null;
      }
      state.isPlaying = false;
      state.currentIndex = 0;
      updateWordDisplay();
      updateTimeAndProgress();
      updateControls();
    }

    function scheduleNext() {
      if (state.timerId) clearTimeout(state.timerId);
      const { words: w, currentIndex: i, settings: s } = state;
      if (i >= w.length) {
        state.isPlaying = false;
        updateControls();
        return;
      }
      const displayWords = w.slice(i, i + s.wordsAtATime).join(' ');
      const baseDelay = (60 / s.wpm) * 1000 * s.wordsAtATime;
      let aiMultiplier = null;
      if (state.pacingData && state.pacingData[i]) {
        aiMultiplier = state.pacingData[i].multiplier;
      }
      const delay = calculateWordDelay(displayWords, baseDelay, aiMultiplier);

      state.timerId = setTimeout(() => {
        state.currentIndex = Math.min(i + s.wordsAtATime, w.length);
        updateWordDisplay();
        updateTimeAndProgress();
        if (state.currentIndex < w.length) {
          scheduleNext();
        } else {
          state.isPlaying = false;
          updateControls();
        }
      }, delay);
    }

    function play() {
      if (state.words.length === 0) return;
      if (state.currentIndex >= state.words.length) {
        state.currentIndex = 0;
        updateWordDisplay();
        updateTimeAndProgress();
      }
      state.isPlaying = true;
      updateControls();
      scheduleNext();
    }

    function pause() {
      if (state.timerId) {
        clearTimeout(state.timerId);
        state.timerId = null;
      }
      state.isPlaying = false;
      updateControls();
    }

    function togglePlay() {
      if (state.isPlaying) pause();
      else play();
    }

    function skip(forward) {
      const skipSize = Math.max(10, Math.floor(state.words.length * 0.05));
      if (forward) {
        state.currentIndex = Math.min(state.currentIndex + skipSize, state.words.length - 1);
      } else {
        state.currentIndex = Math.max(state.currentIndex - skipSize, 0);
      }
      updateWordDisplay();
      updateTimeAndProgress();
      if (state.isPlaying) {
        if (state.timerId) clearTimeout(state.timerId);
        scheduleNext();
      }
    }

    function setWPM(v) {
      state.settings.wpm = Math.max(50, Math.min(1200, v));
      updateControls();
      chrome.storage.sync.get(['rsvpSettings'], (result) => {
        const settings = result.rsvpSettings || {};
        settings.wpm = state.settings.wpm;
        chrome.storage.sync.set({ rsvpSettings: settings });
      });
    }

    function setWords(v) {
      state.settings.wordsAtATime = Math.max(1, Math.min(5, v));
      updateControls();
    }

    function setFont(v) {
      state.settings.fontSize = Math.max(24, Math.min(96, v));
      updateControls();
      updateWordDisplay();
    }

    function seek(pct) {
      const idx = Math.floor((pct / 100) * state.words.length);
      state.currentIndex = Math.max(0, Math.min(idx, state.words.length - 1));
      updateWordDisplay();
      updateTimeAndProgress();
      if (state.isPlaying) {
        if (state.timerId) clearTimeout(state.timerId);
        scheduleNext();
      }
    }

    // --- Event listeners ---
    wpmWrap.querySelector('.sir-wpm-down').addEventListener('click', () => setWPM(state.settings.wpm - 25));
    wpmWrap.querySelector('.sir-wpm-up').addEventListener('click', () => setWPM(state.settings.wpm + 25));
    wpmSlider.addEventListener('input', () => setWPM(Number(wpmSlider.value)));

    wordsWrap.querySelector('.sir-words-down').addEventListener('click', () => setWords(state.settings.wordsAtATime - 1));
    wordsWrap.querySelector('.sir-words-up').addEventListener('click', () => setWords(state.settings.wordsAtATime + 1));

    fontWrap.querySelector('.sir-font-down').addEventListener('click', () => setFont(state.settings.fontSize - 4));
    fontWrap.querySelector('.sir-font-up').addEventListener('click', () => setFont(state.settings.fontSize + 4));

    smartPacerBtn.addEventListener('click', toggleSmartPacer);

    const industrySelect = settingsPopover.querySelector('.sir-settings-industry');
    const comprehensionSelect = settingsPopover.querySelector('.sir-settings-comprehension');
    const goalSelect = settingsPopover.querySelector('.sir-settings-goal');
    industrySelect.value = state.industry || '';
    comprehensionSelect.value = state.comprehension;
    goalSelect.value = state.goal;

    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      settingsPopover.classList.toggle('sir-hidden');
    });
    document.addEventListener('click', (e) => {
      if (!settingsWrap.contains(e.target)) settingsPopover.classList.add('sir-hidden');
    });

    function persistSmartPacerOpts() {
      chrome.storage.sync.get(['rsvpSettings'], (result) => {
        const s = result.rsvpSettings || {};
        s.industry = state.industry;
        s.comprehension = state.comprehension;
        s.goal = state.goal;
        chrome.storage.sync.set({ rsvpSettings: s });
      });
    }

    industrySelect.addEventListener('change', () => {
      state.industry = industrySelect.value || null;
      persistSmartPacerOpts();
      if (state.smartPacerEnabled) fetchSmartPacing(false);
    });
    comprehensionSelect.addEventListener('change', () => {
      state.comprehension = comprehensionSelect.value;
      persistSmartPacerOpts();
      if (state.smartPacerEnabled) fetchSmartPacing(false);
    });
    goalSelect.addEventListener('change', () => {
      state.goal = goalSelect.value;
      persistSmartPacerOpts();
      if (state.smartPacerEnabled) fetchSmartPacing(false);
    });

    btnPlay.addEventListener('click', togglePlay);
    btnBack.addEventListener('click', () => skip(false));
    btnFwd.addEventListener('click', () => skip(true));
    btnStop.addEventListener('click', stop);

    progressBar.addEventListener('input', () => seek(Number(progressBar.value)));

    function onKeyDown(e) {
      if (!document.getElementById(OVERLAY_ID)) return;
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skip(false);
          break;
        case 'ArrowRight':
          e.preventDefault();
          skip(true);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setWPM(state.settings.wpm + 25);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setWPM(state.settings.wpm - 25);
          break;
        case 'Escape':
          e.preventDefault();
          stop();
          closeOverlay();
          break;
        case 'KeyR':
          if (e.metaKey || e.ctrlKey) return;
          e.preventDefault();
          stop();
          break;
      }
    }
    keydownHandler = onKeyDown;
    document.addEventListener('keydown', keydownHandler);

    // Initial render
    updateWordDisplay();
    updateTimeAndProgress();
    updateControls();

    // Fire Smart Pacer request immediately when enabled by default (no user click)
    if (state.smartPacerEnabled) {
      fetchSmartPacing(true);
    }
  }

  function getSelectedText() {
    return (window.getSelection && window.getSelection().toString().trim()) || '';
  }

  function openReaderWithText(text) {
    if (!text) {
      showToast('Select some text first, then try again.');
      return false;
    }
    createOverlay(text);
    return true;
  }

  function togglePlay() {
    const root = document.getElementById(OVERLAY_ID);
    if (!root) return;
    const btn = root.querySelector('.sir-play-pause');
    if (btn) btn.click();
  }

  function toggleReader() {
    const root = document.getElementById(OVERLAY_ID);
    if (root) {
      closeOverlay();
    } else {
      const selection = getSelectedText();
      openReaderWithText(selection);
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    switch (message.action) {
      case 'openReader': {
        const selection = getSelectedText();
        sendResponse({ ok: openReaderWithText(selection) });
        break;
      }
      case 'startReader': {
        if (message.text) {
          openReaderWithText(message.text);
          sendResponse({ ok: true });
        } else {
          const selection = getSelectedText();
          sendResponse({ ok: openReaderWithText(selection) });
        }
        break;
      }
      case 'toggleReader':
        toggleReader();
        sendResponse({ ok: true });
        break;
      case 'getSelection':
        sendResponse({ text: getSelectedText() });
        break;
      case 'togglePlay':
        togglePlay();
        sendResponse({ ok: true });
        break;
    }
  });
})();
