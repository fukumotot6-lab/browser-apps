import { describe, expect, it } from 'vitest';

import { createRandomMinePlacer } from './mine-placement';
import type { BoardConfig, Random } from './types';

/** 種から同じ列を再現できる乱数（mulberry32）。テストの結果を毎回同じにするために使う。 */
function createSeededRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function expectValidPlacement(
  mines: readonly number[],
  config: BoardConfig,
  safeIndex: number,
): void {
  const cellCount = config.width * config.height;
  expect(mines).toHaveLength(config.mineCount);
  expect(new Set(mines).size).toBe(mines.length);
  // 多数の種で繰り返し呼ぶので、添字ごとに expect を呼ばず、外れた添字だけを集めて比べる。
  const invalid = mines.filter(
    (index) =>
      !Number.isInteger(index) ||
      index < 0 ||
      index >= cellCount ||
      index === safeIndex,
  );
  expect(invalid).toEqual([]);
}

const BEGINNER: BoardConfig = { width: 9, height: 9, mineCount: 10 };
const INTERMEDIATE: BoardConfig = { width: 16, height: 16, mineCount: 40 };
const EXPERT: BoardConfig = { width: 30, height: 16, mineCount: 99 };

describe('createRandomMinePlacer', () => {
  it('指定した数の機雷を返す', () => {
    const placeMines = createRandomMinePlacer(createSeededRandom(1));
    expect(placeMines(BEGINNER, 0)).toHaveLength(10);
  });

  it('返す添字に重複がない', () => {
    const placeMines = createRandomMinePlacer(createSeededRandom(2));
    const mines = placeMines(INTERMEDIATE, 5);
    expect(new Set(mines).size).toBe(mines.length);
  });

  it('返す添字はすべて盤面の範囲に収まる整数である', () => {
    const placeMines = createRandomMinePlacer(createSeededRandom(3));
    for (const index of placeMines(EXPERT, 100)) {
      expect(Number.isInteger(index)).toBe(true);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(480);
    }
  });

  it('種や最初に開くマスを変えても、最初に開くマスには機雷を置かない', () => {
    // 四隅、辺の途中、中央。機雷を多めにして、安全なマスが選ばれやすい条件にする。
    const config: BoardConfig = { width: 9, height: 9, mineCount: 70 };
    const safeIndexes = [0, 8, 72, 80, 4, 36, 40];
    for (const safeIndex of safeIndexes) {
      for (let seed = 0; seed < 200; seed += 1) {
        const placeMines = createRandomMinePlacer(createSeededRandom(seed));
        expectValidPlacement(placeMines(config, safeIndex), config, safeIndex);
      }
    }
  });

  it('同じ種の乱数からは同じ配置になる', () => {
    const first = createRandomMinePlacer(createSeededRandom(42));
    const second = createRandomMinePlacer(createSeededRandom(42));
    expect(first(EXPERT, 17)).toEqual(second(EXPERT, 17));
  });

  it('種が違えば配置が変わりうる', () => {
    const placements = new Set<string>();
    for (let seed = 0; seed < 20; seed += 1) {
      const placeMines = createRandomMinePlacer(createSeededRandom(seed));
      placements.add(placeMines(BEGINNER, 0).join(','));
    }
    expect(placements.size).toBeGreaterThan(1);
  });

  it('機雷の数がマスの数より1少ないとき、最初に開くマス以外をすべて埋める', () => {
    const config: BoardConfig = { width: 4, height: 3, mineCount: 11 };
    const placeMines = createRandomMinePlacer(createSeededRandom(7));
    const mines = placeMines(config, 5);
    expect([...mines].sort((a, b) => a - b)).toEqual([
      0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 11,
    ]);
  });

  it('機雷の数が0なら空の配列を返す', () => {
    const placeMines = createRandomMinePlacer(createSeededRandom(8));
    expect(placeMines({ width: 9, height: 9, mineCount: 0 }, 0)).toEqual([]);
  });

  it('1マスだけの盤面で機雷の数が0なら空の配列を返す', () => {
    const placeMines = createRandomMinePlacer(createSeededRandom(9));
    expect(placeMines({ width: 1, height: 1, mineCount: 0 }, 0)).toEqual([]);
  });

  it('機雷の数が置けるマスの数を超えるとエラーになる', () => {
    const placeMines = createRandomMinePlacer(createSeededRandom(10));
    expect(() => placeMines({ width: 3, height: 3, mineCount: 9 }, 0)).toThrow(
      '機雷の数が多すぎます',
    );
    expect(() =>
      placeMines({ width: 3, height: 3, mineCount: 100 }, 0),
    ).toThrow('機雷の数が多すぎます');
  });

  it('機雷の数が負の数や小数だとエラーになる', () => {
    const placeMines = createRandomMinePlacer(createSeededRandom(11));
    expect(() => placeMines({ width: 3, height: 3, mineCount: -1 }, 0)).toThrow(
      '機雷の数は0以上の整数',
    );
    expect(() =>
      placeMines({ width: 3, height: 3, mineCount: 1.5 }, 0),
    ).toThrow('機雷の数は0以上の整数');
  });

  it('最初に開くマスの添字が盤面の外だとエラーになる', () => {
    const placeMines = createRandomMinePlacer(createSeededRandom(12));
    const config: BoardConfig = { width: 3, height: 3, mineCount: 2 };
    expect(() => placeMines(config, -1)).toThrow('盤面の外');
    expect(() => placeMines(config, 9)).toThrow('盤面の外');
  });

  it.each([
    ['初級（9×9、機雷10個）', BEGINNER],
    ['中級（16×16、機雷40個）', INTERMEDIATE],
    ['上級（30×16、機雷99個）', EXPERT],
  ])('%sの盤面で正しい配置を返す', (_label, config) => {
    const cellCount = config.width * config.height;
    for (let seed = 0; seed < 50; seed += 1) {
      const random = createSeededRandom(seed);
      // 最初に開くマスも種ごとに変え、位置による偏りを見逃さないようにする。
      const safeIndex = Math.floor(random() * cellCount);
      const placeMines = createRandomMinePlacer(random);
      expectValidPlacement(placeMines(config, safeIndex), config, safeIndex);
    }
  });

  it('乱数が常に0を返しても正しい配置を返す', () => {
    const placeMines = createRandomMinePlacer(() => 0);
    for (const safeIndex of [0, 1, 240, 479]) {
      expectValidPlacement(placeMines(EXPERT, safeIndex), EXPERT, safeIndex);
    }
  });

  it('乱数が常に1にごく近い値を返しても正しい配置を返す', () => {
    const placeMines = createRandomMinePlacer(() => 0.999999999);
    for (const safeIndex of [0, 1, 240, 479]) {
      expectValidPlacement(placeMines(EXPERT, safeIndex), EXPERT, safeIndex);
    }
  });

  it('乱数が約束に反して1以上や負の値を返しても範囲外の添字を返さない', () => {
    for (const value of [1, 1.5, -0.5]) {
      const placeMines = createRandomMinePlacer(() => value);
      expectValidPlacement(placeMines(BEGINNER, 40), BEGINNER, 40);
    }
  });

  it('乱数がNaNを返すと、壊れた配置を返さずにエラーになる', () => {
    const placeMines = createRandomMinePlacer(() => Number.NaN);
    expect(() => placeMines(BEGINNER, 0)).toThrow('乱数');
  });

  it('渡された設定を書き換えず、呼び出しごとに新しい配列を返す', () => {
    const config: BoardConfig = Object.freeze({
      width: 5,
      height: 5,
      mineCount: 5,
    });
    const placeMines = createRandomMinePlacer(createSeededRandom(13));
    const first = placeMines(config, 12);
    const second = placeMines(config, 12);
    expect(first).not.toBe(second);
    expectValidPlacement(first, config, 12);
    expectValidPlacement(second, config, 12);
  });

  it('最初に開くマス以外のどのマスも、おおむね同じ頻度で選ばれる', () => {
    // 3×3で中央を開き、機雷2個。残り8マスが選ばれる期待値は 8000 × 2 / 8 = 2000回。
    // 標準偏差は約39回なので、±300回は偏りのない実装なら外れない幅になる。
    const config: BoardConfig = { width: 3, height: 3, mineCount: 2 };
    const safeIndex = 4;
    const runCount = 8000;
    const placeMines = createRandomMinePlacer(createSeededRandom(20240501));
    const pickCounts = new Map<number, number>();
    for (let run = 0; run < runCount; run += 1) {
      for (const index of placeMines(config, safeIndex)) {
        pickCounts.set(index, (pickCounts.get(index) ?? 0) + 1);
      }
    }
    expect(pickCounts.has(safeIndex)).toBe(false);
    expect([...pickCounts.keys()].sort((a, b) => a - b)).toEqual([
      0, 1, 2, 3, 5, 6, 7, 8,
    ]);
    for (const count of pickCounts.values()) {
      expect(count).toBeGreaterThan(1700);
      expect(count).toBeLessThan(2300);
    }
  });

  it('機雷2個の組み合わせも、おおむね同じ頻度で現れる', () => {
    // マスごとの頻度が均等でも、組み合わせが偏る実装はありうるので別に確かめる。
    // 2×2で左上を開き、機雷2個。組み合わせは3通りで、期待値は各2000回。
    const config: BoardConfig = { width: 2, height: 2, mineCount: 2 };
    const placeMines = createRandomMinePlacer(createSeededRandom(99));
    const pairCounts = new Map<string, number>();
    for (let run = 0; run < 6000; run += 1) {
      const key = [...placeMines(config, 0)].sort((a, b) => a - b).join(',');
      pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
    }
    expect([...pairCounts.keys()].sort()).toEqual(['1,2', '1,3', '2,3']);
    for (const count of pairCounts.values()) {
      expect(count).toBeGreaterThan(1700);
      expect(count).toBeLessThan(2300);
    }
  });
});
