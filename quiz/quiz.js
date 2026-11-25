// Online quiz: renders a test from window.SHLAV_TESTS in the browser, grades it locally.
// Nothing is sent anywhere; progress is kept in this browser's localStorage only.
(function () {
  'use strict';

  const G = window.ShlavGrading;
  const TESTS = window.SHLAV_TESTS || [];
  // a timed track (grade 2 stage A) shows the real test's ~40 minutes; stage B shows elapsed time only
  const STAGE_A_LIMIT = 40 * 60;
  const OPTION = 'ol.opts li, .fig-opts .fo';
  const QUESTION = '.q:not(.cell)'; // stage B marks the "?" figure cell with class q too
  const $ = (sel, el = document) => el.querySelector(sel);
  const trackOf = (test) => (G.parseTestId(test.id) || { track: G.TRACKS[0] }).track;
  const limitOf = (test) => (trackOf(test).timed ? STAGE_A_LIMIT : Infinity);

  const ui = {
    picker: $('#picker'), list: $('#test-list'), runner: $('#runner'), paper: $('#paper'),
    title: $('#run-title'), timer: $('#timer'), progress: $('#progress'), instant: $('#instant'),
    submit: $('#submit'), restart: $('#restart'), back: $('#back'), pdf: $('#pdf-link'),
    summary: $('#summary'), all: $('#all-tests'),
  };

  let current = null; // { test, items, startedAt, submitted, timerId }

  // ---------- storage (best effort) ----------
  const storeKey = (id) => 'shlav-quiz-' + id;
  function load(id) {
    try { return JSON.parse(localStorage.getItem(storeKey(id)) || 'null'); } catch (e) { return null; }
  }
  function save() {
    if (!current) return;
    const data = {
      answers: current.items.map((it) => it.response),
      startedAt: current.startedAt, submitted: current.submitted, elapsed: current.elapsed,
    };
    try { localStorage.setItem(storeKey(current.test.id), JSON.stringify(data)); } catch (e) { /* private mode */ }
  }
  function clear(id) { try { localStorage.removeItem(storeKey(id)); } catch (e) { /* ignore */ } }

  // ---------- picker ----------
  // onlyTrack: a track key from "#track-<key>" shows that track alone
  function renderPicker(onlyTrack) {
    ui.list.innerHTML = '';
    G.TRACKS.filter((tr) => !onlyTrack || tr.key === onlyTrack).forEach((tr) => {
      const tests = TESTS.filter((t) => trackOf(t).key === tr.key);
      if (!tests.length) return;
      const head = document.createElement('li');
      head.className = 'pick-stage';
      head.id = 'track-' + tr.key;
      head.textContent = tr.grade + ' · ' + tr.stage;
      ui.list.appendChild(head);
      tests.forEach((t) => {
        const saved = load(t.id);
        const li = document.createElement('li');
        li.className = 'pick';
        const status = saved ? (saved.submitted ? 'נבדק' : 'בהתקדמות') : '';
        li.innerHTML =
          '<a class="pick-btn" href="#test-' + t.id + '"><span class="pick-num">מבחן ' + G.parseTestId(t.id).num + '</span>' +
          '<span class="pick-meta">' + t.questions + ' שאלות' + (status ? ' · ' + status : '') + '</span></a>';
        ui.list.appendChild(li);
      });
    });
    ui.all.hidden = !onlyTrack;
  }

  // ---------- building a test ----------
  function partOf(el, headings) {
    let part = G.partLabel('');
    headings.forEach((h) => {
      if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) part = G.partLabel(h.textContent);
    });
    return part;
  }

  function buildTest(test) {
    const doc = new DOMParser().parseFromString('<div id="root">' + test.html + '</div>', 'text/html');
    const root = doc.getElementById('root');
    const key = root.querySelector('section.answers');
    const rows = key ? [...key.querySelectorAll('tr')].filter((tr) => tr.querySelector('td')) : [];
    root.querySelectorAll('section.cover, section.answers, .page-break, p.next, p.stop, p.end').forEach((n) => n.remove());

    const headings = [...root.querySelectorAll('h2, .part-title')];
    const qs = [...root.querySelectorAll(QUESTION)];
    if (qs.length !== rows.length) throw new Error('מספר השאלות לא תואם למפתח (' + qs.length + '/' + rows.length + ')');

    const items = qs.map((q, i) => {
      const cells = rows[i].querySelectorAll('td');
      const opts = q.querySelector('ol.opts, .fig-opts');
      const expected = G.expectedAnswer(cells[1].textContent, q.getAttribute('data-accept') || '', !!opts);
      const item = { el: q, expected, explain: cells[2] ? cells[2].innerHTML : '', part: partOf(q, headings), response: null, input: null };
      q.dataset.idx = String(i);
      if (opts) {
        opts.setAttribute('role', 'radiogroup');
        [...q.querySelectorAll(OPTION)].forEach((li, j) => {
          li.dataset.letter = G.LETTERS[j];
          li.setAttribute('role', 'radio');
          li.setAttribute('aria-checked', 'false');
          li.tabIndex = 0;
        });
      } else {
        const blank = q.querySelector('.blank');
        const input = document.createElement('input');
        const isWord = expected.type === 'word';
        input.className = 'answer-input' + (isWord ? ' word' : '');
        input.type = 'text';
        input.autocomplete = 'off';
        input.setAttribute('inputmode', isWord ? 'text' : 'numeric');
        input.setAttribute('aria-label', 'תשובה לשאלה');
        input.dir = isWord ? 'rtl' : 'ltr';
        if (blank) blank.replaceWith(input); else q.appendChild(input);
        item.input = input;
      }
      return item;
    });
    return { root, items };
  }

  // ---------- running ----------
  function startTest(id) {
    const test = TESTS.find((t) => String(t.id) === String(id));
    if (!test) return showPicker();
    stopTimer();
    let built;
    try { built = buildTest(test); } catch (e) { alert('שגיאה בטעינת המבחן: ' + e.message); return showPicker(); }

    const saved = load(id);
    current = {
      test, items: built.items, submitted: false,
      startedAt: saved && saved.startedAt ? saved.startedAt : Date.now(),
      elapsed: saved && saved.elapsed ? saved.elapsed : null,
    };
    ui.paper.innerHTML = '';
    ui.paper.appendChild(built.root);
    ui.title.textContent = G.testLabel(test.id);
    ui.pdf.href = test.pdf;
    ui.summary.hidden = true;
    ui.summary.innerHTML = '';

    if (saved && Array.isArray(saved.answers)) {
      saved.answers.forEach((r, i) => { if (r != null && current.items[i]) setResponse(current.items[i], r, false); });
    }
    if (saved && saved.submitted) grade(false);
    else { save(); startTimer(); }

    ui.picker.hidden = true;
    ui.runner.hidden = false;
    updateProgress();
    window.scrollTo(0, 0);
  }

  function setResponse(item, value, persist = true) {
    item.response = value;
    if (item.input) {
      item.input.value = value;
    } else {
      item.el.querySelectorAll(OPTION).forEach((li) => {
        const on = li.dataset.letter === value;
        li.classList.toggle('chosen', on);
        li.setAttribute('aria-checked', on ? 'true' : 'false');
      });
    }
    if (persist) {
      save();
      updateProgress();
      if (ui.instant.checked && !current.submitted) showFeedback(item);
    }
  }

  function updateProgress() {
    if (!current) return;
    const answered = current.items.filter((it) => it.response != null && String(it.response).trim() !== '').length;
    ui.progress.textContent = 'נענו ' + answered + ' מתוך ' + current.items.length;
  }

  // ---------- timer ----------
  function startTimer() {
    stopTimer();
    tick();
    current.timerId = setInterval(tick, 1000);
  }
  function stopTimer() { if (current && current.timerId) { clearInterval(current.timerId); current.timerId = null; } }
  function tick() {
    if (!current) return;
    const secs = current.elapsed != null && current.submitted ? current.elapsed : (Date.now() - current.startedAt) / 1000;
    ui.timer.textContent = G.formatTime(secs);
    ui.timer.classList.toggle('over', secs > limitOf(current.test));
  }

  // ---------- grading ----------
  function showFeedback(item) {
    const ok = G.isCorrect(item.expected, item.response);
    item.el.classList.toggle('is-right', ok);
    item.el.classList.toggle('is-wrong', !ok);
    item.el.querySelectorAll(OPTION).forEach((li) => {
      li.classList.toggle('correct', li.dataset.letter === item.expected.letter);
    });
    let fb = item.el.querySelector('.feedback');
    if (!fb) { fb = document.createElement('div'); fb.className = 'feedback'; item.el.appendChild(fb); }
    const unanswered = item.response == null || String(item.response).trim() === '';
    fb.innerHTML =
      '<strong>' + (ok ? '✓ נכון' : unanswered ? '— לא נענה' : '✗ לא נכון') + '</strong>' +
      (ok ? '' : ' · התשובה: <span class="ans">' + escapeHtml(item.expected.display) + '</span>') +
      (item.explain ? '<div class="explain">' + item.explain + '</div>' : '');
    return ok;
  }

  function grade(persist = true) {
    if (!current) return;
    if (!current.submitted) current.elapsed = (Date.now() - current.startedAt) / 1000;
    current.submitted = true;
    stopTimer();
    tick();
    const score = new Map(); // part label → [right, total], in test order
    current.items.forEach((it) => {
      const ok = showFeedback(it);
      if (!score.has(it.part)) score.set(it.part, [0, 0]);
      score.get(it.part)[1] += 1;
      if (ok) score.get(it.part)[0] += 1;
      if (it.input) it.input.readOnly = true;
    });
    current.items.forEach((it) => it.el.classList.add('locked'));
    const parts = [...score.entries()];
    const total = parts.reduce((s, [, v]) => s + v[0], 0);
    const over = current.elapsed > limitOf(current.test);
    ui.summary.innerHTML =
      '<h2>תוצאה: ' + total + ' מתוך ' + current.items.length + '</h2>' +
      '<p>' + parts.map(([name, v]) => escapeHtml(name) + ': ' + v[0] + '/' + v[1]).join(' · ') +
      ' · זמן: ' + G.formatTime(current.elapsed) + (over ? ' (יותר מ-' + STAGE_A_LIMIT / 60 + ' דקות)' : '') + '</p>' +
      '<p class="hint">ליד כל שאלה מופיעים התשובה הנכונה, הסבר וטריק. כדאי לעבור דווקא על השאלות שסומנו ✗.</p>';
    ui.summary.hidden = false;
    ui.submit.disabled = true;
    if (persist) { save(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  // ---------- events ----------
  ui.paper.addEventListener('click', (e) => {
    const li = e.target.closest(OPTION);
    const q = li && li.closest(QUESTION);
    if (!q || !current || current.submitted) return; // options inside a worked example are not questions
    const item = current.items[Number(q.dataset.idx)];
    setResponse(item, li.dataset.letter);
  });
  ui.paper.addEventListener('keydown', (e) => {
    const li = e.target.closest && e.target.closest(OPTION);
    if (li && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); li.click(); }
  });
  ui.paper.addEventListener('input', (e) => {
    if (!e.target.classList.contains('answer-input') || !current) return;
    const item = current.items[Number(e.target.closest('.q').dataset.idx)];
    item.response = e.target.value;
    save();
    updateProgress();
  });
  ui.paper.addEventListener('change', (e) => {
    if (!e.target.classList.contains('answer-input') || !current || !ui.instant.checked || current.submitted) return;
    showFeedback(current.items[Number(e.target.closest('.q').dataset.idx)]);
  });

  ui.submit.addEventListener('click', () => {
    if (!current || current.submitted) return;
    const left = current.items.filter((it) => it.response == null || String(it.response).trim() === '').length;
    if (left && !confirm('נשארו ' + left + ' שאלות בלי תשובה. לסיים ולבדוק בכל זאת?')) return;
    grade();
  });
  ui.restart.addEventListener('click', () => {
    if (!current || !confirm('להתחיל את המבחן מההתחלה? התשובות יימחקו.')) return;
    const id = current.test.id;
    clear(id);
    ui.submit.disabled = false;
    startTest(id);
  });
  ui.back.addEventListener('click', () => { location.hash = ''; });

  function showPicker(onlyTrack) {
    stopTimer();
    current = null;
    ui.runner.hidden = true;
    ui.picker.hidden = false;
    ui.submit.disabled = false;
    renderPicker(onlyTrack);
  }

  function route() {
    const test = /^#test-((?:g3b|b)?\d+)$/.exec(location.hash);
    const track = /^#track-(\w+)$/.exec(location.hash);
    if (test) { ui.submit.disabled = false; startTest(test[1]); } else showPicker(track ? track[1] : null);
  }
  window.addEventListener('hashchange', route);
  route();
})();
