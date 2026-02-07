/**
 * 候補商品の重複統合スクリプト
 *
 * status: 'candidate' の商品を検査し、
 * 重複を検出して purchaseLinks[] を統合します。
 *
 * 重複検出基準（優先順）:
 *   1. 同一ASIN（最高信頼度）
 *   2. 同一楽天ItemCode
 *   3. 商品名の類似性
 *
 * 使用方法:
 *   npx tsx scripts/collect/merge-candidates.ts
 *   npx tsx scripts/collect/merge-candidates.ts --dry-run
 */

import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

config({ path: '.env.local' });

// Firebase Admin 初期化
if (getApps().length === 0) {
  const sa = JSON.parse(readFileSync(join(process.cwd(), './serviceAccountKey.json'), 'utf-8'));
  initializeApp({ credential: cert(sa) });
}

const db = getFirestore();
const isDryRun = process.argv.includes('--dry-run');

// ============================================
// 型定義
// ============================================

interface PurchaseLink {
  source: 'amazon' | 'rakuten' | 'official' | 'other';
  url: string;
  affiliateUrl?: string;
  price?: number;
  asin?: string;
  rakutenItemCode?: string;
  reviewAverage?: number;
  reviewCount?: number;
}

interface CandidateProduct {
  docId: string;
  name: string;
  images: string[];
  category: string;
  style: string;
  tags: string[];
  brand: string;
  purchaseLinks: PurchaseLink[];
  status: string;
  collectedFrom?: string;
  createdAt?: any;
  updatedAt?: any;
  rawData: any; // 全フィールドを保持
}

interface MergeGroup {
  primary: CandidateProduct;
  duplicates: CandidateProduct[];
  matchReason: 'asin' | 'rakutenItemCode' | 'nameSimilarity';
}

// ============================================
// 名前類似性判定（外部依存なし）
// ============================================

/**
 * 比較用に名前を正規化
 */
function normalizeForComparison(name: string): string {
  return name
    .replace(/[\s　【】\[\]「」（）(){}＜＞<>]/g, '')
    .replace(/[！!？?。、,\.]/g, '')
    .toLowerCase()
    .replace(/ー/g, '-');
}

/**
 * 2つの商品名が類似しているか判定
 */
function isSimilarProduct(a: string, b: string): boolean {
  const normA = normalizeForComparison(a);
  const normB = normalizeForComparison(b);

  // 一方が他方を含む（異なるタイトル長への対応）
  if (normA.includes(normB) || normB.includes(normA)) return true;

  // 先頭30文字が一致（異なるサフィックス/説明文への対応）
  if (normA.slice(0, 30) === normB.slice(0, 30) && normA.length > 20) return true;

  return false;
}

// ============================================
// 重複検出
// ============================================

/**
 * 全候補商品から重複グループを検出
 */
function detectDuplicates(products: CandidateProduct[]): MergeGroup[] {
  const mergeGroups: MergeGroup[] = [];
  const processedIds = new Set<string>();

  // 1. ASIN によるグルーピング
  const asinIndex = new Map<string, CandidateProduct[]>();
  for (const product of products) {
    for (const link of product.purchaseLinks) {
      if (link.asin) {
        const group = asinIndex.get(link.asin) || [];
        group.push(product);
        asinIndex.set(link.asin, group);
      }
    }
  }

  for (const [, group] of asinIndex) {
    if (group.length < 2) continue;
    // 重複のうち未処理のもののみ
    const unprocessed = group.filter((p) => !processedIds.has(p.docId));
    if (unprocessed.length < 2) continue;

    const [primary, ...duplicates] = unprocessed;
    mergeGroups.push({ primary, duplicates, matchReason: 'asin' });

    for (const p of unprocessed) {
      processedIds.add(p.docId);
    }
  }

  // 2. 楽天ItemCode によるグルーピング
  const rakutenIndex = new Map<string, CandidateProduct[]>();
  for (const product of products) {
    if (processedIds.has(product.docId)) continue;
    for (const link of product.purchaseLinks) {
      if (link.rakutenItemCode) {
        const group = rakutenIndex.get(link.rakutenItemCode) || [];
        group.push(product);
        rakutenIndex.set(link.rakutenItemCode, group);
      }
    }
  }

  for (const [, group] of rakutenIndex) {
    if (group.length < 2) continue;
    const unprocessed = group.filter((p) => !processedIds.has(p.docId));
    if (unprocessed.length < 2) continue;

    const [primary, ...duplicates] = unprocessed;
    mergeGroups.push({ primary, duplicates, matchReason: 'rakutenItemCode' });

    for (const p of unprocessed) {
      processedIds.add(p.docId);
    }
  }

  // 3. 名前類似性によるグルーピング
  const remaining = products.filter((p) => !processedIds.has(p.docId));

  for (let i = 0; i < remaining.length; i++) {
    if (processedIds.has(remaining[i].docId)) continue;

    const currentGroup: CandidateProduct[] = [remaining[i]];

    for (let j = i + 1; j < remaining.length; j++) {
      if (processedIds.has(remaining[j].docId)) continue;

      if (isSimilarProduct(remaining[i].name, remaining[j].name)) {
        // カテゴリも一致するか確認（誤マッチ防止）
        if (remaining[i].category === remaining[j].category || remaining[i].category === 'その他' || remaining[j].category === 'その他') {
          currentGroup.push(remaining[j]);
        }
      }
    }

    if (currentGroup.length >= 2) {
      const [primary, ...duplicates] = currentGroup;
      mergeGroups.push({ primary, duplicates, matchReason: 'nameSimilarity' });

      for (const p of currentGroup) {
        processedIds.add(p.docId);
      }
    }
  }

  return mergeGroups;
}

