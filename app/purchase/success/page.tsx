'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { verifyCheckoutSession } from '@/lib/stripe';

function PurchaseSuccessRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const quantity = searchParams.get('quantity');
  const returnTo = searchParams.get('returnTo');
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function verifyAndFulfill() {
      if (!sessionId) {
        // session_idがない場合は直接リダイレクト
        redirectToDestination();
        return;
      }

      try {
        // セッションを検証してクレジットを付与
        const data = await verifyCheckoutSession(sessionId);

        if (!data.success) {
          throw new Error('Verification failed');
        }

        setStatus('success');

        // 少し待ってからリダイレクト
        setTimeout(() => {
          redirectToDestination(data.ticketQuantity ?? quantity ?? undefined);
        }, 1000);
      } catch (error) {
        console.error('Verification error:', error);
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : '購入処理に失敗しました');

        // エラーでもリダイレクト
        setTimeout(() => {
          redirectToDestination();
        }, 3000);
      }
    }

    function redirectToDestination(qty?: string | number) {
      // returnToが指定されている場合はそちらにリダイレクト
      if (returnTo) {
        // returnToにクエリパラメータを追加
        const url = new URL(returnTo, window.location.origin);
        url.searchParams.set('purchase_success', 'true');
        if (qty) {
          url.searchParams.set('quantity', qty.toString());
        }
        router.replace(url.pathname + url.search);
      } else {
        // デフォルトはマイページ
        const redirectUrl = qty
          ? `/mypage?purchase_success=true&quantity=${qty}`
          : '/mypage?purchase_success=true';
        router.replace(redirectUrl);
      }
    }

    verifyAndFulfill();
  }, [router, sessionId, quantity, returnTo]);

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="text-destructive font-medium mb-2">エラーが発生しました</p>
          <p className="text-muted-foreground text-sm">{errorMessage}</p>
          <p className="text-muted-foreground text-sm mt-2">リダイレクトします...</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <p className="text-foreground font-medium">購入が完了しました！</p>
          <p className="text-muted-foreground text-sm mt-2">
            {returnTo ? 'デザイン作成画面に戻ります...' : 'マイページにリダイレクトします...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">購入処理中...</p>
      </div>
    </div>
  );
}

export default function PurchaseSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <PurchaseSuccessRedirect />
    </Suspense>
  );
}
