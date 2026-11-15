import { defineConfig, devices } from '@playwright/test';

// `localhost` と書くと、IPv4とIPv6のどちらにつなぐかが環境とブラウザで変わり、
// 接続に失敗することがある。アドレスを数字で固定する。
// tests/browser/helpers.ts の ORIGIN と合わせること。
const HOST = '127.0.0.1';
const PORT = 4173;

export default defineConfig({
  testDir: 'tests/browser',
  // 開発サーバーではなく、公開するものと同じビルド成果物を確かめる。
  // ビルドは `npm run test:browser` が先に行う。
  webServer: {
    command: `npm run preview -- --host ${HOST} --port ${PORT} --strictPort`,
    url: `http://${HOST}:${PORT}/`,
    // 古いビルドを配信中のサーバーを誤って使わないよう、毎回起動する。
    reuseExistingServer: false,
  },
  use: {
    baseURL: `http://${HOST}:${PORT}/`,
  },
  // `test.only` を消し忘れたままCIが成功してしまうのを防ぐ。
  // 一部だけ実行したいときは、コマンドの `--grep` を使う。
  forbidOnly: true,
  // 再実行で成功に変わると不安定なテストに気づけないので、再実行しない。
  retries: 0,
  reporter: 'list',
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
