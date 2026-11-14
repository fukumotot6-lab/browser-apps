import type {
  BoardConfig,
  Cell,
  GameState,
  MinePlacer,
  Position,
} from './types';

const INITIAL_CELL: Cell = {
  hasMine: false,
  adjacentMines: 0,
  state: 'hidden',
};

/**
 * 新しいゲームを作る。機雷は最初のマスを開くまで置かない。
 * 最初に開くマスを必ず安全にするには、そのマスが決まってから配置する必要があるため。
 */
export function createGame(config: BoardConfig): GameState {
  const { width, height, mineCount } = config;
  if (!Number.isInteger(width) || width < 1) {
    throw new Error(
      `盤面の幅は1以上の整数で指定してください（指定された値：${String(width)}）`,
    );
  }
  if (!Number.isInteger(height) || height < 1) {
    throw new Error(
      `盤面の高さは1以上の整数で指定してください（指定された値：${String(height)}）`,
    );
  }
  if (!Number.isInteger(mineCount) || mineCount < 0) {
    throw new Error(
      `機雷の数は0以上の整数で指定してください（指定された値：${String(mineCount)}）`,
    );
  }
  // 最初に開くマスには機雷を置かないので、少なくとも1マスは空いていなければならない。
  if (mineCount >= width * height) {
    throw new Error(
      `機雷の数はマスの数より少なくしてください（マスの数：${String(width * height)}、機雷の数：${String(mineCount)}）`,
    );
  }

  return {
    // 呼び出し側があとで元のオブジェクトを書き換えても、ゲームの状態が変わらないようにする。
    config: { width, height, mineCount },
    status: 'ready',
    cells: Array.from({ length: width * height }, () => INITIAL_CELL),
    explodedIndex: null,
  };
}

/**
 * マスを開く。何も変わらない操作では、渡された状態をそのまま返す
 * （描画層が参照の比較だけで再描画を省けるようにするため）。
 */
export function openCell(
  state: GameState,
  position: Position,
  placeMines: MinePlacer,
): GameState {
  const { index, cell } = findCell(state, position);
  if (isFinished(state) || cell.state !== 'hidden') {
    return state;
  }

  const cells =
    state.status === 'ready' ? layMines(state, index, placeMines) : state.cells;
  const target = cellAt(cells, index);

  if (target.hasMine) {
    // ほかのマスの状態は変えない。負けたときに何を明かすかは見せ方の問題なので、getCellViewに任せる。
    const lostCells = [...cells];
    lostCells[index] = { ...target, state: 'open' };
    return {
      ...state,
      status: 'lost',
      cells: lostCells,
      explodedIndex: index,
    };
  }

  return afterOpening(state, floodOpen(state.config, cells, index));
}

/**
 * 開いている数字のマスの周囲を、まとめて開く（昔のWindows版の両クリックにあたる操作）。
 *
 * 周囲の旗の数がそのマスの数字と一致するときだけ、旗のない閉じたマスをすべて開く。
 * 旗の位置が間違っていれば機雷を開くことになり、負けになる。
 * 一致しないときに何もしないのは、利用者がまだ機雷の位置を特定し終えていないため。
 */
export function openNeighbours(
  state: GameState,
  position: Position,
): GameState {
  const { index, cell } = findCell(state, position);
  if (isFinished(state) || cell.state !== 'open') {
    return state;
  }

  const neighbours = neighbourIndices(state.config, index);
  const flagCount = neighbours.filter(
    (neighbour) => cellAt(state.cells, neighbour).state === 'flagged',
  ).length;
  const targets = neighbours.filter(
    (neighbour) => cellAt(state.cells, neighbour).state === 'hidden',
  );
  if (flagCount !== cell.adjacentMines || targets.length === 0) {
    return state;
  }

  const mineIndex = targets.find(
    (target) => cellAt(state.cells, target).hasMine,
  );
  if (mineIndex !== undefined) {
    // 複数の機雷を同時に開くことになっても、負けの原因として記録するのは1つだけにする。
    // 残りはgetCellViewが「明かされた機雷」として見せる。
    const lostCells = [...state.cells];
    lostCells[mineIndex] = { ...cellAt(lostCells, mineIndex), state: 'open' };
    return {
      ...state,
      status: 'lost',
      cells: lostCells,
      explodedIndex: mineIndex,
    };
  }

  let cells = state.cells;
  for (const target of targets) {
    // 先に開いたマスからの広がりで、すでに開いていることがある。
    if (cellAt(cells, target).state === 'hidden') {
      cells = floodOpen(state.config, cells, target);
    }
  }
  return afterOpening(state, cells);
}

/** 旗を立てる・外す。旗の数に上限は設けない（残り機雷数は負になりうる）。 */
export function toggleFlag(state: GameState, position: Position): GameState {
  const { index, cell } = findCell(state, position);
  if (isFinished(state) || cell.state === 'open') {
    return state;
  }

  const cells = [...state.cells];
  cells[index] = {
    ...cell,
    state: cell.state === 'hidden' ? 'flagged' : 'hidden',
  };
  return { ...state, cells };
}

/** 機雷数 − 旗の数。旗を機雷より多く立てると負になる。 */
export function countRemainingMines(state: GameState): number {
  const flagCount = state.cells.filter(
    (cell) => cell.state === 'flagged',
  ).length;
  return state.config.mineCount - flagCount;
}

