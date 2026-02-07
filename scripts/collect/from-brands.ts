/**
 * ブランド別商品収集スクリプト
 *
 * brands.json に登録されたブランド名でKeepa APIを検索し、
 * 品質基準（レビュー数 >= 5, 評価 >= 3.5）を満たす商品をFirestoreに保存します。
 *
 * 使用方法:
 *   npx tsx scripts/collect/from-brands.ts
 *   npx tsx scripts/collect/from-brands.ts --dry-run
 *   npx tsx scripts/collect/from-brands.ts --brand="LOWYA"
 *   npx tsx scripts/collect/from-brands.ts --limit=5
 *
 * 必要な環境変数:
 *   KEEPA_API_KEY       - Keepa APIキー
 *   AMAZON_ASSOCIATE_ID - Amazonアソシエイトタグ (default: roomsetup-22)
 */

import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

config({ path: '.env.local' });

// ============================================
// Firebase Admin 初期化
// ============================================
if (getApps().length === 0) {
  const sa = JSON.parse(readFileSync(join(process.cwd(), './serviceAccountKey.json'), 'utf-8'));
  initializeApp({ credential: cert(sa) });
}

const db = getFirestore();

// ============================================
// 環境変数
// ============================================
const KEEPA_API_KEY = process.env.KEEPA_API_KEY;
const AMAZON_ASSOCIATE_ID = process.env.AMAZON_ASSOCIATE_ID || 'roomsetup-22';

// Keepa API設定
const KEEPA_API_BASE = 'https://api.keepa.com';
const KEEPA_DOMAIN_JP = 5; // Amazon.co.jp

// 品質フィルタ基準
const MIN_REVIEW_COUNT = 5;
const MIN_REVIEW_AVERAGE = 3.5;

// 進捗ファイル
const PROGRESS_FILE = join(process.cwd(), 'scripts/collect/brand-progress.json');

