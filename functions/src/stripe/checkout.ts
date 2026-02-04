import { HttpsError, onCall, CallableRequest } from "firebase-functions/v2/https";
import Stripe from "stripe";

const TICKET_PRICE = 100; // 円
const REGION = "asia-northeast1";

interface CheckoutRequest {
  quantity: number;
  userId: string;
  returnTo?: string | null;
}

interface CheckoutResponse {
  sessionId: string;
  url: string | null;
}

export const stripeCheckout = onCall<CheckoutRequest, Promise<CheckoutResponse>>(
  {
    region: REGION,
    secrets: ["STRIPE_SECRET_KEY"],
  },
  async (request: CallableRequest<CheckoutRequest>) => {
    const { quantity, userId, returnTo } = request.data;

    // Stripe初期化（Secret Managerから本番キーを取得）
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-01-28.clover",
    });

    if (!quantity || quantity < 1) {
      throw new HttpsError("invalid-argument", "Invalid quantity");
    }

    if (!userId) {
      throw new HttpsError("unauthenticated", "User not authenticated");
    }

    // 本番環境のベースURL
    const baseUrl = "https://room-setup.com";

    // 成功時のリダイレクトURL
    let successUrl = `${baseUrl}/purchase/success?session_id={CHECKOUT_SESSION_ID}&quantity=${quantity}`;
    if (returnTo) {
      successUrl += `&returnTo=${encodeURIComponent(returnTo)}`;
    }

    // キャンセル時のリダイレクトURL
    let cancelUrl = `${baseUrl}/purchase/cancel`;
    if (returnTo) {
      cancelUrl = `${baseUrl}/purchase?returnTo=${encodeURIComponent(returnTo)}`;
    }

    try {
      // Checkout Session を作成
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "jpy",
              product_data: {
                name: "デザインチケット",
                description: `${quantity}枚のチケットを購入`,
              },
              unit_amount: TICKET_PRICE,
            },
            quantity: quantity,
          },
        ],
        mode: "payment",
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          userId: userId,
          ticketQuantity: quantity.toString(),
        },
      });

      return { sessionId: session.id, url: session.url };
    } catch (error) {
      console.error("Stripe checkout error:", error);
      throw new HttpsError("internal", "Failed to create checkout session");
    }
  }
);
