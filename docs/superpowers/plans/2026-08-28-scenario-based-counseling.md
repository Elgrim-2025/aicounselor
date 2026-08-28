# 시나리오 기반 고정 대화 애니메이션 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace the free-input keyword-matched chat on `/student/chat` with 4 pre-scripted, auto-playing chat scenarios (school violence w/ photo-evidence turn, depression, career guidance, and a score-based digitized survey), per `docs/superpowers/specs/2026-08-28-scenario-based-counseling-design.md`.

**Architecture:** A new pure-data module (`js/scenarios.js`) holds the 4 scenario scripts and the survey scoring function. `js/screens/student.js`'s `/student/chat` route becomes a small state machine (module-scope variables, no new routes) toggling between a scenario-picker screen and a scenario-player screen that self-schedules its own turn reveals via `setTimeout`, reusing the existing `.chat-scroll`/`.bubble` and PHQ-9 `.progress-track`/`.likert-row` styles.

**Tech Stack:** Vanilla JS ES modules, no build step, no framework. Pure logic (`scoreSurvey`) is covered by a `node --test`-free `node:assert` script (`js/scenarios.test.js`), same convention as `js/data.test.js`. UI behavior is verified manually in the browser (this repo has no DOM test setup).

---

## File Structure

```
js/scenarios.js           new — SCENARIOS data (4 scripts) + scoreSurvey()
js/scenarios.test.js      new — node:assert tests for scoreSurvey() and SCENARIOS shape
js/data.js                modified — remove classifyIntent/CHAT_TEMPLATES/isCrisisText/appendChat
js/data.test.js           modified — remove classifyIntent test assertions
js/screens/student.js     modified — replace free-input chat with scenario picker + player
css/styles.css            modified — append scenario-card, typing-indicator, photo-bubble,
                           playback-controls, survey-summary styles
```

No new routes are added; `/student/chat` still resolves to a single render function that
now internally branches on module-scope state.

---

### Task 1: Scenario data module + tests

**Files:**
- Create: `js/scenarios.js`
- Test: `js/scenarios.test.js`

- [x] **Step 1: Write the failing test**

Create `js/scenarios.test.js`:

```js
import assert from 'node:assert/strict';
import { SCENARIOS, scoreSurvey } from './scenarios.js';

// SCENARIOS: 4 scenarios in a fixed order with the right shape
assert.equal(SCENARIOS.length, 4);
assert.deepEqual(SCENARIOS.map(s => s.id), ['violence', 'depression', 'career', 'survey']);
assert.equal(SCENARIOS.find(s => s.id === 'violence').turns.some(t => t.type === 'photo'), true);
assert.equal(SCENARIOS.find(s => s.id === 'survey').type, 'survey');
assert.equal(SCENARIOS.find(s => s.id === 'survey').questions.length, 8);

// scoreSurvey: per-category average (rounded to 1 decimal) + the highest-scoring category
const survey = SCENARIOS.find(s => s.id === 'survey');
const result = scoreSurvey(survey.questions);
assert.deepEqual(result.categories, [
  { name: '정서', avg: 0.7 },
  { name: '관계', avg: 0.7 },
  { name: '스트레스', avg: 1.5 },
]);
assert.equal(result.topCategory, '스트레스');

console.log('All scenarios.js tests passed.');
```

- [x] **Step 2: Run test to verify it fails**

Run: `node js/scenarios.test.js`
Expected: `Error [ERR_MODULE_NOT_FOUND]` — `js/scenarios.js` doesn't exist yet.

- [x] **Step 3: Create `js/scenarios.js`**

