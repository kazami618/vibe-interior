/**
 * 商品データ マイグレーションスクリプト
 *
 * 既存の products コレクション（source別: rakuten/amazon）を
 * 新しい Product スキーマ（purchaseLinks[] 統合）に変換します。
 *
 * - 既存データは products_backup にバックアップ
 * - 既存の承認済み商品は status: 'approved' として移行
 * - 同一商品（名前類似 + カテゴリ一致）の purchaseLinks を統合
 *
 * 使用方法:
 *   npx tsx scripts/migrate-to-product-model.ts
 *   npx tsx scripts/migrate-to-product-model.ts --dry-run
 */

import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

config({ path: '.env.local' });

if (getApps().length === 0) {
  const sa = JSON.parse(readFileSync(join(process.cwd(), './serviceAccountKey.json'), 'utf-8'));
  initializeApp({ credential: cert(sa) });
}

const db = getFirestore();
const isDryRun = process.argv.includes('--dry-run');

// スタイルマッピング（vibe → DesignStyle）
const STYLE_MAP: Record<string, string> = {
  scandinavian: 'scandinavian',
  modern: 'modern',
  vintage: 'vintage',
  industrial: 'industrial',
  '北欧': 'scandinavian',
  'モダン': 'modern',
  'ヴィンテージ': 'vintage',
  'インダストリアル': 'industrial',
};

interface OldProduct {
  name: string;
  price?: number;
  imageUrl?: string;
  imageUrls?: string[];
  thumbnailUrl?: string;
  affiliateUrl?: string;
  affiliateLink?: string;
  category?: string;
  tags?: string[];
  keywords?: string[];
  vibe?: string;
  source?: string;
  asin?: string;
  rakutenItemCode?: string;
  reviewAverage?: number;
  reviewCount?: number;
  isActive?: boolean;
  description?: string;
  brand?: string;
  createdAt?: any;
  updatedAt?: any;
}

function normalizeStyle(vibe?: string): string {
  if (!vibe) return 'modern';
  const lower = vibe.toLowerCase();
  return STYLE_MAP[lower] || STYLE_MAP[vibe] || 'modern';
}

function normalizeName(name: string): string {
  return name
    .replace(/[\s　]+/g, '')
    .replace(/[【】\[\]「」（）()]/g, '')
    .toLowerCase()
    .slice(0, 50);
}

async function main() {
  console.log(`=== 商品データ マイグレーション ${isDryRun ? '(DRY RUN)' : ''} ===\n`);

  // 1. 既存データ取得
  const productsSnap = await db.collection('products').get();
  console.log(`既存商品数: ${productsSnap.size}`);

  if (productsSnap.empty) {
    console.log('移行対象の商品がありません。');
    return;
  }

  // 2. バックアップ
  if (!isDryRun) {
    console.log('\nバックアップ中...');
    const batchSize = 500;
    let batchCount = 0;
    let batch = db.batch();

    for (const doc of productsSnap.docs) {
      batch.set(db.collection('products_backup').doc(doc.id), doc.data());
      batchCount++;

      if (batchCount >= batchSize) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }
    if (batchCount > 0) await batch.commit();
    console.log(`バックアップ完了: ${productsSnap.size}件`);
  }

  // 3. 既存商品を変換
  const convertedProducts: Map<string, any> = new Map();
  const nameIndex: Map<string, string> = new Map(); // normalizedName → productId

  for (const doc of productsSnap.docs) {
    const old = doc.data() as OldProduct;
    const docId = doc.id;

    // 画像URLリストを構築
    const images: string[] = [];
    if (old.imageUrls?.length) {
      images.push(...old.imageUrls);
    } else if (old.imageUrl) {
      images.push(old.imageUrl);
    } else if (old.thumbnailUrl) {
      images.push(old.thumbnailUrl);
    }

    // PurchaseLink を構築
    const source = old.source || (old.asin ? 'amazon' : 'rakuten');
    const purchaseLink: any = {
      source,
      url: old.affiliateUrl || old.affiliateLink || '',
      affiliateUrl: old.affiliateUrl || old.affiliateLink || '',
      price: old.price || 0,
    };
    if (old.asin) purchaseLink.asin = old.asin;
    if (old.rakutenItemCode) purchaseLink.rakutenItemCode = old.rakutenItemCode;
    if (old.reviewAverage) purchaseLink.reviewAverage = old.reviewAverage;
    if (old.reviewCount) purchaseLink.reviewCount = old.reviewCount;

    // 重複チェック（名前の正規化で同一商品を検出）
    const normalizedName = normalizeName(old.name || '');
    const existingId = nameIndex.get(normalizedName);

    if (existingId && convertedProducts.has(existingId)) {
      // 既存商品にリンクを追加
      const existing = convertedProducts.get(existingId);
      const alreadyHasSource = existing.purchaseLinks.some(
        (l: any) => l.source === source
      );
      if (!alreadyHasSource) {
        existing.purchaseLinks.push(purchaseLink);
        // 画像の追加
        for (const img of images) {
          if (!existing.images.includes(img)) {
            existing.images.push(img);
          }
        }
      }
      continue;
    }

    // 新規商品
    const newProduct = {
      name: old.name || '',
      description: old.description || '',
      images,
      category: old.category || 'その他',
      style: normalizeStyle(old.vibe),
      tags: old.tags || old.keywords || [],
      brand: old.brand || '',
      purchaseLinks: [purchaseLink],
      status: 'approved', // 既存商品は承認済み
      createdAt: old.createdAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    convertedProducts.set(docId, newProduct);
    nameIndex.set(normalizedName, docId);
  }

  console.log(`\n変換結果: ${productsSnap.size}件 → ${convertedProducts.size}件（重複統合）`);

  // カテゴリ別統計
  const categoryStats: Record<string, number> = {};
  const styleStats: Record<string, number> = {};
  for (const [, product] of convertedProducts) {
    categoryStats[product.category] = (categoryStats[product.category] || 0) + 1;
    styleStats[product.style] = (styleStats[product.style] || 0) + 1;
  }
  console.log('\nカテゴリ別:');
  Object.entries(categoryStats).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });
  console.log('\nスタイル別:');
  Object.entries(styleStats).sort((a, b) => b[1] - a[1]).forEach(([style, count]) => {
    console.log(`  ${style}: ${count}`);
  });

  // 4. 書き込み
  if (!isDryRun) {
    console.log('\n書き込み中...');
    const batchSize = 500;
    let batchCount = 0;
    let batch = db.batch();
    let writeCount = 0;

    for (const [docId, product] of convertedProducts) {
      batch.set(db.collection('products').doc(docId), product, { merge: true });
      batchCount++;
      writeCount++;

      if (batchCount >= batchSize) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
        console.log(`  ${writeCount}/${convertedProducts.size}件 書き込み完了`);
      }
    }
    if (batchCount > 0) await batch.commit();
    console.log(`\n全${writeCount}件のマイグレーション完了`);
  } else {
    console.log('\n[DRY RUN] 書き込みはスキップされました');
  }
}

main().catch(console.error);
