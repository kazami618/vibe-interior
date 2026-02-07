/**
 * 管理者フラグ設定スクリプト
 *
 * 指定されたユーザーUIDに isAdmin: true フラグを設定します。
 *
 * 使用方法:
 *   npx tsx scripts/set-admin.ts <uid>
 *   npx tsx scripts/set-admin.ts <uid> --remove  # 管理者権限を削除
 */

import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

config({ path: '.env.local' });

if (getApps().length === 0) {
  const sa = JSON.parse(readFileSync(join(process.cwd(), './serviceAccountKey.json'), 'utf-8'));
  initializeApp({ credential: cert(sa) });
}

const db = getFirestore();

async function main() {
  const uid = process.argv[2];
  const isRemove = process.argv.includes('--remove');

  if (!uid) {
    console.error('Usage: npx tsx scripts/set-admin.ts <uid> [--remove]');
    process.exit(1);
  }

  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    console.error(`ユーザーが見つかりません: ${uid}`);
    process.exit(1);
  }

  const userData = userDoc.data();
  console.log(`ユーザー: ${userData?.displayName || userData?.email || uid}`);

  if (isRemove) {
    await userRef.update({ isAdmin: false });
    console.log(`管理者権限を削除しました`);
  } else {
    await userRef.update({ isAdmin: true });
    console.log(`管理者権限を付与しました`);
  }
}

main().catch(console.error);
