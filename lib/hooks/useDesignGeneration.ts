'use client';

import { useState, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import type {
  DesignStyle,
  TargetItem,
  PreservedItem,
  Scenario,
  RoomType,
  ItemCategory,
  GenerateRoomDesignRequest,
  GenerateRoomDesignResponse,
} from '@/lib/types/design';

interface ScenarioOptions {
  scenario: Scenario;
  roomType: RoomType;
  addItems: ItemCategory[];
  keepItems: ItemCategory[];
}

interface UseDesignGenerationReturn {
  generating: boolean;
  error: string | null;
  generate: (
    style: DesignStyle,
    originalImagePath: string,
    targetItems?: TargetItem[],
    preservedItems?: PreservedItem[],
    scenarioOptions?: ScenarioOptions
  ) => Promise<GenerateRoomDesignResponse | null>;
}

export function useDesignGeneration(): UseDesignGenerationReturn {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (
      style: DesignStyle,
      originalImagePath: string,
      targetItems?: TargetItem[],
      preservedItems?: PreservedItem[],
      scenarioOptions?: ScenarioOptions
    ): Promise<GenerateRoomDesignResponse | null> => {
      setGenerating(true);
      setError(null);

      try {
        const generateRoomDesign = httpsCallable<
          GenerateRoomDesignRequest,
          GenerateRoomDesignResponse
        >(functions, 'generateRoomDesign');

        const result = await generateRoomDesign({
          style,
          originalImagePath,
          targetItems: targetItems || [],
          preservedItems: preservedItems || [],
          // 新しいシナリオパラメータ
          scenario: scenarioOptions?.scenario,
          roomType: scenarioOptions?.roomType,
          addItems: scenarioOptions?.addItems,
          keepItems: scenarioOptions?.keepItems,
        });

        return result.data;
      } catch (err: unknown) {
        console.error('Generation error:', err);

        // Firebase FunctionsのエラーをハンドリングW
        if (err && typeof err === 'object' && 'code' in err) {
          const firebaseError = err as { code: string; message?: string };
          switch (firebaseError.code) {
            case 'functions/unauthenticated':
              setError('ログインが必要です');
              break;
            case 'functions/failed-precondition':
              setError('チケットが不足しています');
              break;
            case 'functions/invalid-argument':
              setError('入力データが不正です');
              break;
            default:
              setError('画像生成に失敗しました');
          }
        } else {
          setError('画像生成に失敗しました');
        }

        return null;
      } finally {
        setGenerating(false);
      }
    },
    []
  );

  return {
    generating,
    error,
    generate,
  };
}
