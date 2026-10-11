# デプロイ手順書

`managepro.yukkebee.com` は現在 Workers + GitHub Actions(main への merge で自動デプロイ)で動いています。
この構成を引き継ぎ、**同じホスト名のまま**、コードだけ今回のものに入れ替えます。

## 0. 事前に確認すること(重要)
今の Worker と、この Worker(`wrangler.jsonc` の `"name": "managepro"`)の **Worker 名が同じかどうか**を確認してください。
- Cloudflare ダッシュボード → Workers & Pages で、今のプロジェクト名を見る
- 同じ名前なら、そのまま `wrangler deploy` で中身が入れ替わります(下の手順どおりで OK)。
- **名前が違う場合**は、`wrangler.jsonc` の `"name"` をその名前に合わせるか、古い Worker 側のカスタムドメイン設定を先に外してから、このリポジトリのホスト名設定を有効にしてください。両方が同じホスト名を持ったままだと、デプロイ時にルートの競合エラーになります。
- 今の D1 データ(既にタスクなどを保存済みの場合)を引き継ぎたいときは、既存の D1 データベース名/IDを確認し、手順2 で新規作成せずそれを使ってください。

## 1. 準備
```bash
npm install
npx wrangler login        # 初回のみ。すでにログイン済みなら不要
```

## 2. D1(データベース)を用意する
**新規の場合:**
```bash
npx wrangler d1 create managepro-db
```
出力された `database_id` を `wrangler.jsonc` の `REPLACE_WITH_YOUR_D1_ID` に貼り、テーブルを作成:
```bash
npm run db:migrate:remote
```

**既存の D1 を引き継ぐ場合:** その `database_id` を `wrangler.jsonc` に貼ってから `npm run db:migrate:remote` を実行してください(このプロジェクトのテーブルがまだ無ければ作られます。既にある場合は何も起きません)。

## 3. Cloudflare Access を確認・設定する
すでに `managepro.yukkebee.com` に Access がかかっている場合、**設定はそのまま使えます**。
Zero Trust → Access controls → Applications → 対象のアプリ → Configure → Additional settings で **Application Audience (AUD) Tag** を確認し、チームドメイン(`◯◯.cloudflareaccess.com`)と合わせて `wrangler.jsonc` の `vars` に設定します。

```jsonc
"ACCESS_TEAM_DOMAIN": "◯◯.cloudflareaccess.com",
"ACCESS_AUD": "コピーした AUD タグ",
```
> どちらかがプレースホルダー(`REPLACE…`)のままだと、API は**すべてのリクエストを拒否**します(安全側の動作)。

Access がまだ無い場合は、新規に Self-hosted アプリケーションを作成し、Application domain に `managepro.yukkebee.com` を設定してください。

## 4. GitHub Actions で自動デプロイする(既存の仕組みを利用)
今回のコードには `.github/workflows/deploy.yml` を同梱しています。`main` に push(merge)すると、型チェック → D1マイグレーション適用 → ビルド・デプロイ、の順に自動実行されます。

1. Cloudflare の **API トークン**を作る: ダッシュボード右上のアイコン → My Profile → API Tokens → Create Token →「Edit Cloudflare Workers」テンプレートを使う(D1 の編集権限も含まれます)
2. GitHub リポジトリの **Settings → Secrets and variables → Actions** で、`CLOUDFLARE_API_TOKEN` という名前でそのトークンを登録する
   - すでに同名のシークレットが既存のワークフロー用に登録されている場合は、そのまま使えます(作り直し不要)
3. 既存のワークフローファイルがあれば、内容を見比べてください。役割が重複する場合は、古い方を無効化するか削除し、今回の `deploy.yml` に一本化することをおすすめします(同時に2つのワークフローが同じ Worker に deploy すると、後勝ちで上書きし合います)。
4. 変更を `main` に push すると、GitHub の **Actions** タブでデプロイの進行状況が見られます。

## 5. 手元から直接デプロイしたいとき(任意)
```bash
npm run deploy
```

## 6. 動作確認(シークレットウィンドウで)
1. `https://managepro.yukkebee.com/` を開く → Access のログイン画面(すでにログイン中ならスキップ)
2. 右上の丸いアイコン → 表示名を入力して保存
3. 「タスクを追加する」で1件追加 → 実行推奨タスクの**チェックボックス**にチェックを入れると完了になり、「元に戻す」のトースト通知が出ることを確認
4. 完了済みのタスクは「今後のタスクを確認する」→「完了済み」タブから、チェックを外すと未完了に戻せる
5. 予定にマウスを乗せると出る「編集」から、時間の変更ができる
6. 下の入力欄に「今日の予定案を作って」→ 返事が返り、予定に「提案」が並ぶ

## 7. 更新するとき
- コード変更: `main` に push すれば自動デプロイ
- DB の変更: `migrations/` に `0002_*.sql` のように**新しいファイルを追加**してから push(既存のファイルは書き換えない)

## 8. AI の調整
- ログを見る: `npx wrangler tail`
  AI の出力が期待した形式でなかったとき、`ai_bad_output kind=… raw=…`(先頭300文字)が出ます。**タスク名などが含まれることがあるので、ログは他人に共有しないでください。**
- プロンプトの場所: 共通は `src/worker/ai.ts`(`BASE_SYSTEM`)、機能ごとに `features.ts`(推奨タスク)/ `planning.ts`(予定案)/ `routes/ai.ts`(チャット)
- 調整できる値(`wrangler.jsonc` の `vars`): `AI_MODEL`、`AI_DAILY_USER_LIMIT`、`AI_DAILY_GLOBAL_LIMIT`、`WORK_START` / `WORK_END`
- Workers AI の無料枠は1日 10,000 Neurons(UTC 0時にリセット)。使用量は Cloudflare ダッシュボードの Workers AI で確認できます。

## 困ったとき
| 症状 | 原因と対処 |
|---|---|
| デプロイ時にルートの競合エラー | 手順0の Worker 名の確認漏れ。古い Worker のカスタムドメインを外すか、名前を合わせる |
| Actions が失敗する(`CLOUDFLARE_API_TOKEN` 関連) | シークレットの登録漏れ、またはトークンの権限不足(D1・Workers の編集権限が必要) |
| 画面は出るが「接続できませんでした」と警告 | Access の Application domain が実URLと違う / ログイン期限切れ。再読み込みで解消することが多い |
| API が `access_not_configured`(500) | `ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` が未設定 |
| API が `unauthorized`(401) | AUD タグの貼り間違い、チームドメインの違い |
| AI がいつも「ルールで作りました」になる | 1日の上限に達した、または AI 呼び出しの失敗。画面下の「今日のAI残り」とログを確認 |
