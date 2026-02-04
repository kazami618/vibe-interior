/**
 * Cleanup orphaned Amazon products from Firestore
 *
 * Deletes Amazon products that exist in Firestore but not in the spreadsheet
 */

import { config } from 'dotenv';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

config({ path: '.env.local' });

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SERVICE_ACCOUNT_KEY_PATH = process.env.SERVICE_ACCOUNT_KEY_PATH || './serviceAccountKey.json';

if (getApps().length === 0) {
  const serviceAccount = JSON.parse(
    readFileSync(join(process.cwd(), SERVICE_ACCOUNT_KEY_PATH), 'utf-8')
  );
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

async function main() {
  console.log('🧹 Amazon商品クリーンアップ開始\n');

  // 1. スプレッドシートからASIN一覧を取得
  const serviceAccount = JSON.parse(
    readFileSync(join(process.cwd(), SERVICE_ACCOUNT_KEY_PATH), 'utf-8')
  );
  const auth = new JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID!, auth);
  await doc.loadInfo();

  const sheet = doc.sheetsByTitle['Amazon商品'];
  if (!sheet) {
    console.error('❌ Amazon商品シートが見つかりません');
    return;
  }

  await sheet.loadHeaderRow();
  const rows = await sheet.getRows();
  const validAsins = new Set(rows.map(r => r.get('asin')).filter(Boolean));
  console.log(`📋 スプレッドシート: ${validAsins.size}件のASIN`);

  // 2. FirestoreのAmazon商品を取得
  const snapshot = await db.collection('products')
    .where('source', '==', 'amazon')
    .get();

  console.log(`📦 Firestore: ${snapshot.size}件のAmazon商品\n`);

  // 3. スプレッドシートにないものを削除
  const toDelete: string[] = [];
  snapshot.docs.forEach(doc => {
    const asin = doc.data().asin;
    if (!validAsins.has(asin)) {
      toDelete.push(doc.id);
    }
  });

  console.log(`🗑️ 削除対象: ${toDelete.length}件\n`);

  if (toDelete.length === 0) {
    console.log('✅ クリーンアップ不要');
    return;
  }

  // バッチ削除
  const BATCH_SIZE = 400;
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = toDelete.slice(i, i + BATCH_SIZE);

    chunk.forEach(id => {
      batch.delete(db.collection('products').doc(id));
    });

    await batch.commit();
    console.log(`  削除完了: ${Math.min(i + BATCH_SIZE, toDelete.length)}/${toDelete.length}`);
  }

  console.log(`\n✅ ${toDelete.length}件を削除しました`);
}

main().catch(console.error);
