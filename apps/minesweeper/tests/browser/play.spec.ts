import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Position } from '../../src/logic/index';
import {
  adjacentMines,
  allPositions,
  BEGINNER,
  cell,
  chooseFirstMove,
  chordAndHold,
  clickAll,
  expectBoard,
  flagAll,
  hasMine,
  indexOf,
  mineCounter,
  minePositions,
  moveTo,
  neighbours,
  openedAfterFirst,
  openFirst,
  openSeededPage,
  planWinningClicks,
  positionOf,
  releaseRemaining,
  resetButton,
  statusMessage,
  toIndexSet,
} from './helpers';
import type { BoardExpectation, Layout } from './helpers';

/** 機雷のない、まだ開いていないマスを1つ選ぶ。 */
function hiddenSafeCell(layout: Layout, opened: ReadonlySet<number>): Position {
  const found = allPositions(layout.config).find(
    (p) => !hasMine(layout, p) && !opened.has(indexOf(layout.config, p)),
  );
  if (found === undefined) {
    throw new Error('閉じた安全なマスがありません');
  }
  return found;
}

/** 開いている数字のマスを1つ選ぶ。 */
function openNumberCell(layout: Layout, opened: ReadonlySet<number>): Position {
  const found = [...opened]
    .map((index) => positionOf(layout.config, index))
    .find((p) => adjacentMines(layout, p) > 0);
  if (found === undefined) {
    throw new Error('開いた数字のマスがありません');
  }
  return found;
}

/**
 * 勝敗が決まったあとの盤面に、ひととおりの操作をしても、何も変わらないことを確かめる。
 * 開く・旗・周囲を開く（中クリックと両クリック）を、ひととおり試す。
 */
async function expectBoardIgnoresInput(
  page: Page,
  expectation: BoardExpectation,
  targets: { readonly hidden: Position; readonly openNumber: Position },
  counterValue: string,
  face: string,
): Promise<void> {
  await cell(page, targets.hidden).click();
  await cell(page, targets.hidden).click({ button: 'right' });
  await cell(page, targets.openNumber).click({ button: 'middle' });
  await chordAndHold(page, targets.openNumber, 'right');
  await releaseRemaining(page, 'right');

  await expectBoard(page, expectation);
  await expect(mineCounter(page)).toHaveAttribute('data-value', counterValue);
  await expect(resetButton(page)).toHaveAttribute('data-face', face);
}

test.describe('マスを開く', () => {
  test('左ボタンを押しただけでは開かず、離したときに開く', async ({ page }) => {
    await openSeededPage(page, 11);
    const target = { x: 3, y: 5 };

    await moveTo(page, target);
    await page.mouse.down({ button: 'left' });
    await expect(cell(page, target)).toHaveAttribute('data-kind', 'hidden');

    await page.mouse.up({ button: 'left' });
    await expect(cell(page, target)).toHaveAttribute('data-kind', 'open');
  });

  test('数字のマスを開くと、そのマスだけが開き、周囲の機雷の数が出る', async ({
    page,
  }) => {
    const oracle = await openSeededPage(page, 12);
    const { first } = chooseFirstMove(
      oracle,
      BEGINNER,
      (layout, position) => adjacentMines(layout, position) >= 2,
    );

    const layout = await openFirst(page, oracle, BEGINNER, first);

    const count = String(adjacentMines(layout, first));
    await expect(cell(page, first)).toHaveAttribute('data-kind', 'open');
    await expect(cell(page, first)).toHaveAttribute('data-adjacent', count);
    await expect(cell(page, first)).toHaveText(count);
    await expectBoard(page, {
      layout,
      opened: new Set([indexOf(BEGINNER, first)]),
    });
    await expect(resetButton(page)).toHaveAttribute('data-face', 'playing');
    await expect(statusMessage(page)).toHaveText('');
  });

  test('0のマスを開くと空白が広がり、縁に数字のマスが並ぶ', async ({
    page,
  }) => {
    const oracle = await openSeededPage(page, 13);
    const { first } = chooseFirstMove(
      oracle,
      BEGINNER,
      (layout, position) => adjacentMines(layout, position) === 0,
    );

    const layout = await openFirst(page, oracle, BEGINNER, first);

    const opened = openedAfterFirst(layout, first);
    // 0のマスの周囲8マスまでは必ず開くので、1マスだけで終わることはない。
    expect(opened.size).toBeGreaterThan(3);
    await expect(cell(page, first)).toHaveAttribute('data-adjacent', '0');
    await expect(cell(page, first)).toHaveText('');
    await expectBoard(page, { layout, opened });
  });

  test('最初に開くマスは、どこを選んでも機雷ではない', async ({ page }) => {
    const oracle = await openSeededPage(page, 14);

    // 1つの種でも、やり直すたびに乱数列の続きから別の配置になる。
    const firsts = allPositions(BEGINNER).filter((_, index) => index % 7 === 0);
    for (const first of firsts) {
      const layout = await openFirst(page, oracle, BEGINNER, first);
      await expectBoard(page, {
        layout,
        opened: openedAfterFirst(layout, first),
      });
      await expect(resetButton(page)).toHaveAttribute('data-face', 'playing');
      await resetButton(page).click();
    }
  });
});

