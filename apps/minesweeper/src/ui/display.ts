import type { GameStatus } from '../logic';

const COUNTER_MIN = -99;
const COUNTER_MAX = 999;

/**
 * 3桁の表示器に出す文字列を作る。
 * 桁が足りない値は端の値に丸める。表示器の幅を変えずに済ませるため。
 */
export function formatCounter(value: number): string {
  // NaNをそのまま通すと「NaN」と表示されてしまう。
  const finite = Number.isNaN(value) ? 0 : value;
  const clamped = Math.min(
    Math.max(Math.trunc(finite), COUNTER_MIN),
    COUNTER_MAX,
  );
  if (clamped < 0) {
    // 符号に1桁使うので、数字は2桁になる。
    return `-${String(-clamped).padStart(2, '0')}`;
  }
  return String(clamped).padStart(3, '0');
}

/**
 * 7セグメント表示の各セグメントの名前。上から時計回りに a〜f、中央が g。
 *
 * ```
 *  aaa
 * f   b
 *  ggg
 * e   c
 *  ddd
 * ```
 */
export type SegmentName = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';

export const SEGMENT_NAMES: readonly SegmentName[] = [
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
];

// オブジェクトではなくMapにするのは、「constructor」のような文字列で
// プロトタイプ上の値を引いてしまわないようにするため。
const LIT_SEGMENTS: ReadonlyMap<string, readonly SegmentName[]> = new Map<
  string,
  readonly SegmentName[]
>([
  ['0', ['a', 'b', 'c', 'd', 'e', 'f']],
  ['1', ['b', 'c']],
  ['2', ['a', 'b', 'd', 'e', 'g']],
  ['3', ['a', 'b', 'c', 'd', 'g']],
  ['4', ['b', 'c', 'f', 'g']],
  ['5', ['a', 'c', 'd', 'f', 'g']],
  ['6', ['a', 'c', 'd', 'e', 'f', 'g']],
  ['7', ['a', 'b', 'c']],
  ['8', ['a', 'b', 'c', 'd', 'e', 'f', 'g']],
  ['9', ['a', 'b', 'c', 'd', 'f', 'g']],
  ['-', ['g']],
]);

/** 1文字（0〜9 と "-"）を表すために点灯するセグメント。表にない文字ではすべて消灯する。 */
export function litSegments(character: string): readonly SegmentName[] {
  return LIT_SEGMENTS.get(character) ?? [];
}

/** 顔のボタンの表情。 */
export type Face = 'playing' | 'won' | 'lost';

/** 最初のマスを開く前とプレイ中は、同じ表情にする。 */
export function faceFor(status: GameStatus): Face {
  switch (status) {
    case 'ready':
    case 'playing':
      return 'playing';
    case 'won':
      return 'won';
    case 'lost':
      return 'lost';
  }
}

/**
 * スクリーンリーダー向けの通知の文言。
 * 勝敗は顔の絵だけで示しているので、絵が見えない利用者にも伝わるようにする。
 */
export function statusMessageFor(status: GameStatus): string {
  switch (status) {
    case 'ready':
    case 'playing':
      return '';
    case 'won':
      return 'クリアしました';
    case 'lost':
      return '機雷を踏みました';
  }
}
