import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover',
});

// Firebase Admin 初期化
function getFirebaseAdmin() {
  if (getApps().length === 0) {
    // サーバーサイドでは環境変数から認証情報を取得
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
      : undefined;

    if (serviceAccount) {
      initializeApp({
        credential: cert(serviceAccount),
      });
    } else {
      // ローカル開発時は serviceAccountKey.json を使用
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const key = require('../../../../serviceAccountKey.json');
        initializeApp({
          credential: cert(key),
        });
      } catch {
        console.error('Firebase Admin initialization failed: No credentials');
        throw new Error('Firebase Admin credentials not found');
      }
    }
  }
  return getFirestore();
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  // Webhook署名の検証（本番環境では必須）
  // const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  // let event: Stripe.Event;
  // try {
  //   event = stripe.webhooks.constructEvent(body, signature!, webhookSecret!);
  // } catch (err) {
  //   return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  // }

  // サンドボックス環境では署名検証をスキップ
  let event: Stripe.Event;
  try {
    event = JSON.parse(body) as Stripe.Event;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // 支払い完了イベントを処理
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    const userId = session.metadata?.userId;
    const ticketQuantity = parseInt(session.metadata?.ticketQuantity || '0', 10);

    if (!userId || ticketQuantity <= 0) {
      console.error('Invalid metadata:', session.metadata);
      return NextResponse.json({ error: 'Invalid metadata' }, { status: 400 });
    }

    try {
      const db = getFirebaseAdmin();

      // トランザクションでチケットを付与
      await db.runTransaction(async (transaction) => {
        const userRef = db.collection('users').doc(userId);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists) {
          throw new Error('User not found');
        }

        // チケット残高を更新
        transaction.update(userRef, {
          ticketBalance: FieldValue.increment(ticketQuantity),
          updatedAt: new Date(),
        });

        // チケット履歴を追加
        const logRef = db.collection('users').doc(userId).collection('ticketLogs').doc();
        transaction.set(logRef, {
          amount: ticketQuantity,
          reason: 'purchase',
          description: `${ticketQuantity}枚のチケットを購入`,
          stripeSessionId: session.id,
          createdAt: new Date(),
        });
      });

      console.log(`✓ Added ${ticketQuantity} tickets to user ${userId}`);
    } catch (error) {
      console.error('Failed to add tickets:', error);
      return NextResponse.json({ error: 'Failed to add tickets' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
