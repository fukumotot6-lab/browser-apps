import { describe, expect, it } from 'vitest';

describe('ロジック層のテスト環境', () => {
  it('DOMのないNode.js環境で実行される', () => {
    expect('document' in globalThis).toBe(false);
    expect('window' in globalThis).toBe(false);
  });
});
