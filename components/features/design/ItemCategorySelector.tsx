'use client';

import { useState } from 'react';
import { ItemCategory, ITEM_CATEGORY_GROUPS } from '@/lib/types/design';
import { cn } from '@/lib/utils';
import { Sparkles, Settings2, Check } from 'lucide-react';

// カテゴリごとの絵文字マッピング
const CATEGORY_EMOJIS: Record<string, string> = {
  // 大型家具
  ソファ: '🛋️',
  ベッド: '🛏️',
  テーブル: '🪑',
  チェア: '💺',
  ダイニングテーブル: '🍽️',
  ダイニングチェア: '🪑',
  座椅子: '🧘',
  こたつ: '♨️',
  // 収納・家具
  収納: '🗄️',
  サイドテーブル: '🪟',
  ワードローブ: '👔',
  ドレッサー: '💄',
  ハンガーラック: '🧥',
  収納小物: '📦',
  ゴミ箱: '🗑️',
  // 照明
  照明: '💡',
  間接照明: '🕯️',
  ダイニング照明: '🔆',
  // ファブリック
  ラグ: '🟫',
  ダイニングラグ: '🟫',
  玄関マット: '🚪',
  カーテン: '🪟',
  クッション: '🛋️',
  ブランケット: '🧶',
  寝具: '🛌',
  // 装飾
  観葉植物: '🌿',
  壁掛け: '🖼️',
  ミラー: '🪞',
  // 内装
  壁紙: '🎨',
  フロアタイル: '🟫',
  // その他
  インテリア家電: '📱',
  マットレス: '🛏️',
};

interface ItemCategorySelectorProps {
  title: string;
  description?: string;
  selectedItems: ItemCategory[];
  onSelectedItemsChange: (items: ItemCategory[]) => void;
  disabled?: boolean;
  defaultItems?: ItemCategory[];
}

export function ItemCategorySelector({
  title,
  description,
  selectedItems,
  onSelectedItemsChange,
  disabled,
  defaultItems = [],
}: ItemCategorySelectorProps) {
  const [mode, setMode] = useState<'auto' | 'custom'>(
    selectedItems.length === defaultItems.length &&
    selectedItems.every(item => defaultItems.includes(item))
      ? 'auto'
      : 'custom'
  );

  const toggleItem = (item: ItemCategory) => {
    if (disabled) return;

    if (selectedItems.includes(item)) {
      onSelectedItemsChange(selectedItems.filter((i) => i !== item));
    } else {
      onSelectedItemsChange([...selectedItems, item]);
    }
  };

  const handleModeChange = (newMode: 'auto' | 'custom') => {
    setMode(newMode);
    if (newMode === 'auto') {
      onSelectedItemsChange(defaultItems);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {/* モード切り替え */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleModeChange('auto')}
          disabled={disabled}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 font-medium transition-all',
            mode === 'auto'
              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600'
              : 'border-border hover:border-emerald-500/50 text-muted-foreground',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <Sparkles className="w-4 h-4" />
          おまかせ
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('custom')}
          disabled={disabled}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 font-medium transition-all',
            mode === 'custom'
              ? 'border-violet-500 bg-violet-500/10 text-violet-600'
              : 'border-border hover:border-violet-500/50 text-muted-foreground',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <Settings2 className="w-4 h-4" />
          カスタマイズ
        </button>
      </div>

      {/* おまかせモードの説明と選択アイテム表示 */}
      {mode === 'auto' && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 space-y-3">
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            <Sparkles className="w-4 h-4 inline mr-1" />
            AIが部屋に最適なアイテムを自動で選択します
          </p>
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              選択中: {selectedItems.length}個のアイテム
            </p>
            <div className="flex flex-wrap gap-1.5">
              {selectedItems.map((item) => {
                const emoji = CATEGORY_EMOJIS[item] || '📦';
                return (
                  <span
                    key={item}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-full border border-gray-300 dark:border-gray-600 shadow-sm"
                  >
                    <span>{emoji}</span>
                    <span>{item}</span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* カスタマイズモード - アイテム選択 */}
      {mode === 'custom' && (
        <div className="space-y-4">
          <p className="text-xs text-violet-600 dark:text-violet-400">
            {selectedItems.length}個選択中
          </p>

          {ITEM_CATEGORY_GROUPS.map((group) => (
            <div key={group.group} className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">{group.group}</h3>
              <div className="flex flex-wrap gap-2">
                {group.items.map((item) => {
                  const isSelected = selectedItems.includes(item.value);
                  const emoji = CATEGORY_EMOJIS[item.value] || '📦';

                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => toggleItem(item.value)}
                      disabled={disabled}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border-2 font-medium transition-all',
                        isSelected
                          ? 'bg-violet-500 text-white border-violet-500 shadow-md'
                          : 'bg-card text-card-foreground border-border hover:border-violet-500 hover:bg-violet-500/10',
                        disabled && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <span>{emoji}</span>
                      <span>{item.label}</span>
                      {isSelected && <Check className="w-3 h-3 ml-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
