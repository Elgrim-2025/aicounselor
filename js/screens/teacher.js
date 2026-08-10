import { registerRoute, renderTeacher, navigate } from '../router.js';
import {
  STUDENTS, ALERTS, AUDIT_LOG, KEYWORDS, THRESHOLDS,
  timeLeftLabel, verifyChain,
} from '../data.js';
import { comingSoonBody, openReasonDialog } from '../components.js';

function levelBadge(level, locked){
  const cls = level==='L3'?'badge-l3':level==='L2'?'badge-l2':'badge-l1';
  return `<span class="badge ${cls}">${level}</span>${locked?' <span class="badge badge-lock">🔒</span>':''}`;
}

// ---------- Dashboard (F-12/F-28, P0) ----------

function renderDashboard(root, path){
  const rows = [...STUDENTS].sort((a,b)=> (b.level>a.level?1:-1));
  const body = `
    <p style="font-size:13px;">홍길동님, 3월에 구성원은 534건의 대화를 했어요 😊</p>
    <div class="kpi-row">
      <div class="kpi"><div class="lbl">AI 상담대화 위험감지</div><div class="num">23건</div></div>
      <div class="kpi"><div class="lbl">자가진단 위험감지</div><div class="num">14건</div></div>
      <div class="kpi"><div class="lbl">전체 구성원</div><div class="num">234명</div></div>
    </div>
    <p class="section-label">위험감지 타임라인 (F-28)</p>
    <div class="bars">
      ${[30,50,20,60,40,25,70,35,45,15].map(h=>`<div style="height:${h}%" class="${h>=60?'hi':''}"></div>`).join('')}
    </div>
    <p class="section-label">학생 현황 리스트 (F-12)</p>
    <table class="data-table">
      <tr><th>가명 ID</th><th>등급</th><th>최근 산출</th><th>추이</th></tr>
      ${rows.map(s=>`<tr class="clickable" data-go="/teacher/students/${s.id}">
        <td>${s.id}</td><td>${levelBadge(s.level, s.locked)}</td><td>${s.lastAt}</td><td>${s.spark.map(v=>'▁▂▃▅█▇'[Math.min(v,5)]).join('')}</td>
      </tr>`).join('')}
    </table>`;
  renderTeacher(root, path, body);
  root.querySelectorAll('[data-go]').forEach(el=>el.addEventListener('click', ()=>navigate(el.dataset.go)));
}

registerRoute('/teacher/dashboard', renderDashboard);

// ---------- Alert center (F-13, P0) ----------

function renderAlerts(root, path){
  const body = `
    <b style="font-size:15px;">알림 센터</b>
    ${ALERTS.map(a=>`
      <div class="alert-card ${a.level==='L3'?'critical':''}">
        <div class="top">
          <b style="${a.level==='L3'?'color:var(--danger);':''}font-size:13px;">${a.level==='L3'?'🚨 최우선 경보 · ':''}${a.student}</b>
          <span class="badge ${a.level==='L3'?'badge-l3':'badge-l2'}">${a.level} · ${a.method}${a.level==='L3'?' 🔒':''}</span>
        </div>
        <p style="font-size:11.5px;color:var(--ink-soft);margin:6px 0;">${a.at}${a.prob?` · 보정확률 ${a.prob} (CI ${a.ci})`:''}</p>
        ${a.shap ? `<p style="font-size:12px;">SHAP 근거: ${a.shap.join(' · ')}</p>` : (a.note?`<p style="font-size:12px;">${a.note}</p>`:'')}
        <div style="display:flex;gap:6px;margin-top:8px;">
          <button class="btn primary" data-ack="${a.id}">확인</button>
          <button class="btn" data-go="/teacher/session/${a.student}">상담 연계</button>
          <button class="btn ghost" data-fp="${a.id}">오탐 신고</button>
          <button class="btn danger" data-unlock="${a.student}">등급 잠금 해제</button>
        </div>
      </div>`).join('')}
  `;
  renderTeacher(root, path, body);
  root.querySelectorAll('[data-go]').forEach(el=>el.addEventListener('click', ()=>navigate(el.dataset.go)));
  root.querySelectorAll('[data-ack]').forEach(el=>el.addEventListener('click', ()=>alert('확인 처리되었습니다.')));
  root.querySelectorAll('[data-fp]').forEach(el=>el.addEventListener('click', ()=>alert('오탐 신고가 접수되었습니다.')));
  root.querySelectorAll('[data-unlock]').forEach(el=>el.addEventListener('click', ()=>{
    openReasonDialog({
      title:`${el.dataset.unlock} 등급 잠금 해제`,
      message:'KEYWORD_OVERRIDE / PHQ9_ITEM9_OVERRIDE 잠금은 사유 입력 후에만 해제할 수 있습니다.',
      onConfirm:(reason)=> alert(`잠금 해제됨. 사유: ${reason}`),
    });
  }));
}

