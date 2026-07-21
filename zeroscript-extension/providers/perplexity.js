// providers/perplexity.js - placeholder provider for Perplexity (www.perplexity.ai).
// This file provides the bare ZSProvider interface expected by core/main.js.
// Perplexity-specific DOM selectors and logic must be implemented against a
// live Perplexity session and may require adjustments when the site changes.

// eslint-disable-next-line no-unused-vars
const ZSProvider = (() => {
  "use strict";
  let diag = () => {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Site selectors observed during live inspection.
  const S = {
    editor: "div#ask-input",
    submitBtn: "button[aria-label=\"Submit\"]",
    answer: "div[data-renderer=\"lm\"]",
    stopBtn: "button[aria-label=\"Stop\"], button[aria-label*='Stop generation']",
  };

  function init({ diag: d } = {}) {
    if (d) diag = d;
  }

  function allItems() { return Array.from(document.querySelectorAll(S.answer)); }
  function isUserItem() { return false; }
  function isAssistantItem(it) { return !!it && it.matches && it.matches(S.answer); }
  function itemText(item) { if (!item) return ""; return (item.textContent || "").trim(); }
  function classifyText(item, excludeSel) { return itemText(item); }
  function assistantCount() { return allItems().length; }
  function userCount() { return 0; }
  function lastAssistant() { const a = allItems(); return a.length ? a[a.length - 1] : null; }
  function lastAssistantId() {
    const it = lastAssistant();
    if (!it) return null;
    return it.getAttribute('data-turn-id') || it.getAttribute('id') || null;
  }
  function itemKey(it) { return it ? (it.getAttribute('id') || null) : null; }
  function readAssistant() {
    const it = lastAssistant();
    if (!it) return { present: false, reply: "", thinking: "", item: null };
    const reply = itemText(it);
    return { present: true, reply, thinking: "", item: it };
  }
  function streamLen() { const it = lastAssistant(); return it ? (itemText(it)||"").length : 0; }
  function snapshot() { return { th: 0, rp: assistantCount() }; }
  function getEditor() {
    const ed = document.querySelector(S.editor);
    if (!ed) return null;
    // avoid returning our injected bar if present
    if (ed.closest && ed.closest('#zs-root')) return null;
    return ed;
  }
  function editorText() { const e = getEditor(); return e ? (e.innerText || '').trim() : ""; }
  function chatIsEmpty() { return assistantCount() === 0; }
  function isFreshChat() { return false; }
  function composerFrame() { const e = getEditor(); return e ? e.parentElement : null; }
  function barMount() { return composerFrame(); }
  function setInputLock() { /* no-op for Perplexity */ }
  async function typeAndSend(text, images) {
    const ed = getEditor();
    if (!ed) throw new Error("Perplexity input box not found");
    let lastErr = null;
    // Try a few times: execCommand -> paste -> innerText. Some Lexical builds
    // need repeated gentle attempts to accept injected content.
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        diag('perplexity.typeAndSend.attempt', { attempt, method: 'exec/paste' });
        ed.focus();
        const sel = window.getSelection(); try { sel.removeAllRanges(); } catch {}
        const r = document.createRange(); r.selectNodeContents(ed);
        sel.addRange(r);
        try {
          document.execCommand('insertText', false, text);
        } catch (e) {
          try {
            const dt = new DataTransfer();
            dt.setData('text/plain', text);
            ed.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
          } catch (e2) {
            ed.innerText = text;
          }
        }

        // wait briefly for the editor to process input
        await sleep(160);

        // detect submit and click when enabled
        const btn = document.querySelector(S.submitBtn);
        if (btn && !btn.disabled) { btn.click(); return true; }
        // small backoff before next attempt
        lastErr = 'submit-not-enabled';
        await sleep(180 * attempt);
      } catch (e) {
        lastErr = String(e);
        diag('perplexity.typeAndSend.err', { attempt, err: lastErr });
        await sleep(200 * attempt);
      }
    }
    // If the simple injection approaches failed, try more realistic input
    // events: beforeinput/input dispatch and a per-character key-event fallback.
    diag('perplexity.typeAndSend.fallbackStart', { lastErr });
    try {
      // 1) dispatch a beforeinput + input pair
      try {
        ed.focus();
        const before = new InputEvent('beforeinput', { data: text, inputType: 'insertText', bubbles: true, cancelable: true });
        ed.dispatchEvent(before);
        // set the text as a last-resort DOM write so the input contains the content
        try { ed.innerText = text; } catch {}
        const inp = new InputEvent('input', { data: text, inputType: 'insertText', bubbles: true, cancelable: false });
        ed.dispatchEvent(inp);
        await sleep(120);
      } catch (e) { diag('perplexity.typeAndSend.fallback.beforeinput.err', { e: String(e) }); }

      // 2) per-character key event fallback (cheap, quick)
      try {
        ed.focus();
        // clear selection and place caret
        const sel = window.getSelection(); try { sel.removeAllRanges(); } catch {}
        const r = document.createRange(); r.selectNodeContents(ed); r.collapse(false);
        sel.addRange(r);
        for (let i = 0; i < text.length; i++) {
          const ch = text[i];
          const kd = new KeyboardEvent('keydown', { key: ch, code: ch, bubbles: true, cancelable: true });
          const kp = new KeyboardEvent('keypress', { key: ch, code: ch, bubbles: true, cancelable: true });
          const ku = new KeyboardEvent('keyup', { key: ch, code: ch, bubbles: true, cancelable: true });
          ed.dispatchEvent(kd);
          ed.dispatchEvent(kp);
          // smaller input event for each char
          try { ed.innerText = (ed.innerText || '') + ch; } catch {}
          const ie = new InputEvent('input', { data: ch, inputType: 'insertText', bubbles: true, cancelable: false });
          ed.dispatchEvent(ie);
          ed.dispatchEvent(ku);
          // throttle a little so Lexical/react can process
          await sleep(8);
        }
        await sleep(120);
      } catch (e) { diag('perplexity.typeAndSend.fallback.keychars.err', { e: String(e) }); }

      // 3) attempt submit via the site's Submit button or Enter key events
      const btn2 = document.querySelector(S.submitBtn);
      if (btn2 && !btn2.disabled) { btn2.click(); return true; }
      try {
        const kdEnter = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true });
        const kuEnter = new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true });
        ed.dispatchEvent(kdEnter);
        ed.dispatchEvent(kuEnter);
        await sleep(120);
        const btn3 = document.querySelector(S.submitBtn);
        if (btn3 && !btn3.disabled) { btn3.click(); return true; }
      } catch (e) { diag('perplexity.typeAndSend.fallback.enter.err', { e: String(e) }); }
    } catch (e) { diag('perplexity.typeAndSend.fallback.finalErr', { e: String(e) }); }

    diag('perplexity.typeAndSend.failed', { lastErr });
    return false;
  }
  function stopGeneration() {
    const b = document.querySelector(S.stopBtn);
    if (b) { try { b.click(); return true; } catch { } }
    return false;
  }
  function isGenerating() {
    // Perplexity doesn't expose an obvious streaming flag; detect by checking
    // whether the last answer element is still being appended to (heuristic).
    const it = lastAssistant();
    if (!it) return false;
    // If a stop button is present, consider it generating.
    const stop = document.querySelector(S.stopBtn);
    if (stop && !stop.disabled) return true;
    // If the answer node contains an element with an ongoing spinner, treat as generating
    if (it.querySelector && it.querySelector('svg, .spinner, .loading')) return true;
    return false;
  }
  function isBusyNow() { return false; }
  function isHardGenerating() { return false; }
  // Perplexity does not expose a named reasoning-area selector we rely on.
  const thinkingSel = null;
  function enforceComposer() { return { ready: false }; }
  async function ensureComposerReady(retries = 3) {
    // Best-effort: close any blocking modal, click the sidebar "New" button,
    // and wait for the composer/editor to appear.
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        diag('perplexity.ensureComposerReady.attempt', { attempt });
        // 1) close any modal dialogs with obvious close buttons
        try {
          // common close selectors
          const closeSelectors = ['button[aria-label="Close"]', 'button[title="Close"]', 'button:has(svg[aria-hidden])'];
          for (const s of closeSelectors) {
            const b = document.querySelector(s);
            if (b) { b.click(); await sleep(200); }
          }
          // generic dialog close: find dialogs and click their close button text
          const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
          for (const d of dialogs) {
            const cb = Array.from(d.querySelectorAll('button')).find(x => /close|dismiss|cancel/i.test((x.textContent||'').trim()));
            if (cb) { cb.click(); await sleep(200); }
          }
        } catch (e) { diag('perplexity.ensureComposerReady.closeErr', { e: String(e) }); }

        // 2) click the sidebar "New" control if present
        try {
          const candidates = Array.from(document.querySelectorAll('button, a'));
          const newBtn = candidates.find(el => (el.textContent||'').trim().toLowerCase() === 'new');
          if (newBtn) { newBtn.click(); await sleep(400); }
        } catch (e) { diag('perplexity.ensureComposerReady.newErr', { e: String(e) }); }

        // 3) wait for editor
        const start = Date.now();
        while (Date.now() - start < 5000) {
          const ed = document.querySelector(S.editor);
          if (ed && ed.getAttribute && ed.getAttribute('contenteditable') === 'true') {
            return { ready: true };
          }
          await sleep(200);
        }
      } catch (e) { diag('perplexity.ensureComposerReady.attemptErr', { attempt, e: String(e) }); }
      await sleep(300 * attempt);
    }
    return { ready: false, reason: 'composer-missing' };
  }
  function turnHalted() { return false; }
  function findContinueBtn() { return null; }
  function clickContinueBtn() { return false; }
  function scanError() { return null; }
  function isTooLongMsg() { return false; }
  function isBusyMsg() { return false; }
  function attachImages() { return null; }
  function clearAttachments() {}
  function conversationKey() { return "perplexity:" + location.pathname; }
  function installSendHooks() {}
  function findToolBlockSpot() { return null; }

  const timings = {
    GEN_IDLE_MS: 800,
    REASON_IDLE_MS: 12000,
    WARMUP_MS: 45000,
    REASON_NOREPLY_MS: 90000,
    STABLE_MS: 9000,
    RESPONSE_TIMEOUT_MS: 300000,
  };

  return {
    id: "perplexity",
    displayName: "Perplexity",
    supportsVision: false,
    timings,
    thinkingSel,
    reliableCounts: false,
    init,
    allItems, isUserItem, isAssistantItem, itemText, classifyText,
    assistantCount, userCount, lastAssistant, lastAssistantId, itemKey, readAssistant,
    streamLen, snapshot,
    getEditor, editorText, chatIsEmpty, isFreshChat, composerFrame, barMount,
    setInputLock, typeAndSend, stopGeneration,
    isGenerating, isBusyNow, isHardGenerating,
    enforceComposer, ensureComposerReady,
    turnHalted, findContinueBtn, clickContinueBtn,
    scanError, isTooLongMsg, isBusyMsg,
    attachImages, clearAttachments, conversationKey, installSendHooks, findToolBlockSpot,
  };
})();
