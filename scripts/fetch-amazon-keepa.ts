/**
 * Keepa APIを使用したAmazon商品情報取得スクリプト
 *
 * ASINリストから商品情報を自動取得し、スプレッドシートに追加します。
 *
 * 使用方法:
 *   npm run amazon:fetch -- --file=asins.txt
 *   npm run amazon:fetch -- --asins="B08N5WRWNW,B09ABC1234"
 *
 * 必要な環境変数:
 *   KEEPA_API_KEY - Keepa APIキー（https://keepa.com/#!api から取得）
 */

import { config } from 'dotenv';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

// .env.local を読み込み
config({ path: '.env.local' });

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SERVICE_ACCOUNT_KEY_PATH = process.env.SERVICE_ACCOUNT_KEY_PATH || './serviceAccountKey.json';
const AMAZON_ASSOCIATE_ID = process.env.AMAZON_ASSOCIATE_ID || 'roomsetup-22';
const KEEPA_API_KEY = process.env.KEEPA_API_KEY;

// Keepa API設定
const KEEPA_API_BASE = 'https://api.keepa.com';
const KEEPA_DOMAIN_JP = 5; // Amazon.co.jp

// カテゴリマッピング（Keepaカテゴリ → 内部カテゴリ）
const CATEGORY_MAPPING: Record<string, string> = {
  // 照明
  'ホーム&キッチン > 家具 > 照明': '照明',
  'ホーム&キッチン > 照明': '照明',
  'インテリア > 照明': '照明',
  'ペンダントライト': '照明',
  'シーリングライト': '照明',
  'フロアランプ': '照明',
  'テーブルランプ': '照明',
  // ラグ
  'ホーム&キッチン > ラグ': 'ラグ',
  'ラグ・カーペット': 'ラグ',
  // 家具
  'ソファ': 'ソファ',
  'ベッド': 'ベッド',
  'テーブル': 'テーブル',
  'チェア': 'チェア',
  '椅子': 'チェア',
  // その他
  'クッション': 'クッション',
  'カーテン': 'カーテン',
  '収納': '収納',
  '観葉植物': '観葉植物',
  'ミラー': 'ミラー',
  '鏡': 'ミラー',
};

// 進捗ファイル
const PROGRESS_FILE = 'scripts/fetch-amazon-progress.json';

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
  completedAsins: string[];
  lastUpdated: string;
}

// Google Sheets認証
async function authenticateGoogleSheets() {
  const serviceAccount = JSON.parse(
    readFileSync(join(process.cwd(), SERVICE_ACCOUNT_KEY_PATH), 'utf-8')
  );

  const serviceAccountAuth = new JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(SPREADSHEET_ID!, serviceAccountAuth);
  await doc.loadInfo();
  console.log(`✓ Connected to spreadsheet: ${doc.title}`);
  return doc;
}

/**
 * Keepa APIで商品情報を取得
 */
async function fetchFromKeepa(asins: string[]): Promise<{ products: KeepaProduct[]; tokensLeft: number; refillIn: number }> {
  const url = new URL(`${KEEPA_API_BASE}/product`);
  url.searchParams.set('key', KEEPA_API_KEY!);
  url.searchParams.set('domain', KEEPA_DOMAIN_JP.toString());
  url.searchParams.set('asin', asins.join(','));
  url.searchParams.set('stats', '180'); // 過去180日の統計情報
  url.searchParams.set('update', '1'); // 最新情報を取得（トークン追加消費）
  url.searchParams.set('history', '1'); // 価格履歴を含める

  const response = await fetch(url.toString());
  const data: KeepaResponse = await response.json();

  if (data.error) {
    throw new Error(`Keepa API Error: ${data.error.message}`);
  }

  console.log(`  Tokens: ${data.tokensLeft} (refill in ${Math.round(data.refillIn / 1000)}s)`);

  return {
    products: data.products || [],
    tokensLeft: data.tokensLeft || 0,
    refillIn: data.refillIn || 60000,
  };
}

/**
 * Keepa価格データを円に変換（Keepaは1/100円単位）
 */
function keepaPriceToCurrency(price: number | undefined): number {
  if (!price || price < 0) return 0;
  return price; // Keepa JPは円単位
}

/**
 * 商品名からスタイル（vibe）を推定
 */
