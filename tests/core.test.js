// node tests/core.test.js で実行する。ステージが解けるか・判定が正しいかを確かめる。
'use strict';
const assert = require('assert');
const Core = require('../core.js');

let n = 0;
function test(name, fn) { fn(); n++; console.log('ok - ' + name); }

Core.LEVELS.forEach((lv, i) => {
  test(`ステージ${i + 1}「${lv.title}」が正解の置き方でゴールでき、ほし3つになる`, () => {
    const p = Core.parseLevel(lv);
    const res = Core.trace(p, p.solution);
    assert.strictEqual(res.ok, true, JSON.stringify(res));
    assert.strictEqual(p.fruits.length, 2, 'くだものは2つ');
    assert.strictEqual(res.fruits.length, 2, 'くだものが道の上にある');
    assert.strictEqual(Core.starsFor(p, res), 3);
  });
  test(`ステージ${i + 1}：パレットの数で正解が作れる・最初からある道だけではゴールできない`, () => {
    const p = Core.parseLevel(lv);
    const need = {};
    Object.keys(p.solution).forEach(k => { if (!p.given[k]) need[p.solution[k]] = (need[p.solution[k]] || 0) + 1; });
    Object.keys(need).forEach(t => assert.ok(p.palette[t] >= need[t], t + ' がたりない'));
    assert.strictEqual(Core.trace(p, p.given).ok, false);
    // くだものはスタート・ゴール・障害物の上に無い
    p.fruits.forEach(k => { const [r, c] = k.split(',').map(Number); assert.strictEqual(p.cells[r][c], '.'); });
    // ヒントの穴(holes)は全部くさのマス
    (lv.holes || []).forEach(([r, c]) => assert.ok(p.solution[Core.key(r, c)], 'hole が正解の道の上にない'));
  });
});

test('exitDir：まっすぐ・かど・じゅうじ・つながらない', () => {
  assert.strictEqual(Core.exitDir('-', 1), 1);
  assert.strictEqual(Core.exitDir('-', 2), -1);
  assert.strictEqual(Core.exitDir('7', 1), 2); // みぎへ進んで入る → したへ
  assert.strictEqual(Core.exitDir('L', 2), 1); // したへ進んで入る → みぎへ
  assert.strictEqual(Core.exitDir('J', 1), 0);
  assert.strictEqual(Core.exitDir('r', 3), 2);
  assert.strictEqual(Core.exitDir('+', 0), 0);
  assert.strictEqual(Core.exitDir('+', 3), 3);
  assert.strictEqual(Core.exitDir('?', 1), -1);
});

test('道がとぎれていると、とぎれたマスを返す', () => {
  const p = Core.parseLevel(Core.LEVELS[1]);
  const res = Core.trace(p, p.given);
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'empty');
  assert.deepStrictEqual(res.fail, [1, 2]);
  assert.strictEqual(Core.starsFor(p, res), 0);
});

test('向きがちがうブロックは mismatch', () => {
  const p = Core.parseLevel(Core.LEVELS[0]);
  const tiles = Object.assign({}, p.given, { '1,2': '|' });
  const res = Core.trace(p, tiles);
  assert.strictEqual(res.reason, 'mismatch');
  assert.deepStrictEqual(res.fail, [1, 2]);
});

test('ばんの外に出ると edge', () => {
  const p = Core.parseLevel({ title: 't', dir: 3, map: ['S.G'], fruits: [] });
  assert.strictEqual(Core.trace(p, {}).reason, 'edge');
});

test('じゅうじだけの輪でも無限ループしない', () => {
  // S→ みぎ → まわり道で 同じマスに 同じ向きで もどってくる輪
  const p = Core.parseLevel({ title: 't', dir: 1, map: ['.r7', 'SLJ', '..G'], fruits: [] });
  const res = Core.trace(p, { '1,1': '+', '1,2': 'J', '0,2': '7', '0,1': 'r' });
  // + を まっすぐ → J で うえ → 7 で ひだり → r で した → + を まっすぐ した → (2,1) が くさ で とぎれる
  assert.strictEqual(res.ok, false);
  assert.deepStrictEqual(res.fail, [2, 1]);
  const ring = Core.parseLevel({ title: 't', dir: 1, map: ['r7.', 'S+J', 'LJG'].map(s => s), fruits: [] });
  const res2 = Core.trace(ring, { '0,0': 'r', '0,1': '7', '1,1': '+', '1,2': 'J', '2,0': 'L', '2,1': 'J' });
  assert.strictEqual(res2.ok, false); // 無限ループせずに おわる
});

test('別ルートでもゴールできれば ok（正解は1つでなくてよい）', () => {
  const p = Core.parseLevel(Core.LEVELS[8]); // じゅうじ：近道で ゴール
  const res = Core.trace(p, { '1,1': '-', '1,2': '7', '2,2': '|' });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(Core.starsFor(p, res), 1); // くだものは とれない
});

test('map のはばが不ぞろいなら エラー', () => {
  assert.throws(() => Core.parseLevel({ title: 'bad', dir: 1, map: ['S.G', '..'] }));
});

console.log(`\n${n} tests passed`);
