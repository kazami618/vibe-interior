# 部屋づくりAI - AIインテリアコーディネーター

<div align="center">

**部屋の写真をアップロードするだけで、AIが実在する家具を配置した改装イメージを生成**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-orange?logo=firebase)](https://firebase.google.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)

🌐 **https://room-setup.com**

</div>

## 📖 概要

部屋づくりAIは、ユーザーが部屋の画像をアップロードするだけで、AIが実在する家具（楽天/Amazon）を配置した改装イメージを自動生成し、そのまま購入できるリンクを提案するWebサービスです。

### 主な機能

- 🏠 **部屋画像のアップロード**: 簡単に部屋の写真をアップロード
- 🤖 **AI画像生成**: Gemini 3 Pro Imageで改装イメージを生成
- 🛋️ **家具推薦**: Gemini 3.0 ProとRAGで実在商品を推薦
- 🛒 **購入リンク**: 楽天/Amazonの商品ページへ直接アクセス
- 🌙 **ダークモード**: デフォルトでダークモード対応

## 🚀 技術スタック

- **Frontend**: Next.js 15 (App Router, TypeScript)
- **UI**: Shadcn/UI, Tailwind CSS
- **Backend**: Firebase (Firestore, Auth, Storage, Functions)
- **AI**: Firebase Genkit, Gemini 3 Pro Image, Gemini 3.0 Pro
- **Deploy**: Firebase Hosting

## 📁 プロジェクト構造

```
vibe-interior/
├── app/                    # Next.js App Router
├── components/             # Reactコンポーネント
│   └── ui/                # Shadcn/UIコンポーネント
├── functions/              # Firebase Functions
│   └── src/
│       └── ai/
│           ├── adapters/   # AIアダプター（アダプターパターン）
│           └── services/   # AI処理ロジック
├── lib/                    # ユーティリティ・共通関数
├── docs/                   # ドキュメント
│   ├── requirements.md
│   ├── architecture.md
│   └── schema.md
└── public/                 # 静的ファイル
```

## 🛠️ セットアップ

### 必要要件

- Node.js 20以上
- Firebase CLI
- Firebaseプロジェクト

### インストール

1. リポジトリをクローン

```bash
git clone https://github.com/yourusername/vibe-interior.git
cd vibe-interior
```

2. 依存関係をインストール

```bash
npm install
cd functions && npm install && cd ..
```

3. 環境変数を設定

```bash
cp .env.local.example .env.local
```

`.env.local`に Firebase の設定情報を入力してください。

4. Firebase にログイン

```bash
firebase login
```

### 開発サーバーの起動

```bash
# Firebase Emulator を起動（別ターミナル）
npm run emulator

# Next.js 開発サーバーを起動
npm run dev
```

ブラウザで http://localhost:3000 を開いてください。

## 📚 ドキュメント

詳細なドキュメントは `docs/` ディレクトリにあります：

- [要件定義](./docs/requirements.md)
- [アーキテクチャ設計](./docs/architecture.md)
- [データスキーマ](./docs/schema.md)

## 🧪 テスト

```bash
npm run test
```

## 🚢 デプロイ

```bash
npm run deploy
```

## 🤝 コントリビューション

プルリクエストを歓迎します！大きな変更の場合は、まずissueを開いて変更内容を議論してください。

## 📄 ライセンス

MIT

## 👥 作成者

部屋づくりAI Development Team

---

Made with ❤️ using Next.js, Firebase, and Gemini AI
