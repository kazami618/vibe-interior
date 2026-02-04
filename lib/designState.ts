/**
 * デザイン作成状態の保存・復元ユーティリティ
 * チケット購入後に入力内容を復元するために使用
 */

import type { DesignStyle, Scenario, RoomType, ItemCategory } from './types/design';

const STORAGE_KEY = 'pendingDesignState';

export interface PendingDesignState {
  scenario: Scenario | null;
  roomType: RoomType | null;
  selectedStyle: DesignStyle;
  addItems: ItemCategory[];
  keepItems: ItemCategory[];
  previewUrl: string | null; // Base64 data URL
  timestamp: number;
}

/**
 * デザイン状態を保存
 */
export function saveDesignState(state: Omit<PendingDesignState, 'timestamp'>): void {
  try {
    const stateWithTimestamp: PendingDesignState = {
      ...state,
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateWithTimestamp));
  } catch (error) {
    console.error('Failed to save design state:', error);
  }
}

/**
 * デザイン状態を復元
 * 1時間以上経過したデータは無効とする
 */
export function loadDesignState(): PendingDesignState | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;

    const state: PendingDesignState = JSON.parse(data);

    // 1時間以上経過していたら無効
    const ONE_HOUR = 60 * 60 * 1000;
    if (Date.now() - state.timestamp > ONE_HOUR) {
      clearDesignState();
      return null;
    }

    return state;
  } catch (error) {
    console.error('Failed to load design state:', error);
    return null;
  }
}

/**
 * デザイン状態をクリア
 */
export function clearDesignState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear design state:', error);
  }
}

/**
 * 保存済みデザイン状態があるかチェック
 */
export function hasPendingDesignState(): boolean {
  return loadDesignState() !== null;
}
