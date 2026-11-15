import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { createRandomMinePlacer } from '../../src/logic/index';
import type { BoardConfig, Position } from '../../src/logic/index';

// 盤面の期待値は、本番のロジック層を呼ばずに、機雷の位置からここで求め直す。
// 本番と同じ関数で期待値を作ると、ロジックの誤りが期待値にも写ってしまうため。
// 本番から借りるのは、機雷の位置を決める createRandomMinePlacer だけ。

/**
 * 配信元。これ以外へのリクエストが出ないことを確かめるために使う。
 * playwright.config.ts の HOST、PORT と合わせること。
 */
export const ORIGIN = 'http://127.0.0.1:4173';

export const BEGINNER: BoardConfig = { width: 9, height: 9, mineCount: 10 };
export const INTERMEDIATE: BoardConfig = {
  width: 16,
  height: 16,
  mineCount: 40,
};
export const EXPERT: BoardConfig = { width: 30, height: 16, mineCount: 99 };

/**
 * 種から同じ数列を再現できる乱数（mulberry32）。
 *
 * この関数のソースを文字列にしてページにも注入する（openSeededPage）。
 * ページ側とNode側で定義を1つにして、数列がずれないようにするため。
 * そのため、外の変数や関数を参照しない自己完結の形を保つこと。
 */
export function createSeededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 機雷が配置されたあとの盤面。 */
export interface Layout {
  readonly config: BoardConfig;
  /** 機雷のあるマスの添字（y * width + x）。 */
  readonly mines: ReadonlySet<number>;
}

export function indexOf(config: BoardConfig, position: Position): number {
  return position.y * config.width + position.x;
}

export function positionOf(config: BoardConfig, index: number): Position {
  return { x: index % config.width, y: Math.floor(index / config.width) };
}

export function allPositions(config: BoardConfig): Position[] {
  const result: Position[] = [];
  for (let index = 0; index < config.width * config.height; index += 1) {
    result.push(positionOf(config, index));
  }
  return result;
}

export function neighbours(
  config: BoardConfig,
  position: Position,
): Position[] {
  const result: Position[] = [];
  for (let y = position.y - 1; y <= position.y + 1; y += 1) {
    for (let x = position.x - 1; x <= position.x + 1; x += 1) {
      const isSelf = x === position.x && y === position.y;
      const isInside =
        x >= 0 && x < config.width && y >= 0 && y < config.height;
      if (!isSelf && isInside) {
        result.push({ x, y });
      }
    }
  }
  return result;
}

export function hasMine(layout: Layout, position: Position): boolean {
  return layout.mines.has(indexOf(layout.config, position));
}

export function adjacentMines(layout: Layout, position: Position): number {
  return neighbours(layout.config, position).filter((p) => hasMine(layout, p))
    .length;
}

export function minePositions(layout: Layout): Position[] {
  return allPositions(layout.config).filter((p) => hasMine(layout, p));
}

/**
 * ページの中で使われる乱数列を、Node側で追いかける。
 *
 * 本番は最初のマスを開いたときにだけ Math.random を使うので、同じ種の数列を
 * 同じ回数だけ進めれば、ページの中の機雷の位置が分かる。
 */
export class MineOracle {
  readonly #seed: number;
  /** ページの中で、これまでに消費されたはずの乱数の個数。 */
  #consumed = 0;

  constructor(seed: number) {
    this.#seed = seed;
  }

  /**
   * いま `first` を最初に開いたら、機雷がどこに置かれるかを求める。数列は進めない。
   * 「数字が1のマス」のような、試験に都合のよい最初の一手を探すために使う。
   */
  preview(config: BoardConfig, first: Position): Layout {
    return this.#place(config, first).layout;
  }

  /** ページで `first` を最初に開いたことを記録し、そのときの配置を返す。数列を進める。 */
  commit(config: BoardConfig, first: Position): Layout {
    const placed = this.#place(config, first);
    this.#consumed += placed.draws;
    return placed.layout;
  }

  #place(
    config: BoardConfig,
    first: Position,
  ): { readonly layout: Layout; readonly draws: number } {
    const random = createSeededRandom(this.#seed);
    for (let count = 0; count < this.#consumed; count += 1) {
      random();
    }
    let draws = 0;
    const counting = (): number => {
      draws += 1;
      return random();
    };
    const mines = createRandomMinePlacer(counting)(
      config,
      indexOf(config, first),
    );
    return { layout: { config, mines: new Set(mines) }, draws };
  }
}

