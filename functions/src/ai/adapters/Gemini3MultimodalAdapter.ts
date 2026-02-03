/**
 * Gemini 3.0 Pro を使用した家具推薦アダプター
 * RAGで商品カタログから検索
 */

import {
  FurnitureRecommendationAdapter,
  DetectedFurniture,
  FurnitureRecommendation,
} from "./FurnitureRecommendationAdapter";

export class Gemini3MultimodalAdapter implements FurnitureRecommendationAdapter {
  private readonly modelName = "gemini-3.0-pro";

  async detectFurniture(image: Buffer): Promise<DetectedFurniture[]> {
    // TODO: Genkit を使用して Gemini 3.0 Pro を呼び出す
    // マルチモーダル機能で画像から家具を検出

    console.log("Detecting furniture in image, size:", image.length);

    // 仮の実装（後で実装）
    throw new Error("Not implemented yet. Please implement Gemini 3.0 Pro integration.");
  }

  async recommendProducts(
    detectedFurniture: DetectedFurniture[],
    catalogEmbeddings?: number[][]
  ): Promise<FurnitureRecommendation[]> {
    // TODO: RAGで商品カタログを検索
    // 1. 検出された家具の特徴を埋め込みベクトルに変換
    // 2. カタログの埋め込みベクトルと類似度計算
    // 3. 上位N件を返す

    console.log("Recommending products for detected furniture:", detectedFurniture.length);

    // 仮の実装（後で実装）
    throw new Error("Not implemented yet. Please implement RAG search.");
  }

  getModelName(): string {
    return this.modelName;
  }

  /**
   * 家具検出用のプロンプトを構築
   */
  private buildDetectionPrompt(): string {
    return `あなたはインテリア専門家です。
提供された画像から、配置されている家具を検出し、以下の情報を提供してください:

- カテゴリ（ソファ、テーブル、椅子、ベッドなど）
- 画像内の位置（0-1の正規化座標）
- 家具の詳細な説明（色、スタイル、素材など）

JSON形式で返してください。`;
  }

  /**
   * 商品推薦用のプロンプトを構築
   */
  private buildRecommendationPrompt(furniture: DetectedFurniture): string {
    return `以下の家具に類似した実在の商品を推薦してください:

カテゴリ: ${furniture.category}
説明: ${furniture.description}

推薦する際の基準:
- スタイルの一致
- 色の調和
- サイズの適切さ
- 価格の妥当性`;
  }
}
