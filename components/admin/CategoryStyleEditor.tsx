'use client';

import { useState, KeyboardEvent } from 'react';
import { X, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { ItemCategory, DesignStyle } from '@/lib/types/design';
import { ITEM_CATEGORY_GROUPS, DESIGN_STYLES } from '@/lib/types/design';

interface CategoryStyleEditorProps {
  category: ItemCategory;
  style: DesignStyle;
  tags: string[];
  onCategoryChange: (category: ItemCategory) => void;
  onStyleChange: (style: DesignStyle) => void;
  onTagsChange: (tags: string[]) => void;
}

export default function CategoryStyleEditor({
  category,
  style,
  tags,
  onCategoryChange,
  onStyleChange,
  onTagsChange,
}: CategoryStyleEditorProps) {
  const [tagInput, setTagInput] = useState('');

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onTagsChange([...tags, trimmed]);
      setTagInput('');
    }
  };

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleAddTag();
    }
    if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      onTagsChange(tags.slice(0, -1));
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onTagsChange(tags.filter((t) => t !== tagToRemove));
  };

  return (
    <div className="space-y-4">
      {/* Category Dropdown */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
          カテゴリ
        </label>
        <select
          value={category}
          onChange={(e) => onCategoryChange(e.target.value as ItemCategory)}
          className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {ITEM_CATEGORY_GROUPS.map((group) => (
            <optgroup key={group.group} label={group.group}>
              {group.items.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Style Dropdown */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
          スタイル
        </label>
        <select
          value={style}
          onChange={(e) => onStyleChange(e.target.value as DesignStyle)}
          className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {DESIGN_STYLES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tag Editor */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
          タグ
        </label>
        <div className="flex flex-wrap gap-1.5 p-2 rounded-md border border-input bg-background min-h-[2.5rem]">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
            >
              {tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <div className="flex items-center gap-1 flex-1 min-w-[100px]">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder="タグを追加..."
              className="border-0 bg-transparent h-6 px-1 text-xs shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            {tagInput.trim() && (
              <button
                type="button"
                onClick={handleAddTag}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors text-muted-foreground"
              >
                <Plus className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