function guessVibe(title: string): string {
  const lowerTitle = title.toLowerCase();

  if (
    lowerTitle.includes('北欧') ||
    lowerTitle.includes('スカンジナビア') ||
    lowerTitle.includes('scandinavian') ||
    lowerTitle.includes('nordic')
  ) {
    return 'scandinavian';
  }
  if (
    lowerTitle.includes('モダン') ||
    lowerTitle.includes('modern') ||
    lowerTitle.includes('シンプル')
  ) {
    return 'modern';
  }
  if (
    lowerTitle.includes('ヴィンテージ') ||
    lowerTitle.includes('ビンテージ') ||
    lowerTitle.includes('vintage') ||
    lowerTitle.includes('アンティーク') ||
    lowerTitle.includes('レトロ')
  ) {
    return 'vintage';
  }
  if (
    lowerTitle.includes('インダストリアル') ||
    lowerTitle.includes('industrial') ||
    lowerTitle.includes('アイアン') ||
    lowerTitle.includes('スチール')
  ) {
    return 'industrial';
  }

  return ''; // 判定できない場合は空
}

/**
 * 商品名からカテゴリを推定
 */
function guessCategory(title: string, keepaCategories?: { catId: number; name: string }[]): string {
  // Keepaカテゴリから推定
  if (keepaCategories && keepaCategories.length > 0) {
    const categoryPath = keepaCategories.map((c) => c.name).join(' > ');
    for (const [pattern, category] of Object.entries(CATEGORY_MAPPING)) {
      if (categoryPath.includes(pattern)) {
        return category;
      }
    }
  }

  // 商品名から推定
  const patterns: [RegExp, string][] = [
    [/ペンダント|シーリング|フロアランプ|テーブルランプ|照明|ライト|ランプ/i, '照明'],
    [/ラグ|カーペット|マット/i, 'ラグ'],
    [/クッション|枕/i, 'クッション'],
    [/観葉植物|フェイクグリーン|人工観葉/i, '観葉植物'],
    [/カーテン|ブラインド/i, 'カーテン'],
    [/収納|シェルフ|ラック|チェスト|棚/i, '収納'],
    [/壁掛け|アート|ポスター|ウォール/i, '壁掛け'],
    [/サイドテーブル/i, 'サイドテーブル'],
    [/ソファ|ソファー|カウチ/i, 'ソファ'],
    [/チェア|椅子|スツール/i, 'チェア'],
    [/ベッド|ベッドフレーム/i, 'ベッド'],
    [/テーブル|デスク/i, 'テーブル'],
    [/座椅子/i, '座椅子'],
    [/こたつ/i, 'こたつ'],
    [/寝具|布団|毛布/i, '寝具'],
    [/ミラー|鏡/i, 'ミラー'],
  ];

  for (const [pattern, category] of patterns) {
    if (pattern.test(title)) {
      return category;
    }
  }

  return 'その他';
}

/**
 * 商品名からタグを生成
 */
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
  ];

  for (const [pattern, tag] of tagPatterns) {
    if (pattern.test(title)) {
      tags.push(tag);
    }
  }

  return tags;
}

/**
 * Keepa商品データを行データに変換
 */