```js
export const SCENARIOS = [
  {
    id: 'violence',
    emoji: '🚨',
    title: '학교폭력 피해',
    subtitle: '친구에게 폭력을 당한 상황',
    type: 'chat',
    turns: [
      { who: 'bot', type: 'text', text: '다솜아, 요즘 표정이 안 좋아 보여서 걱정했어. 무슨 일 있었어?' },
      { who: 'me', type: 'text', text: '어제 학교에서... 애들 몇 명이 나를 때렸어.' },
      { who: 'bot', type: 'text', text: '많이 놀라고 아팠겠다. 지금 몸은 괜찮아? 어디 다친 데는 없어?' },
      { who: 'me', type: 'text', text: '팔이랑 등에 멍이 좀 들었어.' },
      { who: 'bot', type: 'text', text: '그랬구나. 혹시 다친 부분이나 그때 상황을 사진으로 남겨둘 수 있을까? 나중에 도움이 많이 될 거야.' },
      { who: 'me', type: 'photo' },
      { who: 'bot', type: 'text', text: '잘 받았어. 이 사진은 상담선생님께 안전하게, 너의 동의 하에만 전달돼. [기록됨]' },
      { who: 'bot', type: 'text', text: '언제, 어디서, 누가 그랬는지도 기억나는 만큼 말해줄 수 있어?' },
      { who: 'me', type: 'text', text: '어제 방과 후에 체육관 뒤에서, 같은 반 애들 세 명이었어.' },
      { who: 'bot', type: 'text', text: '말해줘서 정말 고마워. 너는 잘못한 게 하나도 없어. 이 내용은 담당 상담선생님께 바로 전달할게. 선생님이 곧 너에게 연락드릴 거야.' },
      { who: 'bot', type: 'text', text: '지금 이 순간이 무섭거나 불안하면 1388 청소년 상담전화로 언제든 전화해도 괜찮아. 오늘 얘기해줘서 고마워, 다솜아.' },
    ],
  },
  {
    id: 'depression',
    emoji: '💧',
    title: '우울감·무기력',
    subtitle: '마음이 가라앉는 시기',
    type: 'chat',
    turns: [
      { who: 'bot', type: 'text', text: '요즘 마음이 계속 가라앉아 있는 것 같아 보였어. 어떤 게 제일 힘들어?' },
      { who: 'me', type: 'text', text: '그냥... 아무것도 하기 싫고 재미가 없어. 학교 가는 것도 힘들어.' },
      { who: 'bot', type: 'text', text: '그런 시간을 혼자 견디고 있었구나. 언제부터 그런 기분이 들었어?' },
      { who: 'me', type: 'text', text: '한 2주 정도 된 것 같아. 잠도 잘 못 자.' },
      { who: 'bot', type: 'text', text: '많이 지쳤겠다. 잠도 못 자고 기분까지 가라앉으면 정말 힘들어. 밥은 잘 챙겨 먹고 있어?' },
      { who: 'me', type: 'text', text: '입맛도 별로 없어서 대충 먹어.' },
      { who: 'bot', type: 'text', text: '네가 겪고 있는 게 얼마나 힘든 건지 알아주고 싶어. 혹시 괜찮으면 짧은 정서 검사(PHQ-9)로 지금 상태를 같이 확인해볼래? 3분이면 끝나.' },
      { who: 'me', type: 'text', text: '응, 해볼게.' },
      { who: 'bot', type: 'text', text: '좋아. 검사 결과는 상담선생님께도 함께 전달돼서, 필요하면 먼저 연락드릴 수 있어. 지금처럼 힘든 마음이 들 때는 혼자 참지 말고 나한테 언제든 이야기해줘.' },
      { who: 'bot', type: 'text', text: '혹시 마음이 너무 힘들어서 위험한 생각이 들 땐 꼭 1388로 전화하거나 나한테 바로 말해줘. 너는 혼자가 아니야.' },
    ],
  },
  {
    id: 'career',
    emoji: '🧭',
    title: '진로 고민',
    subtitle: '적성과 진로 추천 상담',
    type: 'chat',
    turns: [
      { who: 'bot', type: 'text', text: '오늘은 네 진로 고민을 같이 이야기해볼까? 요즘 어떤 고민이 있어?' },
      { who: 'me', type: 'text', text: '고2인데 아직도 뭘 하고 싶은지 모르겠어. 다들 뭔가 정한 것 같은데 나만 없는 느낌이야.' },
      { who: 'bot', type: 'text', text: '그런 조급함, 많은 친구들이 느껴. 평소에 시간 가는 줄 모르고 좋아하는 활동이 있어?' },
      { who: 'me', type: 'text', text: '그림 그리는 거랑, 컴퓨터로 뭔가 만드는 걸 좋아해.' },
      { who: 'bot', type: 'text', text: '오, 창작하고 만드는 걸 좋아하는구나. 그런 흥미라면 디자인이나 개발, 콘텐츠 제작 쪽이 잘 맞을 수도 있어.' },
      { who: 'bot', type: 'text', text: '네 흥미와 강점을 더 정확히 알아보고 싶으면 진로흥미검사를 해보는 것도 추천해. 결과를 바탕으로 관련 학과나 직업도 같이 살펴볼 수 있어.' },
      { who: 'me', type: 'text', text: '오 좋다. 어떤 직업들이 있는지 궁금해.' },
      { who: 'bot', type: 'text', text: 'UX/UI 디자이너, 게임 아트 디렉터, 프론트엔드 개발자, 콘텐츠 크리에이터 같은 직업들이 네 관심사랑 잘 맞을 것 같아. 관심 가는 게 있어?' },
      { who: 'me', type: 'text', text: 'UX 디자이너는 처음 들어봐. 더 알고 싶어.' },
      { who: 'bot', type: 'text', text: '사람들이 앱이나 서비스를 더 쉽고 편하게 쓸 수 있도록 화면과 흐름을 설계하는 직업이야. 그림과 논리적 사고를 같이 쓰는 일이라 네 강점이랑 잘 맞을 수 있어.' },
      { who: 'bot', type: 'text', text: '다음에 만나면 진로흥미검사 결과를 가지고 더 자세히 얘기해보자. 오늘 이야기해줘서 고마워!' },
    ],
  },
  {
    id: 'survey',
    emoji: '📋',
    title: '마음 설문조사',
    subtitle: '선생님 대신 채팅으로 편하게 조사해요',
    type: 'survey',
    scaleOptions: ['전혀 아니다', '가끔 그렇다', '자주 그렇다', '매우 그렇다'],
    questions: [
      { category: '정서', text: '기분이 가라앉거나 우울하다고 느꼈다', answerIndex: 1 },
      { category: '정서', text: '사소한 일에도 화가 나거나 짜증이 났다', answerIndex: 1 },
      { category: '정서', text: '잠들기 어렵거나 자주 깼다', answerIndex: 0 },
      { category: '관계', text: '친구들과 어울리기 힘들다고 느꼈다', answerIndex: 1 },
      { category: '관계', text: '반에서 나를 이해해주는 사람이 없다고 느꼈다', answerIndex: 0 },
      { category: '관계', text: '다른 사람들과 갈등이 있었다', answerIndex: 1 },
      { category: '스트레스', text: '학업이나 시험에 대한 부담을 느꼈다', answerIndex: 2 },
      { category: '스트레스', text: '집이나 가족 문제로 스트레스를 받았다', answerIndex: 1 },
    ],
    outro: '선생님께 자동으로 전달돼요. 종이로 일일이 취합하지 않아도 반 전체 마음 상태를 한눈에 볼 수 있어요.',
  },
];

export function scoreSurvey(questions){
  const order = [];
  const sums = {};
  const counts = {};
  for(const q of questions){
    if(!(q.category in sums)){
      sums[q.category] = 0;
      counts[q.category] = 0;
      order.push(q.category);
    }
    sums[q.category] += q.answerIndex;
    counts[q.category] += 1;
  }
  const categories = order.map(name => ({
    name,
    avg: Math.round((sums[name] / counts[name]) * 10) / 10,
  }));
  const topCategory = categories.reduce((a, b) => (b.avg > a.avg ? b : a), categories[0]).name;
  return { categories, topCategory };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `node js/scenarios.test.js`
Expected: `All scenarios.js tests passed.`

- [x] **Step 5: Commit**

```bash
git add js/scenarios.js js/scenarios.test.js
git commit -m "feat: add scenario data module with 4 scripted counseling scenarios"
```

---

### Task 2: Remove free-input chat logic from the data layer

**Files:**
- Modify: `js/data.js`
- Modify: `js/data.test.js`

- [x] **Step 1: Remove `classifyIntent`, `CHAT_TEMPLATES`, `isCrisisText` from `js/data.js`**

Find this block at the top of `js/data.js` (lines 1–27):

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
```

