/**
 * Amazon商品同期スクリプト
 *
 * スプレッドシートの「Amazon商品」シートからデータを読み込み、
 * Firestoreに同期します。
 *
 * 使用方法:
 *   npm run sync:amazon
 */

import { config } from 'dotenv';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { LegacyProduct as Product, AmazonSpreadsheetRow } from '../lib/types/product';

// .env.local を読み込み
config({ path: '.env.local' });

// 環境変数の確認
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SERVICE_ACCOUNT_KEY_PATH = process.env.SERVICE_ACCOUNT_KEY_PATH || './serviceAccountKey.json';
const AMAZON_ASSOCIATE_ID = process.env.AMAZON_ASSOCIATE_ID || 'roomsetup-22';

if (!SPREADSHEET_ID) {
  console.error('❌ SPREADSHEET_ID is not set in environment variables');
  process.exit(1);
}

// Firebase Admin初期化
if (getApps().length === 0) {
  try {
    const serviceAccount = JSON.parse(
      readFileSync(join(process.cwd(), SERVICE_ACCOUNT_KEY_PATH), 'utf-8')
    );
    initializeApp({
      credential: cert(serviceAccount),
    });
    console.log(`✓ Firebase Admin initialized (Project: ${serviceAccount.project_id})`);
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error);
    process.exit(1);
  }
}

const db = getFirestore();
console.log(`✓ Firestore client initialized (Database: ${db.databaseId || '(default)'})`);

// Google Sheets認証
async function authenticateGoogleSheets() {
  try {
    const serviceAccount = JSON.parse(
      readFileSync(join(process.cwd(), SERVICE_ACCOUNT_KEY_PATH), 'utf-8')
    );

    const serviceAccountAuth = new JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const doc = new GoogleSpreadsheet(SPREADSHEET_ID!, serviceAccountAuth);
    await doc.loadInfo();
    console.log(`✓ Connected to spreadsheet: ${doc.title}`);
    return doc;
  } catch (error) {
    console.error('❌ Failed to authenticate Google Sheets:', error);
    throw error;
  }
}

/**
 * ASINからアフィリエイトリンクを生成
 */
function generateAffiliateLink(asin: string): string {
  return `https://www.amazon.co.jp/dp/${asin}?tag=${AMAZON_ASSOCIATE_ID}`;
}

/**
 * 商品IDを生成（amazon_ASIN形式）
 */
function generateProductId(asin: string): string {
  return `amazon_${asin}`;
}

// スプレッドシートからAmazon商品データを取得
async function fetchAmazonProductsFromSheet(doc: GoogleSpreadsheet): Promise<Product[]> {
  // 「Amazon商品」シートを探す
  const amazonSheet = doc.sheetsByTitle['Amazon商品'];

  if (!amazonSheet) {
    console.error('❌ 「Amazon商品」シートが見つかりません');
    console.log('  利用可能なシート:');
    Object.keys(doc.sheetsByTitle).forEach((title) => {
      console.log(`    - ${title}`);
    });
    process.exit(1);
  }

  await amazonSheet.loadHeaderRow();
  const rows = await amazonSheet.getRows<AmazonSpreadsheetRow>();

  console.log(`✓ Found ${rows.length} rows in Amazon商品 sheet`);

  const products: Product[] = [];

  for (const row of rows) {
    try {
      const asin = row.get('asin') as string;
      const name = row.get('name') as string;

      // 必須フィールドの検証
      if (!asin || !name) {
        console.warn('⚠ Skipping row with missing required fields:', {
          asin,
          name,
        });
        continue;
      }

      const tags = row.get('tags') as string;
      const category = (row.get('category') as string) || 'その他';
      const tagArray = tags ? tags.split(',').map((tag) => tag.trim()) : [];

      // keywordsを生成（category + tags + 商品名から抽出）
      const keywords: string[] = [];

      // カテゴリを追加
      if (category) {
        keywords.push(category);
      }

      // タグを追加
      keywords.push(...tagArray);

      // 商品名からキーワードを抽出（カテゴリ関連の単語）
      const categoryKeywordPatterns = [
        'ソファ',
        'ソファー',
        'カウチ',
        'ベッド',
        'ベッドフレーム',
        'テーブル',
        'センターテーブル',
        'ローテーブル',
        'ダイニングテーブル',
        'サイドテーブル',
        'チェア',
        '椅子',
        'ダイニングチェア',
        'スツール',
        '照明',
        'ライト',
        'ランプ',
        'シーリングライト',
        'ペンダントライト',
        'フロアランプ',
        'テーブルランプ',
        'ラグ',
        'カーペット',
        'マット',
        'クッション',
        '枕',
        'カーテン',
        'ブラインド',
        '観葉植物',
        'フェイクグリーン',
        'グリーン',
        '壁掛け',
        'アート',
        'ポスター',
        'ミラー',
        '鏡',
        '時計',
        '収納',
        'シェルフ',
        'ラック',
        'チェスト',
        '棚',
      ];

      for (const pattern of categoryKeywordPatterns) {
        if (name.includes(pattern)) {
          keywords.push(pattern);
        }
      }

      // 重複を除去
      const uniqueKeywords = [...new Set(keywords)];

      // レビュー情報を取得
      const reviewAverage = parseFloat(row.get('reviewAverage') as string) || 0;
      const reviewCount = parseInt(row.get('reviewCount') as string, 10) || 0;

      const affiliateLink = generateAffiliateLink(asin);

      const product: Product = {
        id: generateProductId(asin),
        source: 'amazon',
        name: name,
        price: parseFloat(row.get('price') as string) || 0,
        imageUrl: (row.get('imageUrl') as string) || '',
        affiliateLink: affiliateLink,
        category: category,
        tags: tagArray,
        vibe: (row.get('vibe') as string) || '',
        asin: asin,
        reviewAverage: reviewAverage,
        reviewCount: reviewCount,
        updatedAt: new Date(),
      };

      // Firestoreで使用する追加フィールド
      (product as any).keywords = uniqueKeywords;
      (product as any).isActive = true;
      (product as any).thumbnailUrl = product.imageUrl;
      (product as any).affiliateUrl = product.affiliateLink;

      products.push(product);
    } catch (error) {
      console.error('❌ Error processing row:', error);
    }
  }

  return products;
}

