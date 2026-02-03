import { config } from 'dotenv';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Product, SpreadsheetRow } from '../lib/types/product';

// .env.local を読み込み
config({ path: '.env.local' });

// 環境変数の確認
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SERVICE_ACCOUNT_KEY_PATH = process.env.SERVICE_ACCOUNT_KEY_PATH || './serviceAccountKey.json';

if (!SPREADSHEET_ID) {
  console.error('❌ SPREADSHEET_ID is not set in environment variables');
  process.exit(1);
}

// Firebase Admin初期化
if (getApps().length === 0) {
  try {
    const serviceAccount = JSON.parse(
      readFileSync(join(process.cwd(), SERVICE_ACCOUNT_KEY_PATH), 'utf-8')
    );
    initializeApp({
      credential: cert(serviceAccount),
    });
    console.log(`✓ Firebase Admin initialized (Project: ${serviceAccount.project_id})`);
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error);
    process.exit(1);
  }
}

const db = getFirestore();
console.log(`✓ Firestore client initialized (Database: ${db.databaseId || '(default)'})`);

// Google Sheets認証
async function authenticateGoogleSheets() {
  try {
    const serviceAccount = JSON.parse(
      readFileSync(join(process.cwd(), SERVICE_ACCOUNT_KEY_PATH), 'utf-8')
    );

    const serviceAccountAuth = new JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const doc = new GoogleSpreadsheet(SPREADSHEET_ID!, serviceAccountAuth);
    await doc.loadInfo();
    console.log(`✓ Connected to spreadsheet: ${doc.title}`);
    return doc;
  } catch (error) {
    console.error('❌ Failed to authenticate Google Sheets:', error);
    throw error;
  }
}

// スプレッドシートからデータを取得
async function fetchProductsFromSheet(doc: GoogleSpreadsheet): Promise<Product[]> {
  const sheet = doc.sheetsByIndex[0]; // 最初のシートを使用
  await sheet.loadHeaderRow();
  const rows = await sheet.getRows<SpreadsheetRow>();

  console.log(`✓ Found ${rows.length} rows in spreadsheet`);

  const products: Product[] = [];

  for (const row of rows) {
    try {
      // 必須フィールドの検証
      if (!row.get('affiliateLink') || !row.get('name')) {
        console.warn('⚠ Skipping row with missing required fields:', {
          name: row.get('name'),
          affiliateLink: row.get('affiliateLink'),
        });
        continue;
      }

      const affiliateLink = row.get('affiliateLink') as string;
      const tags = row.get('tags') as string;

      const product: Product = {
        id: Buffer.from(affiliateLink).toString('base64').replace(/[^a-zA-Z0-9]/g, ''), // URLをBase64エンコードしてIDに変換
        name: row.get('name') as string,
        price: parseFloat(row.get('price') as string) || 0,
        imageUrl: row.get('imageUrl') as string || '',
        affiliateLink: affiliateLink,
        category: row.get('category') as string || 'その他',
        tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
        vibe: row.get('vibe') as string || '',
        updatedAt: new Date(),
      };

      products.push(product);
    } catch (error) {
      console.error('❌ Error processing row:', error);
    }
  }

  return products;
}

// Firestoreにデータを同期（Upsert）
async function syncToFirestore(products: Product[]) {
  const batch = db.batch();
  let upsertCount = 0;

  for (const product of products) {
    const docRef = db.collection('products').doc(product.id);

    try {
      const existingDoc = await docRef.get();

      if (existingDoc.exists) {
        // 既存ドキュメントを更新
        batch.update(docRef, {
          ...product,
          updatedAt: new Date(),
        });
        console.log(`↻ Updating: ${product.name}`);
      } else {
        // 新規ドキュメントを作成
        batch.set(docRef, {
          ...product,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log(`+ Creating: ${product.name}`);
      }
    } catch (error) {
      // エラーが発生した場合は新規作成として扱う（Firestore未初期化の場合など）
      console.log(`+ Creating (fallback): ${product.name}`);
      batch.set(docRef, {
        ...product,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    upsertCount++;
  }

  if (upsertCount > 0) {
    await batch.commit();
    console.log(`\n✓ Successfully synced ${upsertCount} products to Firestore`);
  } else {
    console.log('\n⚠ No products to sync');
  }
}

// メイン処理
async function main() {
  try {
    console.log('🚀 Starting product sync...\n');

    // Google Sheetsから取得
    const doc = await authenticateGoogleSheets();
    const products = await fetchProductsFromSheet(doc);

    if (products.length === 0) {
      console.log('⚠ No valid products found in spreadsheet');
      return;
    }

    // Firestoreに同期
    await syncToFirestore(products);

    console.log('\n✅ Product sync completed successfully!');
  } catch (error) {
    console.error('\n❌ Product sync failed:', error);
    process.exit(1);
  }
}

main();
