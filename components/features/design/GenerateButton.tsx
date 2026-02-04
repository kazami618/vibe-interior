'use client';

import { useRouter } from 'next/navigation';
import { Sparkles, Ticket, Loader2, ShoppingCart, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { saveDesignState } from '@/lib/designState';
import type { DesignStyle, Scenario, RoomType, ItemCategory } from '@/lib/types/design';

interface GenerateButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  ticketBalance?: number;
  // デザイン状態（購入後の復元用）
  designState?: {
    scenario: Scenario | null;
    roomType: RoomType | null;
    selectedStyle: DesignStyle;
    addItems: ItemCategory[];
    keepItems: ItemCategory[];
    previewUrl: string | null;
  };
}

export function GenerateButton({
  onClick,
  disabled = false,
  loading = false,
  ticketBalance = 0,
  designState,
}: GenerateButtonProps) {
  const router = useRouter();
  const hasEnoughTickets = ticketBalance >= 1;
  const canGenerate = !disabled && !loading && hasEnoughTickets;

  const handlePurchaseClick = async () => {
    // デザイン状態を保存
    if (designState) {
      let previewDataUrl = designState.previewUrl;

      // blob URLをbase64 data URLに変換
      if (previewDataUrl && previewDataUrl.startsWith('blob:')) {
        try {
          const response = await fetch(previewDataUrl);
          const blob = await response.blob();
          previewDataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        } catch (error) {
          console.error('Failed to convert blob to data URL:', error);
          previewDataUrl = null;
        }
      }

      saveDesignState({
        ...designState,
        previewUrl: previewDataUrl,
      });
    }
    // 購入ページにリダイレクト（戻り先を指定）
    router.push('/purchase?returnTo=/design/new?restore=true');
  };

  // チケット不足の場合
  if (!hasEnoughTickets && !loading) {
    return (
      <div className="flex flex-col gap-4">
        {/* チケット不足の警告 */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-amber-600">チケットが不足しています</p>
              <p className="text-sm text-muted-foreground mt-1">
                デザインを生成するには1枚のチケットが必要です。
                チケットを購入して、AIインテリアコーディネートをお楽しみください。
              </p>
            </div>
          </div>
        </div>

        {/* 購入ボタン */}
        <Button
          size="lg"
          onClick={handlePurchaseClick}
          className="w-full py-6 text-lg font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-xl shadow-amber-500/30 hover:shadow-amber-500/40"
        >
          <ShoppingCart className="h-5 w-5 mr-2" />
          チケットを購入する
        </Button>

        {/* チケット残高表示 */}
        <div className="flex items-center justify-center gap-2 text-sm py-2 px-4 rounded-lg bg-destructive/10 text-destructive">
          <Ticket className="h-4 w-4" />
          <span>現在のチケット残高: {ticketBalance}枚</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        size="lg"
        onClick={onClick}
        disabled={!canGenerate}
        className={cn(
          'w-full py-6 text-lg font-bold transition-all',
          canGenerate
            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/40'
            : ''
        )}
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            生成中...
          </>
        ) : (
          <>
            <Sparkles className="h-5 w-5 mr-2" />
            デザインを生成する
          </>
        )}
      </Button>
      <div className="flex items-center justify-center gap-2 text-sm py-2 px-4 rounded-lg bg-emerald-500/10 text-emerald-600">
        <Ticket className="h-4 w-4" />
        <span>チケット1枚を消費します（残り: {ticketBalance}枚）</span>
      </div>
    </div>
  );
}
