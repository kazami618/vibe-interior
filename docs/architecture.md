# アーキテクチャ設計

## システム全体構成

```
┌─────────────────────────────────────────────────────────────┐
│                         Client (Browser)                     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │         Next.js App (App Router)                   │    │
│  │  - TypeScript                                      │    │
│  │  - Shadcn/UI + Tailwind CSS (Dark mode)          │    │
│  │  - Firebase SDK (Auth, Storage, Firestore)        │    │
│  └────────────────────────────────────────────────────┘    │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ HTTPS
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                    Firebase Services                         │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Hosting    │  │   Storage    │  │  Firestore   │     │
│  │  (Next.js)   │  │  (画像保存)   │  │  (DB)        │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │           Firebase Functions                        │    │
│  │                                                     │    │
│  │  ┌──────────────────────────────────────────┐     │    │
│  │  │      Firebase Genkit                     │     │    │
│  │  │                                          │     │    │
│  │  │  ┌────────────────────────────────┐    │     │    │
│  │  │  │   AI Adapters (Interface)     │    │     │    │
│  │  │  │                                │    │     │    │
│  │  │  │  ┌─────────────────────────┐  │    │     │    │
│  │  │  │  │ NanoBananaProAdapter    │  │    │     │    │
│  │  │  │  │ (Gemini 3 Pro Image)    │  │    │     │    │
│  │  │  │  │ - 画像生成               │  │    │     │    │
│  │  │  │  │ - reference_images使用   │  │    │     │    │
│  │  │  │  └─────────────────────────┘  │    │     │    │
│  │  │  │                                │    │     │    │
│  │  │  │  ┌─────────────────────────┐  │    │     │    │
│  │  │  │  │ Gemini3MultimodalAdapter│  │    │     │    │
│  │  │  │  │ (Gemini 3.0 Pro)        │  │    │     │    │
│  │  │  │  │ - 家具推薦               │  │    │     │    │
│  │  │  │  │ - RAG検索                │  │    │     │    │
│  │  │  │  └─────────────────────────┘  │    │     │    │
│  │  │  └────────────────────────────────┘    │     │    │
│  │  └──────────────────────────────────────────┘     │    │
│  └────────────────────────────────────────────────────┘    │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ API
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                  External APIs                               │
│                                                              │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │ Gemini API   │         │ 楽天/Amazon   │                 │
│  │ (Google AI)  │         │ Product API  │                 │
│  └──────────────┘         └──────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

## アダプターパターンによるAI抽象化

### 設計思想
将来的にAIモデルを切り替えられるように、アダプターパターンを採用します。各AIモデルは共通インターフェースを実装し、ビジネスロジックからモデルの詳細を隠蔽します。

### ディレクトリ構造
```
functions/src/ai/
├── adapters/
│   ├── ImageGenerationAdapter.ts      # 画像生成の共通インターフェース
│   ├── FurnitureRecommendationAdapter.ts  # 家具推薦の共通インターフェース
│   ├── NanoBananaProAdapter.ts        # Gemini 3 Pro Image実装
│   └── Gemini3MultimodalAdapter.ts    # Gemini 3.0 Pro実装
├── services/
│   ├── ImageGenerationService.ts      # 画像生成のビジネスロジック
│   └── FurnitureRecommendationService.ts  # 家具推薦のビジネスロジック
└── config.ts                          # AI設定（モデル選択）
```

### インターフェース定義

#### ImageGenerationAdapter
```typescript
interface ImageGenerationAdapter {
  generateInteriorDesign(
    roomImage: Buffer,
    furnitureReferences: FurnitureReference[],
    options?: GenerationOptions
  ): Promise<GeneratedImage>;
}
```

#### FurnitureRecommendationAdapter
```typescript
interface FurnitureRecommendationAdapter {
  recommendFurniture(
    generatedImage: Buffer,
    style?: string
  ): Promise<FurnitureRecommendation[]>;
}
```

### アダプター実装

#### NanoBananaProAdapter (画像生成)
- **使用モデル**: Gemini 3 Pro Image
- **主な機能**:
  - 部屋画像を入力として受け取る
  - `reference_images` パラメータで家具の一貫性を維持
  - プロンプトエンジニアリングで家具配置を制御
  - 生成画像をFirebase Storageに保存

#### Gemini3MultimodalAdapter (家具推薦)
- **使用モデル**: Gemini 3.0 Pro
- **主な機能**:
  - 生成された画像から家具を検出
  - RAG (Retrieval-Augmented Generation) で商品カタログを検索
  - 楽天/Amazon APIと連携して実在商品を取得
  - 類似度スコアリングによる推薦

## データフロー

### 1. ユーザーが画像をアップロード
```
User → Next.js App → Firebase Storage
                  → Firestore (metadata保存)
```

### 2. AI生成リクエスト
```
User → Next.js App → Firebase Functions
                  → NanoBananaProAdapter
                  → Gemini 3 Pro Image API
                  → 生成画像をStorageに保存
                  → Firestoreにデザイン情報を保存
```

### 3. 家具推薦
```
Firebase Functions → Gemini3MultimodalAdapter
                  → Gemini 3.0 Pro API (RAG)
                  → 楽天/Amazon Product API
                  → Firestoreに推薦情報を保存
```

### 4. 結果表示
```
Next.js App → Firestore (デザイン取得)
           → Firebase Storage (画像取得)
           → User (表示)
```

## セキュリティ設計

### Firebase Security Rules

#### Firestore Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ユーザーは自分のデータのみアクセス可能
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // デザインも同様
    match /designs/{designId} {
      allow read, write: if request.auth != null &&
        resource.data.userId == request.auth.uid;
    }

    // 商品情報は全ユーザーが閲覧可能
    match /products/{productId} {
      allow read: if request.auth != null;
      allow write: if false; // 管理者のみ
    }
  }
}
```

#### Storage Rules
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## スケーラビリティ設計

### Firestore インデックス
- `designs` コレクション: `userId` + `createdAt` (複合インデックス)
- `products` コレクション: `category` + `price` (複合インデックス)

### Firebase Functions 最適化
- タイムアウト設定: 540秒（9分）
- メモリ割り当て: 2GB（画像処理用）
- 同時実行制限: ユーザーあたり1リクエスト

### キャッシュ戦略
- Next.jsの `revalidate` でISR（Incremental Static Regeneration）
- 商品カタログはFirestoreにキャッシュ（24時間TTL）

## モニタリング

### Firebase Analytics
- ユーザー行動追跡
- 画像生成成功率
- エラー発生率

### Cloud Logging
- Functions実行ログ
- AI APIレスポンス時間
- エラートレース

## デプロイ戦略

### CI/CD
- GitHub Actionsでデプロイ自動化
- ステージング環境（Firebase Hosting Preview）
- 本番環境への段階的ロールアウト

### 環境分離
- `development`: ローカル開発（Emulator使用）
- `staging`: テスト環境
- `production`: 本番環境
