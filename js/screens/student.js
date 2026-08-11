import { registerRoute, renderStudent, navigate } from '../router.js';
import {
  classifyIntent, isCrisisText, CHAT_TEMPLATES,
  appendChat, appendCheckin, getState,
  PHQ9_QUESTIONS, PHQ9_OPTIONS, scorePhq9, savePhq9Result,
} from '../data.js';
import { comingSoonBody } from '../components.js';

function escapeHtml(s){ return s.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function pick(list){ return list[Math.floor(Math.random()*list.length)]; }

// ---------- Chat (F-02/F-22, P0) ----------

const SEED_CHAT = [
  { who:'bot', text:'요즘 마음이 우울했구나. 어떤 문제 때문에 힘들어?' },
  { who:'me', text:'학교 생활이 괴로워' },
  { who:'bot', text:'이런.. 무슨 일 있었는지 자세히 말해줄 수 있어?' },
  { who:'me', text:'친구들하고 어울리기 힘들어..' },
  { who:'bot', text:'힘들었겠다. 더 말해줄래?' },
];

function chatHistory(){
  const state = getState();
  return [...SEED_CHAT, ...state.chat];
}

function renderChat(root, path){
  const history = chatHistory();
  const body = `
    <div class="chat-scroll" id="chatScroll">
      ${history.map(m=>`<div class="bubble ${m.who==='me'?'me':'bot'}">${escapeHtml(m.text)}</div>`).join('')}
    </div>
    <div class="chat-footer">
      <div>
        <span class="chip disabled">컨텐츠를 추천해요 (P2)</span>
        <span class="chip on" id="crisisChip">상담 요청하기</span>
      </div>
      <div class="chat-inputbar">
        <span title="음성입력(F-22, 구현예정)">🎙</span>
        <input id="chatInput" placeholder="너의 이야기를 들려줘" />
        <button id="chatSend">➤</button>
      </div>
    </div>`;
  renderStudent(root, path, body, {
    title:'다솜이',
    headerExtra:'<button class="icon-btn" data-go="/student/settings">⚙</button>',
    bodyClass:'chat-body',
  });

  root.querySelector('#crisisChip').addEventListener('click', ()=>navigate('/student/crisis'));
  const input = root.querySelector('#chatInput');
  const send = ()=>{
    const text = input.value.trim();
    if(!text) return;
    appendChat({ who:'me', text });
    const reply = isCrisisText(text)
      ? '많이 힘들었겠다. 상담사 선생님께 바로 알려드렸어. 곧 연락드릴 거야. 지금 이 순간이 힘들면 1388로 전화해도 괜찮아.'
      : pick(CHAT_TEMPLATES[classifyIntent(text)]);
    appendChat({ who:'bot', text: reply });
    input.value = '';
    renderChat(root, path);
  };
  root.querySelector('#chatSend').addEventListener('click', send);
  input.addEventListener('keydown', e=>{ if(e.key==='Enter') send(); });
  const scroll = root.querySelector('#chatScroll');
  scroll.scrollTop = scroll.scrollHeight;
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
