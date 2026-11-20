let audioCtx = null;

function ensureContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

export function unlockAudio() {
  ensureContext();
}

function scheduleTone(ctx, { type, freq, startTime, peakGain, decayDuration, stopDuration }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(peakGain, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + decayDuration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
  osc.start(startTime);
  osc.stop(startTime + stopDuration);
}

export function playTick() {
  const ctx = ensureContext();
  if (!ctx) return;
  scheduleTone(ctx, {
    type: "sine",
    freq: 920,
    startTime: ctx.currentTime,
    peakGain: 0.04,
    decayDuration: 0.045,
    stopDuration: 0.05
  });
}

export function playDing() {
  const ctx = ensureContext();
  if (!ctx) return;
  scheduleTone(ctx, {
    type: "triangle",
    freq: 1180,
    startTime: ctx.currentTime,
    peakGain: 0.14,
    decayDuration: 0.22,
    stopDuration: 0.24
  });
}

export function playStepComplete() {
  const ctx = ensureContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  [880, 1175, 1568].forEach((freq, i) => {
    scheduleTone(ctx, {
      type: "triangle",
      freq,
      startTime: now + i * 0.14,
      peakGain: 0.16,
      decayDuration: 0.25,
      stopDuration: 0.28
    });
  });
}
