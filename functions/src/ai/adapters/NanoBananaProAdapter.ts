/**
 * Gemini 3 Pro Image を使用した画像生成アダプター
 * NanoBananaProは仮称（実際のモデル名はGemini 3 Pro Image）
 */

import {
  ImageGenerationAdapter,
  FurnitureReference,
  GenerationOptions,
  GeneratedImage,
} from "./ImageGenerationAdapter";

export class NanoBananaProAdapter implements ImageGenerationAdapter {
  private readonly modelName = "gemini-3.0-pro-image";

  async generateInteriorDesign(
    roomImage: Buffer,
    furnitureReferences: FurnitureReference[],
    options?: GenerationOptions
  ): Promise<GeneratedImage> {
    // TODO: Genkit を使用して Gemini 3 Pro Image を呼び出す
    // reference_images パラメータで家具の一貫性を維持

    const prompt = this.buildPrompt(furnitureReferences, options);

    // 仮の実装（後で実装）
    console.log("Generating interior design with prompt:", prompt);
    console.log("Room image size:", roomImage.length);
    console.log("Furniture references:", furnitureReferences.length);

    // 仮のレスポンス
    throw new Error("Not implemented yet. Please implement Gemini 3 Pro Image integration.");
  }

  getModelName(): string {
    return this.modelName;
  }

  /**
   * プロンプトを構築
   */
  private buildPrompt(
    furnitureReferences: FurnitureReference[],
    options?: GenerationOptions
  ): string {
    const style = options?.style || "modern";
    const roomType = options?.roomType || "living room";

    let prompt = `あなたはプロのインテリアデザイナーです。
提供された部屋の画像に、以下の家具を配置した改装イメージを生成してください。

部屋のタイプ: ${roomType}
スタイル: ${style}

配置する家具:
`;

    furnitureReferences.forEach((ref, index) => {
      prompt += `${index + 1}. ${ref.name} (${ref.category})\n`;
    });

    prompt += `
要件:
- 家具の配置は自然で実用的であること
- 各家具は reference_images で提供された見た目を維持すること
- 部屋の元の構造（窓、ドアなど）は保持すること
- 照明や影も自然にレンダリングすること
- 高品質でフォトリアリスティックな画像を生成すること
`;

    return prompt;
  }
}
