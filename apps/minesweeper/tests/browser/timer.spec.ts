import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  BEGINNER,
  cell,
  clickAll,
  difficultyButton,
  minePositions,
  openedAfterFirst,
  openFirst,
  openSeededPage,
  planWinningClicks,
  resetButton,
  timer,
} from './helpers';
import type { MineOracle } from './helpers';

const START = new Date('2026-01-01T00:00:00Z');
const PAUSED_AT = new Date('2026-01-01T01:00:00Z');

/**
 * 時計を止めたページを開く。以後、時間は runFor / fastForward でだけ進む。
 * 実際の経過時間に結果が左右されないようにするため。
 */
async function openPausedPage(page: Page, seed: number): Promise<MineOracle> {
  // ページのスクリプトが Date と setInterval を使う前に差し替える。
  await page.clock.install({ time: START });
  const oracle = await openSeededPage(page, seed);
  await page.clock.pauseAt(PAUSED_AT);
  return oracle;
}

async function expectTimer(page: Page, value: string): Promise<void> {
  await expect(timer(page)).toHaveAttribute('data-value', value);
}

test('最初は000で、時間がたっても、旗を立てても始まらない', async ({
  page,
}) => {
  await openPausedPage(page, 101);
  await expectTimer(page, '000');

  await page.clock.runFor(3000);
  await expectTimer(page, '000');

  await cell(page, { x: 2, y: 2 }).click({ button: 'right' });
  await page.clock.runFor(3000);
  await expectTimer(page, '000');
});

test('最初のマスを開いた時点で始まり、1秒後に001になる', async ({ page }) => {
  const oracle = await openPausedPage(page, 102);
  // 開く前に時間がたっていても、数えはじめるのは開いた時点から。
  await page.clock.runFor(5000);

  await openFirst(page, oracle, BEGINNER, { x: 4, y: 4 });
  await expectTimer(page, '000');

  await page.clock.runFor(999);
  await expectTimer(page, '000');

  await page.clock.runFor(1);
  await expectTimer(page, '001');

  await page.clock.runFor(1000);
  await expectTimer(page, '002');
});

test('2手目以降を開いても、数えなおさない', async ({ page }) => {
  const oracle = await openPausedPage(page, 103);
  const first = { x: 4, y: 4 };
  const layout = await openFirst(page, oracle, BEGINNER, first);
  const [next] = planWinningClicks(layout, openedAfterFirst(layout, first));
  if (next === undefined) {
    throw new Error('最初の一手で勝ってしまう盤面です');
  }

  await page.clock.runFor(2000);
  await cell(page, next).click();
  await page.clock.runFor(1000);

  await expectTimer(page, '003');
});

test('負けると止まり、値が残る', async ({ page }) => {
  const oracle = await openPausedPage(page, 104);
  const layout = await openFirst(page, oracle, BEGINNER, { x: 4, y: 4 });
  const [mine] = minePositions(layout);
  if (mine === undefined) {
    throw new Error('機雷のない盤面です');
  }
  await page.clock.runFor(2500);
  await expectTimer(page, '002');

  await cell(page, mine).click();
  await expect(resetButton(page)).toHaveAttribute('data-face', 'lost');
  await page.clock.runFor(5000);

  await expectTimer(page, '002');
});

test('勝つと止まり、値が残る', async ({ page }) => {
  const oracle = await openPausedPage(page, 105);
  const first = { x: 4, y: 4 };
  const layout = await openFirst(page, oracle, BEGINNER, first);
  const clicks = planWinningClicks(layout, openedAfterFirst(layout, first));
  const last = clicks.at(-1);
  if (last === undefined) {
    throw new Error('最初の一手で勝ってしまう盤面です');
  }
  await clickAll(page, clicks.slice(0, -1));
  await page.clock.runFor(3500);
  await expectTimer(page, '003');

  await cell(page, last).click();
  await expect(resetButton(page)).toHaveAttribute('data-face', 'won');
  await page.clock.runFor(5000);

  await expectTimer(page, '003');
});

test('999で止まり、それ以上は増えない', async ({ page }) => {
  const oracle = await openPausedPage(page, 106);
  await openFirst(page, oracle, BEGINNER, { x: 4, y: 4 });

  // 998.5秒まで一気に進める。1秒ずつ進めると時間がかかりすぎるため。
  await page.clock.fastForward(998_500);
  await expectTimer(page, '998');

  await page.clock.runFor(500);
  await expectTimer(page, '999');

  await page.clock.runFor(2000);
  await expectTimer(page, '999');
  await page.clock.fastForward('01:00:00');
  await page.clock.runFor(1000);
  await expectTimer(page, '999');
});

test('顔のボタンでやり直すと000に戻って止まり、次のゲームでまた0から数える', async ({
  page,
}) => {
  const oracle = await openPausedPage(page, 107);
  await openFirst(page, oracle, BEGINNER, { x: 4, y: 4 });
  await page.clock.runFor(3000);
  await expectTimer(page, '003');

  await resetButton(page).click();
  await expectTimer(page, '000');
  await page.clock.runFor(5000);
  await expectTimer(page, '000');

  await openFirst(page, oracle, BEGINNER, { x: 0, y: 0 });
  await expectTimer(page, '000');
  await page.clock.runFor(1000);
  await expectTimer(page, '001');
});

test('難易度を切り替えると000に戻って止まる', async ({ page }) => {
  const oracle = await openPausedPage(page, 108);
  await openFirst(page, oracle, BEGINNER, { x: 4, y: 4 });
  await page.clock.runFor(3000);
  await expectTimer(page, '003');

  await difficultyButton(page, 'intermediate').click();
  await expectTimer(page, '000');
  await page.clock.runFor(5000);
  await expectTimer(page, '000');
});

test('負けて止まったあと、顔のボタンでやり直すと000に戻る', async ({
  page,
}) => {
  const oracle = await openPausedPage(page, 109);
  const layout = await openFirst(page, oracle, BEGINNER, { x: 4, y: 4 });
  const [mine] = minePositions(layout);
  if (mine === undefined) {
    throw new Error('機雷のない盤面です');
  }
  await page.clock.runFor(4000);
  await cell(page, mine).click();
  await expectTimer(page, '004');

  await resetButton(page).click();

  await expectTimer(page, '000');
});
