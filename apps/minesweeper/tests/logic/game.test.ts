import { describe, expect, it } from 'vitest';
import {
  countRemainingMines,
  createGame,
  openCell,
  openNeighbours,
  toggleFlag,
} from '../../src/logic/game';
import type {
  BoardConfig,
  Cell,
  GameState,
  MinePlacer,
  Position,
} from '../../src/logic/types';

interface Board {
  readonly config: BoardConfig;
  readonly placeMines: MinePlacer;
}

/** 配置を目で確かめられるよう、盤面を文字で書く。`*` が機雷、それ以外は機雷のないマス。 */
function boardFrom(rows: readonly string[]): Board {
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

function fixedPlacer(config: BoardConfig, mines: readonly Position[]) {
  const placeMines: MinePlacer = () =>
    mines.map((mine) => mine.y * config.width + mine.x);
  return placeMines;
}

/** `#` 閉じている、`F` 旗、数字 開いている、`*` 開いた機雷。 */
function render(state: GameState): string[] {
  const rows: string[] = [];
  for (let y = 0; y < state.config.height; y += 1) {
    const start = y * state.config.width;
    rows.push(
      state.cells
        .slice(start, start + state.config.width)
        .map(cellCharacter)
        .join(''),
    );
  }
  return rows;
}

function cellCharacter(cell: Cell): string {
  if (cell.state === 'hidden') {
    return '#';
  }
  if (cell.state === 'flagged') {
    return 'F';
  }
  return cell.hasMine ? '*' : String(cell.adjacentMines);
}

function cellAt(state: GameState, x: number, y: number): Cell {
  const cell = state.cells[y * state.config.width + x];
  if (cell === undefined) {
    throw new Error(`テストの位置が盤面の外です（x：${x}、y：${y}）`);
  }
  return cell;
}

/** 入力を書き換える実装なら、凍結したオブジェクトへの代入でエラーになる。 */
function deepFreeze(state: GameState): GameState {
  state.cells.forEach((cell) => Object.freeze(cell));
  Object.freeze(state.cells);
  Object.freeze(state.config);
  return Object.freeze(state);
}

const neverCalled: MinePlacer = () => {
  throw new Error('機雷の配置関数が呼ばれてはいけない場面で呼ばれた');
};

const OUTSIDE_POSITIONS: readonly (Position & { readonly label: string })[] = [
  { label: 'xが負', x: -1, y: 0 },
  { label: 'yが負', x: 0, y: -1 },
  { label: 'xが幅と同じ', x: 5, y: 0 },
  { label: 'yが高さと同じ', x: 0, y: 3 },
  { label: 'xとyを取り違えた位置', x: 2, y: 4 },
  { label: 'xが小数', x: 0.5, y: 0 },
  { label: 'yが小数', x: 0, y: 1.5 },
  { label: 'xがNaN', x: Number.NaN, y: 0 },
];

describe('createGame', () => {
  it('すべてのマスが閉じていて機雷のない、ready状態のゲームを返す', () => {
    const state = createGame({ width: 3, height: 2, mineCount: 2 });

    expect(state).toEqual({
      config: { width: 3, height: 2, mineCount: 2 },
      status: 'ready',
      cells: Array.from({ length: 6 }, () => ({
        hasMine: false,
        adjacentMines: 0,
        state: 'hidden',
      })),
      explodedIndex: null,
    });
  });

  it.each([
    { label: '幅が0', width: 0, height: 3, mineCount: 0 },
    { label: '幅が負', width: -1, height: 3, mineCount: 0 },
    { label: '幅が小数', width: 2.5, height: 3, mineCount: 0 },
    { label: '幅がNaN', width: Number.NaN, height: 3, mineCount: 0 },
    { label: '高さが0', width: 3, height: 0, mineCount: 0 },
    { label: '高さが負', width: 3, height: -2, mineCount: 0 },
    { label: '高さが小数', width: 3, height: 1.5, mineCount: 0 },
    { label: '機雷数が負', width: 3, height: 3, mineCount: -1 },
    { label: '機雷数が小数', width: 3, height: 3, mineCount: 1.5 },
    { label: '機雷数がマスの数と同じ', width: 3, height: 3, mineCount: 9 },
    { label: '機雷数がマスの数より多い', width: 3, height: 3, mineCount: 10 },
  ])('不正な設定（$label）ではエラーになる', ({ width, height, mineCount }) => {
    expect(() => createGame({ width, height, mineCount })).toThrow();
  });

  it('機雷数がマスの数より1つ少ない設定は受け付ける', () => {
    const state = createGame({ width: 3, height: 3, mineCount: 8 });

    expect(state.status).toBe('ready');
  });

  it('1×1で機雷0の最小の盤面を受け付ける', () => {
    expect(
      createGame({ width: 1, height: 1, mineCount: 0 }).cells,
    ).toHaveLength(1);
  });
});

describe('最初のマスを開くとき', () => {
  it('配置関数を、設定と開いたマスの添字を渡して1回だけ呼ぶ', () => {
    const calls: { config: BoardConfig; safeIndex: number }[] = [];
    const config = { width: 4, height: 3, mineCount: 1 };
    const placeMines: MinePlacer = (givenConfig, safeIndex) => {
      calls.push({ config: givenConfig, safeIndex });
      return [0];
    };

    openCell(createGame(config), { x: 2, y: 1 }, placeMines);

    expect(calls).toEqual([{ config, safeIndex: 6 }]);
  });

  it('2回目以降に開くときは配置関数を呼ばない', () => {
    const { config, placeMines } = boardFrom(['*...', '..*.', '*...']);
    const playing = openCell(createGame(config), { x: 3, y: 0 }, placeMines);

    const next = openCell(playing, { x: 3, y: 1 }, neverCalled);

    expect(next.status).toBe('playing');
    expect(cellAt(next, 3, 1).state).toBe('open');
  });

  it('周囲の機雷の数を、角・辺・中央のすべてのマスについて正しく数える', () => {
    const { config, placeMines } = boardFrom(['*...', '..*.', '*...']);

    const state = openCell(createGame(config), { x: 3, y: 0 }, placeMines);

    // 手で数えた値。機雷のマス自身も、周囲の機雷だけを数える。
    expect(state.cells.map((cell) => cell.adjacentMines)).toEqual([
      0, 2, 1, 1, 2, 3, 0, 1, 0, 2, 1, 1,
    ]);
    expect(state.cells.map((cell) => cell.hasMine)).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
      true,
      false,
      true,
      false,
      false,
      false,
    ]);
  });

  it('周囲8マスがすべて機雷のマスは8になる', () => {
    const { config, placeMines } = boardFrom(['***', '*.*', '***']);

    const state = openCell(createGame(config), { x: 1, y: 1 }, placeMines);

    expect(cellAt(state, 1, 1).adjacentMines).toBe(8);
    expect(state.status).toBe('won');
  });

  it('左右の端をまたいで隣の行の機雷を数えない', () => {
    // 添字では隣り合う「行の右端」と「次の行の左端」が、盤面では離れていることを確かめる。
    const { config, placeMines } = boardFrom(['...*', '....', '....']);

    const state = openCell(createGame(config), { x: 0, y: 2 }, placeMines);

    expect(cellAt(state, 0, 1).adjacentMines).toBe(0);
    expect(cellAt(state, 0, 0).adjacentMines).toBe(0);
    expect(cellAt(state, 2, 1).adjacentMines).toBe(1);
  });

  it.each([
    { label: '機雷が少ない', indices: [1] },
    { label: '機雷が多い', indices: [1, 2, 3] },
    { label: '添字が重複している', indices: [1, 1] },
    { label: '添字が負', indices: [1, -1] },
    { label: '添字がマスの数以上', indices: [1, 9] },
    { label: '添字が小数', indices: [1, 2.5] },
    { label: '最初に開くマスを含む', indices: [1, 4] },
  ])('配置関数の結果が不正（$label）ならエラーになる', ({ indices }) => {
    const state = createGame({ width: 3, height: 3, mineCount: 2 });

    expect(() => openCell(state, { x: 1, y: 1 }, () => indices)).toThrow();
  });

  it('開く前に立てた旗は残り、その下に機雷が置かれることもある', () => {
    const { config, placeMines } = boardFrom(['..', '.*']);
    const flagged = toggleFlag(createGame(config), { x: 1, y: 1 });

    const state = openCell(flagged, { x: 0, y: 0 }, placeMines);

    expect(cellAt(state, 1, 1)).toEqual({
      hasMine: true,
      adjacentMines: 0,
      state: 'flagged',
    });
    expect(render(state)).toEqual(['1#', '#F']);
  });

  it('旗のマスを開こうとしても機雷を配置せず、readyのまま同じ状態を返す', () => {
    const flagged = toggleFlag(
      createGame({ width: 3, height: 3, mineCount: 2 }),
      { x: 1, y: 1 },
    );

    expect(openCell(flagged, { x: 1, y: 1 }, neverCalled)).toBe(flagged);
  });
});

