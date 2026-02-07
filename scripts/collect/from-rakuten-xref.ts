/**
 * 楽天商品 → Amazon クロスリファレンス スクリプト
 *
 * 既存の楽天商品をKeepa APIでAmazon検索し、
 * 同一商品が見つかれば purchaseLinks[] を統合した新スキーマで保存します。
 *
 * 使用方法:
 *   npx tsx scripts/collect/from-rakuten-xref.ts
 *   npx tsx scripts/collect/from-rakuten-xref.ts --dry-run
 *   npx tsx scripts/collect/from-rakuten-xref.ts --limit=10
 *
 * 必要な環境変数:
 *   KEEPA_API_KEY - Keepa APIキー
 *   AMAZON_ASSOCIATE_ID - Amazonアソシエイトタグ（デフォルト: roomsetup-22）
 */

import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

config({ path: '.env.local' });

// Firebase Admin 初期化
if (getApps().length === 0) {
  const sa = JSON.parse(readFileSync(join(process.cwd(), './serviceAccountKey.json'), 'utf-8'));
  initializeApp({ credential: cert(sa) });
}

const db = getFirestore();

// 環境変数
const KEEPA_API_KEY = process.env.KEEPA_API_KEY;
const AMAZON_ASSOCIATE_ID = process.env.AMAZON_ASSOCIATE_ID || 'roomsetup-22';

// Keepa API 設定
const KEEPA_API_BASE = 'https://api.keepa.com';
const KEEPA_DOMAIN_JP = 5;

// CLI引数
const isDryRun = process.argv.includes('--dry-run');
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.replace('--limit=', ''), 10) : 0;

// 進捗ファイル
const PROGRESS_FILE = join(process.cwd(), 'scripts/collect/xref-progress.json');

// カテゴリ・スタイルマップ読み込み
const CATEGORY_STYLE_MAP_PATH = join(process.cwd(), 'scripts/config/category-style-map.json');
let categoryStyleMap: {
  styleKeywords: Record<string, string[]>;
  categoryKeywords: Record<string, string[]>;
  brandStyleMap: Record<string, string>;
} = { styleKeywords: {}, categoryKeywords: {}, brandStyleMap: {} };

if (existsSync(CATEGORY_STYLE_MAP_PATH)) {
  categoryStyleMap = JSON.parse(readFileSync(CATEGORY_STYLE_MAP_PATH, 'utf-8'));
}

// ============================================
// 型定義
// ============================================

interface KeepaProduct {
  asin: string;
  title?: string;
  imagesCSV?: string;
  categoryTree?: { catId: number; name: string }[];
  csv?: number[][];
  stats?: {
    current?: number[];
    avg?: number[];
    avg30?: number[];
    avg90?: number[];
  };
}

interface KeepaSearchResponse {
  timestamp: number;
  tokensLeft: number;
  refillIn: number;
  refillRate: number;
  tokensConsumed: number;
  processingTimeInMs: number;
  products?: KeepaProduct[];
  asinList?: string[];
  error?: { type: string; message: string };
}

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

interface RakutenProduct {
  docId: string;
  name: string;
  price: number;
  category: string;
  style: string;
  tags: string[];
  brand: string;
  images: string[];
  rakutenItemCode?: string;
  rakutenUrl: string;
  rakutenAffiliateUrl: string;
  reviewAverage?: number;
  reviewCount?: number;
}

interface XRefProgress {
  processedDocIds: string[];
  matchedCount: number;
  noMatchCount: number;
  errorCount: number;
  lastUpdated: string;
}

// ============================================
// ユーティリティ関数
// ============================================

/**
 * 商品名をクリーニング（楽天固有テキストを除去）
 */
