# AI 상담 채팅 ↔ 오디오 통합 + 정서 분석 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mic-recording input (real waveform, simulated STT), per-bubble TTS, an always-on camera strip with real MediaPipe FaceLandmarker landmark overlay, and a simulated multimodal (text + face + voice) risk score to the chat-type scenarios on `/student/chat`, per `docs/superpowers/specs/2026-09-10-audio-chat-affect-design.md`.

**Architecture:** Chat-type scenario playback moves out of `js/screens/student.js` into a new `js/screens/chat-session.js` that renders its frame once and patches three regions (log, input bar, affect strip), so live `<video>`/`<canvas>` nodes survive state changes. Media concerns live in `js/media/` (camera + FaceLandmarker, mic recorder + waveform, TTS). All scoring heuristics are pure functions in `js/affect.js` and are unit tested with `node:assert`. Turn progression becomes user-driven: each `me` turn waits for the demo user to send (text) or record (voice); `bot` turns auto-reveal after a typing indicator.

**Tech Stack:** Vanilla JS ES modules, no build step. MediaPipe Tasks Vision `FaceLandmarker` loaded via dynamic `import()` from jsdelivr (wasm on jsdelivr, model on storage.googleapis.com). Web APIs: `getUserMedia`, `AudioContext`/`AnalyserNode`, `speechSynthesis`, `navigator.permissions`. Tests: `node js/<name>.test.js` (same convention as `js/data.test.js`).

---

## File Structure

```
js/affect.js                 new — textRisk / faceAffect / voiceTremor / combineRisk (pure)
js/affect.test.js            new — node:assert tests for affect.js
js/media/tts.js              new — speak()/cancel(): speechSynthesis (ko voice) or timer simulation
js/media/recorder.js         new — MicRecorder (getUserMedia audio + Analyser RMS) + drawWaveform()
js/media/camera.js           new — CameraSession (getUserMedia video + FaceLandmarker loop + overlay)
js/screens/chat-session.js   new — chat-type scenario player: state machine + region patching
js/components.js             modified — export escapeHtml (shared by student.js and chat-session.js)
js/screens/student.js        modified — delegate chat-type scenarios to chat-session; keep picker + survey
css/styles.css               modified — affect strip, banners, input bar, waveform, bubble meta, toast
```

---

### Task 1: Affect scoring module (pure) + tests

**Files:**
- Create: `js/affect.js`
- Test: `js/affect.test.js`

- [x] **Step 1: Write the failing test**

Create `js/affect.test.js`:

```js
import assert from 'node:assert/strict';
import { textRisk, faceAffect, voiceTremor, combineRisk } from './affect.js';

// textRisk: noisy-OR over matched keyword weights, 0 when nothing matches
assert.equal(textRisk([]), 0);
assert.equal(textRisk(['고2인데 아직도 뭘 하고 싶은지 모르겠어.']), 0);
assert.equal(textRisk(['어제 학교에서 애들 몇 명이 나를 때렸어.']), 0.8);
// 때렸(0.8) + 멍(0.45) -> 1 - 0.2*0.55 = 0.89
assert.equal(textRisk(['어제 학교에서 애들 몇 명이 나를 때렸어.', '팔이랑 등에 멍이 좀 들었어.']), 0.89);
// a keyword matched twice counts once
assert.equal(textRisk(['죽고 싶어', '죽을 것 같아']), 1);

// faceAffect: blendshape map -> sad/anxious/positive in [0,1], label, risk
const neutral = faceAffect({});
assert.deepEqual(neutral, { sad: 0, anxious: 0, positive: 0, label: '중립', risk: 0 });

const sadFace = faceAffect({ mouthFrownLeft: 0.8, mouthFrownRight: 0.8, browInnerUp: 0.5 });
assert.equal(sadFace.sad, 0.68);      // 0.6*0.8 + 0.4*0.5
assert.equal(sadFace.label, '우울');
assert.equal(sadFace.risk, 0.41);     // 0.6*0.68

const happyFace = faceAffect({ mouthSmileLeft: 1, mouthSmileRight: 1, cheekSquintLeft: 0.5, cheekSquintRight: 0.5 });
assert.equal(happyFace.positive, 0.85); // 0.7*1 + 0.3*0.5
assert.equal(happyFace.label, '긍정');
assert.equal(happyFace.risk, 0);        // negative clamps to 0

// blendshapes may also arrive as MediaPipe's [{categoryName, score}] array
const fromArray = faceAffect([{ categoryName: 'mouthFrownLeft', score: 0.8 }, { categoryName: 'mouthFrownRight', score: 0.8 }]);
assert.equal(fromArray.sad, 0.48);

// voiceTremor: mean |delta| / mean, scaled; silence-only or too-short input -> 0
assert.equal(voiceTremor([]), 0);
assert.equal(voiceTremor(Array(20).fill(0.3)), 0);
assert.equal(voiceTremor(Array(20).fill(0.001)), 0);           // below silence gate
assert.equal(voiceTremor([0.05, 0.4, 0.05, 0.4, 0.05, 0.4, 0.05, 0.4, 0.05, 0.4]), 1); // wildly unstable -> clamps to 1

// combineRisk: 0.6 text + 0.25 face + 0.15 voice, banded by THRESHOLDS (0.35 / 0.65)
assert.deepEqual(combineRisk({}), { score: 0, level: 'L1' });
assert.deepEqual(combineRisk({ text: 0.5 }), { score: 0.3, level: 'L1' });
assert.deepEqual(combineRisk({ text: 0.5, face: 0.4 }), { score: 0.4, level: 'L2' });
assert.deepEqual(combineRisk({ text: 0.89, face: 0.6, voice: 0.5 }), { score: 0.76, level: 'L3' });

console.log('All affect.js tests passed.');
```

- [x] **Step 2: Run test to verify it fails**

Run: `node js/affect.test.js`
Expected: `Error [ERR_MODULE_NOT_FOUND]` — `js/affect.js` doesn't exist yet.

- [x] **Step 3: Create `js/affect.js`**

