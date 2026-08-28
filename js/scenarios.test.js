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
