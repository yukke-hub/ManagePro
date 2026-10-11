# ManagePro

シンプル・簡単・シームレスなタスク管理ツール。Cloudflare の無料枠(Workers + D1 + Workers AI + Access)で動かす。

## 進捗
- [x] Phase 1: 仕様・DB スキーマ・API 設計 (`docs/SPEC.md`, `migrations/`)
- [x] Phase 2: バックエンド (`src/worker/`)
- [x] Phase 3: フロントエンド (Vue 3 + Vite + TypeScript, `src/web/`)
- [x] Phase 4: AI 機能の仕上げ(画面との接続・ログ)
- [x] Phase 5: デプロイ手順書 (`docs/DEPLOY.md`)
- [x] タスクの編集 / 完了の取り消し / GitHub Actions での自動デプロイ (`.github/workflows/deploy.yml`)

## ローカルで動かす
```bash
npm install
cp .dev.vars.example .dev.vars        # ローカルだけ Access 検証を省略する設定
npm run db:migrate:local
npm run dev                            # Worker (API) http://localhost:8787
npm run dev:web                        # 画面 http://localhost:5173 (/api は 8787 へ中継)
```
画面は別ターミナルで `npm run dev:web` を起動して 5173 を開く。`npm run build` で `dist/` に画面を書き出すと、8787 だけでも画面が見られる。
- 書き込み系 API は `X-Requested-With: managepro` ヘッダー必須。
- ローカルでは Workers AI が使えないため、AI 機能はルールベースの代替結果を返す(想定どおりの動作)。
  AI を実際に試すには `wrangler.jsonc` の `ai` に `"remote": true` を付けて `wrangler login` する。

## 型チェック
```bash
npm run typecheck
```
