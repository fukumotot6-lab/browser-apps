/** 盤面の大きさと機雷の数。難易度はこの値の組み合わせとして、ロジック層の外で定義する。 */
export interface BoardConfig {
  readonly width: number;
  readonly height: number;
  readonly mineCount: number;
}

/** マスの位置。左上が `{ x: 0, y: 0 }`。 */
export interface Position {
  readonly x: number;
  readonly y: number;
}

export type CellState = 'hidden' | 'flagged' | 'open';

export interface Cell {
  readonly hasMine: boolean;
  /** 周囲8マスにある機雷の数。機雷を配置する前はすべて0。 */
  readonly adjacentMines: number;
  readonly state: CellState;
}

/**
 * - `ready`：最初のマスを開く前。機雷はまだ配置されていない
 * - `playing`：最初のマスを開いたあと
 * - `won` / `lost`：勝敗が決まった。以後の操作は受け付けない
 */
export type GameStatus = 'ready' | 'playing' | 'won' | 'lost';

export interface GameState {
  readonly config: BoardConfig;
  readonly status: GameStatus;
  /** 行ごとに左から右へ並べた1次元の配列。`index = y * width + x`。 */
  readonly cells: readonly Cell[];
  /** 負けの原因になったマスの添字。負けていなければ `null`。 */
  readonly explodedIndex: number | null;
}

/** 0以上1未満の数を返す関数。`Math.random` と同じ形。 */
export type Random = () => number;

/**
 * 機雷を置くマスの添字を決める関数。
 *
 * 最初に開くマスが決まってから呼ばれる。テストで配置を固定したり、
 * 将来、盤面の生成方法を差し替えたりできるよう、引数として受け取る。
 *
 * @param safeIndex 最初に開くマスの添字。ここには機雷を置いてはいけない
 * @returns 機雷を置くマスの添字。重複のない `config.mineCount` 個
 */
export type MinePlacer = (
  config: BoardConfig,
  safeIndex: number,
) => readonly number[];

/**
 * 1つのマスを画面にどう見せるか。勝敗による見せ方の違いをロジック層で決め、
 * 描画層がルールを知らなくても描けるようにする。
 *
 * - `mine`：負けたときに明かされる、旗の立っていない機雷
 * - `exploded-mine`：負けの原因になった機雷
 * - `wrong-flag`：負けたときに明かされる、機雷のないマスに立てた旗
 */
export type CellView =
  | { readonly kind: 'hidden' }
  | { readonly kind: 'flag' }
  | { readonly kind: 'open'; readonly adjacentMines: number }
  | { readonly kind: 'mine' }
  | { readonly kind: 'exploded-mine' }
  | { readonly kind: 'wrong-flag' };
