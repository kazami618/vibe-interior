# Firestoreデータスキーマ

## コレクション構造

```
firestore/
├── users/
│   └── {userId}/
│       ├── profile (document)
│       └── settings (document)
├── designs/
│   └── {designId}/
│       ├── metadata (document)
│       └── furnitureItems/ (subcollection)
│           └── {itemId}
└── products/
    └── {productId} (document)
```

## 詳細スキーマ

### 1. `users` コレクション

ユーザーの基本情報と設定を保存します。

#### `users/{userId}` ドキュメント
```typescript
interface User {
  userId: string;              // Firebase Auth UID
  email: string;               // メールアドレス
  displayName: string | null;  // 表示名
  photoURL: string | null;     // プロフィール画像URL
  createdAt: Timestamp;        // アカウント作成日時
  lastLoginAt: Timestamp;      // 最終ログイン日時
  subscription: {
    plan: 'free' | 'premium';  // プラン種別
    generationCount: number;   // 今月の生成回数
    generationLimit: number;   // 月間生成上限
    resetDate: Timestamp;      // リセット日時
  };
  preferences: {
    theme: 'dark' | 'light';   // テーマ設定
    language: 'ja' | 'en';     // 言語設定
  };
}
```

**インデックス**:
- `email` (単一フィールド)
- `createdAt` (単一フィールド)

---

### 2. `designs` コレクション

生成されたインテリアデザインを保存します。

#### `designs/{designId}` ドキュメント
```typescript
interface Design {
  designId: string;            // デザインID（自動生成）
  userId: string;              // 所有ユーザーID
  title: string;               // デザインタイトル
  description?: string;        // 説明（オプション）

  // 画像関連
  originalImageUrl: string;    // 元の部屋画像URL (Storage)
  generatedImageUrl: string;   // 生成された画像URL (Storage)
  thumbnailUrl: string;        // サムネイル画像URL (Storage)

  // AI生成情報
  aiModel: {
    imageGeneration: string;   // 使用した画像生成モデル名
    furnitureRecommendation: string; // 使用した家具推薦モデル名
  };
  generationOptions: {
    style?: string;            // スタイル指定（将来拡張）
    roomType?: string;         // 部屋タイプ（リビング、寝室など）
  };

  // ステータス
  status: 'processing' | 'completed' | 'failed';
  processingSteps: {
    imageUpload: 'pending' | 'completed';
    imageGeneration: 'pending' | 'processing' | 'completed' | 'failed';
    furnitureRecommendation: 'pending' | 'processing' | 'completed' | 'failed';
  };
  errorMessage?: string;       // エラーメッセージ（失敗時）

  // メタデータ
  createdAt: Timestamp;        // 作成日時
  updatedAt: Timestamp;        // 更新日時
  isFavorite: boolean;         // お気に入りフラグ（将来拡張）
  viewCount: number;           // 閲覧回数
}
```

**インデックス**:
- `userId` + `createdAt` (複合インデックス、降順)
- `userId` + `status` (複合インデックス)
- `userId` + `isFavorite` (複合インデックス)

---

#### `designs/{designId}/furnitureItems/{itemId}` サブコレクション

デザイン内の各家具アイテムを保存します。

```typescript
interface FurnitureItem {
  itemId: string;              // アイテムID（自動生成）
  productId: string;           // products コレクションへの参照

  // 配置情報
  position: {
    x: number;                 // X座標（0-1の正規化座標）
    y: number;                 // Y座標（0-1の正規化座標）
  };
  category: string;            // カテゴリ（ソファ、テーブルなど）

  // 推薦情報
  recommendations: Array<{
    productId: string;         // 推薦商品ID
    score: number;             // 類似度スコア (0-1)
    reason: string;            // 推薦理由
  }>;

  // メタデータ
  addedAt: Timestamp;          // 追加日時
}
```

**インデックス**:
- `category` (単一フィールド)

---

### 3. `products` コレクション

楽天/Amazonから取得した商品情報をキャッシュします。

