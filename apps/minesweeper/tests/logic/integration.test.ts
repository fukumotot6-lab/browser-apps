import { describe, expect, it } from 'vitest';
import {
  countRemainingMines,
  createGame,
  createRandomMinePlacer,
  getCellView,
  openCell,
  toggleFlag,
} from '../../src/logic/index';
import type {
  BoardConfig,
  GameState,
  Position,
  Random,
} from '../../src/logic/index';

// 個々のモジュールのテストは、配置を手で固定して振る舞いを確かめている。
// ここでは公開APIだけを使い、乱数による配置と組み合わせて、どんな盤面でも
// 成り立つはずの性質を多数の盤面で確かめる。

/** 種から同じ数列を再現できる乱数（mulberry32）。失敗した盤面を再現できるようにするため。 */
function seededRandom(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function positionOf(config: BoardConfig, index: number): Position {
  return { x: index % config.width, y: Math.floor(index / config.width) };
}

function neighbours(config: BoardConfig, position: Position): Position[] {
  const result: Position[] = [];
  for (let y = position.y - 1; y <= position.y + 1; y += 1) {
    for (let x = position.x - 1; x <= position.x + 1; x += 1) {
      const isSelf = x === position.x && y === position.y;
      const isInside =
        x >= 0 && x < config.width && y >= 0 && y < config.height;
      if (!isSelf && isInside) {
        result.push({ x, y });
      }
    }
  }
  return result;
}

function cellOf(state: GameState, position: Position) {
  const cell = state.cells[position.y * state.config.width + position.x];
  if (cell === undefined) {
    throw new Error('テストの位置が盤面の外です');
  }
  return cell;
}

/**
 * 実装とは別の書き方で、盤面全体が満たすべき性質を確かめ、破れているものを列挙する。
 * マスごとに expect を呼ぶと回数が膨大になって遅いので、問題を集めて呼び出し側で1回だけ検証する。
 */
function findProblems(state: GameState, hasUsedFlags = false): string[] {
  const { config } = state;
  const cellCount = config.width * config.height;
  const problems: string[] = [];
  if (state.cells.length !== cellCount) {
    return ['マスの数が盤面の大きさと合わない'];
  }

  const isLaid = state.status !== 'ready';
  const mineTotal = state.cells.filter((cell) => cell.hasMine).length;
  if (mineTotal !== (isLaid ? config.mineCount : 0)) {
    problems.push(`機雷の数が${mineTotal}個`);
  }

  let openSafeCount = 0;
  for (let index = 0; index < cellCount; index += 1) {
    const position = positionOf(config, index);
    const cell = cellOf(state, position);
    const around = neighbours(config, position);

    const expected = around.filter((p) => cellOf(state, p).hasMine).length;
    if (cell.adjacentMines !== expected) {
      problems.push(
        `添字${index}の数字が${cell.adjacentMines}（正しくは${expected}）`,
      );
    }

    // 開いた機雷は、負けの原因になった1マスだけ。
    const isOpenMine = cell.state === 'open' && cell.hasMine;
    if (
      isOpenMine &&
      (state.status !== 'lost' || index !== state.explodedIndex)
    ) {
      problems.push(`添字${index}の機雷が開いている`);
    }

    if (cell.state === 'open' && !cell.hasMine) {
      openSafeCount += 1;
      // 旗を使うと、空白の広がりが旗で止まり、あとで旗を外したマスが閉じたまま残りうる。
      const hasHiddenNeighbour = around.some(
        (p) => cellOf(state, p).state === 'hidden',
      );
      if (cell.adjacentMines === 0 && !hasUsedFlags && hasHiddenNeighbour) {
        problems.push(`添字${index}は空白なのに、隣に閉じたマスがある`);
      }
    }
  }

  const isAllSafeOpen =
    isLaid && openSafeCount === cellCount - config.mineCount;
  if ((state.status === 'won') !== isAllSafeOpen) {
    problems.push(
      `状態が${state.status}なのに、機雷のないマスが${openSafeCount}個開いている`,
    );
  }
  if (state.status === 'won' && countRemainingMines(state) !== 0) {
    problems.push('勝ったのに残り機雷数が0でない');
  }
  if ((state.status === 'lost') !== (state.explodedIndex !== null)) {
    problems.push('負けの状態と、爆発したマスの記録が合わない');
  }
  return problems;
}

const DIFFICULTIES: readonly (BoardConfig & { readonly label: string })[] = [
  { label: '初級', width: 9, height: 9, mineCount: 10 },
  { label: '中級', width: 16, height: 16, mineCount: 40 },
  { label: '上級', width: 30, height: 16, mineCount: 99 },
];

describe('乱数による配置と組み合わせた通しプレイ', () => {
  it.each(DIFFICULTIES)(
    '$label：どのマスから始めても、最初のマスは安全で、機雷の数と数字が正しい',
    ({ width, height, mineCount }) => {
      const config = { width, height, mineCount };
      for (let index = 0; index < width * height; index += 1) {
        const placeMines = createRandomMinePlacer(seededRandom(index + 1));
        const first = positionOf(config, index);

        const state = openCell(createGame(config), first, placeMines);

        expect(cellOf(state, first).hasMine).toBe(false);
        expect(cellOf(state, first).state).toBe('open');
        expect(state.status).not.toBe('lost');
        expect(findProblems(state)).toEqual([]);
      }
    },
  );

  it.each(DIFFICULTIES)(
    '$label：機雷を避けて開き続けると、必ず勝ちで終わる',
    ({ width, height, mineCount }) => {
      const config = { width, height, mineCount };
      for (let seed = 1; seed <= 30; seed += 1) {
        const random = seededRandom(seed);
        const placeMines = createRandomMinePlacer(random);
        const first = positionOf(config, Math.floor(random() * width * height));
        let state = openCell(createGame(config), first, placeMines);

        for (let index = 0; index < width * height; index += 1) {
          const position = positionOf(config, index);
          if (!cellOf(state, position).hasMine) {
            const before = state;
            state = openCell(state, position, placeMines);
            if (state !== before) {
              expect(findProblems(state)).toEqual([]);
            }
          }
        }

        expect(state.status).toBe('won');
        const kinds = state.cells.map(
          (_, index) => getCellView(state, positionOf(config, index)).kind,
        );
        expect(kinds).toEqual(
          state.cells.map((cell) => (cell.hasMine ? 'flag' : 'open')),
        );
      }
    },
  );

  it.each(DIFFICULTIES)(
    '$label：でたらめに開いたり旗を立てたりしても、盤面の整合性が保たれる',
    ({ width, height, mineCount }) => {
      const config = { width, height, mineCount };
      for (let seed = 1; seed <= 30; seed += 1) {
        const random = seededRandom(seed * 7919);
        const placeMines = createRandomMinePlacer(random);
        let state = createGame(config);

        for (let step = 0; step < 200; step += 1) {
          const position = positionOf(
            config,
            Math.floor(random() * width * height),
          );
          const before = state;
          state =
            random() < 0.3
              ? toggleFlag(state, position)
              : openCell(state, position, placeMines);
          expect(findProblems(state, true)).toEqual([]);

          const wasFinished =
            before.status === 'won' || before.status === 'lost';
          if (wasFinished) {
            expect(state).toBe(before);
          }
        }

        if (state.status === 'lost') {
          const kinds = state.cells.map(
            (_, index) => getCellView(state, positionOf(config, index)).kind,
          );
          expect(kinds.filter((kind) => kind === 'exploded-mine')).toHaveLength(
            1,
          );
          // 負けたあとは、すべての機雷が「爆発」「機雷」「正しい旗」のどれかとして見える。
          const mineKinds = new Set(['exploded-mine', 'mine', 'flag']);
          const mismatched = state.cells.filter(
            (cell, index) => cell.hasMine !== mineKinds.has(kinds[index] ?? ''),
          );
          expect(mismatched).toEqual([]);
        }
      }
    },
  );
});