registerRoute('/teacher/alerts', renderAlerts);

// ---------- Student detail + list (F-14/F-12, P0/P1) ----------

function renderStudentDetail(root, path, id){
  const s = STUDENTS.find(x=>x.id===id) || STUDENTS[0];
  const body = `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <b style="font-size:16px;">${s.id} · 마음 현황</b>
      ${levelBadge(s.level, s.locked)}
    </div>
    <p class="section-label">4개 변수 시계열 (기저선 밴드 오버레이)</p>
    <div style="height:120px;border:1px solid var(--line-soft);border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;color:var(--ink-soft);font-size:11px;background:var(--canvas);">부정정서어 / 심야접속 / 응답지연 / PHQ-9 라인차트</div>
    <p class="section-label">SHAP 근거 (F-08)</p>
    <div class="card" style="margin-bottom:8px;">최근 4주 부정 정서어 빈도 기저 대비 38% 상승</div>
    <div class="card" style="margin-bottom:8px;">야간 접속 비율 2.2배 증가</div>
    <div class="card">PHQ-9 5점 악화 (9번 문항 2점 → 위기 오버라이드)</div>
    <p class="section-label">PHQ-9 이력</p>
    <table class="data-table">
      <tr><th>일자</th><th>총점</th><th>9번 문항</th></tr>
      <tr><td>2026.03.12</td><td>8</td><td style="color:var(--danger);font-weight:700;">2</td></tr>
      <tr><td>2026.02.10</td><td>5</td><td>0</td></tr>
    </table>`;
  renderTeacher(root, path, body);
}

function renderStudentList(root, path){
  const body = `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <b style="font-size:15px;">학생 관리</b>
      <input id="studentSearch" placeholder="가명 ID 검색" style="border:1px solid var(--line);border-radius:var(--radius-sm);padding:8px 10px;font-size:12.5px;width:200px;" />
    </div>
    <table class="data-table" id="studentTable" style="margin-top:12px;">
      <tr><th>가명 ID</th><th>그룹</th><th>등급</th><th>최근 산출</th></tr>
      ${STUDENTS.map(s=>`<tr class="clickable" data-go="/teacher/students/${s.id}"><td>${s.id}</td><td>${s.group}</td><td>${levelBadge(s.level, s.locked)}</td><td>${s.lastAt}</td></tr>`).join('')}
    </table>`;
  renderTeacher(root, path, body);
  root.querySelectorAll('[data-go]').forEach(el=>el.addEventListener('click', ()=>navigate(el.dataset.go)));
  root.querySelector('#studentSearch').addEventListener('input', (e)=>{
    const q = e.target.value.trim().toUpperCase();
    root.querySelectorAll('#studentTable tr[data-go]').forEach(tr=>{
      tr.style.display = tr.children[0].textContent.toUpperCase().includes(q) ? '' : 'none';
    });
  });
}

registerRoute('/teacher/students', renderStudentList);
registerRoute('/teacher/students/:id', renderStudentDetail);

// ---------- Counseling session + RAG sidebar (F-15/F-16/F-17, P1) ----------

