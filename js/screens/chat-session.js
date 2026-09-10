// Chat-type scenario player with text/voice input, TTS, always-on camera affect strip,
// and a simulated multimodal risk score. Renders its frame once per mount and patches
// #chatLog / #chatInput / strip regions so <video>/<canvas> nodes persist.
import { renderStudent } from '../router.js';
import { escapeHtml } from '../components.js';
import { CameraSession } from '../media/camera.js';
import { MicRecorder, drawWaveform, formatElapsed } from '../media/recorder.js';
import { speak as ttsSpeak, cancel as ttsCancel } from '../media/tts.js';
import { textRisk, faceAffect, affectLabel, voiceTremor, combineRisk } from '../affect.js';

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
  const { scenario, autoRead, micDenied } = session;
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
  root.querySelector('#scenarioExit').addEventListener('click', exitToPicker);
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

function exitToPicker(){
  const onExit = ui.onExit;
  destroyChatSession();
  onExit();
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
  if(back) back.addEventListener('click', exitToPicker);
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
  f.label = affectLabel(f.sad, f.anxious, f.positive);
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
