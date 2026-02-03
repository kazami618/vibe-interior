'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface ItemOption {
  value: string;
  label: string;
}

interface ItemSelectorProps {
  title: string;
  description: string;
  options: ItemOption[];
  selectedItems: string[];
  onSelectedItemsChange: (items: string[]) => void;
  disabled?: boolean;
}

export function ItemSelector({
  title,
  description,
  options,
  selectedItems,
  onSelectedItemsChange,
  disabled = false,
}: ItemSelectorProps) {
  const handleToggle = (value: string) => {
    if (selectedItems.includes(value)) {
      onSelectedItemsChange(selectedItems.filter((item) => item !== value));
    } else {
      onSelectedItemsChange([...selectedItems, value]);
    }
  };

  const handleSelectAll = () => {
    if (selectedItems.length === options.length) {
      onSelectedItemsChange([]);
    } else {
      onSelectedItemsChange(options.map((opt) => opt.value));
    }
  };

  const allSelected = selectedItems.length === options.length;
  const someSelected = selectedItems.length > 0 && selectedItems.length < options.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
          <button
            type="button"
            onClick={handleSelectAll}
            disabled={disabled}
            className={cn(
              'text-xs px-2 py-1 rounded-md transition-colors',
              disabled
                ? 'cursor-not-allowed opacity-50'
                : 'hover:bg-accent text-muted-foreground hover:text-foreground'
            )}
          >
            {allSelected ? '全解除' : '全選択'}
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {options.map((option) => {
            const isSelected = selectedItems.includes(option.value);
            return (
              <label
                key={option.value}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-3 transition-colors cursor-pointer',
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50',
                  disabled && 'cursor-not-allowed opacity-50'
                )}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => handleToggle(option.value)}
                  disabled={disabled}
                />
                <span className="text-sm font-medium">{option.label}</span>
              </label>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          選択中: {selectedItems.length}/{options.length}
        </p>
      </CardContent>
    </Card>
  );
}
