/**
 * Amazon商品シートセットアップスクリプト
 *
 * ASINリストから「Amazon商品」シートを作成し、
 * ヘッダー行とASINを自動入力します。
 *
 * 使用方法:
 *   npm run amazon:setup -- --file=asins.txt
 *   npm run amazon:setup -- --asins="B08N5WRWNW,B09ABC1234,B07XYZ5678"
 */

import { config } from 'dotenv';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// .env.local を読み込み
config({ path: '.env.local' });

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SERVICE_ACCOUNT_KEY_PATH = process.env.SERVICE_ACCOUNT_KEY_PATH || './serviceAccountKey.json';
const AMAZON_ASSOCIATE_ID = process.env.AMAZON_ASSOCIATE_ID || 'roomsetup-22';

if (!SPREADSHEET_ID) {
  console.error('❌ SPREADSHEET_ID is not set in environment variables');
  process.exit(1);
}

// ヘッダー定義
const HEADERS = [
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
];

// カテゴリ選択肢（データバリデーション用）
const CATEGORIES = [
  '照明',
  'ラグ',
  'クッション',
  '観葉植物',
  'カーテン',
  '収納',
  '壁掛け',
  'サイドテーブル',
  'ソファ',
  'チェア',
  'ベッド',
  'テーブル',
  '座椅子',
  'こたつ',
  '寝具',
  'ミラー',
  'その他',
];

// スタイル選択肢
const VIBES = ['scandinavian', 'modern', 'vintage', 'industrial'];

// Google Sheets認証（書き込み権限付き）
async function authenticateGoogleSheets() {
  try {
    const serviceAccount = JSON.parse(
      readFileSync(join(process.cwd(), SERVICE_ACCOUNT_KEY_PATH), 'utf-8')
    );

    const serviceAccountAuth = new JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'], // 書き込み権限
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
 * ASINリストをパース
 */
function parseAsins(input: string): string[] {
  // カンマ、改行、スペースで分割
  return input
    .split(/[,\n\s]+/)
    .map((asin) => asin.trim().toUpperCase())
    .filter((asin) => asin.length > 0 && /^[A-Z0-9]{10}$/.test(asin));
}

/**
 * ファイルからASINリストを読み込み
 */
function loadAsinsFromFile(filePath: string): string[] {
  if (!existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }
  const content = readFileSync(filePath, 'utf-8');
  return parseAsins(content);
}

/**
 * Amazon商品シートをセットアップ
 */
async function setupAmazonSheet(doc: GoogleSpreadsheet, asins: string[]) {
  const sheetTitle = 'Amazon商品';

  // 既存シートをチェック
  let sheet = doc.sheetsByTitle[sheetTitle];

  if (sheet) {
    console.log(`⚠ 「${sheetTitle}」シートは既に存在します`);
    console.log('  既存のデータに追記しますか？ (既存ASINは重複チェックします)');

    // 既存のASINを取得
    await sheet.loadHeaderRow();
    const rows = await sheet.getRows();
    const existingAsins = new Set(rows.map((row) => row.get('asin')));

    // 新規ASINのみフィルタ
    const newAsins = asins.filter((asin) => !existingAsins.has(asin));

    if (newAsins.length === 0) {
      console.log('✓ 追加するASINはありません（全て既存）');
      return;
    }

    console.log(`  新規ASIN: ${newAsins.length}件 / 既存: ${asins.length - newAsins.length}件`);
    asins = newAsins;
  } else {
    // 新規シート作成
    console.log(`📝 「${sheetTitle}」シートを作成中...`);
    sheet = await doc.addSheet({
      title: sheetTitle,
      headerValues: HEADERS,
    });
    console.log(`✓ シート作成完了`);
  }

  // データ行を追加
  console.log(`\n📦 ${asins.length}件のASINを追加中...`);

  const now = new Date().toISOString();
  const rows = asins.map((asin) => ({
    asin: asin,
    name: '',
    price: '',
    imageUrl: '',
    category: '',
    vibe: '',
    tags: '',
    reviewAverage: '',
    reviewCount: '',
    affiliateLink: generateAffiliateLink(asin),
    updatedAt: now,
  }));

  // バッチで追加（一度に最大100行）
  const BATCH_SIZE = 100;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await sheet.addRows(batch);
    console.log(`  ✓ ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length} 行追加`);
  }

  console.log(`\n✅ セットアップ完了！`);
  console.log(`\n📋 次のステップ:`);
  console.log(`  1. スプレッドシートを開く: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`);
  console.log(`  2. 「${sheetTitle}」シートで各商品の情報を入力:`);
  console.log(`     - name: 商品名`);
  console.log(`     - price: 価格（数字のみ）`);
  console.log(`     - imageUrl: 商品画像URL`);
  console.log(`     - category: ${CATEGORIES.slice(0, 5).join(', ')}...`);
  console.log(`     - vibe: ${VIBES.join(' / ')}`);
  console.log(`     - tags: タグ（カンマ区切り）`);
  console.log(`     - reviewAverage: レビュー平均（例: 4.3）`);
  console.log(`     - reviewCount: レビュー件数（例: 256）`);
  console.log(`  3. 入力完了後、同期を実行: npm run sync:amazon`);
}

// メイン処理
async function main() {
  const args = process.argv.slice(2);

  // 引数パース
  const fileArg = args.find((arg) => arg.startsWith('--file='));
  const asinsArg = args.find((arg) => arg.startsWith('--asins='));

  let asins: string[] = [];

  if (fileArg) {
    const filePath = fileArg.replace('--file=', '').replace(/^["']|["']$/g, '');
    console.log(`📁 ファイルからASINを読み込み: ${filePath}`);
    asins = loadAsinsFromFile(filePath);
  } else if (asinsArg) {
    const asinList = asinsArg.replace('--asins=', '').replace(/^["']|["']$/g, '');
    asins = parseAsins(asinList);
  } else {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║           Amazon商品シート セットアップツール                  ║
╚════════════════════════════════════════════════════════════════╝

使用方法:

  1. ファイルからASINを読み込む:
     npm run amazon:setup -- --file=asins.txt

  2. 直接ASINを指定:
     npm run amazon:setup -- --asins="B08N5WRWNW,B09ABC1234,B07XYZ5678"

ASINファイル形式（asins.txt）:
  - 1行に1つのASIN
  - またはカンマ区切り
  - 空行・スペースは無視されます

例（asins.txt）:
  B08N5WRWNW
  B09ABC1234
  B07XYZ5678

このスクリプトは:
  1. スプレッドシートに「Amazon商品」シートを作成
  2. ヘッダー行を設定
  3. ASINとアフィリエイトリンクを自動入力
  4. 他のカラムは手動で入力してください
`);
    return;
  }

  if (asins.length === 0) {
    console.error('❌ 有効なASINが見つかりませんでした');
    console.log('  ASINは10文字の英数字です（例: B08N5WRWNW）');
    process.exit(1);
  }

  console.log(`\n✓ ${asins.length}件のASINを検出\n`);

  // 最初の5件を表示
  console.log('  プレビュー:');
  asins.slice(0, 5).forEach((asin, i) => {
    console.log(`    ${i + 1}. ${asin}`);
  });
  if (asins.length > 5) {
    console.log(`    ... 他 ${asins.length - 5}件`);
  }
  console.log('');

  // スプレッドシートに接続
  const doc = await authenticateGoogleSheets();

  // シートをセットアップ
  await setupAmazonSheet(doc, asins);
}

main().catch((error) => {
  console.error('❌ エラー:', error);
  process.exit(1);
});
