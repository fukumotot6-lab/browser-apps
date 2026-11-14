import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    // ロジック層はNode.js上で単体テストできる状態を保つ（docs/conventions.md「層の分離」）。
    files: ['apps/*/src/logic/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...[
          'window',
          'document',
          'navigator',
          'localStorage',
          'sessionStorage',
          'setTimeout',
          'setInterval',
          'requestAnimationFrame',
        ].map((name) => ({
          name,
          message: 'ロジック層ではブラウザのAPIとタイマーを使わない。',
        })),
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/ui', '**/ui/**'],
              message: 'ロジック層から描画層を読み込まない。',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
