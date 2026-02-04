/**
 * Keepa APIを使用してAmazonストア（セラー）の商品ASINを取得
 *
 * 使用方法:
 *   npm run amazon:store -- --seller="A1XXXXXXXX"
 *   npm run amazon:store -- --url="https://www.amazon.co.jp/stores/page/..."
 *   npm run amazon:store -- --brand="LOWYA"
 *
 * ストアのセラーIDの見つけ方:
 *   1. ストアページを開く
 *   2. 任意の商品ページに移動
 *   3. 「販売元」のリンクをクリック
 *   4. URLに含まれる seller=XXXXXXXX がセラーID
 */

import { config } from 'dotenv';
import { writeFileSync, existsSync, readFileSync } from 'fs';

config({ path: '.env.local' });

const KEEPA_API_KEY = process.env.KEEPA_API_KEY;
const KEEPA_API_BASE = 'https://api.keepa.com';
const KEEPA_DOMAIN_JP = 5;

// インテリアブランドリスト（50ブランド）
const INTERIOR_BRANDS: Array<{
  id: number;
  name: string;
  brandQuery: string;
  category: string;
  style: string;
}> = [
  { id: 1, name: 'LOWYA', brandQuery: 'LOWYA', category: '総合家具', style: 'scandinavian' },
  { id: 2, name: 'MODERN DECO', brandQuery: 'MODERN DECO', category: '総合家具', style: 'modern' },
  { id: 3, name: 'タンスのゲン', brandQuery: 'タンスのゲン', category: '総合家具', style: 'scandinavian' },
  { id: 4, name: 'DORIS', brandQuery: 'DORIS', category: '総合家具', style: 'modern' },
  { id: 5, name: 'RASIK', brandQuery: 'RASIK', category: 'ベッド', style: 'modern' },
  { id: 6, name: 'アイリスオーヤマ', brandQuery: 'アイリスオーヤマ', category: '総合家具', style: 'industrial' },
  { id: 7, name: 'YAMAZEN', brandQuery: '山善', category: '収納', style: 'modern' },
  { id: 8, name: 'VASAGLE', brandQuery: 'VASAGLE', category: '組立家具', style: 'industrial' },
  { id: 9, name: 'SONGMICS', brandQuery: 'SONGMICS', category: '収納', style: 'modern' },
  { id: 10, name: 'エア・リゾーム', brandQuery: 'エア・リゾーム', category: '総合家具', style: 'scandinavian' },
  { id: 11, name: 'AZUMAYA', brandQuery: '東谷', category: '総合家具', style: 'modern' },
  { id: 12, name: '佐藤産業', brandQuery: '佐藤産業', category: '収納家具', style: 'scandinavian' },
  { id: 13, name: 'ぼん家具', brandQuery: 'ぼん家具', category: '総合家具', style: 'modern' },
  { id: 14, name: '生活雑貨', brandQuery: '生活雑貨', category: '総合家具', style: 'modern' },
  { id: 15, name: 'WLIVE', brandQuery: 'WLIVE', category: 'デスク', style: 'modern' },
  { id: 16, name: 'ZINUS', brandQuery: 'ZINUS', category: 'ベッド', style: 'modern' },
  { id: 17, name: 'GOKUMIN', brandQuery: 'GOKUMIN', category: '寝具', style: 'modern' },
  { id: 18, name: 'Koala', brandQuery: 'コアラ マットレス', category: '寝具', style: 'modern' },
  { id: 19, name: 'Emma Sleep', brandQuery: 'Emma Sleep', category: '寝具', style: 'modern' },
  { id: 20, name: 'MyeFoam', brandQuery: 'MyeFoam', category: '寝具', style: 'modern' },
  { id: 21, name: 'EMOOR', brandQuery: 'エムール', category: '寝具', style: 'modern' },
  { id: 22, name: '西川', brandQuery: '西川', category: '寝具', style: 'modern' },
  { id: 23, name: 'Kumori', brandQuery: 'クモリ', category: 'ファブリック', style: 'modern' },
  { id: 24, name: 'Bedsure', brandQuery: 'Bedsure', category: 'ファブリック', style: 'modern' },
  { id: 25, name: 'フランスベッド', brandQuery: 'フランスベッド', category: 'ベッド', style: 'modern' },
  { id: 26, name: 'Hbada', brandQuery: 'Hbada', category: 'チェア', style: 'modern' },
  { id: 27, name: 'FLEXISPOT', brandQuery: 'FLEXISPOT', category: 'デスク', style: 'modern' },
  { id: 28, name: 'Bauhutte', brandQuery: 'バウヒュッテ', category: 'ゲーミング', style: 'modern' },
  { id: 29, name: 'GTRACING', brandQuery: 'GTRACING', category: 'ゲーミング', style: 'modern' },
  { id: 30, name: 'AKRacing', brandQuery: 'AKRacing', category: 'ゲーミング', style: 'modern' },
  { id: 31, name: 'Supsea', brandQuery: 'Supsea', category: 'チェア', style: 'scandinavian' },
  { id: 32, name: 'サンワダイレクト', brandQuery: 'サンワダイレクト', category: 'オフィス', style: 'modern' },
  { id: 33, name: 'Dowinx', brandQuery: 'Dowinx', category: 'ゲーミング', style: 'vintage' },
  { id: 34, name: 'Kerdom', brandQuery: 'Kerdom', category: 'チェア', style: 'modern' },
  { id: 35, name: 'カーテンくれない', brandQuery: 'カーテンくれない', category: 'カーテン', style: 'modern' },
  { id: 36, name: '満天カーテン', brandQuery: '満天カーテン', category: 'カーテン', style: 'scandinavian' },
  { id: 37, name: 'SystemK', brandQuery: 'システムK', category: 'ラグ', style: 'modern' },
  { id: 38, name: 'VK Living', brandQuery: 'VK Living', category: 'ファブリック', style: 'modern' },
  { id: 39, name: 'HAGIHARA', brandQuery: '萩原', category: 'ラグ', style: 'modern' },
  { id: 40, name: 'PONY DANCE', brandQuery: 'PONY DANCE', category: 'カーテン', style: 'modern' },
  { id: 41, name: 'グラムスタイル', brandQuery: 'グラムスタイル', category: 'ラグ', style: 'modern' },
  { id: 42, name: '山崎実業', brandQuery: '山崎実業', category: '収納雑貨', style: 'modern' },
  { id: 43, name: 'Umbra', brandQuery: 'Umbra', category: '雑貨', style: 'modern' },
  { id: 44, name: 'BeauBelle', brandQuery: 'ボーベル', category: '照明', style: 'scandinavian' },
  { id: 45, name: 'INTERFORM', brandQuery: 'インターフォルム', category: '照明', style: 'vintage' },
  { id: 46, name: 'Ampoule', brandQuery: 'アンプール', category: '照明', style: 'modern' },
  { id: 47, name: 'Art Work Studio', brandQuery: 'ART WORK STUDIO', category: '照明', style: 'vintage' },
  { id: 48, name: 'Luminous', brandQuery: 'ルミナス', category: 'ラック', style: 'industrial' },
  { id: 49, name: '天馬', brandQuery: '天馬', category: '収納', style: 'modern' },
  { id: 50, name: 'DRAW A LINE', brandQuery: 'DRAW A LINE', category: '収納', style: 'modern' },
];

