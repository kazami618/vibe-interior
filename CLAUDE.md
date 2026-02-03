# Vibe Interior - AI インテリアコーディネーター

## プロジェクト概要
ユーザーが部屋の画像をアップロードすると、AIが実在する家具（楽天/Amazon）を配置した改装イメージを生成し、購入リンクを提案するWebサービスのMVP。

## 技術スタック
- **Frontend**: Next.js 15 (App Router, TypeScript)
- **UI**: Shadcn/UI, Tailwind CSS (Dark mode default)
- **Backend**: Firebase (Firestore, Auth, Storage, Functions)
- **AI Logic**: Firebase Genkit
- **Deploy**: Firebase Hosting

## プロジェクト構造
```
vibe-interior/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   ├── (auth)/            # 認証関連ページ
│   ├── design/            # デザイン作成・表示
│   └── layout.tsx         # ルートレイアウト
├── components/            # Reactコンポーネント
│   ├── ui/               # Shadcn/UIコンポーネント
│   └── features/         # 機能別コンポーネント
├── functions/             # Firebase Functions
│   └── src/
│       ├── ai/
│       │   ├── adapters/  # AIアダプター（アダプターパターン）
│       │   └── services/  # AI処理ロジック
│       └── index.ts
├── lib/                   # ユーティリティ・共通関数
├── docs/                  # ドキュメント
│   ├── requirements.md
│   ├── architecture.md
│   └── schema.md
├── public/                # 静的ファイル
└── firebase.json          # Firebase設定
```

## 開発フロー
1. **ドキュメント駆動**: 新機能は `docs/` に仕様を追加してから実装
2. **アダプターパターン**: AIモデルは `functions/src/ai/adapters/` で抽象化
3. **型安全性**: TypeScriptの厳格なモードを使用
4. **ダークモード**: UIはデフォルトでダークモード

## セットアップ
```bash
# 依存関係のインストール
npm install

# Firebase Emulator起動
npm run emulator

# 開発サーバー起動
npm run dev
```

## 主要なAIアダプター
- `NanoBananaProAdapter`: Gemini 3 Pro Imageを使用した画像生成
- `Gemini3MultimodalAdapter`: Gemini 3.0 Proを使用した家具推薦（RAG対応）

## デプロイ
```bash
# Firebaseにデプロイ
npm run deploy
```

## 詳細ドキュメント
- [要件定義](./docs/requirements.md)
- [アーキテクチャ設計](./docs/architecture.md)
- [データスキーマ](./docs/schema.md)
