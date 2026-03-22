# ManagePro

シンプルで洗練されたプロジェクト管理ツール。少人数グループから中小企業の組織まで対応。

**URL**: https://managepro.yukkebee.com  
**Stack**: React + TypeScript + Cloudflare Workers + D1 + PayPal

---

## ディレクトリ構成

```
managepro/
├── workers/          Cloudflare Workers (バックエンドAPI)
│   ├── schema.sql    データベース定義
│   ├── wrangler.toml Cloudflare設定
│   └── src/
│       ├── index.ts          メインルーター
│       ├── middleware/auth.ts JWT認証
│       └── routes/           各APIエンドポイント
│
└── frontend/         React SPA (フロントエンド)
    ├── public/
    │   ├── logo.svg       ← ここを自分のロゴに差し替えてください
    │   ├── _redirects     SPAルーティング設定
    │   └── _headers       セキュリティヘッダー
    └── src/
        ├── components/    再利用コンポーネント
        ├── pages/         各ページ
        ├── stores/        Zustand状態管理
        ├── api/           APIクライアント
        └── types/         TypeScript型定義
```

---

## 初回セットアップ（全手順）

### 前提条件
- Node.js 20以上
- Cloudflareアカウント（無料）
- PayPalビジネスアカウント

---

### Step 1: 依存パッケージのインストール

```bash
# プロジェクトルートで
npm run install:all

# または個別に
cd workers && npm install
cd ../frontend && npm install
```

---

### Step 2: Cloudflare Workers セットアップ

```bash
cd workers

# Cloudflareにログイン
npx wrangler login

# D1データベースを作成
npx wrangler d1 create managepro-db
```

出力例:
```
✅ Successfully created DB 'managepro-db' in region APAC
Created your new D1 database.

[[d1_databases]]
binding = "DB"
database_name = "managepro-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

→ `database_id` を `wrangler.toml` の該当箇所に貼り付け

```bash
# KV Namespaceを作成
npx wrangler kv:namespace create managepro-kv
```

→ 出力された `id` を `wrangler.toml` に貼り付け

---

### Step 3: wrangler.toml の設定

`workers/wrangler.toml` を開いて以下を埋める:

```toml
[vars]
JWT_SECRET = "ランダムな32文字以上の文字列"  # 例: openssl rand -base64 32 で生成
PAYPAL_CLIENT_ID = "PayPalのClient ID"
PAYPAL_CLIENT_SECRET = "PayPalのSecret"
PAYPAL_PLAN_ID = "PayPalのPlan ID（月額プラン）"
PAYPAL_MODE = "live"  # テスト時は "sandbox"
FRONTEND_URL = "https://managepro.yukkebee.com"

[[d1_databases]]
database_id = "上記で取得したID"

[[kv_namespaces]]
id = "上記で取得したID"
```

---

### Step 4: データベースにスキーマを適用

```bash
# 本番DBに適用
cd workers
npx wrangler d1 execute managepro-db --file=./schema.sql

# ローカルテスト用（任意）
npx wrangler d1 execute managepro-db --local --file=./schema.sql
```

---

### Step 5: PayPal の設定

1. https://developer.paypal.com にアクセス
2. **My Apps & Credentials** → **Create App**
   - App Name: ManagePro
   - Type: Merchant
3. **Client ID** と **Secret** をメモ
4. **Subscriptions** → **Plans** → **Create Plan**
   - 製品を作成（ManagePro）
   - 価格: ¥1,500 / month
   - **Plan ID** をメモ（`P-` で始まる文字列）
5. **Webhooks** を設定:
   - URL: `https://managepro-api.YOUR_SUBDOMAIN.workers.dev/api/paypal/webhook`
   - イベント: `BILLING.SUBSCRIPTION.ACTIVATED`, `BILLING.SUBSCRIPTION.CANCELLED`, `PAYMENT.SALE.COMPLETED`
6. 上記3つを `wrangler.toml` に記入

---

### Step 6: Workers をデプロイ

```bash
cd workers
npx wrangler deploy
```

出力例:
```
Published managepro-api (2.5 sec)
https://managepro-api.YOUR_SUBDOMAIN.workers.dev
```

→ このURLをメモ

---

### Step 7: フロントエンドのビルド

```bash
cd frontend

# .env.production を作成
echo "VITE_API_URL=https://managepro-api.YOUR_SUBDOMAIN.workers.dev/api" > .env.production

# ビルド
npm run build
# → dist/ フォルダが生成される
```

---

### Step 8: Cloudflare Pages にデプロイ

