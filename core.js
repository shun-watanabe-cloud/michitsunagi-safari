/* みちつなぎサファリ：ステージデータと道のつながり判定（画面に依存しない部分） */
(function (root) {
  'use strict';

  // 向き：0=うえ 1=みぎ 2=した 3=ひだり
  var DR = [-1, 0, 1, 0];
  var DC = [0, 1, 0, -1];

  // 道ブロック：記号 → つながっている向き
  var TILES = {
    '-': [1, 3],
    '|': [0, 2],
    'L': [0, 1],
    'J': [0, 3],
    'r': [1, 2],
    '7': [2, 3],
    '+': [0, 1, 2, 3]
  };
  var TILE_ORDER = ['-', '|', 'L', 'J', 'r', '7', '+'];

  // map の記号
  //  . くさ   x いわ   t き   w みず   S スタート   G ゴール
  //  - | L J r 7 +  正解の道（holes が無ければ全部パレットに出る）
  // holes : 子どもが置くマス（それ以外の正解の道は最初から置いてある）
  // extra : まちがえ用に追加で出すブロック
  // fruits: くだもののマス（とるとほしが増える）
  var LEVELS = [
    {
      title: 'まっすぐ すすもう',
      hint: 'ブロックを あいている ところに おいてね',
      animal: '🐘', dir: 1,
      map: ['t...t',
            'S---G',
            '..t..'],
      holes: [[1, 2]],
      fruits: [[1, 1], [1, 3]]
    },
    {
      title: 'ふたつ おこう',
      hint: 'みちが ぜんぶ つながったら しゅっぱつ！',
      animal: '🦒', dir: 1,
      map: ['.t..x.',
            'S----G',
            '...t..'],
      holes: [[1, 2], [1, 4]],
      fruits: [[1, 2], [1, 3]]
    },
    {
      title: 'まがりかど',
      hint: 'したに すすんで、かどで まがろう',
      animal: '🦁', dir: 2,
      map: ['S.t.',
            '|...',
            '|.x.',
            'L--G'],
      holes: [[2, 0], [3, 0]],
      fruits: [[1, 0], [3, 1]]
    },
    {
      title: 'くねくね みち',
      hint: 'こんどは じぶんで ぜんぶ おいてみよう',
      animal: '🐵', dir: 1,
      map: ['S-7..',
            't.|.t',
            '..L-G'],
      fruits: [[0, 1], [1, 2]]
    },
    {
      title: 'いわを よけて',
      hint: 'いわの ある ところには おけないよ',
      animal: '🦓', dir: 1,
      map: ['S-7.x.',
            'x.|..t',
            't.L7..',
            '.x.L-G'],
      fruits: [[1, 2], [2, 3]]
    },
    {
      title: 'いけを ぐるっと',
      hint: 'うえに でて、いけの まわりを すすもう',
      animal: '🐘', dir: 0,
      map: ['r---7..',
            '|.ww|.t',
            'S.ww|..',
            'x.t.L-G'],
      extra: { '-': 1, 'J': 1 },
      fruits: [[0, 2], [3, 5]]
    },
    {
      title: 'ジグザグ',
      hint: 'かいだんみたいに おりていこう',
      animal: '🦒', dir: 1,
      map: ['S7..t.',
            '.L7...',
            'x.L7..',
            '...L-G'],
      extra: { 'r': 1 },
      fruits: [[1, 2], [2, 3]]
    },
    {
      title: 'うえの おうち',
      hint: 'ゴールは うえだよ。どう まがる？',
      animal: '🦁', dir: 1,
      map: ['tG..x.',
            '.L-7..',
            'x..|.t',
            'S--J..'],
      extra: { 'r': 1, '-': 1 },
      fruits: [[1, 2], [3, 2]]
    },
    {
      title: 'じゅうじの みち',
      hint: 'じゅうじは まっすぐ とおりぬけるよ',
      animal: '🐵', dir: 1,
      map: ['..r7.',
            'S-+J.',
            't.|.x',
            '..G..'],
      fruits: [[0, 2], [0, 3]]
    },
    {
      title: 'おおきな サファリ',
      hint: 'くだものを ぜんぶ とって ゴールしよう',
      animal: '🦓', dir: 2,
      map: ['S.x.t.G',
            '|.r7.x|',
            'L-+J..|',
            't.L---J'],
      extra: { '7': 1, 'r': 1 },
      fruits: [[1, 3], [3, 4]]
    }
  ];

  function opp(d) { return (d + 2) % 4; }
  function key(r, c) { return r + ',' + c; }

  function parseLevel(lv) {
    var rows = lv.map.length;
    var cols = lv.map[0].length;
    var cells = [];
    var solution = {};
    var start = null;
    var goal = null;
    for (var r = 0; r < rows; r++) {
      if (lv.map[r].length !== cols) throw new Error('map の はばが そろっていません: ' + lv.title);
      var row = [];
      for (var c = 0; c < cols; c++) {
        var ch = lv.map[r].charAt(c);
        if (TILES[ch]) { solution[key(r, c)] = ch; row.push('.'); continue; }
        if (ch === 'S') start = [r, c];
        if (ch === 'G') goal = [r, c];
        if ('.xtwSG'.indexOf(ch) < 0) throw new Error('しらない きごう ' + ch + ': ' + lv.title);
        row.push(ch);
      }
      cells.push(row);
    }
    if (!start || !goal) throw new Error('スタートか ゴールが ありません: ' + lv.title);

    var given = {};
    if (lv.holes) {
      var holeSet = {};
      lv.holes.forEach(function (h) { holeSet[key(h[0], h[1])] = true; });
      Object.keys(solution).forEach(function (k) { if (!holeSet[k]) given[k] = solution[k]; });
    }
    var palette = {};
    Object.keys(solution).forEach(function (k) {
      if (!given[k]) palette[solution[k]] = (palette[solution[k]] || 0) + 1;
    });
    var extra = lv.extra || {};
    Object.keys(extra).forEach(function (t) { palette[t] = (palette[t] || 0) + extra[t]; });

    return {
      title: lv.title, hint: lv.hint, animal: lv.animal,
      rows: rows, cols: cols, cells: cells,
      start: start, goal: goal, startDir: lv.dir,
      solution: solution, given: given, palette: palette,
      fruits: (lv.fruits || []).map(function (f) { return key(f[0], f[1]); })
    };
  }

  // 向き moving で入ってきたとき、ブロック tile からどの向きに出るか（つながらなければ -1）
  function exitDir(tile, moving) {
    var dirs = TILES[tile];
    if (!dirs) return -1;
    var side = opp(moving);
    if (dirs.indexOf(side) < 0) return -1;
    if (dirs.length === 4) return moving;
    return dirs[0] === side ? dirs[1] : dirs[0];
  }

  // tiles: { "r,c": 記号 }（最初からある道＋置いた道）
  // 戻り値: ok / path（歩くマスの列）/ dirs（各マスへ入るときの向き）/ fail（とぎれたマス）/ reason / fruits（とれたくだもの）
  function trace(p, tiles) {
    var r = p.start[0];
    var c = p.start[1];
    var d = p.startDir;
    var path = [[r, c]];
    var dirs = [d];
    var seen = {};
    var result = null;
    for (var i = 0; i < 400 && !result; i++) {
      var nr = r + DR[d];
      var nc = c + DC[d];
      if (nr < 0 || nc < 0 || nr >= p.rows || nc >= p.cols) {
        result = { ok: false, fail: null, reason: 'edge' };
        break;
      }
      if (p.cells[nr][nc] === 'G') {
        path.push([nr, nc]); dirs.push(d);
        result = { ok: true, fail: null, reason: 'goal' };
        break;
      }
      var tile = tiles[key(nr, nc)];
      if (!tile) {
        result = { ok: false, fail: [nr, nc], reason: p.cells[nr][nc] === '.' ? 'empty' : 'block' };
        break;
      }
      var e = exitDir(tile, d);
      if (e < 0) {
        result = { ok: false, fail: [nr, nc], reason: 'mismatch' };
        break;
      }
      var sk = key(nr, nc) + ':' + d;
      if (seen[sk]) { result = { ok: false, fail: [nr, nc], reason: 'loop' }; break; }
      seen[sk] = true;
      path.push([nr, nc]); dirs.push(d);
      r = nr; c = nc; d = e;
    }
    if (!result) result = { ok: false, fail: null, reason: 'loop' };
    var got = {};
    path.forEach(function (pc) {
      var k = key(pc[0], pc[1]);
      if (p.fruits.indexOf(k) >= 0) got[k] = true;
    });
    result.path = path;
    result.dirs = dirs;
    result.fruits = Object.keys(got);
    return result;
  }

  function starsFor(p, res) {
    if (!res.ok) return 0;
    return Math.min(3, 1 + res.fruits.length);
  }

  var Core = {
    DR: DR, DC: DC, TILES: TILES, TILE_ORDER: TILE_ORDER, LEVELS: LEVELS,
    key: key, opp: opp, parseLevel: parseLevel, exitDir: exitDir, trace: trace, starsFor: starsFor
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
  else root.Core = Core;
})(this);
