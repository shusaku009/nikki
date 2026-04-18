# こころ日記 🌿

落ち込みや不安の"きっかけ"を見つけるためのメンタルヘルス記録ツール

## 技術スタック

- **Next.js 15** (App Router)
- **Supabase** (PostgreSQL + Auth)
- **Vercel** (ホスティング)

---

## セットアップ手順

### 1. Supabase プロジェクト準備

1. [supabase.com](https://supabase.com) でプロジェクト作成
2. **SQL Editor** を開き `supabase-schema.sql` の内容を実行
3. **Authentication > Providers** で以下を有効化：
   - Email (Magic Link) → デフォルトでON
   - Google → Client ID / Secret を設定（任意）
4. **Authentication > URL Configuration** で以下を設定：
   - Site URL: `https://your-app.vercel.app`
   - Redirect URLs に追加: `https://your-app.vercel.app/auth/callback`
5. **Project Settings > API** から以下をコピー：
   - `Project URL`
   - `anon public` key

### 2. ローカル開発

```bash
# インストール
npm install

# 環境変数ファイルを作成
cp .env.local.example .env.local
# .env.local を編集してSupabaseのURLとキーを入力

# 開発サーバー起動
npm run dev
# → http://localhost:3000 で確認
```

### 3. Vercel デプロイ

```bash
# GitHubリポジトリ作成 & プッシュ
git init
git add .
git commit -m "feat: initial commit"
gh repo create kokoro-nikki --private --push

# Vercel にインポート
# 1. vercel.com > Add New Project > GitHubリポジトリを選択
# 2. Environment Variables に以下を追加:
#    NEXT_PUBLIC_SUPABASE_URL
#    NEXT_PUBLIC_SUPABASE_ANON_KEY
# 3. Deploy ボタンを押すだけ
```

---

## ファイル構成

```
kokoro-nikki/
├── app/
│   ├── page.tsx              # メインページ（記録フォーム＋一覧）
│   ├── layout.tsx            # ルートレイアウト
│   ├── globals.css           # グローバルCSS・CSS変数
│   ├── login/
│   │   └── page.tsx          # ログインページ（Magic Link + Google）
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts      # OAuthコールバック処理
│   └── api/
│       └── records/
│           └── route.ts      # Records API (GET / POST / DELETE)
├── lib/
│   ├── supabase.ts           # Supabaseクライアント（ブラウザ用）
│   └── supabase-server.ts    # Supabaseクライアント（サーバー用）
├── types/
│   └── index.ts              # 型定義
├── middleware.ts              # 認証ルーティングガード
├── supabase-schema.sql       # DBスキーマ（Supabaseで実行）
└── .env.local.example        # 環境変数テンプレート
```