/**
 * Math.random を種つき乱数に差し替えたページを開く。
 * 本番のコードにテスト用の入口を作らずに、盤面を再現できるようにするため。
 */
export async function openSeededPage(
  page: Page,
  seed: number,
): Promise<MineOracle> {
  await page.addInitScript({
    content: `Math.random = (${createSeededRandom.toString()})(${String(seed)});`,
  });
  await page.goto('/');
  await expect(board(page)).toBeVisible();
  return new MineOracle(seed);
}

export function board(page: Page): Locator {
  return page.locator('[data-testid="board"]');
}

/** 盤面の直下に並ぶマスすべて。 */
export function cells(page: Page): Locator {
  return page.locator('[data-testid="board"] > div.cell');
}

export function cell(page: Page, position: Position): Locator {
  return page.locator(
    `[data-testid="board"] > div.cell[data-x="${String(position.x)}"][data-y="${String(position.y)}"]`,
  );
}

export function mineCounter(page: Page): Locator {
  return page.locator('[data-testid="mine-counter"]');
}

export function timer(page: Page): Locator {
  return page.locator('[data-testid="timer"]');
}

export function resetButton(page: Page): Locator {
  return page.locator('button[data-testid="reset-button"]');
}

export function statusMessage(page: Page): Locator {
  return page.locator('[data-testid="status-message"]');
}

export function difficultyButton(
  page: Page,
  id: 'beginner' | 'intermediate' | 'expert',
): Locator {
  return page.locator(`button[data-difficulty="${id}"]`);
}

export interface FirstMove {
  readonly first: Position;
  readonly layout: Layout;
}

/**
 * 条件に合う「最初の一手」を、左上から順に探す。
 * 種ごとの盤面を目で見て座標を書き写さなくても、試験に必要な形の盤面を得られるようにするため。
 */
export function chooseFirstMove(
  oracle: MineOracle,
  config: BoardConfig,
  isSuitable: (layout: Layout, first: Position) => boolean,
): FirstMove {
  for (const first of allPositions(config)) {
    const layout = oracle.preview(config, first);
    if (isSuitable(layout, first)) {
      return { first, layout };
    }
  }
  throw new Error(
    '条件に合う最初の一手がありません。種を変えるか、条件を見直してください。',
  );
}

/** ページで最初のマスを開き、そのとき置かれた機雷の位置を返す。 */
export async function openFirst(
  page: Page,
  oracle: MineOracle,
  config: BoardConfig,
  first: Position,
): Promise<Layout> {
  await cell(page, first).click();
  return oracle.commit(config, first);
}

/**
 * 機雷のないマス `start` を開いたときに開くマスを `opened` に加える。
 * 0のマスからは周囲へ広がる。旗のマスは開かず、そこから先へも広がらない。
 */
export function reveal(
  layout: Layout,
  opened: Set<number>,
  start: Position,
  flags: ReadonlySet<number> = new Set<number>(),
): void {
  const pending: Position[] = [start];
  for (;;) {
    const position = pending.pop();
    if (position === undefined) {
      return;
    }
    const index = indexOf(layout.config, position);
    if (opened.has(index) || flags.has(index) || layout.mines.has(index)) {
      continue;
    }
    opened.add(index);
    if (adjacentMines(layout, position) === 0) {
      pending.push(...neighbours(layout.config, position));
    }
  }
}

/** 最初の一手だけを開いた時点で、開いているはずのマス。 */
export function openedAfterFirst(
  layout: Layout,
  first: Position,
  flags: ReadonlySet<number> = new Set<number>(),
): Set<number> {
  const opened = new Set<number>();
  reveal(layout, opened, first, flags);
  return opened;
}

/**
 * 勝つまでに左クリックするマスの列を求め、`opened` をすべて開いた状態に進める。
 * 空白の広がりで開くマスを飛ばして、クリックの回数を抑える。旗を使わない前提。
 */
export function planWinningClicks(
  layout: Layout,
  opened: Set<number>,
): Position[] {
  const clicks: Position[] = [];
  for (const position of allPositions(layout.config)) {
    const index = indexOf(layout.config, position);
    if (!layout.mines.has(index) && !opened.has(index)) {
      clicks.push(position);
      reveal(layout, opened, position);
    }
  }
  return clicks;
}

export async function clickAll(
  page: Page,
  positions: readonly Position[],
): Promise<void> {
  for (const position of positions) {
    await cell(page, position).click();
  }
}

