'use client';

import { RoomType, ROOM_TYPES } from '@/lib/types/design';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface RoomTypeSelectorProps {
  value: RoomType | null;
  onChange: (roomType: RoomType) => void;
  disabled?: boolean;
}

// 部屋タイプの絵文字とカラー
const ROOM_TYPE_INFO: Record<RoomType, { emoji: string; color: string; bgColor: string }> = {
  living: { emoji: '🛋️', color: 'text-blue-600', bgColor: 'bg-blue-500' },
  dining: { emoji: '🍽️', color: 'text-orange-600', bgColor: 'bg-orange-500' },
  bedroom: { emoji: '🛏️', color: 'text-purple-600', bgColor: 'bg-purple-500' },
  one_room: { emoji: '🏠', color: 'text-emerald-600', bgColor: 'bg-emerald-500' },
};

export function RoomTypeSelector({ value, onChange, disabled }: RoomTypeSelectorProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">部屋のタイプ</h2>
        <p className="text-sm text-muted-foreground">コーディネートする部屋を選択してください</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {ROOM_TYPES.map((roomType) => {
          const isSelected = value === roomType.value;
          const info = ROOM_TYPE_INFO[roomType.value];

          return (
            <button
              key={roomType.value}
              type="button"
              onClick={() => onChange(roomType.value)}
              disabled={disabled}
              className={cn(
                'relative flex items-center gap-3 px-4 py-4 rounded-xl border-2 font-medium transition-all text-left',
                isSelected
                  ? `border-current ${info.color} bg-current/10 shadow-lg`
                  : 'border-border bg-card hover:border-current hover:bg-current/5',
                !isSelected && info.color,
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <span className={cn(
                'text-2xl p-2 rounded-lg',
                isSelected ? `${info.bgColor}/20` : 'bg-muted'
              )}>
                {info.emoji}
              </span>
              <span className={cn(
                'text-base',
                isSelected ? info.color : 'text-foreground'
              )}>
                {roomType.label}
              </span>
              {isSelected && (
                <div className={cn(
                  'absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center',
                  info.bgColor
                )}>
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