```js
// Multimodal affect / risk heuristics for the demo. Pure functions, no DOM.
// These are simulation-grade formulas, not a validated clinical model.
import { THRESHOLDS } from './data.js';

const round2 = n => Math.round(n * 100) / 100;
const clamp01 = n => Math.min(1, Math.max(0, n));
const avg = (...xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

// Student-utterance risk keywords. Weight = probability contribution; combined with noisy-OR.
export const TEXT_RISK_KEYWORDS = [
  { re: /죽|자살/, w: 1.0 },
  { re: /자해/, w: 1.0 },
  { re: /때렸|때리|맞았|폭력|괴롭/, w: 0.8 },
  { re: /무서|무섭/, w: 0.5 },
  { re: /멍|다쳤|아팠/, w: 0.45 },
  { re: /불안/, w: 0.4 },
  { re: /힘들/, w: 0.35 },
  { re: /하기 싫|재미가 없|의욕/, w: 0.35 },
  { re: /잠도|못 자|잠들/, w: 0.25 },
  { re: /혼자/, w: 0.25 },
  { re: /입맛|안 먹|대충 먹/, w: 0.2 },
];

// messages: array of student utterance strings -> 0..1
export function textRisk(messages){
  const text = messages.join(' ');
  let survive = 1;
  for(const k of TEXT_RISK_KEYWORDS){
    if(k.re.test(text)) survive *= (1 - k.w);
  }
  return round2(1 - survive);
}

// blendshapes: {name: score} map OR MediaPipe [{categoryName, score}] array
export function faceAffect(blendshapes){
  const map = Array.isArray(blendshapes)
    ? Object.fromEntries(blendshapes.map(c => [c.categoryName, c.score]))
    : (blendshapes || {});
  const g = name => map[name] || 0;
  const sad = round2(clamp01(0.6 * avg(g('mouthFrownLeft'), g('mouthFrownRight')) + 0.4 * g('browInnerUp')));
  const anxious = round2(clamp01(
    0.4 * avg(g('browDownLeft'), g('browDownRight')) +
    0.3 * avg(g('eyeWideLeft'), g('eyeWideRight')) +
    0.3 * avg(g('mouthPressLeft'), g('mouthPressRight'))));
  const positive = round2(clamp01(0.7 * avg(g('mouthSmileLeft'), g('mouthSmileRight')) + 0.3 * avg(g('cheekSquintLeft'), g('cheekSquintRight'))));
  const top = Math.max(sad, anxious, positive);
  const label = top < 0.25 ? '중립' : top === sad ? '우울' : top === anxious ? '불안' : '긍정';
  const risk = round2(clamp01(0.6 * sad + 0.5 * anxious - 0.4 * positive));
  return { sad, anxious, positive, label, risk };
}

// rms: per-frame RMS amplitudes (0..1) captured while recording -> "tremor" 0..1
const SILENCE_GATE = 0.01;
export function voiceTremor(rms){
  const active = rms.filter(v => v > SILENCE_GATE);
  if(active.length < 8) return 0;
  const mean = avg(...active);
  let deltaSum = 0;
  for(let i = 1; i < active.length; i++) deltaSum += Math.abs(active[i] - active[i - 1]);
  const meanDelta = deltaSum / (active.length - 1);
  return round2(clamp01((meanDelta / mean) / 0.8));
}

export function combineRisk({ text = 0, face = 0, voice = 0 } = {}){
  const score = round2(0.6 * text + 0.25 * face + 0.15 * voice);
  const level = score >= THRESHOLDS.t2 ? 'L3' : score >= THRESHOLDS.t1 ? 'L2' : 'L1';
  return { score, level };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `node js/affect.test.js`
Expected: `All affect.js tests passed.`

- [x] **Step 5: Commit**

```bash
git add js/affect.js js/affect.test.js
git commit -m "feat: add multimodal affect/risk heuristics module with tests"
```

---

### Task 2: TTS module

**Files:**
- Create: `js/media/tts.js`

No node test (browser-only API); verified in the browser in Task 7.

- [x] **Step 1: Create `js/media/tts.js`**

```js
// Bot-bubble "read aloud". Uses browser speechSynthesis with a Korean voice when one
// exists; otherwise simulates the speaking duration with a timer. Nothing is recorded.

let current = null; // { cancel }