**方法A: ダイレクトアップロード（簡単）**
1. Cloudflare Dashboard → **Pages** → **Create a project**
2. **Direct upload** を選択
3. `frontend/dist/` フォルダをドラッグ&ドロップ
4. プロジェクト名: `managepro`

**方法B: Git連携（推奨・自動デプロイ）**
1. GitHubにリポジトリを作成してプッシュ
2. Cloudflare Dashboard → Pages → Connect to Git
3. ビルド設定:
   - **Build command**: `cd frontend && npm install && npm run build`
   - **Build output directory**: `frontend/dist`
   - **Environment variable**: `VITE_API_URL` = Workersのデプロイ先URL

---

### Step 9: カスタムドメインの設定

1. Cloudflare Dashboard → Pages → managepro → **Custom domains**
2. `managepro.yukkebee.com` を追加
3. DNSレコードが自動追加される（yukkebee.comがCloudflare管理の場合は即時反映）

---

### Step 10: ロゴを差し替え

`frontend/public/logo.svg` を自分のロゴに差し替えてください。
- 推奨: 正方形のSVG（32×32 or 64×64）
- PNG形式も可（`index.html` の `link[rel=icon]` を変更する必要あり）

---

## ローカル開発

```bash
# ターミナル1: Workers (APIサーバー)
cd workers
npx wrangler dev

# ターミナル2: フロントエンド
cd frontend
cp .env.example .env.local
# .env.local の VITE_API_URL は /api のまま（Viteがプロキシ）
npm run dev
```

フロントエンド: http://localhost:5173  
API: http://localhost:8787

---

## 機能一覧

| 機能 | 説明 |
|------|------|
| 組織管理 | 複数組織に所属、切り替え |
| プロジェクト管理 | Notionライクなブロック構成 |
| タスク管理 | リスト/カンバン、サブタスク、プロトコル |
| チャット | スレッドベース、権限設定 |
| ビデオ会議 | Jitsi Meet組み込み、議事録 |
| カレンダー | タスク・会議自動同期 |
| ホワイトボード | tldraw組み込み |
| 予算管理 | 計画vs実績、グラフ表示 |
| 資料管理 | リンク・埋め込みプレビュー |
| ユーザーステータス | Teams/Discordライクなステータス |
| ユーザーノート | Instagramノートライク |
| PayPal課金 | ¥1,500/月のサブスクリプション |

---

## 技術スタック

| レイヤー | 技術 | 理由 |
|---------|------|------|
| フロントエンド | React 18 + TypeScript + Vite | 型安全、高速ビルド |
| スタイリング | Tailwind CSS | ユーティリティファースト |
| 状態管理 | Zustand | シンプル・軽量 |
| ルーティング | React Router v6 | 標準的なSPAルーター |
| カレンダー | FullCalendar | 高機能・MIT |
| ドラッグ&ドロップ | @hello-pangea/dnd | カンバン用 |
| ホワイトボード | tldraw v2 | Figjamライク・MIT |
| グラフ | recharts | 予算可視化 |
| バックエンド | Cloudflare Workers + Hono | エッジ、無料枠が広い |
| DB | Cloudflare D1 (SQLite) | Workers統合、無料枠あり |
| 認証 | JWT (HS256) | ステートレス |
| ビデオ | Jitsi Meet | 完全無料、自前サーバー不要 |
| 決済 | PayPal Subscriptions | 月額課金 |
| ホスティング | Cloudflare Pages | 無料、CDN内蔵 |

---

## セキュリティメモ

- JWT_SECRETは必ず32文字以上のランダム文字列を使用
- PayPal webhookは実装済み（署名検証は本番前に追加推奨）
- パスワードはSHA-256ハッシュ（本番環境ではbcrypt/Argon2の使用を推奨）
- CORSはFRONTEND_URLにのみ許可

---

## よくある問題

**Q: デプロイ後に `API Error` が出る**  
A: `FRONTEND_URL` が正しいか確認。ブラウザのDevToolsでCORSエラーを確認。

**Q: PayPalボタンが表示されない**  
A: `PAYPAL_CLIENT_ID` と `PAYPAL_PLAN_ID` が正しく設定されているか確認。`PAYPAL_MODE=sandbox` でテストを。

**Q: ビデオ会議が起動しない**  
A: Jitsi MeetはHTTPS必須。localhostでは動作しない場合あり。本番デプロイ後にテストを。

**Q: D1のデータが消えた**  
A: `--local` フラグなしで `wrangler dev` を実行すると本番DBに接続。ローカル開発では `--local` を使う。