/** 旗を立てず、機雷のないマスをすべて開いて勝つ。 */
export async function winGame(
  page: Page,
  layout: Layout,
  first: Position,
): Promise<void> {
  await clickAll(
    page,
    planWinningClicks(layout, openedAfterFirst(layout, first)),
  );
}

export async function flagAll(
  page: Page,
  positions: readonly Position[],
): Promise<void> {
  for (const position of positions) {
    await cell(page, position).click({ button: 'right' });
  }
}

/** マスの中央にポインタを置く。押下と解放を別々に送る操作の前に使う。 */
export async function moveTo(page: Page, position: Position): Promise<void> {
  const target = cell(page, position);
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (box === null) {
    throw new Error('マスが画面に表示されていません');
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
}

export type SideButton = 'left' | 'right';

function otherButton(button: SideButton): SideButton {
  return button === 'left' ? 'right' : 'left';
}

/**
 * 両クリック。左右を押して、`releaseFirst` を先に離す。
 * 残ったボタンは押したままにする。離したときに何も起きないことを、呼び出し側で確かめるため。
 */
export async function chordAndHold(
  page: Page,
  position: Position,
  releaseFirst: SideButton,
): Promise<void> {
  await moveTo(page, position);
  await page.mouse.down({ button: 'left' });
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: releaseFirst });
}

/** chordAndHold で残したボタンを離す。 */
export async function releaseRemaining(
  page: Page,
  releasedFirst: SideButton,
): Promise<void> {
  await page.mouse.up({ button: otherButton(releasedFirst) });
}

/** 盤面の状態。expectedBoard に渡して、画面に出るはずの内容を求める。 */
export interface BoardExpectation {
  readonly layout: Layout;
  readonly opened: ReadonlySet<number>;
  readonly flags?: ReadonlySet<number>;
  /** 負けたときの、踏んだ機雷の位置。 */
  readonly exploded?: Position;
  readonly isWon?: boolean;
}

function expectedCell(expectation: BoardExpectation, index: number): string {
  const { layout, opened, exploded, isWon } = expectation;
  const isMine = layout.mines.has(index);
  const isFlagged = expectation.flags?.has(index) ?? false;
  if (isWon === true && isMine) {
    return 'flag';
  }
  if (exploded !== undefined) {
    if (index === indexOf(layout.config, exploded)) {
      return 'exploded-mine';
    }
    if (isFlagged) {
      return isMine ? 'flag' : 'wrong-flag';
    }
    if (isMine) {
      return 'mine';
    }
  }
  if (isFlagged) {
    return 'flag';
  }
  if (opened.has(index)) {
    const count = adjacentMines(layout, positionOf(layout.config, index));
    return `open/${String(count)}/${count === 0 ? '' : String(count)}`;
  }
  return 'hidden';
}

/**
 * 画面に出るはずの盤面を、readBoard と同じ書式で求める。
 * 開いたマスは `open/<data-adjacent>/<表示される文字>`、ほかは `data-kind` の値。
 */
export function expectedBoard(expectation: BoardExpectation): string[] {
  const { config } = expectation.layout;
  return allPositions(config).map((position) =>
    expectedCell(expectation, indexOf(config, position)),
  );
}

/** 画面の盤面を、行優先の並びで読み取る。書式は expectedBoard を参照。 */
export async function readBoard(page: Page): Promise<string[]> {
  return cells(page).evaluateAll((elements) =>
    elements.map((element) => {
      const kind = element.getAttribute('data-kind') ?? '(data-kind なし)';
      const adjacent = element.getAttribute('data-adjacent');
      const text = element.textContent;
      if (kind === 'open') {
        return `open/${adjacent ?? '(data-adjacent なし)'}/${text}`;
      }
      // 開いていないマスに数字や data-adjacent が残っていたら、違いとして見えるようにする。
      return adjacent === null && text === ''
        ? kind
        : `${kind}/${String(adjacent)}/${text}`;
    }),
  );
}

/** 盤面全体が期待どおりになるまで待って確かめる。 */
export async function expectBoard(
  page: Page,
  expectation: BoardExpectation,
): Promise<void> {
  await expect.poll(() => readBoard(page)).toEqual(expectedBoard(expectation));
}

export function toIndexSet(
  config: BoardConfig,
  positions: readonly Position[],
): Set<number> {
  return new Set(positions.map((position) => indexOf(config, position)));
}
