/**
 * 記事からAmazon商品を収集するスクリプト
 *
 * Google Custom Search APIで記事を検索し、記事内のAmazon URLからASINを抽出、
 * Keepa APIで商品情報を取得してFirestoreに保存します。
 *
 * 使用方法:
 *   npx tsx scripts/collect/from-articles.ts
 *   npx tsx scripts/collect/from-articles.ts --dry-run
 *   npx tsx scripts/collect/from-articles.ts --limit=5
 *   npx tsx scripts/collect/from-articles.ts --category=ソファ
 *
 * 必要な環境変数:
 *   GOOGLE_CSE_API_KEY - Google Custom Search APIキー
 *   GOOGLE_CSE_ID      - Google Custom Search Engine ID
 *   KEEPA_API_KEY      - Keepa APIキー
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
const GOOGLE_CSE_API_KEY = process.env.GOOGLE_CSE_API_KEY;
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;
const KEEPA_API_KEY = process.env.KEEPA_API_KEY;
const AMAZON_ASSOCIATE_ID = process.env.AMAZON_ASSOCIATE_ID || 'roomsetup-22';

// Keepa API設定
const KEEPA_API_BASE = 'https://api.keepa.com';
const KEEPA_DOMAIN_JP = 5; // Amazon.co.jp

// 進捗ファイル
const PROGRESS_FILE = join(process.cwd(), 'scripts/collect/article-progress.json');

// コマンドラインオプション
const isDryRun = process.argv.includes('--dry-run');
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const queryLimit = limitArg ? parseInt(limitArg.replace('--limit=', ''), 10) : Infinity;
const categoryArg = process.argv.find((arg) => arg.startsWith('--category='));
const filterCategory = categoryArg ? categoryArg.replace('--category=', '') : null;

// ============================================
// 型定義
// ============================================
interface SearchQuery {
  category: string;
  style: string;
  searchTerms: string[];
}

interface SearchQueriesConfig {
  queries: SearchQuery[];
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

interface KeepaResponse {
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
  completedQueries: string[];
  collectedAsins: string[];
  totalSaved: number;
  lastUpdated: string;
}

interface GoogleCSEResult {
  items?: {
    title: string;
    link: string;
    snippet: string;
  }[];
  searchInformation?: {
    totalResults: string;
  };
}

// ============================================
// 設定ファイル読み込み
// ============================================
function loadSearchQueries(): SearchQueriesConfig {
  const filePath = join(process.cwd(), 'scripts/config/search-queries.json');
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
    completedQueries: [],
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
// Google Custom Search API
// ============================================
async function searchGoogle(query: string): Promise<string[]> {
  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('key', GOOGLE_CSE_API_KEY!);
  url.searchParams.set('cx', GOOGLE_CSE_ID!);
  url.searchParams.set('q', query);
  url.searchParams.set('num', '10');
  url.searchParams.set('lr', 'lang_ja');
  url.searchParams.set('gl', 'jp');

  const response = await fetch(url.toString());

  if (!response.ok) {
    if (response.status === 429) {
      console.log('    Google CSE rate limited, waiting 60 seconds...');
      await sleep(60000);
      return searchGoogle(query);
    }
    throw new Error(`Google CSE error: ${response.status} ${response.statusText}`);
  }

  const data: GoogleCSEResult = await response.json();
  return (data.items || []).map((item) => item.link);
}

// ============================================
// 記事からASINを抽出
// ============================================
async function extractAsinsFromUrl(url: string): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en;q=0.9',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) return [];

    const html = await response.text();
    return extractAsinsFromHtml(html);
  } catch {
    // Timeout or fetch error - silently skip
    return [];
  }
}

function extractAsinsFromHtml(html: string): string[] {
  const asinPatterns = [
    // /dp/ASIN
    /amazon\.co\.jp\/(?:[^/]+\/)?dp\/([A-Z0-9]{10})/g,
    // /gp/product/ASIN
    /amazon\.co\.jp\/gp\/product\/([A-Z0-9]{10})/g,
    // /gp/aw/d/ASIN (mobile)
    /amazon\.co\.jp\/gp\/aw\/d\/([A-Z0-9]{10})/g,
    // amzn.to short links with ASIN in the redirect (only extract from data attributes)
    /data-asin="([A-Z0-9]{10})"/g,
    // Amazon associate links that include ASIN
    /amazon\.co\.jp[^"']*?(?:\/dp\/|%2Fdp%2F)([A-Z0-9]{10})/g,
  ];

  const asins = new Set<string>();

  for (const pattern of asinPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      asins.add(match[1]);
    }
  }

  return Array.from(asins);
}

// ============================================
// Keepa API
// ============================================
async function fetchFromKeepa(
  asins: string[]
): Promise<{ products: KeepaProduct[]; tokensLeft: number; refillIn: number }> {
  const url = new URL(`${KEEPA_API_BASE}/product`);
  url.searchParams.set('key', KEEPA_API_KEY!);
  url.searchParams.set('domain', KEEPA_DOMAIN_JP.toString());
  url.searchParams.set('asin', asins.join(','));
  url.searchParams.set('stats', '180');
  url.searchParams.set('history', '1');

  const response = await fetch(url.toString());
  const data: KeepaResponse = await response.json();

  if (data.error) {
    throw new Error(`Keepa API Error: ${data.error.message}`);
  }

  console.log(`    Keepa tokens remaining: ${data.tokensLeft} (refill in ${Math.round(data.refillIn / 1000)}s)`);

  return {
    products: data.products || [],
    tokensLeft: data.tokensLeft || 0,
    refillIn: data.refillIn || 60000,
  };
}

// ============================================
// 商品カテゴリ・スタイル推定
// ============================================
function inferCategory(
  title: string,
  searchCategory: string,
  categoryStyleMap: CategoryStyleMap
): string {
  // 具体的なカテゴリキーワードを先にチェック（より長いキーワードを優先）
  const sortedCategories = Object.entries(categoryStyleMap.categoryKeywords).sort(
    (a, b) => {
      // 具体的なカテゴリ（ダイニングテーブルなど）を先にチェック
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

  // 推定できない場合は検索クエリのカテゴリを使用
  return searchCategory;
}

function inferStyle(
  title: string,
  searchStyle: string,
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

  // 推定できない場合は検索クエリのスタイルを使用
  return searchStyle;
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
// Keepa商品データからProduct形式に変換
// ============================================
function convertKeepaProduct(
  product: KeepaProduct,
  searchCategory: string,
  searchStyle: string,
  sourceUrl: string,
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
      // 最大5枚
      if (imageId) {
        images.push(`https://images-na.ssl-images-amazon.com/images/I/${imageId}`);
      }
    }
  }

  if (images.length === 0) {
    return null; // 画像なしはスキップ
  }

  // 価格を取得
  let price = 0;
  if (product.csv) {
    // csv[0] = Amazon price, csv[1] = New price
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

  const category = inferCategory(product.title, searchCategory, categoryStyleMap);
  const style = inferStyle(product.title, searchStyle, product.brand, categoryStyleMap);
  const tags = generateTags(product.title);

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
    brand: product.brand || '',
    purchaseLinks: [purchaseLink],
    status: 'candidate',
    collectedFrom: 'article',
    sourceUrl,
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
// Firestoreで既存ASINをチェック
// ============================================
async function getExistingAsins(): Promise<Set<string>> {
  const existingAsins = new Set<string>();

  const snapshot = await db
    .collection('products')
    .where('purchaseLinks', '!=', null)
    .select('purchaseLinks')
    .get();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.purchaseLinks && Array.isArray(data.purchaseLinks)) {
      for (const link of data.purchaseLinks) {
        if (link.asin) {
          existingAsins.add(link.asin);
        }
      }
    }
  }

  return existingAsins;
}

// ============================================
// メイン処理
// ============================================
async function main() {
  console.log('━'.repeat(60));
  console.log('  Article-based Product Collection Pipeline');
  console.log('━'.repeat(60));

  // 環境変数チェック
  if (!GOOGLE_CSE_API_KEY) {
    console.error('GOOGLE_CSE_API_KEY is not set in .env.local');
    process.exit(1);
  }
  if (!GOOGLE_CSE_ID) {
    console.error('GOOGLE_CSE_ID is not set in .env.local');
    process.exit(1);
  }
  if (!KEEPA_API_KEY) {
    console.error('KEEPA_API_KEY is not set in .env.local');
    process.exit(1);
  }

  if (isDryRun) {
    console.log('  Mode: DRY RUN (no writes to Firestore)');
  }
  if (filterCategory) {
    console.log(`  Filter: category = ${filterCategory}`);
  }
  if (queryLimit < Infinity) {
    console.log(`  Limit: ${queryLimit} queries`);
  }

  // 設定ファイル読み込み
  const searchQueriesConfig = loadSearchQueries();
  const categoryStyleMap = loadCategoryStyleMap();
  const progress = loadProgress();

  // 既存ASINを取得
  console.log('\nChecking existing products in Firestore...');
  let existingAsins: Set<string>;
  try {
    existingAsins = await getExistingAsins();
    console.log(`  Found ${existingAsins.size} existing ASINs`);
  } catch {
    console.log('  Could not fetch existing ASINs, starting fresh');
    existingAsins = new Set<string>();
  }

  // 進捗で収集済みのASINも追加
  for (const asin of progress.collectedAsins) {
    existingAsins.add(asin);
  }

  // クエリをフィルタ
  let queries = searchQueriesConfig.queries;
  if (filterCategory) {
    queries = queries.filter((q) => q.category === filterCategory);
  }

  console.log(`\n  Total queries: ${queries.length}`);
  console.log(`  Previously completed: ${progress.completedQueries.length}`);
  console.log(`  Previously saved: ${progress.totalSaved}\n`);

  let queriesProcessed = 0;
  let totalNewAsins = 0;
  let totalSaved = 0;
  const pendingProducts: { id: string; data: Record<string, any> }[] = [];

  for (const query of queries) {
    if (queriesProcessed >= queryLimit) {
      console.log(`\nQuery limit (${queryLimit}) reached. Stopping.`);
      break;
    }

    const queryKey = `${query.category}_${query.style}`;

    if (progress.completedQueries.includes(queryKey)) {
      continue;
    }

    console.log(`\n[${'='.repeat(40)}]`);
    console.log(`  Category: ${query.category} | Style: ${query.style}`);

    const allAsins = new Set<string>();

    // 各検索キーワードでGoogle検索
    for (const searchTerm of query.searchTerms) {
      console.log(`  Searching: "${searchTerm}"`);

      try {
        const articleUrls = await searchGoogle(searchTerm);
        console.log(`    Found ${articleUrls.length} articles`);

        // 各記事からASINを抽出
        for (const articleUrl of articleUrls) {
          // Amazonのページ自体はスキップ（記事ではない）
          if (articleUrl.includes('amazon.co.jp')) continue;

          try {
            const asins = await extractAsinsFromUrl(articleUrl);
            if (asins.length > 0) {
              console.log(`    ${articleUrl.substring(0, 60)}... -> ${asins.length} ASINs`);
              for (const asin of asins) {
                allAsins.add(asin);
              }
            }
          } catch {
            // Skip failed URLs silently
          }

          // 記事取得のレート制限
          await sleep(500);
        }

        // Google CSE のレート制限（100 requests/day/free, 1 req/sec）
        await sleep(1500);
      } catch (error) {
        console.error(`    Search failed: ${error}`);
        await sleep(5000);
      }
    }

    // 既存ASINを除外
    const newAsins = Array.from(allAsins).filter((asin) => !existingAsins.has(asin));
    console.log(`  Total ASINs found: ${allAsins.size} (new: ${newAsins.length})`);

    if (newAsins.length === 0) {
      progress.completedQueries.push(queryKey);
      saveProgress(progress);
      queriesProcessed++;
      continue;
    }

    // Keepa APIで商品情報取得（100件ずつバッチ）
    const KEEPA_BATCH_SIZE = 100;

    for (let i = 0; i < newAsins.length; i += KEEPA_BATCH_SIZE) {
      const batch = newAsins.slice(i, i + KEEPA_BATCH_SIZE);
      console.log(`  Fetching Keepa data: ${batch.length} ASINs (batch ${Math.floor(i / KEEPA_BATCH_SIZE) + 1})`);

      try {
        const result = await fetchFromKeepa(batch);

        for (const keepaProduct of result.products) {
          const productData = convertKeepaProduct(
            keepaProduct,
            query.category,
            query.style,
            `search:${query.searchTerms[0]}`,
            categoryStyleMap
          );

          if (productData) {
            // ドキュメントIDはASINベース
            const docId = `amazon_${keepaProduct.asin}`;
            pendingProducts.push({ id: docId, data: productData });
            existingAsins.add(keepaProduct.asin);
            progress.collectedAsins.push(keepaProduct.asin);
            totalNewAsins++;
            console.log(`    + ${keepaProduct.asin}: ${keepaProduct.title?.substring(0, 50)}...`);
          }
        }

        // トークン管理
        if (i + KEEPA_BATCH_SIZE < newAsins.length) {
          if (result.tokensLeft < 10) {
            const waitTime = Math.max(60, Math.ceil(result.refillIn / 1000));
            console.log(`    Token shortage (${result.tokensLeft}), waiting ${waitTime}s...`);
            await sleep(waitTime * 1000);
          } else if (result.tokensLeft < 50) {
            console.log(`    Token conservation (${result.tokensLeft}), waiting 30s...`);
            await sleep(30000);
          } else {
            await sleep(3000);
          }
        }
      } catch (error) {
        console.error(`    Keepa batch failed: ${error}`);
        saveProgress(progress);
        await sleep(10000);
      }
    }

    // 200件以上溜まったらFirestoreに保存
    if (pendingProducts.length >= 200) {
      console.log(`\n  Saving ${pendingProducts.length} products to Firestore...`);
      const saved = await saveToFirestore(pendingProducts);
      totalSaved += saved;
      progress.totalSaved += saved;
      pendingProducts.length = 0;
      console.log(`  Total saved so far: ${progress.totalSaved}`);
    }

    progress.completedQueries.push(queryKey);
    saveProgress(progress);
    queriesProcessed++;
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
  console.log(`  Queries processed:  ${queriesProcessed}`);
  console.log(`  New ASINs found:    ${totalNewAsins}`);
  console.log(`  Products saved:     ${totalSaved}`);
  console.log(`  Total saved (all):  ${progress.totalSaved}`);
  console.log('━'.repeat(60));

  if (isDryRun) {
    console.log('\n  [DRY RUN] No data was written to Firestore.');
  }
}

main().catch((error) => {
  console.error('\nFatal error:', error);
  process.exit(1);
});
