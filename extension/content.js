/**
 * Swift Insight Reader - Content Script
 * Listens for openReader; gets selection, injects overlay, runs RSVP with ORP highlight and adaptive pacing.
 */

(function () {
  const OVERLAY_ID = 'swift-insight-reader-root';

  /** Clean text before display and LLM: normalize whitespace, remove invisible chars, strip emojis. */
  function cleanText(text) {
    if (typeof text !== 'string') return '';
    let t = text
      .replace(/\r\n|\r/g, '\n')
      .replace(/[\t\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
      .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
      .replace(/\p{Extended_Pictographic}/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
    return t;
  }
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
      if (target.length <= 2) {
        return { before: word, focal: '', after: '' };
      }
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
  let overlayCleanup = null;

  function closeOverlay() {
    if (keydownHandler) {
      document.removeEventListener('keydown', keydownHandler);
      keydownHandler = null;
    }
    if (overlayCleanup) {
      overlayCleanup();
      overlayCleanup = null;
    }
    const root = document.getElementById(OVERLAY_ID);
    if (root) root.remove();
  }

  function createOverlay(text, summarizeFirst = false) {
    if (document.getElementById(OVERLAY_ID)) {
      closeOverlay();
    }

    const cleaned = cleanText(text);
    const words = cleaned.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) {
      showToast('No text to read.');
      return;
    }

    // Load saved settings from storage
    const defaultSettings = { wpm: 300, wordsAtATime: 1, fontSize: 48, showContext: false };
    const smartPacerOpts = { comprehension: 'normal', goal: 'maintain' };
    let translucentOverlay = false;
    chrome.storage.sync.get(['rsvpSettings'], (result) => {
      const stored = result.rsvpSettings || {};
      if (stored.wpm) defaultSettings.wpm = Math.max(50, Math.min(1200, stored.wpm));
      if (stored.comprehension) smartPacerOpts.comprehension = stored.comprehension;
      if (stored.goal) smartPacerOpts.goal = stored.goal;
      if (typeof stored.showContext === 'boolean') defaultSettings.showContext = stored.showContext;
      if (typeof stored.translucentOverlay === 'boolean') translucentOverlay = stored.translucentOverlay;
      const smartPacerOn = stored.smartPacerDefault !== false;
      createOverlayWithSettings(words, defaultSettings, smartPacerOn, smartPacerOpts, {
        originalText: text,
        summarizeFirst,
        translucentOverlay,
      });
    });
  }

  function createOverlayWithSettings(words, defaultSettings, smartPacerOnByDefault, smartPacerOpts, summaryOpts) {
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
      translucentOverlay: summaryOpts.translucentOverlay === true,
      readStartTime: null,
      readElapsedSeconds: null,
      comprehension: smartPacerOpts.comprehension,
      goal: smartPacerOpts.goal,
      originalText: summaryOpts.originalText,
      summaryText: null,
      summaryLoading: false,
      summarizeOnOpen: summaryOpts.summarizeFirst,
    };

    const root = document.createElement('div');
    root.id = OVERLAY_ID;
    if (state.translucentOverlay) root.classList.add('sir-translucent');

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

    const iconTranslucent = '<svg class="sir-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="10" height="10" rx="1" opacity="0.8"/><rect x="10" y="10" width="10" height="10" rx="1"/></svg>';
    const iconOpaque = '<svg class="sir-icon" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>';
    const iconContext = '<svg class="sir-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>';
    const iconSmart = '<svg class="sir-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/></svg>';
    const iconGear = '<svg class="sir-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
    const iconSkipBack = '<svg class="sir-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 19 2 12 11 5 11 19"/><polygon points="22 19 13 12 22 5 22 19"/></svg>';
    const iconPlay = '<svg class="sir-icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
    const iconPause = '<svg class="sir-icon" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
    const iconSkipFwd = '<svg class="sir-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 19 22 12 13 5 13 19"/><polygon points="2 19 11 12 2 5 2 19"/></svg>';
    const iconStop = '<svg class="sir-icon" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12"/></svg>';

    const translucentBtn = document.createElement('button');
    translucentBtn.type = 'button';
    translucentBtn.className = 'sir-translucent-btn';
    translucentBtn.title = 'Toggle overlay transparency';
    translucentBtn.innerHTML = state.translucentOverlay ? iconOpaque : iconTranslucent;

    const summaryBtn = document.createElement('button');
    summaryBtn.type = 'button';
    summaryBtn.className = 'sir-summary-btn';
    summaryBtn.title = 'Summarize text before reading';
    summaryBtn.innerHTML = '<span class="sir-summary-icon">✨</span>';

    const contextBtn = document.createElement('button');
    contextBtn.type = 'button';
    contextBtn.className = 'sir-context-btn';
    contextBtn.title = 'Show surrounding text context';
    contextBtn.innerHTML = '<span class="sir-context-icon">' + iconContext + '</span>';

    const smartPacerBtn = document.createElement('button');
    smartPacerBtn.type = 'button';
    smartPacerBtn.className = 'sir-smart-pacer-btn';
    smartPacerBtn.title = 'AI Smart Pacer: analyze text for adaptive pacing';
    smartPacerBtn.innerHTML = '<span class="sir-smart-pacer-icon"><span class="sir-smart-icon-svg">' + iconSmart + '</span><span class="sir-smart-spinner"></span></span>';

    const settingsBtn = document.createElement('button');
    settingsBtn.type = 'button';
    settingsBtn.className = 'sir-settings-btn';
    settingsBtn.title = 'Smart Pacer settings';
    settingsBtn.innerHTML = iconGear;
    const settingsPopover = document.createElement('div');
    settingsPopover.className = 'sir-settings-popover sir-hidden';
    settingsPopover.innerHTML = `
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

    const rightGroup = document.createElement('div');
    rightGroup.className = 'sir-control-right';
    rightGroup.appendChild(translucentBtn);
    rightGroup.appendChild(summaryBtn);
    rightGroup.appendChild(contextBtn);
    rightGroup.appendChild(smartPacerBtn);
    rightGroup.appendChild(settingsWrap);
    rightGroup.appendChild(closeBtn);

    controlBar.appendChild(controlGroup);
    controlBar.appendChild(rightGroup);

    // Word area
    const wordArea = document.createElement('div');
    wordArea.className = 'sir-word-area';
    const contextBefore = document.createElement('div');
    contextBefore.className = 'sir-context-before';
    const contextAfter = document.createElement('div');
    contextAfter.className = 'sir-context-after';
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
    spanBefore.className = 'sir-orp-before';
    const spanFocal = document.createElement('span');
    spanFocal.className = 'sir-orp-focal';
    const spanAfter = document.createElement('span');
    spanAfter.className = 'sir-orp-after';
    wordBox.appendChild(spanBefore);
    wordBox.appendChild(spanFocal);
    wordBox.appendChild(spanAfter);
    wordInner.appendChild(orpLine);
    wordInner.appendChild(keyTermBadge);
    wordInner.appendChild(wordBox);
    wordArea.appendChild(contextBefore);
    wordArea.appendChild(wordInner);
    wordArea.appendChild(contextAfter);

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
    btnBack.innerHTML = iconSkipBack;
    btnBack.title = 'Skip backward';
    const btnPlay = document.createElement('button');
    btnPlay.type = 'button';
    btnPlay.className = 'sir-btn-icon sir-btn-play sir-play-pause';
    btnPlay.innerHTML = iconPlay;
    btnPlay.title = 'Play';
    const btnFwd = document.createElement('button');
    btnFwd.type = 'button';
    btnFwd.className = 'sir-btn-icon sir-skip-fwd';
    btnFwd.innerHTML = iconSkipFwd;
    btnFwd.title = 'Skip forward';
    const btnStop = document.createElement('button');
    btnStop.type = 'button';
    btnStop.className = 'sir-btn-icon sir-stop';
    btnStop.innerHTML = iconStop;
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
    function getDisplayUnits() {
      if (state.pacingData && state.pacingData.length > 0) {
        return state.pacingData.map((x) => ({
          chunk: String(x && (x.chunk != null ? x.chunk : x.word != null ? x.word : '')).trim(),
          multiplier: x && typeof x.multiplier === 'number' ? x.multiplier : null,
        }));
      }
      return state.words.map((w) => ({ chunk: w, multiplier: null }));
    }

    function getDisplayChunk() {
      const units = getDisplayUnits();
      const i = state.currentIndex;
      const s = state.settings;
      if (state.pacingData && state.pacingData.length > 0) {
        return units[i]?.chunk ?? '';
      }
      return state.words.slice(i, i + s.wordsAtATime).join(' ');
    }

    function getUnitWordCount(unit) {
      const chunk = unit && (unit.chunk != null ? unit.chunk : unit.word);
      return (chunk != null ? String(chunk) : '').trim().split(/\s+/).filter(Boolean).length || 1;
    }

    function endsSentence(text) {
      return /[.!?]$/.test(text) || /^[.!?]+$/.test(text);
    }

    function getSentenceRanges(units) {
      const ranges = [];
      let start = 0;
      for (let j = 0; j < units.length; j++) {
        const u = units[j];
        const chunk = u && (u.chunk != null ? u.chunk : u.word);
        if (chunk != null && endsSentence(String(chunk))) {
          ranges.push({ start, end: j + 1 });
          start = j + 1;
        }
      }
      if (start < units.length) ranges.push({ start, end: units.length });
      return ranges;
    }

    function updateWordDisplay() {
      const units = getDisplayUnits();
      const chunk = getDisplayChunk();
      const { currentIndex: i, settings: s } = state;
      const advance = (state.pacingData?.length) ? 1 : s.wordsAtATime;

      const isFinished = i >= units.length && units.length > 0;
      if (isFinished) {
        contextBefore.textContent = '';
        contextAfter.textContent = '';
        wordArea.classList.remove('sir-show-context');
      } else {
        wordArea.classList.toggle('sir-show-context', s.showContext);
        if (s.showContext) {
          const ranges = getSentenceRanges(units);

          // Top: words read in current sentence so far (add word by word)
          let beforeStart = 0;
          for (const r of ranges) {
            if (i >= r.start && i < r.end) {
              beforeStart = r.start;
              break;
            }
          }
          contextBefore.textContent = units.slice(beforeStart, i).map((u) => (u && u.chunk != null ? u.chunk : '')).join(' ');
          contextBefore.scrollTop = contextBefore.scrollHeight;

          // Bottom: rest of current sentence + next full sentence
          const readEnd = i + advance;
          let currEnd = units.length;
          let nextStart = units.length;
          let nextEnd = units.length;
          for (let ri = 0; ri < ranges.length; ri++) {
            const r = ranges[ri];
            if (i < r.end) {
              currEnd = r.end;
              const next = ranges[ri + 1];
              if (next) {
                nextStart = next.start;
                nextEnd = next.end;
              }
              break;
            }
          }
          const afterRest = units.slice(readEnd, currEnd).map((u) => (u && u.chunk != null ? u.chunk : '')).join(' ');
          const afterNext = units.slice(nextStart, nextEnd).map((u) => (u && u.chunk != null ? u.chunk : '')).join(' ');
          contextAfter.textContent = afterRest + (afterRest && afterNext ? ' ' : '') + afterNext;
        } else {
          contextBefore.textContent = '';
          contextAfter.textContent = '';
        }
      }

      if (!chunk) {
        wordBox.classList.remove('sir-key-term');
        keyTermBadge.style.display = 'none';
        spanBefore.textContent = '';
        spanFocal.textContent = '';
        spanAfter.textContent = '';
        wordBox.style.fontSize = state.settings.fontSize + 'px';
        const ready = wordInner.querySelector('.sir-ready-msg') || document.createElement('span');
        ready.className = 'sir-ready-msg';
        if (isFinished && state.readElapsedSeconds != null) {
          const totalWords = units.reduce((sum, u) => sum + getUnitWordCount(u), 0);
          ready.textContent = 'You read ' + totalWords + ' words in ' + state.readElapsedSeconds + ' seconds!';
        } else {
          ready.textContent = 'Ready to read';
        }
        if (!ready.parentNode) wordInner.appendChild(ready);
        return;
      }
      const ready = wordInner.querySelector('.sir-ready-msg');
      if (ready) ready.remove();
      const { before, focal, after } = splitORP(chunk);
      spanBefore.textContent = before;
      spanFocal.textContent = focal;
      spanAfter.textContent = after;
      wordBox.style.fontSize = state.settings.fontSize + 'px';
      keyTermBadge.style.display = 'none';
      wordBox.classList.remove('sir-key-term');
    }

    function getRecoveryMultiplier() {
      return 1;
    }

    function updateTimeAndProgress() {
      const units = getDisplayUnits();
      const { currentIndex: i, settings: s } = state;
      const remainingUnits = Math.max(0, units.length - i);
      const remainingWords = units.slice(i).reduce((sum, u) => sum + getUnitWordCount(u), 0);
      const secs = (remainingWords / s.wpm) * 60;
      timeLeftEl.textContent = formatTime(secs);
      const pct = units.length ? (i / units.length) * 100 : 0;
      progressBar.value = pct;
      progressLabelsSpan.textContent = i + ' / ' + units.length + (state.pacingData?.length ? ' chunks' : ' words');
      progressPct.textContent = Math.round(pct) + '%';
    }

    function updateControls() {
      wpmValueEl.textContent = state.settings.wpm;
      wpmSlider.value = state.settings.wpm;
      wordsValueEl.textContent = state.settings.wordsAtATime;
      fontValueEl.textContent = state.settings.fontSize;
      btnPlay.innerHTML = state.isPlaying ? iconPause : iconPlay;
      btnPlay.title = state.isPlaying ? 'Pause' : 'Play';
      summaryBtn.classList.toggle('sir-summary-active', Boolean(state.summaryText));
      summaryBtn.classList.toggle('sir-summary-loading', state.summaryLoading);
      summaryBtn.disabled = state.summaryLoading;
      contextBtn.classList.toggle('sir-context-active', state.settings.showContext);
      smartPacerBtn.classList.toggle('sir-smart-pacer-active', state.smartPacerEnabled);
      smartPacerBtn.classList.toggle('sir-smart-pacer-loading', state.smartPacerLoading);
      smartPacerBtn.disabled = state.smartPacerLoading;
      wordsWrap.classList.toggle('sir-words-locked', state.smartPacerEnabled);
      wordsWrap.title = state.smartPacerEnabled ? 'Words locked when Smart Pacer is on' : '';
    }

    function applyTextUpdate(nextText, isSummary) {
      const nextWords = cleanText(nextText).split(/\s+/).filter(w => w.length > 0);
      if (nextWords.length === 0) {
        showToast('Summary returned no text.');
        return false;
      }
      if (state.timerId) {
        clearTimeout(state.timerId);
        state.timerId = null;
      }
      state.isPlaying = false;
      state.words = nextWords;
      state.currentIndex = 0;
      state.pacingData = null;
      state.summaryText = isSummary ? nextText : null;
      updateWordDisplay();
      updateTimeAndProgress();
      updateControls();
      if (state.smartPacerEnabled) {
        fetchSmartPacing(true);
      }
      return true;
    }

    async function fetchSummary(silent) {
      if (state.summaryLoading) return;
      state.summaryLoading = true;
      updateControls();
      if (!silent) showToast('Summarizing text...');
      try {
        const res = await fetch(SUPABASE_URL + '/functions/v1/smart-summary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            text: state.originalText,
            summary_length: 'brief',
            industry: null,
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        const summary = typeof data.result === 'string' ? data.result.trim() : '';
        if (!summary) throw new Error('Summary was empty.');
        applyTextUpdate(summary, true);
        if (!silent) showToast('Summary ready');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Summary failed');
      } finally {
        state.summaryLoading = false;
        updateControls();
      }
    }

    async function fetchSmartPacing(silent) {
      if (state.smartPacerLoading) return;
      state.smartPacerLoading = true;
      state.pacingData = null;
      updateControls();
      try {
        const res = await fetch(SUPABASE_URL + '/functions/v1/smart-pacer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            text: state.words.join(' '),
            user_wpm: state.settings.wpm,
            comprehension: state.comprehension,
            goal: state.goal,
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        if (!data.result || !Array.isArray(data.result) || data.result.length === 0) {
          throw new Error('No pacing data returned');
        }
        state.pacingData = data.result;
        state.smartPacerEnabled = true;
        updateWordDisplay();
        updateTimeAndProgress();
      } catch (err) {
        state.smartPacerEnabled = false;
        state.pacingData = null;
        showToast(err instanceof Error ? err.message : 'Smart pacing failed');
      } finally {
        state.smartPacerLoading = false;
        updateControls();
        updateTimeAndProgress();
      }
    }

    function toggleSmartPacer() {
      if (state.smartPacerEnabled) {
        state.smartPacerEnabled = false;
        chrome.storage.sync.get(['rsvpSettings'], (result) => {
          const s = result.rsvpSettings || {};
          s.smartPacerDefault = false;
          chrome.storage.sync.set({ rsvpSettings: s });
        });
      } else {
        state.smartPacerEnabled = true;
        if (!state.pacingData || state.pacingData.length === 0) {
          fetchSmartPacing(false);
        }
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
      state.readStartTime = null;
      state.readElapsedSeconds = null;
      updateWordDisplay();
      updateTimeAndProgress();
      updateControls();
    }

    function scheduleNext() {
      if (state.timerId) clearTimeout(state.timerId);
      const units = getDisplayUnits();
      const { currentIndex: i, settings: s } = state;
      if (i >= units.length) {
        state.isPlaying = false;
        updateControls();
        return;
      }
      const advance = (state.pacingData?.length) ? 1 : s.wordsAtATime;
      const unit = units[i];
      const displayChunk = (state.pacingData?.length) ? unit.chunk : state.words.slice(i, i + advance).join(' ');
      const wordCount = (state.pacingData?.length) ? getUnitWordCount(unit) : advance;
      const baseDelayPerWord = (60 / s.wpm) * 1000;
      const baseDelay = baseDelayPerWord * wordCount;
      const aiMultiplier = unit.multiplier;
      const delay = calculateWordDelay(displayChunk, baseDelay, aiMultiplier) * getRecoveryMultiplier();

      state.timerId = setTimeout(() => {
        state.currentIndex = Math.min(i + advance, units.length);
        if (state.recoveryRemaining > 0) {
          state.recoveryRemaining -= 1;
        }
        if (state.currentIndex >= units.length && state.readStartTime) {
          state.readElapsedSeconds = Math.round((Date.now() - state.readStartTime) / 1000);
        }
        updateWordDisplay();
        updateTimeAndProgress();
        if (state.currentIndex < units.length) {
          scheduleNext();
        } else {
          state.isPlaying = false;
          updateControls();
        }
      }, delay);
    }

    function play() {
      const units = getDisplayUnits();
      if (units.length === 0) return;
      if (state.currentIndex >= units.length) {
        state.currentIndex = 0;
        state.readElapsedSeconds = null;
        updateWordDisplay();
        updateTimeAndProgress();
      }
      if (state.currentIndex === 0) state.readStartTime = Date.now();
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
      const units = getDisplayUnits();
      const skipSize = Math.max(10, Math.floor(units.length * 0.05));
      if (forward) {
        state.currentIndex = Math.min(state.currentIndex + skipSize, units.length - 1);
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
      const units = getDisplayUnits();
      const idx = Math.floor((pct / 100) * units.length);
      state.currentIndex = Math.max(0, Math.min(idx, units.length - 1));
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

    translucentBtn.addEventListener('click', () => {
      state.translucentOverlay = !state.translucentOverlay;
      root.classList.toggle('sir-translucent', state.translucentOverlay);
      translucentBtn.innerHTML = state.translucentOverlay ? iconOpaque : iconTranslucent;
      translucentBtn.title = state.translucentOverlay ? 'Switch to opaque overlay' : 'Switch to translucent overlay';
      chrome.storage.sync.get(['rsvpSettings'], (result) => {
        const s = result.rsvpSettings || {};
        s.translucentOverlay = state.translucentOverlay;
        chrome.storage.sync.set({ rsvpSettings: s });
      });
    });

    summaryBtn.addEventListener('click', () => fetchSummary(false));

    contextBtn.addEventListener('click', () => {
      state.settings.showContext = !state.settings.showContext;
      updateWordDisplay();
      updateControls();
      chrome.storage.sync.get(['rsvpSettings'], (result) => {
        const settings = result.rsvpSettings || {};
        settings.showContext = state.settings.showContext;
        chrome.storage.sync.set({ rsvpSettings: settings });
      });
    });

    smartPacerBtn.addEventListener('click', toggleSmartPacer);

    const comprehensionSelect = settingsPopover.querySelector('.sir-settings-comprehension');
    const goalSelect = settingsPopover.querySelector('.sir-settings-goal');
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
        s.comprehension = state.comprehension;
        s.goal = state.goal;
        chrome.storage.sync.set({ rsvpSettings: s });
      });
    }

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
    if (state.smartPacerEnabled && !state.summarizeOnOpen) {
      fetchSmartPacing(true);
    }

    if (state.summarizeOnOpen) {
      fetchSummary(true);
    }
  }

  function getSelectedText() {
    return (window.getSelection && window.getSelection().toString().trim()) || '';
  }

  function openReaderWithText(text, summarizeFirst = false) {
    if (!text) {
      showToast('Select some text first, then try again.');
      return false;
    }
    createOverlay(text, summarizeFirst);
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
          openReaderWithText(message.text, Boolean(message.summarize));
          sendResponse({ ok: true });
        } else {
          const selection = getSelectedText();
          sendResponse({ ok: openReaderWithText(selection, Boolean(message.summarize)) });
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
