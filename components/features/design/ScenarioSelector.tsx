'use client';

import { Scenario, SCENARIOS } from '@/lib/types/design';
import { cn } from '@/lib/utils';
import { Check, RefreshCw, Home } from 'lucide-react';

interface ScenarioSelectorProps {
  value: Scenario | null;
  onChange: (scenario: Scenario) => void;
  disabled?: boolean;
}

// シナリオの情報
const SCENARIO_INFO: Record<Scenario, {
  icon: typeof RefreshCw;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  redecorate: {
    icon: RefreshCw,
    color: 'text-amber-600',
    bgColor: 'bg-amber-500',
    borderColor: 'border-amber-500',
  },
  moving: {
    icon: Home,
    color: 'text-sky-600',
    bgColor: 'bg-sky-500',
    borderColor: 'border-sky-500',
  },
};

export function ScenarioSelector({ value, onChange, disabled }: ScenarioSelectorProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">どんなお部屋づくりをしますか？</h2>
        <p className="text-sm text-muted-foreground">目的に合わせて最適な提案をします</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SCENARIOS.map((scenario) => {
          const isSelected = value === scenario.value;
          const info = SCENARIO_INFO[scenario.value];
          const IconComponent = info.icon;

          return (
            <button
              key={scenario.value}
              type="button"
              onClick={() => !disabled && onChange(scenario.value)}
              disabled={disabled}
              className={cn(
                'relative flex flex-col items-center gap-4 p-6 rounded-2xl border-2 transition-all text-center',
                isSelected
                  ? `${info.borderColor} ${info.bgColor}/10 shadow-lg`
                  : 'border-border bg-card hover:border-current hover:bg-current/5',
                !isSelected && info.color,
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {/* アイコン */}
              <div className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center',
                isSelected ? info.bgColor : 'bg-muted'
              )}>
                <IconComponent className={cn(
                  'w-8 h-8',
                  isSelected ? 'text-white' : info.color
                )} />
              </div>

              {/* テキスト */}
              <div>
                <h3 className={cn(
                  'font-bold text-lg',
                  isSelected ? info.color : 'text-foreground'
                )}>
                  {scenario.label}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {scenario.description}
                </p>
              </div>

              {/* 選択チェック */}
              {isSelected && (
                <div className={cn(
                  'absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center',
                  info.bgColor
                )}>
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
