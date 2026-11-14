import { defineConfig } from 'vitest/config';

export default defineConfig({
  // 公開先のURLがサブパスになっても動くよう、成果物の参照を相対パスにする。
  base: './',
  test: {
    // ロジック層がDOMなしで動くことを保証するため、ブラウザ環境を模擬しない。
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
