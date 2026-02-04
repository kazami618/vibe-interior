export type DesignStyle = 'scandinavian' | 'modern' | 'vintage' | 'industrial';

export type DesignStatus = 'processing' | 'completed' | 'failed';

// シナリオ
export type Scenario = 'redecorate' | 'moving';

export const SCENARIOS: { value: Scenario; label: string; description: string; icon: string }[] = [
  { value: 'redecorate', label: '模様替え', description: '今の部屋の雰囲気を変えたい', icon: '🔄' },
  { value: 'moving', label: '引越し・新生活', description: '新居のコーディネートをしたい', icon: '🏠' },
];

// 部屋タイプ
export type RoomType = 'living' | 'dining' | 'bedroom' | 'one_room';

export const ROOM_TYPES: { value: RoomType; label: string }[] = [
  { value: 'living', label: 'リビング' },
  { value: 'dining', label: 'ダイニング' },
  { value: 'bedroom', label: '寝室' },
  { value: 'one_room', label: 'ワンルーム' },
];

// アイテムカテゴリ（スプレッドシート準拠）
export type ItemCategory =
  // 大型家具
  | 'ソファ' | 'ベッド' | 'テーブル' | 'チェア' | 'ダイニングテーブル' | 'ダイニングチェア' | '座椅子' | 'こたつ'
  // 収納・家具
  | '収納' | 'サイドテーブル' | 'ワードローブ' | 'ドレッサー' | 'ハンガーラック' | '収納小物' | 'ゴミ箱'
  // 照明
  | '照明' | '間接照明' | 'ダイニング照明'
  // ファブリック
  | 'ラグ' | 'ダイニングラグ' | '玄関マット' | 'カーテン' | 'クッション' | 'ブランケット' | '寝具'
  // 装飾
  | '観葉植物' | '壁掛け' | 'ミラー'
  // 内装
  | '壁紙' | 'フロアタイル'
  // その他
  | 'インテリア家電' | 'マットレス' | 'その他';

// カテゴリグループ定義
export const ITEM_CATEGORY_GROUPS: { group: string; items: { value: ItemCategory; label: string }[] }[] = [
  {
    group: '大型家具',
    items: [
      { value: 'ソファ', label: 'ソファ' },
      { value: 'ベッド', label: 'ベッド' },
      { value: 'テーブル', label: 'テーブル' },
      { value: 'チェア', label: 'チェア' },
      { value: 'ダイニングテーブル', label: 'ダイニングテーブル' },
      { value: 'ダイニングチェア', label: 'ダイニングチェア' },
      { value: '座椅子', label: '座椅子' },
      { value: 'こたつ', label: 'こたつ' },
    ],
  },
  {
    group: '収納・家具',
    items: [
      { value: '収納', label: '収納' },
      { value: 'サイドテーブル', label: 'サイドテーブル' },
      { value: 'ワードローブ', label: 'ワードローブ' },
      { value: 'ドレッサー', label: 'ドレッサー' },
      { value: 'ハンガーラック', label: 'ハンガーラック' },
      { value: '収納小物', label: '収納小物' },
      { value: 'ゴミ箱', label: 'ゴミ箱' },
    ],
  },
  {
    group: '照明',
    items: [
      { value: '照明', label: '照明' },
      { value: '間接照明', label: '間接照明' },
      { value: 'ダイニング照明', label: 'ダイニング照明' },
    ],
  },
  {
    group: 'ファブリック',
    items: [
      { value: 'ラグ', label: 'ラグ' },
      { value: 'ダイニングラグ', label: 'ダイニングラグ' },
      { value: '玄関マット', label: '玄関マット' },
      { value: 'カーテン', label: 'カーテン' },
      { value: 'クッション', label: 'クッション' },
      { value: 'ブランケット', label: 'ブランケット' },
      { value: '寝具', label: '寝具' },
    ],
  },
  {
    group: '装飾',
    items: [
      { value: '観葉植物', label: '観葉植物' },
      { value: '壁掛け', label: '壁掛け' },
      { value: 'ミラー', label: 'ミラー' },
    ],
  },
  {
    group: '内装',
    items: [
      { value: '壁紙', label: '壁紙' },
      { value: 'フロアタイル', label: 'フロアタイル' },
    ],
  },
  {
    group: 'その他',
    items: [
      { value: 'インテリア家電', label: 'インテリア家電' },
      { value: 'マットレス', label: 'マットレス' },
    ],
  },
];

