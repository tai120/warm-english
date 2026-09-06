/* ============================================================
   发音（使用系统自带的语音合成，免费）
   不同手机/电脑自带的「英文声音」不一样，可在设置页挑选
   ============================================================ */
let ttsVoice = null;

/* 各平台好听音色的偏好顺序（排前面的优先） */
const VOICE_PREF = [
  'Google US English', 'Google UK English Female', 'Google UK English Male',
  'Samantha', 'Karen', 'Daniel', 'Serena', 'Moira',
  'Microsoft Aria Online (Natural) - English (United States)',
  'Microsoft Jenny', 'Microsoft Guy', 'Microsoft Zira', 'Microsoft David',
  'Microsoft Mark', 'Microsoft Hazel', 'Microsoft George', 'Microsoft Susan'
];

/* 挑一个英文声音：优先用户设置里保存的，其次按偏好列表，最后随便找个英文的 */
function pickVoice() {
  if (!('speechSynthesis' in window)) return null;
  const vs = speechSynthesis.getVoices() || [];
  if (!vs.length) return null;
  const saved = Settings.get().voice;
  let v = saved ? vs.find(x => x.name === saved) : null;
  if (!v) v = VOICE_PREF.map(n => vs.find(x => x.name === n)).find(Boolean);
  if (!v) v = vs.find(x => /en[-_](US|GB)/i.test(x.lang));
  if (!v) v = vs.find(x => /^en/i.test(x.lang));
  ttsVoice = v || null;
  return ttsVoice;
}

/* 列出设备上所有英文声音（设置页用） */
function listVoices() {
  if (!('speechSynthesis' in window)) return [];
  return (speechSynthesis.getVoices() || []).filter(v => /^en/i.test(v.lang));
}

if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
  /* 有些手机第一次发音没声音：第一次点屏幕时轻轻读一个词「热热身」 */
  document.addEventListener('pointerdown', function warm() {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance('hello');
      u.volume = 0.01; /* 音量 0 在部分手机上会被忽略，用极轻的音量 */
      speechSynthesis.speak(u);
    } catch (e) {}
    document.removeEventListener('pointerdown', warm);
  }, { once: true });
}

/* 朗读英文；rate 是语速（1 = 正常） */
function speak(text, rate, onend) {
  if (!('speechSynthesis' in window) || !text) return;
  pickVoice(); /* 每次重新挑：有些浏览器要过一会儿才加载出声音列表 */
  stopSpeak();
  const u = new SpeechSynthesisUtterance(text);
  if (ttsVoice) { u.voice = ttsVoice; u.lang = ttsVoice.lang; }
  else u.lang = 'en-US';
  u.rate = rate || 1;
  if (onend) u.onend = onend;
  speechSynthesis.speak(u);
  try { speechSynthesis.resume(); } catch (e) {}
}

function stopSpeak() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}
