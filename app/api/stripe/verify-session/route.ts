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
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
      : undefined;

    if (serviceAccount) {
      initializeApp({
        credential: cert(serviceAccount),
      });
    } else {
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
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // Stripeからセッション情報を取得
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // 支払いが完了しているか確認
    if (session.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Payment not completed' }, { status: 400 });
    }

    const userId = session.metadata?.userId;
    const ticketQuantity = parseInt(session.metadata?.ticketQuantity || '0', 10);

    if (!userId || ticketQuantity <= 0) {
      return NextResponse.json({ error: 'Invalid session metadata' }, { status: 400 });
    }

    const db = getFirebaseAdmin();

    // 既に処理済みかチェック（重複処理防止）
    const existingLog = await db
      .collection('users')
      .doc(userId)
      .collection('ticketLogs')
      .where('stripeSessionId', '==', sessionId)
      .limit(1)
      .get();

    if (!existingLog.empty) {
      // 既に処理済み - 成功として返す
      console.log(`Session ${sessionId} already processed`);
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        ticketQuantity,
      });
    }

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

      // チケット履歴を追加（重複チェック用にsessionIdを保存）
      const logRef = db.collection('users').doc(userId).collection('ticketLogs').doc();
      transaction.set(logRef, {
        amount: ticketQuantity,
        reason: 'purchase',
        description: `${ticketQuantity}枚のチケットを購入`,
        stripeSessionId: sessionId,
        createdAt: new Date(),
      });
    });

    console.log(`✓ Verified and added ${ticketQuantity} tickets to user ${userId}`);

    return NextResponse.json({
      success: true,
      ticketQuantity,
    });
  } catch (error) {
    console.error('Session verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify session' },
      { status: 500 }
    );
  }
}
