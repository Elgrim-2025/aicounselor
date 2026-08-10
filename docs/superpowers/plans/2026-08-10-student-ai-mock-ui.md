# 학생 AI 상담 플랫폼 Mock UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a server-less, static, frontend-only mock of the 학생 AI 상담 플랫폼 (student AI counseling platform) covering all 34 screens from the planning doc, deployable as-is to GitHub Pages, entered via role-select buttons ("학생화면으로 접속" / "선생님화면으로 접속") instead of real login.

**Architecture:** Single-page app, no build step. Hash-based router switches between a student mobile-layout shell (bottom tab nav) and a teacher/counselor desktop shell (left sidebar nav). Screens are plain functions that return HTML strings, rendered into a `#app` root. Mock data lives in one module with `localStorage`-backed mutations for anything the user "creates" in the demo (chat messages, check-ins, PHQ-9 answers, threshold edits, keyword edits).

**Tech Stack:** HTML5, CSS3 (custom properties, flexbox/grid), vanilla JS ES modules. No frameworks, no bundler, no npm dependencies. Node is only used to run plain-`assert` unit tests for the pure logic functions (not shipped to the browser).

**Source material:** The full wireframe spec (markup, copy, per-screen priority, and design annotations) lives at `/Users/kangchanghwan/Downloads/Mock_UI_기획서_학생AI상담플랫폼_v2.html` inside the `SCREENS` array. Screen tasks below reference this file by `id` (e.g. `s-chat`, `c-alerts`) — pull the Korean copy, layout structure, and data fields from that screen's `body` string, then restyle using the polished design system from Task 1 (drop the dashed-box "wireframe" look; use real cards/shadows/spacing).

---

## File Structure

```
index.html                 Shell: loads css + main.js, has <div id="app">
css/styles.css              Design tokens + all component styles
js/main.js                  Boot: seeds data once, starts router
js/router.js                Hash router + student/teacher layout shells
js/data.js                  Mock data seed, localStorage helpers, pure logic functions
js/data.test.js             Node assert tests for the pure logic functions in data.js
js/components.js            Shared UI bits: badge, modal/confirm dialog, toast, coming-soon panel
js/screens/student.js       All student screen render functions + registration
js/screens/teacher.js       All teacher/counselor screen render functions + registration
```

Routes (hash paths):
```
#/select
#/student/chat
#/student/checkin
#/student/tests
#/student/tests/take
#/student/tests/result
#/student/crisis
#/student/settings
#/student/persona            (P2 — coming soon)
#/student/diary              (P2 — coming soon)
#/student/testresult         (P2 — coming soon)
#/student/letter             (P2 — coming soon)
#/student/report             (P2 — coming soon)
#/teacher/dashboard
#/teacher/alerts
#/teacher/students
#/teacher/students/:id
#/teacher/session/:id
#/teacher/violence
#/teacher/audit
#/teacher/keyword
#/teacher/threshold
#/teacher/group              (P2 — coming soon)
#/teacher/account            (P2 — coming soon)
```

---

### Task 1: Scaffold, design tokens, role-select screen

**Files:**
- Create: `index.html`
- Create: `css/styles.css`
- Create: `js/main.js`
- Create: `js/router.js` (minimal stub, extended in Task 3)

- [ ] **Step 1: Create `index.html`**

```html
<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>학생 AI 상담 플랫폼 — Mock</title>
<link rel="stylesheet" href="css/styles.css">
</head>
<body>
<div id="app"></div>
<script type="module" src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `css/styles.css` with design tokens + base + role-select styles**

```css
:root{
  --ink:#181c24; --ink-soft:#5b6270; --ink-faint:#8a90a0;
  --line:#e2e4ea; --line-soft:#eef0f4;
  --paper:#ffffff; --canvas:#f6f7f9;
  --accent:#3355ff; --accent-soft:#e8ecff; --accent-ink:#1f36c7;
  --p0:#1f8a55; --p0-bg:#e4f5ec;
  --p1:#b3760a; --p1-bg:#fdf1dc;
  --p2:#6a4fc9; --p2-bg:#efe9ff;
  --danger:#d43b3b; --danger-bg:#fde9e9;
  --radius-sm:8px; --radius-md:14px; --radius-lg:20px;
  --shadow-sm:0 1px 2px rgba(20,20,40,.06);
  --shadow-md:0 8px 24px rgba(20,20,40,.10);
  --sans:-apple-system,BlinkMacSystemFont,"Pretendard","Apple SD Gothic Neo","Malgun Gothic",sans-serif;
}
*{box-sizing:border-box;}
html,body{margin:0;height:100%;background:var(--canvas);color:var(--ink);font-family:var(--sans);}
#app{min-height:100vh;}
button{font-family:inherit;cursor:pointer;}

/* role select */
.select-screen{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;padding:24px;text-align:center;}
.select-screen h1{font-size:24px;margin:0;}
.select-screen p{color:var(--ink-soft);font-size:14px;margin:0;max-width:360px;}
.select-cards{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;}
.select-card{width:220px;border:1px solid var(--line);border-radius:var(--radius-lg);background:var(--paper);
  padding:28px 20px;box-shadow:var(--shadow-sm);transition:box-shadow .15s,transform .15s;}
