import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover',
});

const TICKET_PRICE = 100; // 円

export async function POST(request: NextRequest) {
  try {
    const { quantity, userId, returnTo } = await request.json();

    if (!quantity || quantity < 1) {
      return NextResponse.json(
        { error: 'Invalid quantity' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // 成功時のリダイレクトURL
    let successUrl = `${request.nextUrl.origin}/purchase/success?session_id={CHECKOUT_SESSION_ID}&quantity=${quantity}`;
    if (returnTo) {
      successUrl += `&returnTo=${encodeURIComponent(returnTo)}`;
    }

    // キャンセル時のリダイレクトURL
    let cancelUrl = `${request.nextUrl.origin}/purchase/cancel`;
    if (returnTo) {
      cancelUrl = `${request.nextUrl.origin}/purchase?returnTo=${encodeURIComponent(returnTo)}`;
    }

    // Checkout Session を作成
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'jpy',
            product_data: {
              name: 'デザインチケット',
              description: `${quantity}枚のチケットを購入`,
            },
            unit_amount: TICKET_PRICE,
          },
          quantity: quantity,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: userId,
        ticketQuantity: quantity.toString(),
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
