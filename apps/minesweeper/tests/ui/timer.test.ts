import { describe, expect, it } from 'vitest';
import {
  elapsedSeconds,
  MAX_SECONDS,
  TICK_INTERVAL_MS,
} from '../../src/ui/timer';

// 実際の時刻に近い大きさの値で確かめる。
const STARTED_AT = 1_800_000_000_000;

describe('elapsedSeconds', () => {
  it.each([
    { label: '開始と同時', elapsedMs: 0, expected: 0 },
    { label: '1秒の直前', elapsedMs: 999, expected: 0 },
    { label: '1秒ちょうど', elapsedMs: 1000, expected: 1 },
    { label: '2秒の直前', elapsedMs: 1999, expected: 1 },
    { label: '1分', elapsedMs: 60_000, expected: 60 },
    { label: '上限の直前', elapsedMs: 998_999, expected: 998 },
    { label: '上限ちょうど', elapsedMs: 999_000, expected: 999 },
    { label: '上限を超えたあと', elapsedMs: 5_000_000, expected: 999 },
  ])(
    '$label：$elapsedMs ミリ秒後は $expected 秒',
    ({ elapsedMs, expected }) => {
      expect(elapsedSeconds(STARTED_AT, STARTED_AT + elapsedMs)).toBe(expected);
    },
  );

  it('時計が巻き戻って現在時刻が開始時刻より前になっても、0秒より小さくならない', () => {
    expect(elapsedSeconds(STARTED_AT, STARTED_AT - 1)).toBe(0);
    expect(elapsedSeconds(STARTED_AT, STARTED_AT - 5000)).toBe(0);
  });

  it('時刻が数として扱えない値でも、0秒として扱う', () => {
    expect(elapsedSeconds(Number.NaN, STARTED_AT)).toBe(0);
    expect(elapsedSeconds(STARTED_AT, Number.NaN)).toBe(0);
  });
});

describe('タイマーの定数', () => {
  it('上限は、3桁の表示器に収まる999秒', () => {
    expect(MAX_SECONDS).toBe(999);
  });

  it('表示を更新する間隔は、1秒を割り切る長さにして、秒の変わり目ちょうどに更新が来るようにする', () => {
    expect(TICK_INTERVAL_MS).toBeGreaterThan(0);
    expect(1000 % TICK_INTERVAL_MS).toBe(0);
  });
});