const hasSynth = () => typeof window !== 'undefined' && 'speechSynthesis' in window;
if(hasSynth()){
  // Chrome populates voices asynchronously; touching getVoices() once kicks that off.
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

function koVoice(){
  if(!hasSynth()) return null;
  return window.speechSynthesis.getVoices().find(v => /^ko/i.test(v.lang)) || null;
}

export function simulatedDurationMs(text){ return 400 + text.length * 90; }

export function speak(text, { onStart, onEnd } = {}){
  cancel();
  const token = {};
  let ended = false;
  const done = () => {
    if(ended) return;
    ended = true;
    if(current && current.token === token) current = null;
    onEnd && onEnd();
  };
  const voice = koVoice();
  if(voice){
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice; u.lang = voice.lang; u.rate = 1;
    u.onend = done; u.onerror = done;
    current = { token, cancel: () => { window.speechSynthesis.cancel(); done(); } };
    window.speechSynthesis.speak(u);
  } else {
    const t = setTimeout(done, simulatedDurationMs(text));
    current = { token, cancel: () => { clearTimeout(t); done(); } };
  }
  onStart && onStart();
}

export function cancel(){
  if(!current) return;
  const c = current;
  current = null;
  c.cancel();
}
```

- [x] **Step 2: Commit**

```bash
git add js/media/tts.js
git commit -m "feat: add TTS helper (speechSynthesis ko voice or simulated timer)"
```

---

### Task 3: Mic recorder + waveform

**Files:**
- Create: `js/media/recorder.js`

- [x] **Step 1: Create `js/media/recorder.js`**

```js
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
  if(canvas.width !== w || canvas.height !== h){ canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  const barW = 3 * dpr, gap = 2 * dpr;
  const count = Math.floor(w / (barW + gap));
  const slice = levels.slice(-count);
  const color = getComputedStyle(canvas).color || '#d43b3b';
  ctx.fillStyle = color;
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
```

- [x] **Step 2: Commit**

```bash
git add js/media/recorder.js
git commit -m "feat: add mic recorder with RMS levels and waveform renderer"
```

---

### Task 4: Camera + FaceLandmarker session

**Files:**
- Create: `js/media/camera.js`

- [x] **Step 1: Create `js/media/camera.js`**

```js
// Always-on camera analysis for a counseling session. Real getUserMedia video +
// MediaPipe FaceLandmarker (FaceMesh 478 landmarks + 52 blendshapes) drawn on an
// overlay canvas. Frames are never recorded or uploaded.

const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const DETECT_INTERVAL_MS = 66;   // ~15 fps
const NO_FACE_GRACE_MS = 1000;

let landmarkerPromise = null;
function loadLandmarker(){
  if(!landmarkerPromise){
    landmarkerPromise = (async () => {
      const vision = await import(`${CDN}/vision_bundle.mjs`);
      const files = await vision.FilesetResolver.forVisionTasks(`${CDN}/wasm`);
      const opts = delegate => ({
        baseOptions: { modelAssetPath: MODEL, delegate },
        outputFaceBlendshapes: true, runningMode: 'VIDEO', numFaces: 1,
      });
      let lm;
      try{ lm = await vision.FaceLandmarker.createFromOptions(files, opts('GPU')); }
      catch{ lm = await vision.FaceLandmarker.createFromOptions(files, opts('CPU')); }
      return { vision, lm };
    })().catch(e => { landmarkerPromise = null; throw e; });
  }
  return landmarkerPromise;
}

export class CameraSession {
  // status: 'idle' | 'requesting' | 'denied' | 'loading' | 'model-error' | 'no-face' | 'tracking'
  constructor({ video, canvas, onStatus, onFrame }){
    this.video = video; this.canvas = canvas;
    this.onStatus = onStatus || (() => {}); this.onFrame = onFrame || (() => {});
    this.status = 'idle'; this.stream = null; this.lm = null; this.drawer = null; this.vision = null;
    this.raf = 0; this.stopped = false; this.lastDetect = 0; this.lastFaceAt = 0;
  }

  static async permissionState(){
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return 'unsupported';
    try{
      if(!navigator.permissions) return 'prompt';
      const s = await navigator.permissions.query({ name: 'camera' });
      return s.state;
    }catch{ return 'prompt'; }
  }

  setStatus(status, detail){
    if(this.stopped && status !== 'idle') return;
    this.status = status;
    this.onStatus(status, detail);
  }

  async start(){
    this.stopped = false;
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ this.setStatus('denied', 'unsupported'); return; }
    this.setStatus('requesting');
    try{
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false,
      });
    }catch(e){ this.setStatus('denied', e && e.name); return; }
    if(this.stopped){ this.releaseStream(); return; }
    this.video.srcObject = this.stream;
    await this.video.play().catch(() => {});
    this.setStatus('loading');
    try{
      const { vision, lm } = await loadLandmarker();
      this.vision = vision; this.lm = lm;
      this.drawer = new vision.DrawingUtils(this.canvas.getContext('2d'));
    }catch(e){ this.setStatus('model-error', e); return; }
    if(this.stopped) return;
    this.lastFaceAt = performance.now();
    this.setStatus('no-face');
    this.loop();
  }

  loop(){
    if(this.stopped) return;
    this.raf = requestAnimationFrame(() => this.loop());
    const now = performance.now();
    if(now - this.lastDetect < DETECT_INTERVAL_MS) return;
    if(this.video.readyState < 2 || !this.video.videoWidth) return;
    this.lastDetect = now;
    const res = this.lm.detectForVideo(this.video, now);
    const landmarks = res.faceLandmarks && res.faceLandmarks[0];
    this.syncCanvasSize();
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if(landmarks){
      this.lastFaceAt = now;
      if(this.status !== 'tracking') this.setStatus('tracking');
      this.draw(landmarks);
      const cats = res.faceBlendshapes && res.faceBlendshapes[0] ? res.faceBlendshapes[0].categories : [];
      this.onFrame({ blendshapes: cats });
    } else if(this.status === 'tracking' && now - this.lastFaceAt > NO_FACE_GRACE_MS){
      this.setStatus('no-face');
    }
  }

  syncCanvasSize(){
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(this.canvas.clientWidth * dpr), h = Math.round(this.canvas.clientHeight * dpr);
    if(w && h && (this.canvas.width !== w || this.canvas.height !== h)){ this.canvas.width = w; this.canvas.height = h; }
  }

  draw(landmarks){
    const FL = this.vision.FaceLandmarker;
    const dpr = window.devicePixelRatio || 1;
    const thin = 0.5 * dpr, bold = 1.2 * dpr;
    this.drawer.drawConnectors(landmarks, FL.FACE_LANDMARKS_TESSELATION, { color: 'rgba(51,85,255,0.35)', lineWidth: thin });
    for(const set of [FL.FACE_LANDMARKS_FACE_OVAL, FL.FACE_LANDMARKS_LEFT_EYE, FL.FACE_LANDMARKS_RIGHT_EYE,
                      FL.FACE_LANDMARKS_LEFT_EYEBROW, FL.FACE_LANDMARKS_RIGHT_EYEBROW, FL.FACE_LANDMARKS_LIPS]){
      this.drawer.drawConnectors(landmarks, set, { color: 'rgba(31,138,85,0.9)', lineWidth: bold });
    }
  }

  releaseStream(){
    if(this.stream) this.stream.getTracks().forEach(t => t.stop());
    this.stream = null;
  }

  stop(){
    this.stopped = true;
    cancelAnimationFrame(this.raf);
    this.releaseStream();
    if(this.video){ this.video.pause(); this.video.srcObject = null; }
    if(this.canvas){ const ctx = this.canvas.getContext('2d'); ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }
    this.status = 'idle';
  }
}
```

- [x] **Step 2: Commit**

```bash
git add js/media/camera.js
git commit -m "feat: add camera session with MediaPipe FaceLandmarker overlay"
```

---

### Task 5: Shared escapeHtml

**Files:**
- Modify: `js/components.js`
- Modify: `js/screens/student.js:9` (remove local `escapeHtml`, import instead)

- [x] **Step 1: Export from components.js** — append to `js/components.js`:

```js
export function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}
```

- [x] **Step 2: In `js/screens/student.js`** replace the local definition line

```js
function escapeHtml(s){ return s.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
```

with nothing, and change the components import to:

```js
import { comingSoonBody, escapeHtml } from '../components.js';
```

- [x] **Step 3: Verify nothing else broke**

Run: `node js/data.test.js && node js/scenarios.test.js`
Expected: both "passed" lines.

- [x] **Step 4: Commit**

```bash
git add js/components.js js/screens/student.js
git commit -m "refactor: share escapeHtml via components.js"
```

---

### Task 6: Chat session player + styles

**Files:**
- Create: `js/screens/chat-session.js`
- Modify: `css/styles.css` (append)

- [x] **Step 1: Create `js/screens/chat-session.js`**

```js
// Chat-type scenario player with text/voice input, TTS, always-on camera affect strip,
// and a simulated multimodal risk score. Renders its frame once per mount and patches
// #chatLog / #chatInput / strip regions so <video>/<canvas> nodes persist.
import { renderStudent } from '../router.js';
import { escapeHtml } from '../components.js';
import { CameraSession } from '../media/camera.js';
import { MicRecorder, drawWaveform, formatElapsed } from '../media/recorder.js';
import { speak as ttsSpeak, cancel as ttsCancel } from '../media/tts.js';
import { textRisk, faceAffect, voiceTremor, combineRisk } from '../affect.js';

const TYPING_MS = 800;
const TRANSCRIBE_MS = 1200;
const FACE_EMA = 0.2;
const STRIP_REFRESH_MS = 150;
const PRIVACY_NOTICE = '더 정확한 도움을 위해 표정과 목소리를 함께 살펴요. 카메라·오디오는 분석에만 쓰이고 녹화·저장되지 않아요.';
const CAM_STATE_TEXT = {
  requesting: '카메라 연결 중…', denied: '📷🚫', loading: '분석 준비 중…',
  'model-error': '분석 모듈 오류', 'no-face': '얼굴 없음', tracking: '', idle: '',
};

let session = null; // survives route changes: { scenario, index, log, phase, autoRead, voiceRisk, face, micDenied, speakingId, timer, nextId }
let ui = null;      // per-mount: { root, path, onExit, camera, recorder, levels, camStatus, camRetried, lastStrip }

function createSession(scenario){
  return {
    scenario, index: 0, log: [], phase: 'idle', autoRead: false, voiceRisk: 0,
    face: { label: '—', sad: 0, anxious: 0, positive: 0, risk: 0 },
    micDenied: false, speakingId: null, timer: null, nextId: 1,
  };
}

// ---------- public API ----------

export function hasChatSession(){ return !!session; }

// Enter (or re-enter after a route change) the chat player for `scenario`.
export function mountChatSession(root, path, scenario, { onExit }){
  if(ui) unmount();
  if(!session || session.scenario.id !== scenario.id) session = createSession(scenario);
  ui = { root, path, onExit, camera: null, recorder: null, levels: [], camStatus: 'idle', camRetried: false, lastStrip: 0 };
  renderFrame();
  renderLog();
  startCamera();
  MicRecorder.permissionState().then(s => {
    session.micDenied = (s === 'denied' || s === 'unsupported');
    if(ui && session.phase === 'user') renderInput();
  });
  if(session.phase === 'recording') session.phase = 'user';
  if(session.phase === 'idle' || session.phase === 'typing') advance();
  else if(session.phase === 'transcribing') armTranscribe();
  else renderInput();
}

export function destroyChatSession(){
  unmount();
  session = null;
}

function restart(){
  const scenario = session.scenario;
  const autoRead = session.autoRead;
  const micDenied = session.micDenied;
  clearTimeout(session.timer);
  stopRecorder();
  ttsCancel();
  session = createSession(scenario);
  session.autoRead = autoRead;
  session.micDenied = micDenied;
  renderLog();
  updateRisk();
  advance();
}

function unmount(){
  if(!ui) return;
  if(session) clearTimeout(session.timer);
  stopRecorder();
  ttsCancel();
  if(session) session.speakingId = null;
  if(ui.camera) ui.camera.stop();
  ui = null;
}

window.addEventListener('hashchange', () => { if(ui && location.hash.slice(1) !== ui.path) unmount(); });
window.addEventListener('pagehide', () => unmount());

// ---------- frame ----------

function renderFrame(){
  const s = session;
  const headerExtra = `
    <button class="tts-toggle ${s.autoRead ? 'on' : ''}" id="ttsToggle" title="AI 응답 자동 읽기">🔊 자동읽기</button>
    <button class="icon-btn" id="scenarioRestart" title="처음부터">↺</button>
    <button class="icon-btn" id="scenarioExit" title="목록으로">✕</button>`;
  const body = `
    <div class="affect-strip" id="affectStrip">
      <div class="cam-thumb" id="camThumb" title="탭하면 크게 봐요">
        <video id="camVideo" autoplay muted playsinline></video>
        <canvas id="camCanvas"></canvas>
        <div class="cam-state" id="camState">카메라 연결 중…</div>
      </div>
      <div class="affect-meta">
        <div class="affect-face">표정 <b id="faceLabel">—</b><span id="faceSub"></span></div>
        <div class="abar"><span>텍스트</span><i><b id="barText"></b></i></div>
        <div class="abar"><span>표정</span><i><b id="barFace"></b></i></div>
        <div class="abar"><span>음성</span><i><b id="barVoice"></b></i></div>
      </div>
      <div class="risk-pill">
        <span class="badge badge-l1" id="riskLevel">L1</span>
        <small id="riskScore">0.00</small>
        <small class="lbl">종합 위험도</small>
      </div>
    </div>
    <div class="affect-note">🔒 카메라·오디오는 분석에만 쓰이고 녹화·저장되지 않아요</div>
    <div class="chat-banner" id="chatBanner" hidden></div>
    <div class="chat-scroll" id="chatLog"></div>
    <div class="chat-footer">
      <div class="chip-row">
        <span class="chip disabled">컨텐츠를 추천해요</span>
        <span class="chip disabled">상담 요청하기</span>
      </div>
      <div class="chat-input" id="chatInput"></div>
    </div>`;
  renderStudent(ui.root, ui.path, body, { title: s.scenario.title, headerExtra, bodyClass: 'chat-body', hideTabs: true });
  const root = ui.root;
  root.querySelector('#scenarioExit').addEventListener('click', () => { const onExit = ui.onExit; destroyChatSession(); onExit(); });
  root.querySelector('#scenarioRestart').addEventListener('click', restart);
  root.querySelector('#ttsToggle').addEventListener('click', e => {
    session.autoRead = !session.autoRead;
    e.currentTarget.classList.toggle('on', session.autoRead);
    if(!session.autoRead) ttsCancel();
    toast(session.autoRead ? 'AI 응답을 자동으로 읽어줄게요' : '자동 읽기를 껐어요');
  });
  root.querySelector('#camThumb').addEventListener('click', () => root.querySelector('#affectStrip').classList.toggle('expanded'));
  root.querySelector('#chatLog').addEventListener('click', e => {
    const btn = e.target.closest('[data-tts]');
    if(!btn) return;
    const id = Number(btn.dataset.tts);
    if(session.speakingId === id){ ttsCancel(); return; }
    const m = session.log.find(x => x.id === id);
    if(m) speakMsg(m);
  });
  updateRisk();
}

function $(sel){ return ui ? ui.root.querySelector(sel) : null; }

function toast(text){
  const shell = $('.student-shell');
  if(!shell) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  shell.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

// ---------- log ----------

function msgHtml(m){
  if(m.type === 'system') return `<div class="chat-system">${escapeHtml(m.text)}</div>`;
  if(m.type === 'photo'){
    return `<div class="msg me" data-id="${m.id}">
      <div class="bubble me photo"><div class="photo-thumb">🖼️</div><div class="photo-filename">사진.jpg</div></div>
    </div>`;
  }
  if(m.who === 'me'){
    const meta = m.via === 'voice' ? '<div class="meta">🎤 음성으로 말함</div>' : '';
    return `<div class="msg me" data-id="${m.id}"><div class="bubble me">${escapeHtml(m.text)}</div>${meta}</div>`;
  }
  const speaking = session.speakingId === m.id;
  return `<div class="msg bot ${speaking ? 'speaking' : ''}" data-id="${m.id}">
    <div class="sender">AI 상담사</div>
    <div class="bubble bot">${escapeHtml(m.text)}</div>
    <div class="meta">
      <button class="tts-btn" data-tts="${m.id}">${speaking ? '⏹ 정지' : '🔊 듣기'}</button>
      <span class="speak-bars"><i></i><i></i><i></i></span>
    </div>
  </div>`;
}

function renderLog(){
  const log = $('#chatLog');
  if(!log) return;
  const notice = { id: 0, type: 'system', text: PRIVACY_NOTICE };
  log.innerHTML = [notice, ...session.log].map(msgHtml).join('') + (session.phase === 'typing' ? typingHtml() : '');
  log.scrollTop = log.scrollHeight;
}

function typingHtml(){ return `<div class="bubble bot typing" id="typingInd"><span></span><span></span><span></span></div>`; }

function appendMsg(m){
  const log = $('#chatLog');
  if(!log) return;
  const ind = log.querySelector('#typingInd');
  if(ind) ind.remove();
  log.insertAdjacentHTML('beforeend', msgHtml(m));
  log.scrollTop = log.scrollHeight;
}

function showTyping(on){
  const log = $('#chatLog');
  if(!log) return;
  const ind = log.querySelector('#typingInd');
  if(on && !ind){ log.insertAdjacentHTML('beforeend', typingHtml()); log.scrollTop = log.scrollHeight; }
  if(!on && ind) ind.remove();
}

function setSpeaking(id){
  session.speakingId = id;
  const log = $('#chatLog');
  if(!log) return;
  log.querySelectorAll('.msg.bot').forEach(el => {
    const on = Number(el.dataset.id) === id;
    el.classList.toggle('speaking', on);
    const btn = el.querySelector('.tts-btn');
    if(btn) btn.textContent = on ? '⏹ 정지' : '🔊 듣기';
  });
}

function speakMsg(m){
  ttsSpeak(m.text, {
    onStart: () => setSpeaking(m.id),
    onEnd: () => { if(session && session.speakingId === m.id) setSpeaking(null); },
  });
}

// ---------- turn state machine ----------

function currentTurn(){ return session.scenario.turns[session.index]; }
function scriptLine(){ const t = currentTurn(); return t && t.text ? t.text : ''; }

function advance(){
  clearTimeout(session.timer);
  const t = currentTurn();
  if(!t){ session.phase = 'done'; showTyping(false); renderInput(); return; }
  if(t.who === 'me'){
    session.phase = t.type === 'photo' ? 'photo' : 'user';
    showTyping(false);
    renderInput();
    return;
  }
  session.phase = 'typing';
  renderInput();
  showTyping(true);
  session.timer = setTimeout(() => {
    if(!ui) return;
    const m = { id: session.nextId++, who: 'bot', type: 'text', text: t.text };
    session.log.push(m);
    session.index++;
    appendMsg(m);
    if(session.autoRead) speakMsg(m);
    advance();
  }, TYPING_MS);
}

function commitUser(text, via){
  const t = currentTurn();
  const m = t.type === 'photo'
    ? { id: session.nextId++, who: 'me', type: 'photo' }
    : { id: session.nextId++, who: 'me', type: 'text', text, via };
  session.log.push(m);
  session.index++;
  appendMsg(m);
  updateRisk();
  advance();
}

// ---------- input bar ----------

function inputHtml(){
  const micAttrs = session.micDenied ? 'disabled title="마이크 권한이 없어 텍스트로만 가능해요"' : 'title="음성으로 말하기"';
  switch(session.phase){
    case 'user':
      return `<textarea id="msgText" rows="1" placeholder="메시지를 입력하거나 🎤로 말해보세요">${escapeHtml(scriptLine())}</textarea>
        <button class="mic-btn" id="micBtn" ${micAttrs}>🎤</button>
        <button class="send-btn" id="sendBtn" title="보내기">➤</button>`;
    case 'recording':
      return `<div class="rec-bar">
        <span class="rec-dot"></span><span class="rec-time" id="recTime">0:00</span>
        <canvas class="rec-wave" id="recWave"></canvas>
        <button class="stop-btn" id="stopBtn" title="정지">■</button>
      </div>`;
    case 'transcribing':
      return `<div class="rec-bar transcribing"><span class="spinner"></span>음성을 텍스트로 변환하는 중…</div>`;
    case 'photo':
      return `<button class="btn primary block" id="photoBtn">🖼️ 사진 첨부해서 보내기</button>`;
    case 'done':
      return `<button class="btn primary block" id="scenarioBack">다른 시나리오 보기</button>`;
    default: // 'typing' / 'idle'
      return `<textarea rows="1" disabled placeholder="AI 상담사가 답하는 중…"></textarea>
        <button class="mic-btn" disabled>🎤</button><button class="send-btn" disabled>➤</button>`;
  }
}

function renderInput(){
  const box = $('#chatInput');
  if(!box) return;
  box.innerHTML = inputHtml();
  box.className = `chat-input phase-${session.phase}`;
  const ta = box.querySelector('#msgText');
  if(ta){
    const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(96, ta.scrollHeight) + 'px'; };
    grow();
    ta.addEventListener('input', grow);
    ta.addEventListener('keydown', e => {
      if(e.key === 'Enter' && !e.shiftKey && !e.isComposing){ e.preventDefault(); sendText(); }
    });
    box.querySelector('#sendBtn').addEventListener('click', sendText);
    box.querySelector('#micBtn').addEventListener('click', startRecording);
  }
  const stop = box.querySelector('#stopBtn');
  if(stop) stop.addEventListener('click', stopRecording);
  const photo = box.querySelector('#photoBtn');
  if(photo) photo.addEventListener('click', () => commitUser('', 'photo'));
  const back = box.querySelector('#scenarioBack');
  if(back) back.addEventListener('click', () => { const onExit = ui.onExit; destroyChatSession(); onExit(); });
}

function sendText(){
  const ta = $('#msgText');
  if(!ta) return;
  const text = ta.value.trim();
  if(!text) return;
  commitUser(text, 'text');
}

async function startRecording(){
  if(session.phase !== 'user' || session.micDenied) return;
  const rec = new MicRecorder();
  ui.levels = [];
  try{
    await rec.start({ onLevel: onMicLevel });
  }catch(e){
    session.micDenied = true;
    toast('마이크 권한이 없어 텍스트로만 가능해요');
    renderInput();
    return;
  }
  if(!ui || session.phase !== 'user'){ rec.stop(); return; }
  ui.recorder = rec;
  session.phase = 'recording';
  renderInput();
}

function onMicLevel(rms, elapsedMs){
  if(!ui) return;
  ui.levels.push(rms);
  if(ui.levels.length > 64) ui.levels.shift();
  const wave = $('#recWave');
  if(wave) drawWaveform(wave, ui.levels);
  const time = $('#recTime');
  if(time) time.textContent = formatElapsed(elapsedMs);
}

function stopRecorder(){
  if(ui && ui.recorder){ ui.recorder.stop(); ui.recorder = null; }
}

function stopRecording(){
  if(!ui || !ui.recorder) return;
  const { rms } = ui.recorder.stop();
  ui.recorder = null;
  session.voiceRisk = voiceTremor(rms);
  session.phase = 'transcribing';
  renderInput();
  updateRisk();
  armTranscribe();
}

function armTranscribe(){
  clearTimeout(session.timer);
  renderInput();
  session.timer = setTimeout(() => { if(ui) commitUser(scriptLine(), 'voice'); }, TRANSCRIBE_MS);
}

// ---------- camera / affect strip ----------

function startCamera(){
  const video = $('#camVideo'), canvas = $('#camCanvas'), thumb = $('#camThumb');
  video.addEventListener('loadedmetadata', () => {
    if(video.videoWidth && video.videoHeight) thumb.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
  });
  ui.camera = new CameraSession({ video, canvas, onStatus: applyCamStatus, onFrame: applyFaceFrame });
  ui.camera.start();
}

function applyCamStatus(status){
  if(!ui) return;
  ui.camStatus = status;
  const state = $('#camState');
  state.textContent = CAM_STATE_TEXT[status] || '';
  state.hidden = !state.textContent;
  $('#camThumb').classList.toggle('tracking', status === 'tracking');
  if(status !== 'tracking'){
    session.face = { label: '—', sad: 0, anxious: 0, positive: 0, risk: 0 };
    refreshStrip(true);
  }
  const banner = $('#chatBanner');
  if(status === 'denied'){
    banner.className = 'chat-banner warn';
    banner.innerHTML = `<span>더 정확한 상담을 위해 카메라 권한을 허용해주세요</span><button id="camRetry">허용하기</button>
      ${ui.camRetried ? '<small>브라우저 주소창의 카메라 아이콘에서 권한을 허용한 뒤 다시 눌러주세요</small>' : ''}`;
    banner.hidden = false;
    banner.querySelector('#camRetry').addEventListener('click', () => { ui.camRetried = true; ui.camera.start(); });
  } else if(status === 'no-face'){
    banner.className = 'chat-banner info';
    banner.innerHTML = '<span>🙂 카메라에 얼굴을 비춰주세요</span>';
    banner.hidden = false;
  } else if(status === 'model-error'){
    banner.className = 'chat-banner warn';
    banner.innerHTML = '<span>얼굴 분석 모듈을 불러오지 못했어요. 네트워크를 확인해주세요</span>';
    banner.hidden = false;
  } else {
    banner.hidden = true;
  }
}

function applyFaceFrame({ blendshapes }){
  if(!ui) return;
  const a = faceAffect(blendshapes);
  const f = session.face;
  f.sad += (a.sad - f.sad) * FACE_EMA;
  f.anxious += (a.anxious - f.anxious) * FACE_EMA;
  f.positive += (a.positive - f.positive) * FACE_EMA;
  f.risk += (a.risk - f.risk) * FACE_EMA;
  // label from the smoothed values, same thresholds as faceAffect()
  const top = Math.max(f.sad, f.anxious, f.positive);
  f.label = top < 0.25 ? '중립' : top === f.sad ? '우울' : top === f.anxious ? '불안' : '긍정';
  refreshStrip(false);
}

function refreshStrip(force){
  if(!ui) return;
  const now = performance.now();
  if(!force && now - ui.lastStrip < STRIP_REFRESH_MS) return;
  ui.lastStrip = now;
  const f = session.face;
  $('#faceLabel').textContent = f.label;
  $('#faceSub').textContent = f.label === '—' ? '' : `우울 ${Math.round(f.sad * 100)}% · 불안 ${Math.round(f.anxious * 100)}% · 긍정 ${Math.round(f.positive * 100)}%`;
  updateRisk();
}

function updateRisk(){
  if(!ui) return;
  const text = textRisk(session.log.filter(m => m.who === 'me' && m.type === 'text').map(m => m.text));
  const face = Math.round(session.face.risk * 100) / 100;
  const r = combineRisk({ text, face, voice: session.voiceRisk });
  $('#barText').style.width = `${Math.round(text * 100)}%`;
  $('#barFace').style.width = `${Math.round(face * 100)}%`;
  $('#barVoice').style.width = `${Math.round(session.voiceRisk * 100)}%`;
  const lvl = $('#riskLevel');
  lvl.textContent = r.level;
  lvl.className = `badge ${r.level === 'L3' ? 'badge-l3' : r.level === 'L2' ? 'badge-l2' : 'badge-l1'}`;
  $('#riskScore').textContent = r.score.toFixed(2);
}
```

- [x] **Step 2: Append styles to `css/styles.css`**

```css
/* ---------- chat session: affect strip ---------- */
.affect-strip{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--line-soft);border-radius:var(--radius-md);background:var(--canvas);flex:none;}
.affect-strip.expanded{flex-wrap:wrap;}
.cam-thumb{position:relative;width:96px;aspect-ratio:4/3;border-radius:10px;overflow:hidden;background:#1a1d26;flex:none;cursor:pointer;transition:width .2s;}
.affect-strip.expanded .cam-thumb{width:100%;}
.cam-thumb video,.cam-thumb canvas{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scaleX(-1);}
.cam-thumb canvas{pointer-events:none;}
.cam-thumb.tracking{box-shadow:0 0 0 2px var(--p0);}
.cam-state{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;font-size:10px;color:#fff;background:rgba(20,20,30,.55);padding:4px;}
.affect-meta{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;}
.affect-face{font-size:12px;color:var(--ink-soft);}
.affect-face b{color:var(--ink);margin:0 6px 0 2px;}
.affect-face span{font-size:10.5px;color:var(--ink-faint);}
.abar{display:flex;align-items:center;gap:6px;font-size:10.5px;color:var(--ink-soft);}
.abar span{width:32px;flex:none;}
.abar i{flex:1;height:5px;border-radius:3px;background:var(--line-soft);overflow:hidden;display:block;}
.abar i b{display:block;height:100%;width:0;background:var(--accent);border-radius:3px;transition:width .3s;}
.risk-pill{display:flex;flex-direction:column;align-items:center;gap:2px;flex:none;}
.risk-pill small{font-size:10.5px;color:var(--ink-soft);font-weight:700;}
.risk-pill small.lbl{font-size:9.5px;color:var(--ink-faint);font-weight:400;}
.affect-note{font-size:10.5px;color:var(--ink-faint);text-align:center;padding:4px 0 6px;flex:none;}

/* banners */
.chat-banner{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:12px;padding:8px 12px;border-radius:var(--radius-sm);margin-bottom:8px;flex:none;}
.chat-banner.warn{background:var(--p1-bg);color:var(--p1);}
.chat-banner.info{background:var(--accent-soft);color:var(--accent-ink);}
.chat-banner span{flex:1;}
.chat-banner button{border:1px solid currentColor;background:none;color:inherit;border-radius:999px;padding:4px 10px;font-size:11px;font-weight:700;}
.chat-banner small{flex-basis:100%;font-size:10.5px;opacity:.8;}

/* messages */
.chat-system{align-self:center;max-width:90%;font-size:11px;color:var(--ink-soft);background:var(--canvas);border-radius:10px;padding:6px 12px;text-align:center;}
.msg{display:flex;flex-direction:column;max-width:82%;}
.msg.me{align-self:flex-end;align-items:flex-end;}
.msg.bot{align-self:flex-start;align-items:flex-start;}
.msg .bubble{max-width:100%;}
.msg .sender{font-size:10.5px;color:var(--ink-faint);margin:0 0 3px 4px;}
.msg .meta{display:flex;align-items:center;gap:6px;font-size:10.5px;color:var(--ink-faint);margin-top:3px;padding:0 4px;}
.tts-btn{border:none;background:none;font-size:10.5px;color:var(--ink-soft);padding:2px 4px;}
.speak-bars{display:none;align-items:flex-end;gap:2px;height:10px;}
.speak-bars i{width:3px;background:var(--accent);border-radius:2px;animation:speakBar .7s infinite ease-in-out;}
.speak-bars i:nth-child(2){animation-delay:.15s;}
.speak-bars i:nth-child(3){animation-delay:.3s;}
.msg.bot.speaking .speak-bars{display:inline-flex;}
.msg.bot.speaking .bubble{box-shadow:0 0 0 2px var(--accent-soft);}
@keyframes speakBar{0%,100%{height:3px;}50%{height:10px;}}

/* input bar */
.chat-footer .chip-row{margin-bottom:6px;}
.chat-input{display:flex;align-items:flex-end;gap:6px;min-height:44px;}
.chat-input textarea{flex:1;resize:none;border:1px solid var(--line);border-radius:22px;padding:10px 14px;font-size:13px;font-family:inherit;line-height:1.4;max-height:96px;background:var(--paper);}
.chat-input textarea:disabled{background:var(--canvas);color:var(--ink-faint);}
.mic-btn,.send-btn{width:40px;height:40px;border-radius:50%;border:none;flex:none;font-size:16px;display:flex;align-items:center;justify-content:center;}
.mic-btn{background:var(--canvas);color:var(--ink);}
.send-btn{background:var(--accent);color:#fff;}
.mic-btn:disabled,.send-btn:disabled{opacity:.4;cursor:not-allowed;}
.rec-bar{flex:1;display:flex;align-items:center;gap:8px;height:44px;padding:0 8px 0 12px;border-radius:22px;background:var(--danger-bg);color:var(--danger);font-size:12px;}
.rec-bar.transcribing{background:var(--accent-soft);color:var(--accent-ink);}
.rec-dot{width:9px;height:9px;border-radius:50%;background:var(--danger);animation:recPulse 1s infinite;}
@keyframes recPulse{0%,100%{opacity:1;}50%{opacity:.25;}}
.rec-time{font-variant-numeric:tabular-nums;font-weight:700;width:34px;}
.rec-wave{flex:1;height:28px;color:var(--danger);}
.stop-btn{width:32px;height:32px;border-radius:50%;border:none;background:var(--danger);color:#fff;font-size:12px;flex:none;}
.spinner{width:14px;height:14px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:spin .8s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}

/* header toggle + toast */
.tts-toggle{border:1px solid var(--line);background:var(--paper);border-radius:999px;padding:4px 8px;font-size:10.5px;color:var(--ink-faint);}
.tts-toggle.on{border-color:var(--accent);color:var(--accent);background:var(--accent-soft);}
.toast{position:absolute;left:50%;bottom:90px;transform:translateX(-50%);background:rgba(24,28,36,.92);color:#fff;font-size:12px;padding:8px 14px;border-radius:999px;z-index:5;animation:toastIn .2s ease-out;white-space:nowrap;}
@keyframes toastIn{from{opacity:0;transform:translate(-50%,6px);}to{opacity:1;transform:translate(-50%,0);}}
```

Also change the existing `.student-shell` rule to add `position:relative;` so `.toast` positions inside the phone frame:

```css
.student-shell{position:relative;max-width:430px;margin:0 auto;height:100vh;height:100dvh;background:var(--paper);display:flex;flex-direction:column;box-shadow:var(--shadow-md);}
```

- [x] **Step 3: Commit**

```bash
git add js/screens/chat-session.js css/styles.css
git commit -m "feat: add chat session player with voice input, TTS, camera affect strip"
```

---

### Task 7: Wire student.js to the new player; remove old chat player code

**Files:**
- Modify: `js/screens/student.js:11-180`

- [x] **Step 1: Replace the chat section**

Replace everything from `// ---------- Chat: scenario picker + player (F-02, P0) ----------` down to (and including) the `registerRoute('/student/chat', ...)` block with:

```js
import { mountChatSession, destroyChatSession } from './chat-session.js';
```
(place this import at the top with the other imports), and:

```js
// ---------- Chat: scenario picker + player (F-02, P0) ----------

const EXIT_BTN = '<button class="icon-btn" id="scenarioExit" title="목록으로">✕</button>';

let activeScenarioId = null;   // null => picker screen
let revealCount = 0;           // survey: questions revealed so far
let surveyHighlighted = false; // survey: current question's answer currently highlighted
let playing = true;
let playTimer = null;

function resetPlaybackState(){
  clearTimeout(playTimer);
  revealCount = 0;
  surveyHighlighted = false;
  playing = true;
}

function exitScenario(root, path){
  clearTimeout(playTimer);
  destroyChatSession();
  activeScenarioId = null;
  resetPlaybackState();
  renderChat(root, path);
}

function restartSurvey(root, path, scenario){
  resetPlaybackState();
  renderChat(root, path);
  scheduleSurveyNext(root, path, scenario);
}

function scheduleSurveyNext(root, path, scenario){
  clearTimeout(playTimer);
  if(!playing || revealCount >= scenario.questions.length) return;
  if(!surveyHighlighted){
    playTimer = setTimeout(()=>{
      if(location.hash.slice(1) !== path) return;
      surveyHighlighted = true;
      renderChat(root, path);
      scheduleSurveyNext(root, path, scenario);
    }, 500);
  } else {
    playTimer = setTimeout(()=>{
      if(location.hash.slice(1) !== path) return;
      surveyHighlighted = false;
      revealCount++;
      renderChat(root, path);
      scheduleSurveyNext(root, path, scenario);
    }, 900);
  }
}

function bindSurveyControls(root, path, scenario, finished){
  root.querySelector('#scenarioExit').addEventListener('click', ()=>exitScenario(root, path));
  if(finished){
    root.querySelector('#scenarioBack').addEventListener('click', ()=>exitScenario(root, path));
    return;
  }
  root.querySelector('#scenarioPause').addEventListener('click', ()=>{
    clearTimeout(playTimer);
    playing = !playing;
    renderChat(root, path);
    if(playing) scheduleSurveyNext(root, path, scenario);
  });
  root.querySelector('#scenarioRestart').addEventListener('click', ()=>restartSurvey(root, path, scenario));
}

function renderScenarioPicker(root, path){
  const body = SCENARIOS.map(s => `
    <div class="scenario-card" data-scenario="${s.id}">
      <div class="emoji">${s.emoji}</div>
      <div class="grow"><b>${s.title}</b><span>${s.subtitle}</span></div>
      <div class="chev">›</div>
    </div>`).join('');
  renderStudent(root, path, body, {
    title:'다솜이',
    headerExtra:'<button class="icon-btn" data-go="/student/settings">⚙</button>',
  });
  root.querySelectorAll('[data-scenario]').forEach(el =>
    el.addEventListener('click', ()=>{
      const scenario = SCENARIOS.find(s => s.id === el.dataset.scenario);
      activeScenarioId = scenario.id;
      resetPlaybackState();
      renderChat(root, path);
      if(scenario.type === 'survey') scheduleSurveyNext(root, path, scenario);
    }));
}

function renderSurveyPlayer(root, path, scenario){
  const finished = revealCount >= scenario.questions.length;
  let body;
  if(finished){
    const { categories, topCategory } = scoreSurvey(scenario.questions);
    body = `
      <div class="survey-summary">
        <p style="color:var(--ink-soft);font-size:13px;">다솜이의 이번 설문 결과가 정리됐어요</p>
        <div class="summary-row">
          ${categories.map(c=>`<div class="summary-box"><div class="num">${c.avg}</div><div class="lbl">${c.name}</div></div>`).join('')}
        </div>
        <p style="font-size:12.5px;color:var(--ink-soft);">${topCategory} 영역 점수가 다른 영역보다 조금 높아요.</p>
        <p style="font-size:12.5px;color:var(--ink-soft);margin-top:10px;">${scenario.outro}</p>
        <button class="btn primary block" id="scenarioBack" style="margin-top:14px;">다른 시나리오 보기</button>
      </div>`;
    renderStudent(root, path, body, { title: scenario.title, headerExtra: EXIT_BTN, hideTabs:true });
  } else {
    const q = scenario.questions[revealCount];
    body = `
      <div class="progress-track"><div class="progress-fill" style="width:${((revealCount+1)/scenario.questions.length)*100}%;"></div></div>
      <p style="color:var(--ink-soft);font-size:12px;">${q.category}</p>
      <h3 style="font-size:15px;">${escapeHtml(q.text)}</h3>
      <div class="likert-row">
        ${scenario.scaleOptions.map((opt,i)=>`<button class="${surveyHighlighted && i===q.answerIndex ? 'selected':''}">${opt}</button>`).join('')}
      </div>
      <div class="scenario-controls" style="margin-top:20px;">
        <button id="scenarioPause">${playing ? '⏸ 일시정지' : '▶ 재생'}</button>
        <button id="scenarioRestart">↺ 처음부터</button>
      </div>`;
    renderStudent(root, path, body, { title: scenario.title, headerExtra: EXIT_BTN, hideTabs:true });
  }
  bindSurveyControls(root, path, scenario, finished);
}

function renderChat(root, path){
  if(!activeScenarioId){ renderScenarioPicker(root, path); return; }
  const scenario = SCENARIOS.find(s => s.id === activeScenarioId);
  if(scenario.type === 'survey') renderSurveyPlayer(root, path, scenario);
  else mountChatSession(root, path, scenario, { onExit: () => exitScenario(root, path) });
}

function resumeSurveyIfNeeded(root, path){
  if(!activeScenarioId || !playing) return;
  const scenario = SCENARIOS.find(s => s.id === activeScenarioId);
  if(!scenario || scenario.type !== 'survey') return;
  if(revealCount < scenario.questions.length) scheduleSurveyNext(root, path, scenario);
}

registerRoute('/student/chat', (root, path) => {
  renderChat(root, path);
  resumeSurveyIfNeeded(root, path);
});
```

- [x] **Step 2: Run the node tests**

Run: `node js/data.test.js && node js/scenarios.test.js && node js/affect.test.js`
Expected: three "passed" lines.

- [x] **Step 3: Syntax-check every browser module without a DOM**

Run: `for f in js/media/tts.js js/media/recorder.js js/media/camera.js js/screens/chat-session.js js/screens/student.js; do node --check "$f" && echo "ok $f"; done`
Expected: `ok` for each file.

- [x] **Step 4: Commit**

```bash
git add js/screens/student.js
git commit -m "feat: route chat scenarios through the new voice/camera chat session"
```

---

### Task 8: Browser verification

**Files:** none (verification only)

- [x] **Step 1: Start the static preview** (`.claude/launch.json` → `static`, port 4173) and open `#/student/chat`.

- [x] **Step 2: Picker → 학교폭력 피해.** Confirm: header shows `🔊 자동읽기 / ↺ / ✕`; the affect strip renders with the camera thumb; the privacy system notice is the first log item; the input bar is prefilled with the first `me` line; console has no errors.

- [x] **Step 3: Camera states.** With permission granted and a face in view: thumbnail shows landmark overlay, green ring on the thumb, `표정` label updates, no banner. Cover the camera: after ~1s the "카메라에 얼굴을 비춰주세요" banner appears and disappears when the face is back. With permission denied: "더 정확한 상담을 위해 카메라 권한을 허용해주세요" banner with a 허용하기 button.

- [x] **Step 4: Text turn.** Click ➤ → me bubble appears; typing indicator → bot bubbles (two in a row for the violence script). Text bar in the strip rises (`때렸` → 0.80), risk pill updates.

- [x] **Step 5: Voice turn.** Click 🎤 → recording bar (red dot, timer, moving waveform). Click ■ → "음성을 텍스트로 변환하는 중…" → me bubble with "🎤 음성으로 말함" meta → bot continues. 음성 bar > 0.

- [x] **Step 6: Photo turn.** Input bar shows "🖼️ 사진 첨부해서 보내기" → click → photo bubble → bot continues.

- [x] **Step 7: TTS.** Click 🔊 듣기 on a bot bubble → button turns to ⏹ 정지 and bars animate; ends automatically. Toggle 🔊 자동읽기 → next bot bubble is read automatically.

- [x] **Step 8: Finish + lifecycle.** After the last turn the input bar shows "다른 시나리오 보기" → returns to the picker and the camera light goes off. Mid-session, switch to `#/student/tests` and back: log and phase are intact, camera restarts.

- [x] **Step 9: Mark plan tasks complete and commit**

```bash
git add docs/superpowers/plans/2026-09-10-audio-chat-affect.md
git commit -m "docs: mark audio chat / affect plan tasks complete"
```
