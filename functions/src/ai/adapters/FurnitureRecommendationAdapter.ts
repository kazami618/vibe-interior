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
 * 家具選定リクエスト
 */
export interface FurnitureSelectionRequest {
  roomImage: Buffer;
  style: string;
  targetItems: string[];
  maxItems?: number; // デフォルト4
}

/**
 * 選定された家具
 */
export interface SelectedFurniture {
  productId: string;
  name: string;
  category: string;
  imageUrl: string;
  affiliateUrl: string;
  price: number;
  reason: string; // 選定理由またはレビュー情報
  itemNumber?: number; // 画像内の番号（①②③など）
}

/**
 * 画像内で検出された家具アイテム
 */
export interface DetectedItemInImage {
  category: string;
  description: string;
  style: string;
  color: string;
}

/**
 * 画像分析リクエスト
 */
export interface ImageAnalysisRequest {
  generatedImage: Buffer;
  style: string;
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
   * 部屋画像とスタイルに基づいて最適な家具を選定（RAG）
   * @param request 家具選定リクエスト
   * @returns 選定された家具リスト
   */
  selectFurnitureForRoom(
    request: FurnitureSelectionRequest
  ): Promise<SelectedFurniture[]>;

  /**
   * 生成された画像を分析して家具を検出し、カタログから類似商品を検索
   * @param request 画像分析リクエスト
   * @returns マッチした商品リスト
   */
  analyzeGeneratedImageAndMatchProducts(
    request: ImageAnalysisRequest
  ): Promise<SelectedFurniture[]>;

  /**
   * モデル名を取得
   */
  getModelName(): string;
}