test.describe('旗', () => {
  test('右ボタンを押した時点で旗が立ち、もう一度押すと外れる', async ({
    page,
  }) => {
    const oracle = await openSeededPage(page, 21);
    const first = { x: 0, y: 0 };
    const layout = await openFirst(page, oracle, BEGINNER, first);
    const target = hiddenSafeCell(layout, openedAfterFirst(layout, first));

    await moveTo(page, target);
    await page.mouse.down({ button: 'right' });
    await expect(cell(page, target)).toHaveAttribute('data-kind', 'flag');
    await expect(mineCounter(page)).toHaveAttribute('data-value', '009');

    // 離したときには切り替わらない。
    await page.mouse.up({ button: 'right' });
    await expect(cell(page, target)).toHaveAttribute('data-kind', 'flag');

    await cell(page, target).click({ button: 'right' });
    await expect(cell(page, target)).toHaveAttribute('data-kind', 'hidden');
    await expect(mineCounter(page)).toHaveAttribute('data-value', '010');
  });

  test('開いたマスを右クリックしても、旗は立たない', async ({ page }) => {
    const oracle = await openSeededPage(page, 22);
    const first = { x: 4, y: 4 };
    const layout = await openFirst(page, oracle, BEGINNER, first);

    await cell(page, first).click({ button: 'right' });

    await expectBoard(page, {
      layout,
      opened: openedAfterFirst(layout, first),
    });
    await expect(mineCounter(page)).toHaveAttribute('data-value', '010');
  });

  test('最初のマスを開く前でも旗を立てられ、そのマスは左クリックしても開かない', async ({
    page,
  }) => {
    await openSeededPage(page, 23);
    const target = { x: 6, y: 2 };

    await cell(page, target).click({ button: 'right' });
    await expect(cell(page, target)).toHaveAttribute('data-kind', 'flag');
    await expect(mineCounter(page)).toHaveAttribute('data-value', '009');

    await cell(page, target).click();
    await expect(cell(page, target)).toHaveAttribute('data-kind', 'flag');
    await expect(
      page.locator('[data-testid="board"] > div.cell[data-kind="open"]'),
    ).toHaveCount(0);
  });

  test('プレイ中に旗を立てたマスは、左クリックしても開かない', async ({
    page,
  }) => {
    const oracle = await openSeededPage(page, 24);
    const first = { x: 8, y: 8 };
    const layout = await openFirst(page, oracle, BEGINNER, first);
    const opened = openedAfterFirst(layout, first);
    const target = hiddenSafeCell(layout, opened);

    await cell(page, target).click({ button: 'right' });
    await cell(page, target).click();

    await expectBoard(page, {
      layout,
      opened,
      flags: toIndexSet(BEGINNER, [target]),
    });
  });

  test('最初のマスを開く前に立てた旗は、開いたあとも残る', async ({ page }) => {
    const oracle = await openSeededPage(page, 25);
    const flagged = { x: 0, y: 0 };
    const first = { x: 8, y: 8 };
    const flags = toIndexSet(BEGINNER, [flagged]);

    await cell(page, flagged).click({ button: 'right' });
    const layout = await openFirst(page, oracle, BEGINNER, first);

    await expectBoard(page, {
      layout,
      opened: openedAfterFirst(layout, first, flags),
      flags,
    });
    await expect(mineCounter(page)).toHaveAttribute('data-value', '009');
  });

  test('旗を機雷の数より多く立てると、残り機雷数がマイナスで表示される', async ({
    page,
  }) => {
    await openSeededPage(page, 26);
    const targets = allPositions(BEGINNER).slice(0, 15);

    await flagAll(page, targets.slice(0, 10));
    await expect(mineCounter(page)).toHaveAttribute('data-value', '000');

    await flagAll(page, targets.slice(10, 11));
    await expect(mineCounter(page)).toHaveAttribute('data-value', '-01');

    await flagAll(page, targets.slice(11, 15));
    await expect(mineCounter(page)).toHaveAttribute('data-value', '-05');
    await expect(
      page.locator('[data-testid="board"] > div.cell[data-kind="flag"]'),
    ).toHaveCount(15);
  });

  test('空白の広がりは旗のマスを開かず、旗の先へも広がらない', async ({
    page,
  }) => {
    const oracle = await openSeededPage(page, 27);

    /** 旗を立てると広がりが実際に狭まる（旗の先に開かないマスが残る）0のマスを探す。 */
    function findBlockingFlag(
      layout: Layout,
      first: Position,
    ): Position | undefined {
      if (adjacentMines(layout, first) !== 0) {
        return undefined;
      }
      const full = openedAfterFirst(layout, first);
      return [...full]
        .map((index) => positionOf(BEGINNER, index))
        .find((candidate) => {
          const isFirst = candidate.x === first.x && candidate.y === first.y;
          const blocked = openedAfterFirst(
            layout,
            first,
            toIndexSet(BEGINNER, [candidate]),
          );
          return (
            !isFirst &&
            adjacentMines(layout, candidate) === 0 &&
            blocked.size < full.size - 1
          );
        });
    }

    const { first, layout: preview } = chooseFirstMove(
      oracle,
      BEGINNER,
      (layout, position) => findBlockingFlag(layout, position) !== undefined,
    );
    const flagged = findBlockingFlag(preview, first);
    if (flagged === undefined) {
      throw new Error('旗を立てるマスが見つかりません');
    }
    const flags = toIndexSet(BEGINNER, [flagged]);

    await cell(page, flagged).click({ button: 'right' });
    const layout = await openFirst(page, oracle, BEGINNER, first);

    await expectBoard(page, {
      layout,
      opened: openedAfterFirst(layout, first, flags),
      flags,
    });
  });
});