describe('マスを開く', () => {
  it('周囲に機雷のないマスを開くと、つながった空白とその縁の数字までが開き、その先は開かない', () => {
    const { config, placeMines } = boardFrom(['...*.', '.....', '.....']);

    const state = openCell(createGame(config), { x: 0, y: 0 }, placeMines);

    expect(render(state)).toEqual(['001##', '00111', '00000']);
    expect(state.status).toBe('playing');
  });

  it('数字のマスを開くと、そのマスだけが開く', () => {
    const { config, placeMines } = boardFrom(['...*.', '.....', '.....']);

    const state = openCell(createGame(config), { x: 2, y: 0 }, placeMines);

    expect(render(state)).toEqual(['##1##', '#####', '#####']);
  });

  it('横長の盤面で、xとyを取り違えずに右下のマスを開ける', () => {
    const { config, placeMines } = boardFrom(['*.*..', '.....', '.....']);

    const state = openCell(createGame(config), { x: 4, y: 2 }, placeMines);

    // (1,0)は機雷ではないが、隣がすべて数字か機雷なので、空白の広がりでは開かない。
    expect(render(state)).toEqual(['###10', '12110', '00000']);
    expect(state.status).toBe('playing');
  });

  it('縦長の盤面でも空白が正しく広がる', () => {
    const { config, placeMines } = boardFrom(['..', '..', '..', '*.', '..']);

    const state = openCell(createGame(config), { x: 1, y: 0 }, placeMines);

    expect(render(state)).toEqual(['00', '00', '11', '##', '##']);
  });

  it('空白の広がりは旗のマスを開かず、旗を避けて回り込む', () => {
    const { config, placeMines } = boardFrom(['...*.', '.....', '.....']);
    const flagged = toggleFlag(createGame(config), { x: 1, y: 1 });

    const state = openCell(flagged, { x: 0, y: 0 }, placeMines);

    expect(render(state)).toEqual(['001##', '0F111', '00000']);
  });

  it('空白の広がりは旗のマスを通り抜けない', () => {
    const { config, placeMines } = boardFrom(['......*']);
    const flagged = toggleFlag(createGame(config), { x: 2, y: 0 });

    const state = openCell(flagged, { x: 0, y: 0 }, placeMines);

    expect(render(state)).toEqual(['00F####']);
    expect(state.status).toBe('playing');
  });

  it('すでに開いているマスを開いても同じ状態を返す', () => {
    const { config, placeMines } = boardFrom(['...*.', '.....', '.....']);
    const state = openCell(createGame(config), { x: 0, y: 0 }, placeMines);

    expect(openCell(state, { x: 0, y: 0 }, neverCalled)).toBe(state);
    expect(openCell(state, { x: 2, y: 0 }, neverCalled)).toBe(state);
  });

  it('旗のマスは開けず、同じ状態を返す', () => {
    const { config, placeMines } = boardFrom(['...*.', '.....', '.....']);
    const playing = openCell(createGame(config), { x: 2, y: 0 }, placeMines);
    const flagged = toggleFlag(playing, { x: 3, y: 0 });

    expect(openCell(flagged, { x: 3, y: 0 }, neverCalled)).toBe(flagged);
  });

  it.each(OUTSIDE_POSITIONS)(
    '盤面の外や整数でない位置（$label）ではエラーになる',
    ({ x, y }) => {
      const state = createGame({ width: 5, height: 3, mineCount: 1 });

      expect(() => openCell(state, { x, y }, neverCalled)).toThrow();
    },
  );
});

