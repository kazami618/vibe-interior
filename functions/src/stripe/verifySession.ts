import { HttpsError, onCall, CallableRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import Stripe from "stripe";

const REGION = "asia-northeast1";

interface VerifySessionRequest {
  sessionId: string;
}

interface VerifySessionResponse {
  success: boolean;
  ticketQuantity?: number;
  alreadyProcessed?: boolean;
}

export const stripeVerifySession = onCall<VerifySessionRequest, Promise<VerifySessionResponse>>(
  {
    region: REGION,
    secrets: ["STRIPE_SECRET_KEY"],
  },
  async (request: CallableRequest<VerifySessionRequest>) => {
    const { sessionId } = request.data;

    // Stripe初期化（Secret Managerから本番キーを取得）
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-01-28.clover",
    });

    if (!sessionId) {
      throw new HttpsError("invalid-argument", "Session ID required");
    }

    try {
      // Stripeからセッション情報を取得
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      // 支払いが完了しているか確認
      if (session.payment_status !== "paid") {
        throw new HttpsError("failed-precondition", "Payment not completed");
      }

      const userId = session.metadata?.userId;
      const ticketQuantity = parseInt(session.metadata?.ticketQuantity || "0", 10);

      if (!userId || ticketQuantity <= 0) {
        throw new HttpsError("invalid-argument", "Invalid session metadata");
      }

      const db = admin.firestore();

      // 既に処理済みかチェック（重複処理防止）
      const existingLog = await db
        .collection("users")
        .doc(userId)
        .collection("ticketLogs")
        .where("stripeSessionId", "==", sessionId)
        .limit(1)
        .get();

      if (!existingLog.empty) {
        // 既に処理済み - 成功として返す
        console.log(`Session ${sessionId} already processed`);
        return {
          success: true,
          alreadyProcessed: true,
          ticketQuantity,
        };
      }

      // トランザクションでチケットを付与
      await db.runTransaction(async (transaction) => {
        const userRef = db.collection("users").doc(userId);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists) {
          throw new Error("User not found");
        }

        // チケット残高を更新
        transaction.update(userRef, {
          ticketBalance: admin.firestore.FieldValue.increment(ticketQuantity),
          updatedAt: new Date(),
        });

        // チケット履歴を追加（重複チェック用にsessionIdを保存）
        const logRef = db.collection("users").doc(userId).collection("ticketLogs").doc();
        transaction.set(logRef, {
          amount: ticketQuantity,
          reason: "purchase",
          description: `${ticketQuantity}枚のチケットを購入`,
          stripeSessionId: sessionId,
          createdAt: new Date(),
        });
      });

      console.log(`Verified and added ${ticketQuantity} tickets to user ${userId}`);

      return {
        success: true,
        ticketQuantity,
      };
    } catch (error) {
      console.error("Session verification error:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Failed to verify session");
    }
  }
);
