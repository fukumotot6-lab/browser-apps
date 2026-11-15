import { DIFFICULTIES } from './difficulty';
import type { Difficulty, DifficultyId } from './difficulty';

export interface DifficultyBar {
  readonly element: HTMLElement;
  /** 選択中の難易度を、ボタンの見た目と `aria-pressed` に反映する。 */
  showSelected(id: DifficultyId): void;
}

/**
 * 難易度ボタンの並びを作る。
 *
 * @param onSelect ボタンが押されたときに呼ぶ関数。選択中の難易度のボタンでも呼ぶ
 */
export function createDifficultyBar(
  onSelect: (difficulty: Difficulty) => void,
): DifficultyBar {
  const element = document.createElement('div');
  element.className = 'difficulty-bar';
  element.setAttribute('role', 'group');
  element.setAttribute('aria-label', '難易度');

  const buttons = new Map<DifficultyId, HTMLButtonElement>();
  for (const difficulty of DIFFICULTIES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'difficulty-button';
    button.dataset.difficulty = difficulty.id;
    button.textContent = difficulty.label;
    button.addEventListener('click', () => {
      onSelect(difficulty);
    });
    buttons.set(difficulty.id, button);
    element.append(button);
  }

  return {
    element,
    showSelected(id: DifficultyId): void {
      for (const [buttonId, button] of buttons) {
        button.setAttribute('aria-pressed', String(buttonId === id));
      }
    },
  };
}
