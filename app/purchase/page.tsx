'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { TICKET_PRICE, createCheckoutSession } from '@/lib/stripe';
import { Ticket, Minus, Plus, CreditCard, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

function PurchaseContent() {
  const { user, userData, signInWithGoogle } = useAuth();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');

  const [quantity, setQuantity] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPrice = quantity * TICKET_PRICE;

  const handleQuantityChange = (delta: number) => {
    const newQuantity = quantity + delta;
    if (newQuantity >= 1 && newQuantity <= 100) {
      setQuantity(newQuantity);
    }
  };

  const handlePurchase = async () => {
    if (!user) {
      signInWithGoogle();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await createCheckoutSession(quantity, user.uid, returnTo);

      // Stripe Checkoutにリダイレクト
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">ログインが必要です</p>
          <button
            onClick={signInWithGoogle}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            Googleでログイン
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="max-w-md mx-auto px-4">
        {/* 戻るリンク */}
        {returnTo && (
          <Link
            href={returnTo.split('?')[0]} // クエリパラメータなしのパスに戻る
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            デザイン作成に戻る
          </Link>
        )}

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Ticket className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">チケット購入</h1>
          <p className="text-muted-foreground mt-2">
            現在の残高: {userData?.ticketBalance || 0}枚
          </p>
        </div>

        <div className="bg-card rounded-xl border p-6 space-y-6">
          {/* 数量選択 */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              購入枚数
            </label>
            <div className="flex items-center justify-center gap-4 mt-2">
              <button
                onClick={() => handleQuantityChange(-1)}
                disabled={quantity <= 1}
                className="w-10 h-10 rounded-full border flex items-center justify-center hover:bg-accent disabled:opacity-50"
              >
                <Minus className="w-4 h-4" />
              </button>
              <div className="text-3xl font-bold w-20 text-center">
                {quantity}
              </div>
              <button
                onClick={() => handleQuantityChange(1)}
                disabled={quantity >= 100}
                className="w-10 h-10 rounded-full border flex items-center justify-center hover:bg-accent disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* クイック選択 */}
          <div className="flex justify-center gap-2">
            {[1, 5, 10, 20].map((num) => (
              <button
                key={num}
                onClick={() => setQuantity(num)}
                className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                  quantity === num
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'hover:bg-accent'
                }`}
              >
                {num}枚
              </button>
            ))}
          </div>

          {/* 価格表示 */}
          <div className="border-t pt-4">
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>単価</span>
              <span>¥{TICKET_PRICE}/枚</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="font-medium">合計</span>
              <span className="text-2xl font-bold">
                ¥{totalPrice.toLocaleString()}
              </span>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-500 text-center">{error}</div>
          )}

          {/* 購入ボタン */}
          <button
            onClick={handlePurchase}
            disabled={loading}
            className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                処理中...
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                購入する
              </>
            )}
          </button>

          <p className="text-xs text-center text-muted-foreground">
            Stripeの安全な決済システムを使用しています
          </p>
        </div>

        {/* 説明 */}
        <div className="mt-8 text-sm text-muted-foreground space-y-2">
          <h2 className="font-medium text-foreground">チケットについて</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>1枚のチケットで1回のデザイン生成が可能です</li>
            <li>チケットに有効期限はありません</li>
            <li>購入後の返金はできません</li>
          </ul>
        </div>

        {/* 特定商取引法リンク */}
        <div className="mt-6 text-center">
          <a
            href="/legal/tokushoho"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground underline transition-colors"
          >
            特定商取引法に基づく表記
          </a>
        </div>
      </div>
    </div>
  );
}

export default function PurchasePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <PurchaseContent />
    </Suspense>
  );
}
