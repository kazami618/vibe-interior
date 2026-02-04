/**
 * Keepa APIを使用してカテゴリ別ベストセラーASINを取得
 *
 * 事前定義したカテゴリに対応するAmazonカテゴリから
 * 売上上位の商品ASINを自動収集します。
 *
 * 使用方法:
 *   npm run amazon:asins
 *   npm run amazon:asins -- --limit=50
 */

import { config } from 'dotenv';
import { writeFileSync, existsSync, readFileSync } from 'fs';

config({ path: '.env.local' });

const KEEPA_API_KEY = process.env.KEEPA_API_KEY;
const KEEPA_API_BASE = 'https://api.keepa.com';
const KEEPA_DOMAIN_JP = 5;

// ホーム&キッチンのルートカテゴリ
const HOME_KITCHEN_ROOT = 3839151; // ホーム&キッチン

// カテゴリ別検索設定（キーワードベース）
const SEARCH_CONFIGS: Array<{
  internalCategory: string;
  keywords: string[];
  priceMin?: number;
  priceMax?: number;
}> = [
  // 家具
  { internalCategory: 'ソファ', keywords: ['ソファ'], priceMin: 5000, priceMax: 100000 },
  { internalCategory: 'ベッド', keywords: ['ベッド', 'フレーム'], priceMin: 5000, priceMax: 80000 },
  { internalCategory: 'テーブル', keywords: ['テーブル'], priceMin: 3000, priceMax: 50000 },
  { internalCategory: 'チェア', keywords: ['チェア', '椅子'], priceMin: 3000, priceMax: 50000 },
  { internalCategory: 'サイドテーブル', keywords: ['サイドテーブル'], priceMin: 2000, priceMax: 30000 },
  { internalCategory: '座椅子', keywords: ['座椅子'], priceMin: 2000, priceMax: 30000 },
  { internalCategory: '収納', keywords: ['収納', 'ラック', 'シェルフ'], priceMin: 2000, priceMax: 50000 },
  // 照明
  { internalCategory: '照明', keywords: ['照明', 'ライト', 'ランプ'], priceMin: 1000, priceMax: 50000 },
  // ファブリック
  { internalCategory: 'ラグ', keywords: ['ラグ', 'カーペット'], priceMin: 1000, priceMax: 30000 },
  { internalCategory: 'カーテン', keywords: ['カーテン'], priceMin: 1000, priceMax: 20000 },
  { internalCategory: 'クッション', keywords: ['クッション'], priceMin: 500, priceMax: 10000 },
  { internalCategory: '寝具', keywords: ['布団', '毛布', '枕'], priceMin: 1000, priceMax: 30000 },
  // インテリア小物
  { internalCategory: '観葉植物', keywords: ['観葉植物', 'フェイクグリーン'], priceMin: 500, priceMax: 20000 },
  { internalCategory: 'ミラー', keywords: ['ミラー', '鏡'], priceMin: 1000, priceMax: 30000 },
  { internalCategory: '壁掛け', keywords: ['壁掛け', 'ウォールアート'], priceMin: 500, priceMax: 20000 },
  { internalCategory: '時計', keywords: ['時計', '掛け時計'], priceMin: 1000, priceMax: 20000 },
];

interface KeepaQueryResponse {
  timestamp: number;
  tokensLeft: number;
  refillIn: number;
  asinList?: string[];
  error?: { type: string; message: string };
}

interface Progress {
  collectedAsins: string[];
  categoryProgress: Record<string, string[]>;
  lastUpdated: string;
}

const PROGRESS_FILE = 'scripts/fetch-asins-progress.json';
const OUTPUT_FILE = 'scripts/collected-asins.txt';

/**
 * 進捗を読み込み
 */