Replace it with:

```js
// ---------- pure logic ----------

const PHQ9_ITEM9_INDEX = 8;
```

- [x] **Step 2: Remove `appendChat` from `js/data.js`**

Find:

```js
export function appendChat(entry){
  const state = loadState();
  state.chat.push(entry);
  saveState(state);
  return state.chat;
}

export function appendCheckin(entry){
```

Replace with:

```js
export function appendCheckin(entry){
```

- [x] **Step 3: Remove the unused `chat` field from `loadState()`'s default state**

Find:

```js
function loadState(){
  try{
    return JSON.parse(localStorage.getItem(LS_KEY)) || { chat: [], checkins: [], phq9: null };
  }catch{
    return { chat: [], checkins: [], phq9: null };
  }
}
```

Replace with:

```js
function loadState(){
  try{
    return JSON.parse(localStorage.getItem(LS_KEY)) || { checkins: [], phq9: null };
  }catch{
    return { checkins: [], phq9: null };
  }
}
```

- [x] **Step 4: Remove the `classifyIntent` test block from `js/data.test.js`**

Find:

```js
import assert from 'node:assert/strict';
import { classifyIntent, scorePhq9, timeLeftLabel, verifyChain } from './data.js';

// classifyIntent: keyword-based, returns one of 'friend' | 'depressed' | 'study' | 'default'
assert.equal(classifyIntent('친구들하고 어울리기 힘들어'), 'friend');
assert.equal(classifyIntent('학교 성적 때문에 너무 힘들어'), 'study');
assert.equal(classifyIntent('그냥 다 의미 없는 것 같아요'), 'depressed');
assert.equal(classifyIntent('오늘 날씨 좋다'), 'default');

// scorePhq9: 9 answers (0-3 each), item index 8 (0-based) is the override item
```