describe('toggleFlag', () => {
  it('閉じたマスに旗を立て、もう一度で外す', () => {
    const initial = createGame({ width: 3, height: 2, mineCount: 1 });

    const flagged = toggleFlag(initial, { x: 2, y: 1 });
    const unflagged = toggleFlag(flagged, { x: 2, y: 1 });

    expect(render(flagged)).toEqual(['###', '##F']);
    expect(render(unflagged)).toEqual(['###', '###']);
  });

  it('最初のマスを開く前に旗を立ててもreadyのままで、機雷は置かれない', () => {
    const flagged = toggleFlag(
      createGame({ width: 3, height: 2, mineCount: 1 }),
      { x: 0, y: 0 },
    );

    expect(flagged.status).toBe('ready');
    expect(flagged.cells.some((cell) => cell.hasMine)).toBe(false);
  });

  it('開いているマスには旗を立てられず、同じ状態を返す', () => {
    const { config, placeMines } = boardFrom(['...*.', '.....', '.....']);
    const state = openCell(createGame(config), { x: 0, y: 0 }, placeMines);

    expect(toggleFlag(state, { x: 0, y: 0 })).toBe(state);
    expect(toggleFlag(state, { x: 2, y: 0 })).toBe(state);
  });

  it('プレイ中も旗を立てたり外したりでき、状態はplayingのまま', () => {
    const { config, placeMines } = boardFrom(['...*.', '.....', '.....']);
    const playing = openCell(createGame(config), { x: 2, y: 0 }, placeMines);

    const flagged = toggleFlag(playing, { x: 3, y: 0 });

    expect(render(flagged)).toEqual(['##1F#', '#####', '#####']);
    expect(flagged.status).toBe('playing');
    expect(render(toggleFlag(flagged, { x: 3, y: 0 }))).toEqual(
      render(playing),
    );
  });

  it.each(OUTSIDE_POSITIONS)(
    '盤面の外や整数でない位置（$label）ではエラーになる',
    ({ x, y }) => {
      const state = createGame({ width: 5, height: 3, mineCount: 1 });

      expect(() => toggleFlag(state, { x, y })).toThrow();
    },
  );
});

