import { describe, expect, it } from 'vitest';
import { INITIAL_MOUSE_MODE, stepMouse } from '../../src/ui/mouse-input';
import type {
  MouseAction,
  MouseInput,
  MouseMode,
} from '../../src/ui/mouse-input';

type ButtonName = 'left' | 'middle' | 'right';

/** `+left` は左ボタンを押す、`-left` は離す、という書き方で操作の列を表す。 */
type Operation = `${'+' | '-'}${ButtonName}`;

// MouseEvent.button の値と、MouseEvent.buttons のビット。
const BUTTONS: Readonly<
  Record<ButtonName, { readonly button: number; readonly mask: number }>
> = {
  left: { button: 0, mask: 1 },
  middle: { button: 1, mask: 4 },
  right: { button: 2, mask: 2 },
};

function parseOperation(operation: Operation): {
  readonly type: MouseInput['type'];
  readonly name: ButtonName;
} {
  const type = operation.startsWith('+') ? 'press' : 'release';
  const name = (['left', 'middle', 'right'] satisfies ButtonName[]).find(
    (candidate) => operation.endsWith(candidate),
  );
  if (name === undefined) {
    throw new Error(`操作の書き方が正しくない：${operation}`);
  }
  return { type, name };
}

/**
 * 操作の列を、ブラウザが送るのと同じ `button` / `buttons` の組に直して状態機械に流し、
 * 操作ごとに起きたことを返す。
 */
function play(operations: readonly Operation[]): MouseAction[] {
  let mode: MouseMode = INITIAL_MOUSE_MODE;
  let held = 0;
  const actions: MouseAction[] = [];
  for (const operation of operations) {
    const { type, name } = parseOperation(operation);
    const { button, mask } = BUTTONS[name];
    held = type === 'press' ? held | mask : held & ~mask;
    const step = stepMouse(mode, { type, button, buttons: held });
    mode = step.mode;
    actions.push(step.action);
  }
  return actions;
}

/** 届かなかった出来事がある場合を確かめるために、`buttons` を直接指定して流す。 */
function playRaw(inputs: readonly MouseInput[]): MouseAction[] {
  let mode: MouseMode = INITIAL_MOUSE_MODE;
  const actions: MouseAction[] = [];
  for (const input of inputs) {
    const step = stepMouse(mode, input);
    mode = step.mode;
    actions.push(step.action);
  }
  return actions;
}

interface SequenceCase {
  readonly label: string;
  readonly operations: readonly Operation[];
  readonly expected: readonly MouseAction[];
}