function renderSession(root, path, studentId){
  const body = `
    <div class="session-layout">
      <div class="session-chat">
        <b style="font-size:14px;margin-bottom:10px;">상담 세션 · ${studentId}</b>
        <div class="bubble bot">요즘 학교에서 어떤 게 제일 힘들어?</div>
        <div class="bubble me" style="align-self:flex-end;">그냥 다 의미 없는 것 같아요.. 사라지고 싶어요</div>
        <div style="flex:1;"></div>
        <input placeholder="메시지 입력" style="border:1px solid var(--line);border-radius:999px;padding:10px 14px;font-size:13px;" />
      </div>
      <div class="session-rag">
        <span class="badge badge-l1" style="margin-bottom:8px;">P1 · 여유시 기능</span>
        <b style="font-size:12.5px;display:block;margin-bottom:8px;">개입기법 추천 (F-16/17)</b>
        <div class="card" style="margin-bottom:8px;">
          <b style="font-size:12px;">안전 점검 체크리스트</b>
          <p style="font-size:11.5px;color:var(--ink-soft);margin:4px 0 0;">자살 위험 요인 즉시 평가 절차. 승인 매뉴얼 §3 발췌.</p>
        </div>
        <div class="card" style="border-color:var(--p1);background:var(--p1-bg);">
          <b style="font-size:11.5px;color:var(--p1);">⚠ 지식베이스 외 신호</b>
          <p style="font-size:11.5px;color:var(--p1);margin:4px 0 0;">유사도 임계치 미달 — 상담사 판단 요망</p>
        </div>
      </div>
    </div>`;
  renderTeacher(root, path, body);
}

registerRoute('/teacher/session/:id', renderSession);

// ---------- School violence intake with 48h timer (F-18/F-19/F-20, P1) ----------

let violenceSecondsLeft = 36*3600 + 12*60 + 5;
let violenceTimerHandle = null;

function renderViolence(root, path){
  const body = `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <b style="font-size:15px;">학교폭력 사안 접수</b>
      <span class="badge badge-lock">P1 · 여유시 기능</span>
    </div>
    <div style="display:flex;gap:16px;margin-top:12px;">
      <div style="flex:1.3;" class="form-grid">
        <label>발생 시간</label><input type="datetime-local" value="2026-03-20T13:20" />
        <label>장소</label><input value="2학년 3반 교실" />
        <label>관련 인물</label><input placeholder="가명 ID 입력" />
        <label>행위 유형</label>
        <select><option>신체 폭력</option><option>언어 폭력</option><option>사이버 폭력</option></select>
        <button class="btn primary" style="margin-top:14px;" id="submitViolence">접수하기</button>
      </div>
      <div style="flex:1;">
        <div class="timer-card" id="timerCard">
          <div class="sub">처리 시한</div>
          <div class="clock" id="timerClock">--:--:--</div>
          <div class="sub">48시간 중 남은 시간 (24h/44h 경과 시 경고)</div>
        </div>
        <p class="section-label">공문 초안 (자동 생성)</p>
        <div class="card">사안 개요, 관련 법령, 조치 권고안이 구조화 입력 기반으로 자동 생성됨 — 편집 가능</div>
      </div>
    </div>`;
  renderTeacher(root, path, body);
  root.querySelector('#submitViolence').addEventListener('click', ()=>alert('접수되었습니다. SHA-256 해시로 보존됩니다.'));
  tickViolenceTimer(root);
}

function tickViolenceTimer(root){
  clearInterval(violenceTimerHandle);
  const paint = ()=>{
    const clockEl = root.querySelector('#timerClock');
    if(!clockEl){ clearInterval(violenceTimerHandle); return; }
    const { h, m, s, level } = timeLeftLabel(violenceSecondsLeft);
    clockEl.textContent = `${h}:${m}:${s}`;
    root.querySelector('#timerCard').className = `timer-card ${level!=='normal'?level:''}`;
    if(violenceSecondsLeft>0) violenceSecondsLeft--;
  };
  paint();
  violenceTimerHandle = setInterval(paint, 1000);
}

registerRoute('/teacher/violence', renderViolence);

// ---------- Audit log, keyword dictionary, threshold settings (F-11/F-07, P0/P1) ----------

function renderAudit(root, path){
  const body = `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <b style="font-size:15px;">감사 로그</b>
      <button class="btn primary" id="verifyBtn">체인 무결성 검증</button>
    </div>
    <table class="data-table" style="margin-top:10px;">
      <tr><th>시각</th><th>이벤트</th><th>대상</th><th>처리자</th><th>해시</th></tr>
      ${AUDIT_LOG.map(l=>`<tr><td>${l.at}</td><td>${l.event}</td><td>${l.target}</td><td>${l.actor}</td><td>${l.hash}</td></tr>`).join('')}
    </table>
    <div id="verifyResult"></div>`;
  renderTeacher(root, path, body);
  root.querySelector('#verifyBtn').addEventListener('click', ()=>{
    const r = verifyChain();
    root.querySelector('#verifyResult').innerHTML = `<div class="card" style="margin-top:10px;color:var(--p0);">✓ ${r.message}</div>`;
  });
}