function convertToRowData(product: KeepaProduct): Record<string, string> | null {
  if (!product.title) {
    console.warn(`  ⚠ Skipping ${product.asin}: No title`);
    return null;
  }

  // 画像URL（最初の画像を使用）
  let imageUrl = '';
  if (product.imagesCSV) {
    const images = product.imagesCSV.split(',');
    if (images.length > 0) {
      // Keepaの画像IDからAmazon画像URLを生成
      imageUrl = `https://images-na.ssl-images-amazon.com/images/I/${images[0]}`;
    }
  }

  // 価格を取得（Amazon価格 or 新品最安値）
  let price = 0;
  if (product.csv) {
    // csv[0] = Amazon price, csv[1] = New price
    const amazonPrices = product.csv[0];
    const newPrices = product.csv[1];

    // 最新の価格を取得
    if (amazonPrices && amazonPrices.length >= 2) {
      const latestAmazonPrice = amazonPrices[amazonPrices.length - 1];
      if (latestAmazonPrice > 0) {
        price = latestAmazonPrice;
      }
    }
    if (price === 0 && newPrices && newPrices.length >= 2) {
      const latestNewPrice = newPrices[newPrices.length - 1];
      if (latestNewPrice > 0) {
        price = latestNewPrice;
      }
    }
  }

  // レビュー情報
  let reviewAverage = 0;
  let reviewCount = 0;
  if (product.csv) {
    // csv[16] = Rating, csv[17] = Review count
    const ratings = product.csv[16];
    const counts = product.csv[17];

    if (ratings && ratings.length >= 2) {
      const latestRating = ratings[ratings.length - 1];
      if (latestRating > 0) {
        reviewAverage = latestRating / 10; // Keepaは10倍値
      }
    }
    if (counts && counts.length >= 2) {
      const latestCount = counts[counts.length - 1];
      if (latestCount > 0) {
        reviewCount = latestCount;
      }
    }
  }

  const category = guessCategory(product.title, product.categoryTree);
  const vibe = guessVibe(product.title);
  const tags = generateTags(product.title);

  return {
    asin: product.asin,
    name: product.title,
    price: price.toString(),
    imageUrl: imageUrl,
    category: category,
    vibe: vibe,
    tags: tags.join(','),
    reviewAverage: reviewAverage.toFixed(1),
    reviewCount: reviewCount.toString(),
    affiliateLink: `https://www.amazon.co.jp/dp/${product.asin}?tag=${AMAZON_ASSOCIATE_ID}`,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * ASINリストをパース
 */
function parseAsins(input: string): string[] {
  return input
    .split(/[,\n\s]+/)
    .map((asin) => asin.trim().toUpperCase())
    .filter((asin) => asin.length > 0 && /^[A-Z0-9]{10}$/.test(asin));
}

/**
 * 進捗を読み込み
 */
function loadProgress(): Progress {
  if (existsSync(PROGRESS_FILE)) {
    return JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
  }
  return { completedAsins: [], lastUpdated: new Date().toISOString() };
}

/**
 * 進捗を保存
 */
function saveProgress(progress: Progress) {
  progress.lastUpdated = new Date().toISOString();
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

/**
 * Amazon商品シートに追加
 */
async function addToSheet(doc: GoogleSpreadsheet, rows: Record<string, string>[]) {
  const sheetTitle = 'Amazon商品';
  let sheet = doc.sheetsByTitle[sheetTitle];

  if (!sheet) {
    console.log(`📝 「${sheetTitle}」シートを作成中...`);
    sheet = await doc.addSheet({
      title: sheetTitle,
      headerValues: [
        'asin',
        'name',
        'price',
        'imageUrl',
        'category',
        'vibe',
        'tags',
        'reviewAverage',
        'reviewCount',
        'affiliateLink',
        'updatedAt',
      ],
    });
  }

  // 既存のASINを取得
  await sheet.loadHeaderRow();
  const existingRows = await sheet.getRows();
  const existingAsins = new Set(existingRows.map((row) => row.get('asin')));

  // 新規のみフィルタ
  const newRows = rows.filter((row) => !existingAsins.has(row.asin));

  if (newRows.length === 0) {
    console.log('✓ 追加する新規商品はありません');
    return;
  }

  console.log(`📦 ${newRows.length}件の商品を追加中...`);
  await sheet.addRows(newRows);
  console.log(`✓ ${newRows.length}件追加完了`);
}

// メイン処理
async function main() {
  // 環境変数チェック
  if (!KEEPA_API_KEY) {
    console.error(`
❌ KEEPA_API_KEY が設定されていません

Keepa APIキーの取得方法:
  1. https://keepa.com にアクセス
  2. アカウント作成 & APIサブスクリプション購入
  3. https://keepa.com/#!api でAPIキーを取得
  4. .env.local に追加:
     KEEPA_API_KEY=your_api_key_here
`);
    process.exit(1);
  }

  if (!SPREADSHEET_ID) {
    console.error('❌ SPREADSHEET_ID is not set');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const fileArg = args.find((arg) => arg.startsWith('--file='));
  const asinsArg = args.find((arg) => arg.startsWith('--asins='));

  let asins: string[] = [];

  if (fileArg) {
    const filePath = fileArg.replace('--file=', '').replace(/^["']|["']$/g, '');
    if (!existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      process.exit(1);
    }
    asins = parseAsins(readFileSync(filePath, 'utf-8'));
  } else if (asinsArg) {
    asins = parseAsins(asinsArg.replace('--asins=', '').replace(/^["']|["']$/g, ''));
  } else {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║        Keepa API Amazon商品情報取得ツール                      ║
╚════════════════════════════════════════════════════════════════╝

使用方法:
  npm run amazon:fetch -- --file=asins.txt
  npm run amazon:fetch -- --asins="B08N5WRWNW,B09ABC1234"

ASINファイル形式（1行1ASINまたはカンマ区切り）

このスクリプトは:
  1. Keepa APIで商品情報を取得
  2. カテゴリ・スタイル・タグを自動推定
  3. スプレッドシートに自動追加
`);
    return;
  }

  if (asins.length === 0) {
    console.error('❌ 有効なASINが見つかりません');
    process.exit(1);
  }

  // 進捗を読み込み、完了済みを除外
  const progress = loadProgress();
  const pendingAsins = asins.filter((asin) => !progress.completedAsins.includes(asin));

  console.log(`\n🚀 Amazon商品情報取得開始`);
  console.log(`  総ASIN数: ${asins.length}`);
  console.log(`  処理済み: ${asins.length - pendingAsins.length}`);
  console.log(`  残り: ${pendingAsins.length}\n`);

  if (pendingAsins.length === 0) {
    console.log('✓ 全てのASINは処理済みです');
    return;
  }

  // スプレッドシートに接続
  const doc = await authenticateGoogleSheets();

  // Keepa APIは1リクエスト100件まで
  const BATCH_SIZE = 100;
  const allRows: Record<string, string>[] = [];

  for (let i = 0; i < pendingAsins.length; i += BATCH_SIZE) {
    const batch = pendingAsins.slice(i, i + BATCH_SIZE);
    console.log(`\n📦 Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length}件取得中...`);

    try {
      const result = await fetchFromKeepa(batch);

      for (const product of result.products) {
        const rowData = convertToRowData(product);
        if (rowData) {
          allRows.push(rowData);
          progress.completedAsins.push(product.asin);
          console.log(`  ✓ ${product.asin}: ${product.title?.substring(0, 40)}...`);
        }
      }

      // 進捗を保存
      saveProgress(progress);

      // トークン管理: 1分20トークン制限を守る
      if (i + BATCH_SIZE < pendingAsins.length) {
        if (result.tokensLeft < 10) {
          // トークン不足時は回復を待つ
          const waitTime = Math.max(60, Math.ceil(result.refillIn / 1000));
          console.log(`  ⏳ トークン不足 (${result.tokensLeft})、${waitTime}秒待機...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));
        } else if (result.tokensLeft < 50) {
          // 低トークン時は30秒待機
          console.log(`  ⏳ トークン節約モード (${result.tokensLeft})、30秒待機...`);
          await new Promise((resolve) => setTimeout(resolve, 30000));
        } else {
          // 通常は3秒待機
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
    } catch (error) {
      console.error(`❌ Batch failed:`, error);
      saveProgress(progress);
      throw error;
    }
  }

  // スプレッドシートに追加
  if (allRows.length > 0) {
    await addToSheet(doc, allRows);
  }

  // 統計表示
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 取得結果`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  const categoryCount: Record<string, number> = {};
  const vibeCount: Record<string, number> = {};

  for (const row of allRows) {
    categoryCount[row.category] = (categoryCount[row.category] || 0) + 1;
    if (row.vibe) {
      vibeCount[row.vibe] = (vibeCount[row.vibe] || 0) + 1;
    }
  }

  console.log(`\nカテゴリ別:`);
  Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => console.log(`  ${cat}: ${count}件`));

  console.log(`\nスタイル別:`);
  Object.entries(vibeCount)
    .sort((a, b) => b[1] - a[1])
    .forEach(([vibe, count]) => console.log(`  ${vibe}: ${count}件`));

  console.log(`\n✅ 完了: ${allRows.length}件の商品情報を取得しました`);
  console.log(`\n次のステップ:`);
  console.log(`  1. スプレッドシートで vibe/category を確認・修正`);
  console.log(`  2. npm run sync:amazon でFirestoreに同期`);
}

main().catch((error) => {
  console.error('❌ エラー:', error);
  process.exit(1);
});
