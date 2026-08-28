import { registerRoute, renderStudent, navigate } from '../router.js';
import {
  appendCheckin, getState,
  PHQ9_QUESTIONS, PHQ9_OPTIONS, scorePhq9, savePhq9Result,
} from '../data.js';
import { comingSoonBody } from '../components.js';
import { SCENARIOS, scoreSurvey } from '../scenarios.js';

function escapeHtml(s){ return s.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// ---------- Chat: scenario picker + player (F-02, P0) ----------

const EXIT_BTN = '<button class="icon-btn" id="scenarioExit" title="목록으로">✕</button>';
const TYPING_MS = 800;

let activeScenarioId = null;   // null => picker screen
let revealCount = 0;           // turns (chat) or questions (survey) revealed so far
let showTyping = false;        // chat: typing indicator currently shown
let surveyHighlighted = false; // survey: current question's answer currently highlighted
let playing = true;
let playTimer = null;

function turnDelay(turn){
  const len = (turn.text || '').length;
  return Math.min(1200, 800 + len * 6);
}

function turnBubbleHtml(turn){
  if(turn.type === 'photo'){
    return `<div class="bubble ${turn.who} photo">
      <div class="photo-thumb">🖼️</div>
      <div class="photo-filename">사진.jpg</div>
    </div>`;
  }
  return `<div class="bubble ${turn.who}">${escapeHtml(turn.text)}</div>`;
}

function resetPlaybackState(){
  clearTimeout(playTimer);
  revealCount = 0;
  showTyping = false;
  surveyHighlighted = false;
  playing = true;
}

function exitScenario(root, path){
  clearTimeout(playTimer);
  activeScenarioId = null;
  resetPlaybackState();
  renderChat(root, path);
}

function restartScenario(root, path, scenario){
  resetPlaybackState();
  renderChat(root, path);
  startPlayback(root, path, scenario);
}

function startPlayback(root, path, scenario){
  if(scenario.type === 'survey') scheduleSurveyNext(root, path, scenario);
  else scheduleNext(root, path, scenario);
}

function scheduleNext(root, path, scenario){
  clearTimeout(playTimer);
  if(!playing || revealCount >= scenario.turns.length) return;
  const next = scenario.turns[revealCount];
  if(next.who === 'bot' && !showTyping){
    showTyping = true;
    renderChat(root, path);
    playTimer = setTimeout(()=>{
      if(location.hash.slice(1) !== path) return;
      showTyping = false;
      revealCount++;
      renderChat(root, path);
      scheduleNext(root, path, scenario);
    }, TYPING_MS);
  } else {
    playTimer = setTimeout(()=>{
      if(location.hash.slice(1) !== path) return;
      revealCount++;
      renderChat(root, path);
      scheduleNext(root, path, scenario);
    }, turnDelay(next));
  }
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

function bindPlayerControls(root, path, scenario, finished){
  root.querySelector('#scenarioExit').addEventListener('click', ()=>exitScenario(root, path));
  if(finished){
    root.querySelector('#scenarioBack').addEventListener('click', ()=>exitScenario(root, path));
    return;
  }
  root.querySelector('#scenarioPause').addEventListener('click', ()=>{
    clearTimeout(playTimer);
    playing = !playing;
    renderChat(root, path);
    if(playing) startPlayback(root, path, scenario);
  });
  root.querySelector('#scenarioRestart').addEventListener('click', ()=>restartScenario(root, path, scenario));
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
      startPlayback(root, path, scenario);
    }));
}

function renderChatPlayer(root, path, scenario){
  const finished = revealCount >= scenario.turns.length;
  const shown = scenario.turns.slice(0, revealCount).map(turnBubbleHtml).join('');
  const typingHtml = showTyping ? `<div class="bubble bot typing"><span></span><span></span><span></span></div>` : '';
  const controlsHtml = finished
    ? `<button class="btn primary block" id="scenarioBack" style="margin-top:8px;">다른 시나리오 보기</button>`
    : `<div class="scenario-controls">
         <button id="scenarioPause">${playing ? '⏸ 일시정지' : '▶ 재생'}</button>
         <button id="scenarioRestart">↺ 처음부터</button>
       </div>`;
  const body = `
    <div class="chat-scroll" id="chatScroll">${shown}${typingHtml}</div>
    <div class="chat-footer">
      <div>
        <span class="chip disabled">컨텐츠를 추천해요</span>
        <span class="chip disabled">상담 요청하기</span>
      </div>
      ${controlsHtml}
    </div>`;
  renderStudent(root, path, body, { title: scenario.title, headerExtra: EXIT_BTN, bodyClass:'chat-body', hideTabs:true });
  bindPlayerControls(root, path, scenario, finished);
  const scroll = root.querySelector('#chatScroll');
  if(scroll) scroll.scrollTop = scroll.scrollHeight;
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
  bindPlayerControls(root, path, scenario, finished);
}

