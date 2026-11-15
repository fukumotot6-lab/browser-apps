import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { BoardConfig, Position } from '../../src/logic/index';
import {
  BEGINNER,
  cell,
  difficultyButton,
  expectBoard,
  INTERMEDIATE,
  minePositions,
  openedAfterFirst,
  openFirst,
  openSeededPage,
  resetButton,
} from './helpers';
import type { MineOracle } from './helpers';

// ほかのブラウザテストは「Node側で求めた機雷の位置が、ページの中の位置と同じ」ことを
// 前提にしている。その前提そのものを、最初にここで確かめる。

/** 1ゲームぶん、最初のマスを開いてから機雷を踏み、画面の機雷がNode側の予測と一致することを確かめる。 */
async function playUntilLostAndCompare(
  page: Page,
  oracle: MineOracle,
  config: BoardConfig,
  first: Position,
): Promise<void> {
  const layout = await openFirst(page, oracle, config, first);
  const [exploded] = minePositions(layout);
  if (exploded === undefined) {
    throw new Error('機雷のない盤面です');
  }
  await cell(page, exploded).click();

  await expect(resetButton(page)).toHaveAttribute('data-face', 'lost');
  await expectBoard(page, {
    layout,
    opened: openedAfterFirst(layout, first),
    exploded,
  });
}

test('Node側で求めた機雷の位置と、負けたとき画面に出る機雷の位置が一致する', async ({
  page,
}) => {
  const oracle = await openSeededPage(page, 20260101);

  await playUntilLostAndCompare(page, oracle, BEGINNER, { x: 4, y: 4 });
});

test('種が違えば、Node側の予測も画面の機雷も、その種の位置になる', async ({
  page,
}) => {
  const oracle = await openSeededPage(page, 7);

  await playUntilLostAndCompare(page, oracle, BEGINNER, { x: 0, y: 0 });
});

test('やり直しや難易度の切り替えのあとも、乱数列の続きから機雷の位置を予測できる', async ({
  page,
}) => {
  const oracle = await openSeededPage(page, 42);
  await playUntilLostAndCompare(page, oracle, BEGINNER, { x: 2, y: 6 });

  await resetButton(page).click();
  await playUntilLostAndCompare(page, oracle, BEGINNER, { x: 8, y: 0 });

  await difficultyButton(page, 'intermediate').click();
  await playUntilLostAndCompare(page, oracle, INTERMEDIATE, { x: 10, y: 3 });
});
