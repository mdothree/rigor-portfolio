// CQA-RIGOR-PORTFOLIO-RESULT-SCHEMA: a missing/null model score must be rejected, never shown as a real 0.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom, until } from './helpers/fake-dom.mjs';

let n = 0;
async function review(payload) {
  const els = installDom();
  const errors = [];
  globalThis.__api = async () => payload;
  globalThis.__toolError = e => errors.push(e.message);
  await import(`../public/js/app.js?t${++n}`);
  document.getElementById('btn-review').click();
  await until(() => errors.length || !document.getElementById('results').classList.contains('hidden'));
  return { els, errors };
}

for (const [label, overall] of [['null', null], ['empty string', ''], ['false', false], ['empty array', []], ['missing', undefined]]) {
  test(`overall ${label} is an incomplete review, not a score of 0`, async () => {
    const { els, errors } = await review({ overall, categories: [] });
    assert.deepEqual(errors, ['The server returned an incomplete review.']);
    assert.equal(document.getElementById('score-display').innerHTML, '');
    assert.equal(document.getElementById('results').classList.contains('hidden'), true);
  });
}

test('a genuine overall of 0 and numeric strings still render', async () => {
  let r = await review({ overall: 0, categories: [] });
  assert.deepEqual(r.errors, []);
  assert.match(document.getElementById('score-display').innerHTML, /score-value">0</);
  r = await review({ overall: '72', categories: [] });
  assert.match(document.getElementById('score-display').innerHTML, /score-value">72</);
});

test('a category without a score is not shown as 0/100', async () => {
  const { els } = await review({ overall: 70, categories: [{ name: 'Clarity', feedback: 'ok' }, { name: 'Depth', score: 0, feedback: 'thin' }] });
  const html = document.getElementById('review-grid').innerHTML;
  assert.doesNotMatch(html, /Clarity · 0\/100/);
  assert.match(html, /Depth · 0\/100/);
});