function cleanProductName(name: string): string {
  return name
    // 楽天特有のテキストを除去
    .replace(/【[^】]*】/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    // 送料関連
    .replace(/送料無料/g, '')
    .replace(/送料込/g, '')
    .replace(/あす楽/g, '')
    .replace(/ポイント[0-9]*倍/g, '')
    .replace(/楽天[^\s]*/g, '')
    // ショップ名パターン
    .replace(/\s*[-|｜／/]\s*[^\s]+店$/g, '')
    // 空白正規化
    .replace(/\s+/g, ' ')
    .trim();
}

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
 * スタイルを推定（カテゴリスタイルマップを使用）
 */
function inferStyle(name: string, existingStyle?: string, brand?: string): string {
  if (existingStyle && ['scandinavian', 'modern', 'vintage', 'industrial'].includes(existingStyle)) {
    return existingStyle;
  }

  // ブランドからスタイルを推定
  if (brand && categoryStyleMap.brandStyleMap[brand]) {
    return categoryStyleMap.brandStyleMap[brand];
  }

  const lowerName = name.toLowerCase();

  for (const [style, keywords] of Object.entries(categoryStyleMap.styleKeywords)) {
    for (const kw of keywords) {
      if (lowerName.includes(kw.toLowerCase())) {
        return style;
      }
    }
  }

  return 'modern'; // デフォルト
}

/**
 * カテゴリを推定（カテゴリスタイルマップを使用）
 */
function inferCategory(name: string, existingCategory?: string): string {
  // 既存カテゴリが有効ならそのまま使う
  if (existingCategory && existingCategory !== 'その他') {
    return existingCategory;
  }

  for (const [category, keywords] of Object.entries(categoryStyleMap.categoryKeywords)) {
    if (category === 'その他') continue; // 「その他」はフォールバック
    for (const keyword of keywords) {
      if (name.includes(keyword)) {
        return category;
      }
    }
  }

  return existingCategory || 'その他';
}

/**
 * タグを生成
 */
function generateTags(name: string): string[] {
  const tags: string[] = [];
  const tagPatterns: [RegExp, string][] = [
    [/木製|ウッド|天然木|無垢/i, '木製'],
    [/北欧/i, '北欧'],
    [/シンプル/i, 'シンプル'],
    [/モダン/i, 'モダン'],
    [/アンティーク|ヴィンテージ|レトロ/i, 'アンティーク'],
    [/LED/i, 'LED'],
    [/調光/i, '調光'],
    [/リモコン/i, 'リモコン付き'],
    [/おしゃれ/i, 'おしゃれ'],
    [/大型|大きい/i, '大型'],
    [/コンパクト|小型|小さい/i, 'コンパクト'],
    [/折りたたみ/i, '折りたたみ'],
    [/洗える|ウォッシャブル/i, '洗える'],
    [/撥水|防水/i, '撥水'],
    [/アイアン|スチール|金属/i, '金属製'],
    [/ファブリック|布/i, 'ファブリック'],
    [/レザー|革/i, 'レザー'],
    [/ガラス/i, 'ガラス'],
    [/ラタン|籐/i, 'ラタン'],
  ];

  for (const [pattern, tag] of tagPatterns) {
    if (pattern.test(name)) {
      tags.push(tag);
    }
  }

  return tags;
}

/**
 * 商品名からブランド名を抽出（簡易的）
 */
function extractBrand(name: string): string {
  // 先頭にブランド名がある場合（例: "IKEA ソファ"）
  const brandMatch = name.match(/^([A-Za-z][A-Za-z0-9\s&.'-]{1,30})\s/);
  if (brandMatch) {
    return brandMatch[1].trim();
  }
  return '';
}

/**
 * Keepa検索用のキーワードを生成
 */
function buildSearchTerms(product: RakutenProduct): string {
  const cleaned = cleanProductName(product.name);

  // ブランド名 + カテゴリの主要ワードを組み合わせる
  const parts: string[] = [];

  if (product.brand) {
    parts.push(product.brand);
  }

  // カテゴリワードを追加
  if (product.category && product.category !== 'その他') {
    parts.push(product.category);
  }

  // クリーニングした名前から最初の重要な部分を取得（最大40文字）
  const nameCore = cleaned.slice(0, 40).trim();
  if (nameCore) {
    parts.push(nameCore);
  }

  // 長すぎる場合は短縮
  const query = parts.join(' ').slice(0, 80);
  return query;
}

/**
 * 2つの商品名が類似しているか判定
 */
function isNameMatch(rakutenName: string, amazonTitle: string, brand: string): boolean {
  const normRakuten = normalizeForComparison(cleanProductName(rakutenName));
  const normAmazon = normalizeForComparison(amazonTitle);

  // 一方が他方を含む
  if (normRakuten.includes(normAmazon) || normAmazon.includes(normRakuten)) {
    return true;
  }

  // 先頭30文字が一致
  if (normRakuten.length > 20 && normAmazon.length > 20) {
    if (normRakuten.slice(0, 30) === normAmazon.slice(0, 30)) {
      return true;
    }
  }

  // ブランド名 + カテゴリキーワードが両方に含まれるか
  if (brand) {
    const brandLower = brand.toLowerCase();
    if (normRakuten.includes(brandLower) && normAmazon.includes(brandLower)) {
      // ブランド一致した上で、カテゴリの主要キーワードも一致しているか
      for (const [, keywords] of Object.entries(categoryStyleMap.categoryKeywords)) {
        for (const keyword of keywords) {
          const normKeyword = normalizeForComparison(keyword);
          if (normRakuten.includes(normKeyword) && normAmazon.includes(normKeyword)) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * 価格が許容範囲内か（50%以内）
 */
function isPriceInRange(rakutenPrice: number, amazonPrice: number): boolean {
  if (rakutenPrice <= 0 || amazonPrice <= 0) return true; // 価格不明ならスキップしない
  const ratio = amazonPrice / rakutenPrice;
  return ratio >= 0.5 && ratio <= 1.5;
}

// ============================================
// Keepa API
// ============================================

/**
 * Keepa APIで商品を検索
 */
async function searchKeepa(query: string): Promise<string[]> {
  const url = new URL(`${KEEPA_API_BASE}/search`);
  url.searchParams.set('key', KEEPA_API_KEY!);
  url.searchParams.set('domain', KEEPA_DOMAIN_JP.toString());
  url.searchParams.set('type', 'product');
  url.searchParams.set('term', query);

  const response = await fetch(url.toString());
  const data: KeepaSearchResponse = await response.json();

  if (data.error) {
    throw new Error(`Keepa Search Error: ${data.error.message}`);
  }

  console.log(`    Keepa tokens remaining: ${data.tokensLeft}`);

  return data.asinList || [];
}

/**
 * Keepa APIで商品詳細を取得
 */
async function fetchKeepaProducts(asins: string[]): Promise<KeepaProduct[]> {
  if (asins.length === 0) return [];

  const url = new URL(`${KEEPA_API_BASE}/product`);
  url.searchParams.set('key', KEEPA_API_KEY!);
  url.searchParams.set('domain', KEEPA_DOMAIN_JP.toString());
  url.searchParams.set('asin', asins.join(','));
  url.searchParams.set('stats', '180');
  url.searchParams.set('history', '1');

  const response = await fetch(url.toString());
  const data: KeepaSearchResponse = await response.json();

  if (data.error) {
    throw new Error(`Keepa Product Error: ${data.error.message}`);
  }

  console.log(`    Keepa tokens remaining: ${data.tokensLeft}`);

  return data.products || [];
}

/**
 * Keepa商品から価格を取得
 */
function getKeepaPrice(product: KeepaProduct): number {
  if (!product.csv) return 0;

  // csv[0] = Amazon価格, csv[1] = 新品最安値
  const amazonPrices = product.csv[0];
  const newPrices = product.csv[1];

  if (amazonPrices && amazonPrices.length >= 2) {
    const latest = amazonPrices[amazonPrices.length - 1];
    if (latest > 0) return latest;
  }
  if (newPrices && newPrices.length >= 2) {
    const latest = newPrices[newPrices.length - 1];
    if (latest > 0) return latest;
  }

  return 0;
}

/**
 * Keepa商品からレビュー情報を取得
 */
function getKeepaReview(product: KeepaProduct): { average: number; count: number } {
  if (!product.csv) return { average: 0, count: 0 };

  let average = 0;
  let count = 0;

  // csv[16] = Rating, csv[17] = Review count
  const ratings = product.csv[16];
  const counts = product.csv[17];

  if (ratings && ratings.length >= 2) {
    const latest = ratings[ratings.length - 1];
    if (latest > 0) average = latest / 10; // Keepaは10倍値
  }
  if (counts && counts.length >= 2) {
    const latest = counts[counts.length - 1];
    if (latest > 0) count = latest;
  }

  return { average, count };
}

/**
 * Keepa商品画像URLリストを取得
 */
function getKeepaImages(product: KeepaProduct): string[] {
  if (!product.imagesCSV) return [];
  return product.imagesCSV
    .split(',')
    .filter((id) => id.length > 0)
    .map((id) => `https://images-na.ssl-images-amazon.com/images/I/${id}`);
}

// ============================================
// Firestore クエリ
// ============================================

/**
 * Amazonリンクがない楽天商品を取得
 */
async function getRakutenProductsWithoutAmazon(): Promise<RakutenProduct[]> {
  const products: RakutenProduct[] = [];

  // パターン1: 旧スキーマ（source == 'rakuten'）
  const oldSchemaSnap = await db
    .collection('products')
    .where('source', '==', 'rakuten')
    .get();

  for (const doc of oldSchemaSnap.docs) {
    const data = doc.data();
    products.push({
      docId: doc.id,
      name: data.name || '',
      price: data.price || 0,
      category: data.category || 'その他',
      style: data.vibe || data.style || '',
      tags: data.tags || data.keywords || [],
      brand: data.brand || extractBrand(data.name || ''),
      images: data.imageUrls || (data.imageUrl ? [data.imageUrl] : []),
      rakutenItemCode: data.rakutenItemCode,
      rakutenUrl: data.affiliateUrl || data.affiliateLink || '',
      rakutenAffiliateUrl: data.affiliateUrl || data.affiliateLink || '',
      reviewAverage: data.reviewAverage,
      reviewCount: data.reviewCount,
    });
  }

  // パターン2: 新スキーマ（purchaseLinks に楽天のみ含む）
  const newSchemaSnap = await db
    .collection('products')
    .where('status', 'in', ['candidate', 'approved'])
    .get();

  for (const doc of newSchemaSnap.docs) {
    const data = doc.data();
    if (!data.purchaseLinks || !Array.isArray(data.purchaseLinks)) continue;

    const hasRakuten = data.purchaseLinks.some((l: any) => l.source === 'rakuten');
    const hasAmazon = data.purchaseLinks.some((l: any) => l.source === 'amazon');

    if (hasRakuten && !hasAmazon) {
      const rakutenLink = data.purchaseLinks.find((l: any) => l.source === 'rakuten');
      // 旧スキーマで既に追加済みなら重複を避ける
      if (products.some((p) => p.docId === doc.id)) continue;

      products.push({
        docId: doc.id,
        name: data.name || '',
        price: rakutenLink?.price || 0,
        category: data.category || 'その他',
        style: data.style || '',
        tags: data.tags || [],
        brand: data.brand || extractBrand(data.name || ''),
        images: data.images || [],
        rakutenItemCode: rakutenLink?.rakutenItemCode,
        rakutenUrl: rakutenLink?.url || '',
        rakutenAffiliateUrl: rakutenLink?.affiliateUrl || rakutenLink?.url || '',
        reviewAverage: rakutenLink?.reviewAverage,
        reviewCount: rakutenLink?.reviewCount,
      });
    }
  }

  return products;
}

// ============================================
// 進捗管理
// ============================================

function loadProgress(): XRefProgress {
  if (existsSync(PROGRESS_FILE)) {
    return JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
  }
  return {
    processedDocIds: [],
    matchedCount: 0,
    noMatchCount: 0,
    errorCount: 0,
    lastUpdated: new Date().toISOString(),
  };
}

function saveProgress(progress: XRefProgress): void {
  progress.lastUpdated = new Date().toISOString();
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ============================================
// レート制限
// ============================================

async function rateLimitDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 1000));
}

// ============================================
// メイン処理
// ============================================

async function main() {
  console.log('='.repeat(60));
  console.log(`  楽天 → Amazon クロスリファレンス ${isDryRun ? '(DRY RUN)' : ''}`);
  console.log('='.repeat(60));

  // 環境変数チェック
  if (!KEEPA_API_KEY) {
    console.error('\nKEEPA_API_KEY が設定されていません。');
    console.error('.env.local に KEEPA_API_KEY=your_key を追加してください。');
    process.exit(1);
  }

  // 1. 楽天商品を取得
  console.log('\n[1/4] 楽天商品を取得中...');
  const rakutenProducts = await getRakutenProductsWithoutAmazon();
  console.log(`  対象商品数: ${rakutenProducts.length}`);

  if (rakutenProducts.length === 0) {
    console.log('  Amazonリンクが必要な楽天商品はありません。');
    return;
  }

  // 2. 進捗読み込み＆フィルタリング
  const progress = loadProgress();
  const pendingProducts = rakutenProducts.filter(
    (p) => !progress.processedDocIds.includes(p.docId)
  );

  const targetProducts = LIMIT > 0 ? pendingProducts.slice(0, LIMIT) : pendingProducts;

  console.log(`\n[2/4] 処理対象を確認中...`);
  console.log(`  全楽天商品: ${rakutenProducts.length}`);
  console.log(`  処理済み: ${progress.processedDocIds.length}`);
  console.log(`  残り: ${pendingProducts.length}`);
  console.log(`  今回処理: ${targetProducts.length}`);

  if (targetProducts.length === 0) {
    console.log('  処理対象がありません。');
    return;
  }

  // 3. クロスリファレンス実行
  console.log(`\n[3/4] Keepa APIでクロスリファレンス実行中...`);
  let matchedCount = 0;
  let noMatchCount = 0;
  let errorCount = 0;
  const batchWrites: { docId: string; data: any }[] = [];

  for (let i = 0; i < targetProducts.length; i++) {
    const product = targetProducts[i];
    const progressLabel = `[${i + 1}/${targetProducts.length}]`;

    console.log(`\n  ${progressLabel} "${product.name.slice(0, 50)}..."`);

    try {
      // 検索キーワードを生成
      const searchTerms = buildSearchTerms(product);
      console.log(`    検索: "${searchTerms.slice(0, 60)}..."`);

      // Keepaで検索
      const asinResults = await searchKeepa(searchTerms);
      await rateLimitDelay();

      if (asinResults.length === 0) {
        console.log(`    -> マッチなし（検索結果0件）`);
        noMatchCount++;
        progress.processedDocIds.push(product.docId);
        saveProgress(progress);
        continue;
      }

      // 上位5件の詳細を取得
      const topAsins = asinResults.slice(0, 5);
      const keepaProducts = await fetchKeepaProducts(topAsins);
      await rateLimitDelay();

      // マッチング
      let bestMatch: KeepaProduct | null = null;

      for (const kp of keepaProducts) {
        if (!kp.title) continue;

        // 名前の類似性チェック
        const nameMatch = isNameMatch(product.name, kp.title, product.brand);
        if (!nameMatch) continue;

        // 価格の妥当性チェック
        const amazonPrice = getKeepaPrice(kp);
        if (!isPriceInRange(product.price, amazonPrice)) {
          console.log(`    -> 価格範囲外: 楽天=${product.price}円, Amazon=${amazonPrice}円`);
          continue;
        }

        bestMatch = kp;
        break;
      }

      if (!bestMatch) {
        console.log(`    -> マッチなし（${keepaProducts.length}件の候補を検証）`);
        noMatchCount++;
        progress.processedDocIds.push(product.docId);
        saveProgress(progress);
        continue;
      }

      // マッチ成功
      const amazonPrice = getKeepaPrice(bestMatch);
      const amazonReview = getKeepaReview(bestMatch);
      const amazonImages = getKeepaImages(bestMatch);

      console.log(`    -> マッチ: ${bestMatch.asin} "${bestMatch.title?.slice(0, 40)}..."`);
      console.log(`       Amazon価格: ${amazonPrice}円, レビュー: ${amazonReview.average} (${amazonReview.count}件)`);

      // 新スキーマでデータを構築
      const rakutenLink: PurchaseLink = {
        source: 'rakuten',
        url: product.rakutenUrl,
        affiliateUrl: product.rakutenAffiliateUrl,
        price: product.price,
        rakutenItemCode: product.rakutenItemCode,
        reviewAverage: product.reviewAverage,
        reviewCount: product.reviewCount,
      };

      const amazonLink: PurchaseLink = {
        source: 'amazon',
        url: `https://www.amazon.co.jp/dp/${bestMatch.asin}`,
        affiliateUrl: `https://www.amazon.co.jp/dp/${bestMatch.asin}?tag=${AMAZON_ASSOCIATE_ID}`,
        price: amazonPrice,
        asin: bestMatch.asin,
        reviewAverage: amazonReview.average,
        reviewCount: amazonReview.count,
      };

      // 画像の統合（既存 + Amazon）
      const mergedImages = [...product.images];
      for (const img of amazonImages) {
        if (!mergedImages.includes(img)) {
          mergedImages.push(img);
        }
      }

      // タグの統合
      const mergedTags = [...new Set([...product.tags, ...generateTags(bestMatch.title || '')])];

      const resolvedBrand = product.brand || extractBrand(bestMatch.title || '');

      const productData = {
        name: product.name,
        images: mergedImages,
        category: inferCategory(product.name, product.category),
        style: inferStyle(product.name, product.style, resolvedBrand),
        tags: mergedTags,
        brand: resolvedBrand,
        purchaseLinks: [rakutenLink, amazonLink],
        status: 'candidate',
        collectedFrom: 'rakuten-xref',
        updatedAt: FieldValue.serverTimestamp(),
      };

      batchWrites.push({ docId: product.docId, data: productData });
      matchedCount++;
    } catch (error: any) {
      console.error(`    -> エラー: ${error.message}`);
      errorCount++;

      // トークン不足エラーの場合は待機
      if (error.message?.includes('token') || error.message?.includes('Token')) {
        console.log('    トークン不足のため60秒待機...');
        await new Promise((resolve) => setTimeout(resolve, 60000));
      }
    }

    progress.processedDocIds.push(product.docId);
    saveProgress(progress);
  }

  // 4. Firestoreに書き込み
  console.log(`\n[4/4] Firestoreに保存中...`);

  if (isDryRun) {
    console.log(`  [DRY RUN] ${batchWrites.length}件の書き込みをスキップ`);
    for (const w of batchWrites) {
      console.log(`    - ${w.docId}: ${w.data.name?.slice(0, 40)}...`);
      console.log(`      purchaseLinks: ${w.data.purchaseLinks.map((l: PurchaseLink) => l.source).join(', ')}`);
    }
  } else {
    const BATCH_SIZE = 500;
    for (let i = 0; i < batchWrites.length; i += BATCH_SIZE) {
      const chunk = batchWrites.slice(i, i + BATCH_SIZE);
      const batch = db.batch();

      for (const w of chunk) {
        const ref = db.collection('products').doc(w.docId);
        batch.set(ref, w.data, { merge: true });
      }

      await batch.commit();
      console.log(`  バッチ書き込み完了: ${Math.min(i + BATCH_SIZE, batchWrites.length)}/${batchWrites.length}`);
    }
  }

  // 進捗を最終更新
  progress.matchedCount += matchedCount;
  progress.noMatchCount += noMatchCount;
  progress.errorCount += errorCount;
  saveProgress(progress);

  // レポート表示
  console.log('\n' + '='.repeat(60));
  console.log('  クロスリファレンス結果');
  console.log('='.repeat(60));
  console.log(`  処理件数: ${targetProducts.length}`);
  console.log(`  マッチ: ${matchedCount}`);
  console.log(`  マッチなし: ${noMatchCount}`);
  console.log(`  エラー: ${errorCount}`);
  console.log(`  累計マッチ: ${progress.matchedCount}`);
  console.log(`  累計マッチなし: ${progress.noMatchCount}`);
  console.log(`  累計エラー: ${progress.errorCount}`);
  console.log('='.repeat(60));
}

main().catch((error) => {
  console.error('致命的なエラー:', error);
  process.exit(1);
});
