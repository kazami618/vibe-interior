/**
 * Amazon商品データ修正スクリプト
 *
 * スプレッドシートの既存データを修正:
 * 1. price=0の商品をKeepa APIで再取得
 * 2. vibeが空の商品にブランド/カテゴリベースでデフォルト設定
 * 3. 重複商品（色違い等）を削除
 * 4. reviewAverage/reviewCountを修正
 */

import { config } from 'dotenv';
import { GoogleSpreadsheet, GoogleSpreadsheetRow } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { readFileSync } from 'fs';
import { join } from 'path';

config({ path: '.env.local' });

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SERVICE_ACCOUNT_KEY_PATH = process.env.SERVICE_ACCOUNT_KEY_PATH || './serviceAccountKey.json';
const KEEPA_API_KEY = process.env.KEEPA_API_KEY;

const KEEPA_API_BASE = 'https://api.keepa.com';
const KEEPA_DOMAIN_JP = 5;

// ブランドからデフォルトvibeを推定
const BRAND_VIBE_MAP: Record<string, string> = {
  // 北欧系
  'LOWYA': 'scandinavian',
  'ロウヤ': 'scandinavian',
  'エアリゾーム': 'scandinavian',
  'air rhizome': 'scandinavian',
  'IKEA': 'scandinavian',
  'イケア': 'scandinavian',

  // モダン系
  'ニトリ': 'modern',
  'NITORI': 'modern',
  '無印良品': 'modern',
  'MUJI': 'modern',
  '山善': 'modern',
  'YAMAZEN': 'modern',
  'アイリスオーヤマ': 'modern',
  'IRIS': 'modern',
  'タンスのゲン': 'modern',
  'MODERN DECO': 'modern',
  'モダンデコ': 'modern',

  // インダストリアル系
  'VASAGLE': 'industrial',
  'SONGMICS': 'industrial',
  'サンワダイレクト': 'industrial',
  'DORIS': 'industrial',
  'ドリス': 'industrial',

  // ヴィンテージ系
  '東谷': 'vintage',
  'AZUMAYA': 'vintage',
};

// カテゴリからデフォルトvibeを推定
const CATEGORY_VIBE_MAP: Record<string, string> = {
  '照明': 'modern',
  'ラグ': 'scandinavian',
  'クッション': 'scandinavian',
  'カーテン': 'modern',
  '収納': 'modern',
  'ソファ': 'modern',
  'チェア': 'modern',
  'ベッド': 'modern',
  'テーブル': 'modern',
  '観葉植物': 'scandinavian',
  '壁掛け': 'modern',
  '寝具': 'modern',
};

interface KeepaProduct {
  asin: string;
  title?: string;
  csv?: number[][];
  stats?: {
    current?: number[];
  };
}

interface KeepaResponse {
  tokensLeft: number;
  refillIn: number;
  products?: KeepaProduct[];
  error?: { type: string; message: string };
}

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
  console.log(`✓ Connected: ${doc.title}`);
  return doc;
}

/**
 * Keepa APIで商品情報を再取得
 */
async function fetchFromKeepa(asins: string[]): Promise<{ products: KeepaProduct[]; tokensLeft: number }> {
  const url = new URL(`${KEEPA_API_BASE}/product`);
  url.searchParams.set('key', KEEPA_API_KEY!);
  url.searchParams.set('domain', KEEPA_DOMAIN_JP.toString());
  url.searchParams.set('asin', asins.join(','));
  url.searchParams.set('stats', '180');
  url.searchParams.set('history', '1');
  url.searchParams.set('buybox', '1'); // Buy Box価格も取得

  const response = await fetch(url.toString());
  const data: KeepaResponse = await response.json();

  if (data.error) {
    throw new Error(`Keepa API Error: ${data.error.message}`);
  }

  return {
    products: data.products || [],
    tokensLeft: data.tokensLeft || 0,
  };
}

/**
 * Keepa csv配列から最新の値を取得
 * csvは [time, value, time, value, ...] の形式
 */
function getLatestValue(csv: number[] | undefined): number {
  if (!csv || csv.length < 2) return 0;

  // 後ろから有効な値を探す
  for (let i = csv.length - 1; i >= 0; i -= 2) {
    const value = csv[i];
    if (value > 0) return value;
  }
  return 0;
}

/**
 * 商品の価格とレビュー情報を抽出
 */
