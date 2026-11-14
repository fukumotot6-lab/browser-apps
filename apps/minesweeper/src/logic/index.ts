export type {
  BoardConfig,
  Cell,
  CellState,
  CellView,
  GameState,
  GameStatus,
  MinePlacer,
  Position,
  Random,
} from './types';
export { countRemainingMines, createGame, openCell, toggleFlag } from './game';
export { getCellView } from './cell-view';
export { createRandomMinePlacer } from './mine-placement';
