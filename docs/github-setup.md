# 人間が行うGitHubの設定

リポジトリの所有者が設定画面で行う作業の手順です。Claude Codeはこれらの設定を変更しません。GitHubの画面の名称は変わることがあるので、見つからない項目は近い名前のものを探してください。

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
