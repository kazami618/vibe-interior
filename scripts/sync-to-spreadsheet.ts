/**
 * Firestoreの商品データをGoogleスプレッドシートに同期するスクリプト
 */

import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { readFileSync } from 'fs';
import { join } from 'path';

config({ path: '.env.local' });

const SERVICE_ACCOUNT_KEY_PATH = process.env.SERVICE_ACCOUNT_KEY_PATH || './serviceAccountKey.json';
const SPREADSHEET_ID = '1PVdt4nE-ZXkIsKI42mW0vdeEEDe82WfxLeBIr7QwlFk';

if (getApps().length === 0) {
  const serviceAccount = JSON.parse(
    readFileSync(join(process.cwd(), SERVICE_ACCOUNT_KEY_PATH), 'utf-8')
  );
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

async function syncToSpreadsheet() {
  console.log('📊 Syncing Firestore products to Google Spreadsheet...\n');

  // Firestoreから全商品を取得
  const snapshot = await db.collection('products').where('isActive', '==', true).get();
  console.log(`✓ Found ${snapshot.size} active products in Firestore`);

  // スプレッドシートに接続
  const serviceAccount = JSON.parse(
    readFileSync(join(process.cwd(), SERVICE_ACCOUNT_KEY_PATH), 'utf-8')
  );

  const auth = new JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth);
  await doc.loadInfo();
  console.log(`✓ Connected to spreadsheet: ${doc.title}`);

  // 最初のシートを取得
  let sheet = doc.sheetsByIndex[0];
  if (!sheet) {
    sheet = await doc.addSheet({ title: '商品データ' });
  }

  // ヘッダー行を設定
  const headers = [
    'name',
    'price',
    'imageUrl',
    'affiliateLink',
    'category',
    'vibe',
    'tags',
    'keywords',
    'shopName',
    'reviewAverage',
    'reviewCount',
    'rakutenItemCode',
    'productId',
    'updatedAt',
  ];

  // シートをクリアして書き込み
  await sheet.clear();
  await sheet.setHeaderRow(headers);

  // データ行を追加
  const rows = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      name: data.name || '',
      price: data.price || 0,
      imageUrl: data.imageUrl || '',
      affiliateLink: data.affiliateUrl || data.affiliateLink || '',
      category: data.category || '',
      vibe: data.vibe || '',
      tags: Array.isArray(data.tags) ? data.tags.join(',') : '',
      keywords: Array.isArray(data.keywords) ? data.keywords.join(',') : '',
      shopName: data.shopName || '',
      reviewAverage: data.reviewAverage || 0,
      reviewCount: data.reviewCount || 0,
      rakutenItemCode: data.rakutenItemCode || '',
      productId: doc.id,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    };
  });

  await sheet.addRows(rows);
  console.log(`\n✅ Synced ${rows.length} products to spreadsheet`);
  console.log(`\n📎 Spreadsheet URL: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`);
}

syncToSpreadsheet().catch(console.error);
