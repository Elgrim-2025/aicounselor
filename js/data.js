// ---------- pure logic ----------

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
    return JSON.parse(localStorage.getItem(LS_KEY)) || { checkins: [], phq9: null };
  }catch{
    return { checkins: [], phq9: null };
  }
}
function saveState(state){
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

export function getState(){ return loadState(); }

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
