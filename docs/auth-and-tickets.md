# ユーザー認証とチケット管理システム

## 概要
Googleログイン認証と、デザイン作成に必要なチケットシステムを実装しています。

## 機能

### 1. Google認証
- **プロバイダー**: Google OAuth 2.0
- **ライブラリ**: Firebase Authentication
- **実装場所**: `lib/auth.tsx`

### 2. チケットシステム
- **初回ボーナス**: 新規登録時に3チケット付与
- **リアルタイム監視**: Firestoreの`onSnapshot`でチケット残高を即座に反映
- **履歴管理**: `ticketLogs`サブコレクションで全ての増減履歴を記録

## データ構造

### `users/{uid}`
```typescript
{
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  ticketBalance: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### `users/{uid}/ticketLogs/{logId}`
```typescript
{
  amount: number;
  reason: 'signup_bonus' | 'purchase' | 'design_creation' | 'admin_grant';
  description?: string;
  createdAt: Timestamp;
}
```

## Cloud Functions

### `onUserCreated`
- **トリガー**: `functions.auth.user().onCreate`
- **処理内容**:
  1. `users/{uid}` ドキュメントを作成
  2. `ticketBalance: 3` を設定
  3. `ticketLogs` に初回ボーナスの履歴を記録

**デプロイコマンド:**
```bash
cd functions
npm run build
firebase deploy --only functions:onUserCreated
```

## UI コンポーネント

### Header (`components/layout/Header.tsx`)
- **未ログイン時**: 「Googleでログイン」ボタン
- **ログイン時**:
  - チケット残高表示（リアルタイム更新）
  - ユーザーアバター
  - ログアウトボタン

## セットアップ手順

### 1. Firebase Authentication の設定
1. Firebase Console > Authentication
2. Sign-in method > Google を有効化

### 2. Cloud Functions のデプロイ
```bash
cd functions
npm install
npm run build
firebase deploy --only functions:onUserCreated
```

### 3. Firestore セキュリティルールのデプロイ
```bash
firebase deploy --only firestore:rules
```

### 4. 開発サーバーの起動
```bash
npm run dev
```

## セキュリティルール

### users コレクション
- **Read**: 本人のみ
- **Create**: Cloud Functions のみ
- **Update**: 本人のみ
- **Delete**: 不可

### ticketLogs サブコレクション
- **Read**: 本人のみ
- **Write**: Cloud Functions のみ

## 使用例

### 認証状態の取得
```tsx
import { useAuth } from '@/lib/auth';

function MyComponent() {
  const { user, userData, loading, signInWithGoogle, signOut } = useAuth();

  if (loading) return <div>読み込み中...</div>;

  return (
    <div>
      {user ? (
        <>
          <p>チケット残高: {userData?.ticketBalance}</p>
          <button onClick={signOut}>ログアウト</button>
        </>
      ) : (
        <button onClick={signInWithGoogle}>ログイン</button>
      )}
    </div>
  );
}
```

## 今後の拡張

### チケット消費
デザイン作成時にチケットを消費する処理を追加：
```typescript
// Cloud Functions (Callable Function)
export const createDesign = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new Error('Unauthorized');

  const uid = context.auth.uid;
  const userRef = db.collection('users').doc(uid);

  // トランザクションでチケット消費
  await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    const currentBalance = userDoc.data()?.ticketBalance || 0;

    if (currentBalance < 1) {
      throw new Error('チケットが不足しています');
    }

    transaction.update(userRef, {
      ticketBalance: currentBalance - 1,
    });

    transaction.create(userRef.collection('ticketLogs').doc(), {
      amount: -1,
      reason: 'design_creation',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  // デザイン生成処理...
});
```

### チケット購入
Stripe等の決済システムと連携してチケットを購入できるようにする。