interface KeepaSellerResponse {
  timestamp: number;
  tokensLeft: number;
  refillIn: number;
  sellers?: Record<string, {
    sellerId: string;
    sellerName: string;
    domainId: number;
    asinList?: string[];
    asinListLastSeen?: string[];
    totalStorefrontAsins?: number[];
  }>;
  error?: { type: string; message: string };
}

interface KeepaQueryResponse {
  timestamp: number;
  tokensLeft: number;
  refillIn: number;
  asinList?: string[];
  totalResults?: number;
  error?: { type: string; message: string };
}

const PROGRESS_FILE = 'scripts/fetch-store-progress.json';
const OUTPUT_FILE = 'scripts/store-asins.txt';

interface Progress {
  collectedAsins: string[];
  storeProgress: Record<string, { asins: string[]; lastUpdated: string }>;
}

function loadProgress(): Progress {
  if (existsSync(PROGRESS_FILE)) {
    return JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
  }
  return { collectedAsins: [], storeProgress: {} };
}

function saveProgress(progress: Progress) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

/**
 * セラーIDで商品リストを取得
 */
async function fetchSellerProducts(sellerId: string): Promise<{ asins: string[]; tokensLeft: number; sellerName?: string }> {
  const url = new URL(`${KEEPA_API_BASE}/seller`);
  url.searchParams.set('key', KEEPA_API_KEY!);
  url.searchParams.set('domain', KEEPA_DOMAIN_JP.toString());
  url.searchParams.set('seller', sellerId);
  url.searchParams.set('storefront', '1'); // ストアフロントのASINリストを取得

  console.log(`  Fetching seller: ${sellerId}`);

  const response = await fetch(url.toString());
  const data: KeepaSellerResponse = await response.json();

  if (data.error) {
    console.warn(`  ⚠ Seller API error: ${data.error.message}`);
    return { asins: [], tokensLeft: data.tokensLeft || 0 };
  }

  const seller = data.sellers?.[sellerId];
  const asins = seller?.asinList || seller?.asinListLastSeen || [];

  console.log(`  Tokens remaining: ${data.tokensLeft}`);
  console.log(`  Seller: ${seller?.sellerName || 'Unknown'}`);
  console.log(`  Total ASINs: ${asins.length}`);

  return {
    asins,
    tokensLeft: data.tokensLeft || 0,
    sellerName: seller?.sellerName,
  };
}

