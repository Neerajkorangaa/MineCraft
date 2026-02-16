/* =============================================
   LIVE SUBTITLE TRANSLATOR — YouTube Content Script
   Captures YouTube captions and translates them
   in real-time to the target language.
   ============================================= */

(function () {
  'use strict';

  // ---- State ----
  let isActive = false;
  let targetLang = 'en';
  let subtitleSize = 'medium';
  let showOriginal = true;
  let translationCache = {};
  let overlay = null;
  let statusBadge = null;
  let observer = null;
  let lastCaptionText = '';
  let debounceTimer = null;

  // ---- Translation API (Free) ----
  async function translateText(text, sourceLang = 'auto', targetLang = 'en') {
    if (!text || text.trim().length === 0) return '';

    // Check cache
    const cacheKey = `${text}|${targetLang}`;
    if (translationCache[cacheKey]) return translationCache[cacheKey];

    try {
      // Method 1: Google Translate (free endpoint)
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data && data[0]) {
        let translated = '';
        for (let i = 0; i < data[0].length; i++) {
          if (data[0][i][0]) translated += data[0][i][0];
        }
        // Cache result
        translationCache[cacheKey] = translated;
        // Keep cache manageable
        const keys = Object.keys(translationCache);
        if (keys.length > 500) {
          for (let i = 0; i < 100; i++) delete translationCache[keys[i]];
        }
        return translated;
      }
    } catch (err) {
      console.warn('[LST] Translation error:', err.message);
      try {
        // Method 2: Fallback to MyMemory API
        const url2 = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`;
        const response2 = await fetch(url2);
        const data2 = await response2.json();
        if (data2 && data2.responseData) {
          const translated = data2.responseData.translatedText;
          translationCache[cacheKey] = translated;
          return translated;
        }
      } catch (err2) {
        console.warn('[LST] Fallback translation error:', err2.message);
      }
    }
    return text; // Return original if all fails
  }

  // ---- UI Elements ----
  function createOverlay() {
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.className = 'lst-subtitle-overlay';
    overlay.id = 'lst-overlay';
    overlay.innerHTML = `
      <span class="lst-subtitle-text size-${subtitleSize}" id="lst-text"></span>
    `;
    document.body.appendChild(overlay);

    statusBadge = document.createElement('div');
    statusBadge.className = 'lst-status-badge';
    statusBadge.id = 'lst-status';
    document.body.appendChild(statusBadge);
  }

  function removeOverlay() {
    if (overlay) { overlay.remove(); overlay = null; }
    if (statusBadge) { statusBadge.remove(); statusBadge = null; }
  }

  function showStatus(msg, type = 'active') {
    if (!statusBadge) return;
    statusBadge.textContent = msg;
    statusBadge.className = 'lst-status-badge ' + type;
    // Auto-hide after animation
    if (type === 'active') {
      setTimeout(() => { statusBadge.className = 'lst-status-badge'; }, 3000);
    }
  }

  function updateSubtitle(translatedText, originalText) {
    if (!overlay) return;
    const textEl = document.getElementById('lst-text');
    if (!textEl) return;

    if (!translatedText || translatedText.trim() === '') {
      overlay.style.opacity = '0';
      return;
    }

    let html = translatedText;
    if (showOriginal && originalText && originalText !== translatedText) {
      html += `<span class="lst-original-text">${originalText}</span>`;
    }

    textEl.innerHTML = html;
    textEl.className = `lst-subtitle-text size-${subtitleSize}`;
    overlay.style.opacity = '1';
  }

  function clearSubtitle() {
    if (!overlay) return;
    overlay.style.opacity = '0';
  }

  // ---- Caption Detection ----
  // YouTube uses several caption containers. We watch for changes.

  function getCaptionText() {
    // YouTube caption selectors (multiple fallbacks)
    const selectors = [
      '.ytp-caption-segment',
      '.captions-text span',
      '.caption-visual-line',
      '.ytp-caption-window-container span',
      // YouTube's newer caption segments
      '.ytp-caption-window-rollup span',
    ];

    for (const sel of selectors) {
      const elements = document.querySelectorAll(sel);
      if (elements.length > 0) {
        let text = '';
        elements.forEach(el => {
          const t = el.textContent.trim();
          if (t) text += (text ? ' ' : '') + t;
        });
        if (text) return text;
      }
    }
    return '';
  }

  async function processCaptions() {
    if (!isActive) return;

    const captionText = getCaptionText();

    // Skip if same as last
    if (captionText === lastCaptionText) return;
    lastCaptionText = captionText;

    if (!captionText) {
      clearSubtitle();
      return;
    }

    // Debounce: wait 200ms for caption to stabilize
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      try {
        const translated = await translateText(captionText, 'auto', targetLang);
        updateSubtitle(translated, captionText);
      } catch (e) {
        console.warn('[LST] Process error:', e);
      }
    }, 200);
  }

  // ---- Caption Observer ----
  function startObserver() {
    if (observer) observer.disconnect();

    // Observe the video player area for caption changes
    const playerEl = document.querySelector('#movie_player') || document.querySelector('.html5-video-player') || document.body;

    observer = new MutationObserver((mutations) => {
      if (!isActive) return;
      // Check if any mutation is in caption area
      for (const m of mutations) {
        const target = m.target;
        if (target.closest && (
          target.closest('.ytp-caption-window-container') ||
          target.closest('.caption-window') ||
          target.closest('.captions-text')
        )) {
          processCaptions();
          return;
        }
      }
      // Also check periodically in case we missed it
      processCaptions();
    });

    observer.observe(playerEl, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // Also poll every 300ms as a fallback
    if (window._lstPollInterval) clearInterval(window._lstPollInterval);
    window._lstPollInterval = setInterval(() => {
      if (isActive) processCaptions();
    }, 300);

    console.log('[LST] Observer started');
  }

  function stopObserver() {
    if (observer) { observer.disconnect(); observer = null; }
    if (window._lstPollInterval) { clearInterval(window._lstPollInterval); window._lstPollInterval = null; }
    console.log('[LST] Observer stopped');
  }

  // ---- Auto-Enable YouTube Captions ----
  function enableYouTubeCaptions() {
    const ccBtn = document.querySelector('.ytp-subtitles-button');
    if (ccBtn) {
      const isOn = ccBtn.getAttribute('aria-pressed') === 'true';
      if (!isOn) {
        ccBtn.click();
        showStatus('✅ Captions enabled & translating...', 'active');
        return true;
      }
    }
    return false;
  }

  // ---- Start / Stop ----
  function start() {
    isActive = true;
    createOverlay();
    document.body.classList.add('lst-hide-original');

    // Try to enable YouTube captions
    setTimeout(() => {
      enableYouTubeCaptions();
    }, 1000);

    startObserver();
    showStatus('🌐 Live Translator Active', 'active');
    console.log('[LST] Started — translating to:', targetLang);
  }

  function stop() {
    isActive = false;
    stopObserver();
    clearSubtitle();
    document.body.classList.remove('lst-hide-original');
    removeOverlay();
    console.log('[LST] Stopped');
  }

  // ---- Message Handling from Popup ----
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg.action) {
      case 'start':
        targetLang = msg.targetLang || 'en';
        subtitleSize = msg.subtitleSize || 'medium';
        showOriginal = msg.showOriginal !== false;
        start();
        sendResponse({ status: 'started' });
        break;

      case 'stop':
        stop();
        sendResponse({ status: 'stopped' });
        break;

      case 'updateSettings':
        targetLang = msg.targetLang || targetLang;
        subtitleSize = msg.subtitleSize || subtitleSize;
        showOriginal = msg.showOriginal !== undefined ? msg.showOriginal : showOriginal;
        // Update subtitle size class
        const textEl = document.getElementById('lst-text');
        if (textEl) textEl.className = `lst-subtitle-text size-${subtitleSize}`;
        sendResponse({ status: 'updated' });
        break;

      case 'getStatus':
        sendResponse({ isActive, targetLang, subtitleSize, showOriginal });
        break;
    }
    return true;
  });

  // ---- Auto-restore state ----
  chrome.storage.local.get(['lstActive', 'lstTargetLang', 'lstSubtitleSize', 'lstShowOriginal'], (data) => {
    if (data.lstActive) {
      targetLang = data.lstTargetLang || 'en';
      subtitleSize = data.lstSubtitleSize || 'medium';
      showOriginal = data.lstShowOriginal !== false;
      // Wait for page to load
      setTimeout(start, 2000);
    }
  });

  console.log('[LST] Live Subtitle Translator loaded');
})();
