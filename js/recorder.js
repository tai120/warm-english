/* ============================================================
   录音（影子跟读对比用，需用户允许麦克风权限）
   ============================================================ */
let recStream = null;
let mediaRec = null;
let recChunks = [];

/* 开始录音。结束时调用 onDone(播放地址)；失败调用 onError */
async function startRecord(onDone, onError) {
  stopSpeak(); /* 录音前先停止播放 */
  try {
    if (!recStream) {
      recStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }
    const mime = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm';
    mediaRec = new MediaRecorder(recStream, { mimeType: mime });
    recChunks = [];
    mediaRec.ondataavailable = e => { if (e.data && e.data.size) recChunks.push(e.data); };
    mediaRec.onstop = () => {
      const blob = new Blob(recChunks, { type: mediaRec.mimeType || 'audio/webm' });
      onDone(URL.createObjectURL(blob));
    };
    mediaRec.start();
    return true;
  } catch (err) {
    if (onError) onError(err);
    return false;
  }
}

function stopRecord() {
  if (mediaRec && mediaRec.state !== 'inactive') mediaRec.stop();
}

function isRecording() {
  return !!(mediaRec && mediaRec.state === 'recording');
}
