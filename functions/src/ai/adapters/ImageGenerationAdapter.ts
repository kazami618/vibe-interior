/**
 * 画像生成アダプターの共通インターフェース
 * 将来的に異なるAIモデルを切り替えられるようにアダプターパターンを採用
 */

export interface FurnitureReference {
  productId: string;
  name: string;
  imageUrl: string;
  category: string;
  affiliateUrl?: string;
}

export interface GenerationOptions {
  style?: string; // "modern", "scandinavian", "traditional"など
  roomType?: string; // "living_room", "bedroom", "kitchen"など
  furnitureCount?: number; // 配置する家具の数
  targetItems?: string[]; // 変更・追加したいアイテム (legacy)
  preservedItems?: string[]; // 維持したいアイテム (legacy)
  // 新しいシナリオパラメータ
  scenario?: string; // "redecorate" | "moving"
  addItems?: string[]; // 追加/購入したいアイテムカテゴリ
  keepItems?: string[]; // 残したいアイテムカテゴリ（模様替えシナリオ用）
}

export interface GeneratedImage {
  imageUrl: string;
  imageBuffer: Buffer;
  metadata: {
    model: string;
    generatedAt: Date;
    options: GenerationOptions;
  };
}

/**
 * 画像生成アダプターのインターフェース
 */
export interface ImageGenerationAdapter {
  /**
   * インテリアデザインを生成
   * @param roomImage 元の部屋画像
   * @param furnitureReferences 配置する家具の参照画像
   * @param options 生成オプション
   * @returns 生成された画像情報
   */
  generateInteriorDesign(
    roomImage: Buffer,
    furnitureReferences: FurnitureReference[],
    options?: GenerationOptions
  ): Promise<GeneratedImage>;

  /**
   * モデル名を取得
   */
  getModelName(): string;
}