function renderChat(root, path){
  if(!activeScenarioId){ renderScenarioPicker(root, path); return; }
  const scenario = SCENARIOS.find(s => s.id === activeScenarioId);
  if(scenario.type === 'survey') renderSurveyPlayer(root, path, scenario);
  else renderChatPlayer(root, path, scenario);
}

registerRoute('/student/chat', renderChat);

// ---------- Check-in (F-03, P0) ----------

const MOODS = ['😢','😟','😐','🙂','😄'];
let selectedMood = null;

function renderCheckin(root, path){
  const body = `
    <div style="text-align:center;">
      <p style="color:var(--ink-soft);font-size:13px;">오늘 기분은 어때?</p>
      <div class="mood-row">
        ${MOODS.map((m,i)=>`<button class="mood-btn ${selectedMood===i?'selected':''}" data-mood="${i}">${m}</button>`).join('')}
      </div>
      <textarea class="textarea" id="checkinNote" placeholder="오늘 있었던 일을 적어보세요 (선택)"></textarea>
      <button class="btn primary block" id="checkinSave" style="margin-top:12px;">저장</button>
    </div>`;
  renderStudent(root, path, body, { title:'오늘의 기분 체크인', back:'/student/chat' });

  root.querySelectorAll('[data-mood]').forEach(b=>
    b.addEventListener('click', ()=>{ selectedMood = Number(b.dataset.mood); renderCheckin(root, path); }));
  root.querySelector('#checkinSave').addEventListener('click', ()=>{
    if(selectedMood===null){ alert('기분을 선택해주세요'); return; }
    appendCheckin({ mood: selectedMood, note: root.querySelector('#checkinNote').value, at: new Date().toISOString() });
    selectedMood = null;
    alert('저장했어요!');
    navigate('/student/chat');
  });
}

registerRoute('/student/checkin', renderCheckin);

// ---------- Self-tests list, PHQ-9 taking, PHQ-9 result (F-04/F-25, P0) ----------

function renderTests(root, path){
  const body = `
    <div style="margin-bottom:10px;">
      <span class="chip on">전체</span><span class="chip disabled">심리</span><span class="chip disabled">관계</span>
      <span class="chip disabled">진로</span><span class="chip disabled">학업</span><span class="chip disabled">중독</span>
    </div>
    <div class="test-row" data-go="/student/tests/take">
      <div class="thumb">📝</div>
      <div class="grow"><b>정서 검사 (PHQ-9)</b><div class="sub">9문항 · 3분 · 9번 문항 위기 오버라이드</div></div>
      <span class="badge badge-l1">P0</span>
    </div>
    <div class="test-row locked"><div class="thumb">🔒</div><div class="grow"><b>자살 생각 및 행동 척도</b><div class="sub">24종 확장 포함 · 준비 중</div></div><span class="badge badge-lock">P2</span></div>
    <div class="test-row locked"><div class="thumb">🔒</div><div class="grow"><b>또래관계 척도</b><div class="sub">관계 · 5분 · 준비 중</div></div><span class="badge badge-lock">P2</span></div>
    <div class="test-row locked"><div class="thumb">🔒</div><div class="grow"><b>학습유형검사</b><div class="sub">학업 · 4분 · 준비 중</div></div><span class="badge badge-lock">P2</span></div>
    <div class="test-row locked"><div class="thumb">🔒</div><div class="grow"><b>직업흥미검사</b><div class="sub">진로 · 6분 · 준비 중</div></div><span class="badge badge-lock">P2</span></div>
    <p style="text-align:center;color:var(--ink-soft);font-size:12px;margin-top:10px;">+ 24종의 다양한 자가진단 검사 (P2 로드맵)</p>`;
  renderStudent(root, path, body, { title:'자가진단검사' });
  root.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click', ()=>navigate(b.dataset.go)));
  root.querySelectorAll('.test-row.locked').forEach(b=>b.addEventListener('click', ()=>alert('준비 중인 검사입니다.')));
}

let phq9Index = 0;
let phq9Answers = [];

function renderPhq9Take(root, path){
  if(phq9Index===0) phq9Answers = [];
  const q = PHQ9_QUESTIONS[phq9Index];
  const body = `
    <div class="progress-track"><div class="progress-fill" style="width:${((phq9Index+1)/9)*100}%;"></div></div>
    <p style="color:var(--ink-soft);font-size:12px;">지난 2주 동안, 다음 문제로 얼마나 자주 불편함을 느끼셨나요?</p>
    <h3 style="font-size:15px;">${q}</h3>
    <div class="likert-row">
      ${PHQ9_OPTIONS.map((opt,i)=>`<button data-score="${i}">${opt}</button>`).join('')}
    </div>`;
  renderStudent(root, path, body, { title:`PHQ-9 · ${phq9Index+1}/9`, back:'/student/tests', hideTabs:true });
  root.querySelectorAll('[data-score]').forEach(b=>
    b.addEventListener('click', ()=>{
      phq9Answers[phq9Index] = Number(b.dataset.score);
      phq9Index++;
      if(phq9Index>=9){
        const result = scorePhq9(phq9Answers);
        savePhq9Result(result);
        phq9Index = 0;
        navigate('/student/tests/result');
      } else {
        renderPhq9Take(root, path);
      }
    }));
}

