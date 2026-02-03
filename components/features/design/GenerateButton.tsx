'use client';

import { Sparkles, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

  return (
    <div className="flex flex-col gap-2">
      <Button
        size="lg"
        onClick={onClick}
        disabled={disabled || loading || !hasEnoughTickets}
        className="w-full"
      >
        {loading ? (
          <>
            <span className="animate-spin mr-2">
              <Sparkles className="h-5 w-5" />
            </span>
            生成中...
          </>
        ) : (
          <>
            <Sparkles className="h-5 w-5 mr-2" />
            デザインを生成する
          </>
        )}
      </Button>
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Ticket className="h-4 w-4" />
        <span>
          {hasEnoughTickets ? (
            <>チケット1枚を消費します（残り: {ticketBalance}枚）</>
          ) : (
            <span className="text-destructive">チケットが不足しています</span>
          )}
        </span>
      </div>
    </div>
  );
}