#### `products/{productId}` ドキュメント
```typescript
interface Product {
  productId: string;           // 商品ID（楽天/AmazonのID）
  source: 'rakuten' | 'amazon'; // 商品ソース

  // 基本情報
  name: string;                // 商品名
  description: string;         // 商品説明
  category: string;            // カテゴリ
  subcategory?: string;        // サブカテゴリ

  // 価格情報
  price: number;               // 価格（円）
  currency: 'JPY';             // 通貨
  discountPrice?: number;      // 割引価格（オプション）

  // 画像
  imageUrls: string[];         // 商品画像URL配列
  thumbnailUrl: string;        // サムネイル画像URL

  // リンク
  affiliateUrl: string;        // アフィリエイトリンク
  directUrl: string;           // 直リンク

  // 詳細情報
  brand?: string;              // ブランド名
  dimensions?: {
    width: number;             // 幅（cm）
    height: number;            // 高さ（cm）
    depth: number;             // 奥行き（cm）
  };
  color?: string[];            // 色バリエーション
  material?: string[];         // 素材

  // レビュー
  rating?: number;             // 評価（1-5）
  reviewCount?: number;        // レビュー数

  // AI検索用
  embeddingVector?: number[];  // 埋め込みベクトル（RAG用）
  keywords: string[];          // 検索キーワード

  // メタデータ
  createdAt: Timestamp;        // 登録日時
  updatedAt: Timestamp;        // 更新日時
  cacheExpiry: Timestamp;      // キャッシュ有効期限（24時間）
  isActive: boolean;           // 商品が有効かどうか
}
```

**インデックス**:
- `category` + `price` (複合インデックス)
- `source` + `category` (複合インデックス)
- `keywords` (配列要素インデックス)
- `cacheExpiry` (単一フィールド、TTL設定)

---

## セキュリティルール

### Firestore Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ヘルパー関数
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    // users コレクション
    match /users/{userId} {
      allow read: if isOwner(userId);
      allow create: if isOwner(userId);
      allow update: if isOwner(userId);
      allow delete: if false; // ユーザー削除は管理コンソールから
    }

    // designs コレクション
    match /designs/{designId} {
      allow read: if isAuthenticated() &&
        resource.data.userId == request.auth.uid;
      allow create: if isAuthenticated() &&
        request.resource.data.userId == request.auth.uid;
      allow update: if isAuthenticated() &&
        resource.data.userId == request.auth.uid;
      allow delete: if isAuthenticated() &&
        resource.data.userId == request.auth.uid;

      // furnitureItems サブコレクション
      match /furnitureItems/{itemId} {
        allow read, write: if isAuthenticated() &&
          get(/databases/$(database)/documents/designs/$(designId)).data.userId == request.auth.uid;
      }
    }

    // products コレクション（全ユーザーが閲覧可能）
    match /products/{productId} {
      allow read: if isAuthenticated();
      allow write: if false; // Cloud Functionsからのみ書き込み可能
    }
  }
}
```

---

## Storage構造

```
gs://vibe-interior.appspot.com/
├── users/
│   └── {userId}/
│       └── originals/
│           └── {imageId}.jpg        # アップロードされた元画像
├── designs/
│   └── {designId}/
│       ├── generated.jpg            # 生成された画像
│       └── thumbnail.jpg            # サムネイル
└── products/
    └── cache/
        └── {productId}/
            └── {imageName}.jpg      # キャッシュされた商品画像
```

### Storage Rules
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    // ユーザーの元画像
    match /users/{userId}/originals/{imageId} {
      allow read: if isOwner(userId);
      allow write: if isOwner(userId) &&
        request.resource.size < 10 * 1024 * 1024 && // 10MB制限
        request.resource.contentType.matches('image/(jpeg|png)');
    }

    // デザイン画像
    match /designs/{designId}/{fileName} {
      allow read: if isAuthenticated();
      allow write: if false; // Cloud Functionsからのみ
    }

    // 商品画像キャッシュ
    match /products/cache/{allPaths=**} {
      allow read: if isAuthenticated();
      allow write: if false; // Cloud Functionsからのみ
    }
  }
}
```

---

## クエリ例

### ユーザーのデザイン一覧取得（最新順）
```typescript
const designsRef = collection(db, 'designs');
const q = query(
  designsRef,
  where('userId', '==', currentUserId),
  where('status', '==', 'completed'),
  orderBy('createdAt', 'desc'),
  limit(20)
);
const snapshot = await getDocs(q);
```

### カテゴリ別商品検索
```typescript
const productsRef = collection(db, 'products');
const q = query(
  productsRef,
  where('category', '==', 'sofa'),
  where('price', '<=', 50000),
  orderBy('price', 'asc'),
  limit(10)
);
const snapshot = await getDocs(q);
```

### デザインの家具アイテム取得
```typescript
const itemsRef = collection(db, `designs/${designId}/furnitureItems`);
const snapshot = await getDocs(itemsRef);
```

---

## データ移行・バックアップ

### 定期バックアップ
Firebase ConsoleからFirestoreの自動バックアップを有効化し、Cloud Storageバケットに保存します。

### データエクスポート
```bash
gcloud firestore export gs://vibe-interior-backups/$(date +%Y%m%d)
```

### データインポート
```bash
gcloud firestore import gs://vibe-interior-backups/20260203
```