.select-card:hover{box-shadow:var(--shadow-md);transform:translateY(-2px);}
.select-card .emoji{font-size:32px;margin-bottom:10px;}
.select-card h2{font-size:16px;margin:0 0 6px;}
.select-card p{font-size:12.5px;color:var(--ink-soft);margin:0 0 16px;}
.select-card button{width:100%;padding:10px 0;border-radius:var(--radius-sm);border:none;background:var(--accent);color:#fff;font-weight:600;font-size:13.5px;}
```

- [ ] **Step 3: Create `js/router.js` stub (full implementation in Task 3)**

```js
export const routes = {};
export function registerRoute(path, renderFn){ routes[path] = renderFn; }
export function navigate(path){ location.hash = path; }
export function startRouter(){
  window.addEventListener('hashchange', renderCurrent);
  renderCurrent();
}
function renderCurrent(){
  const path = location.hash.slice(1) || '/select';
  const render = routes[path] || routes['/select'];
  document.getElementById('app').innerHTML = '';
  render(document.getElementById('app'), path);
}
```

- [ ] **Step 4: Create `js/main.js` wiring role-select as the only route for now**

```js
import { registerRoute, startRouter, navigate } from './router.js';

registerRoute('/select', (root) => {
  root.innerHTML = `
    <div class="select-screen">
      <h1>학생 AI 상담 플랫폼</h1>
      <p>데모용 목업입니다. 실제 로그인 없이 역할을 선택해 화면을 둘러보세요.</p>
      <div class="select-cards">
        <div class="select-card">
          <div class="emoji">🧑‍🎓</div>
          <h2>학생 화면</h2>
          <p>AI 채팅, 기분 체크인, 자가진단 검사를 체험합니다.</p>
          <button data-go="/student/chat">학생화면으로 접속</button>
        </div>
        <div class="select-card">
          <div class="emoji">🧑‍🏫</div>
          <h2>선생님 화면</h2>
          <p>상담사·관리자 대시보드와 위기 알림을 체험합니다.</p>
          <button data-go="/teacher/dashboard">선생님화면으로 접속</button>
        </div>
      </div>
    </div>`;
  root.querySelectorAll('[data-go]').forEach(b=>
    b.addEventListener('click', ()=>navigate(b.dataset.go)));
});

startRouter();
```

- [ ] **Step 5: Verify in browser**

Open `index.html` via a static server (`npx serve .` or the Browser preview tool) and confirm the role-select screen renders with two working buttons (they'll 404 into blank routes until Task 3+, that's expected — just confirm no console errors and the fallback `/select` route keeps rendering).

- [ ] **Step 6: Commit** — skip (no git repo in this project; leave working tree as-is).

---

### Task 2: Mock data layer + pure logic functions + tests

**Files:**
- Create: `js/data.js`
- Create: `js/data.test.js`

- [ ] **Step 1: Write `js/data.test.js` first (failing)**

```js
import assert from 'node:assert/strict';
import { classifyIntent, scorePhq9, timeLeftLabel, verifyChain } from './data.js';

// classifyIntent: keyword-based, returns one of 'friend' | 'depressed' | 'study' | 'default'
assert.equal(classifyIntent('친구들하고 어울리기 힘들어'), 'friend');
assert.equal(classifyIntent('학교 성적 때문에 너무 힘들어'), 'study');
assert.equal(classifyIntent('그냥 다 의미 없는 것 같아요'), 'depressed');
assert.equal(classifyIntent('오늘 날씨 좋다'), 'default');

// scorePhq9: 9 answers (0-3 each), item index 8 (0-based) is the override item
const normalAnswers = [1,1,0,0,1,0,0,1,0];
const normalResult = scorePhq9(normalAnswers);
assert.equal(normalResult.total, 4);
assert.equal(normalResult.band, '정상');
assert.equal(normalResult.override, false);

const overrideAnswers = [0,0,0,0,0,0,0,0,1]; // item 9 = 1 -> override regardless of total
const overrideResult = scorePhq9(overrideAnswers);
assert.equal(overrideResult.total, 1);
assert.equal(overrideResult.override, true);

const severeAnswers = [3,3,3,3,3,3,3,3,0];
const severeResult = scorePhq9(severeAnswers);
assert.equal(severeResult.total, 24);
assert.equal(severeResult.band, '심함');
assert.equal(severeResult.override, false);

// timeLeftLabel: formats seconds remaining as HH:MM:SS and flags warn levels
assert.equal(timeLeftLabel(130325), { h:'36', m:'12', s:'05' }.h + ':' + { h:'36', m:'12', s:'05' }.m + ':' + { h:'36', m:'12', s:'05' }.s);
const t = timeLeftLabel(3600); // 1 hour left of 48h budget -> past the 44h warning line
assert.equal(t.level, 'danger');
const t2 = timeLeftLabel(48*3600 - 25*3600); // 23h elapsed -> before 24h line
assert.equal(t2.level, 'normal');

// verifyChain: mock chain integrity check always resolves ok in this demo
assert.deepEqual(verifyChain(), { ok: true, message: '체인 무결성 검증 완료 — 불일치 없음' });

console.log('All data.js tests passed.');
```

- [ ] **Step 2: Run to verify it fails**

Run: `node js/data.test.js`
Expected: `Error [ERR_MODULE_NOT_FOUND]` or `TypeError` because `data.js` doesn't export these yet.

- [ ] **Step 3: Implement `js/data.js`**

```js
// ---------- pure logic ----------

const INTENT_KEYWORDS = {
  friend: ['친구', '어울리', '따돌림', '관계'],
  study: ['성적', '시험', '숙제', '학업', '공부'],
  depressed: ['의미 없', '사라지고', '죽고', '우울', '힘들어서 못'],
};

export function classifyIntent(text){
  for(const [intent, words] of Object.entries(INTENT_KEYWORDS)){
    if(words.some(w=>text.includes(w))) return intent;
  }
  return 'default';
}

export const CHAT_TEMPLATES = {
  friend: ['친구 관계 때문에 마음이 힘들었겠다. 조금 더 이야기해줄래?', '혼자 감당하기 버거웠을 것 같아. 어떤 부분이 제일 힘들어?'],
  study: ['성적 때문에 스트레스가 컸겠다. 요즘 공부는 어떤 식으로 하고 있어?', '노력한 만큼 결과가 안 나오면 속상하지. 지금 제일 부담되는 과목이 뭐야?'],
  depressed: ['많이 지쳐 보여. 네가 힘든 걸 나도 함께 느끼고 있어.', '그런 생각이 들 정도로 힘들었구나. 조금 더 자세히 말해줄 수 있어?'],
  default: ['이런.. 무슨 일 있었는지 자세히 말해줄 수 있어?', '힘들었겠다. 더 말해줄래?'],
};

const CRISIS_WORDS = ['죽고싶', '자해', '사라지고 싶', '죽는 게'];
export function isCrisisText(text){
  return CRISIS_WORDS.some(w=>text.includes(w));
}

const PHQ9_ITEM9_INDEX = 8;
export function scorePhq9(answers){
  const total = answers.reduce((a,b)=>a+b,0);
  const band = total<=4 ? '정상' : total<=9 ? '경도' : total<=19 ? '중등도' : '심함';
  const override = answers[PHQ9_ITEM9_INDEX] >= 1;
  return { total, band, override };
}

export function timeLeftLabel(totalSeconds){
  const budget = 48*3600;
  const elapsed = budget - totalSeconds;
  const h = String(Math.floor(totalSeconds/3600)).padStart(2,'0');
  const m = String(Math.floor((totalSeconds%3600)/60)).padStart(2,'0');
  const s = String(Math.floor(totalSeconds%60)).padStart(2,'0');
  const level = elapsed >= 44*3600 ? 'danger' : elapsed >= 24*3600 ? 'warn' : 'normal';
  return { h, m, s, level };
}

export function verifyChain(){
  return { ok: true, message: '체인 무결성 검증 완료 — 불일치 없음' };
}

// ---------- seed data ----------

export const STUDENTS = [
  { id:'STU-0231', group:'1학년 2반', level:'L3', locked:true, lastAt:'2026.03.20 14:26', spark:[1,2,5,8], prob:0.81, ci:'0.74~0.87', method:'KEYWORD_OVERRIDE' },
  { id:'STU-0117', group:'집중케어군', level:'L2', locked:false, lastAt:'2026.03.20 11:04', spark:[2,3,3,5], prob:0.42, ci:'0.37~0.47', method:'MODEL' },
  { id:'STU-0088', group:'1학년 2반', level:'L1', locked:false, lastAt:'2026.03.20 09:12', spark:[1,1,2,1], prob:0.18, ci:'0.14~0.23', method:'MODEL' },
  { id:'STU-0198', group:'또래상담반', level:'L1', locked:false, lastAt:'어제 10:02', spark:[3,2,1,1], prob:0.15, ci:'0.11~0.20', method:'MODEL' },
  { id:'STU-0044', group:'2학년 1반', level:'L2', locked:false, lastAt:'2026.03.19 09:40', spark:[2,4,3,4], prob:0.39, ci:'0.33~0.45', method:'PHQ9_ITEM9_OVERRIDE' },
];

export const ALERTS = [
  { id:1, student:'STU-0231', level:'L3', method:'KEYWORD_OVERRIDE', at:'2026.03.20 14:26', shap:['부정 정서어 급증','야간 접속 2.2배','PHQ-9 5점 악화'], status:'미확인' },
  { id:2, student:'STU-0117', level:'L2', method:'MODEL', at:'2026.03.20 11:04', prob:0.42, ci:'0.37~0.47', status:'미확인' },
  { id:3, student:'STU-0044', level:'L2', method:'PHQ9_ITEM9_OVERRIDE', at:'2026.03.19 09:40', note:'9번 문항 단독 위기 신호', status:'미확인' },
];

export const AUDIT_LOG = [
  { at:'14:26:03', event:'KEYWORD_OVERRIDE 격상', target:'STU-0231', actor:'SYSTEM', hash:'a1f9…' },
  { at:'14:26:04', event:'알림 발송(SSE)', target:'STU-0231', actor:'SYSTEM', hash:'c02e…' },
  { at:'14:41:10', event:'상담사 확인', target:'STU-0231', actor:'counselor_02', hash:'77bd…' },
  { at:'어제 09:14:02', event:'KEYWORD_OVERRIDE 격상', target:'STU-0198', actor:'SYSTEM', hash:'3b7a…' },
  { at:'어제 09:41:55', event:'상담사 확인', target:'STU-0198', actor:'counselor_02', hash:'d410…' },
  { at:'어제 10:02:31', event:'등급 잠금 해제(오탐 확인)', target:'STU-0198', actor:'counselor_02', hash:'9e21…' },
];

export const KEYWORDS = [
  { word:'●●●●●', category:'자살', addedAt:'2026.01.10', by:'admin_01' },
  { word:'●●●●', category:'자해', addedAt:'2026.01.10', by:'admin_01' },
];

export const THRESHOLDS = { t1:0.35, t2:0.65 };

export const PHQ9_QUESTIONS = [
  '평소 하던 일에 대한 흥미나 재미가 거의 없었다',
  '기분이 가라앉거나, 우울하거나, 희망이 없다고 느꼈다',
  '잠들기 어렵거나 자주 깼다, 혹은 너무 많이 잤다',
  '피곤하다고 느끼거나 기운이 거의 없었다',
  '입맛이 없거나 과식을 했다',
  '자신이 실패자라고 느꼈거나, 자신 또는 가족을 실망시켰다고 느꼈다',
  '신문을 읽거나 TV를 보는 것과 같은 일에 집중하기 어려웠다',
  '다른 사람들이 알아챌 정도로 말과 행동이 느려지거나 반대로 초조했다',
  '차라리 죽는 것이 낫겠다고 생각했거나, 자해할 생각을 했다',
];
export const PHQ9_OPTIONS = ['전혀 아니다','며칠 동안','7일 이상','거의 매일'];

// ---------- localStorage-backed mutable state ----------

const LS_KEY = 'mock_platform_state_v1';

function loadState(){
  try{
    return JSON.parse(localStorage.getItem(LS_KEY)) || { chat: [], checkins: [], phq9: null };
  }catch{
    return { chat: [], checkins: [], phq9: null };
  }
}
function saveState(state){
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

export function getState(){ return loadState(); }

export function appendChat(entry){
  const state = loadState();
  state.chat.push(entry);
  saveState(state);
  return state.chat;
}

export function appendCheckin(entry){
  const state = loadState();
  state.checkins.push(entry);
  saveState(state);
  return state.checkins;
}

export function savePhq9Result(result){
  const state = loadState();
  state.phq9 = result;
  saveState(state);
  return result;
}

export function resetState(){
  localStorage.removeItem(LS_KEY);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node js/data.test.js`
Expected: `All data.js tests passed.` printed, exit code 0.

- [ ] **Step 5: Commit** — skip (no git repo).

---

### Task 3: Full router + student/teacher layout shells

**Files:**
- Modify: `js/router.js` (replace stub from Task 1 with full version below)
- Modify: `css/styles.css` (append layout styles)

- [ ] **Step 1: Replace `js/router.js`**

```js
export const routes = {};
export function registerRoute(path, renderFn){ routes[path] = renderFn; }
export function navigate(path){ location.hash = path; }

const STUDENT_TABS = [
  { path:'/student/chat', label:'채팅' },
  { path:'/student/diary', label:'감정일기' },
  { path:'/student/tests', label:'검사' },
  { path:'/student/report', label:'리포트' },
];

const TEACHER_NAV = [
  { path:'/teacher/dashboard', label:'대시보드' },
  { path:'/teacher/alerts', label:'알림센터' },
  { path:'/teacher/students', label:'학생 관리' },
  { path:'/teacher/group', label:'그룹 관리' },
  { path:'/teacher/account', label:'계정 관리' },
  { path:'/teacher/audit', label:'감사 로그' },
  { path:'/teacher/violence', label:'학교폭력 접수' },
  { path:'/teacher/keyword', label:'키워드 사전' },
  { path:'/teacher/threshold', label:'임계치 설정' },
];

function studentShell(path, bodyHtml, opts={}){
  const activeTab = STUDENT_TABS.find(t => path.startsWith(t.path));
  return `
  <div class="student-shell">
    <div class="student-topbar">
      ${opts.back ? `<button class="icon-btn" data-go="${opts.back}">‹</button>` : ''}
      <div class="title">${opts.title || ''}</div>
      <button class="role-switch" data-go="/select">역할전환</button>
    </div>
    <div class="student-body">${bodyHtml}</div>
    ${opts.hideTabs ? '' : `<div class="student-tabbar">
      ${STUDENT_TABS.map(t=>`<button data-go="${t.path}" class="${t===activeTab?'active':''}">${t.label}</button>`).join('')}
    </div>`}
  </div>`;
}

function teacherShell(path, bodyHtml){
  return `
  <div class="teacher-shell">
    <div class="teacher-sidebar">
      <div class="sidebar-head">학생 AI 상담 학교</div>
      ${TEACHER_NAV.map(n=>`<button data-go="${n.path}" class="${path.startsWith(n.path)?'active':''}">${n.label}</button>`).join('')}
      <button class="role-switch" data-go="/select">역할전환</button>
    </div>
    <div class="teacher-main">${bodyHtml}</div>
  </div>`;
}

export function renderStudent(root, path, bodyHtml, opts){
  root.innerHTML = studentShell(path, bodyHtml, opts);
  bindNav(root);
}
export function renderTeacher(root, path, bodyHtml){
  root.innerHTML = teacherShell(path, bodyHtml);
  bindNav(root);
}
function bindNav(root){
  root.querySelectorAll('[data-go]').forEach(b=>
    b.addEventListener('click', ()=>navigate(b.dataset.go)));
}

export function startRouter(){
  window.addEventListener('hashchange', renderCurrent);
  renderCurrent();
}
function renderCurrent(){
  const path = location.hash.slice(1) || '/select';
  const exact = routes[path];
  if(exact){ exact(document.getElementById('app'), path); return; }
  // param routes: /teacher/students/:id, /teacher/session/:id
  for(const key of Object.keys(routes)){
    if(!key.includes(':')) continue;
    const pattern = '^' + key.replace(/:[^/]+/g, '([^/]+)') + '$';
    const m = path.match(new RegExp(pattern));
    if(m){ routes[key](document.getElementById('app'), path, m[1]); return; }
  }
  routes['/select'](document.getElementById('app'), path);
}
```

- [ ] **Step 2: Append shell CSS to `css/styles.css`**

```css
/* student shell */
.student-shell{max-width:430px;margin:0 auto;min-height:100vh;background:var(--paper);display:flex;flex-direction:column;box-shadow:var(--shadow-md);}
.student-topbar{display:flex;align-items:center;gap:8px;padding:14px 16px;border-bottom:1px solid var(--line-soft);position:sticky;top:0;background:var(--paper);z-index:2;}
.student-topbar .title{font-size:15px;font-weight:700;flex:1;}
.icon-btn{border:none;background:none;font-size:18px;color:var(--ink-soft);}
.role-switch{border:1px solid var(--line);background:var(--paper);border-radius:999px;padding:5px 10px;font-size:11px;color:var(--ink-soft);}
.student-body{flex:1;padding:16px;overflow-y:auto;}
.student-tabbar{display:flex;border-top:1px solid var(--line-soft);position:sticky;bottom:0;background:var(--paper);}
.student-tabbar button{flex:1;border:none;background:none;padding:10px 0;font-size:11px;color:var(--ink-faint);}
.student-tabbar button.active{color:var(--accent);font-weight:700;}

/* teacher shell */
.teacher-shell{display:flex;min-height:100vh;}
.teacher-sidebar{width:220px;flex:none;background:var(--paper);border-right:1px solid var(--line-soft);padding:16px 0;display:flex;flex-direction:column;}
.sidebar-head{padding:0 18px 14px;font-size:12px;color:var(--ink-soft);font-weight:700;border-bottom:1px solid var(--line-soft);margin-bottom:8px;}
.teacher-sidebar button{text-align:left;border:none;background:none;padding:10px 18px;font-size:13px;color:var(--ink-soft);border-right:3px solid transparent;}
.teacher-sidebar button.active{background:var(--accent-soft);color:var(--accent-ink);font-weight:700;border-right-color:var(--accent);}
.teacher-sidebar .role-switch{margin:14px 18px 0;align-self:flex-start;}
.teacher-main{flex:1;padding:28px 32px;overflow-y:auto;}
```

- [ ] **Step 3: Update `js/main.js`** to import `renderStudent`/`renderTeacher` for use by later screen modules (no behavior change yet, just re-export wiring already present via router.js exports — no code change needed here since screens import directly from `router.js`).

- [ ] **Step 4: Verify in browser**

Reload `index.html`. Click "학생화면으로 접속" — hash changes to `#/student/chat` but shows fallback (`/select`) since that route isn't registered yet (expected until Task 4). Confirm no console errors and back/forward hash navigation doesn't throw.

- [ ] **Step 5: Commit** — skip (no git repo).

---

### Task 4: Student — Chat (F-02/F-22, P0)

**Files:**
- Create: `js/screens/student.js` (start this file here; later student tasks append to it)
- Modify: `js/main.js` (import `./screens/student.js` for side-effect route registration)
- Modify: `css/styles.css` (append chat + shared card/badge/chip styles used across student screens)

Reference source: `s-chat` screen body in the planning HTML (bubbles, mic icon, "상담 요청하기" chip, "컨텐츠 추천" chip shown disabled/opacity since it's P2).

- [ ] **Step 1: Append shared component CSS**

```css
.badge{display:inline-block;font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:6px;}
.badge-l1{background:var(--p0-bg);color:var(--p0);}
.badge-l2{background:var(--p1-bg);color:var(--p1);}
.badge-l3{background:var(--danger-bg);color:var(--danger);}
.badge-lock{background:var(--line-soft);color:var(--ink-soft);}
.card{border:1px solid var(--line-soft);border-radius:var(--radius-md);padding:14px;background:var(--paper);}
.card.solid{border-color:var(--accent);background:var(--accent-soft);}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:var(--radius-sm);
  border:1px solid var(--line);background:var(--paper);color:var(--ink);font-size:13px;font-weight:600;padding:10px 16px;}
.btn.primary{background:var(--ink);border-color:var(--ink);color:#fff;}
.btn.accent{background:var(--accent);border-color:var(--accent);color:#fff;}
.btn.danger{border-color:var(--danger);color:var(--danger);}
.btn.ghost{border-style:dashed;color:var(--ink-soft);}
.btn.block{display:flex;width:100%;}
.chip{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:6px 12px;font-size:12px;color:var(--ink-soft);margin:0 6px 6px 0;}
.chip.on{border-color:var(--accent);color:var(--accent);background:var(--accent-soft);}
.chip.disabled{opacity:.45;}

/* chat */
.chat-scroll{display:flex;flex-direction:column;gap:8px;padding-bottom:8px;}
.bubble{max-width:78%;padding:10px 13px;border-radius:16px;font-size:13px;line-height:1.5;}
.bubble.bot{background:var(--canvas);align-self:flex-start;border-bottom-left-radius:4px;}
.bubble.me{background:var(--accent);color:#fff;align-self:flex-end;border-bottom-right-radius:4px;}
.chat-inputbar{display:flex;gap:8px;align-items:center;padding:10px 0 0;border-top:1px solid var(--line-soft);margin-top:10px;}
.chat-inputbar input{flex:1;border:1px solid var(--line);border-radius:999px;padding:10px 14px;font-size:13px;}
.chat-inputbar button{border:none;background:var(--accent);color:#fff;width:36px;height:36px;border-radius:50%;font-size:14px;}
```

- [ ] **Step 2: Create `js/screens/student.js` with the chat screen**

```js
import { registerRoute, renderStudent, navigate } from '../router.js';
import { classifyIntent, isCrisisText, CHAT_TEMPLATES, appendChat, getState } from '../data.js';

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
    <div>
      <span class="chip disabled">컨텐츠를 추천해요 (P2)</span>
      <span class="chip on" id="crisisChip">상담 요청하기</span>
    </div>
    <div class="chat-inputbar">
      <span title="음성입력(F-22, 구현예정)">🎙</span>
      <input id="chatInput" placeholder="너의 이야기를 들려줘" />
      <button id="chatSend">➤</button>
    </div>`;
  renderStudent(root, path, body, { title:'다솜이' });

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

function pick(list){ return list[Math.floor(Math.random()*list.length)]; }
function escapeHtml(s){ return s.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

registerRoute('/student/chat', renderChat);
```

- [ ] **Step 3: Import the module for its route-registration side effect**

In `js/main.js`, add near the top:

```js
import './screens/student.js';
```

- [ ] **Step 4: Verify in browser**

From `/select`, click "학생화면으로 접속" → lands on `#/student/chat` showing the 5 seeded bubbles, bottom tabs, and top bar. Type "친구 때문에 힘들어" and send → new "me" bubble appears, then a "bot" bubble from the `friend` template appears. Type "죽고 싶어" → crisis-branch bot reply appears. Reload the page → chat history persists (from `localStorage`). Click "역할전환" → returns to `/select`.

- [ ] **Step 5: Commit** — skip (no git repo).

---

### Task 5: Student — Check-in (F-03, P0)

**Files:**
- Modify: `js/screens/student.js` (append screen + registration)
- Modify: `css/styles.css` (append check-in styles)

Reference source: `s-checkin` screen body (5-point mood row + optional free text + save button).

- [ ] **Step 1: Append CSS**

```css
.mood-row{display:flex;justify-content:center;gap:12px;margin:18px 0;}
.mood-btn{width:44px;height:44px;border-radius:50%;border:2px solid var(--line);background:var(--paper);font-size:20px;display:flex;align-items:center;justify-content:center;}
.mood-btn.selected{border-color:var(--accent);background:var(--accent-soft);}
.textarea{width:100%;min-height:80px;border:1px solid var(--line);border-radius:var(--radius-sm);padding:10px;font-size:13px;font-family:inherit;resize:vertical;}
```

- [ ] **Step 2: Append to `js/screens/student.js`**

```js
import { appendCheckin } from '../data.js'; // add to existing import from '../data.js' line instead of a new import statement

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
  renderStudent(root, path, body, { title:'오늘의 기분 체크인', hideTabs:false });

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
```

Note: merge the `appendCheckin` import into the single existing `import ... from '../data.js'` statement at the top of the file rather than adding a second import line for the same module.

- [ ] **Step 3: Verify in browser**

Navigate to `#/student/checkin` directly (or link it later from chat/report). Click a mood emoji → it highlights. Type a note, click 저장 → alert confirms, redirects to chat. This screen isn't on the bottom tab bar (tabs are 채팅/감정일기/검사/리포트 per the spec) — reachable via direct link only for now; Task 9's report/diary "coming soon" screens will not link here since check-in has no dedicated nav slot in the original spec either.

- [ ] **Step 4: Commit** — skip (no git repo).

---

### Task 6: Student — Self-tests list, PHQ-9 taking, PHQ-9 result (F-04/F-25, P0)

**Files:**
- Modify: `js/screens/student.js`
- Modify: `css/styles.css`

Reference source: `s-tests`, `s-testtaking`, `s-phq9-result` screen bodies.

- [ ] **Step 1: Append CSS**

```css
.test-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--line-soft);}
.test-row .thumb{width:38px;height:38px;border-radius:10px;background:var(--canvas);flex:none;display:flex;align-items:center;justify-content:center;font-size:16px;}
.test-row .grow{flex:1;}
.test-row .grow b{font-size:13px;}
.test-row .sub{font-size:11px;color:var(--ink-soft);}
.test-row.locked{opacity:.5;}
.likert-row{display:flex;gap:6px;margin:16px 0;}
.likert-row button{flex:1;border:1px solid var(--line);border-radius:var(--radius-sm);padding:10px 4px;font-size:11.5px;background:var(--paper);}
.likert-row button.selected{background:var(--ink);color:#fff;border-color:var(--ink);}
.progress-track{height:5px;background:var(--line-soft);border-radius:3px;margin-bottom:14px;overflow:hidden;}
.progress-fill{height:100%;background:var(--accent);}
```

- [ ] **Step 2: Append test-list, taking, and result screens to `js/screens/student.js`**

```js
import { PHQ9_QUESTIONS, PHQ9_OPTIONS, scorePhq9, savePhq9Result } from '../data.js'; // merge into existing import

function renderTests(root, path){
  const body = `
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
  renderStudent(root, path, body, { title:`PHQ-9 · ${phq9Index+1}/9`, back:'/student/tests' });
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
  renderStudent(root, path, body, { title:'검사 결과' });
  root.querySelector('#phq9Ok').addEventListener('click', ()=>navigate('/student/tests'));
}

registerRoute('/student/tests', renderTests);
registerRoute('/student/tests/take', renderPhq9Take);
registerRoute('/student/tests/result', renderPhq9Result);
```

Note: this reuses `getState` already imported in Task 4 — merge all `../data.js` imports across the file into one statement at the top rather than repeating `import ... from '../data.js'` multiple times.

- [ ] **Step 3: Verify in browser**

Go to `#/student/tests` (link it from somewhere reachable, e.g. type the hash manually or the bottom tab "검사"). Click PHQ-9 row → question 1/9 with progress bar. Click through all 9 answering "전혀 아니다" except pick "며칠 동안"(score 1) on question 9 → after the 9th click, redirected to result screen showing total score, band, and the "상담사 확인 중" badge because item 9 was ≥1. Retake with all "전혀 아니다" → result has no badge and total 0 / 정상. Click a locked test row → alert "준비 중인 검사입니다."

- [ ] **Step 4: Commit** — skip (no git repo).

---

### Task 7: Student — Crisis request screen (F-09/F-10/F-34, P1)

**Files:**
- Modify: `js/screens/student.js`

Reference source: `s-crisis` screen body (status card + static 1388 hotline card, no auto-popup).

- [ ] **Step 1: Append to `js/screens/student.js`**

```js
function renderCrisis(root, path){
  const body = `
    <div class="card solid">
      <b style="font-size:14px;">상담사에게 요청을 보냈어요</b>
      <p style="font-size:12.5px;color:var(--ink-soft);margin:6px 0 10px;">담당 상담사가 확인 중이에요. 확인되는 대로 채팅으로 먼저 연락드릴게요.</p>
      <span class="badge badge-l2">상담사 확인 중</span>
    </div>
    <p style="font-size:11px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;margin:18px 0 8px;">언제든 이용 가능해요</p>
    <div class="card">
      <b style="font-size:13px;">1388 청소년 상담전화</b>
      <p style="font-size:12px;color:var(--ink-soft);margin:4px 0 0;">24시간 운영 · 급할 때는 바로 전화해도 괜찮아요</p>
    </div>`;
  renderStudent(root, path, body, { title:'상담 요청', back:'/student/chat' });
}

registerRoute('/student/crisis', renderCrisis);
```

- [ ] **Step 2: Verify in browser**

From the chat screen click the "상담 요청하기" chip (wired in Task 4) → lands here showing the status card and the always-visible 1388 card. Back arrow returns to chat.

- [ ] **Step 3: Commit** — skip (no git repo).

---

### Task 8: Student — Settings / consent withdrawal (F-33, P0)

**Files:**
- Modify: `js/screens/student.js`

Reference source: `s-settings` screen body.

- [ ] **Step 1: Append**

```js
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
```

- [ ] **Step 2: Append matching CSS to `css/styles.css`**

```css
.section-label{font-size:11px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.04em;margin:16px 0 6px;}
.list-row{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--line-soft);font-size:13px;}
.list-row .sub{font-size:11.5px;color:var(--ink-soft);margin-left:auto;}
```

- [ ] **Step 3: Verify in browser**

Navigate to `#/student/settings` (reachable via a settings icon added to the chat top bar — add `<button class="icon-btn" data-go="/student/settings" style="margin-left:auto;">⚙</button>` inside the chat top bar's extra slot; simplest: append it into the chat screen's topbar area by adding an `opts.headerExtra` or just place a gear icon in the body/top of the chat screen). Click "동의 철회하기" → confirm dialog → status flips to "철회함" and button disables. Click "로그아웃" → back to `/select`.

- [ ] **Step 4: Wire a way to reach Settings from Chat**

Modify Task 4's `renderChat` topbar title area to include a settings button. In `js/screens/student.js`, change the chat screen's `renderStudent` call options to pass a `headerExtra` string, and update `js/router.js`'s `studentShell` to render it:

In `js/router.js`, change the topbar line in `studentShell` to:
```js
<div class="title">${opts.title || ''}</div>
${opts.headerExtra || ''}
<button class="role-switch" data-go="/select">역할전환</button>
```

In `js/screens/student.js`, update the `renderStudent(root, path, body, { title:'다솜이' })` call in `renderChat` to:
```js
renderStudent(root, path, body, { title:'다솜이', headerExtra:'<button class="icon-btn" data-go="/student/settings">⚙</button>' });
```

- [ ] **Step 5: Commit** — skip (no git repo).

---

### Task 9: Student — P2 "coming soon" screens (persona, diary, testresult, letter, report)

**Files:**
- Create: `js/components.js` (shared `comingSoonBody` helper)
- Modify: `js/screens/student.js`
- Modify: `css/styles.css`

- [ ] **Step 1: Create `js/components.js`**

```js
export function comingSoonBody(title, fid){
  return `
    <div style="text-align:center;padding:60px 10px;">
      <div style="font-size:36px;margin-bottom:10px;">🔒</div>
      <h3 style="margin:0 0 6px;">${title}</h3>
      <p style="color:var(--ink-soft);font-size:12.5px;">${fid} · P2 로드맵 — 프로토타입에서는 준비 중이에요.</p>
    </div>`;
}
```

- [ ] **Step 2: Append P2 screens to `js/screens/student.js`**

```js
import { comingSoonBody } from '../components.js'; // add to top-of-file imports

registerRoute('/student/persona', (root, path) => renderStudent(root, path, comingSoonBody('닉네임 · 페르소나 설정', 'F-21'), { title:'다솜이 설정', back:'/student/chat' }));
registerRoute('/student/diary', (root, path) => renderStudent(root, path, comingSoonBody('감정일기', 'F-24'), { title:'감정일기' }));
registerRoute('/student/testresult', (root, path) => renderStudent(root, path, comingSoonBody('검사 결과 리포트 (24종 통합)', 'F-26'), { title:'검사 리포트', back:'/student/tests' }));
registerRoute('/student/letter', (root, path) => renderStudent(root, path, comingSoonBody('마음편지함', 'F-23'), { title:'보관함', back:'/student/chat' }));
registerRoute('/student/report', (root, path) => renderStudent(root, path, comingSoonBody('주간 리포트', 'F-27'), { title:'주간 리포트' }));
```

- [ ] **Step 3: Verify in browser**

Click the "감정일기" and "리포트" bottom tabs → each shows the lock icon + "준비 중이에요" card, tab bar still highlights the active tab. Navigate to `#/student/persona` and `#/student/letter` directly → same coming-soon treatment.

- [ ] **Step 4: Commit** — skip (no git repo).

---

### Task 10: Teacher — Dashboard (F-12/F-28, P0)

**Files:**
- Create: `js/screens/teacher.js`
- Modify: `js/main.js` (import `./screens/teacher.js`)
- Modify: `css/styles.css` (append KPI/bar-chart/table styles)

Reference source: `c-dashboard` screen body.

- [ ] **Step 1: Append CSS**

```css
.kpi-row{display:flex;gap:14px;margin:16px 0;}
.kpi{flex:1;border:1px solid var(--line-soft);border-radius:var(--radius-md);padding:14px;background:var(--paper);}
.kpi .num{font-size:22px;font-weight:700;}
.kpi .lbl{font-size:11.5px;color:var(--ink-soft);}
.bars{display:flex;align-items:flex-end;gap:8px;height:90px;padding:8px 2px;}
.bars > div{flex:1;background:var(--line-soft);border-radius:4px 4px 0 0;}
.bars > div.hi{background:var(--danger-bg);border:1px solid var(--danger);}
.data-table{width:100%;border-collapse:collapse;font-size:12.5px;}
.data-table th{text-align:left;color:var(--ink-soft);font-weight:600;font-size:11px;border-bottom:1px solid var(--line-soft);padding:8px 10px;}
.data-table td{padding:9px 10px;border-bottom:1px solid var(--line-soft);}
.data-table tr.clickable{cursor:pointer;}
.data-table tr.clickable:hover{background:var(--canvas);}
```

- [ ] **Step 2: Create `js/screens/teacher.js`**

```js
import { registerRoute, renderTeacher, navigate } from '../router.js';
import { STUDENTS, ALERTS } from '../data.js';

function levelBadge(level, locked){
  const cls = level==='L3'?'badge-l3':level==='L2'?'badge-l2':'badge-l1';
  return `<span class="badge ${cls}">${level}</span>${locked?' <span class="badge badge-lock">🔒</span>':''}`;
}

function renderDashboard(root, path){
  const rows = [...STUDENTS].sort((a,b)=> (b.level>a.level?1:-1));
  const body = `
    <p style="font-size:13px;">홍길동님, 3월에 구성원은 534건의 대화를 했어요 😊</p>
    <div class="kpi-row">
      <div class="kpi"><div class="lbl">AI 상담대화 위험감지</div><div class="num">${ALERTS.length*7 + 2}건</div></div>
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

export { levelBadge };
```

- [ ] **Step 3: Wire import in `js/main.js`**

```js
import './screens/teacher.js';
```

- [ ] **Step 4: Verify in browser**

Click "선생님화면으로 접속" from `/select` → dashboard renders sidebar (대시보드 active), 3 KPI cards, bar chart with 3 bars highlighted red (≥60%), and the student table sorted with L3 first. Click a row → navigates to `#/teacher/students/STU-0231` (will 404 into dashboard fallback until Task 12 registers that route — expected at this point).

- [ ] **Step 5: Commit** — skip (no git repo).

---

### Task 11: Teacher — Alert center with lock-release dialog (F-13, P0)

**Files:**
- Modify: `js/screens/teacher.js`
- Modify: `css/styles.css`

Reference source: `c-alerts` screen body. Key behavior (R-07): the "등급 잠금 해제" button must open a confirm dialog requiring a non-empty reason before it can be confirmed.

- [ ] **Step 1: Append CSS**

```css
.alert-card{border:1px solid var(--line-soft);border-radius:var(--radius-md);padding:14px;margin-bottom:12px;background:var(--paper);}
.alert-card.critical{border-color:var(--danger);background:var(--danger-bg);}
.alert-card .top{display:flex;justify-content:space-between;align-items:center;}
.modal-backdrop{position:fixed;inset:0;background:rgba(20,20,30,.45);display:flex;align-items:center;justify-content:center;z-index:50;}
.modal-box{background:var(--paper);border-radius:var(--radius-md);padding:20px;width:340px;box-shadow:var(--shadow-md);}
.modal-box textarea{width:100%;min-height:70px;margin:10px 0;border:1px solid var(--line);border-radius:var(--radius-sm);padding:8px;font-family:inherit;font-size:12.5px;}
.modal-box .row{display:flex;gap:8px;justify-content:flex-end;}
```

- [ ] **Step 2: Append to `js/screens/teacher.js`**

```js
import { openReasonDialog } from '../components.js'; // add to existing components import line

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
```

- [ ] **Step 3: Add `openReasonDialog` to `js/components.js`**

```js
export function openReasonDialog({ title, message, onConfirm }){
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal-box">
      <b style="font-size:14px;">${title}</b>
      <p style="font-size:12px;color:var(--ink-soft);margin:6px 0;">${message}</p>
      <textarea placeholder="해제 사유를 입력하세요"></textarea>
      <div class="row">
        <button class="btn ghost" data-cancel>취소</button>
        <button class="btn danger" data-confirm disabled>해제</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);
  const textarea = backdrop.querySelector('textarea');
  const confirmBtn = backdrop.querySelector('[data-confirm]');
  textarea.addEventListener('input', ()=>{ confirmBtn.disabled = textarea.value.trim().length===0; });
  backdrop.querySelector('[data-cancel]').addEventListener('click', ()=>backdrop.remove());
  confirmBtn.addEventListener('click', ()=>{ onConfirm(textarea.value.trim()); backdrop.remove(); });
}
```

- [ ] **Step 4: Verify in browser**

Go to `#/teacher/alerts`. Confirm STU-0231's card renders with red border + "🚨 최우선 경보" prefix. Click "등급 잠금 해제" → modal opens, "해제" button starts disabled; typing a reason enables it; clicking it alerts with the reason and closes the modal. Click "상담 연계" → navigates toward `/teacher/session/STU-0231` (route registered in Task 14).

- [ ] **Step 5: Commit** — skip (no git repo).

---

### Task 12: Teacher — Student detail + Student list (F-14/F-12, P0/P1)

**Files:**
- Modify: `js/screens/teacher.js`
- Modify: `js/router.js` (register the `:id` param route pattern is already supported from Task 3; just use `registerRoute('/teacher/students/:id', ...)`)

Reference source: `c-detail` and `c-studentlist` screen bodies.

- [ ] **Step 1: Append to `js/screens/teacher.js`**

```js
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
```

- [ ] **Step 2: Verify in browser**

Go to `#/teacher/students` → table of 5 students. Type "0231" in the search box → only STU-0231's row remains visible. Click the row → detail view for STU-0231 with SHAP cards and PHQ-9 history table. Go back to `#/teacher/dashboard` and click a row there too → same detail screen opens (confirms the shared `:id` route works from both entry points).

- [ ] **Step 3: Commit** — skip (no git repo).

---

### Task 13: Teacher — Counseling session + RAG sidebar (F-15/F-16/F-17, P1)

**Files:**
- Modify: `js/screens/teacher.js`
- Modify: `css/styles.css`

Reference source: `c-session` screen body (two-pane: chat transcript left, RAG recommendation sidebar right, with a "유사도 미달 — 상담사 판단 요망" guardrail card).

- [ ] **Step 1: Append CSS**

```css
.session-layout{display:flex;gap:0;margin:-28px -32px;min-height:calc(100vh - 0px);}
.session-chat{flex:1;padding:24px;border-right:1px solid var(--line-soft);display:flex;flex-direction:column;}
.session-rag{width:280px;padding:24px;background:var(--canvas);}
```

- [ ] **Step 2: Append to `js/screens/teacher.js`**

```js
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
```

- [ ] **Step 3: Verify in browser**

From `#/teacher/alerts`, click "상담 연계" on the STU-0231 card → lands on `#/teacher/session/STU-0231` with the two-pane layout: chat transcript on the left, RAG sidebar with the "P1" badge and the amber guardrail card on the right.

- [ ] **Step 4: Commit** — skip (no git repo).

---

### Task 14: Teacher — School violence intake with 48h timer (F-18/F-19/F-20, P1)

**Files:**
- Modify: `js/screens/teacher.js`
- Modify: `js/data.js` (add `timeLeftLabel` usage — already implemented in Task 2, just imported here)
- Modify: `css/styles.css`

Reference source: `c-violence` screen body.

- [ ] **Step 1: Append CSS**

```css
.timer-card{text-align:center;border:1px solid var(--line-soft);border-radius:var(--radius-md);padding:16px;}
.timer-card .clock{font-size:28px;font-weight:700;margin:6px 0;}
.timer-card.warn .clock{color:var(--p1);}
.timer-card.danger .clock{color:var(--danger);}
.form-grid label{font-size:12px;color:var(--ink-soft);display:block;margin:10px 0 4px;}
.form-grid input, .form-grid select{width:100%;border:1px solid var(--line);border-radius:var(--radius-sm);padding:9px 10px;font-size:12.5px;font-family:inherit;}
</style>
```
(Note: omit the stray `</style>` — append only the CSS rules above it to `css/styles.css`, which already has an opening block from Task 1; do not add extra `<style>`/`</style>` tags since this is a plain `.css` file, not inline HTML.)

- [ ] **Step 2: Append to `js/screens/teacher.js`**

```js
import { timeLeftLabel } from '../data.js'; // merge into existing data.js import

let violenceSecondsLeft = 36*3600 + 12*60 + 5; // seed matching the spec's example (36:12:05)
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
    if(!clockEl){ clearInterval(violenceTimerHandle); return; } // screen navigated away
    const { h, m, s, level } = timeLeftLabel(violenceSecondsLeft);
    clockEl.textContent = `${h}:${m}:${s}`;
    root.querySelector('#timerCard').className = `timer-card ${level!=='normal'?level:''}`;
    if(violenceSecondsLeft>0) violenceSecondsLeft--;
  };
  paint();
  violenceTimerHandle = setInterval(paint, 1000);
}

registerRoute('/teacher/violence', renderViolence);
```

- [ ] **Step 3: Verify in browser**

Go to `#/teacher/violence` → timer counts down once per second from `36:12:05`. Navigate away to another route → confirm no console errors from the interval still running against a detached DOM (the `if(!clockEl)` guard clears it). To manually verify the color-warning thresholds without waiting hours, temporarily set `violenceSecondsLeft = 3000` (danger zone) or `= 20*3600` (warn zone) in devtools console via `document` inspection is not possible for a module-scoped `let`; instead confirm visually by reasoning about `timeLeftLabel`'s already-passing unit tests from Task 2, which cover both zones.

- [ ] **Step 4: Commit** — skip (no git repo).

---

### Task 15: Teacher — Audit log, keyword dictionary, threshold settings (F-11/F-07, P0/P1)

**Files:**
- Modify: `js/screens/teacher.js`
- Modify: `css/styles.css`

Reference source: `c-audit`, `c-keyword`, `c-threshold` screen bodies.

- [ ] **Step 1: Append CSS**

```css
.slider-row{display:flex;align-items:center;gap:10px;}
.slider-track{flex:1;height:6px;background:var(--line-soft);border-radius:3px;overflow:hidden;}
.slider-fill{height:100%;background:var(--accent);}
.slider-fill.danger{background:var(--danger);}
```

- [ ] **Step 2: Append to `js/screens/teacher.js`**

```js
import { AUDIT_LOG, KEYWORDS, THRESHOLDS, verifyChain } from '../data.js'; // merge into existing import

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
```

- [ ] **Step 3: Verify in browser**

`#/teacher/audit`: click "체인 무결성 검증" → green "✓ 체인 무결성 검증 완료 — 불일치 없음" card appears below the table. `#/teacher/keyword`: click "키워드 추가 +", enter a word in the prompt → new masked row appended. `#/teacher/threshold`: drag both sliders → labels update live; click "변경 저장" with an empty prompt cancel → alert demands a reason; fill a reason → confirmation alert shows it.

- [ ] **Step 4: Commit** — skip (no git repo).

---

### Task 16: Teacher — P2 "coming soon" screens (group, account)

**Files:**
- Modify: `js/screens/teacher.js`

- [ ] **Step 1: Append**

```js
registerRoute('/teacher/group', (root, path) => renderTeacher(root, path, comingSoonBody('그룹 관리', 'F-29')));
registerRoute('/teacher/account', (root, path) => renderTeacher(root, path, comingSoonBody('계정 관리 (대량 생성)', 'F-30 · F-31 · F-32')));
```

Add `comingSoonBody` to the existing `../components.js` import line at the top of `js/screens/teacher.js`.

- [ ] **Step 2: Verify in browser**

Click "그룹 관리" and "계정 관리" in the sidebar → both show the shared lock/coming-soon card inside the teacher desktop shell (sidebar still highlights the active item).

- [ ] **Step 3: Commit** — skip (no git repo).

---

### Task 17: Final integration pass — cross-links, nav completeness, full manual QA

**Files:**
- Modify: `js/screens/student.js` (add a settings gear + persona link somewhere reachable, e.g. from chat header — already done in Task 8; confirm diary/report tabs link correctly)
- Modify: `js/screens/teacher.js` (confirm every sidebar item has a registered route)
- No new files

- [ ] **Step 1: Route completeness check**

Grep both screen files for every path listed in the "Routes" table at the top of this plan and confirm each has a matching `registerRoute(...)` call:

Run: `grep -o "registerRoute('[^']*'" js/screens/student.js js/screens/teacher.js`
Expected: 17 distinct route strings covering every path in the table (5 core student + 5 P2 student + 1 checkin = 6 registered under student.js totaling 11, plus 9 teacher routes registered under teacher.js — cross-check the exact count against the Routes table and add any missing `registerRoute` call directly in the relevant screens file).

- [ ] **Step 2: Full manual browser walkthrough**

Using the Browser tool against a local static server (e.g. `npx serve .` or Python's `http.server`), walk through:
1. `/select` → both role buttons work.
2. Student: chat send/receive persists after reload; crisis chip → crisis screen → back; settings → withdraw consent → logout returns to `/select`; tests → PHQ-9 full run (both a normal path and an item-9-override path) → result badge behaves correctly; 감정일기/리포트 tabs show coming-soon.
3. Teacher: dashboard row click → detail; alerts → unlock dialog requires a reason; alerts → "상담 연계" → session screen; student list search filters; violence timer ticks and submit button alerts; audit verify button shows success card; keyword add appends a row; threshold sliders + reason-gated save; group/account show coming-soon.
4. Role-switch button from both layouts returns to `/select` without console errors.

- [ ] **Step 3: Run the unit tests once more as a final regression check**

Run: `node js/data.test.js`
Expected: `All data.js tests passed.`

- [ ] **Step 4: Commit** — skip (no git repo). If the user later wants this pushed to GitHub Pages, that's a separate follow-up (git init, remote, Pages settings) not covered by this plan.

---

## Self-Review Notes

- **Spec coverage:** All 34 screens from the source planning doc map to a route: 13 student (`chat, checkin, tests, tests/take, tests/result, crisis, settings, persona, diary, testresult, letter, report` — note `s-login` is intentionally replaced by `/select` per explicit user instruction) + role-select, and 11 teacher routes (`dashboard, alerts, students, students/:id, session/:id, violence, audit, keyword, threshold, group, account`). Every P0/P1 screen gets real interaction; every P2 screen gets the shared coming-soon treatment. Confirmed against the Routes table in the File Structure section.
- **Placeholder scan:** No TBD/"add appropriate" phrasing remains; every step has literal code or an exact verification action.
- **Type/name consistency:** `getState`, `appendChat`, `appendCheckin`, `savePhq9Result`, `resetState` are the only state-mutation exports from `data.js` and are referenced identically in Tasks 4–6 and 8. `renderStudent`/`renderTeacher`/`registerRoute`/`navigate` are the only router exports and are referenced identically in every screen task. `comingSoonBody` and `openReasonDialog` are the only `components.js` exports, used identically in Tasks 9, 11, and 16.
- **Import consolidation reminder:** Several tasks append new imports from an already-imported module (`../data.js`, `../components.js`, `../router.js`). When executing, merge these into the single existing import statement at the top of each file rather than adding duplicate `import` lines for the same module — duplicate imports of the same specifier are not a syntax error in ES modules but are messy and should be avoided for readability.
