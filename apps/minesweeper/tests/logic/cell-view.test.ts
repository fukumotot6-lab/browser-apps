import { describe, expect, it } from 'vitest';
import { getCellView } from '../../src/logic/cell-view';
import { createGame, openCell, toggleFlag } from '../../src/logic/game';
import type {
  BoardConfig,
  CellView,
  GameState,
  MinePlacer,
} from '../../src/logic/types';

/** `*` が機雷、それ以外は機雷のないマス。 */
function boardFrom(rows: readonly string[]): {
  readonly config: BoardConfig;
  readonly placeMines: MinePlacer;
} {
  const width = rows[0]?.length ?? 0;
  const mineIndices: number[] = [];
  rows.forEach((row, y) => {
    [...row].forEach((character, x) => {
      if (character === '*') {
        mineIndices.push(y * width + x);
      }
    });
  });
  return {
    config: { width, height: rows.length, mineCount: mineIndices.length },
    placeMines: () => mineIndices,
  };
}

function viewCharacter(view: CellView): string {
  switch (view.kind) {
    case 'hidden':
      return '#';
    case 'flag':
      return 'F';
    case 'open':
      return String(view.adjacentMines);
    case 'mine':
      return '*';
    case 'exploded-mine':
      return 'X';
    case 'wrong-flag':
      return '!';
  }
}

/** `#` 閉じている、`F` 旗、数字 開いている、`*` 機雷、`X` 爆発した機雷、`!` 誤った旗。 */
function renderViews(state: GameState): string[] {
  const rows: string[] = [];
  for (let y = 0; y < state.config.height; y += 1) {
    let row = '';
    for (let x = 0; x < state.config.width; x += 1) {
      row += viewCharacter(getCellView(state, { x, y }));
    }
    rows.push(row);
  }
  return rows;
}

const neverCalled: MinePlacer = () => {
  throw new Error('機雷の配置関数が呼ばれてはいけない場面で呼ばれた');
};

/**
 * 旗を2本（機雷の上に1本、機雷のないマスに1本）立て、右下の数字を開いた状態。
 * 周囲の機雷の数は、(2,0)=2、(0,1)=2、(1,1)=2、(2,1)=2、(3,1)=1。
 */
function playingGame(): GameState {
  const { config, placeMines } = boardFrom(['**.*', '....']);
  let state = openCell(createGame(config), { x: 3, y: 1 }, placeMines);
  state = toggleFlag(state, { x: 0, y: 0 });
  state = toggleFlag(state, { x: 0, y: 1 });
  return state;
}

describe('getCellView', () => {
  it('最初のマスを開く前は、すべて閉じたマスとして見せる', () => {
    const state = createGame({ width: 3, height: 2, mineCount: 1 });

    expect(renderViews(state)).toEqual(['###', '###']);
    expect(getCellView(state, { x: 0, y: 0 })).toEqual({ kind: 'hidden' });
  });

  it('最初のマスを開く前に立てた旗は、旗として見せる', () => {
    const state = toggleFlag(
      createGame({ width: 3, height: 2, mineCount: 1 }),
      { x: 2, y: 1 },
    );

    expect(getCellView(state, { x: 2, y: 1 })).toEqual({ kind: 'flag' });
  });

  it('開いたマスは、周囲の機雷の数とともに見せる', () => {
    const state = playingGame();

    expect(getCellView(state, { x: 3, y: 1 })).toEqual({
      kind: 'open',
      adjacentMines: 1,
    });
  });

  it('周囲に機雷のない開いたマスは、0として見せる', () => {
    const { config, placeMines } = boardFrom(['...*.', '.....', '.....']);
    const state = openCell(createGame(config), { x: 0, y: 0 }, placeMines);

    expect(getCellView(state, { x: 0, y: 0 })).toEqual({
      kind: 'open',
      adjacentMines: 0,
    });
    expect(renderViews(state)).toEqual(['001##', '00111', '00000']);
  });

  it('プレイ中は、機雷の位置も旗の正誤も明かさない', () => {
    const state = playingGame();

    expect(state.status).toBe('playing');
    expect(renderViews(state)).toEqual(['F###', 'F##1']);
  });

  it('負けたあとは、爆発した機雷・残りの機雷・誤った旗を明かし、正しい旗と機雷のない閉じたマスはそのまま見せる', () => {
    const lost = openCell(playingGame(), { x: 3, y: 0 }, neverCalled);

    expect(lost.status).toBe('lost');
    expect(renderViews(lost)).toEqual(['F*#X', '!##1']);
    expect(getCellView(lost, { x: 3, y: 0 })).toEqual({
      kind: 'exploded-mine',
    });
    expect(getCellView(lost, { x: 1, y: 0 })).toEqual({ kind: 'mine' });
    expect(getCellView(lost, { x: 0, y: 1 })).toEqual({ kind: 'wrong-flag' });
    expect(getCellView(lost, { x: 0, y: 0 })).toEqual({ kind: 'flag' });
    expect(getCellView(lost, { x: 2, y: 0 })).toEqual({ kind: 'hidden' });
    expect(getCellView(lost, { x: 3, y: 1 })).toEqual({
      kind: 'open',
      adjacentMines: 1,
    });
  });

  it('勝ったあとは、機雷を旗として見せる', () => {
    const { config, placeMines } = boardFrom(['...', '...', '..*']);
    const won = openCell(createGame(config), { x: 0, y: 0 }, placeMines);

    expect(won.status).toBe('won');
    expect(renderViews(won)).toEqual(['000', '011', '01F']);
    expect(getCellView(won, { x: 2, y: 2 })).toEqual({ kind: 'flag' });
  });

  it.each([
    { label: 'xが負', x: -1, y: 0 },
    { label: 'yが負', x: 0, y: -1 },
    { label: 'xが幅と同じ', x: 4, y: 0 },
    { label: 'yが高さと同じ', x: 0, y: 2 },
    { label: 'xとyを取り違えた位置', x: 1, y: 3 },
    { label: 'xが小数', x: 0.5, y: 0 },
    { label: 'yが小数', x: 0, y: 0.5 },
    { label: 'yがNaN', x: 0, y: Number.NaN },
  ])('盤面の外や整数でない位置（$label）ではエラーになる', ({ x, y }) => {
    expect(() => getCellView(playingGame(), { x, y })).toThrow();
  });
});
