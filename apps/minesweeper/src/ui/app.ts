import {
  countRemainingMines,
  createGame,
  createRandomMinePlacer,
  openCell,
  openNeighbours,
  toggleFlag,
} from '../logic';
import type { GameState, Position } from '../logic';
import { createBoardView } from './board-view';
import { DEFAULT_DIFFICULTY } from './difficulty';
import type { Difficulty } from './difficulty';
import { createDifficultyBar } from './difficulty-bar';
import { faceFor, statusMessageFor } from './display';
import { INITIAL_MOUSE_MODE, stepMouse } from './mouse-input';
import type { MouseAction, MouseInput } from './mouse-input';
import { createStatusBar } from './status-bar';
import { elapsedSeconds, MAX_SECONDS, TICK_INTERVAL_MS } from './timer';

/** `root` の中にゲームの画面を組み立て、操作を受け付けはじめる。 */
export function mountApp(root: Element): void {
  // Math.random を呼び出しのたびに参照する。ここで関数を取り出して持つと、
  // あとから差し替えられた乱数（ブラウザテストの種つき乱数）が使われない。
  const placeMines = createRandomMinePlacer(() => Math.random());

  let difficulty: Difficulty = DEFAULT_DIFFICULTY;
  let game: GameState = createGame(difficulty.config);
  let mouseMode = INITIAL_MOUSE_MODE;
  /** タイマーを始めた時刻（ミリ秒）。始まっていなければ `null`。 */
  let startedAt: number | null = null;
  let intervalId: number | null = null;

  const panel = document.createElement('div');
  panel.className = 'game';
  panel.dataset.testid = 'game';

  const difficultyBar = createDifficultyBar((selected) => {
    difficulty = selected;
    startNewGame();
  });
  const statusBar = createStatusBar(startNewGame);
  const board = createBoardView();

  const statusMessage = document.createElement('p');
  statusMessage.className = 'visually-hidden';
  statusMessage.dataset.testid = 'status-message';
  statusMessage.setAttribute('role', 'status');

  panel.append(
    difficultyBar.element,
    statusBar.element,
    board.element,
    statusMessage,
  );

  function render(): void {
    difficultyBar.showSelected(difficulty.id);
    statusBar.showRemainingMines(countRemainingMines(game));
    statusBar.showFace(faceFor(game.status));
    board.render(game);
    const message = statusMessageFor(game.status);
    // 同じ文言を書き直すと、スクリーンリーダーが読み上げ直すことがある。
    if (statusMessage.textContent !== message) {
      statusMessage.textContent = message;
    }
  }

  function stopTicking(): void {
    if (intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
  }

  function refreshTimer(): void {
    if (startedAt === null) {
      statusBar.showSeconds(0);
      return;
    }
    const seconds = elapsedSeconds(startedAt, Date.now());
    statusBar.showSeconds(seconds);
    if (seconds >= MAX_SECONDS) {
      stopTicking();
    }
  }

  function startTimer(): void {
    stopTicking();
    startedAt = Date.now();
    intervalId = window.setInterval(refreshTimer, TICK_INTERVAL_MS);
    refreshTimer();
  }

  function startNewGame(): void {
    stopTicking();
    startedAt = null;
    refreshTimer();
    game = createGame(difficulty.config);
    render();
  }

  function applyState(next: GameState): void {
    // ロジック層は、何も変わらない操作では同じ状態をそのまま返す。
    if (next === game) {
      return;
    }
    const previousStatus = game.status;
    game = next;
    // 旗を立てただけでは ready のままなので、タイマーは始まらない。
    if (previousStatus === 'ready' && next.status !== 'ready') {
      startTimer();
    }
    if (next.status === 'won' || next.status === 'lost') {
      // 止める直前の値を表示に残す。
      refreshTimer();
      stopTicking();
    }
    render();
  }

  function perform(action: MouseAction, position: Position | null): void {
    if (position === null) {
      return;
    }
    switch (action) {
      case 'open':
        applyState(openCell(game, position, placeMines));
        return;
      case 'flag':
        applyState(toggleFlag(game, position));
        return;
      case 'chord':
        applyState(openNeighbours(game, position));
        return;
      case 'none':
        return;
    }
  }

  function handleMouse(type: MouseInput['type'], event: MouseEvent): void {
    const step = stepMouse(mouseMode, {
      type,
      button: event.button,
      buttons: event.buttons,
    });
    mouseMode = step.mode;
    perform(step.action, board.positionAt(event.target));
  }

  board.element.addEventListener('mousedown', (event) => {
    // 文字の選択、ドラッグの開始、中ボタンの自動スクロールを止める。
    event.preventDefault();
    handleMouse('press', event);
  });

  // 解放はページ全体で受ける。盤面の外で離された場合にも、押下の状態を残さないため。
  // 盤面の外で離されたときは、対象のマスがないので何も起きない。
  document.addEventListener('mouseup', (event) => {
    handleMouse('release', event);
  });

  // ウィンドウが裏に回ると解放が届かないことがあるので、押下の状態を捨てる。
  window.addEventListener('blur', () => {
    mouseMode = INITIAL_MOUSE_MODE;
  });

  panel.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });
  panel.addEventListener('dragstart', (event) => {
    event.preventDefault();
  });

  render();
  refreshTimer();
  root.replaceChildren(panel);
}