describe('countRemainingMines', () => {
  it('機雷数から旗の数を引いた値を返す', () => {
    const initial = createGame({ width: 3, height: 2, mineCount: 2 });
    const oneFlag = toggleFlag(initial, { x: 0, y: 0 });

    expect(countRemainingMines(initial)).toBe(2);
    expect(countRemainingMines(oneFlag)).toBe(1);
    expect(countRemainingMines(toggleFlag(oneFlag, { x: 0, y: 0 }))).toBe(2);
  });

  it('旗を機雷より多く立てると負の値になる', () => {
    let state = createGame({ width: 3, height: 2, mineCount: 1 });
    state = toggleFlag(state, { x: 0, y: 0 });
    state = toggleFlag(state, { x: 1, y: 0 });
    state = toggleFlag(state, { x: 2, y: 0 });

    expect(countRemainingMines(state)).toBe(-2);
  });
});

describe('勝ち', () => {
  it('機雷のない最後のマスを開いたときに勝ちになり、機雷に旗が立って残り機雷数が0になる', () => {
    const { config, placeMines } = boardFrom(['..', '.*']);
    const first = openCell(createGame(config), { x: 0, y: 0 }, placeMines);
    const second = openCell(first, { x: 1, y: 0 }, neverCalled);

    const last = openCell(second, { x: 0, y: 1 }, neverCalled);

    expect(first.status).toBe('playing');
    expect(second.status).toBe('playing');
    expect(countRemainingMines(second)).toBe(1);
    expect(last.status).toBe('won');
    expect(last.explodedIndex).toBeNull();
    expect(render(last)).toEqual(['11', '1F']);
    expect(countRemainingMines(last)).toBe(0);
  });

  it('機雷が0個なら最初の1手で勝ちになる', () => {
    const state = openCell(
      createGame({ width: 3, height: 2, mineCount: 0 }),
      { x: 1, y: 1 },
      () => [],
    );

    expect(state.status).toBe('won');
    expect(render(state)).toEqual(['000', '000']);
  });

  it('空白の広がりで残りがすべて開いたときも勝ちになる', () => {
    const { config, placeMines } = boardFrom(['...', '...', '..*']);

    const state = openCell(createGame(config), { x: 0, y: 0 }, placeMines);

    expect(state.status).toBe('won');
    expect(render(state)).toEqual(['000', '011', '01F']);
    expect(countRemainingMines(state)).toBe(0);
  });

  it('機雷のないマスに旗が残っているあいだは勝ちにならない', () => {
    const { config, placeMines } = boardFrom(['......*']);
    const flagged = toggleFlag(createGame(config), { x: 2, y: 0 });

    const blocked = openCell(flagged, { x: 0, y: 0 }, placeMines);
    const won = openCell(
      toggleFlag(blocked, { x: 2, y: 0 }),
      { x: 2, y: 0 },
      neverCalled,
    );

    expect(blocked.status).toBe('playing');
    expect(won.status).toBe('won');
    expect(render(won)).toEqual(['000001F']);
  });

  it('勝ったあとは開く操作も旗の操作も受け付けず、同じ状態を返す', () => {
    const { config, placeMines } = boardFrom(['...', '...', '..*']);
    const won = openCell(createGame(config), { x: 0, y: 0 }, placeMines);

    expect(openCell(won, { x: 2, y: 2 }, neverCalled)).toBe(won);
    expect(openCell(won, { x: 0, y: 0 }, neverCalled)).toBe(won);
    expect(toggleFlag(won, { x: 2, y: 2 })).toBe(won);
    expect(toggleFlag(won, { x: 0, y: 0 })).toBe(won);
  });
});

