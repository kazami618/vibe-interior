/**
 * AI モデルの設定
 * ここでどのアダプターを使用するかを設定
 */

import { ImageGenerationAdapter } from "./adapters/ImageGenerationAdapter";
import { FurnitureRecommendationAdapter } from "./adapters/FurnitureRecommendationAdapter";
import { NanoBananaProAdapter } from "./adapters/NanoBananaProAdapter";
import { Gemini3MultimodalAdapter } from "./adapters/Gemini3MultimodalAdapter";

/**
 * 画像生成アダプターのインスタンスを取得
 */
export function getImageGenerationAdapter(): ImageGenerationAdapter {
  // 環境変数で切り替え可能にする（将来拡張）
  const adapterType = process.env.IMAGE_GENERATION_ADAPTER || "nanobananapro";

  switch (adapterType) {
    case "nanobananapro":
      return new NanoBananaProAdapter();
    default:
      throw new Error(`Unknown image generation adapter: ${adapterType}`);
  }
}

/**
 * 家具推薦アダプターのインスタンスを取得
 */
export function getFurnitureRecommendationAdapter(): FurnitureRecommendationAdapter {
  // 環境変数で切り替え可能にする（将来拡張）
  const adapterType = process.env.FURNITURE_RECOMMENDATION_ADAPTER || "gemini3multimodal";

  switch (adapterType) {
    case "gemini3multimodal":
      return new Gemini3MultimodalAdapter();
    default:
      throw new Error(`Unknown furniture recommendation adapter: ${adapterType}`);
  }
}
