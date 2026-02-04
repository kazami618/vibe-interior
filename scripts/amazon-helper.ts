/**
 * Amazon商品データ入力補助ツール
 *
 * 使用方法:
 *   npm run amazon:helper -- --url="https://www.amazon.co.jp/dp/B0XXXXXXXX"
 *
 * 機能:
 *   - Amazon商品URLからASINを抽出
 *   - アフィリエイトリンクを自動生成
 *   - スプレッドシートへの入力ガイドを出力
 */

import { config } from 'dotenv';

// .env.local を読み込み
config({ path: '.env.local' });

const AMAZON_ASSOCIATE_ID = process.env.AMAZON_ASSOCIATE_ID || 'roomsetup-22';

/**
 * Amazon URLからASINを抽出
 * 対応形式:
 *   - https://www.amazon.co.jp/dp/ASIN
 *   - https://www.amazon.co.jp/gp/product/ASIN
 *   - https://www.amazon.co.jp/商品名/dp/ASIN/...
 *   - https://amzn.asia/d/ASIN
 */
function extractAsin(url: string): string | null {
  // 短縮URL（amzn.asia）の場合
  const shortUrlMatch = url.match(/amzn\.asia\/d\/([A-Z0-9]+)/i);
  if (shortUrlMatch) {
    return shortUrlMatch[1];
  }

  // 通常のAmazon URL
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /\/ASIN\/([A-Z0-9]{10})/i,
    /\/product\/([A-Z0-9]{10})/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * アフィリエイトリンクを生成
 */
function generateAffiliateLink(asin: string): string {
  return `https://www.amazon.co.jp/dp/${asin}?tag=${AMAZON_ASSOCIATE_ID}`;
}

/**
 * メイン処理
 */
function main() {
  const args = process.argv.slice(2);
  const urlArg = args.find((arg) => arg.startsWith('--url='));

  if (!urlArg) {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║              Amazon商品データ入力補助ツール                    ║
╚════════════════════════════════════════════════════════════════╝

使用方法:
  npm run amazon:helper -- --url="AMAZON_URL"

例:
  npm run amazon:helper -- --url="https://www.amazon.co.jp/dp/B08N5WRWNW"
  npm run amazon:helper -- --url="https://amzn.asia/d/abc123"

対応URL形式:
  - https://www.amazon.co.jp/dp/ASIN
  - https://www.amazon.co.jp/gp/product/ASIN
  - https://www.amazon.co.jp/商品名/dp/ASIN/...
  - https://amzn.asia/d/ASIN（短縮URL）
`);
    return;
  }

  const url = urlArg.replace('--url=', '').replace(/^["']|["']$/g, '');

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📦 Amazon商品データ入力補助');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`入力URL: ${url}\n`);

  const asin = extractAsin(url);

  if (!asin) {
    console.error('❌ ASINを抽出できませんでした。URLを確認してください。');
    console.log('\n対応URL形式:');
    console.log('  - https://www.amazon.co.jp/dp/ASIN');
    console.log('  - https://www.amazon.co.jp/gp/product/ASIN');
    console.log('  - https://amzn.asia/d/ASIN');
    process.exit(1);
  }

  const affiliateLink = generateAffiliateLink(asin);

  console.log('✅ 抽出結果:');
  console.log('────────────────────────────────────────────────────────────────');
  console.log(`  ASIN:            ${asin}`);
  console.log(`  Associate ID:    ${AMAZON_ASSOCIATE_ID}`);
  console.log(`  Affiliate Link:  ${affiliateLink}`);
  console.log('────────────────────────────────────────────────────────────────\n');

  console.log('📝 スプレッドシートに以下を入力してください:');
  console.log('────────────────────────────────────────────────────────────────');
  console.log(`  asin:           ${asin}`);
  console.log('  name:           [商品ページからコピー]');
  console.log('  price:          [価格を数字のみで入力 例: 12800]');
  console.log('  imageUrl:       [商品画像URLをコピー]');
  console.log('  category:       [該当カテゴリを選択]');
  console.log('  vibe:           [scandinavian/modern/vintage/industrial]');
  console.log('  tags:           [タグをカンマ区切り 例: 木製,天然素材,北欧]');
  console.log('  reviewAverage:  [レビュー平均 例: 4.3]');
  console.log('  reviewCount:    [レビュー件数 例: 256]');
  console.log('────────────────────────────────────────────────────────────────\n');

  console.log('📋 カテゴリ一覧:');
  console.log('  照明, ラグ, クッション, 観葉植物, カーテン, 収納,');
  console.log('  壁掛け, サイドテーブル, ソファ, チェア, ベッド,');
  console.log('  テーブル, 座椅子, こたつ, 寝具, ミラー\n');

  console.log('🎨 スタイル一覧:');
  console.log('  scandinavian (北欧), modern (モダン),');
  console.log('  vintage (ヴィンテージ), industrial (インダストリアル)\n');
}

main();
