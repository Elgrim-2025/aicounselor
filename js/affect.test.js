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
