/* =============================================
   LIVE SUBTITLE TRANSLATOR — Popup Logic
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {
  const toggleSwitch = document.getElementById('toggleSwitch');
  const toggleStatus = document.getElementById('toggleStatus');
  const targetLang = document.getElementById('targetLang');
  const showOriginal = document.getElementById('showOriginal');
  const sizeBtns = document.querySelectorAll('.size-btn');
  const ytNote = document.getElementById('ytNote');

  let currentSize = 'medium';
  let activeTabId = null;

  // ---- Get active tab ----
  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  // ---- Send message to content script ----
  async function sendToContent(message) {
    const tab = await getActiveTab();
    if (!tab || !tab.url || !tab.url.includes('youtube.com')) {
      ytNote.classList.add('show');
      return null;
    }
    ytNote.classList.remove('show');
    activeTabId = tab.id;
    try {
      return await chrome.tabs.sendMessage(tab.id, message);
    } catch (e) {
      console.warn('Could not reach content script:', e);
      ytNote.classList.add('show');
      return null;
    }
  }

  // ---- Load saved settings ----
  chrome.storage.local.get(['lstActive', 'lstTargetLang', 'lstSubtitleSize', 'lstShowOriginal'], (data) => {
    if (data.lstActive) {
      toggleSwitch.checked = true;
      toggleStatus.textContent = 'ACTIVE';
      toggleStatus.classList.add('on');
    }
    if (data.lstTargetLang) targetLang.value = data.lstTargetLang;
    if (data.lstSubtitleSize) {
      currentSize = data.lstSubtitleSize;
      sizeBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.size === currentSize);
      });
    }
    if (data.lstShowOriginal !== undefined) showOriginal.checked = data.lstShowOriginal;
  });

  // ---- Toggle translator ----
  toggleSwitch.addEventListener('change', async () => {
    const isOn = toggleSwitch.checked;

    if (isOn) {
      const result = await sendToContent({
        action: 'start',
        targetLang: targetLang.value,
        subtitleSize: currentSize,
        showOriginal: showOriginal.checked
      });

      if (result) {
        toggleStatus.textContent = 'ACTIVE';
        toggleStatus.classList.add('on');
        chrome.storage.local.set({ lstActive: true });
      } else {
        toggleSwitch.checked = false;
      }
    } else {
      await sendToContent({ action: 'stop' });
      toggleStatus.textContent = 'OFF';
      toggleStatus.classList.remove('on');
      chrome.storage.local.set({ lstActive: false });
    }
  });

  // ---- Language change ----
  targetLang.addEventListener('change', async () => {
    chrome.storage.local.set({ lstTargetLang: targetLang.value });
    if (toggleSwitch.checked) {
      await sendToContent({
        action: 'updateSettings',
        targetLang: targetLang.value,
        subtitleSize: currentSize,
        showOriginal: showOriginal.checked
      });
    }
  });

  // ---- Size buttons ----
  sizeBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      currentSize = btn.dataset.size;
      sizeBtns.forEach(b => b.classList.toggle('active', b === btn));
      chrome.storage.local.set({ lstSubtitleSize: currentSize });
      if (toggleSwitch.checked) {
        await sendToContent({
          action: 'updateSettings',
          subtitleSize: currentSize
        });
      }
    });
  });

  // ---- Show original toggle ----
  showOriginal.addEventListener('change', async () => {
    chrome.storage.local.set({ lstShowOriginal: showOriginal.checked });
    if (toggleSwitch.checked) {
      await sendToContent({
        action: 'updateSettings',
        showOriginal: showOriginal.checked
      });
    }
  });

  // ---- Check if on YouTube ----
  (async () => {
    const tab = await getActiveTab();
    if (!tab || !tab.url || !tab.url.includes('youtube.com')) {
      ytNote.classList.add('show');
    }
  })();
});