/**
 * ブランド名で商品を検索（Product Finder）
 */
async function searchByBrand(brand: string, page: number = 0): Promise<{ asins: string[]; tokensLeft: number; totalResults: number }> {
  const selection = {
    brand: brand,
    productType: [0], // 通常商品
    hasReviews: true,
    sort: [['current_SALES', 'asc']],
  };

  const url = new URL(`${KEEPA_API_BASE}/query`);
  url.searchParams.set('key', KEEPA_API_KEY!);
  url.searchParams.set('domain', KEEPA_DOMAIN_JP.toString());
  url.searchParams.set('selection', JSON.stringify(selection));
  url.searchParams.set('page', page.toString());
  url.searchParams.set('perPage', '100');

  console.log(`  Searching brand: ${brand} (page ${page})`);

  const response = await fetch(url.toString());
  const data: KeepaQueryResponse = await response.json();

  if (data.error) {
    console.warn(`  ⚠ Query error: ${data.error.message}`);
    return { asins: [], tokensLeft: data.tokensLeft || 0, totalResults: 0 };
  }

  console.log(`  Tokens remaining: ${data.tokensLeft}`);
  console.log(`  Found: ${data.asinList?.length || 0} (total: ${data.totalResults || 0})`);

  return {
    asins: data.asinList || [],
    tokensLeft: data.tokensLeft || 0,
    totalResults: data.totalResults || 0,
  };
}

/**
 * 全ブランドを順次処理
 */
