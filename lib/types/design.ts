export type DesignStyle = 'scandinavian' | 'modern' | 'vintage' | 'industrial';

export type DesignStatus = 'processing' | 'completed' | 'failed';

// 変更・追加したいアイテム
export type TargetItem =
  | 'lighting'      // 照明
  | 'rug'           // ラグ
  | 'cushion'       // クッション
  | 'wall_decor'    // 壁面装飾
  | 'plants'        // 観葉植物
  | 'small_furniture' // 小家具
  | 'curtain';      // カーテン

// 維持したいアイテム
export type PreservedItem =
  | 'walls_ceiling'   // 壁・天井
  | 'flooring'        // 床材(フローリング)
  | 'windows'         // 窓・サッシ
  | 'large_furniture' // 大きな家具(ベッド/ソファ)
  | 'doors';          // 建具(ドア等)

export const TARGET_ITEMS: { value: TargetItem; label: string }[] = [
  { value: 'lighting', label: '照明' },
  { value: 'rug', label: 'ラグ' },
  { value: 'cushion', label: 'クッション' },
  { value: 'wall_decor', label: '壁面装飾' },
  { value: 'plants', label: '観葉植物' },
  { value: 'small_furniture', label: '小家具' },
  { value: 'curtain', label: 'カーテン' },
];

export const PRESERVED_ITEMS: { value: PreservedItem; label: string }[] = [
  { value: 'walls_ceiling', label: '壁・天井' },
  { value: 'flooring', label: '床材(フローリング)' },
  { value: 'windows', label: '窓・サッシ' },
  { value: 'large_furniture', label: '大きな家具(ベッド/ソファ)' },
  { value: 'doors', label: '建具(ドア等)' },
];

// デフォルト選択
export const DEFAULT_TARGET_ITEMS: TargetItem[] = [
  'lighting', 'rug', 'cushion', 'wall_decor', 'plants', 'small_furniture', 'curtain'
];

export const DEFAULT_PRESERVED_ITEMS: PreservedItem[] = [
  'walls_ceiling', 'flooring', 'windows'
];

export interface DesignDocument {
  id: string;
  userId: string;
  style: DesignStyle;
  originalImagePath: string;
  originalImageUrl: string;
  generatedImagePath?: string;
  generatedImageUrl?: string;
  status: DesignStatus;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GenerateRoomDesignRequest {
  style: DesignStyle;
  originalImagePath: string;
  targetItems: TargetItem[];
  preservedItems: PreservedItem[];
}

export interface GenerateRoomDesignResponse {
  designId: string;
  generatedImageUrl: string;
}

export const DESIGN_STYLES: { value: DesignStyle; label: string; description: string }[] = [
  {
    value: 'scandinavian',
    label: '北欧',
    description: 'シンプルで温かみのある北欧スタイル',
  },
  {
    value: 'modern',
    label: 'モダン',
    description: '洗練されたミニマルなモダンスタイル',
  },
  {
    value: 'vintage',
    label: 'ヴィンテージ',
    description: '味わいのあるレトロなヴィンテージスタイル',
  },
  {
    value: 'industrial',
    label: 'インダストリアル',
    description: '無骨でクールなインダストリアルスタイル',
  },
];
