const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const g = require('../quiz/grading.js');

test('normalizeText strips nikud, punctuation and spaces', () => {
  assert.equal(g.normalizeText('  הַחֲתוּלָה. '), 'החתולה');
  assert.equal(g.normalizeText('שְׁתֵּי   פְּעָמִים'), 'שתי פעמים');
  assert.equal(g.normalizeText('"שורש"'), 'שורש');
});

test('parseNumber accepts only whole numbers', () => {
  assert.equal(g.parseNumber(' 47 '), 47);
  assert.equal(g.parseNumber('0'), 0);
  assert.equal(g.parseNumber('4.5'), null);
  assert.equal(g.parseNumber('-3'), null);
  assert.equal(g.parseNumber('ארבע'), null);
  assert.equal(g.parseNumber(''), null);
});

test('multiple choice uses the leading key letter', () => {
  const e = g.expectedAnswer('ב (19)', '', true);
  assert.equal(e.letter, 'ב');
  assert.ok(g.isCorrect(e, 'ב'));
  assert.ok(!g.isCorrect(e, 'ג'));
  assert.ok(!g.isCorrect(e, null));
  assert.throws(() => g.expectedAnswer('19', '', true));
});

test('exact number from the key', () => {
  const e = g.expectedAnswer('83', '', false);
  assert.ok(g.isCorrect(e, '83'));
  assert.ok(!g.isCorrect(e, '38'), 'reversed digits are wrong, like the official scoring');
});

test('range and comparison rules', () => {
  const r = g.expectedAnswer('כל מספר מ-0 עד 4', 'range:0-4', false);
  assert.ok(g.isCorrect(r, '0') && g.isCorrect(r, '4'));
  assert.ok(!g.isCorrect(r, '5'));
  const gtle = g.expectedAnswer('27–80', 'gt:26,le:80', false);
  assert.ok(g.isCorrect(gtle, '27') && g.isCorrect(gtle, '80'));
  assert.ok(!g.isCorrect(gtle, '26') && !g.isCorrect(gtle, '81'));
});

test('multiple-of and even rules', () => {
  const m = g.expectedAnswer('', 'mult:5,lt:40', false);
  assert.ok(g.isCorrect(m, '20') && g.isCorrect(m, '35'));
  assert.ok(!g.isCorrect(m, '40') && !g.isCorrect(m, '21'));
  const ev = g.expectedAnswer('', 'even,gt:10', false);
  assert.ok(g.isCorrect(ev, '12') && !g.isCorrect(ev, '13') && !g.isCorrect(ev, '10'));
});

test('word answers accept listed forms without nikud', () => {
  const w = g.expectedAnswer('פעמיים', 'words:פעמיים|2 פעמים|שתי פעמים', false);
  assert.ok(g.isCorrect(w, 'פַּעֲמַיִים') || g.isCorrect(w, 'פעמיים'));
  assert.ok(g.isCorrect(w, ' 2 פעמים '));
  assert.ok(!g.isCorrect(w, 'פעם'));
});

test('unknown rule is rejected', () => {
  assert.throws(() => g.parseRule('between:1-3'));
});

test('formatTime', () => {
  assert.equal(g.formatTime(0), '00:00');
  assert.equal(g.formatTime(2400), '40:00');
  assert.equal(g.formatTime(61.9), '01:01');
});

// Every test in the repo must grade cleanly: question count = key rows, and every key parses.
test('all tests have a gradable answer key', () => {
  const dir = path.join(__dirname, '..', 'tests');
  const files = fs.readdirSync(dir).filter((f) => /^test_\d+\.html$/.test(f));
  assert.ok(files.length >= 5);
  for (const f of files) {
    const html = fs.readFileSync(path.join(dir, f), 'utf8');
    const [main, key] = html.split('class="answers"');
    const qs = [...main.matchAll(/<div([^>]*class="q[ "][^>]*)>[\s\S]*?(?=<div[^>]*class="q[ "]|<div class="page-break"|<p class="next|<p class="stop|<p class="end|$)/g)];
    const rows = [...key.matchAll(/<tr><td>[^<]*<\/td><td>([\s\S]*?)<\/td>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());
    assert.equal(qs.length, rows.length, f + ': questions vs key rows');
    qs.forEach((m, i) => {
      const accept = (/data-accept="([^"]*)"/.exec(m[1]) || [])[1] || '';
      const isMc = /class="opts/.test(m[0]);
      const e = g.expectedAnswer(rows[i], accept, isMc);
      if (!isMc && !accept) assert.equal(e.type, 'num', `${f} item ${i + 1}: open item without data-accept must have a number key, got "${rows[i]}"`);
    });
  }
});