function renderKeyword(root, path){
  const body = `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <b style="font-size:15px;">키워드 사전</b>
      <button class="btn primary" id="addKeyword">키워드 추가 +</button>
    </div>
    <table class="data-table" style="margin-top:10px;" id="keywordTable">
      <tr><th>키워드</th><th>카테고리</th><th>등록일</th><th>등록자</th></tr>
      ${KEYWORDS.map(k=>`<tr><td>${k.word}</td><td><span class="badge badge-l3">${k.category}</span></td><td>${k.addedAt}</td><td>${k.by}</td></tr>`).join('')}
    </table>
    <p style="font-size:11.5px;color:var(--ink-soft);margin-top:8px;">※ 실제 키워드 목록은 데모 화면에 노출하지 않음(오남용 방지).</p>`;
  renderTeacher(root, path, body);
  root.querySelector('#addKeyword').addEventListener('click', ()=>{
    const word = prompt('추가할 키워드 (데모에서는 마스킹 처리됩니다)');
    if(!word) return;
    const row = document.createElement('tr');
    row.innerHTML = `<td>${'●'.repeat(Math.min(word.length,5))}</td><td><span class="badge badge-l2">기타</span></td><td>${new Date().toISOString().slice(0,10).replace(/-/g,'.')}</td><td>admin_01</td>`;
    root.querySelector('#keywordTable').appendChild(row);
  });
}

function renderThreshold(root, path){
  const body = `
    <b style="font-size:15px;">위험 등급 임계치</b>
    <div class="card" style="margin-top:10px;">
      <label style="font-size:12px;color:var(--ink-soft);">T1 (L1 → L2 경계 확률)</label>
      <div class="slider-row" style="margin:6px 0 14px;">
        <input type="range" min="0" max="100" value="${THRESHOLDS.t1*100}" id="t1Range" style="flex:1;" />
        <b id="t1Val" style="font-size:12.5px;width:40px;">${THRESHOLDS.t1.toFixed(2)}</b>
      </div>
      <label style="font-size:12px;color:var(--ink-soft);">T2 (L2 → L3 경계 확률)</label>
      <div class="slider-row" style="margin:6px 0 14px;">
        <input type="range" min="0" max="100" value="${THRESHOLDS.t2*100}" id="t2Range" style="flex:1;" />
        <b id="t2Val" style="font-size:12.5px;width:40px;">${THRESHOLDS.t2.toFixed(2)}</b>
      </div>
      <button class="btn primary" id="saveThreshold">변경 저장</button>
    </div>`;
  renderTeacher(root, path, body);
  root.querySelector('#t1Range').addEventListener('input', (e)=> root.querySelector('#t1Val').textContent = (e.target.value/100).toFixed(2));
  root.querySelector('#t2Range').addEventListener('input', (e)=> root.querySelector('#t2Val').textContent = (e.target.value/100).toFixed(2));
  root.querySelector('#saveThreshold').addEventListener('click', ()=>{
    const reason = prompt('임계치 변경 사유를 입력하세요 (필수)');
    if(!reason){ alert('사유를 입력해야 저장할 수 있습니다.'); return; }
    THRESHOLDS.t1 = Number(root.querySelector('#t1Range').value)/100;
    THRESHOLDS.t2 = Number(root.querySelector('#t2Range').value)/100;
    alert(`저장되었습니다. 사유: ${reason}`);
  });
}

registerRoute('/teacher/audit', renderAudit);
registerRoute('/teacher/keyword', renderKeyword);
registerRoute('/teacher/threshold', renderThreshold);

// ---------- P2 coming-soon screens ----------

registerRoute('/teacher/group', (root, path) => renderTeacher(root, path, comingSoonBody('그룹 관리', 'F-29')));
registerRoute('/teacher/account', (root, path) => renderTeacher(root, path, comingSoonBody('계정 관리 (대량 생성)', 'F-30 · F-31 · F-32')));
