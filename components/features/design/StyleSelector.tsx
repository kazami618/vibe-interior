'use client';

import { type DesignStyle } from '@/lib/types/design';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface StyleSelectorProps {
  value: DesignStyle;
  onChange: (value: DesignStyle) => void;
  disabled?: boolean;
}

// スタイル情報とサンプル画像
const STYLES: {
  value: DesignStyle;
  label: string;
  description: string;
  emoji: string;
  colors: string[];
  imageUrl?: string;
}[] = [
  {
    value: 'scandinavian',
    label: '北欧',
    description: 'シンプルで温かみのある',
    emoji: '🌲',
    colors: ['bg-amber-100', 'bg-white', 'bg-stone-200'],
    // 北欧スタイル: 白い壁、ライトウッド、ミニマルな家具
    imageUrl: '/styles/scandinavian.jpg',
  },
  {
    value: 'modern',
    label: 'モダン',
    description: '洗練されたミニマル',
    emoji: '✨',
    colors: ['bg-gray-900', 'bg-white', 'bg-gray-400'],
    // モダンスタイル: モノトーン、クリーンライン、ミニマル
    imageUrl: '/styles/modern.jpg',
  },
  {
    value: 'vintage',
    label: 'ヴィンテージ',
    description: '味わいのあるレトロ',
    emoji: '🕰️',
    colors: ['bg-amber-700', 'bg-amber-100', 'bg-orange-200'],
    // ヴィンテージスタイル: レトロ家具、暖かいトーン、アンティーク
    imageUrl: '/styles/vintage.jpg',
  },
  {
    value: 'industrial',
    label: 'インダストリアル',
    description: '無骨でクール',
    emoji: '🏭',
    colors: ['bg-zinc-700', 'bg-orange-600', 'bg-stone-400'],
    // インダストリアルスタイル: レンガ壁、メタル、ダーク
    imageUrl: '/styles/industrial.jpg',
  },
];

export function StyleSelector({
  value,
  onChange,
  disabled = false,
}: StyleSelectorProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">インテリアスタイル</h2>
        <p className="text-sm text-muted-foreground">お好みのスタイルを選択してください</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {STYLES.map((style) => {
          const isSelected = value === style.value;

          return (
            <button
              key={style.value}
              type="button"
              onClick={() => onChange(style.value)}
              disabled={disabled}
              className={cn(
                'relative overflow-hidden rounded-xl border-2 transition-all text-left',
                isSelected
                  ? 'border-emerald-500 ring-2 ring-emerald-500/30'
                  : 'border-border hover:border-emerald-500/50',
                disabled && 'cursor-not-allowed opacity-50'
              )}
            >
              {/* サンプル画像またはカラーパレット */}
              <div className="relative aspect-[4/3] overflow-hidden">
                {style.imageUrl ? (
                  <img
                    src={style.imageUrl}
                    alt={`${style.label}スタイルのサンプル`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex">
                    {style.colors.map((color, i) => (
                      <div key={i} className={`flex-1 ${color}`} />
                    ))}
                  </div>
                )}

                {/* オーバーレイ */}
                <div
                  className={cn(
                    'absolute inset-0 transition-colors',
                    isSelected ? 'bg-emerald-500/20' : 'bg-black/0 hover:bg-black/10'
                  )}
                />

                {/* 選択チェック */}
                {isSelected && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>

              {/* ラベル */}
              <div className={cn(
                'p-3 transition-colors',
                isSelected ? 'bg-emerald-500/10' : 'bg-card'
              )}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{style.emoji}</span>
                  <span className={cn(
                    'font-semibold',
                    isSelected ? 'text-emerald-600' : ''
                  )}>
                    {style.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {style.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
