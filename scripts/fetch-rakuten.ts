/**
 * 楽天商品検索APIからデータを取得し、FirestoreとGoogleスプレッドシートに保存するスクリプト
 *
 * 使用方法:
 * npm run fetch:rakuten -- --keyword="北欧 ソファ" --genre="interior" --count=30
 */

import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseArgs } from 'util';

// .env.local を読み込み
config({ path: '.env.local' });

// 環境変数
const RAKUTEN_APP_ID = process.env.RAKUTEN_APP_ID;
const RAKUTEN_AFFILIATE_ID = process.env.RAKUTEN_AFFILIATE_ID;
const SERVICE_ACCOUNT_KEY_PATH = process.env.SERVICE_ACCOUNT_KEY_PATH || './serviceAccountKey.json';
const SPREADSHEET_ID = '1PVdt4nE-ZXkIsKI42mW0vdeEEDe82WfxLeBIr7QwlFk';

// 楽天API設定
const RAKUTEN_API_URL = 'https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601';

// スタイル/バイブのマッピング
const VIBE_KEYWORDS: Record<string, string[]> = {
  scandinavian: ['北欧', 'スカンジナビア', 'ナチュラル', 'シンプル'],
  modern: ['モダン', 'ミニマル', 'スタイリッシュ', 'シック'],
  vintage: ['ヴィンテージ', 'ビンテージ', 'レトロ', 'アンティーク'],
  industrial: ['インダストリアル', 'ブルックリン', 'アイアン', '男前'],
};

// カテゴリのマッピング
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  照明: ['照明', 'ライト', 'ランプ', 'シーリング', 'ペンダント', 'フロアライト'],
  ラグ: ['ラグ', 'カーペット', 'マット', '絨毯'],
  クッション: ['クッション', 'ピロー', '枕'],
  壁掛け: ['壁掛け', 'アート', 'ポスター', 'ミラー', '鏡', '時計'],
  観葉植物: ['観葉植物', 'フェイクグリーン', 'プランター', 'グリーン'],
  サイドテーブル: ['サイドテーブル', 'テーブル', 'デスク'],
  カーテン: ['カーテン', 'ブラインド', 'シェード'],
  収納: ['収納', 'シェルフ', 'ラック', 'チェスト', '棚'],
  ソファ: ['ソファ', 'ソファー', 'カウチ'],
  チェア: ['チェア', '椅子', 'スツール'],
};

// 楽天APIレスポンス型
interface RakutenItem {
  itemName: string;
  itemPrice: number;
  itemUrl: string;
  affiliateUrl?: string;
  mediumImageUrls: { imageUrl: string }[];
  smallImageUrls: { imageUrl: string }[];
  itemCode: string;
  shopName: string;
  genreId: string;
  tagIds: number[];
  reviewAverage: number;
  reviewCount: number;
}

interface RakutenResponse {
  Items: { Item: RakutenItem }[];
  pageCount: number;
  count: number;
}

// コマンドライン引数のパース
function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      keyword: { type: 'string', short: 'k' },
      genre: { type: 'string', short: 'g' },
      count: { type: 'string', short: 'c' },
      page: { type: 'string', short: 'p' },
    },
  });

  return {
    keyword: values.keyword || '北欧 インテリア',
    genre: values.genre || '',
    count: parseInt(values.count || '30', 10),
    page: parseInt(values.page || '1', 10),
  };
}