/**
 * 位置からマスとその添字を求める。盤面の外や整数でない位置ではエラーにする。
 * 位置の検証を1か所にまとめるため、cell-view.tsからも使う。
 */
export function findCell(
  state: GameState,
  position: Position,
): { readonly index: number; readonly cell: Cell } {
  const { width, height } = state.config;
  const { x, y } = position;
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    x >= width ||
    y < 0 ||
    y >= height
  ) {
    throw new Error(
      `盤面の外の位置が指定されました（x：${String(x)}、y：${String(y)}、盤面：${String(width)}×${String(height)}）`,
    );
  }
  const index = y * width + x;
  return { index, cell: cellAt(state.cells, index) };
}

/** 機雷のないマスを開いたあとの状態を作る。すべて開いていれば勝ちにする。 */
function afterOpening(state: GameState, cells: readonly Cell[]): GameState {
  const isWon = cells.every(
    (current) => current.hasMine || current.state === 'open',
  );
  if (!isWon) {
    return { ...state, status: 'playing', cells };
  }
  return {
    ...state,
    status: 'won',
    // 勝ったときは残りの機雷に旗を立て、残り機雷数のカウンターが0になるようにする。
    cells: cells.map((current) =>
      current.hasMine ? { ...current, state: 'flagged' } : current,
    ),
  };
}

function isFinished(state: GameState): boolean {
  return state.status === 'won' || state.status === 'lost';
}

function cellAt(cells: readonly Cell[], index: number): Cell {
  const cell = cells[index];
  if (cell === undefined) {
    // 添字は検証済みなので、ここに来るのはcellsの長さがconfigと合わない壊れた状態だけ。
    throw new Error(
      `マスの配列が盤面の大きさと合っていません（添字：${String(index)}）`,
    );
  }
  return cell;
}

function neighbourIndices(config: BoardConfig, index: number): number[] {
  const x = index % config.width;
  const y = Math.floor(index / config.width);
  const neighbours: number[] = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const nx = x + dx;
      const ny = y + dy;
      const isSelf = dx === 0 && dy === 0;
      // 添字の足し引きだけで隣を求めると、左右の端で反対側の列につながってしまう。
      const isInside =
        nx >= 0 && nx < config.width && ny >= 0 && ny < config.height;
      if (!isSelf && isInside) {
        neighbours.push(ny * config.width + nx);
      }
    }
  }
  return neighbours;
}

/**
 * 機雷の配置を決め、全マスの `hasMine` と `adjacentMines` を埋める。
 * マスの状態（旗）は変えないので、最初に開く前に立てた旗はそのまま残る。
 */
function layMines(
  state: GameState,
  safeIndex: number,
  placeMines: MinePlacer,
): readonly Cell[] {
  const { config } = state;
  const mineIndices = placeMines(config, safeIndex);
  const mines = validateMineIndices(config, safeIndex, mineIndices);

  return state.cells.map((cell, index) => ({
    ...cell,
    hasMine: mines.has(index),
    adjacentMines: neighbourIndices(config, index).filter((neighbour) =>
      mines.has(neighbour),
    ).length,
  }));
}

/**
 * 配置関数は外から渡されるので、結果をそのまま信用しない。
 * 誤った配置を受け入れると、勝敗の判定や数字が黙って狂い、原因を追いにくくなる。
 */
function validateMineIndices(
  config: BoardConfig,
  safeIndex: number,
  mineIndices: readonly number[],
): ReadonlySet<number> {
  const cellCount = config.width * config.height;
  if (mineIndices.length !== config.mineCount) {
    throw new Error(
      `機雷の配置が不正です：${String(config.mineCount)}個のはずが${String(mineIndices.length)}個でした`,
    );
  }
  const mines = new Set<number>();
  for (const mineIndex of mineIndices) {
    if (
      !Number.isInteger(mineIndex) ||
      mineIndex < 0 ||
      mineIndex >= cellCount
    ) {
      throw new Error(
        `機雷の配置が不正です：添字${String(mineIndex)}は盤面の外です`,
      );
    }
    if (mineIndex === safeIndex) {
      throw new Error(
        `機雷の配置が不正です：最初に開くマス（添字${String(safeIndex)}）に機雷があります`,
      );
    }
    if (mines.has(mineIndex)) {
      throw new Error(
        `機雷の配置が不正です：添字${String(mineIndex)}が重複しています`,
      );
    }
    mines.add(mineIndex);
  }
  return mines;
}

/**
 * 機雷のないマスを開き、周囲の機雷が0なら隣へ広げていく。
 * 上級（30×16）で広い空白を開いても呼び出しが深くならないよう、再帰ではなくスタックで処理する。
 */
function floodOpen(
  config: BoardConfig,
  cells: readonly Cell[],
  startIndex: number,
): readonly Cell[] {
  const result = [...cells];
  result[startIndex] = { ...cellAt(result, startIndex), state: 'open' };
  const pending = [startIndex];

  for (
    let current = pending.pop();
    current !== undefined;
    current = pending.pop()
  ) {
    // 数字のマスの隣には機雷がありうるので、そこから先へは広げない。
    if (cellAt(result, current).adjacentMines !== 0) {
      continue;
    }
    for (const neighbour of neighbourIndices(config, current)) {
      const cell = cellAt(result, neighbour);
      // 旗のマスは利用者が「開かない」と示したマスなので、自動では開かない。
      if (cell.state === 'hidden') {
        result[neighbour] = { ...cell, state: 'open' };
        pending.push(neighbour);
      }
    }
  }
  return result;
}