Replace with:

```js
import assert from 'node:assert/strict';
import { scorePhq9, timeLeftLabel, verifyChain } from './data.js';

// scorePhq9: 9 answers (0-3 each), item index 8 (0-based) is the override item
```

- [x] **Step 5: Run tests to verify they still pass**

Run: `node js/data.test.js`
Expected: `All data.js tests passed.`

Run: `node js/scenarios.test.js`
Expected: `All scenarios.js tests passed.`

- [x] **Step 6: Commit**

```bash
git add js/data.js js/data.test.js
git commit -m "refactor: remove free-input chat keyword-matching logic, now unused"
```

---

### Task 3: Scenario playback styles

**Files:**
- Modify: `css/styles.css`

- [x] **Step 1: Append scenario playback styles to `css/styles.css`**

Add this block at the end of the file:

```css

/* scenario playback */
.scenario-card{display:flex;align-items:center;gap:12px;border:1px solid var(--line-soft);border-radius:var(--radius-md);padding:14px;margin-bottom:10px;background:var(--paper);}
.scenario-card .emoji{font-size:24px;}
.scenario-card .grow{flex:1;}
.scenario-card .grow b{font-size:14px;display:block;margin-bottom:2px;}
.scenario-card .grow span{font-size:11.5px;color:var(--ink-soft);}
.scenario-card .chev{color:var(--ink-faint);font-size:16px;}

.bubble.typing{display:flex;gap:4px;align-items:center;padding:12px 16px;}
.bubble.typing span{width:6px;height:6px;border-radius:50%;background:var(--ink-faint);display:inline-block;animation:typingBounce 1s infinite ease-in-out;}
.bubble.typing span:nth-child(2){animation-delay:.15s;}
.bubble.typing span:nth-child(3){animation-delay:.3s;}
@keyframes typingBounce{0%,60%,100%{transform:translateY(0);opacity:.5;}30%{transform:translateY(-4px);opacity:1;}}

.bubble.photo{padding:0;overflow:hidden;width:150px;background:none;}
.photo-thumb{background:var(--line-soft);height:110px;display:flex;align-items:center;justify-content:center;font-size:28px;color:var(--ink-faint);}
.photo-filename{background:var(--accent);color:#fff;font-size:10.5px;padding:6px 8px;}

.scenario-controls{display:flex;justify-content:center;gap:16px;padding-top:10px;}
.scenario-controls button{border:1px solid var(--line);background:var(--paper);border-radius:999px;padding:8px 16px;font-size:12.5px;color:var(--ink-soft);}

.survey-summary{text-align:center;}
.summary-row{display:flex;gap:10px;margin:14px 0;}
.summary-box{flex:1;border:1px solid var(--line-soft);border-radius:var(--radius-md);padding:12px 8px;background:var(--paper);}
.summary-box .num{font-size:18px;font-weight:700;}
.summary-box .lbl{font-size:11px;color:var(--ink-soft);margin-top:2px;}
```

