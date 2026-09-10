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