function loadProgress(): Progress {
  if (existsSync(PROGRESS_FILE)) {
    return JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
  }
  return {
    collectedAsins: [],
    categoryProgress: {},
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * 進捗を保存
 */
function saveProgress(progress: Progress) {
  progress.lastUpdated = new Date().toISOString();
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

/**
 * Product Finderで商品を検索（より詳細な条件指定可能）
 */
async function searchProducts(params: {
  rootCategory: number;
  title_includes?: string[];
  minRating?: number;
  minReviews?: number;
  priceMin?: number;
  priceMax?: number;
  limit?: number;
}): Promise<{ asins: string[]; tokensLeft: number }> {
  const selection: Record<string, unknown> = {
    rootCategory: params.rootCategory,
    hasReviews: true,
    isAdultProduct: false,
    productType: [0], // 通常商品のみ
    sort: [['current_SALES', 'asc']], // 売上ランク順（低い=売れている）
  };

  if (params.title_includes && params.title_includes.length > 0) {
    selection.title = params.title_includes.join(' ');
  }
  if (params.minRating) {
    selection.rating_gte = Math.floor(params.minRating * 10);
  }
  if (params.minReviews) {
    selection.reviewCount_gte = params.minReviews;
  }
  if (params.priceMin) {
    selection.current_NEW_gte = params.priceMin;
  }
  if (params.priceMax) {
    selection.current_NEW_lte = params.priceMax;
  }

  const url = new URL(`${KEEPA_API_BASE}/query`);
  url.searchParams.set('key', KEEPA_API_KEY!);
  url.searchParams.set('domain', KEEPA_DOMAIN_JP.toString());
  url.searchParams.set('selection', JSON.stringify(selection));

  console.log(`    Query: rootCategory=${params.rootCategory}, title=${params.title_includes?.join(',') || 'any'}`);

  const response = await fetch(url.toString());
  const data = await response.json();

  if (data.error) {
    console.warn(`    ⚠ Search error: ${data.error.message}`);
    return { asins: [], tokensLeft: data.tokensLeft || 0 };
  }

  console.log(`    Tokens remaining: ${data.tokensLeft}, Found: ${data.asinList?.length || 0}`);

  return {
    asins: (data.asinList || []).slice(0, params.limit || 50),
    tokensLeft: data.tokensLeft || 0,
  };
}

/**
 * メイン処理
 */
async function main() {
  if (!KEEPA_API_KEY) {
    console.error('❌ KEEPA_API_KEY is not set');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const limitArg = args.find((arg) => arg.startsWith('--limit='));
  const perCategoryLimit = limitArg ? parseInt(limitArg.replace('--limit=', ''), 10) : 30;
  const resetArg = args.includes('--reset');

  if (resetArg) {
    console.log('🔄 進捗をリセットします...');
    writeFileSync(PROGRESS_FILE, JSON.stringify({ collectedAsins: [], categoryProgress: {}, lastUpdated: new Date().toISOString() }, null, 2));
  }

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║      Keepa Product Finder - インテリア家具ASIN収集             ║
╚════════════════════════════════════════════════════════════════╝

設定:
  - カテゴリ数: ${SEARCH_CONFIGS.length}
  - カテゴリあたり上限: ${perCategoryLimit}件
  - 予想取得数: 最大${SEARCH_CONFIGS.length * perCategoryLimit}件
`);

  const progress = loadProgress();
  const allAsins = new Set<string>(progress.collectedAsins);
  const categoryAsins: Record<string, string[]> = { ...progress.categoryProgress };

  for (const config of SEARCH_CONFIGS) {
    console.log(`\n📦 ${config.internalCategory} を検索中...`);

    if (categoryAsins[config.internalCategory]?.length >= perCategoryLimit) {
      console.log(`  ✓ 既に${categoryAsins[config.internalCategory].length}件取得済み、スキップ`);
      continue;
    }

    const categoryCollected: string[] = categoryAsins[config.internalCategory] || [];

    try {
      const result = await searchProducts({
        rootCategory: HOME_KITCHEN_ROOT,
        title_includes: config.keywords,
        priceMin: config.priceMin,
        priceMax: config.priceMax,
        minReviews: 10,
        minRating: 3.5,
        limit: perCategoryLimit,
      });

      for (const asin of result.asins) {
        if (categoryCollected.length >= perCategoryLimit) break;
        if (!allAsins.has(asin)) {
          allAsins.add(asin);
          categoryCollected.push(asin);
        }
      }

      // トークン不足の場合は待機
      if (result.tokensLeft < 0) {
        console.log(`  ⏳ トークン不足、60秒待機...`);
        await new Promise((resolve) => setTimeout(resolve, 60000));
      } else {
        // レート制限対策
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`  ❌ エラー:`, error);
    }

    categoryAsins[config.internalCategory] = categoryCollected;
    console.log(`  ✓ ${config.internalCategory}: ${categoryCollected.length}件収集`);

    // 進捗を保存
    progress.collectedAsins = Array.from(allAsins);
    progress.categoryProgress = categoryAsins;
    saveProgress(progress);
  }

  // 結果をファイルに保存
  const allAsinList = Array.from(allAsins);
  writeFileSync(OUTPUT_FILE, allAsinList.join('\n'));

  // 統計表示
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 収集結果
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

  for (const [category, asins] of Object.entries(categoryAsins)) {
    console.log(`  ${category}: ${asins.length}件`);
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  合計: ${allAsinList.length}件（重複除去済み）

出力ファイル: ${OUTPUT_FILE}

次のステップ:
  npm run amazon:fetch -- --file=${OUTPUT_FILE}
`);
}

main().catch((error) => {
  console.error('❌ エラー:', error);
  process.exit(1);
});
