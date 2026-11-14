# browser-apps

ブラウザで動く小さなアプリを、TypeScriptの静的サイトとして作るリポジトリです。サーバーを持たず、実行時に外部のライブラリを読み込みません。

## アプリ

| アプリ                           | 内容                            | 状態   | 公開URL |
| -------------------------------- | ------------------------------- | ------ | ------- |
| [minesweeper](apps/minesweeper/) | 昔のWindows風のマインスイーパー | 開発中 | 未公開  |

## 動かし方

Node.js（バージョンは [.nvmrc](.nvmrc) を参照）とnpmが必要です。

```
npm ci
npm run dev -w minesweeper
```

表示されたURLをブラウザで開きます。

## 開発

```
npm run format:check   整形の確認
npm run lint           Lint
npm run typecheck      型チェック
npm test               テスト
npm run build          ビルド
```

## 構成

```
apps/<アプリ名>/     アプリ1つ分のコードと、そのアプリ固有の文書
docs/                全アプリ共通の文書
.github/             CIとPRテンプレート
```

設定（TypeScript、ESLint、Prettier）と開発用パッケージはルートに置き、npm workspacesで全アプリが共有します。

## 文書

- [規約](docs/conventions.md)
- [人間が行うGitHubの設定](docs/github-setup.md)
- マインスイーパー：[要件定義書](apps/minesweeper/docs/requirements.md)、[設計](apps/minesweeper/docs/architecture.md)、[段階レポート](apps/minesweeper/docs/phases/)

## アプリを追加するとき

1. `apps/<アプリ名>/` を作り、`package.json` に `dev`、`build`、`test`、`typecheck` のスクリプトを用意する
2. `tsconfig.json` でルートの `tsconfig.base.json` を継承する
3. 要件定義書を `apps/<アプリ名>/docs/requirements.md` に置く

Lint、整形、CIは、`apps/` の下のすべてのアプリを自動で対象にします。
