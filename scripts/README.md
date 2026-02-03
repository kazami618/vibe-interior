# Scripts

## 商品データ同期スクリプト

### 概要
Googleスプレッドシートから家具データを取得し、Firestoreの`products`コレクションに同期（Upsert）します。

### セットアップ

#### 1. サービスアカウントキーの取得
1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. プロジェクトを選択
3. **IAM & Admin** > **Service Accounts** に移動
4. サービスアカウントを選択（または新規作成）
5. **Keys** タブ > **Add Key** > **Create new key** > **JSON** を選択
6. ダウンロードしたJSONファイルをプロジェクトルートに `serviceAccountKey.json` として保存

#### 2. スプレッドシートの準備
スプレッドシートに以下の列を用意してください：

| name | price | imageUrl | affiliateLink | category | tags | vibe |
|------|-------|----------|---------------|----------|------|------|
| ソファ | 29800 | https://... | https://... | ソファ | モダン,リビング | ミニマル |

- **affiliateLink**: 商品のアフィリエイトリンク（重複防止のIDとして使用）
- **tags**: カンマ区切りで複数指定可能（例: `モダン,リビング,北欧`）

#### 3. 環境変数の設定
`.env.local` に以下を追加：

```env
SPREADSHEET_ID=your_spreadsheet_id_here
SERVICE_ACCOUNT_KEY_PATH=./serviceAccountKey.json
```

**SPREADSHEET_ID の取得方法:**
スプレッドシートのURLから取得します。
```
https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
```

#### 4. スプレッドシートの共有設定
サービスアカウントのメールアドレス（`serviceAccountKey.json`の`client_email`）に、スプレッドシートの閲覧権限を付与してください。

### 実行方法

```bash
npm run db:sync
```

### 動作
- 既存の商品（同じaffiliateLinkを持つ）は更新（Update）
- 新しい商品は追加（Insert）
- `affiliateLink`をBase64エンコードしてFirestoreのドキュメントIDとして使用
- `createdAt`は新規作成時のみ設定、`updatedAt`は常に更新

### トラブルシューティング

#### エラー: "SPREADSHEET_ID is not set"
→ `.env.local`に`SPREADSHEET_ID`が設定されているか確認

#### エラー: "Failed to authenticate Google Sheets"
→ サービスアカウントキーのパスが正しいか、スプレッドシートの共有設定を確認

#### エラー: "Failed to initialize Firebase Admin"
→ `serviceAccountKey.json`が正しい場所にあるか確認