function extractProductData(product: KeepaProduct): { price: number; rating: number; reviewCount: number } {
  let price = 0;
  let rating = 0;
  let reviewCount = 0;

  if (product.stats?.current) {
    // stats.currentを優先（インデックス: 0=Amazon, 1=New, 16=Rating, 17=ReviewCount, 18=BuyBox）
    const current = product.stats.current;
    price = current[18] > 0 ? current[18] : (current[0] > 0 ? current[0] : current[1]);
    rating = current[16] > 0 ? current[16] / 10 : 0; // 10倍値
    reviewCount = current[17] > 0 ? current[17] : 0;
  }

  // statsがない場合はcsvから取得
  if (price === 0 && product.csv) {
    // BuyBox価格 (index 18) > Amazon価格 (index 0) > 新品価格 (index 1)
    price = getLatestValue(product.csv[18]) || getLatestValue(product.csv[0]) || getLatestValue(product.csv[1]);
  }

  if (rating === 0 && product.csv?.[16]) {
    const rawRating = getLatestValue(product.csv[16]);
    rating = rawRating > 0 ? rawRating / 10 : 0;
  }

  if (reviewCount === 0 && product.csv?.[17]) {
    reviewCount = getLatestValue(product.csv[17]);
  }

  return { price, rating, reviewCount };
}

/**
 * 商品名からブランドを抽出
 */
function extractBrand(name: string): string | null {
  for (const brand of Object.keys(BRAND_VIBE_MAP)) {
    if (name.toLowerCase().includes(brand.toLowerCase())) {
      return brand;
    }
  }
  return null;
}

/**
 * 商品名からvibeを推定
 */
function guessVibe(name: string, category: string): string {
  const lowerName = name.toLowerCase();

  // キーワードベース
  if (lowerName.includes('北欧') || lowerName.includes('scandinavian') || lowerName.includes('nordic')) {
    return 'scandinavian';
  }
  if (lowerName.includes('モダン') || lowerName.includes('modern') || lowerName.includes('シンプル')) {
    return 'modern';
  }
  if (lowerName.includes('ヴィンテージ') || lowerName.includes('ビンテージ') || lowerName.includes('vintage') ||
      lowerName.includes('アンティーク') || lowerName.includes('レトロ')) {
    return 'vintage';
  }
  if (lowerName.includes('インダストリアル') || lowerName.includes('industrial') ||
      lowerName.includes('アイアン') || lowerName.includes('スチール製')) {
    return 'industrial';
  }

  // ブランドベース
  const brand = extractBrand(name);
  if (brand && BRAND_VIBE_MAP[brand]) {
    return BRAND_VIBE_MAP[brand];
  }

  // カテゴリベース
  if (CATEGORY_VIBE_MAP[category]) {
    return CATEGORY_VIBE_MAP[category];
  }

  return 'modern'; // デフォルト
}

/**
 * 商品名を正規化（色・サイズ情報を除去）
 */
function normalizeProductName(name: string): string {
  return name
    // 色を除去
    .replace(/\s*(ホワイト|ブラック|グレー|ベージュ|ブラウン|ナチュラル|オーク|ウォールナット|ブルー|グリーン|ピンク|レッド|ネイビー|アイボリー|ダークブラウン|ライトブラウン|ライトグレー|ダークグレー|チャコール|モカ|キャメル|グレージュ|シルバー|ゴールド|ブロンズ)/gi, '')
    .replace(/\s*(white|black|gray|grey|beige|brown|natural|oak|walnut|blue|green|pink|red|navy|ivory)/gi, '')
    // サイズを除去
    .replace(/\s*\d+[×x]\d+\s*(cm|mm|m)?/gi, '')
    .replace(/\s*(シングル|セミダブル|ダブル|クイーン|キング|S|M|L|XL|XXL|1P|2P|3P)/gi, '')
    .replace(/\s*\d+畳/gi, '')
    // 括弧内を除去
    .replace(/[（(][^)）]*[)）]/g, '')
    .replace(/【[^】]*】/g, '')
    .replace(/\[[^\]]*\]/g, '')
    // 余分なスペースを整理
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 重複を検出（正規化した名前が類似）
 */
