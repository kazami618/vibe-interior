/**
 * 家具推薦アダプターの共通インターフェース
 */

export interface FurnitureRecommendation {
  productId: string;
  name: string;
  category: string;
  price: number;
  imageUrl: string;
  affiliateUrl: string;
  source: "rakuten" | "amazon";
  score: number; // 類似度スコア (0-1)
  reason: string; // 推薦理由
}

export interface DetectedFurniture {
  category: string;
  position: {
    x: number; // 0-1の正規化座標
    y: number;
  };
  description: string;
}

/**
 * 家具推薦アダプターのインターフェース
 */
export interface FurnitureRecommendationAdapter {
  /**
   * 画像から家具を検出
   * @param image 生成された画像
   * @returns 検出された家具リスト
   */
  detectFurniture(image: Buffer): Promise<DetectedFurniture[]>;

  /**
   * 検出された家具に対して推薦商品を取得
   * @param detectedFurniture 検出された家具
   * @param catalogEmbeddings 商品カタログの埋め込みベクトル（RAG用）
   * @returns 推薦商品リスト
   */
  recommendProducts(
    detectedFurniture: DetectedFurniture[],
    catalogEmbeddings?: number[][]
  ): Promise<FurnitureRecommendation[]>;

  /**
   * モデル名を取得
   */
  getModelName(): string;
}
