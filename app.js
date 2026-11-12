/* みちつなぎサファリ：画面と操作 */
(function () {
  'use strict';

  var Core = window.Core;
  var STORE_KEY = 'michitsunagi-safari.v1';
  var STEP_MS = 330;
  var GOAL_EMO = '🏠';
  var FRUITS = ['🍌', '🍎'];
  var OBSTACLE = { x: '🪨', t: '🌳' };

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    home: $('home'), play: $('play'), stageList: $('stageList'), resetProgress: $('resetProgress'),
    back: $('backBtn'), stageNo: $('stageNo'), stageTitle: $('stageTitle'), bestStars: $('bestStars'),
    hint: $('hint'), boardWrap: $('boardWrap'), board: $('board'), palette: $('palette'),
    clearBtn: $('clearBtn'), goBtn: $('goBtn'), toast: $('toast'),
    clear: $('clear'), clearStars: $('clearStars'), clearMsg: $('clearMsg'),
    again: $('againBtn'), next: $('nextBtn'), toList: $('toListBtn'), ghost: $('ghost')
  };

  var state = {
    idx: 0, p: null, placed: {}, left: {}, selected: null, busy: false,
    cs: 64, animal: null, drag: null, toastTimer: 0, runId: 0
  };

  /* ---------- きろく（端末の中だけに保存） ---------- */
  function loadProgress() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      var data = raw ? JSON.parse(raw) : null;
      if (data && typeof data.stars === 'object' && data.stars) return data;
    } catch (e) { /* 保存できない環境でも遊べるようにする */ }
    return { stars: {} };
  }
  var progress = loadProgress();
  function saveProgress() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); } catch (e) { /* 保存できなくても続ける */ }
  }
  function bestOf(i) { var s = progress.stars[i]; return typeof s === 'number' ? s : 0; }

  /* ---------- おと（WebAudio。最初のタッチで有効になる） ---------- */
  var audio = null;
  function unlockAudio() {
    if (audio) { if (audio.state === 'suspended') audio.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { audio = new AC(); } catch (e) { audio = null; }
  }
  function tone(freq, dur, type, vol, delay) {
    if (!audio) return;
    try {
      var t0 = audio.currentTime + (delay || 0);
      var o = audio.createOscillator();
      var g = audio.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol || 0.15, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(audio.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* おとが出なくても続ける */ }
  }
  var sfx = {
    place: function () { tone(660, 0.08, 'triangle', 0.18); },
    remove: function () { tone(330, 0.08, 'triangle', 0.14); },
    step: function () { tone(520, 0.05, 'sine', 0.06); },
    fruit: function () { tone(880, 0.09, 'square', 0.08); tone(1320, 0.12, 'square', 0.07, 0.08); },
    fail: function () { tone(300, 0.18, 'sawtooth', 0.08); tone(220, 0.25, 'sawtooth', 0.08, 0.16); },
    goal: function () { [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.18, 'triangle', 0.16, i * 0.12); }); },
    nope: function () { tone(180, 0.1, 'square', 0.06); }
  };

  /* ---------- 道の絵（SVG） ---------- */
  var EDGE = [[50, 0], [100, 50], [50, 100], [0, 50]];
  function roadSvg(dirs, fixed) {
    var lines = function (w, color) {
      return dirs.map(function (d) {
        return '<line x1="50" y1="50" x2="' + EDGE[d][0] + '" y2="' + EDGE[d][1] + '" stroke="' + color + '" stroke-width="' + w + '"/>';
      }).join('');
    };
    var road = fixed ? 'var(--road-fixed)' : 'var(--road)';
    var dots = fixed ? '' : dirs.map(function (d) {
      var x = 50 + (EDGE[d][0] - 50) * 0.55;
      var y = 50 + (EDGE[d][1] - 50) * 0.55;
      return '<circle cx="' + x + '" cy="' + y + '" r="3.5" fill="#fff" opacity=".75"/>';
    }).join('');
    return '<svg viewBox="0 0 100 100" aria-hidden="true">' +
      lines(52, 'var(--road-edge)') + '<circle cx="50" cy="50" r="26" fill="var(--road-edge)"/>' +
      lines(40, road) + '<circle cx="50" cy="50" r="20" fill="' + road + '"/>' + dots + '</svg>';
  }
  function tileSvg(t, fixed) { return roadSvg(Core.TILES[t], fixed); }

  /* ---------- 画面きりかえ ---------- */
  function showHome() {
    state.runId++;
    state.busy = false;
    el.clear.classList.add('hidden');
    el.play.classList.add('hidden');
    el.home.classList.remove('hidden');
    renderStageList();
  }

  function renderStageList() {
    el.stageList.innerHTML = '';
    Core.LEVELS.forEach(function (lv, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'stage-btn';
      b.setAttribute('aria-label', 'ステージ' + (i + 1) + ' ' + lv.title);
      b.innerHTML = '<span class="num">' + (i + 1) + '</span><span class="ani">' + lv.animal + '</span>' +
        '<span class="st">' + starsHtml(bestOf(i)) + '</span>';
      b.addEventListener('click', function () { startLevel(i); });
      el.stageList.appendChild(b);
    });
  }

  function starsHtml(n) {
    var s = '';
    for (var i = 0; i < 3; i++) s += '<span class="' + (i < n ? 'on' : 'off') + '">★</span>';
    return s;
  }

  /* ---------- ステージ ---------- */
  function startLevel(i) {
    state.runId++;
    state.idx = i;
    state.p = Core.parseLevel(Core.LEVELS[i]);
    state.placed = {};
    state.left = Object.assign({}, state.p.palette);
    state.selected = null;
    state.busy = false;
    el.home.classList.add('hidden');
    el.clear.classList.add('hidden');
    el.play.classList.remove('hidden');
    el.stageNo.textContent = 'ステージ ' + (i + 1) + ' / ' + Core.LEVELS.length;
    el.stageTitle.textContent = state.p.title;
    el.hint.textContent = state.p.hint;
    el.bestStars.innerHTML = starsHtml(bestOf(i));
    hideToast();
    layout();
    renderBoard();
    renderPalette();
    setBusy(false);
  }

  function layout() {
    var land = window.innerWidth > window.innerHeight && window.innerHeight < 620;
    document.body.classList.toggle('landscape', land);
    if (!state.p || el.play.classList.contains('hidden')) return;
    var w = el.boardWrap.clientWidth - 12;
    var h = el.boardWrap.clientHeight - 12;
    var cs = Math.floor(Math.min(w / state.p.cols, h / state.p.rows, 104));
    state.cs = Math.max(36, cs);
    el.board.style.setProperty('--cs', state.cs + 'px');
    el.board.style.setProperty('--cols', state.p.cols);
    document.documentElement.style.setProperty('--cs', state.cs + 'px');
    if (state.animal && !state.busy) placeAnimal(state.p.start, false);
  }

  function allTiles() { return Object.assign({}, state.p.given, state.placed); }

  function canPlace(r, c) {
    var k = Core.key(r, c);
    return state.p.cells[r][c] === '.' && !state.p.given[k] && !state.placed[k];
  }

  function renderBoard() {
    var p = state.p;
    el.board.innerHTML = '';
    for (var r = 0; r < p.rows; r++) {
      for (var c = 0; c < p.cols; c++) {
        var cell = document.createElement('div');
        cell.dataset.r = r;
        cell.dataset.c = c;
        el.board.appendChild(cell);
        paintCell(r, c);
      }
    }
    var a = document.createElement('div');
    a.className = 'animal';
    a.innerHTML = '<span class="face">' + p.animal + '</span>';
    el.board.appendChild(a);
    state.animal = a;
    placeAnimal(p.start, false);
    faceTo(p.startDir);
  }

  function cellEl(r, c) { return el.board.children[r * state.p.cols + c]; }

  function paintCell(r, c) {
    var p = state.p;
    var k = Core.key(r, c);
    var t = p.cells[r][c];
    var cell = cellEl(r, c);
    var cls = ['cell'];
    if ((r + c) % 2) cls.push('alt');
    var html = '';
    if (t === 'w') cls.push('water');
    if (t === 'S') html += roadSvg([p.startDir], true);
    if (t === 'G') { cls.push('goal'); html += '<div class="emo">' + GOAL_EMO + '</div>'; }
    if (OBSTACLE[t]) html += '<div class="emo">' + OBSTACLE[t] + '</div>';
    if (p.given[k]) { cls.push('fixed'); html += tileSvg(p.given[k], true); }
    if (state.placed[k]) { cls.push('placed'); html += tileSvg(state.placed[k], false); }
    var fi = p.fruits.indexOf(k);
    if (fi >= 0) html += '<div class="emo fruit">' + FRUITS[fi % FRUITS.length] + '</div>';
    if (state.selected && canPlace(r, c)) cls.push('can-drop');
    cell.className = cls.join(' ');
    cell.innerHTML = html;
    cell.setAttribute('aria-label', cellLabel(r, c));
  }

  function cellLabel(r, c) {
    var p = state.p;
    var t = p.cells[r][c];
    var k = Core.key(r, c);
    if (t === 'S') return 'スタート';
    if (t === 'G') return 'ゴール';
    if (t === 'x') return 'いわ';
    if (t === 't') return 'き';
    if (t === 'w') return 'みず';
    if (p.given[k]) return 'さいしょから ある みち';
    if (state.placed[k]) return 'おいた みち（タップで もどす）';
    return 'くさ';
  }

  function repaintAll() {
    for (var r = 0; r < state.p.rows; r++) for (var c = 0; c < state.p.cols; c++) paintCell(r, c);
  }

  function renderPalette() {
    el.palette.innerHTML = '';
    Core.TILE_ORDER.forEach(function (t) {
      if (!(t in state.p.palette)) return;
      var n = state.left[t] || 0;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pbtn' + (state.selected === t ? ' sel' : '') + (n <= 0 ? ' empty' : '');
      b.dataset.t = t;
      b.setAttribute('aria-label', 'みちブロック のこり' + n);
      b.innerHTML = tileSvg(t, false) + '<span class="cnt">' + n + '</span>';
      el.palette.appendChild(b);
    });
  }

  function select(t) {
    state.selected = (state.selected === t) ? null : t;
    renderPalette();
    repaintAll();
  }

  function place(r, c, t) {
    if (!canPlace(r, c) || !(state.left[t] > 0)) { sfx.nope(); return false; }
    state.placed[Core.key(r, c)] = t;
    state.left[t]--;
    if (state.left[t] <= 0 && state.selected === t) state.selected = null;
    sfx.place();
    renderPalette();
    repaintAll();
    return true;
  }

  function removeAt(r, c) {
    var k = Core.key(r, c);
    var t = state.placed[k];
    if (!t) return;
    delete state.placed[k];
    state.left[t] = (state.left[t] || 0) + 1;
    sfx.remove();
    renderPalette();
    repaintAll();
  }

  function clearAll() {
    if (state.busy) return;
    Object.keys(state.placed).forEach(function (k) {
      var t = state.placed[k];
      state.left[t] = (state.left[t] || 0) + 1;
    });
    state.placed = {};
    state.selected = null;
    hideToast();
    renderPalette();
    repaintAll();
    sfx.remove();
  }

  /* ---------- どうぶつ ---------- */
  function placeAnimal(rc, animate) {
    var a = state.animal;
    if (!a) return;
    if (!animate) a.style.transition = 'none';
    a.style.transform = 'translate(' + (rc[1] * state.cs) + 'px,' + (rc[0] * state.cs) + 'px)';
    if (!animate) { void a.offsetWidth; a.style.transition = ''; }
  }
  function faceTo(d) {
    var face = state.animal && state.animal.firstChild;
    if (!face) return;
    if (d === 1) face.classList.add('right');
    if (d === 3) face.classList.remove('right');
  }
  function animalMood(cls) {
    var a = state.animal;
    a.classList.remove('hop', 'sad', 'happy');
    void a.offsetWidth;
    if (cls) a.classList.add(cls);
  }

  function sleep(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }

  function setBusy(b) {
    state.busy = b;
    el.goBtn.disabled = b;
    el.clearBtn.disabled = b;
  }

  /* ---------- しゅっぱつ ---------- */
  var FAIL_MSG = {
    empty: 'みちが とぎれてるよ。あかい ところに ブロックを おこう',
    mismatch: 'みちの むきが あってないよ。あかい ところを みてみよう',
    block: 'その さきには すすめないよ',
    edge: 'その さきには すすめないよ',
    loop: 'ぐるぐる まわって ゴールに つかないよ'
  };

  function go() {
    if (state.busy) return;
    unlockAudio();
    hideToast();
    if (state.selected) { state.selected = null; renderPalette(); repaintAll(); }
    var res = Core.trace(state.p, allTiles());
    var runId = ++state.runId;
    setBusy(true);
    var got = {};
    var i = 1;

    function stepOnce() {
      if (runId !== state.runId) return Promise.resolve(false);
      if (i >= res.path.length) return Promise.resolve(true);
      var rc = res.path[i];
      faceTo(res.dirs[i]);
      placeAnimal(rc, true);
      animalMood('hop');
      sfx.step();
      return sleep(STEP_MS).then(function () {
        if (runId !== state.runId) return false;
        var k = Core.key(rc[0], rc[1]);
        if (state.p.fruits.indexOf(k) >= 0 && !got[k]) {
          got[k] = true;
          var f = cellEl(rc[0], rc[1]).querySelector('.fruit');
          if (f) f.classList.add('got');
          sfx.fruit();
        }
        i++;
        return stepOnce();
      });
    }

    stepOnce().then(function (alive) {
      if (!alive || runId !== state.runId) return;
      if (res.ok) return win(res, runId);
      return lose(res, runId);
    });
  }

  function win(res, runId) {
    var stars = Core.starsFor(state.p, res);
    animalMood('happy');
    sfx.goal();
    if (stars > bestOf(state.idx)) { progress.stars[state.idx] = stars; saveProgress(); }
    el.bestStars.innerHTML = starsHtml(bestOf(state.idx));
    return sleep(900).then(function () {
      if (runId !== state.runId) return;
      el.clearStars.innerHTML = starsHtml(stars);
      var missed = state.p.fruits.length - res.fruits.length;
      el.clearMsg.textContent = missed > 0
        ? 'くだものを ' + missed + 'こ とりのがしたよ。ぜんぶ とれるかな？'
        : 'くだものも ぜんぶ とれたね！';
      var last = state.idx >= Core.LEVELS.length - 1;
      el.next.textContent = last ? 'さいしょへ' : 'つぎへ ▶';
      el.clear.classList.remove('hidden');
      el.next.focus();
    });
  }

  function lose(res, runId) {
    animalMood('sad');
    sfx.fail();
    var failEl = res.fail ? cellEl(res.fail[0], res.fail[1]) : null;
    if (failEl) { failEl.classList.remove('fail'); void failEl.offsetWidth; failEl.classList.add('fail'); }
    showToast(FAIL_MSG[res.reason] || FAIL_MSG.empty, 3200);
    return sleep(1500).then(function () {
      if (runId !== state.runId) return;
      if (failEl) failEl.classList.remove('fail');
      repaintAll(); // くだものを もとに もどす
      placeAnimal(state.p.start, false);
      faceTo(state.p.startDir);
      animalMood(null);
      setBusy(false);
    });
  }

  function showToast(text, ms) {
    clearTimeout(state.toastTimer);
    el.toast.textContent = text;
    el.toast.classList.remove('hidden');
    state.toastTimer = setTimeout(hideToast, ms || 2500);
  }
  function hideToast() { clearTimeout(state.toastTimer); el.toast.classList.add('hidden'); }

  /* ---------- タッチ・ドラッグ ---------- */
  function cellFromPoint(x, y) {
    var rect = el.board.getBoundingClientRect();
    var c = Math.floor((x - rect.left) / state.cs);
    var r = Math.floor((y - rect.top) / state.cs);
    if (r < 0 || c < 0 || r >= state.p.rows || c >= state.p.cols) return null;
    return [r, c];
  }

  var hoverEl = null;
  function setHover(rc) {
    var next = rc && canPlace(rc[0], rc[1]) ? cellEl(rc[0], rc[1]) : null;
    if (hoverEl === next) return;
    if (hoverEl) hoverEl.classList.remove('drop-hover');
    hoverEl = next;
    if (hoverEl) hoverEl.classList.add('drop-hover');
  }
  function moveGhost(x, y) {
    var s = Math.round(state.cs * 1.05);
    el.ghost.style.width = s + 'px';
    el.ghost.style.height = s + 'px';
    el.ghost.style.transform = 'translate(' + (x - s / 2) + 'px,' + (y - s / 2) + 'px)';
  }

  el.palette.addEventListener('pointerdown', function (e) {
    unlockAudio();
    var b = e.target.closest('.pbtn');
    if (!b || state.busy) return;
    var t = b.dataset.t;
    if (!(state.left[t] > 0)) { sfx.nope(); return; }
    e.preventDefault();
    state.drag = { t: t, x0: e.clientX, y0: e.clientY, moved: false, id: e.pointerId };
  });

  document.addEventListener('pointermove', function (e) {
    var d = state.drag;
    if (!d || e.pointerId !== d.id) return;
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 10) {
      d.moved = true;
      el.ghost.innerHTML = tileSvg(d.t, false);
      el.ghost.classList.remove('hidden');
    }
    if (d.moved) {
      e.preventDefault();
      moveGhost(e.clientX, e.clientY);
      setHover(cellFromPoint(e.clientX, e.clientY));
    }
  }, { passive: false });

  function endDrag(e, cancelled) {
    var d = state.drag;
    if (!d || e.pointerId !== d.id) return;
    state.drag = null;
    el.ghost.classList.add('hidden');
    setHover(null);
    if (cancelled) return;
    if (d.moved) {
      var rc = cellFromPoint(e.clientX, e.clientY);
      if (rc && canPlace(rc[0], rc[1])) place(rc[0], rc[1], d.t);
      else if (rc) sfx.nope();
    } else {
      select(d.t);
    }
  }
  document.addEventListener('pointerup', function (e) { endDrag(e, false); });
  document.addEventListener('pointercancel', function (e) { endDrag(e, true); });

  el.board.addEventListener('click', function (e) {
    unlockAudio();
    if (state.busy) return;
    var rc = cellFromPoint(e.clientX, e.clientY);
    if (!rc) return;
    var k = Core.key(rc[0], rc[1]);
    if (state.placed[k]) { removeAt(rc[0], rc[1]); return; }
    if (state.selected) {
      if (canPlace(rc[0], rc[1])) place(rc[0], rc[1], state.selected);
      else sfx.nope();
      return;
    }
    if (canPlace(rc[0], rc[1])) {
      el.palette.classList.remove('nudge'); void el.palette.offsetWidth; el.palette.classList.add('nudge');
      showToast('したの ブロックを えらんでから おいてね', 2000);
    }
  });

  /* ---------- ボタン ---------- */
  el.goBtn.addEventListener('click', go);
  el.clearBtn.addEventListener('click', clearAll);
  el.back.addEventListener('click', showHome);
  el.again.addEventListener('click', function () { startLevel(state.idx); });
  el.next.addEventListener('click', function () {
    var n = state.idx + 1;
    if (n >= Core.LEVELS.length) showHome(); else startLevel(n);
  });
  el.toList.addEventListener('click', showHome);
  el.resetProgress.addEventListener('click', function () {
    if (!window.confirm('ほしの きろくを ぜんぶ けしますか？')) return;
    progress = { stars: {} };
    saveProgress();
    renderStageList();
  });

  // ピンチやダブルタップでの拡大を止める（iOS Safari）
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 80);
  });

  /* ---------- オフライン対応（Service Worker） ---------- */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (err) {
        if (window.console) console.warn('オフライン用の登録に失敗:', err);
      });
    });
  }

  showHome();
  layout();
})();