// シナリオ別デフォルトアイテム（フォールバック用）
export const DEFAULT_ITEMS_BY_SCENARIO: Record<Scenario, { add: ItemCategory[]; keep: ItemCategory[] }> = {
  redecorate: {
    add: ['照明', 'ラグ', 'クッション', '観葉植物', '壁掛け', '間接照明'],
    keep: ['ソファ', 'ベッド', 'テーブル', 'ダイニングテーブル'],
  },
  moving: {
    add: ['ソファ', 'ベッド', 'テーブル', '照明', 'ラグ', 'カーテン', '収納'],
    keep: [],
  },
};

// 部屋タイプ×シナリオ別のデフォルトアイテム
export const DEFAULT_ITEMS_BY_ROOM_AND_SCENARIO: Record<
  RoomType,
  Record<Scenario, { add: ItemCategory[]; keep: ItemCategory[] }>
> = {
  // リビング
  living: {
    redecorate: {
      add: ['照明', 'ラグ', 'クッション', '観葉植物', '壁掛け', '間接照明'],
      keep: ['ソファ', 'テーブル'],
    },
    moving: {
      add: ['ソファ', 'テーブル', '照明', 'ラグ', 'カーテン', 'クッション', '観葉植物'],
      keep: [],
    },
  },
  // ダイニング
  dining: {
    redecorate: {
      add: ['ダイニング照明', 'ダイニングラグ', '観葉植物', '壁掛け'],
      keep: ['ダイニングテーブル', 'ダイニングチェア'],
    },
    moving: {
      add: ['ダイニングテーブル', 'ダイニングチェア', 'ダイニング照明', 'ダイニングラグ', 'カーテン', '観葉植物'],
      keep: [],
    },
  },
  // 寝室
  bedroom: {
    redecorate: {
      add: ['間接照明', 'カーテン', '寝具', '壁掛け', '観葉植物'],
      keep: ['ベッド'],
    },
    moving: {
      add: ['ベッド', '寝具', 'カーテン', '間接照明', 'サイドテーブル', 'ラグ', '収納'],
      keep: [],
    },
  },
  // ワンルーム
  one_room: {
    redecorate: {
      add: ['照明', 'ラグ', 'クッション', '観葉植物', '壁掛け', '間接照明', 'カーテン'],
      keep: ['ベッド', 'テーブル'],
    },
    moving: {
      add: ['ベッド', 'ソファ', 'テーブル', '照明', 'ラグ', 'カーテン', '収納', '寝具'],
      keep: [],
    },
  },
};

// 部屋タイプとシナリオからデフォルトアイテムを取得するヘルパー関数
export function getDefaultItemsForRoom(
  roomType: RoomType | null,
  scenario: Scenario | null
): { add: ItemCategory[]; keep: ItemCategory[] } {
  if (!scenario) {
    return { add: [], keep: [] };
  }

  if (roomType && DEFAULT_ITEMS_BY_ROOM_AND_SCENARIO[roomType]) {
    return DEFAULT_ITEMS_BY_ROOM_AND_SCENARIO[roomType][scenario];
  }

  // フォールバック
  return DEFAULT_ITEMS_BY_SCENARIO[scenario];
}

// 旧型定義（後方互換性のため維持）
export type TargetItem =
  | 'lighting'
  | 'rug'
  | 'cushion'
  | 'wall_decor'
  | 'plants'
  | 'small_furniture'
  | 'curtain';

export type PreservedItem =
  | 'walls_ceiling'
  | 'flooring'
  | 'windows'
  | 'large_furniture'
  | 'doors';

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
  // 新しいシナリオパラメータ
  scenario?: Scenario;
  roomType?: RoomType;
  addItems?: ItemCategory[];
  keepItems?: ItemCategory[];
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
