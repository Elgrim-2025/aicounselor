import assert from 'node:assert/strict';
import { scorePhq9, timeLeftLabel, verifyChain } from './data.js';

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
const seed = timeLeftLabel(36*3600 + 12*60 + 5);
assert.equal(`${seed.h}:${seed.m}:${seed.s}`, '36:12:05');

const t = timeLeftLabel(3600); // 1 hour left of 48h budget -> past the 44h warning line
assert.equal(t.level, 'danger');
const t2 = timeLeftLabel(48*3600 - 23*3600); // 23h elapsed -> before 24h line
assert.equal(t2.level, 'normal');

// verifyChain: mock chain integrity check always resolves ok in this demo
assert.deepEqual(verifyChain(), { ok: true, message: '체인 무결성 검증 완료 — 불일치 없음' });

console.log('All data.js tests passed.');
