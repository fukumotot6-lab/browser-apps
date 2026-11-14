# CLAUDE.md

ブラウザで動く小さなアプリを、TypeScriptの静的サイトとして1つずつ作るリポジトリです。アプリは `apps/` の下にあります。

## 最初に読む文書

- [docs/conventions.md](docs/conventions.md)：コーディング、Git運用、依存パッケージ、セキュリティの規約。作業の前に必ず読む
- `apps/<アプリ名>/docs/requirements.md`：そのアプリの要件定義書。規約と食い違う場合はこちらを優先し、食い違いを報告する
- `apps/<アプリ名>/docs/architecture.md`：そのアプリの設計
- `apps/<アプリ名>/docs/phases/`：段階レポート
- [docs/github-setup.md](docs/github-setup.md)：人間が行うGitHubの設定手順

## ファイルを変更する前に

[docs/conventions.md](docs/conventions.md) の「作業の安全装置」の手順に従います。特に、複数のファイルを一括で書き換えるコマンドは、確認用のモードで対象を見てから実行します。同じ内容の一部を `.claude/hooks/guard.mjs` のフックが検査し、確認を求めることがあります。確認を求められたら、回避する方法を探さず、人間の判断を待ちます。

## コマンド

リポジトリのルートで実行します。Node.jsのバージョンは `.nvmrc` にあります。

| 目的                         | コマンド                    |
| ---------------------------- | --------------------------- |
| 依存パッケージのインストール | `npm ci`                    |
| 整形の確認                   | `npm run format:check`      |
| 整形の実行                   | `npm run format`            |
| Lint                         | `npm run lint`              |
| 型チェック                   | `npm run typecheck`         |
| テスト                       | `npm test`                  |
| ビルド                       | `npm run build`             |
| 開発サーバー                 | `npm run dev -w <アプリ名>` |
| 依存パッケージの検査         | `npm audit`                 |

## 進め方

要件定義書が定める段階ごとに、計画の提示、人間の承認、実装、段階レポート、PRの順で進めます。PRを作成したら作業を止め、人間の指示を待ちます。承認なしに行ってはいけないことは、規約と要件定義書にあります。
