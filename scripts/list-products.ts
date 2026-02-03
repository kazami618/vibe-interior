/**
 * Firestoreの商品データを一覧表示するスクリプト
 */

import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

config({ path: '.env.local' });

const SERVICE_ACCOUNT_KEY_PATH = process.env.SERVICE_ACCOUNT_KEY_PATH || './serviceAccountKey.json';

if (getApps().length === 0) {
  const serviceAccount = JSON.parse(
    readFileSync(join(process.cwd(), SERVICE_ACCOUNT_KEY_PATH), 'utf-8')
  );
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

async function listProducts() {
  const snapshot = await db.collection('products').get();

  console.log(`\n📦 Products in Firestore: ${snapshot.size} items\n`);
  console.log('─'.repeat(80));

  snapshot.docs.forEach((doc, index) => {
    const data = doc.data();
    console.log(`\n[${index + 1}] ${data.name}`);
    console.log(`    ID: ${doc.id}`);
    console.log(`    カテゴリ: ${data.category}`);
    console.log(`    価格: ¥${data.price?.toLocaleString()}`);
    console.log(`    キーワード: ${data.keywords?.join(', ')}`);
    console.log(`    有効: ${data.isActive ? '✓' : '✗'}`);
  });

  console.log('\n' + '─'.repeat(80));
}

listProducts().catch(console.error);
