import type { BoardConfig, MinePlacer, Random } from './types';

/**
 * 乱数で機雷の位置を決める `MinePlacer` を作る。
 *
 * 乱数を引数で受け取るのは、テストで値を固定して配置を再現できるようにするため。
 */
export function createRandomMinePlacer(random: Random): MinePlacer {
  return (config: BoardConfig, safeIndex: number): readonly number[] => {
    const cellCount = config.width * config.height;
    if (!Number.isInteger(cellCount) || cellCount < 1) {
      throw new Error(
        `盤面の大きさが正しくありません（幅 ${config.width}、高さ ${config.height}）。`,
      );
    }
    // 範囲外の添字を黙って受け入れると、候補が1マス多いまま配置してしまい、
    // 呼び出し側の誤りに気づけない。
    if (
      !Number.isInteger(safeIndex) ||
      safeIndex < 0 ||
      safeIndex >= cellCount
    ) {
      throw new Error(
        `最初に開くマスの添字が盤面の外です（添字 ${safeIndex}、マスの数 ${cellCount}）。`,
      );
    }

    const candidates: number[] = [];
    for (let index = 0; index < cellCount; index += 1) {
      if (index !== safeIndex) {
        candidates.push(index);
      }
    }

    const { mineCount } = config;
    if (!Number.isInteger(mineCount) || mineCount < 0) {
      throw new Error(
        `機雷の数は0以上の整数で指定してください（指定された数 ${mineCount}）。`,
      );
    }
    if (mineCount > candidates.length) {
      throw new Error(
        `機雷の数が多すぎます（指定された数 ${mineCount}、置けるマスの数 ${candidates.length}）。`,
      );
    }

    // Fisher–Yatesのシャッフルを先頭の mineCount 個で打ち切る。
    // 「置いてみて重複したら引き直す」方式は、機雷がマスを埋め尽くす設定で
    // 引き直しが増え続けるため使わない。
    for (let filled = 0; filled < mineCount; filled += 1) {
      const remaining = candidates.length - filled;
      const picked = filled + pickBelow(random, remaining);
      const current = candidates[filled];
      const chosen = candidates[picked];
      if (current === undefined || chosen === undefined) {
        // 乱数がNaNを返した場合などにここへ来る。壊れた配置を返すより止める。
        throw new Error('乱数が数として扱えない値を返しました。');
      }
      candidates[filled] = chosen;
      candidates[picked] = current;
    }

    return candidates.slice(0, mineCount);
  };
}

/**
 * 0以上 `limit` 未満の整数を選ぶ。
 *
 * 乱数が1にごく近い値を返すと、掛け算の丸めで `limit` ちょうどになることがある。
 * 約束に反して1以上や負の値を返す乱数が渡されても範囲外を指さないよう、両端で切り詰める。
 */
function pickBelow(random: Random, limit: number): number {
  const scaled = Math.floor(random() * limit);
  return Math.min(Math.max(scaled, 0), limit - 1);
}