// ============================================
// マージロジック
// ============================================

/**
 * 重複グループから統合商品データを作成
 */
function mergeProductGroup(group: MergeGroup): {
  mergedData: any;
  deleteDocIds: string[];
} {
  const allProducts = [group.primary, ...group.duplicates];

  // purchaseLinks の統合（source + url/asin/rakutenItemCode でユニーク化）
  const mergedLinks: PurchaseLink[] = [];
  const linkKeys = new Set<string>();

  for (const product of allProducts) {
    for (const link of product.purchaseLinks) {
      const key = `${link.source}:${link.asin || ''}:${link.rakutenItemCode || ''}:${link.url}`;
      if (!linkKeys.has(key)) {
        linkKeys.add(key);
        mergedLinks.push(link);
      }
    }
  }

  // 画像の統合（最も多い画像セットをベースに、残りを追加）
  const bestImages = allProducts.reduce((best, p) =>
    p.images.length > best.length ? p.images : best,
    [] as string[]
  );
  const mergedImages = [...bestImages];
  for (const product of allProducts) {
    for (const img of product.images) {
      if (!mergedImages.includes(img)) {
        mergedImages.push(img);
      }
    }
  }

  // カテゴリの選択（最も具体的なもの = 「その他」以外を優先）
  const bestCategory = allProducts
    .map((p) => p.category)
    .find((cat) => cat !== 'その他') || allProducts[0].category;

  // タグの統合（ユニオン）
  const mergedTags = [...new Set(allProducts.flatMap((p) => p.tags))];

  // ブランドの選択（空でないものを優先）
  const bestBrand = allProducts
    .map((p) => p.brand)
    .find((brand) => brand && brand.length > 0) || '';

  // スタイルの選択（空でないものを優先、デフォルトは primary のスタイル）
  const bestStyle = allProducts
    .map((p) => p.style)
    .find((style) => style && style.length > 0) || group.primary.style || 'modern';

  // createdAt は最も古いものを使用
  let earliestCreatedAt = group.primary.createdAt;
  for (const product of group.duplicates) {
    if (product.createdAt && earliestCreatedAt) {
      // Timestamp比較（toDate()が使えない場合はそのまま）
      try {
        const pDate = product.createdAt.toDate ? product.createdAt.toDate() : new Date(product.createdAt);
        const eDate = earliestCreatedAt.toDate ? earliestCreatedAt.toDate() : new Date(earliestCreatedAt);
        if (pDate < eDate) {
          earliestCreatedAt = product.createdAt;
        }
      } catch {
        // 比較できない場合は primary のものを使用
      }
    } else if (product.createdAt && !earliestCreatedAt) {
      earliestCreatedAt = product.createdAt;
    }
  }

  // collectedFrom は primary のものを優先
  const bestCollectedFrom = allProducts
    .map((p) => p.collectedFrom)
    .find((cf) => cf && cf.length > 0) || group.primary.collectedFrom;

  const mergedData = {
    name: group.primary.name,
    images: mergedImages,
    category: bestCategory,
    style: bestStyle,
    tags: mergedTags,
    brand: bestBrand,
    purchaseLinks: mergedLinks,
    status: 'candidate',
    collectedFrom: bestCollectedFrom,
    createdAt: earliestCreatedAt || FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  const deleteDocIds = group.duplicates.map((p) => p.docId);

  return { mergedData, deleteDocIds };
}

// ============================================
// メイン処理
// ============================================

async function main() {
  console.log('='.repeat(60));
  console.log(`  候補商品の重複統合 ${isDryRun ? '(DRY RUN)' : ''}`);
  console.log('='.repeat(60));

  // 1. 候補商品を取得
  console.log('\n[1/4] 候補商品を取得中...');
  const snapshot = await db
    .collection('products')
    .where('status', '==', 'candidate')
    .get();

  const candidates: CandidateProduct[] = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      docId: doc.id,
      name: data.name || '',
      images: data.images || [],
      category: data.category || 'その他',
      style: data.style || '',
      tags: data.tags || [],
      brand: data.brand || '',
      purchaseLinks: data.purchaseLinks || [],
      status: data.status || 'candidate',
      collectedFrom: data.collectedFrom,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      rawData: data,
    };
  });

  console.log(`  候補商品数: ${candidates.length}`);

  if (candidates.length === 0) {
    console.log('  統合対象の候補商品がありません。');
    return;
  }

  // 2. 重複グループを検出
  console.log('\n[2/4] 重複を検出中...');
  const mergeGroups = detectDuplicates(candidates);

  console.log(`  重複グループ数: ${mergeGroups.length}`);

  if (mergeGroups.length === 0) {
    console.log('  重複は検出されませんでした。');
    return;
  }

  // 重複グループの詳細表示
  let totalDuplicates = 0;
  const reasonCounts: Record<string, number> = {};

  for (const group of mergeGroups) {
    totalDuplicates += group.duplicates.length;
    reasonCounts[group.matchReason] = (reasonCounts[group.matchReason] || 0) + 1;
  }

  console.log(`  重複商品数: ${totalDuplicates}`);
  console.log(`  検出理由:`);
  for (const [reason, count] of Object.entries(reasonCounts)) {
    console.log(`    ${reason}: ${count}グループ`);
  }

  // 3. マージ実行
  console.log('\n[3/4] マージ処理中...');
  const mergeResults: { docId: string; mergedData: any; deleteDocIds: string[] }[] = [];

  for (let i = 0; i < mergeGroups.length; i++) {
    const group = mergeGroups[i];
    const { mergedData, deleteDocIds } = mergeProductGroup(group);

    console.log(`\n  グループ ${i + 1}/${mergeGroups.length} [${group.matchReason}]:`);
    console.log(`    主: "${group.primary.name.slice(0, 50)}..." (${group.primary.docId})`);
    for (const dup of group.duplicates) {
      console.log(`    重複: "${dup.name.slice(0, 50)}..." (${dup.docId})`);
    }
    console.log(`    統合リンク: ${mergedData.purchaseLinks.map((l: PurchaseLink) => l.source).join(', ')}`);
    console.log(`    統合画像数: ${mergedData.images.length}`);
    console.log(`    統合タグ: ${mergedData.tags.join(', ')}`);

    mergeResults.push({
      docId: group.primary.docId,
      mergedData,
      deleteDocIds,
    });
  }

  // 4. Firestoreに書き込み
  console.log('\n[4/4] Firestoreに保存中...');

  if (isDryRun) {
    console.log(`  [DRY RUN] 書き込みをスキップ`);
    console.log(`    更新: ${mergeResults.length}件`);
    console.log(`    削除: ${mergeResults.reduce((sum, r) => sum + r.deleteDocIds.length, 0)}件`);
  } else {
    const BATCH_SIZE = 500;
    let updateCount = 0;
    let deleteCount = 0;

    // 更新と削除をバッチで実行
    const allOperations: { type: 'update' | 'delete'; docId: string; data?: any }[] = [];

    for (const result of mergeResults) {
      allOperations.push({
        type: 'update',
        docId: result.docId,
        data: result.mergedData,
      });
      for (const deleteId of result.deleteDocIds) {
        allOperations.push({
          type: 'delete',
          docId: deleteId,
        });
      }
    }

    for (let i = 0; i < allOperations.length; i += BATCH_SIZE) {
      const chunk = allOperations.slice(i, i + BATCH_SIZE);
      const batch = db.batch();

      for (const op of chunk) {
        const ref = db.collection('products').doc(op.docId);
        if (op.type === 'update') {
          batch.set(ref, op.data, { merge: true });
          updateCount++;
        } else {
          batch.delete(ref);
          deleteCount++;
        }
      }

      await batch.commit();
      console.log(`  バッチ完了: ${Math.min(i + BATCH_SIZE, allOperations.length)}/${allOperations.length} 操作`);
    }

    console.log(`\n  更新: ${updateCount}件`);
    console.log(`  削除: ${deleteCount}件`);
  }

  // レポート表示
  const remainingCount = candidates.length - totalDuplicates;

  console.log('\n' + '='.repeat(60));
  console.log('  マージレポート');
  console.log('='.repeat(60));
  console.log(`  統合前の候補商品: ${candidates.length}`);
  console.log(`  重複グループ: ${mergeGroups.length}`);
  console.log(`  削除された重複: ${totalDuplicates}`);
  console.log(`  統合後の候補商品: ${remainingCount}`);
  console.log('='.repeat(60));
}

main().catch((error) => {
  console.error('致命的なエラー:', error);
  process.exit(1);
});
