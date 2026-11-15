/** タイマーの上限。表示器が3桁なので、ここで止める。 */
export const MAX_SECONDS = 999;

/**
 * 表示を更新する間隔（ミリ秒）。
 * 1秒より短くするのは、割り込みが少し遅れても、秒の変わり目から大きくずれずに表示を変えるため。
 * 表示値は開始時刻との差から求めるので、間隔の長さは値の正しさに影響しない。
 */
export const TICK_INTERVAL_MS = 100;

/**
 * 開始時刻と現在時刻（どちらもミリ秒）から、表示する経過秒を求める。
 *
 * 割り込みの回数を数えずに時刻の差から求めるのは、タブが裏に回って
 * 割り込みが間引かれても、正しい値に戻れるようにするため。
 */
export function elapsedSeconds(startedAt: number, now: number): number {
  const seconds = Math.floor((now - startedAt) / 1000);
  // 端末の時計が巻き戻されると差が負になる。NaNも0として扱う。
  if (Number.isNaN(seconds) || seconds < 0) {
    return 0;
  }
  return Math.min(seconds, MAX_SECONDS);
}
