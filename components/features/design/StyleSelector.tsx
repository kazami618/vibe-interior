'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DESIGN_STYLES, type DesignStyle } from '@/lib/types/design';
import { cn } from '@/lib/utils';

interface StyleSelectorProps {
  value: DesignStyle;
  onChange: (value: DesignStyle) => void;
  disabled?: boolean;
}

export function StyleSelector({
  value,
  onChange,
  disabled = false,
}: StyleSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">スタイルを選択</CardTitle>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={value}
          onValueChange={(v) => onChange(v as DesignStyle)}
          className="grid grid-cols-2 gap-4"
        >
          {DESIGN_STYLES.map((style) => (
            <label
              key={style.value}
              htmlFor={`style-${style.value}`}
              className={cn(
                'relative flex flex-col gap-2 rounded-lg border-2 p-4 transition-colors',
                value === style.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50',
                disabled && 'cursor-not-allowed opacity-50'
              )}
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem
                  value={style.value}
                  id={`style-${style.value}`}
                  disabled={disabled}
                />
                <span className="font-medium">{style.label}</span>
              </div>
              <p className="text-xs text-muted-foreground pl-7">
                {style.description}
              </p>
            </label>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