function renderPhq9Result(root, path){
  const state = getState();
  const result = state.phq9 || { total:0, band:'정상', override:false };
  const body = `
    <div style="text-align:center;">
      ${result.override ? '<span class="badge badge-l2">상담사 확인 중</span>' : ''}
      <h2 style="margin:14px 0 6px;">${result.total} / 27점 · ${result.band}</h2>
      <p style="color:var(--ink-soft);font-size:13px;">결과는 상담사에게도 함께 전달돼요. 필요하면 상담사가 먼저 연락할 수 있어요.</p>
      <button class="btn primary block" id="phq9Ok" style="margin-top:14px;">확인</button>
    </div>`;
  renderStudent(root, path, body, { title:'검사 결과', hideTabs:true });
  root.querySelector('#phq9Ok').addEventListener('click', ()=>navigate('/student/tests'));
}

registerRoute('/student/tests', renderTests);
registerRoute('/student/tests/take', renderPhq9Take);
registerRoute('/student/tests/result', renderPhq9Result);

// ---------- Crisis request (F-09/F-10/F-34, P1) ----------

function renderCrisis(root, path){
  const body = `
    <div class="card solid">
      <b style="font-size:14px;">상담사에게 요청을 보냈어요</b>
      <p style="font-size:12.5px;color:var(--ink-soft);margin:6px 0 10px;">담당 상담사가 확인 중이에요. 확인되는 대로 채팅으로 먼저 연락드릴게요.</p>
      <span class="badge badge-l2">상담사 확인 중</span>
    </div>
    <p class="section-label">언제든 이용 가능해요</p>
    <div class="card">
      <b style="font-size:13px;">1388 청소년 상담전화</b>
      <p style="font-size:12px;color:var(--ink-soft);margin:4px 0 0;">24시간 운영 · 급할 때는 바로 전화해도 괜찮아요</p>
    </div>`;
  renderStudent(root, path, body, { title:'상담 요청', back:'/student/chat' });
}

registerRoute('/student/crisis', renderCrisis);

// ---------- Settings / consent withdrawal (F-33, P0) ----------

function renderSettings(root, path){
  const body = `
    <p class="section-label">계정</p>
    <div class="list-row"><span class="grow">아이디</span><span class="sub">student1</span></div>
    <div class="list-row"><span class="grow">소속 그룹</span><span class="sub">1학년 2반</span></div>
    <p class="section-label">개인정보</p>
    <div class="list-row"><span class="grow">데이터 수집 및 이용 동의</span><span class="sub" id="consentStatus" style="color:var(--p0);">동의함</span></div>
    <button class="btn danger block" id="withdrawBtn" style="margin-top:6px;">동의 철회하기</button>
    <p style="font-size:11.5px;color:var(--ink-soft);margin-top:6px;">철회 시 AI 상담·검사 등 핵심 기능 이용이 즉시 제한됩니다.</p>
    <p class="section-label">계정 관리</p>
    <button class="btn ghost block" id="logoutBtn">로그아웃</button>`;
  renderStudent(root, path, body, { title:'설정', back:'/student/chat' });

  root.querySelector('#withdrawBtn').addEventListener('click', ()=>{
    if(confirm('동의를 철회하면 AI 상담·검사 등 핵심 기능 이용이 즉시 제한됩니다. 철회하시겠어요?')){
      root.querySelector('#consentStatus').textContent = '철회함';
      root.querySelector('#consentStatus').style.color = 'var(--danger)';
      root.querySelector('#withdrawBtn').disabled = true;
    }
  });
  root.querySelector('#logoutBtn').addEventListener('click', ()=>navigate('/select'));
}

registerRoute('/student/settings', renderSettings);

// ---------- P2 coming-soon screens ----------

registerRoute('/student/persona', (root, path) => renderStudent(root, path, comingSoonBody('닉네임 · 페르소나 설정', 'F-21'), { title:'다솜이 설정', back:'/student/chat' }));
registerRoute('/student/diary', (root, path) => renderStudent(root, path, comingSoonBody('감정일기', 'F-24'), { title:'감정일기' }));
registerRoute('/student/testresult', (root, path) => renderStudent(root, path, comingSoonBody('검사 결과 리포트 (24종 통합)', 'F-26'), { title:'검사 리포트', back:'/student/tests' }));
registerRoute('/student/letter', (root, path) => renderStudent(root, path, comingSoonBody('마음편지함', 'F-23'), { title:'보관함', back:'/student/chat' }));
registerRoute('/student/report', (root, path) => renderStudent(root, path, comingSoonBody('주간 리포트', 'F-27'), { title:'주간 리포트' }));
