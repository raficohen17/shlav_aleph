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
      const letter = LETTERS.find((l) => text.startsWith(l));
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

  /** "mm:ss" for elapsed seconds. */
  function formatTime(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  const api = { normalizeText, parseNumber, parseRule, expectedAnswer, isCorrect, formatTime, LETTERS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ShlavGrading = api;
})(this);