- [x] **Step 2: Commit**

```bash
git add css/styles.css
git commit -m "style: add scenario picker/player, typing indicator, photo bubble styles"
```

---

### Task 4: Rewrite the chat route as a scenario picker + player

**Files:**
- Modify: `js/screens/student.js`

- [x] **Step 1: Replace imports at the top of `js/screens/student.js`**

Find:

```js
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
```

Replace with:

```js
import { registerRoute, renderStudent } from '../router.js';
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
  renderStudent(root, path, body, { title: scenario.title, headerExtra: EXIT_BTN, bodyClass:'chat-body' });
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
```

- [x] **Step 2: Manually sanity-check the diff**

Run: `git diff js/screens/student.js`
Expected: only the imports + chat section changed; the check-in, tests, crisis, settings,
and P2 coming-soon sections below are untouched.

- [x] **Step 3: Commit**

```bash
git add js/screens/student.js
git commit -m "feat: replace free-input chat with scripted scenario picker + player"
```

---

### Task 5: Manual browser verification

**Files:** none (verification only)

- [x] **Step 1: Start the static server and open the app**

Use the Browser preview tool (or `npx serve .`) to open `index.html`, then navigate to
`#/student/chat` after picking "학생화면으로 접속".

- [x] **Step 2: Verify the picker screen**

Confirm 4 cards appear in order: 🚨 학교폭력 피해, 💧 우울감·무기력, 🧭 진로 고민,
📋 마음 설문조사. Confirm the ⚙ settings icon and the bottom tab bar (채팅/감정일기/검사/리포트)
are still present and the 채팅 tab is highlighted active.

- [x] **Step 3: Verify the 🚨 학교폭력 피해 scenario**

Click the card. Confirm: a typing indicator briefly appears before each bot bubble, turns
appear one at a time and auto-scroll into view, the photo turn renders as a gray thumbnail
with a "사진.jpg" filename bar (not the input textbox, not a real image), and after the
last bot turn a "다른 시나리오 보기" button appears (no more pause/restart controls).
Click it and confirm it returns to the picker screen.

- [x] **Step 4: Verify pause/resume and restart mid-playback**

Re-open the 💧 우울감·무기력 scenario. While it's mid-playback, click "⏸ 일시정지" and
confirm no new bubbles appear while paused. Click "▶ 재생" and confirm playback resumes
from the same point (not from the start). Click "↺ 처음부터" and confirm the bubble list
clears and playback restarts from turn 1.

- [x] **Step 5: Verify the ✕ exit button**

Mid-playback on the 🧭 진로 고민 scenario, click the ✕ button in the top bar. Confirm it
returns immediately to the picker screen (not to the settings screen or a blank screen).

- [x] **Step 6: Verify the 📋 마음 설문조사 scenario**

Click the card. Confirm the screen switches to the PHQ-9-style question card layout
(progress bar + `likert-row` buttons, bottom tab bar hidden) with no scenario intro
bubbles — question 1 shows immediately. Watch the scripted answer button highlight
(black background) shortly after each question appears, then auto-advance. After the
8th question, confirm the summary screen shows three score boxes — 정서 0.7, 관계 0.7,
스트레스 1.5 — the sentence "스트레스 영역 점수가 다른 영역보다 조금 높아요.", the
outro sentence about teachers, and a "다른 시나리오 보기" button.

- [x] **Step 7: Verify disabled footer chips and navigation don't break**

On any chat-type scenario mid-playback, confirm the "컨텐츠를 추천해요" and "상담
요청하기" chips render with the disabled (dimmed) style and clicking them does nothing.
Start a scenario, then click the "검사" bottom tab before it finishes; confirm the tests
list renders normally and open the browser console to confirm no errors are logged (this
checks the playback timer's stale-navigation guard).

- [x] **Step 8: Re-run the automated tests**

Run: `node js/data.test.js`
Expected: `All data.js tests passed.`

Run: `node js/scenarios.test.js`
Expected: `All scenarios.js tests passed.`

- [x] **Step 9: Commit any fixes found during manual QA**

If Steps 2–8 surfaced bugs, fix them in the relevant file(s) and commit:

```bash
git add -A
git commit -m "fix: address issues found during scenario playback QA"
```

If no issues were found, skip this step (nothing to commit).
