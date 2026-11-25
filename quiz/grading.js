// Pure grading helpers for the online quiz. Loaded by quiz.html and by node tests.
(function (root) {
  'use strict';

  const NIKUD = /[֑-ׇ]/g;
  const LETTERS = ['א', 'ב', 'ג', 'ד'];

  /** Hebrew text without nikud, punctuation or extra spaces, for comparing words. */
  function normalizeText(text) {
    return String(text || '')
      .replace(NIKUD, '')
      .replace(/[־\-–]/g, ' ')
      .replace(/["'״׳.,!?:;()]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** A whole non-negative number typed by the child, or null if it is not one. */
  function parseNumber(text) {
    const s = String(text || '').trim();
    if (!/^\d{1,4}$/.test(s)) return null;
    return Number(s);
  }

  /** Parse a data-accept rule such as "range:0-4", "gt:26,le:80", "mult:5,lt:40", "words:a|b". */
  function parseRule(rule) {
    const s = String(rule || '').trim();
    if (s.startsWith('words:')) {
      return { kind: 'words', words: s.slice(6).split('|').map(normalizeText).filter(Boolean) };
    }
    const checks = s.split(',').map((part) => part.trim()).filter(Boolean).map((part) => {
      if (part === 'even') return { op: 'even' };
      const [op, value] = part.split(':');
      if (op === 'range') {
        const [lo, hi] = value.split('-').map(Number);
        return { op, lo, hi };
      }
      if (!['gt', 'ge', 'lt', 'le', 'mult', 'eq'].includes(op)) throw new Error('unknown rule: ' + part);
      return { op, value: Number(value) };
    });
    return { kind: 'num', checks };
  }

  function passesCheck(check, n) {
    switch (check.op) {
      case 'range': return n >= check.lo && n <= check.hi;
      case 'gt': return n > check.value;
      case 'ge': return n >= check.value;
      case 'lt': return n < check.value;
      case 'le': return n <= check.value;
      case 'eq': return n === check.value;
      case 'mult': return n % check.value === 0;
      case 'even': return n % 2 === 0;
      default: return false;
    }
  }

  /**
   * The expected answer of one item.
   * keyText: the "answer" cell of the answer-key row; accept: the item's data-accept (or '');
   * isMultipleChoice: whether the item has א–ד options.
   */
  function expectedAnswer(keyText, accept, isMultipleChoice) {
    const text = String(keyText || '').trim();
    if (isMultipleChoice) {
      // stage A keys start with a letter (א–ד); stage B keys with the option number (1–4)
      const digit = /^([1-4])(?!\d)/.exec(text);
      const letter = digit ? LETTERS[Number(digit[1]) - 1] : LETTERS.find((l) => text.startsWith(l));
      if (!letter) throw new Error('no answer letter in: ' + text);
      return { type: 'mc', letter, display: text };
    }
    if (accept) {
      const rule = parseRule(accept);
      return rule.kind === 'words'
        ? { type: 'word', words: rule.words, display: text }
        : { type: 'num', checks: rule.checks, display: text };
    }
    const num = /^\d+/.exec(text);
    if (num) return { type: 'num', checks: [{ op: 'eq', value: Number(num[0]) }], display: text };
    return { type: 'word', words: [normalizeText(text)], display: text };
  }

  /** Whether the child's response (a letter, or typed text) matches the expected answer. */
  function isCorrect(expected, response) {
    if (response == null || String(response).trim() === '') return false;
    if (expected.type === 'mc') return response === expected.letter;
    if (expected.type === 'num') {
      const n = parseNumber(response);
      return n !== null && expected.checks.every((c) => passesCheck(c, n));
    }
    return expected.words.includes(normalizeText(response));
  }

  /**
   * The practice tracks, in display order. A test id is the track prefix + its number:
   * "3" → grade 2 stage A, "b3" → grade 2 stage B, "g3b3" → grade 3 stage B.
   */
  const TRACKS = [
    { key: 'g2a', prefix: '', grade: "כיתה ב'", stage: "שלב א'", timed: true },
    { key: 'g2b', prefix: 'b', grade: "כיתה ב'", stage: "שלב ב'", timed: false },
    { key: 'g3b', prefix: 'g3b', grade: "כיתה ג'", stage: "שלב ב'", timed: false },
  ];
  const ID_RE = /^(g3b|b)?(\d+)$/;

  /** {track, num} of a test id such as "g3b2", or null. */
  function parseTestId(id) {
    const m = ID_RE.exec(String(id || ''));
    if (!m) return null;
    return { track: TRACKS.find((t) => t.prefix === (m[1] || '')), num: Number(m[2]) };
  }

  /** "test_3.html" → {id:"3", stage:"A", track:"g2a"}; "test_g3b3.html" → {id:"g3b3", stage:"B", track:"g3b"}; else null. */
  function testIdFromFile(name) {
    const m = /^test_((?:g3b|b)?\d+)\.html$/.exec(String(name || ''));
    if (!m) return null;
    const { track } = parseTestId(m[1]);
    return { id: m[1], stage: track.key === 'g2a' ? 'A' : 'B', track: track.key };
  }

  /** Full name of a test: "כיתה ג' · שלב ב' · מבחן 2". */
  function testLabel(id) {
    const p = parseTestId(id);
    return p ? p.track.grade + ' · ' + p.track.stage + ' · מבחן ' + p.num : 'מבחן ' + id;
  }

  /** The score group of a part heading: stage A "reading"/"math" by its h2, stage B the part number. */
  function partLabel(headingText) {
    const t = String(headingText || '').replace(NIKUD, '');
    const part = /חלק\s*(\d+)/.exec(t);
    if (part) return 'חלק ' + part[1];
    return /חשבון/.test(t) ? 'חשבון' : 'הבנת הנקרא';
  }

  /** "mm:ss" for elapsed seconds. */
  function formatTime(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  const api = {
    normalizeText, parseNumber, parseRule, expectedAnswer, isCorrect, formatTime,
    TRACKS, parseTestId, testIdFromFile, testLabel, partLabel, LETTERS,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ShlavGrading = api;
})(this);