test.describe('右クリックのメニュー', () => {
  /** ページ全体で contextmenu を受け、既定の動作が止められていたかを html 要素の属性に残す。 */
  async function recordContextMenu(page: Page): Promise<void> {
    await page.evaluate(() => {
      // パネルの処理より後に呼ばれるよう、外側の window で受ける。
      window.addEventListener('contextmenu', (event) => {
        document.documentElement.setAttribute(
          'data-contextmenu-prevented',
          String(event.defaultPrevented),
        );
      });
    });
  }

  test('マスを右クリックしても、ブラウザのメニューが出ない', async ({
    page,
  }) => {
    await openSeededPage(page, 31);
    await recordContextMenu(page);

    await cell(page, { x: 4, y: 4 }).click({ button: 'right' });

    await expect(page.locator('html')).toHaveAttribute(
      'data-contextmenu-prevented',
      'true',
    );
  });

  test('パネルのマス以外の場所を右クリックしても、ブラウザのメニューが出ない', async ({
    page,
  }) => {
    await openSeededPage(page, 32);
    await recordContextMenu(page);

    await mineCounter(page).click({ button: 'right' });

    await expect(page.locator('html')).toHaveAttribute(
      'data-contextmenu-prevented',
      'true',
    );
  });
});

test.describe('負け', () => {
  test('機雷を踏むと、踏んだ機雷・ほかの機雷・誤った旗が区別して表示される', async ({
    page,
  }) => {
    const oracle = await openSeededPage(page, 41);
    const first = { x: 4, y: 4 };
    const layout = await openFirst(page, oracle, BEGINNER, first);
    const opened = openedAfterFirst(layout, first);
    const [exploded, flaggedMine] = minePositions(layout);
    if (exploded === undefined || flaggedMine === undefined) {
      throw new Error('機雷が足りません');
    }
    const wrongFlag = hiddenSafeCell(layout, opened);
    const flags = toIndexSet(BEGINNER, [flaggedMine, wrongFlag]);

    await flagAll(page, [flaggedMine, wrongFlag]);
    await cell(page, exploded).click();

    await expect(resetButton(page)).toHaveAttribute('data-face', 'lost');
    await expect(statusMessage(page)).toHaveText('機雷を踏みました');
    await expect(cell(page, exploded)).toHaveAttribute(
      'data-kind',
      'exploded-mine',
    );
    await expect(cell(page, flaggedMine)).toHaveAttribute('data-kind', 'flag');
    await expect(cell(page, wrongFlag)).toHaveAttribute(
      'data-kind',
      'wrong-flag',
    );
    await expectBoard(page, { layout, opened, flags, exploded });
    await expect(mineCounter(page)).toHaveAttribute('data-value', '008');
  });

  test('負けたあとは、盤面を操作しても何も変わらない', async ({ page }) => {
    const oracle = await openSeededPage(page, 42);
    const { first } = chooseFirstMove(oracle, BEGINNER, (layout, position) => {
      const count = adjacentMines(layout, position);
      return count >= 1 && count <= 3;
    });
    const layout = await openFirst(page, oracle, BEGINNER, first);
    const opened = openedAfterFirst(layout, first);
    // 数字のマスの周囲の機雷に旗を立てておく。プレイ中なら、周囲を開く操作が効く状態にするため。
    const around = neighbours(BEGINNER, first);
    const flagged = around.filter((p) => hasMine(layout, p));
    const flags = toIndexSet(BEGINNER, flagged);
    const exploded = minePositions(layout).find(
      (mine) => !flags.has(indexOf(BEGINNER, mine)),
    );
    if (exploded === undefined) {
      throw new Error('踏む機雷がありません');
    }
    await flagAll(page, flagged);
    await cell(page, exploded).click();
    await expect(resetButton(page)).toHaveAttribute('data-face', 'lost');

    await expectBoardIgnoresInput(
      page,
      { layout, opened, flags, exploded },
      { hidden: hiddenSafeCell(layout, opened), openNumber: first },
      String(BEGINNER.mineCount - flagged.length).padStart(3, '0'),
      'lost',
    );
  });

  test('負けたあと、顔のボタンでやり直せる', async ({ page }) => {
    const oracle = await openSeededPage(page, 43);
    const first = { x: 1, y: 1 };
    const layout = await openFirst(page, oracle, BEGINNER, first);
    const [exploded] = minePositions(layout);
    if (exploded === undefined) {
      throw new Error('機雷のない盤面です');
    }
    await cell(page, exploded).click();
    await expect(resetButton(page)).toHaveAttribute('data-face', 'lost');

    await resetButton(page).click();

    await expect(resetButton(page)).toHaveAttribute('data-face', 'playing');
    await expect(statusMessage(page)).toHaveText('');
    await expect(
      page.locator('[data-testid="board"] > div.cell[data-kind="hidden"]'),
    ).toHaveCount(81);
    const next = await openFirst(page, oracle, BEGINNER, exploded);
    await expectBoard(page, {
      layout: next,
      opened: openedAfterFirst(next, exploded),
    });
  });
});