// Firestoreにデータを同期（Upsert）- バッチサイズ制限対応
async function syncToFirestore(products: Product[]) {
  const BATCH_SIZE = 400; // Firestoreのバッチ上限は500だが、余裕を持って400に
  let totalCount = 0;
  let batchNumber = 0;

  // 製品を小さなチャンクに分割
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const chunk = products.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    batchNumber++;

    console.log(`\n📦 Processing batch ${batchNumber} (${chunk.length} products)...`);

    for (const product of chunk) {
      const docRef = db.collection('products').doc(product.id);

      // 全て set で上書き（既存チェックを省略してパフォーマンス向上）
      batch.set(
        docRef,
        {
          ...product,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        { merge: true }
      ); // merge: true で既存フィールドを保持

      totalCount++;
    }

    await batch.commit();
    console.log(`✓ Batch ${batchNumber} committed (${totalCount}/${products.length} total)`);

    // レート制限を避けるため少し待機
    if (i + BATCH_SIZE < products.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log(`\n✓ Successfully synced ${totalCount} Amazon products to Firestore`);
}

// 統計情報を表示
function showStatistics(products: Product[]) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Amazon商品統計');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // カテゴリ別集計
  const categoryCount: Record<string, number> = {};
  const vibeCount: Record<string, number> = {};

  for (const product of products) {
    categoryCount[product.category] = (categoryCount[product.category] || 0) + 1;
    if (product.vibe) {
      vibeCount[product.vibe] = (vibeCount[product.vibe] || 0) + 1;
    }
  }

  console.log('カテゴリ別:');
  Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      console.log(`  ${cat}: ${count}件`);
    });

  console.log('\nスタイル別:');
  Object.entries(vibeCount)
    .sort((a, b) => b[1] - a[1])
    .forEach(([vibe, count]) => {
      console.log(`  ${vibe}: ${count}件`);
    });

  console.log(`\n合計: ${products.length}件`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// メイン処理
async function main() {
  try {
    console.log('🚀 Starting Amazon product sync...\n');
    console.log(`  Associate ID: ${AMAZON_ASSOCIATE_ID}\n`);

    // Google Sheetsから取得
    const doc = await authenticateGoogleSheets();
    const products = await fetchAmazonProductsFromSheet(doc);

    if (products.length === 0) {
      console.log('⚠ No valid Amazon products found in spreadsheet');
      return;
    }

    // 統計情報を表示
    showStatistics(products);

    // Firestoreに同期
    await syncToFirestore(products);

    console.log('\n✅ Amazon product sync completed successfully!');
  } catch (error) {
    console.error('\n❌ Amazon product sync failed:', error);
    process.exit(1);
  }
}

main();
