'use client';

import { Sparkles, Ticket, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface GenerateButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  ticketBalance?: number;
}

export function GenerateButton({
  onClick,
  disabled = false,
  loading = false,
  ticketBalance = 0,
}: GenerateButtonProps) {
  const hasEnoughTickets = ticketBalance >= 1;
  const canGenerate = !disabled && !loading && hasEnoughTickets;

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
      <div className={cn(
        'flex items-center justify-center gap-2 text-sm py-2 px-4 rounded-lg',
        hasEnoughTickets
          ? 'bg-emerald-500/10 text-emerald-600'
          : 'bg-destructive/10 text-destructive'
      )}>
        <Ticket className="h-4 w-4" />
        <span>
          {hasEnoughTickets ? (
            <>チケット1枚を消費します（残り: {ticketBalance}枚）</>
          ) : (
            <>チケットが不足しています</>
          )}
        </span>
      </div>
    </div>
  );
}
