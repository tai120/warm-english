/* ============================================================
   发音（使用手机自带的语音合成，免费）
   ============================================================ */
let ttsVoice = null;

function pickVoice() {
  const vs = speechSynthesis.getVoices();
  ttsVoice =
    vs.find(v => /en[-_](US|GB)/i.test(v.lang)) ||
    vs.find(v => /^en/i.test(v.lang)) ||
    null;
}

if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
  // 有些手机第一次发音会没声音，先「热热身」
  document.addEventListener('pointerdown', function warm() {
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      speechSynthesis.speak(u);
    } catch (e) {}
    document.removeEventListener('pointerdown', warm);
  }, { once: true });
}

/* 朗读英文；rate 是语速（1 = 正常） */
function speak(text, rate, onend) {
  if (!('speechSynthesis' in window) || !text) return;
  stopSpeak();
  const u = new SpeechSynthesisUtterance(text);
  if (ttsVoice) u.voice = ttsVoice;
  u.lang = ttsVoice ? ttsVoice.lang : 'en-US';
  u.rate = rate || 1;
  if (onend) u.onend = onend;
  speechSynthesis.speak(u);
}

function stopSpeak() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}
