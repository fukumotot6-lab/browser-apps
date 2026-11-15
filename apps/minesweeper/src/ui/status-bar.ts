import { formatCounter } from './display';
import type { Face } from './display';
import { createSegmentDisplay } from './seven-segment';
import { createIcon } from './svg';

export interface StatusBar {
  readonly element: HTMLElement;
  showRemainingMines(count: number): void;
  showSeconds(seconds: number): void;
  showFace(face: Face): void;
}

/**
 * 残り機雷数、顔のボタン、タイマーを並べた帯を作る。
 *
 * @param onReset 顔のボタンが押されたときに呼ぶ関数
 */
export function createStatusBar(onReset: () => void): StatusBar {
  const element = document.createElement('div');
  element.className = 'status-bar';

  const mineCounter = createSegmentDisplay('mine-counter');
  const timer = createSegmentDisplay('timer');

  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.className = 'reset-button';
  resetButton.dataset.testid = 'reset-button';
  resetButton.setAttribute('aria-label', '新しいゲームを始める');
  resetButton.addEventListener('click', onReset);

  element.append(mineCounter.element, resetButton, timer.element);

  return {
    element,
    showRemainingMines(count: number): void {
      mineCounter.show(formatCounter(count), `残り機雷数：${String(count)}`);
    },
    showSeconds(seconds: number): void {
      timer.show(formatCounter(seconds), `経過時間：${String(seconds)}秒`);
    },
    showFace(face: Face): void {
      if (resetButton.dataset.face === face) {
        return;
      }
      resetButton.dataset.face = face;
      resetButton.replaceChildren(createIcon(`face-${face}`));
    },
  };
}