test.describe('勝ち', () => {
  test('機雷以外をすべて開くと勝ちになり、すべての機雷に旗が出て、残り機雷数が000になる', async ({
    page,
  }) => {
    const oracle = await openSeededPage(page, 51);
    const first = { x: 4, y: 4 };
    const layout = await openFirst(page, oracle, BEGINNER, first);
    const opened = openedAfterFirst(layout, first);
    const clicks = planWinningClicks(layout, opened);
    const last = clicks.at(-1);
    if (last === undefined) {
      throw new Error('最初の一手で勝ってしまう盤面です');
    }

    await clickAll(page, clicks.slice(0, -1));
    // 最後の1手の前は、まだプレイ中で、旗を立てていないので残り機雷数は減っていない。
    await expect(resetButton(page)).toHaveAttribute('data-face', 'playing');
    await expect(mineCounter(page)).toHaveAttribute('data-value', '010');
    await expect(statusMessage(page)).toHaveText('');

    await cell(page, last).click();

    await expect(resetButton(page)).toHaveAttribute('data-face', 'won');
    await expect(statusMessage(page)).toHaveText('クリアしました');
    await expect(mineCounter(page)).toHaveAttribute('data-value', '000');
    await expectBoard(page, { layout, opened, isWon: true });
  });

  test('勝ったあとは、盤面を操作しても何も変わらない', async ({ page }) => {
    const oracle = await openSeededPage(page, 52);
    const first = { x: 0, y: 8 };
    const layout = await openFirst(page, oracle, BEGINNER, first);
    const opened = openedAfterFirst(layout, first);
    await clickAll(page, planWinningClicks(layout, opened));
    await expect(resetButton(page)).toHaveAttribute('data-face', 'won');
    const [mine] = minePositions(layout);
    if (mine === undefined) {
      throw new Error('機雷のない盤面です');
    }

    // 勝ったあとの機雷は旗の表示。左クリックで踏めず、右クリックで旗も外れないこと。
    await expectBoardIgnoresInput(
      page,
      { layout, opened, isWon: true },
      { hidden: mine, openNumber: openNumberCell(layout, opened) },
      '000',
      'won',
    );
  });
});
