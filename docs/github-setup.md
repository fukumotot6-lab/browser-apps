# 人間が行うGitHubの設定

リポジトリの所有者が設定画面で行う作業の手順です。Claude Codeはこれらの設定を変更しません。GitHubの画面の名称は変わることがあるので、見つからない項目は近い名前のものを探してください。

## 設定の記録

リポジトリの所有者が設定を行った日と、その時点の状態です。設定を変えたときは、この表も直してください。

| 項目                                  | 状態   | 設定日     | 設定後に確認できた内容                                                                         |
| ------------------------------------- | ------ | ---------- | ---------------------------------------------------------------------------------------------- |
| 1. コミット用メールアドレスの非公開化 | 完了   | 2026-11-14 | このリポジトリの全コミットの作成者が、GitHubの非公開用アドレスになっている                     |
| 2. mainブランチの保護                 | 完了   | 2026-11-14 | ルールセット `main` が有効。削除の禁止、PRの必須化、`check` の成功の必須化、強制プッシュの禁止 |
| 3. シークレットスキャンとプッシュ保護 | 完了   | 2026-11-14 | 両方とも有効                                                                                   |
| 4. Dependabotアラート                 | 完了   | 2026-11-14 | 有効                                                                                           |
| 5. GitHub Actionsの権限               | 完了   | 2026-11-14 | ワークフローの既定の権限は読み取りのみ。PRの作成と承認は許可していない                         |
| 6. GitHub Pagesの有効化               | 未実施 | —          | 公開の段階で行う                                                                               |

「設定後に確認できた内容」は、Claude CodeがGitHubのAPIを読み取って確かめたものです。1のGitHub側の設定（アドレスの非公開化と、個人のアドレスを含むプッシュの拒否）はAPIから読めないため、コミットの作成者だけを確認しています。

## 1. コミット用メールアドレスを非公開にする

1. GitHubの右上のアイコン → Settings → Emails を開く
2. 「Keep my email addresses private」を有効にする
3. 同じ画面に表示される `数字+ユーザー名@users.noreply.github.com` を控える
4. 「Block command line pushes that expose my email」も有効にする。個人のアドレスを含むコミットのプッシュを、GitHubが拒否するようになる
5. 手元の端末で次を実行する

   ```
   git config --global user.email "控えたアドレス"
   ```

## 2. mainブランチを保護する

最初のPRでCIが1回動いたあとに行います。CIのジョブ名は、一度実行されるまで選択肢に出ません。

1. リポジトリの Settings → Rules → Rulesets → New ruleset → New branch ruleset
2. Ruleset name に `main` と入力し、Enforcement status を Active にする
3. Target branches → Add target → Include default branch
4. 次の項目を有効にする
   - Restrict deletions
   - Require a pull request before merging
   - Require status checks to pass → Add checks で `check` を追加する
   - Block force pushes
5. Create で保存する

## 3. シークレットスキャンとプッシュ保護を有効にする

1. リポジトリの Settings → Advanced Security を開く
2. Secret Protection を有効にする
3. Push protection を有効にする

## 4. Dependabotアラートを有効にする

1. リポジトリの Settings → Advanced Security を開く
2. Dependabot alerts を有効にする

## 5. GitHub Actionsの権限を確認する

1. リポジトリの Settings → Actions → General を開く
2. Workflow permissions が「Read repository contents and packages permissions」になっていることを確認する
3. 「Allow GitHub Actions to create and approve pull requests」が無効であることを確認する

## 6. GitHub Pagesを有効にする

公開の段階で行います。手順はその段階で追記します。