async function processAllBrands(
  progress: Progress,
  allAsins: Set<string>,
  options: { maxPerBrand?: number; startFrom?: number }
): Promise<void> {
  const maxPerBrand = options.maxPerBrand || 100;
  const startFrom = options.startFrom || 1;

  console.log(`\n🚀 全ブランド処理開始 (${INTERIOR_BRANDS.length}ブランド)\n`);
  console.log(`  開始ID: ${startFrom}`);
  console.log(`  ブランドあたり上限: ${maxPerBrand}件\n`);

  for (const brand of INTERIOR_BRANDS) {
    if (brand.id < startFrom) continue;

    // 既に処理済みかチェック
    const existing = progress.storeProgress[brand.name];
    if (existing && existing.asins.length >= maxPerBrand) {
      console.log(`⏭️  ${brand.id}. ${brand.name}: 既に${existing.asins.length}件取得済み、スキップ`);
      continue;
    }

    console.log(`\n📦 ${brand.id}/${INTERIOR_BRANDS.length}: ${brand.name}`);
    console.log(`   クエリ: "${brand.brandQuery}"`);

    const brandAsins: string[] = existing?.asins || [];
    let page = 0;

    while (brandAsins.length < maxPerBrand) {
      try {
        const result = await searchByBrand(brand.brandQuery, page);

        if (result.asins.length === 0) {
          console.log(`   → 検索結果なし`);
          break;
        }

        for (const asin of result.asins) {
          if (brandAsins.length >= maxPerBrand) break;
          if (!allAsins.has(asin)) {
            allAsins.add(asin);
            brandAsins.push(asin);
          }
        }

        console.log(`   → ${brandAsins.length}件収集 (トークン: ${result.tokensLeft})`);

        // トークン管理: 1分に20トークン以下に制限
        // 1リクエスト約10トークン消費 → 30秒間隔で安全
        if (result.tokensLeft < 10) {
          const waitTime = 60; // トークン不足時は60秒待機
          console.log(`   ⏳ トークン不足 (${result.tokensLeft})、${waitTime}秒待機...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));
        } else if (result.tokensLeft < 30) {
          const waitTime = 30; // 低トークン時は30秒待機
          console.log(`   ⏳ トークン節約モード、${waitTime}秒待機...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));
        } else {
          await new Promise((resolve) => setTimeout(resolve, 3000)); // 通常は3秒
        }

        // 次のページへ
        if (result.asins.length < 50) break;
        page++;
        if (page >= 5) break; // 最大5ページ

      } catch (error) {
        console.error(`   ❌ エラー:`, error);
        break;
      }
    }

    // 進捗を保存
    progress.storeProgress[brand.name] = {
      asins: brandAsins,
      lastUpdated: new Date().toISOString(),
    };
    progress.collectedAsins = Array.from(allAsins);
    saveProgress(progress);
    writeFileSync(OUTPUT_FILE, Array.from(allAsins).join('\n'));

    console.log(`   ✓ ${brand.name}: ${brandAsins.length}件 (累計: ${allAsins.size}件)`);
  }
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
  const sellerArg = args.find((arg) => arg.startsWith('--seller='));
  const brandArg = args.find((arg) => arg.startsWith('--brand='));
  const listArg = args.includes('--list');
  const testArg = args.includes('--test');
  const allArg = args.includes('--all');
  const startArg = args.find((arg) => arg.startsWith('--start='));
  const maxArg = args.find((arg) => arg.startsWith('--max='));

  // ヘルプ表示
  if (!sellerArg && !brandArg && !listArg && !allArg) {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║        Keepa API ストア/ブランド別ASIN収集                     ║
╚════════════════════════════════════════════════════════════════╝

使用方法:
  npm run amazon:store -- --all                     # 全50ブランド順次処理
  npm run amazon:store -- --all --start=10         # 10番目から開始
  npm run amazon:store -- --all --max=50           # ブランドあたり最大50件
  npm run amazon:store -- --brand="LOWYA"           # 単一ブランド検索
  npm run amazon:store -- --brand="LOWYA" --test   # テスト（1ページのみ）
  npm run amazon:store -- --list                    # 登録ブランド一覧

登録済みブランド数: ${INTERIOR_BRANDS.length}

例:
  npm run amazon:store -- --all --max=30           # 各ブランド30件ずつ
  npm run amazon:store -- --brand="タンスのゲン"
`);
    return;
  }

  // 登録済みブランド一覧
  if (listArg) {
    console.log(`\n📋 登録済みインテリアブランド (${INTERIOR_BRANDS.length}件):\n`);
    for (const brand of INTERIOR_BRANDS) {
      const progress = loadProgress();
      const count = progress.storeProgress[brand.name]?.asins.length || 0;
      const status = count > 0 ? `✓ ${count}件` : '未取得';
      console.log(`  ${brand.id.toString().padStart(2)}. ${brand.name.padEnd(20)} [${brand.category}] ${status}`);
    }
    return;
  }

  const progress = loadProgress();
  const allAsins = new Set<string>(progress.collectedAsins);

  // 全ブランド処理
  if (allArg) {
    const startFrom = startArg ? parseInt(startArg.replace('--start=', ''), 10) : 1;
    const maxPerBrand = maxArg ? parseInt(maxArg.replace('--max=', ''), 10) : 50;

    await processAllBrands(progress, allAsins, { startFrom, maxPerBrand });
  }

  // セラーIDで検索
  if (sellerArg) {
    const sellerId = sellerArg.replace('--seller=', '').replace(/['"]/g, '');
    console.log(`\n🏪 セラー商品を取得中: ${sellerId}\n`);

    const result = await fetchSellerProducts(sellerId);

    for (const asin of result.asins) {
      allAsins.add(asin);
    }

    if (result.sellerName) {
      progress.storeProgress[result.sellerName] = {
        asins: result.asins,
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  // ブランド名で検索
  if (brandArg) {
    const brand = brandArg.replace('--brand=', '').replace(/['"]/g, '');
    console.log(`\n🏷️ ブランド商品を検索中: ${brand}\n`);

    let page = 0;
    let totalCollected = 0;
    const brandAsins: string[] = [];

    while (true) {
      const result = await searchByBrand(brand, page);

      if (result.asins.length === 0) break;

      for (const asin of result.asins) {
        if (!allAsins.has(asin)) {
          allAsins.add(asin);
          brandAsins.push(asin);
          totalCollected++;
        }
      }

      // テストモードは1ページのみ
      if (testArg) {
        console.log('  (テストモード: 1ページのみ)');
        break;
      }

      // トークン不足の場合は待機
      if (result.tokensLeft < 10) {
        console.log(`  ⏳ トークン不足、60秒待機...`);
        await new Promise((resolve) => setTimeout(resolve, 60000));
      }

      // 次のページへ
      if (result.asins.length < 100 || page >= 10) break; // 最大1000件
      page++;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    progress.storeProgress[brand] = {
      asins: brandAsins,
      lastUpdated: new Date().toISOString(),
    };

    console.log(`\n  ✓ ${brand}: ${totalCollected}件収集`);
  }

  // 結果を保存
  progress.collectedAsins = Array.from(allAsins);
  saveProgress(progress);
  writeFileSync(OUTPUT_FILE, Array.from(allAsins).join('\n'));

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 収集結果
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  合計: ${allAsins.size}件

出力ファイル: ${OUTPUT_FILE}

次のステップ:
  npm run amazon:fetch -- --file=${OUTPUT_FILE}
`);
}

main().catch((error) => {
  console.error('❌ エラー:', error);
  process.exit(1);
});
