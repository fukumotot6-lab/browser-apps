import { describe, expect, it } from 'vitest';
import {
  faceFor,
  formatCounter,
  litSegments,
  SEGMENT_NAMES,
  statusMessageFor,
} from '../../src/ui/display';

describe('formatCounter', () => {
  it.each([
    { label: '0', value: 0, expected: '000' },
    { label: '1桁', value: 7, expected: '007' },
    { label: '2桁', value: 10, expected: '010' },
    { label: '3桁', value: 123, expected: '123' },
    { label: '上限ちょうど', value: 999, expected: '999' },
    { label: '上限より大きい', value: 1200, expected: '999' },
    { label: '負の1桁', value: -5, expected: '-05' },
    { label: '負の2桁', value: -42, expected: '-42' },
    { label: '下限ちょうど', value: -99, expected: '-99' },
    { label: '下限より小さい', value: -120, expected: '-99' },
    { label: '正の小数', value: 12.9, expected: '012' },
    { label: '0に丸まる負の小数', value: -0.5, expected: '000' },
    { label: 'NaN', value: Number.NaN, expected: '000' },
    { label: '正の無限大', value: Number.POSITIVE_INFINITY, expected: '999' },
    { label: '負の無限大', value: Number.NEGATIVE_INFINITY, expected: '-99' },
  ])('$label：$value は "$expected" と表示する', ({ value, expected }) => {
    expect(formatCounter(value)).toBe(expected);
  });

  it('どの値でも3文字になる', () => {
    for (let value = -150; value <= 1100; value += 1) {
      expect(formatCounter(value)).toHaveLength(3);
    }
  });
});

describe('litSegments', () => {
  it.each([
    { label: '0', character: '0', expected: 'abcdef' },
    { label: '1', character: '1', expected: 'bc' },
    { label: '2', character: '2', expected: 'abdeg' },
    { label: '3', character: '3', expected: 'abcdg' },
    { label: '4', character: '4', expected: 'bcfg' },
    { label: '5', character: '5', expected: 'acdfg' },
    { label: '6', character: '6', expected: 'acdefg' },
    { label: '7', character: '7', expected: 'abc' },
    { label: '8', character: '8', expected: 'abcdefg' },
    { label: '9', character: '9', expected: 'abcdfg' },
    { label: 'マイナス', character: '-', expected: 'g' },
  ])('$label：点灯するセグメントは $expected', ({ character, expected }) => {
    expect([...litSegments(character)].sort().join('')).toBe(expected);
  });

  it('formatCounterが出す文字は、すべて表にあり、互いに違う形になる', () => {
    const shapes = [...'0123456789-'].map((character) =>
      [...litSegments(character)].sort().join(''),
    );

    expect(shapes.every((shape) => shape.length > 0)).toBe(true);
    expect(new Set(shapes).size).toBe(shapes.length);
  });

  it('表にあるセグメントの名前は、SEGMENT_NAMESに含まれ、重複しない', () => {
    for (const character of '0123456789-') {
      const segments = litSegments(character);

      expect(new Set(segments).size).toBe(segments.length);
      for (const segment of segments) {
        expect(SEGMENT_NAMES).toContain(segment);
      }
    }
  });

  it.each([
    { label: '空文字', character: '' },
    { label: '空白', character: ' ' },
    { label: '英字', character: 'A' },
    { label: 'オブジェクトが元から持つ名前', character: 'constructor' },
  ])('表にない文字（$label）では、すべて消灯する', ({ character }) => {
    expect(litSegments(character)).toEqual([]);
  });
});

describe('faceFor', () => {
  it('最初のマスを開く前とプレイ中は、同じ通常の顔にする', () => {
    expect(faceFor('ready')).toBe('playing');
    expect(faceFor('playing')).toBe('playing');
  });

  it('勝ちと負けでは、それぞれの顔にする', () => {
    expect(faceFor('won')).toBe('won');
    expect(faceFor('lost')).toBe('lost');
  });
});

describe('statusMessageFor', () => {
  it('勝敗が決まるまでは、何も通知しない', () => {
    expect(statusMessageFor('ready')).toBe('');
    expect(statusMessageFor('playing')).toBe('');
  });

  it('勝ったときと負けたときは、それぞれの文言を通知する', () => {
    expect(statusMessageFor('won')).toBe('クリアしました');
    expect(statusMessageFor('lost')).toBe('機雷を踏みました');
  });
});
