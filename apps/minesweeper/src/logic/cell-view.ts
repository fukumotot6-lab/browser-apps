import { findCell } from './game';
import type { CellView, GameState, Position } from './types';

/**
 * 1つのマスの見せ方を決める。
 * 負けたときに機雷と誤った旗を明かすルールをここに置き、描画層にルールを書かずに済ませる。
 */
export function getCellView(state: GameState, position: Position): CellView {
  const { index, cell } = findCell(state, position);
  const isLost = state.status === 'lost';

  switch (cell.state) {
    case 'open':
      return isLost && index === state.explodedIndex
        ? { kind: 'exploded-mine' }
        : { kind: 'open', adjacentMines: cell.adjacentMines };
    case 'flagged':
      // 正しく立てた旗は、負けたあとも旗のまま見せる。
      return isLost && !cell.hasMine
        ? { kind: 'wrong-flag' }
        : { kind: 'flag' };
    case 'hidden':
      return isLost && cell.hasMine ? { kind: 'mine' } : { kind: 'hidden' };
  }
}