describe('stepMouse', () => {
  describe('左ボタンだけ、右ボタンだけ', () => {
    it.each<SequenceCase>([
      {
        label: '左ボタンは、押したときではなく離したときに開く',
        operations: ['+left', '-left'],
        expected: ['none', 'open'],
      },
      {
        label: '右ボタンは、押したときに旗を切り替え、離したときは何もしない',
        operations: ['+right', '-right'],
        expected: ['flag', 'none'],
      },
      {
        label: '左クリックを続けると、そのたびに開く',
        operations: ['+left', '-left', '+left', '-left'],
        expected: ['none', 'open', 'none', 'open'],
      },
      {
        label: '右クリックを続けると、そのたびに旗を切り替える',
        operations: ['+right', '-right', '+right', '-right'],
        expected: ['flag', 'none', 'flag', 'none'],
      },
      {
        label: '右クリックのあとの左クリックは、ふつうに開く',
        operations: ['+right', '-right', '+left', '-left'],
        expected: ['flag', 'none', 'none', 'open'],
      },
    ])('$label', ({ operations, expected }) => {
      expect(play(operations)).toEqual(expected);
    });
  });

  describe('左右の両押し', () => {
    it.each<SequenceCase>([
      {
        label:
          '左→右と押して左を離すと、周囲を開く。右の押下は旗にせず、残った右を離しても何も起きない',
        operations: ['+left', '+right', '-left', '-right'],
        expected: ['none', 'none', 'chord', 'none'],
      },
      {
        label:
          '左→右と押して右を離すと、周囲を開く。残った左を離しても開かない',
        operations: ['+left', '+right', '-right', '-left'],
        expected: ['none', 'none', 'chord', 'none'],
      },
      {
        label:
          '右→左と押して左を離すと、周囲を開く。最初の右の押下では旗が切り替わる',
        operations: ['+right', '+left', '-left', '-right'],
        expected: ['flag', 'none', 'chord', 'none'],
      },
      {
        label:
          '右→左と押して右を離すと、周囲を開く。残った左を離しても開かない',
        operations: ['+right', '+left', '-right', '-left'],
        expected: ['flag', 'none', 'chord', 'none'],
      },
      {
        label: '両押しを終えたあとの左クリックは、ふつうに開く',
        operations: ['+left', '+right', '-left', '-right', '+left', '-left'],
        expected: ['none', 'none', 'chord', 'none', 'none', 'open'],
      },
      {
        label: '両押しを終えたあとの右クリックは、ふつうに旗を切り替える',
        operations: ['+left', '+right', '-right', '-left', '+right', '-right'],
        expected: ['none', 'none', 'chord', 'none', 'flag', 'none'],
      },
      {
        label:
          '周囲を開いたあと、左を押したまま右を押し直して離すと、もう一度周囲を開く',
        operations: ['+left', '+right', '-right', '+right', '-right', '-left'],
        expected: ['none', 'none', 'chord', 'none', 'chord', 'none'],
      },
      {
        label:
          '周囲を開いたあと、右を押したまま左を押し直して離すと、もう一度周囲を開く',
        operations: ['+left', '+right', '-left', '+left', '-left', '-right'],
        expected: ['none', 'none', 'chord', 'none', 'chord', 'none'],
      },
    ])('$label', ({ operations, expected }) => {
      expect(play(operations)).toEqual(expected);
    });
  });

  describe('中ボタン', () => {
    it.each<SequenceCase>([
      {
        label: '中ボタンは、押したときではなく離したときに周囲を開く',
        operations: ['+middle', '-middle'],
        expected: ['none', 'chord'],
      },
      {
        label: '中クリックのあとの左クリックは、ふつうに開く',
        operations: ['+middle', '-middle', '+left', '-left'],
        expected: ['none', 'chord', 'none', 'open'],
      },
      {
        label: '中ボタンを押している最中の右の押下は、旗を切り替える',
        operations: ['+middle', '+right', '-right', '-middle'],
        expected: ['none', 'flag', 'none', 'chord'],
      },
    ])('$label', ({ operations, expected }) => {
      expect(play(operations)).toEqual(expected);
    });
  });

  describe('そのほかのボタン', () => {
    it('戻る・進むなどのボタンでは、何も起きない', () => {
      expect(
        playRaw([
          { type: 'press', button: 3, buttons: 8 },
          { type: 'release', button: 3, buttons: 0 },
          { type: 'press', button: 4, buttons: 16 },
          { type: 'release', button: 4, buttons: 0 },
        ]),
      ).toEqual(['none', 'none', 'none', 'none']);
    });
  });

  describe('押下や解放が届かなかったとき', () => {
    it('押下を見ていない左ボタン（盤面の外で押された）を離しても、開かない', () => {
      expect(playRaw([{ type: 'release', button: 0, buttons: 0 }])).toEqual([
        'none',
      ]);
    });

    it('押下を見ていない右ボタンを離しても、何も起きない', () => {
      expect(playRaw([{ type: 'release', button: 2, buttons: 0 }])).toEqual([
        'none',
      ]);
    });

    it('左の解放が届かなかったあとの右クリックは、両押しではなく旗の切り替えになる', () => {
      expect(
        playRaw([
          { type: 'press', button: 0, buttons: 1 },
          // ここで左がウィンドウの外で離され、解放が届かなかった。
          { type: 'press', button: 2, buttons: 2 },
          { type: 'release', button: 2, buttons: 0 },
        ]),
      ).toEqual(['none', 'flag', 'none']);
    });

    it('両押しの最中に右の解放が届かなかったら、左を離しても周囲を開かず、マスも開かない', () => {
      expect(
        playRaw([
          { type: 'press', button: 0, buttons: 1 },
          { type: 'press', button: 2, buttons: 3 },
          // ここで右がウィンドウの外で離され、解放が届かなかった。
          { type: 'release', button: 0, buttons: 0 },
        ]),
      ).toEqual(['none', 'none', 'none']);
    });

    it('両押しの最中に左の解放が届かなかったら、右を離しても周囲を開かない', () => {
      expect(
        playRaw([
          { type: 'press', button: 0, buttons: 1 },
          { type: 'press', button: 2, buttons: 3 },
          // ここで左がウィンドウの外で離され、解放が届かなかった。
          { type: 'release', button: 2, buttons: 0 },
        ]),
      ).toEqual(['none', 'none', 'none']);
    });

    it('両押しの両方の解放が届かなかったあとの左クリックは、ふつうに開く', () => {
      expect(
        playRaw([
          { type: 'press', button: 0, buttons: 1 },
          { type: 'press', button: 2, buttons: 3 },
          // ここで両方がウィンドウの外で離され、解放が届かなかった。
          { type: 'press', button: 0, buttons: 1 },
          { type: 'release', button: 0, buttons: 0 },
        ]),
      ).toEqual(['none', 'none', 'none', 'open']);
    });

    it('周囲を開いたあと、残った左の解放が届かなくても、次の右クリックは旗の切り替えになる', () => {
      expect(
        playRaw([
          { type: 'press', button: 0, buttons: 1 },
          { type: 'press', button: 2, buttons: 3 },
          { type: 'release', button: 2, buttons: 1 },
          // ここで左がウィンドウの外で離され、解放が届かなかった。
          { type: 'press', button: 2, buttons: 2 },
          { type: 'release', button: 2, buttons: 0 },
        ]),
      ).toEqual(['none', 'none', 'chord', 'flag', 'none']);
    });

    it('盤面の外で左を押したままマスの上で右を押すと、旗にせず、どちらかを離したときに周囲を開く', () => {
      expect(
        playRaw([
          // 左の押下は盤面の外だったので、届いていない。
          { type: 'press', button: 2, buttons: 3 },
          { type: 'release', button: 2, buttons: 1 },
          { type: 'release', button: 0, buttons: 0 },
        ]),
      ).toEqual(['none', 'chord', 'none']);
    });
  });

  describe('状態の移り変わり', () => {
    it('最初は、何も押していない状態から始まる', () => {
      expect(INITIAL_MOUSE_MODE).toBe('idle');
    });

    it('すべてのボタンを離すと、何も押していない状態に戻る', () => {
      let mode: MouseMode = INITIAL_MOUSE_MODE;
      const inputs: MouseInput[] = [
        { type: 'press', button: 0, buttons: 1 },
        { type: 'press', button: 2, buttons: 3 },
        { type: 'release', button: 0, buttons: 2 },
        { type: 'release', button: 2, buttons: 0 },
      ];
      const modes: MouseMode[] = [];
      for (const input of inputs) {
        mode = stepMouse(mode, input).mode;
        modes.push(mode);
      }

      expect(modes).toEqual(['left', 'chord', 'spent', 'idle']);
    });
  });
});
