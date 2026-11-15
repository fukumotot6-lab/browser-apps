import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/logic';
import { DEFAULT_DIFFICULTY, DIFFICULTIES } from '../../src/ui/difficulty';

describe('DIFFICULTIES', () => {
  it('初級・中級・上級の順に並ぶ', () => {
    expect(DIFFICULTIES.map((difficulty) => difficulty.id)).toEqual([
      'beginner',
      'intermediate',
      'expert',
    ]);
    expect(DIFFICULTIES.map((difficulty) => difficulty.label)).toEqual([
      '初級',
      '中級',
      '上級',
    ]);
  });

  it.each([
    { label: '初級', id: 'beginner', width: 9, height: 9, mineCount: 10 },
    { label: '中級', id: 'intermediate', width: 16, height: 16, mineCount: 40 },
    { label: '上級', id: 'expert', width: 30, height: 16, mineCount: 99 },
  ])(
    '$label：盤面の大きさと機雷数が決まった値になっている',
    ({ label, id, width, height, mineCount }) => {
      const difficulty = DIFFICULTIES.find((candidate) => candidate.id === id);

      expect(difficulty?.label).toBe(label);
      expect(difficulty?.config).toEqual({ width, height, mineCount });
    },
  );

  it('どの難易度の設定でも、ゲームを作れる', () => {
    for (const difficulty of DIFFICULTIES) {
      expect(createGame(difficulty.config).status).toBe('ready');
    }
  });
});

describe('DEFAULT_DIFFICULTY', () => {
  it('起動時の難易度は初級', () => {
    expect(DEFAULT_DIFFICULTY.id).toBe('beginner');
    expect(DIFFICULTIES).toContain(DEFAULT_DIFFICULTY);
  });
});