describe('負け', () => {
  function loseGame(): GameState {
    const { config, placeMines } = boardFrom(['..*', '...', '*..']);
    const playing = openCell(createGame(config), { x: 0, y: 0 }, placeMines);
    return openCell(playing, { x: 2, y: 0 }, neverCalled);
  }

  it('機雷を開くと負けになり、そのマスの添字が記録される', () => {
    const lost = loseGame();

    expect(lost.status).toBe('lost');
    expect(lost.explodedIndex).toBe(2);
  });

  it('開いた機雷のマスだけが開き、ほかのマスの状態は変わらない', () => {
    expect(render(loseGame())).toEqual(['01*', '12#', '###']);
  });

  it('負けたあとは開く操作も旗の操作も受け付けず、同じ状態を返す', () => {
    const lost = loseGame();

    // (2,2)は機雷のない閉じたマス、(0,2)は閉じた機雷、(0,0)は開いたマス。
    expect(openCell(lost, { x: 2, y: 2 }, neverCalled)).toBe(lost);
    expect(openCell(lost, { x: 0, y: 2 }, neverCalled)).toBe(lost);
    expect(openCell(lost, { x: 0, y: 0 }, neverCalled)).toBe(lost);
    expect(toggleFlag(lost, { x: 2, y: 2 })).toBe(lost);
    expect(toggleFlag(lost, { x: 0, y: 2 })).toBe(lost);
    expect(toggleFlag(lost, { x: 0, y: 0 })).toBe(lost);
  });

  it('勝敗が決まったあとでも、盤面の外の位置はエラーになる', () => {
    const lost = loseGame();

    expect(() => openCell(lost, { x: 3, y: 0 }, neverCalled)).toThrow();
    expect(() => toggleFlag(lost, { x: 0, y: 3 })).toThrow();
  });
});

describe('不変性', () => {
  it('新しい状態を返す操作は、渡された状態とそのマスの配列を書き換えない', () => {
    const { config, placeMines } = boardFrom(['...*.', '.....', '*....']);
    const steps: readonly ((state: GameState) => GameState)[] = [
      (state) => toggleFlag(state, { x: 4, y: 0 }),
      (state) => openCell(state, { x: 2, y: 0 }, placeMines),
      (state) => toggleFlag(state, { x: 4, y: 0 }),
      (state) => openCell(state, { x: 4, y: 2 }, neverCalled),
      (state) => toggleFlag(state, { x: 0, y: 2 }),
      (state) => openCell(state, { x: 3, y: 0 }, neverCalled),
    ];

    let current = deepFreeze(createGame(config));
    for (const step of steps) {
      const before = JSON.stringify(current);
      const next = deepFreeze(step(current));

      expect(next).not.toBe(current);
      expect(next.cells).not.toBe(current.cells);
      expect(JSON.stringify(current)).toBe(before);
      current = next;
    }
    expect(current.status).toBe('lost');
  });

  it('勝ちになる操作も、渡された状態を書き換えない', () => {
    const { config, placeMines } = boardFrom(['...', '...', '..*']);
    const initial = deepFreeze(createGame(config));
    const before = JSON.stringify(initial);

    const won = openCell(initial, { x: 0, y: 0 }, placeMines);

    expect(won.status).toBe('won');
    expect(JSON.stringify(initial)).toBe(before);
  });

  it('createGameに渡した設定をあとで書き換えても、ゲームの設定は変わらない', () => {
    const config = { width: 3, height: 2, mineCount: 1 };
    const state = createGame(config);

    config.width = 99;

    expect(state.config).toEqual({ width: 3, height: 2, mineCount: 1 });
  });
});

