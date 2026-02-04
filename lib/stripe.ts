import { loadStripe, Stripe } from '@stripe/stripe-js';
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

let stripePromise: Promise<Stripe | null>;

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
    );
  }
  return stripePromise;
};

// チケット価格設定
export const TICKET_PRICE = 100; // 円
export const TICKET_PRICE_ID = 'price_ticket_100'; // Stripeの価格ID（動的作成の場合は不要）

// Firebase Functions経由でStripe Checkoutセッションを作成
export async function createCheckoutSession(
  quantity: number,
  userId: string,
  returnTo?: string | null
): Promise<{ sessionId: string; url: string }> {
  // 開発環境ではAPI Routeを使用、本番ではFirebase Functionsを使用
  if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_USE_EMULATOR === 'true') {
    const response = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity, userId, returnTo }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to create checkout session');
    }
    return data;
  }

  // 本番環境: Firebase Functions使用
  const stripeCheckout = httpsCallable<
    { quantity: number; userId: string; returnTo?: string | null },
    { sessionId: string; url: string }
  >(functions, 'stripeCheckout');

  const result = await stripeCheckout({ quantity, userId, returnTo });
  return result.data;
}

// Firebase Functions経由でStripeセッションを検証
export async function verifyCheckoutSession(
  sessionId: string
): Promise<{ success: boolean; ticketQuantity?: number; alreadyProcessed?: boolean }> {
  // 開発環境ではAPI Routeを使用、本番ではFirebase Functionsを使用
  if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_USE_EMULATOR === 'true') {
    const response = await fetch('/api/stripe/verify-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Verification failed');
    }
    return data;
  }

  // 本番環境: Firebase Functions使用
  const stripeVerifySession = httpsCallable<
    { sessionId: string },
    { success: boolean; ticketQuantity?: number; alreadyProcessed?: boolean }
  >(functions, 'stripeVerifySession');

  const result = await stripeVerifySession({ sessionId });
  return result.data;
}
