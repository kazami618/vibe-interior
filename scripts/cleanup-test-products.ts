/**
 * テストデータ（架空URLの商品）を削除するスクリプト
 */

import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

config({ path: '.env.local' });

const SERVICE_ACCOUNT_KEY_PATH = process.env.SERVICE_ACCOUNT_KEY_PATH || './serviceAccountKey.json';

if (getApps().length === 0) {
  const serviceAccount = JSON.parse(
    readFileSync(join(process.cwd(), SERVICE_ACCOUNT_KEY_PATH), 'utf-8')
  );
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

async function cleanupTestProducts() {
  console.log('🧹 Cleaning up test products (with example.com URLs)...\n');

  const snapshot = await db.collection('products').get();
  const batch = db.batch();
  let deleteCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    // 架空URLを持つ商品または楽天以外のソースの商品を削除
    const imageUrl = data.imageUrl || '';
    const affiliateUrl = data.affiliateUrl || data.affiliateLink || '';

    const isFakeUrl =
      imageUrl.includes('example.com') ||
      affiliateUrl.includes('example.com') ||
      (!doc.id.startsWith('rakuten_') && data.source !== 'rakuten');

    if (isFakeUrl) {
      console.log(`  🗑️ Deleting: ${data.name?.substring(0, 40)}...`);
      batch.delete(doc.ref);
      deleteCount++;
    }
  }

  if (deleteCount > 0) {
    await batch.commit();
    console.log(`\n✅ Deleted ${deleteCount} test products`);
  } else {
    console.log('\n✓ No test products found to delete');
  }

  // 残りの商品数を表示
  const remaining = await db.collection('products').count().get();
  console.log(`\n📦 Remaining products: ${remaining.data().count}`);
}

cleanupTestProducts().catch(console.error);
