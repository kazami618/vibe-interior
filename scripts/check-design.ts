/**
 * 最新のデザインと使用された商品を確認するスクリプト
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

async function checkLatestDesign() {
  console.log('🔍 Checking latest design...\n');

  // 最新のデザインを取得
  const designsSnapshot = await db
    .collection('designs')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();

  if (designsSnapshot.empty) {
    console.log('❌ No designs found');
    return;
  }

  for (const doc of designsSnapshot.docs) {
    const design = doc.data();
    console.log('═'.repeat(60));
    console.log(`\n📷 Design ID: ${doc.id}`);
    console.log(`   Status: ${design.status}`);
    console.log(`   Created: ${design.createdAt?.toDate?.()?.toLocaleString('ja-JP') || 'N/A'}`);
    console.log(`   Style: ${design.generationOptions?.style || 'N/A'}`);
    console.log(`   Target Items: ${design.generationOptions?.targetItems?.join(', ') || 'N/A'}`);
    console.log(`   Used Item IDs: ${design.usedItemIds?.length || 0} items`);

    if (design.usedItemIds && design.usedItemIds.length > 0) {
      console.log('\n   📦 Used Products:');
      for (const itemId of design.usedItemIds) {
        console.log(`      - ${itemId}`);
      }
    }

    // furnitureItems サブコレクションを確認
    const furnitureSnapshot = await doc.ref.collection('furnitureItems').get();

    if (!furnitureSnapshot.empty) {
      console.log(`\n   🪑 Furniture Items (${furnitureSnapshot.size} items):`);
      furnitureSnapshot.docs.forEach((itemDoc, index) => {
        const item = itemDoc.data();
        console.log(`\n   [${index + 1}] ${item.name}`);
        console.log(`       Category: ${item.category}`);
        console.log(`       Price: ¥${item.price?.toLocaleString() || 'N/A'}`);
        console.log(`       Reason: ${item.reason || 'N/A'}`);
        console.log(`       Product ID: ${item.productId}`);
        if (item.affiliateUrl) {
          console.log(`       Affiliate URL: ${item.affiliateUrl.substring(0, 50)}...`);
        }
      });
    } else {
      console.log('\n   ⚠ No furniture items in subcollection');
    }

    console.log('\n');
  }
}

checkLatestDesign().catch(console.error);