function findDuplicates(rows: GoogleSpreadsheetRow[]): Set<number> {
  const duplicateIndices = new Set<number>();
  const seenNames = new Map<string, number>(); // normalized name -> first index

  for (let i = 0; i < rows.length; i++) {
    const name = rows[i].get('name') || '';
    const normalized = normalizeProductName(name);

    // 短すぎる名前は比較しない
    if (normalized.length < 10) continue;

    // 既に同じ正規化名があれば重複
    if (seenNames.has(normalized)) {
      duplicateIndices.add(i);
    } else {
      seenNames.set(normalized, i);
    }
  }

  return duplicateIndices;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const fixPrice = args.includes('--fix-price') || args.includes('--all');
  const fixVibe = args.includes('--fix-vibe') || args.includes('--all');
  const fixDuplicates = args.includes('--fix-duplicates') || args.includes('--all');
  const deleteZeroPrice = args.includes('--delete-zero-price');

  if (!fixPrice && !fixVibe && !fixDuplicates && !deleteZeroPrice) {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║        Amazon商品データ修正ツール                               ║
╚════════════════════════════════════════════════════════════════╝

使用方法:
  npm run amazon:fix -- --fix-price        # 価格0の商品を再取得
  npm run amazon:fix -- --fix-vibe         # vibeが空の商品を修正
  npm run amazon:fix -- --fix-duplicates   # 重複商品を削除
  npm run amazon:fix -- --delete-zero-price # 価格0の商品を削除
  npm run amazon:fix -- --all              # すべての修正を実行
  npm run amazon:fix -- --all --dry-run    # 変更をプレビュー（実行しない）
`);
    return;
  }

  console.log(`\n🔧 Amazon商品データ修正開始`);
  console.log(`  修正対象:`);
  if (fixPrice) console.log(`    - 価格0の商品を再取得`);
  if (fixVibe) console.log(`    - vibeが空の商品にデフォルト設定`);
  if (fixDuplicates) console.log(`    - 重複商品を削除`);
  if (deleteZeroPrice) console.log(`    - 価格0の商品を削除`);
  if (dryRun) console.log(`  ⚠ ドライラン: 変更は実行されません\n`);

  const doc = await authenticateGoogleSheets();
  const sheet = doc.sheetsByTitle['Amazon商品'];

  if (!sheet) {
    console.error('❌ Amazon商品シートが見つかりません');
    return;
  }

  await sheet.loadHeaderRow();
  const rows = await sheet.getRows();
  console.log(`📊 現在の商品数: ${rows.length}件\n`);

  let updateCount = 0;
  let deleteCount = 0;

  // 1. 重複削除
  if (fixDuplicates) {
    console.log(`\n━━━ 重複商品の検出 ━━━`);
    const duplicates = findDuplicates(rows);
    console.log(`  重複商品: ${duplicates.size}件`);

    if (duplicates.size > 0) {
      // 重複を後ろから削除（インデックスがずれないように）
      const sortedIndices = Array.from(duplicates).sort((a, b) => b - a);

      for (let i = 0; i < sortedIndices.length; i++) {
        const idx = sortedIndices[i];
        const row = rows[idx];
        console.log(`  削除: ${row.get('name')?.substring(0, 50)}...`);
        if (!dryRun) {
          try {
            await row.delete();
            deleteCount++;
          } catch (error: unknown) {
            if (error instanceof Error && error.message.includes('429')) {
              console.log(`  ⏳ レート制限、60秒待機... (${i}/${sortedIndices.length})`);
              await new Promise(r => setTimeout(r, 60000));
              // リトライ
              await row.delete();
              deleteCount++;
            } else {
              throw error;
            }
          }
          // APIレート制限対策: 1秒待機
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
  }

  // 行を再取得（削除後）
  let currentRows = fixDuplicates && !dryRun ? await sheet.getRows() : rows;

  // 2. 価格0の商品を削除
  if (deleteZeroPrice) {
    console.log(`\n━━━ 価格0の商品を削除 ━━━`);
    const zeropriceRows = currentRows.filter(r => !r.get('price') || r.get('price') === '0');
    console.log(`  対象: ${zeropriceRows.length}件`);

    if (zeropriceRows.length > 0) {
      for (let i = 0; i < zeropriceRows.length; i++) {
        const row = zeropriceRows[i];
        const name = row.get('name') || '';
        const asin = row.get('asin') || '';
        console.log(`  [${i+1}/${zeropriceRows.length}] 削除: ${name.substring(0, 40)}... (${asin})`);

        if (!dryRun) {
          try {
            await row.delete();
            deleteCount++;
          } catch (error: unknown) {
            if (error instanceof Error && error.message.includes('429')) {
              console.log(`  ⏳ レート制限、60秒待機... (${i+1}/${zeropriceRows.length})`);
              await new Promise(r => setTimeout(r, 60000));
              await row.delete();
              deleteCount++;
            } else {
              throw error;
            }
          }
          // APIレート制限対策: 1秒待機
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      // 行を再取得
      if (!dryRun) {
        currentRows = await sheet.getRows();
      }
    }
  }

  // 3. 価格0の商品をKeepa APIで修正
  if (fixPrice) {
    console.log(`\n━━━ 価格0の商品を修正 ━━━`);
    const zeropriceRows = currentRows.filter(r => !r.get('price') || r.get('price') === '0');
    console.log(`  対象: ${zeropriceRows.length}件`);

    if (zeropriceRows.length > 0 && KEEPA_API_KEY) {
      // バッチで処理
      const BATCH_SIZE = 50;
      for (let i = 0; i < zeropriceRows.length; i += BATCH_SIZE) {
        const batch = zeropriceRows.slice(i, i + BATCH_SIZE);
        const asins = batch.map(r => r.get('asin')).filter(Boolean);

        console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${asins.length}件を再取得...`);

        try {
          const result = await fetchFromKeepa(asins);
          console.log(`  Tokens: ${result.tokensLeft}`);

          for (const product of result.products) {
            const { price, rating, reviewCount } = extractProductData(product);
            const row = batch.find(r => r.get('asin') === product.asin);

            if (row && price > 0) {
              console.log(`    ✓ ${product.asin}: ¥${price} (★${rating.toFixed(1)}, ${reviewCount}件)`);
              if (!dryRun) {
                row.set('price', price.toString());
                row.set('reviewAverage', rating.toFixed(1));
                row.set('reviewCount', reviewCount.toString());
                await row.save();
                updateCount++;
              }
            } else if (row) {
              console.log(`    ⚠ ${product.asin}: 価格取得できず`);
            }
          }

          // トークン節約
          if (result.tokensLeft < 20 && i + BATCH_SIZE < zeropriceRows.length) {
            console.log(`  ⏳ トークン回復待ち (60秒)...`);
            await new Promise(r => setTimeout(r, 60000));
          } else if (i + BATCH_SIZE < zeropriceRows.length) {
            await new Promise(r => setTimeout(r, 3000));
          }
        } catch (error) {
          console.error(`  ❌ Batch failed:`, error);
        }
      }
    } else if (!KEEPA_API_KEY) {
      console.log(`  ⚠ KEEPA_API_KEYが未設定のため、価格修正をスキップ`);
    }
  }

  // 4. vibeが空の商品を修正
  if (fixVibe) {
    console.log(`\n━━━ vibeが空の商品を修正 ━━━`);
    const emptyVibeRows = currentRows.filter(r => !r.get('vibe'));
    console.log(`  対象: ${emptyVibeRows.length}件`);

    for (let i = 0; i < emptyVibeRows.length; i++) {
      const row = emptyVibeRows[i];
      const name = row.get('name') || '';
      const category = row.get('category') || '';
      const newVibe = guessVibe(name, category);

      console.log(`  [${i+1}/${emptyVibeRows.length}] ${name.substring(0, 40)}... → ${newVibe}`);
      if (!dryRun) {
        try {
          row.set('vibe', newVibe);
          await row.save();
          updateCount++;
        } catch (error: unknown) {
          if (error instanceof Error && error.message.includes('429')) {
            console.log(`  ⏳ レート制限、60秒待機... (${i}/${emptyVibeRows.length})`);
            await new Promise(r => setTimeout(r, 60000));
            // リトライ
            await row.save();
            updateCount++;
          } else {
            throw error;
          }
        }
        // APIレート制限対策: 1.5秒待機
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  }

  // 結果サマリー
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 修正結果`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  if (dryRun) {
    console.log(`  ⚠ ドライラン: 変更は実行されていません`);
  } else {
    console.log(`  更新: ${updateCount}件`);
    console.log(`  削除: ${deleteCount}件`);
  }
  console.log(`\n✅ 完了`);
}

main().catch(console.error);
