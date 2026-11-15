import { expect, test } from '@playwright/test';
import {
  adjacentMines,
  BEGINNER,
  cell,
  chooseFirstMove,
  chordAndHold,
  difficultyButton,
  flagAll,
  hasMine,
  INTERMEDIATE,
  minePositions,
  neighbours,
  openFirst,
  openSeededPage,
  ORIGIN,
  releaseRemaining,
  resetButton,
  statusMessage,
  winGame,
} from './helpers';

test('ページの題名は「マインスイーパー」', async ({ page }) => {
  await openSeededPage(page, 201);

  await expect(page).toHaveTitle('マインスイーパー');
});

test('画面の部品が、取り決めどおりの属性を持つ', async ({ page }) => {
  await openSeededPage(page, 202);

  await expect(page.locator('[data-testid="game"]')).toBeVisible();
  await expect(resetButton(page)).toHaveAttribute(
    'aria-label',
    '新しいゲームを始める',
  );
  await expect(resetButton(page)).toHaveAttribute('data-face', 'playing');
  await expect(statusMessage(page)).toHaveAttribute('role', 'status');
  await expect(statusMessage(page)).toHaveText('');
  // display:none にすると、スクリーンリーダーが通知を読み上げなくなる。
  await expect(statusMessage(page)).not.toHaveCSS('display', 'none');
  await expect(statusMessage(page)).not.toHaveCSS('visibility', 'hidden');
});

test('一連のプレイを通して、エラーが出ず、配信元以外へのリクエストも発生しない', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const requestUrls: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });
  page.on('request', (request) => {
    requestUrls.push(request.url());
  });

  const oracle = await openSeededPage(page, 203);

  // 1ゲーム目：旗、開く、両クリック、中クリックを使ってから、機雷を踏んで負ける。
  const { first } = chooseFirstMove(
    oracle,
    BEGINNER,
    (layout, position) => adjacentMines(layout, position) === 1,
  );
  const lostLayout = await openFirst(page, oracle, BEGINNER, first);
  await flagAll(
    page,
    neighbours(BEGINNER, first).filter((p) => hasMine(lostLayout, p)),
  );
  await chordAndHold(page, first, 'right');
  await releaseRemaining(page, 'right');
  await cell(page, first).click({ button: 'middle' });
  await expect(resetButton(page)).toHaveAttribute('data-face', 'playing');
  const unflaggedMine = minePositions(lostLayout).find(
    (mine) =>
      !neighbours(BEGINNER, first).some(
        (p) => p.x === mine.x && p.y === mine.y,
      ),
  );
  if (unflaggedMine === undefined) {
    throw new Error('踏む機雷がありません');
  }
  await cell(page, unflaggedMine).click();
  await expect(resetButton(page)).toHaveAttribute('data-face', 'lost');

  // 2ゲーム目：顔のボタンでやり直して勝つ。
  await resetButton(page).click();
  const wonFirst = { x: 4, y: 4 };
  const wonLayout = await openFirst(page, oracle, BEGINNER, wonFirst);
  await winGame(page, wonLayout, wonFirst);
  await expect(resetButton(page)).toHaveAttribute('data-face', 'won');

  // 難易度を切り替えて、それぞれ1マス開く。
  await difficultyButton(page, 'intermediate').click();
  await openFirst(page, oracle, INTERMEDIATE, { x: 0, y: 0 });
  await difficultyButton(page, 'expert').click();
  await cell(page, { x: 29, y: 15 }).click();
  await expect(cell(page, { x: 29, y: 15 })).toHaveAttribute(
    'data-kind',
    'open',
  );

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
  // 記録そのものが働いていることを確かめる。少なくともページ本体は取得している。
  expect(requestUrls).toContain(`${ORIGIN}/`);
  expect(requestUrls.filter((url) => new URL(url).origin !== ORIGIN)).toEqual(
    [],
  );
});