// 楽天APIから商品を取得
async function fetchRakutenProducts(
  keyword: string,
  count: number,
  page: number
): Promise<RakutenItem[]> {
  if (!RAKUTEN_APP_ID) {
    throw new Error('RAKUTEN_APP_ID is not set');
  }

  const params = new URLSearchParams({
    format: 'json',
    keyword: keyword,
    applicationId: RAKUTEN_APP_ID,
    hits: Math.min(count, 30).toString(), // 最大30件/リクエスト
    page: page.toString(),
    imageFlag: '1', // 画像ありのみ
    availability: '1', // 在庫ありのみ
    sort: '-reviewCount', // レビュー数順
  });

  if (RAKUTEN_AFFILIATE_ID) {
    params.append('affiliateId', RAKUTEN_AFFILIATE_ID);
  }

  const url = `${RAKUTEN_API_URL}?${params.toString()}`;
  console.log(`\n🔍 Fetching from Rakuten API...`);
  console.log(`   Keyword: "${keyword}"`);

  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Rakuten API error: ${response.status} - ${errorText}`);
  }

  const data: RakutenResponse = await response.json();
  console.log(`   Found: ${data.count} items (showing ${data.Items.length})`);

  return data.Items.map((item) => item.Item);
}

// vibeを判定
function detectVibe(name: string, keyword: string): string {
  const text = `${name} ${keyword}`.toLowerCase();

  for (const [vibe, keywords] of Object.entries(VIBE_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw.toLowerCase()))) {
      return vibe;
    }
  }

  return 'modern'; // デフォルト
}

// カテゴリを判定
function detectCategory(name: string): string {
  const text = name.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw.toLowerCase()))) {
      return category;
    }
  }

  return 'その他';
}

// タグを生成
function generateTags(name: string, keyword: string): string[] {
  const tags: string[] = [];
  const text = `${name} ${keyword}`.toLowerCase();

  // スタイルタグ
  for (const [vibe, keywords] of Object.entries(VIBE_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw.toLowerCase()))) {
      tags.push(vibe);
    }
  }

  // カテゴリタグ
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw.toLowerCase()))) {
      tags.push(category);
    }
  }

  // キーワードから追加タグ
  const keywordTags = keyword.split(/\s+/).filter((k) => k.length > 1);
  tags.push(...keywordTags);

  return [...new Set(tags)]; // 重複除去
}

// キーワードを生成（RAG用）
function generateKeywords(name: string, category: string, vibe: string, tags: string[]): string[] {
  const keywords: string[] = [...tags];

  // カテゴリ関連キーワード
  const categoryKeywords = CATEGORY_KEYWORDS[category] || [];
  keywords.push(...categoryKeywords);

  // スタイル関連キーワード
  const vibeKeywords = VIBE_KEYWORDS[vibe] || [];
  keywords.push(...vibeKeywords);

  // 商品名から抽出
  const nameWords = name.split(/[\s　]+/).filter((w) => w.length > 1);
  keywords.push(...nameWords);

  return [...new Set(keywords)].slice(0, 20); // 重複除去、最大20個
}

// 楽天データをアプリスキーマに変換
function transformToProduct(item: RakutenItem, searchKeyword: string) {
  const vibe = detectVibe(item.itemName, searchKeyword);
  const category = detectCategory(item.itemName);
  const tags = generateTags(item.itemName, searchKeyword);
  const keywords = generateKeywords(item.itemName, category, vibe, tags);

  // 画像URL（大きい画像を優先）
  const imageUrl =
    item.mediumImageUrls?.[0]?.imageUrl?.replace('?_ex=128x128', '?_ex=400x400') ||
    item.smallImageUrls?.[0]?.imageUrl?.replace('?_ex=64x64', '?_ex=400x400') ||
    '';

  return {
    name: item.itemName,
    price: item.itemPrice,
    imageUrl: imageUrl,
    imageUrls: item.mediumImageUrls?.map((img) =>
      img.imageUrl.replace('?_ex=128x128', '?_ex=400x400')
    ) || [],
    thumbnailUrl: item.smallImageUrls?.[0]?.imageUrl || imageUrl,
    affiliateUrl: item.affiliateUrl || item.itemUrl,
    affiliateLink: item.affiliateUrl || item.itemUrl, // 互換性のため
    category: category,
    vibe: vibe,
    tags: tags,
    keywords: keywords,
    source: 'rakuten' as const,
    rakutenItemCode: item.itemCode,
    shopName: item.shopName,
    reviewAverage: item.reviewAverage || 0,
    reviewCount: item.reviewCount || 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Firestoreに保存
async function saveToFirestore(products: ReturnType<typeof transformToProduct>[]) {
  // Firebase Admin初期化
  if (getApps().length === 0) {
    const serviceAccount = JSON.parse(
      readFileSync(join(process.cwd(), SERVICE_ACCOUNT_KEY_PATH), 'utf-8')
    );
    initializeApp({ credential: cert(serviceAccount) });
    console.log(`\n✓ Firebase Admin initialized`);
  }

  const db = getFirestore();
  const batch = db.batch();
  let count = 0;

  for (const product of products) {
    // itemCodeをIDとして使用（重複防止）
    const docId = `rakuten_${product.rakutenItemCode}`;
    const docRef = db.collection('products').doc(docId);

    batch.set(docRef, {
      ...product,
      productId: docId,
    }, { merge: true });

    count++;
  }

  await batch.commit();
  console.log(`\n✅ Saved ${count} products to Firestore`);
}

// Googleスプレッドシートに保存
async function saveToSpreadsheet(products: ReturnType<typeof transformToProduct>[]) {
  try {
    const serviceAccount = JSON.parse(
      readFileSync(join(process.cwd(), SERVICE_ACCOUNT_KEY_PATH), 'utf-8')
    );

    const auth = new JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth);
    await doc.loadInfo();
    console.log(`\n✓ Connected to spreadsheet: ${doc.title}`);

    // 最初のシートを取得または作成
    let sheet = doc.sheetsByIndex[0];
    if (!sheet) {
      sheet = await doc.addSheet({ title: '商品データ' });
    }

    // ヘッダー行を設定
    const headers = [
      'name',
      'price',
      'imageUrl',
      'affiliateLink',
      'category',
      'vibe',
      'tags',
      'shopName',
      'reviewAverage',
      'reviewCount',
      'rakutenItemCode',
      'updatedAt',
    ];

    // ヘッダーがなければ設定（既存データは維持）
    await sheet.loadHeaderRow().catch(async () => {
      await sheet.setHeaderRow(headers);
    });

    // データ行を追加（追記モード）
    const rows = products.map((p) => ({
      name: p.name,
      price: p.price,
      imageUrl: p.imageUrl,
      affiliateLink: p.affiliateUrl,
      category: p.category,
      vibe: p.vibe,
      tags: p.tags.join(','),
      shopName: p.shopName,
      reviewAverage: p.reviewAverage,
      reviewCount: p.reviewCount,
      rakutenItemCode: p.rakutenItemCode,
      updatedAt: new Date().toISOString(),
    }));

    await sheet.addRows(rows);
    console.log(`✅ Saved ${rows.length} products to spreadsheet`);
  } catch (error) {
    console.error('❌ Failed to save to spreadsheet:', error);
    console.log('   Continuing without spreadsheet update...');
  }
}

// メイン処理
async function main() {
  console.log('🚀 Rakuten Product Fetcher\n');
  console.log('─'.repeat(60));

  // 環境変数チェック
  if (!RAKUTEN_APP_ID) {
    console.error('❌ Error: RAKUTEN_APP_ID is not set in .env.local');
    console.log('\nPlease add the following to your .env.local file:');
    console.log('RAKUTEN_APP_ID=your_app_id');
    console.log('RAKUTEN_AFFILIATE_ID=your_affiliate_id (optional)');
    process.exit(1);
  }

  // コマンドライン引数をパース
  const args = parseCliArgs();
  console.log(`\nSettings:`);
  console.log(`  Keyword: "${args.keyword}"`);
  console.log(`  Count: ${args.count}`);
  console.log(`  Page: ${args.page}`);

  try {
    // 楽天APIから取得
    const items = await fetchRakutenProducts(args.keyword, args.count, args.page);

    if (items.length === 0) {
      console.log('\n⚠ No products found');
      return;
    }

    // データ変換
    console.log('\n📦 Transforming data...');
    const products = items.map((item) => transformToProduct(item, args.keyword));

    // 取得データのサマリー
    console.log('\n─'.repeat(60));
    console.log('Fetched Products Summary:');
    products.slice(0, 5).forEach((p, i) => {
      console.log(`\n[${i + 1}] ${p.name.substring(0, 50)}...`);
      console.log(`    Category: ${p.category} | Vibe: ${p.vibe}`);
      console.log(`    Price: ¥${p.price.toLocaleString()}`);
      console.log(`    Image: ${p.imageUrl ? '✓' : '✗'}`);
    });
    if (products.length > 5) {
      console.log(`\n... and ${products.length - 5} more products`);
    }

    // Firestoreに保存
    await saveToFirestore(products);

    // スプレッドシートに保存
    await saveToSpreadsheet(products);

    console.log('\n─'.repeat(60));
    console.log('✅ All done!');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
