import type { BoardConfig } from '../logic';

export type DifficultyId = 'beginner' | 'intermediate' | 'expert';

export interface Difficulty {
  readonly id: DifficultyId;
  /** 難易度ボタンに出す名前。 */
  readonly label: string;
  readonly config: BoardConfig;
}

// ロジック層は盤面の大きさと機雷数を引数で受け取るだけなので、組み合わせは描画層が持つ。
const BEGINNER: Difficulty = {
  id: 'beginner',
  label: '初級',
  config: { width: 9, height: 9, mineCount: 10 },
};

const INTERMEDIATE: Difficulty = {
  id: 'intermediate',
  label: '中級',
  config: { width: 16, height: 16, mineCount: 40 },
};

const EXPERT: Difficulty = {
  id: 'expert',
  label: '上級',
  config: { width: 30, height: 16, mineCount: 99 },
};

/** 難易度の一覧。ボタンはこの順に並べる。 */
export const DIFFICULTIES: readonly Difficulty[] = [
  BEGINNER,
  INTERMEDIATE,
  EXPERT,
];

/** 起動時の難易度。 */
export const DEFAULT_DIFFICULTY: Difficulty = BEGINNER;