describe('難易度3種類の大きさでの通しプレイ', () => {
  /**
   * 機雷を盤面全体に等間隔で散らす。添字0には決して置かないので、最初に左上を開ける。
   * 乱数を使わず、同じ設定なら必ず同じ配置になる。
   */
  const spreadPlacer: MinePlacer = (config) => {
    const cellCount = config.width * config.height;
    const stride = Math.floor((cellCount - 1) / config.mineCount);
    return Array.from(
      { length: config.mineCount },
      (_, order) => cellCount - 1 - order * stride,
    );
  };

  it.each([
    { label: '初級（9×9・機雷10）', width: 9, height: 9, mineCount: 10 },
    { label: '中級（16×16・機雷40）', width: 16, height: 16, mineCount: 40 },
    { label: '上級（30×16・機雷99）', width: 30, height: 16, mineCount: 99 },
  ])(
    '$label：機雷のないマスをすべて開くと勝ちになる',
    ({ width, height, mineCount }) => {
      const config = { width, height, mineCount };
      const mines = new Set(spreadPlacer(config, 0));
      let state = openCell(createGame(config), { x: 0, y: 0 }, spreadPlacer);
      let lastSafeIndex = 0;

      for (let index = 0; index < width * height; index += 1) {
        if (mines.has(index)) {
          continue;
        }
        // 最後の1マスを開くまでは勝ちになっていないことも確かめる。
        if (
          cellAt(state, index % width, Math.floor(index / width)).state !==
          'open'
        ) {
          expect(state.status).toBe('playing');
          lastSafeIndex = index;
        }
        state = openCell(
          state,
          { x: index % width, y: Math.floor(index / width) },
          neverCalled,
        );
      }

      expect(lastSafeIndex).toBeGreaterThan(0);
      expect(state.status).toBe('won');
      expect(state.explodedIndex).toBeNull();
      expect(countRemainingMines(state)).toBe(0);
      expect(state.cells.filter((cell) => cell.hasMine)).toHaveLength(
        mineCount,
      );
      state.cells.forEach((cell, index) => {
        expect(cell.hasMine).toBe(mines.has(index));
        expect(cell.state).toBe(mines.has(index) ? 'flagged' : 'open');
      });
    },
  );
});

describe('fixedPlacerで位置を指定した場合', () => {
  it('指定した位置に機雷が置かれる', () => {
    const config = { width: 5, height: 3, mineCount: 2 };
    const placeMines = fixedPlacer(config, [
      { x: 4, y: 0 },
      { x: 1, y: 2 },
    ]);

    const state = openCell(createGame(config), { x: 2, y: 1 }, placeMines);

    expect(cellAt(state, 4, 0).hasMine).toBe(true);
    expect(cellAt(state, 1, 2).hasMine).toBe(true);
    expect(state.cells.filter((cell) => cell.hasMine)).toHaveLength(2);
    // (2,1)の周囲には(1,2)の機雷だけがある。(4,0)は2マス離れている。
    expect(render(state)).toEqual(['#####', '##1##', '#####']);
  });
});

