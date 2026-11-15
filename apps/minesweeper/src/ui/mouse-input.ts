/**
 * マウスのボタンの押下・解放の列を、ゲームの操作に変換する状態機械。
 * DOMに触れないので、Node.js上で単体テストできる。
 */

/** 押下・解放によって起きる操作。対象のマスは、呼び出す側がポインタの位置から決める。 */
export type MouseAction = 'open' | 'flag' | 'chord' | 'none';

/**
 * - `idle`：盤面で始まった操作がない
 * - `left`：左ボタンだけを盤面で押している。離すと開く
 * - `chord`：左右両方を押している。どちらかを離すと周囲を開く
 * - `spent`：周囲を開いたあと、まだ片方を押している。離しても何もしない
 */
export type MouseMode = 'idle' | 'left' | 'chord' | 'spent';

export const INITIAL_MOUSE_MODE: MouseMode = 'idle';

export interface MouseInput {
  readonly type: 'press' | 'release';
  /** 押した、または離したボタン。`MouseEvent.button` の値。 */
  readonly button: number;
  /** この出来事の直後に押されているボタンの集合。`MouseEvent.buttons` の値。 */
  readonly buttons: number;
}

export interface MouseStep {
  readonly mode: MouseMode;
  readonly action: MouseAction;
}

// MouseEvent.button の値。
const LEFT_BUTTON = 0;
const MIDDLE_BUTTON = 1;
const RIGHT_BUTTON = 2;

// MouseEvent.buttons のビット。button の値とは並びが違う。
const LEFT_MASK = 1;
const RIGHT_MASK = 2;

/** 1つの押下・解放を受け取り、次の状態と、起きる操作を返す。 */
export function stepMouse(mode: MouseMode, input: MouseInput): MouseStep {
  const isLeftHeld = (input.buttons & LEFT_MASK) !== 0;
  const isRightHeld = (input.buttons & RIGHT_MASK) !== 0;
  return input.type === 'press'
    ? press(mode, input.button, isLeftHeld, isRightHeld)
    : release(mode, input.button, isLeftHeld, isRightHeld);
}

function press(
  mode: MouseMode,
  button: number,
  isLeftHeld: boolean,
  isRightHeld: boolean,
): MouseStep {
  // 押したボタンは、この出来事の直前には押されていなかった。
  const current = reconcile(
    mode,
    button === LEFT_BUTTON ? false : isLeftHeld,
    button === RIGHT_BUTTON ? false : isRightHeld,
  );

  if (button === LEFT_BUTTON) {
    return { mode: isRightHeld ? 'chord' : 'left', action: 'none' };
  }
  if (button === RIGHT_BUTTON) {
    // 左を押している最中の右は両クリックの始まりなので、旗にしない。
    return isLeftHeld
      ? { mode: 'chord', action: 'none' }
      : { mode: current, action: 'flag' };
  }
  return { mode: current, action: 'none' };
}

function release(
  mode: MouseMode,
  button: number,
  isLeftHeld: boolean,
  isRightHeld: boolean,
): MouseStep {
  // 離したボタンは、この出来事の直前には押されていた。
  const current = reconcile(
    mode,
    button === LEFT_BUTTON ? true : isLeftHeld,
    button === RIGHT_BUTTON ? true : isRightHeld,
  );

  if (button === MIDDLE_BUTTON) {
    return { mode: current, action: 'chord' };
  }
  if (button !== LEFT_BUTTON && button !== RIGHT_BUTTON) {
    return { mode: current, action: 'none' };
  }

  const isOtherHeld = button === LEFT_BUTTON ? isRightHeld : isLeftHeld;
  // 片方をまだ押しているあいだは、それを離しても何も起きないようにする。
  const afterChord: MouseMode = isOtherHeld ? 'spent' : 'idle';
  switch (current) {
    case 'chord':
      return { mode: afterChord, action: 'chord' };
    case 'spent':
      return { mode: afterChord, action: 'none' };
    case 'left':
      // 右ボタンの解放では、左ボタンの操作を続ける。
      return button === LEFT_BUTTON
        ? { mode: 'idle', action: 'open' }
        : { mode: 'left', action: 'none' };
    case 'idle':
      return { mode: 'idle', action: 'none' };
  }
}

/**
 * 覚えている状態を、実際に押されていたボタンに合わせて直す。
 *
 * ウィンドウの外でボタンを離された場合など、解放の出来事が届かないことがある。
 * 状態が残ったままだと、次の操作で意図しないマスを開いてしまう。
 * 両押しの片方がいつの間にか離されていた場合は、どこで離されたか分からないので、
 * 残りの片方を離しても何もしない状態（`spent`）にする。
 */
function reconcile(
  mode: MouseMode,
  wasLeftHeld: boolean,
  wasRightHeld: boolean,
): MouseMode {
  switch (mode) {
    case 'idle':
      return 'idle';
    case 'left':
      return wasLeftHeld ? 'left' : 'idle';
    case 'chord':
      if (wasLeftHeld && wasRightHeld) {
        return 'chord';
      }
      return wasLeftHeld || wasRightHeld ? 'spent' : 'idle';
    case 'spent':
      return wasLeftHeld || wasRightHeld ? 'spent' : 'idle';
  }
}
