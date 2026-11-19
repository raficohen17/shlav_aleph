// Online quiz: renders a test from window.SHLAV_TESTS in the browser, grades it locally.
// Nothing is sent anywhere; progress is kept in this browser's localStorage only.
(function () {
  'use strict';

  const G = window.ShlavGrading;
  const TESTS = window.SHLAV_TESTS || [];
  const TIME_LIMIT = 40 * 60;
  const $ = (sel, el = document) => el.querySelector(sel);

  const ui = {
    picker: $('#picker'), list: $('#test-list'), runner: $('#runner'), paper: $('#paper'),
    title: $('#run-title'), timer: $('#timer'), progress: $('#progress'), instant: $('#instant'),
    submit: $('#submit'), restart: $('#restart'), back: $('#back'), pdf: $('#pdf-link'),
    summary: $('#summary'),
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
  function renderPicker() {
    ui.list.innerHTML = '';
    TESTS.forEach((t) => {
      const saved = load(t.id);
      const li = document.createElement('li');
      li.className = 'pick';
      const status = saved ? (saved.submitted ? 'נבדק' : 'בהתקדמות') : '';
      li.innerHTML =
        '<a class="pick-btn" href="#test-' + t.id + '"><span class="pick-num">מבחן ' + t.id + '</span>' +
        '<span class="pick-meta">' + t.questions + ' שאלות' + (status ? ' · ' + status : '') + '</span></a>';
      ui.list.appendChild(li);
    });
  }

  // ---------- building a test ----------
  function partOf(el, headings) {
    let part = 'reading';
    headings.forEach((h) => {
      if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) {
        part = /חשבון/.test(h.textContent.replace(/[֑-ׇ]/g, '')) ? 'math' : 'reading';
      }
    });
    return part;
  }

  function buildTest(test) {
    const doc = new DOMParser().parseFromString('<div id="root">' + test.html + '</div>', 'text/html');
    const root = doc.getElementById('root');
    const key = root.querySelector('section.answers');
    const rows = key ? [...key.querySelectorAll('tr')].filter((tr) => tr.querySelector('td')) : [];
    root.querySelectorAll('section.cover, section.answers, .page-break, p.next, p.stop, p.end').forEach((n) => n.remove());

    const headings = [...root.querySelectorAll('h2')];
    const qs = [...root.querySelectorAll('.q')];
    if (qs.length !== rows.length) throw new Error('מספר השאלות לא תואם למפתח (' + qs.length + '/' + rows.length + ')');

    const items = qs.map((q, i) => {
      const cells = rows[i].querySelectorAll('td');
      const opts = q.querySelector('ol.opts');
      const expected = G.expectedAnswer(cells[1].textContent, q.getAttribute('data-accept') || '', !!opts);
      const item = { el: q, expected, explain: cells[2] ? cells[2].innerHTML : '', part: partOf(q, headings), response: null, input: null };
      q.dataset.idx = String(i);
      if (opts) {
        opts.setAttribute('role', 'radiogroup');
        [...opts.querySelectorAll('li')].forEach((li, j) => {
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
    const test = TESTS.find((t) => t.id === id);
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
    ui.title.textContent = test.title || ('מבחן ' + id);
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
      item.el.querySelectorAll('ol.opts li').forEach((li) => {
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
    ui.timer.classList.toggle('over', secs > TIME_LIMIT);
  }

  // ---------- grading ----------
  function showFeedback(item) {
    const ok = G.isCorrect(item.expected, item.response);
    item.el.classList.toggle('is-right', ok);
    item.el.classList.toggle('is-wrong', !ok);
    item.el.querySelectorAll('ol.opts li').forEach((li) => {
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
    const score = { reading: [0, 0], math: [0, 0] };
    current.items.forEach((it) => {
      const ok = showFeedback(it);
      score[it.part][1] += 1;
      if (ok) score[it.part][0] += 1;
      if (it.input) it.input.readOnly = true;
    });
    current.items.forEach((it) => it.el.classList.add('locked'));
    const total = score.reading[0] + score.math[0];
    const max = score.reading[1] + score.math[1];
    ui.summary.innerHTML =
      '<h2>תוצאה: ' + total + ' מתוך ' + max + '</h2>' +
      '<p>הבנת הנקרא: ' + score.reading[0] + '/' + score.reading[1] +
      ' · חשבון: ' + score.math[0] + '/' + score.math[1] +
      ' · זמן: ' + G.formatTime(current.elapsed) + (current.elapsed > TIME_LIMIT ? ' (יותר מ-40 דקות)' : '') + '</p>' +
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
    const li = e.target.closest('ol.opts li');
    if (!li || !current || current.submitted) return;
    const item = current.items[Number(li.closest('.q').dataset.idx)];
    setResponse(item, li.dataset.letter);
  });
  ui.paper.addEventListener('keydown', (e) => {
    const li = e.target.closest && e.target.closest('ol.opts li');
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

  function showPicker() {
    stopTimer();
    current = null;
    ui.runner.hidden = true;
    ui.picker.hidden = false;
    ui.submit.disabled = false;
    renderPicker();
  }

  function route() {
    const m = /^#test-(\d+)$/.exec(location.hash);
    if (m) { ui.submit.disabled = false; startTest(Number(m[1])); } else showPicker();
  }
  window.addEventListener('hashchange', route);
  route();
})();
