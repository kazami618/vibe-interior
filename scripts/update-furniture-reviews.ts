/**
 * 既存デザインのfurnitureItemsにレビュー情報を追加するスクリプト
 * productsコレクションからreviewAverage/reviewCountを取得して更新
 */

import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

config({ path: '.env.local' });

if (getApps().length === 0) {
  const sa = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf-8'));
  initializeApp({ credential: cert(sa) });
}

const db = getFirestore();

async function updateFurnitureReviews() {
  console.log('🔄 Updating furniture items with review data...\n');

  // 全デザインを取得
  const designsSnapshot = await db.collection('designs').get();
  console.log(`Found ${designsSnapshot.size} designs`);

  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const designDoc of designsSnapshot.docs) {
    const furnitureItems = await designDoc.ref.collection('furnitureItems').get();

    if (furnitureItems.empty) continue;

    const batch = db.batch();
    let batchCount = 0;

    for (const itemDoc of furnitureItems.docs) {
      const itemData = itemDoc.data();

      // 既にレビューがある場合はスキップ
      if (itemData.reviewAverage !== undefined && itemData.reviewCount !== undefined) {
        totalSkipped++;
        continue;
      }

      // 商品名で商品を検索
      const productName = itemData.name;
      if (!productName) continue;

      // 商品コレクションから検索（名前で部分一致）
      const productsSnapshot = await db.collection('products')
        .where('isActive', '==', true)
        .limit(500)
        .get();

      // 名前が一致する商品を探す
      const matchingProduct = productsSnapshot.docs.find(doc => {
        const productData = doc.data();
        return productData.name === productName ||
               productData.name?.includes(productName?.substring(0, 30)) ||
               productName?.includes(productData.name?.substring(0, 30));
      });

      if (matchingProduct) {
        const productData = matchingProduct.data();
        batch.update(itemDoc.ref, {
          reviewAverage: productData.reviewAverage || 0,
          reviewCount: productData.reviewCount || 0,
        });
        batchCount++;
        totalUpdated++;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
      console.log(`✓ Updated ${batchCount} items in design ${designDoc.id}`);
    }
  }

  console.log(`\n✅ Updated ${totalUpdated} furniture items, skipped ${totalSkipped}`);
}

updateFurnitureReviews().catch(console.error);
