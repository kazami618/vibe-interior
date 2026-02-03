/**
 * RAGテスト用のサンプル商品データを投入するスクリプト
 *
 * 使用方法:
 * npx ts-node scripts/seed-test-products.ts
 */

import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

// .env.local を読み込み
config({ path: '.env.local' });

const SERVICE_ACCOUNT_KEY_PATH = process.env.SERVICE_ACCOUNT_KEY_PATH || './serviceAccountKey.json';

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

// テスト用商品データ
const testProducts = [
  // 照明 - 北欧スタイル
  {
    name: '北欧風ペンダントライト ナチュラルウッド',
    description: 'シンプルで温かみのある北欧デザインのペンダントライト',
    category: '照明',
    price: 12800,
    imageUrls: ['https://example.com/light1.jpg'],
    thumbnailUrl: 'https://example.com/light1_thumb.jpg',
    affiliateUrl: 'https://example.com/affiliate/light1',
    keywords: ['照明', 'ライト', 'ペンダントライト', '北欧', 'ナチュラル', 'シンプル', 'ウッド', '木製'],
    isActive: true,
  },
  // 照明 - モダンスタイル
  {
    name: 'モダンフロアライト ブラック',
    description: 'スタイリッシュなモダンデザインのフロアライト',
    category: '照明',
    price: 18500,
    imageUrls: ['https://example.com/light2.jpg'],
    thumbnailUrl: 'https://example.com/light2_thumb.jpg',
    affiliateUrl: 'https://example.com/affiliate/light2',
    keywords: ['照明', 'フロアライト', 'モダン', 'スタイリッシュ', 'ミニマル', 'モノトーン'],
    isActive: true,
  },
  // ラグ - 北欧スタイル
  {
    name: 'ナチュラルウールラグ 200x140cm',
    description: '天然ウール100%の北欧風ラグ',
    category: 'ラグ',
    price: 25000,
    imageUrls: ['https://example.com/rug1.jpg'],
    thumbnailUrl: 'https://example.com/rug1_thumb.jpg',
    affiliateUrl: 'https://example.com/affiliate/rug1',
    keywords: ['ラグ', 'カーペット', '北欧', 'ナチュラル', 'シンプル', '白'],
    isActive: true,
  },
  // ラグ - ヴィンテージスタイル
  {
    name: 'ヴィンテージ風ペルシャラグ',
    description: 'アンティーク調の美しいペルシャ風ラグ',
    category: 'ラグ',
    price: 35000,
    imageUrls: ['https://example.com/rug2.jpg'],
    thumbnailUrl: 'https://example.com/rug2_thumb.jpg',
    affiliateUrl: 'https://example.com/affiliate/rug2',
    keywords: ['ラグ', 'カーペット', 'ヴィンテージ', 'レトロ', 'アンティーク', 'クラシック'],
    isActive: true,
  },
  // クッション - 北欧スタイル
  {
    name: '北欧デザインクッション リネン',
    description: 'シンプルなリネン素材のクッション',
    category: 'クッション',
    price: 3500,
    imageUrls: ['https://example.com/cushion1.jpg'],
    thumbnailUrl: 'https://example.com/cushion1_thumb.jpg',
    affiliateUrl: 'https://example.com/affiliate/cushion1',
    keywords: ['クッション', '枕', '北欧', 'シンプル', 'ナチュラル'],
    isActive: true,
  },
  // クッション - モダンスタイル
  {
    name: 'モノトーンクッション グレー',
    description: 'モダンなモノトーンデザインのクッション',
    category: 'クッション',
    price: 2800,
    imageUrls: ['https://example.com/cushion2.jpg'],
    thumbnailUrl: 'https://example.com/cushion2_thumb.jpg',
    affiliateUrl: 'https://example.com/affiliate/cushion2',
    keywords: ['クッション', '枕', 'モダン', 'モノトーン', 'ミニマル'],
    isActive: true,
  },
  // 壁掛け - 北欧スタイル
  {
    name: '北欧風ウォールアート 木製フレーム',
    description: 'ナチュラルな木製フレームのウォールアート',
    category: '壁掛け',
    price: 8500,
    imageUrls: ['https://example.com/art1.jpg'],
    thumbnailUrl: 'https://example.com/art1_thumb.jpg',
    affiliateUrl: 'https://example.com/affiliate/art1',
    keywords: ['壁掛け', 'アート', 'ポスター', '北欧', 'ナチュラル', '木製'],
    isActive: true,
  },
  // 壁掛け - インダストリアルスタイル
  {
    name: 'インダストリアルウォールミラー',
    description: 'アイアンフレームのインダストリアルなミラー',
    category: '壁掛け',
    price: 15000,
    imageUrls: ['https://example.com/mirror1.jpg'],
    thumbnailUrl: 'https://example.com/mirror1_thumb.jpg',
    affiliateUrl: 'https://example.com/affiliate/mirror1',
    keywords: ['壁掛け', 'ミラー', 'インダストリアル', 'アイアン', 'スチール', 'ヴィンテージ'],
    isActive: true,
  },
  // 観葉植物
  {
    name: 'モンステラ 陶器鉢付き',
    description: '人気の観葉植物モンステラ',
    category: '観葉植物',
    price: 6800,
    imageUrls: ['https://example.com/plant1.jpg'],
    thumbnailUrl: 'https://example.com/plant1_thumb.jpg',
    affiliateUrl: 'https://example.com/affiliate/plant1',
    keywords: ['観葉植物', '植物', 'プランター', 'ナチュラル'],
    isActive: true,
  },
  // フェイクグリーン
  {
    name: 'フェイクグリーン ユーカリ',
    description: 'お手入れ不要のリアルなフェイクグリーン',
    category: '観葉植物',
    price: 3200,
    imageUrls: ['https://example.com/plant2.jpg'],
    thumbnailUrl: 'https://example.com/plant2_thumb.jpg',
    affiliateUrl: 'https://example.com/affiliate/plant2',
    keywords: ['フェイクグリーン', '観葉植物', '植物', 'ナチュラル', '北欧'],
    isActive: true,
  },
  // サイドテーブル - 北欧
  {
    name: '北欧デザイン サイドテーブル オーク',
    description: 'オーク無垢材のシンプルなサイドテーブル',
    category: 'サイドテーブル',
    price: 22000,
    imageUrls: ['https://example.com/table1.jpg'],
    thumbnailUrl: 'https://example.com/table1_thumb.jpg',
    affiliateUrl: 'https://example.com/affiliate/table1',
    keywords: ['サイドテーブル', '収納', '北欧', 'ナチュラル', '木製', 'シンプル'],
    isActive: true,
  },
  // サイドテーブル - インダストリアル
  {
    name: 'インダストリアル サイドテーブル アイアン×ウッド',
    description: 'アイアンと木の組み合わせがおしゃれなサイドテーブル',
    category: 'サイドテーブル',
    price: 18000,
    imageUrls: ['https://example.com/table2.jpg'],
    thumbnailUrl: 'https://example.com/table2_thumb.jpg',
    affiliateUrl: 'https://example.com/affiliate/table2',
    keywords: ['サイドテーブル', '収納', 'インダストリアル', 'アイアン', 'スチール', 'ブルックリン'],
    isActive: true,
  },
  // カーテン - 北欧
  {
    name: 'リネンカーテン ナチュラルベージュ',
    description: '透け感のある北欧風リネンカーテン',
    category: 'カーテン',
    price: 8800,
    imageUrls: ['https://example.com/curtain1.jpg'],
    thumbnailUrl: 'https://example.com/curtain1_thumb.jpg',
    affiliateUrl: 'https://example.com/affiliate/curtain1',
    keywords: ['カーテン', 'シェード', '北欧', 'ナチュラル', 'シンプル', '白'],
    isActive: true,
  },
  // カーテン - モダン
  {
    name: '遮光カーテン モダングレー',
    description: 'スタイリッシュなグレーの遮光カーテン',
    category: 'カーテン',
    price: 12000,
    imageUrls: ['https://example.com/curtain2.jpg'],
    thumbnailUrl: 'https://example.com/curtain2_thumb.jpg',
    affiliateUrl: 'https://example.com/affiliate/curtain2',
    keywords: ['カーテン', 'ブラインド', 'モダン', 'モノトーン', 'ミニマル'],
    isActive: true,
  },
  // シェルフ - 北欧
  {
    name: 'ウォールシェルフ ナチュラルウッド',
    description: '壁掛けタイプの北欧風シェルフ',
    category: 'シェルフ',
    price: 5500,
    imageUrls: ['https://example.com/shelf1.jpg'],
    thumbnailUrl: 'https://example.com/shelf1_thumb.jpg',
    affiliateUrl: 'https://example.com/affiliate/shelf1',
    keywords: ['シェルフ', 'ラック', '収納', '北欧', 'ナチュラル', '木製'],
    isActive: true,
  },
];

async function seedTestProducts() {
  console.log('🚀 Seeding test products...\n');

  const batch = db.batch();

  for (const product of testProducts) {
    const docRef = db.collection('products').doc();
    batch.set(docRef, {
      ...product,
      productId: docRef.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`+ Adding: ${product.name}`);
  }

  await batch.commit();
  console.log(`\n✅ Successfully seeded ${testProducts.length} test products!`);
}

seedTestProducts().catch(console.error);
