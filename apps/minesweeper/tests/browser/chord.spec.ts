import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Position } from '../../src/logic/index';
import {
  adjacentMines,
  BEGINNER,
  cell,
  chooseFirstMove,
  chordAndHold,
  expectBoard,
  flagAll,
  hasMine,
  indexOf,
  mineCounter,
  moveTo,
  neighbours,
  openFirst,
  openSeededPage,
  releaseRemaining,
  resetButton,
  reveal,
  statusMessage,
  toIndexSet,
} from './helpers';
import type {
  BoardExpectation,
  Layout,
  MineOracle,
  SideButton,
} from './helpers';

// 最初の一手に数字のマスを選ぶと、開いているのはそのマスだけで、周囲はすべて閉じている。
// 周囲を開く操作の結果を、ほかの開いたマスに邪魔されずに確かめられる。

interface NumberStart {
  readonly layout: Layout;
  /** 最初に開いた数字のマス。 */
  readonly number: Position;
  readonly mineNeighbours: readonly Position[];
  readonly safeNeighbours: readonly Position[];
}

/** 周囲の機雷が `mineCount` 個で、安全なマスも周囲に2つ以上ある数字のマスから始める。 */
async function startOnNumber(
  page: Page,
  oracle: MineOracle,
  mineCount: number,
): Promise<NumberStart> {
  const { first } = chooseFirstMove(oracle, BEGINNER, (layout, position) => {
    const around = neighbours(BEGINNER, position);
    return (
      adjacentMines(layout, position) === mineCount &&
      around.length - mineCount >= 2
    );
  });
  const layout = await openFirst(page, oracle, BEGINNER, first);
  const around = neighbours(BEGINNER, first);
  return {
    layout,
    number: first,
    mineNeighbours: around.filter((p) => hasMine(layout, p)),
    safeNeighbours: around.filter((p) => !hasMine(layout, p)),
  };
}

/** 数字のマスだけが開き、指定の旗が立っている状態。 */
function beforeChord(
  start: NumberStart,
  flagged: readonly Position[],
): BoardExpectation {
  return {
    layout: start.layout,
    opened: new Set([indexOf(BEGINNER, start.number)]),
    flags: toIndexSet(BEGINNER, flagged),
  };
}

/** 周囲の機雷すべてに旗を立てて、周囲を開いたあとの状態。 */
function afterChord(start: NumberStart): BoardExpectation {
  const flags = toIndexSet(BEGINNER, start.mineNeighbours);
  const opened = new Set([indexOf(BEGINNER, start.number)]);
  for (const position of start.safeNeighbours) {
    reveal(start.layout, opened, position, flags);
  }
  return { layout: start.layout, opened, flags };
}

const RELEASE_ORDERS: readonly {
  readonly releaseFirst: SideButton;
  readonly label: string;
}[] = [
  { releaseFirst: 'right', label: '右を先に離す' },
  { releaseFirst: 'left', label: '左を先に離す' },
];

for (const { releaseFirst, label } of RELEASE_ORDERS) {
  test.describe(`両クリック（${label}）`, () => {
    test('周囲の旗の数が数字と同じなら、片方を離したときに周囲の閉じたマスをまとめて開く', async ({
      page,
    }) => {
      const oracle = await openSeededPage(page, 61);
      const start = await startOnNumber(page, oracle, 2);
      await flagAll(page, start.mineNeighbours);

      await moveTo(page, start.number);
      await page.mouse.down({ button: 'left' });
      await page.mouse.down({ button: 'right' });
      // 両方を押しただけでは、まだ開かない。
      await expectBoard(page, beforeChord(start, start.mineNeighbours));

      await page.mouse.up({ button: releaseFirst });
      await expectBoard(page, afterChord(start));
      await expect(resetButton(page)).toHaveAttribute('data-face', 'playing');

      await releaseRemaining(page, releaseFirst);
      await expectBoard(page, afterChord(start));
      await expect(mineCounter(page)).toHaveAttribute('data-value', '008');
    });

    test('周囲の旗の数が数字と合わなければ、何も起きない', async ({ page }) => {
      const oracle = await openSeededPage(page, 62);
      const start = await startOnNumber(page, oracle, 2);
      const [oneMine] = start.mineNeighbours;
      const [oneSafe] = start.safeNeighbours;
      if (oneMine === undefined || oneSafe === undefined) {
        throw new Error('周囲のマスが足りません');
      }

      // 旗が少ない場合。
      await flagAll(page, [oneMine]);
      await chordAndHold(page, start.number, releaseFirst);
      await releaseRemaining(page, releaseFirst);
      await expectBoard(page, beforeChord(start, [oneMine]));

      // 旗が多い場合。
      const tooMany = [...start.mineNeighbours, oneSafe];
      await flagAll(page, [...start.mineNeighbours.slice(1), oneSafe]);
      await chordAndHold(page, start.number, releaseFirst);
      await releaseRemaining(page, releaseFirst);
      await expectBoard(page, beforeChord(start, tooMany));
      await expect(resetButton(page)).toHaveAttribute('data-face', 'playing');
    });

    test('閉じたマスの上で両クリックしても、開かず、旗も立たない', async ({
      page,
    }) => {
      const oracle = await openSeededPage(page, 63);
      const start = await startOnNumber(page, oracle, 1);
      const [hidden] = start.safeNeighbours;
      if (hidden === undefined) {
        throw new Error('周囲に安全なマスがありません');
      }

      await chordAndHold(page, hidden, releaseFirst);
      await expectBoard(page, beforeChord(start, []));

      // 残った片方を離しても、左クリックや右クリックとしては扱われない。
      await releaseRemaining(page, releaseFirst);
      await expectBoard(page, beforeChord(start, []));
      await expect(mineCounter(page)).toHaveAttribute('data-value', '010');
    });

    test('両クリックのあと、残った片方を別の閉じたマスの上で離しても、何も起きない', async ({
      page,
    }) => {
      const oracle = await openSeededPage(page, 64);
      const start = await startOnNumber(page, oracle, 1);
      const [hidden] = start.safeNeighbours;
      if (hidden === undefined) {
        throw new Error('周囲に安全なマスがありません');
      }

      // 旗がないので、この両クリックでは何も開かない。
      await chordAndHold(page, start.number, releaseFirst);
      await moveTo(page, hidden);
      await releaseRemaining(page, releaseFirst);

      await expectBoard(page, beforeChord(start, []));
      await expect(mineCounter(page)).toHaveAttribute('data-value', '010');
    });
  });
}

