// Microphone capture for the "recording" input state. Only RMS levels are kept (for
// the waveform and the simulated voice-tremor metric); no audio is stored or sent.

export class MicRecorder {
  constructor(){
    this.stream = null; this.ctx = null; this.analyser = null; this.buf = null;
    this.rms = []; this.startedAt = 0; this.raf = 0;
  }

  static async permissionState(){
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return 'unsupported';
    try{
      if(!navigator.permissions) return 'prompt';
      const s = await navigator.permissions.query({ name: 'microphone' });
      return s.state; // 'granted' | 'denied' | 'prompt'
    }catch{ return 'prompt'; }
  }

  // onLevel(rms, elapsedMs) is called once per animation frame while recording.
  async start({ onLevel } = {}){
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('unsupported');
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    src.connect(this.analyser);
    this.buf = new Uint8Array(this.analyser.fftSize);
    this.rms = [];
    this.startedAt = performance.now();
    const tick = () => {
      this.analyser.getByteTimeDomainData(this.buf);
      let sum = 0;
      for(let i = 0; i < this.buf.length; i++){ const x = (this.buf[i] - 128) / 128; sum += x * x; }
      const rms = Math.sqrt(sum / this.buf.length);
      this.rms.push(rms);
      onLevel && onLevel(rms, performance.now() - this.startedAt);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  // Returns { durationMs, rms } and releases the mic.
  stop(){
    cancelAnimationFrame(this.raf);
    const out = { durationMs: this.startedAt ? performance.now() - this.startedAt : 0, rms: this.rms };
    if(this.stream) this.stream.getTracks().forEach(t => t.stop());
    if(this.ctx) this.ctx.close().catch(() => {});
    this.stream = null; this.ctx = null; this.analyser = null;
    return out;
  }
}

// Gemini-style scrolling bars: newest level at the right edge.
export function drawWaveform(canvas, levels){
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
  if(!w || !h) return;
  if(canvas.width !== w || canvas.height !== h){ canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  const barW = 3 * dpr, gap = 2 * dpr;
  const count = Math.floor(w / (barW + gap));
  const slice = levels.slice(-count);
  ctx.fillStyle = getComputedStyle(canvas).color || '#d43b3b';
  for(let i = 0; i < slice.length; i++){
    const amp = Math.min(1, slice[i] * 4);           // mic RMS is small; boost for visibility
    const bh = Math.max(2 * dpr, amp * h);
    const x = w - (slice.length - i) * (barW + gap);
    const y = (h - bh) / 2;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, bh, barW / 2);
    ctx.fill();
  }
}

export function formatElapsed(ms){
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