// コマンドラインオプション
const isDryRun = process.argv.includes('--dry-run');
const brandArg = process.argv.find((arg) => arg.startsWith('--brand='));
const filterBrand = brandArg ? brandArg.replace('--brand=', '').replace(/^["']|["']$/g, '') : null;
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const brandLimit = limitArg ? parseInt(limitArg.replace('--limit=', ''), 10) : Infinity;

// ============================================
// 型定義
// ============================================
interface Brand {
  name: string;
  defaultStyle: string;
  categories: string[];
}

interface BrandsConfig {
  brands: Brand[];
}

interface CategoryStyleMap {
  categoryKeywords: Record<string, string[]>;
  styleKeywords: Record<string, string[]>;
  brandStyleMap: Record<string, string>;
}

interface KeepaProduct {
  asin: string;
  title?: string;
  imagesCSV?: string;
  brand?: string;
  description?: string;
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
  tokenFlowReduction: number;
  tokensConsumed: number;
  processingTimeInMs: number;
  asinList?: string[];
  error?: { type: string; message: string };
}

interface KeepaProductResponse {
  timestamp: number;
  tokensLeft: number;
  refillIn: number;
  refillRate: number;
  tokenFlowReduction: number;
  tokensConsumed: number;
  processingTimeInMs: number;
  products?: KeepaProduct[];
  error?: { type: string; message: string };
}

interface Progress {
  completedBrandCategories: string[];
  collectedAsins: string[];
  totalSaved: number;
  lastUpdated: string;
}

// ============================================
// 設定ファイル読み込み
// ============================================
function loadBrands(): BrandsConfig {
  const filePath = join(process.cwd(), 'scripts/config/brands.json');
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

function loadCategoryStyleMap(): CategoryStyleMap {
  const filePath = join(process.cwd(), 'scripts/config/category-style-map.json');
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

// ============================================
// 進捗管理
// ============================================
function loadProgress(): Progress {
  if (existsSync(PROGRESS_FILE)) {
    return JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
  }
  return {
    completedBrandCategories: [],
    collectedAsins: [],
    totalSaved: 0,
    lastUpdated: new Date().toISOString(),
  };
}

function saveProgress(progress: Progress): void {
  progress.lastUpdated = new Date().toISOString();
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ============================================
// ユーティリティ
// ============================================
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// Keepa API - キーワード検索
// ============================================
async function searchKeepa(
  keyword: string
): Promise<{ asins: string[]; tokensLeft: number; refillIn: number }> {
  const url = new URL(`${KEEPA_API_BASE}/search`);
  url.searchParams.set('key', KEEPA_API_KEY!);
  url.searchParams.set('domain', KEEPA_DOMAIN_JP.toString());
  url.searchParams.set('type', 'product');
  url.searchParams.set('term', keyword);
  // Keepa search returns a list of ASINs
  url.searchParams.set('page', '0');

  const response = await fetch(url.toString());
  const data: KeepaSearchResponse = await response.json();

  if (data.error) {
    throw new Error(`Keepa Search Error: ${data.error.message}`);
  }

  console.log(`    Keepa search tokens remaining: ${data.tokensLeft}`);

  return {
    asins: data.asinList || [],
    tokensLeft: data.tokensLeft || 0,
    refillIn: data.refillIn || 60000,
  };
}

// ============================================
// Keepa API - 商品詳細取得
// ============================================
async function fetchKeepaProducts(
  asins: string[]
): Promise<{ products: KeepaProduct[]; tokensLeft: number; refillIn: number }> {
  const url = new URL(`${KEEPA_API_BASE}/product`);
  url.searchParams.set('key', KEEPA_API_KEY!);
  url.searchParams.set('domain', KEEPA_DOMAIN_JP.toString());
  url.searchParams.set('asin', asins.join(','));
  url.searchParams.set('stats', '180');
  url.searchParams.set('history', '1');

  const response = await fetch(url.toString());
  const data: KeepaProductResponse = await response.json();

  if (data.error) {
    throw new Error(`Keepa Product Error: ${data.error.message}`);
  }

  console.log(`    Keepa product tokens remaining: ${data.tokensLeft}`);

  return {
    products: data.products || [],
    tokensLeft: data.tokensLeft || 0,
    refillIn: data.refillIn || 60000,
  };
}

// ============================================
// 商品カテゴリ推定
// ============================================
function inferCategory(
  title: string,
  searchCategory: string,
  categoryStyleMap: CategoryStyleMap
): string {
  // 具体的なカテゴリキーワードを先にチェック（より長いキーワードを優先）
  const sortedCategories = Object.entries(categoryStyleMap.categoryKeywords).sort(
    (a, b) => {
      const aMaxLen = Math.max(...a[1].map((k) => k.length));
      const bMaxLen = Math.max(...b[1].map((k) => k.length));
      return bMaxLen - aMaxLen;
    }
  );

  for (const [category, keywords] of sortedCategories) {
    for (const keyword of keywords) {
      if (title.includes(keyword)) {
        return category;
      }
    }
  }

  return searchCategory;
}

function inferStyle(
  title: string,
  defaultStyle: string,
  brand: string | undefined,
  categoryStyleMap: CategoryStyleMap
): string {
  // ブランドからスタイルを推定
  if (brand) {
    for (const [brandName, style] of Object.entries(categoryStyleMap.brandStyleMap)) {
      if (brand.includes(brandName) || title.includes(brandName)) {
        return style;
      }
    }
  }

  // タイトルのキーワードからスタイルを推定
  for (const [style, keywords] of Object.entries(categoryStyleMap.styleKeywords)) {
    for (const keyword of keywords) {
      if (title.includes(keyword) || title.toLowerCase().includes(keyword.toLowerCase())) {
        return style;
      }
    }
  }

  return defaultStyle;
}

function generateTags(title: string): string[] {
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
    [/一人暮らし/i, '一人暮らし'],
    [/2人掛け|二人掛け/i, '2人掛け'],
    [/3人掛け|三人掛け/i, '3人掛け'],
  ];

  for (const [pattern, tag] of tagPatterns) {
    if (pattern.test(title)) {
      tags.push(tag);
    }
  }

  return tags;
}

// ============================================
// レビュー情報抽出
// ============================================
function extractReviewData(product: KeepaProduct): {
  reviewAverage: number;
  reviewCount: number;
} {
  let reviewAverage = 0;
  let reviewCount = 0;

  if (product.csv) {
    const ratings = product.csv[16];
    const counts = product.csv[17];

    if (ratings && ratings.length >= 2) {
      const latestRating = ratings[ratings.length - 1];
      if (latestRating > 0) reviewAverage = latestRating / 10;
    }
    if (counts && counts.length >= 2) {
      const latestCount = counts[counts.length - 1];
      if (latestCount > 0) reviewCount = latestCount;
    }
  }

  return { reviewAverage, reviewCount };
}

// ============================================
// Keepa商品データからProduct形式に変換
// ============================================
function convertKeepaProduct(
  product: KeepaProduct,
  searchCategory: string,
  defaultStyle: string,
  brandName: string,
  categoryStyleMap: CategoryStyleMap
): Record<string, any> | null {
  if (!product.title) {
    return null;
  }

  // 画像URL
  const images: string[] = [];
  if (product.imagesCSV) {
    const imageIds = product.imagesCSV.split(',');
    for (const imageId of imageIds.slice(0, 5)) {
      if (imageId) {
        images.push(`https://images-na.ssl-images-amazon.com/images/I/${imageId}`);
      }
    }
  }

  if (images.length === 0) {
    return null;
  }

  // 価格を取得
  let price = 0;
  if (product.csv) {
    const amazonPrices = product.csv[0];
    const newPrices = product.csv[1];

    if (amazonPrices && amazonPrices.length >= 2) {
      const latestPrice = amazonPrices[amazonPrices.length - 1];
      if (latestPrice > 0) price = latestPrice;
    }
    if (price === 0 && newPrices && newPrices.length >= 2) {
      const latestPrice = newPrices[newPrices.length - 1];
      if (latestPrice > 0) price = latestPrice;
    }
  }

  // レビュー情報
  const { reviewAverage, reviewCount } = extractReviewData(product);

  const category = inferCategory(product.title, searchCategory, categoryStyleMap);
  const style = inferStyle(product.title, defaultStyle, product.brand || brandName, categoryStyleMap);
  const tags = generateTags(product.title);

  // ブランドタグを追加
  if (brandName && !tags.includes(brandName)) {
    tags.push(brandName);
  }

  const purchaseLink: Record<string, any> = {
    source: 'amazon',
    url: `https://www.amazon.co.jp/dp/${product.asin}`,
    affiliateUrl: `https://www.amazon.co.jp/dp/${product.asin}?tag=${AMAZON_ASSOCIATE_ID}`,
    price,
    asin: product.asin,
    reviewAverage: parseFloat(reviewAverage.toFixed(1)),
    reviewCount,
  };

  return {
    name: product.title,
    description: product.description || '',
    images,
    category,
    style,
    tags,
    brand: product.brand || brandName,
    purchaseLinks: [purchaseLink],
    status: 'candidate',
    collectedFrom: 'brand-search',
    sourceUrl: `keepa:brand:${brandName}`,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

// ============================================
// Firestoreに保存 (バッチ書き込み)
// ============================================
async function saveToFirestore(products: { id: string; data: Record<string, any> }[]): Promise<number> {
  if (isDryRun) {
    console.log(`  [DRY RUN] Would save ${products.length} products to Firestore`);
    return products.length;
  }

  const BATCH_SIZE = 500;
  let savedCount = 0;

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const chunk = products.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const product of chunk) {
      const docRef = db.collection('products').doc(product.id);
      batch.set(docRef, product.data, { merge: true });
      savedCount++;
    }

    await batch.commit();
    console.log(`    Batch committed: ${savedCount}/${products.length}`);

    if (i + BATCH_SIZE < products.length) {
      await sleep(500);
    }
  }

  return savedCount;
}

// ============================================
// Keepaトークン待機
// ============================================
async function waitForTokens(tokensLeft: number, refillIn: number): Promise<void> {
  if (tokensLeft < 10) {
    const waitTime = Math.max(60, Math.ceil(refillIn / 1000));
    console.log(`    Token shortage (${tokensLeft}), waiting ${waitTime}s...`);
    await sleep(waitTime * 1000);
  } else if (tokensLeft < 50) {
    console.log(`    Token conservation (${tokensLeft}), waiting 30s...`);
    await sleep(30000);
  } else {
    await sleep(3000);
  }
}

// ============================================
// メイン処理
// ============================================
async function main() {
  console.log('━'.repeat(60));
  console.log('  Brand-based Product Collection Pipeline');
  console.log('━'.repeat(60));

  // 環境変数チェック
  if (!KEEPA_API_KEY) {
    console.error('KEEPA_API_KEY is not set in .env.local');
    process.exit(1);
  }

  if (isDryRun) {
    console.log('  Mode: DRY RUN (no writes to Firestore)');
  }
  if (filterBrand) {
    console.log(`  Filter: brand = ${filterBrand}`);
  }
  if (brandLimit < Infinity) {
    console.log(`  Limit: ${brandLimit} brands`);
  }
  console.log(`  Quality filter: reviewCount >= ${MIN_REVIEW_COUNT}, reviewAverage >= ${MIN_REVIEW_AVERAGE}`);

  // 設定ファイル読み込み
  const brandsConfig = loadBrands();
  const categoryStyleMap = loadCategoryStyleMap();
  const progress = loadProgress();

  // 既存ASINをセットに
  const existingAsins = new Set<string>(progress.collectedAsins);

  // ブランドをフィルタ
  let brands = brandsConfig.brands;
  if (filterBrand) {
    brands = brands.filter((b) => b.name === filterBrand);
    if (brands.length === 0) {
      console.error(`Brand "${filterBrand}" not found in brands.json`);
      process.exit(1);
    }
  }

  console.log(`\n  Total brands: ${brands.length}`);
  console.log(`  Previously completed: ${progress.completedBrandCategories.length}`);
  console.log(`  Previously saved: ${progress.totalSaved}\n`);

  let brandsProcessed = 0;
  let totalNewProducts = 0;
  let totalFiltered = 0;
  let totalSaved = 0;
  const pendingProducts: { id: string; data: Record<string, any> }[] = [];

  for (const brand of brands) {
    if (brandsProcessed >= brandLimit) {
      console.log(`\nBrand limit (${brandLimit}) reached. Stopping.`);
      break;
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`  Brand: ${brand.name} (default style: ${brand.defaultStyle})`);
    console.log(`  Categories: ${brand.categories.join(', ')}`);

    for (const category of brand.categories) {
      const brandCategoryKey = `${brand.name}_${category}`;

      if (progress.completedBrandCategories.includes(brandCategoryKey)) {
        continue;
      }

      // カテゴリキーワードを取得
      const categoryKeywords = categoryStyleMap.categoryKeywords[category] || [category];
      // ブランド名 + カテゴリの最初のキーワードで検索
      const searchTerm = `${brand.name} ${categoryKeywords[0]}`;

      console.log(`\n  Searching: "${searchTerm}"`);

      try {
        // Keepa APIでキーワード検索
        const searchResult = await searchKeepa(searchTerm);
        console.log(`    Found ${searchResult.asins.length} ASINs`);

        if (searchResult.asins.length === 0) {
          progress.completedBrandCategories.push(brandCategoryKey);
          saveProgress(progress);
          await waitForTokens(searchResult.tokensLeft, searchResult.refillIn);
          continue;
        }

        // 既存ASINを除外
        const newAsins = searchResult.asins.filter((asin) => !existingAsins.has(asin));
        console.log(`    New ASINs: ${newAsins.length}`);

        if (newAsins.length === 0) {
          progress.completedBrandCategories.push(brandCategoryKey);
          saveProgress(progress);
          await waitForTokens(searchResult.tokensLeft, searchResult.refillIn);
          continue;
        }

        // Keepa APIで商品詳細取得（100件ずつバッチ）
        const KEEPA_BATCH_SIZE = 100;

        for (let i = 0; i < newAsins.length; i += KEEPA_BATCH_SIZE) {
          const batch = newAsins.slice(i, i + KEEPA_BATCH_SIZE);
          console.log(`    Fetching details: ${batch.length} ASINs`);

          const productResult = await fetchKeepaProducts(batch);

          for (const keepaProduct of productResult.products) {
            // レビューフィルタ
            const { reviewAverage, reviewCount } = extractReviewData(keepaProduct);

            if (reviewCount < MIN_REVIEW_COUNT || reviewAverage < MIN_REVIEW_AVERAGE) {
              totalFiltered++;
              continue;
            }

            const productData = convertKeepaProduct(
              keepaProduct,
              category,
              brand.defaultStyle,
              brand.name,
              categoryStyleMap
            );

            if (productData) {
              const docId = `amazon_${keepaProduct.asin}`;
              pendingProducts.push({ id: docId, data: productData });
              existingAsins.add(keepaProduct.asin);
              progress.collectedAsins.push(keepaProduct.asin);
              totalNewProducts++;
              console.log(
                `      + ${keepaProduct.asin}: ${keepaProduct.title?.substring(0, 45)}... (${reviewAverage}/${reviewCount}reviews)`
              );
            }
          }

          // トークン管理
          if (i + KEEPA_BATCH_SIZE < newAsins.length) {
            await waitForTokens(productResult.tokensLeft, productResult.refillIn);
          }
        }

        // 200件以上溜まったらFirestoreに保存
        if (pendingProducts.length >= 200) {
          console.log(`\n    Saving ${pendingProducts.length} products to Firestore...`);
          const saved = await saveToFirestore(pendingProducts);
          totalSaved += saved;
          progress.totalSaved += saved;
          pendingProducts.length = 0;
          console.log(`    Total saved so far: ${progress.totalSaved}`);
        }

        progress.completedBrandCategories.push(brandCategoryKey);
        saveProgress(progress);

        // 次の検索までの待機
        await waitForTokens(searchResult.tokensLeft, searchResult.refillIn);
      } catch (error) {
        console.error(`    Error: ${error}`);
        saveProgress(progress);
        await sleep(10000);
      }
    }

    brandsProcessed++;
  }

  // 残りのデータを保存
  if (pendingProducts.length > 0) {
    console.log(`\n  Saving remaining ${pendingProducts.length} products...`);
    const saved = await saveToFirestore(pendingProducts);
    totalSaved += saved;
    progress.totalSaved += saved;
    saveProgress(progress);
  }

  // 結果表示
  console.log('\n' + '━'.repeat(60));
  console.log('  Collection Results');
  console.log('━'.repeat(60));
  console.log(`  Brands processed:       ${brandsProcessed}`);
  console.log(`  New products found:      ${totalNewProducts}`);
  console.log(`  Filtered (low quality):  ${totalFiltered}`);
  console.log(`  Products saved:          ${totalSaved}`);
  console.log(`  Total saved (all runs):  ${progress.totalSaved}`);
  console.log('━'.repeat(60));

  if (isDryRun) {
    console.log('\n  [DRY RUN] No data was written to Firestore.');
  }
}

main().catch((error) => {
  console.error('\nFatal error:', error);
  process.exit(1);
});