test.describe('中クリック', () => {
  test('周囲の旗の数が数字と同じなら、周囲の閉じたマスをまとめて開く', async ({
    page,
  }) => {
    const oracle = await openSeededPage(page, 71);
    const start = await startOnNumber(page, oracle, 3);
    await flagAll(page, start.mineNeighbours);

    await cell(page, start.number).click({ button: 'middle' });

    await expectBoard(page, afterChord(start));
    await expect(resetButton(page)).toHaveAttribute('data-face', 'playing');
  });

  test('周囲の旗の数が数字と合わなければ、何も起きない', async ({ page }) => {
    const oracle = await openSeededPage(page, 72);
    const start = await startOnNumber(page, oracle, 2);
    const [oneMine] = start.mineNeighbours;
    if (oneMine === undefined) {
      throw new Error('周囲に機雷がありません');
    }
    await flagAll(page, [oneMine]);

    await cell(page, start.number).click({ button: 'middle' });

    await expectBoard(page, beforeChord(start, [oneMine]));
  });

  test('閉じたマスを中クリックしても、何も起きない', async ({ page }) => {
    const oracle = await openSeededPage(page, 73);
    const start = await startOnNumber(page, oracle, 1);
    const [hidden] = start.safeNeighbours;
    if (hidden === undefined) {
      throw new Error('周囲に安全なマスがありません');
    }

    await cell(page, hidden).click({ button: 'middle' });

    await expectBoard(page, beforeChord(start, []));
  });
});

test.describe('誤った旗で周囲を開く', () => {
  /** 数字1のマスの周囲で、機雷ではないマスに旗を立てる。周囲を開くと、旗のない機雷を踏む。 */
  async function flagWrongNeighbour(
    page: Page,
    oracle: MineOracle,
  ): Promise<{
    readonly start: NumberStart;
    readonly wrongFlag: Position;
    readonly mine: Position;
  }> {
    const start = await startOnNumber(page, oracle, 1);
    const [wrongFlag] = start.safeNeighbours;
    const [mine] = start.mineNeighbours;
    if (wrongFlag === undefined || mine === undefined) {
      throw new Error('周囲のマスが足りません');
    }
    await flagAll(page, [wrongFlag]);
    return { start, wrongFlag, mine };
  }

  async function expectLostByChord(
    page: Page,
    wrongFlag: Position,
    mine: Position,
  ): Promise<void> {
    await expect(resetButton(page)).toHaveAttribute('data-face', 'lost');
    await expect(statusMessage(page)).toHaveText('機雷を踏みました');
    await expect(cell(page, mine)).toHaveAttribute(
      'data-kind',
      'exploded-mine',
    );
    await expect(cell(page, wrongFlag)).toHaveAttribute(
      'data-kind',
      'wrong-flag',
    );
  }

  test('両クリックで機雷を開くと負ける', async ({ page }) => {
    const oracle = await openSeededPage(page, 81);
    const { start, wrongFlag, mine } = await flagWrongNeighbour(page, oracle);

    await chordAndHold(page, start.number, 'right');
    await releaseRemaining(page, 'right');

    await expectLostByChord(page, wrongFlag, mine);
  });

  test('中クリックで機雷を開くと負ける', async ({ page }) => {
    const oracle = await openSeededPage(page, 82);
    const { start, wrongFlag, mine } = await flagWrongNeighbour(page, oracle);

    await cell(page, start.number).click({ button: 'middle' });

    await expectLostByChord(page, wrongFlag, mine);
  });
});
