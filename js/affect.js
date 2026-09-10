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
  const label = affectLabel(sad, anxious, positive);
  const risk = round2(clamp01(0.6 * sad + 0.5 * anxious - 0.4 * positive));
  return { sad, anxious, positive, label, risk };
}

export function affectLabel(sad, anxious, positive){
  const top = Math.max(sad, anxious, positive);
  if(top < 0.25) return '중립';
  return top === sad ? '우울' : top === anxious ? '불안' : '긍정';
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
