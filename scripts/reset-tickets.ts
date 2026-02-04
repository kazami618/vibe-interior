import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const key = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf-8'));
initializeApp({ credential: cert(key) });
const db = getFirestore();

async function resetTickets() {
  const email = process.argv[2] || 'alfine618@gmail.com';

  // メールアドレスでユーザーを検索
  const snapshot = await db.collection('users')
    .where('email', '==', email)
    .limit(1)
    .get();

  if (snapshot.empty) {
    console.log('❌ ユーザーが見つかりません:', email);
    return;
  }

  const userDoc = snapshot.docs[0];
  console.log('ユーザーID:', userDoc.id);
  console.log('現在の残高:', userDoc.data().ticketBalance);

  await userDoc.ref.update({
    ticketBalance: 0,
    updatedAt: new Date()
  });

  console.log('✅ チケット残高を0に更新しました');
}

resetTickets().catch(console.error);
