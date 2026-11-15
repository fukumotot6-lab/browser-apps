import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { BoardConfig } from '../../src/logic/index';
import {
  BEGINNER,
  board,
  cells,
  difficultyButton,
  EXPERT,
  expectBoard,
  INTERMEDIATE,
  mineCounter,
  openedAfterFirst,
  openFirst,
  openSeededPage,
  resetButton,
  timer,
} from './helpers';

type DifficultyId = 'beginner' | 'intermediate' | 'expert';

const DIFFICULTY_IDS: readonly DifficultyId[] = [
  'beginner',
  'intermediate',
  'expert',
];

function counterText(config: BoardConfig): string {
  return String(config.mineCount).padStart(3, '0');
}

/** まだ1マスも開いていない、指定の難易度の新しいゲームになっていることを確かめる。 */
async function expectNewGame(
  page: Page,
  selected: DifficultyId,
  config: BoardConfig,
): Promise<void> {
  for (const id of DIFFICULTY_IDS) {
    await expect(difficultyButton(page, id)).toHaveAttribute(
      'aria-pressed',
      String(id === selected),
    );
  }
  await expect(board(page)).toHaveAttribute('data-width', String(config.width));
  await expect(board(page)).toHaveAttribute(
    'data-height',
    String(config.height),
  );
  await expect(cells(page)).toHaveCount(config.width * config.height);
  await expect(
    page.locator('[data-testid="board"] > div.cell[data-kind="hidden"]'),
  ).toHaveCount(config.width * config.height);
  await expect(mineCounter(page)).toHaveAttribute(
    'data-value',
    counterText(config),
  );
  await expect(timer(page)).toHaveAttribute('data-value', '000');
  await expect(resetButton(page)).toHaveAttribute('data-face', 'playing');
}

test('起動時は初級（9×9、機雷10）で、すべてのマスが閉じている', async ({
  page,
}) => {
  await openSeededPage(page, 1);

  await expectNewGame(page, 'beginner', BEGINNER);
});

test('難易度ボタンには、初級・中級・上級の文言が出る', async ({ page }) => {
  await openSeededPage(page, 1);

  await expect(difficultyButton(page, 'beginner')).toHaveText('初級');
  await expect(difficultyButton(page, 'intermediate')).toHaveText('中級');
  await expect(difficultyButton(page, 'expert')).toHaveText('上級');
});

test('マスは、盤面の直下に行優先（左から右、上から下）で並ぶ', async ({
  page,
}) => {
  await openSeededPage(page, 1);
  await difficultyButton(page, 'expert').click();
  await expect(cells(page)).toHaveCount(EXPERT.width * EXPERT.height);

  const coordinates = await cells(page).evaluateAll((elements) =>
    elements.map(
      (element) =>
        `${String(element.getAttribute('data-x'))},${String(element.getAttribute('data-y'))}`,
    ),
  );

  const expected: string[] = [];
  for (let y = 0; y < EXPERT.height; y += 1) {
    for (let x = 0; x < EXPERT.width; x += 1) {
      expected.push(`${String(x)},${String(y)}`);
    }
  }
  expect(coordinates).toEqual(expected);
});

test('中級のボタンを押すと、16×16・機雷40の新しいゲームになる', async ({
  page,
}) => {
  await openSeededPage(page, 1);

  await difficultyButton(page, 'intermediate').click();

  await expectNewGame(page, 'intermediate', INTERMEDIATE);
});

test('上級のボタンを押すと、30×16・機雷99の新しいゲームになり、マスを開ける', async ({
  page,
}) => {
  const oracle = await openSeededPage(page, 3);

  await difficultyButton(page, 'expert').click();
  await expectNewGame(page, 'expert', EXPERT);

  const first = { x: 29, y: 15 };
  const layout = await openFirst(page, oracle, EXPERT, first);
  await expectBoard(page, { layout, opened: openedAfterFirst(layout, first) });
  await expect(mineCounter(page)).toHaveAttribute('data-value', '099');
});

test('プレイの途中で難易度ボタンを押すと、その難易度の新しいゲームになる', async ({
  page,
}) => {
  const oracle = await openSeededPage(page, 5);
  await difficultyButton(page, 'expert').click();
  await openFirst(page, oracle, EXPERT, { x: 0, y: 0 });
  await page
    .locator('[data-testid="board"] > div.cell[data-kind="hidden"]')
    .first()
    .click({ button: 'right' });
  await expect(mineCounter(page)).toHaveAttribute('data-value', '098');

  await difficultyButton(page, 'beginner').click();

  await expectNewGame(page, 'beginner', BEGINNER);
});

test('選択中の難易度のボタンを押しても、同じ難易度の新しいゲームになる', async ({
  page,
}) => {
  const oracle = await openSeededPage(page, 5);
  await openFirst(page, oracle, BEGINNER, { x: 4, y: 4 });

  await difficultyButton(page, 'beginner').click();

  await expectNewGame(page, 'beginner', BEGINNER);
});

test('顔のボタンを押すと、同じ難易度のまま新しいゲームになる', async ({
  page,
}) => {
  const oracle = await openSeededPage(page, 9);
  await difficultyButton(page, 'intermediate').click();
  const first = { x: 8, y: 8 };
  const layout = await openFirst(page, oracle, INTERMEDIATE, first);
  await expectBoard(page, { layout, opened: openedAfterFirst(layout, first) });

  await resetButton(page).click();

  await expectNewGame(page, 'intermediate', INTERMEDIATE);
});