describe('openNeighbours（数字のマスの周囲をまとめて開く）', () => {
  // 中央の(1,1)は、左上と右下の機雷に接する「2」。
  const board = boardFrom(['*...', '....', '..*.']);

  /** (1,1)だけを開いた状態。周囲はすべて閉じている。 */
  function centreOpened(): GameState {
    return openCell(createGame(board.config), { x: 1, y: 1 }, board.placeMines);
  }

  function flagAll(state: GameState, positions: readonly Position[]) {
    return positions.reduce(toggleFlag, state);
  }

  it('周囲の旗の数が数字と一致すると、旗のない閉じたマスがすべて開き、空白はさらに広がる', () => {
    const flagged = flagAll(centreOpened(), [
      { x: 0, y: 0 },
      { x: 2, y: 2 },
    ]);

    const state = openNeighbours(flagged, { x: 1, y: 1 });

    // 右下の(3,2)は(1,1)の隣ではなく、空白にも接していないので閉じたまま。
    expect(render(state)).toEqual(['F100', '1211', '01F#']);
    expect(state.status).toBe('playing');
  });

  it.each([
    { label: '旗がない', flags: [] },
    { label: '旗が数字より少ない', flags: [{ x: 0, y: 0 }] },
    {
      label: '旗が数字より多い',
      flags: [
        { x: 0, y: 0 },
        { x: 2, y: 2 },
        { x: 1, y: 0 },
      ],
    },
  ])(
    '旗の数が合わない（$label）ときは何も開かず、同じ状態を返す',
    ({ flags }) => {
      const flagged = flagAll(centreOpened(), flags);

      expect(openNeighbours(flagged, { x: 1, y: 1 })).toBe(flagged);
    },
  );

  it('旗の位置が間違っていると機雷を開いて負けになる', () => {
    const flagged = flagAll(centreOpened(), [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);

    const state = openNeighbours(flagged, { x: 1, y: 1 });

    expect(state.status).toBe('lost');
    expect(state.explodedIndex).toBe(2 * 4 + 2);
    // 負けたときは機雷のマスだけが開き、機雷のないマスは開かない。
    expect(render(state)).toEqual(['FF##', '#2##', '##*#']);
  });

  it('複数の機雷を開くことになっても、負けの原因として記録するのは添字の小さい1つだけ', () => {
    const twoMines = boardFrom(['.*.', '...', '.*.']);
    const opened = openCell(
      createGame(twoMines.config),
      { x: 1, y: 1 },
      twoMines.placeMines,
    );
    const flagged = flagAll(opened, [
      { x: 0, y: 0 },
      { x: 2, y: 2 },
    ]);

    const state = openNeighbours(flagged, { x: 1, y: 1 });

    expect(state.status).toBe('lost');
    expect(state.explodedIndex).toBe(1);
    expect(render(state)).toEqual(['F*#', '#2#', '##F']);
  });

  it('周囲を開いた結果、機雷のないマスがすべて開けば勝ちになる', () => {
    const small = boardFrom(['*.', '..']);
    const opened = openCell(
      createGame(small.config),
      { x: 1, y: 1 },
      small.placeMines,
    );
    const flagged = toggleFlag(opened, { x: 0, y: 0 });

    const state = openNeighbours(flagged, { x: 1, y: 1 });

    expect(state.status).toBe('won');
    expect(render(state)).toEqual(['F1', '11']);
    expect(countRemainingMines(state)).toBe(0);
  });

  it('閉じたマスや旗のマスに対しては何もせず、同じ状態を返す', () => {
    const flagged = toggleFlag(centreOpened(), { x: 0, y: 0 });

    expect(openNeighbours(flagged, { x: 3, y: 0 })).toBe(flagged);
    expect(openNeighbours(flagged, { x: 0, y: 0 })).toBe(flagged);
  });

  it('最初のマスを開く前は何もせず、同じ状態を返す', () => {
    const ready = createGame(board.config);

    expect(openNeighbours(ready, { x: 1, y: 1 })).toBe(ready);
  });

  it('周囲に開けるマスが残っていなければ、同じ状態を返す', () => {
    const flagged = flagAll(centreOpened(), [
      { x: 0, y: 0 },
      { x: 2, y: 2 },
    ]);
    const opened = openNeighbours(flagged, { x: 1, y: 1 });

    expect(openNeighbours(opened, { x: 1, y: 1 })).toBe(opened);
  });

  it('勝敗が決まったあとは何もせず、同じ状態を返す', () => {
    const lost = openNeighbours(
      flagAll(centreOpened(), [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
      { x: 1, y: 1 },
    );

    expect(openNeighbours(lost, { x: 1, y: 1 })).toBe(lost);
  });

  it('渡された状態を書き換えない', () => {
    const flagged = deepFreeze(
      flagAll(centreOpened(), [
        { x: 0, y: 0 },
        { x: 2, y: 2 },
      ]),
    );
    const before = JSON.stringify(flagged);

    const state = openNeighbours(flagged, { x: 1, y: 1 });

    expect(state).not.toBe(flagged);
    expect(JSON.stringify(flagged)).toBe(before);
  });

  it.each([
    { label: 'xが負', x: -1, y: 0 },
    { label: 'yが高さと同じ', x: 0, y: 3 },
    { label: 'xが小数', x: 0.5, y: 0 },
  ])('盤面の外や整数でない位置（$label）ではエラーになる', ({ x, y }) => {
    expect(() => openNeighbours(centreOpened(), { x, y })).toThrow();
  });
});
