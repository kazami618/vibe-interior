'use client';

import { useRouter } from 'next/navigation';
import { XCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function PurchaseCancelPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center py-12">
      <div className="max-w-md mx-auto px-4 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-6">
          <XCircle className="w-10 h-10 text-muted-foreground" />
        </div>

        <h1 className="text-2xl font-bold mb-2">購入がキャンセルされました</h1>
        <p className="text-muted-foreground mb-8">
          決済処理がキャンセルされました。
          <br />
          チケットは購入されていません。
        </p>

        <div className="space-y-3">
          <button
            onClick={() => router.push('/purchase')}
            className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-primary/90"
          >
            <RefreshCw className="w-4 h-4" />
            もう一度試す
          </button>
          <Link
            href="/"
            className="w-full py-3 border rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-accent"
          >
            <ArrowLeft className="w-4 h-4" />
            トップページへ戻る
          </Link>
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          問題が続く場合は、お問い合わせください。
        </p>
      </div>
    </div>
  );
}
