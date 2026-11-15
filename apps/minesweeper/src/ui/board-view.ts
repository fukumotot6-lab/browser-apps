import { getCellView } from '../logic';
import type { CellView, GameState, Position } from '../logic';
import { createIcon } from './svg';
import type { IconName } from './svg';

export interface BoardView {
  readonly element: HTMLElement;
  /** ゲームの状態を盤面に反映する。盤面の大きさが変わっていれば、マスを作り直す。 */
  render(state: GameState): void;
  /** 出来事の対象（`event.target`）がこの盤面のマスの中なら、その位置を返す。 */
  positionAt(target: EventTarget | null): Position | null;
}

interface CellElement {
  readonly element: HTMLElement;
  readonly position: Position;
  /** 最後に描いた見せ方。同じなら描き直さない。 */
  paintedKey: string;
}

function viewKey(view: CellView): string {
  return view.kind === 'open'
    ? `open:${String(view.adjacentMines)}`
    : view.kind;
}

function iconFor(view: CellView): IconName | null {
  switch (view.kind) {
    case 'flag':
      return 'flag';
    case 'mine':
    case 'exploded-mine':
      // 爆発した機雷は、絵は同じで背景の色だけを変える（style.css）。
      return 'mine';
    case 'wrong-flag':
      return 'wrong-flag';
    case 'hidden':
    case 'open':
      return null;
  }
}

function paintCell(element: HTMLElement, view: CellView): void {
  element.dataset.kind = view.kind;
  if (view.kind === 'open') {
    element.dataset.adjacent = String(view.adjacentMines);
    // 0は数字を出さない。
    element.textContent =
      view.adjacentMines > 0 ? String(view.adjacentMines) : '';
    return;
  }
  delete element.dataset.adjacent;
  const icon = iconFor(view);
  if (icon === null) {
    element.replaceChildren();
  } else {
    element.replaceChildren(createIcon(icon));
  }
}

/** 盤面を作る。マスは最初の `render` で作る。 */
export function createBoardView(): BoardView {
  const element = document.createElement('div');
  element.className = 'board';
  element.dataset.testid = 'board';

  let cells: CellElement[] = [];
  // マスの位置は属性の文字列を読み直さず、作ったときの値を引く。
  let positions = new WeakMap<EventTarget, Position>();
  let width = 0;
  let height = 0;

  function rebuild(nextWidth: number, nextHeight: number): void {
    width = nextWidth;
    height = nextHeight;
    cells = [];
    positions = new WeakMap<EventTarget, Position>();
    element.dataset.width = String(width);
    element.dataset.height = String(height);
    // 列の数はCSSの変数で渡す。HTMLにstyle属性を書いたり、難易度ごとのクラスを
    // 用意したりせずに済ませるため。
    element.style.setProperty('--board-columns', String(width));

    const fragment = document.createDocumentFragment();
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.x = String(x);
        cell.dataset.y = String(y);
        const position = { x, y };
        positions.set(cell, position);
        cells.push({ element: cell, position, paintedKey: '' });
        fragment.append(cell);
      }
    }
    element.replaceChildren(fragment);
  }

  return {
    element,
    render(state: GameState): void {
      if (state.config.width !== width || state.config.height !== height) {
        rebuild(state.config.width, state.config.height);
      }
      for (const cell of cells) {
        const view = getCellView(state, cell.position);
        const key = viewKey(view);
        // 上級は480マスあるので、変わったマスだけを書き換える。
        if (key !== cell.paintedKey) {
          paintCell(cell.element, view);
          cell.paintedKey = key;
        }
      }
    },
    positionAt(target: EventTarget | null): Position | null {
      if (!(target instanceof Element)) {
        return null;
      }
      // マスの中の絵（SVG）が対象になることがあるので、外側のマスまでさかのぼる。
      const cell = target.closest('.cell');
      if (cell === null) {
        return null;
      }
      return positions.get(cell) ?? null;
    },
  };
}
