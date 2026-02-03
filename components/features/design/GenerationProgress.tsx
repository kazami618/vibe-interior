'use client';

import { Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface GenerationProgressProps {
  message?: string;
}

export function GenerationProgress({
  message = 'AIがデザインを生成しています...',
}: GenerationProgressProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col items-center gap-6">
          {/* アニメーションアイコン */}
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
            <div className="relative p-4 rounded-full bg-primary/10">
              <Sparkles className="h-8 w-8 text-primary animate-pulse" />
            </div>
          </div>

          {/* メッセージ */}
          <div className="text-center">
            <p className="text-lg font-medium">{message}</p>
            <p className="text-sm text-muted-foreground mt-1">
              しばらくお待ちください
            </p>
          </div>

          {/* スケルトンプレビュー */}
          <div className="w-full max-w-md space-y-3">
            <Skeleton className="h-48 w-full rounded-lg" />
            <div className="flex gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>

          {/* 進捗インジケーター */}
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-2 w-2 rounded-full bg-primary animate-bounce"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
