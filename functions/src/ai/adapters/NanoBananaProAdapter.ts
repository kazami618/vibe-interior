/**
 * Gemini 2.0 Flash を使用した画像生成アダプター
 * Google Generative AI SDKを直接使用
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  ImageGenerationAdapter,
  FurnitureReference,
  GenerationOptions,
  GeneratedImage,
} from "./ImageGenerationAdapter";

export class NanoBananaProAdapter implements ImageGenerationAdapter {
  private readonly modelName = "gemini-3-pro-image-preview";
  private genAI: GoogleGenerativeAI;

  constructor() {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_GENAI_API_KEY is not set");
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * 商品画像をダウンロードしてBase64に変換
   */
  private async fetchImageAsBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`Failed to fetch image: ${url}`);
        return null;
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const contentType = response.headers.get("content-type") || "image/jpeg";
      return {
        data: buffer.toString("base64"),
        mimeType: contentType,
      };
    } catch (error) {
      console.warn(`Error fetching image ${url}:`, error);
      return null;
    }
  }

  async generateInteriorDesign(
    roomImage: Buffer,
    furnitureReferences: FurnitureReference[],
    options?: GenerationOptions
  ): Promise<GeneratedImage> {
    const prompt = this.buildPrompt(furnitureReferences, options);

    try {
      // Base64エンコード
      const roomImageBase64 = roomImage.toString("base64");

      // 商品画像をダウンロード（最大8枚に制限 - 選定数と同じ）
      const furnitureImages: Array<{ data: string; mimeType: string; name: string }> = [];
      const limitedRefs = furnitureReferences.slice(0, 8);

      for (const ref of limitedRefs) {
        if (ref.imageUrl) {
          const imageData = await this.fetchImageAsBase64(ref.imageUrl);
          if (imageData) {
            furnitureImages.push({
              ...imageData,
              name: ref.name,
            });
          }
        }
      }

      console.log(`Loaded ${furnitureImages.length} furniture reference images`);

      // Nano Banana Pro (Gemini 3 Pro Image) モデルを取得
      const model = this.genAI.getGenerativeModel({
        model: "gemini-3-pro-image-preview",
        generationConfig: {
          responseModalities: ["text", "image"],
        } as any, // 型定義が追いついていないため
      });

      // コンテンツ配列を構築（部屋画像 + 商品画像 + プロンプト）
      const contentParts: any[] = [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: roomImageBase64,
          },
        },
      ];

      // 商品画像を追加
      for (const img of furnitureImages) {
        contentParts.push({
          inlineData: {
            mimeType: img.mimeType,
            data: img.data,
          },
        });
      }

      // プロンプトを追加
      contentParts.push({ text: prompt });

      // 画像生成リクエスト
      const result = await model.generateContent(contentParts);

      const response = result.response;
      const parts = response.candidates?.[0]?.content?.parts;

      if (!parts) {
        throw new Error("レスポンスにコンテンツがありません");
      }

      // 画像パートを探す
      let imageData: string | null = null;
      let mimeType = "image/png";

      for (const part of parts) {
        if ("inlineData" in part && part.inlineData) {
          imageData = part.inlineData.data;
          mimeType = part.inlineData.mimeType || "image/png";
          break;
        }
      }

      if (!imageData) {
        // 画像が生成されなかった場合、テキストレスポンスを確認
        const textPart = parts.find((p: any) => "text" in p);
        const errorText = textPart && "text" in textPart ? textPart.text : "不明なエラー";
        throw new Error(`画像が生成されませんでした: ${errorText}`);
      }

      const imageBuffer = Buffer.from(imageData, "base64");

      return {
        imageUrl: `data:${mimeType};base64,${imageData}`,
        imageBuffer,
        metadata: {
          model: this.modelName,
          generatedAt: new Date(),
          options: options || {},
        },
      };
    } catch (error) {
      console.error("Error generating interior design:", error);
      throw new Error(
        `画像生成に失敗しました: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
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
    const style = this.getStyleDescription(options?.style || "modern");
    const roomType = this.getRoomTypeDescription(options?.roomType || "living_room");
    const scenario = options?.scenario || "redecorate";

    // 新しいシナリオパラメータを優先、フォールバックとして旧パラメータを使用
    const addItems = options?.addItems || options?.targetItems || [];
    const keepItems = options?.keepItems || [];
    const preservedItems = options?.preservedItems || [];

    // シナリオに応じたコンテキストを生成
    const scenarioContext = this.getScenarioContext(scenario);

    // 変更対象アイテムの説明を生成
    const addItemDescriptions = this.getItemCategoryDescriptions(addItems);
    const keepItemDescriptions = this.getItemCategoryDescriptions(keepItems);
    const preservedItemDescriptions = this.getPreservedItemDescriptions(preservedItems);

    let prompt = `You are a professional interior designer specializing in ${scenarioContext.specialty}.
Your task is to ${scenarioContext.task}.

## Room Information
- Room type: ${roomType}
- Target style: ${style}
- Scenario: ${scenarioContext.description}

## CRITICAL INSTRUCTIONS - MUST FOLLOW

### Items to ADD (place these items in the room):
${addItemDescriptions.length > 0 ? addItemDescriptions.map(item => `- ${item}`).join('\n') : '- None specified'}
`;

    if (scenario === "redecorate" && keepItemDescriptions.length > 0) {
      prompt += `
### Items to KEEP (preserve these existing items):
${keepItemDescriptions.map(item => `- ${item}`).join('\n')}
`;
    }

    prompt += `
### Structural Elements to STRICTLY PRESERVE (DO NOT modify):
${preservedItemDescriptions.length > 0 ? preservedItemDescriptions.map(item => `- ${item}`).join('\n') : `- Walls and ceiling (EXACT same color, texture, and material)
- Flooring (EXACT same material, color, and pattern)
- Windows and window frames
- Doors and door frames`}

## Important Rules:
1. This is for a RENTAL apartment - structural changes are NOT allowed
2. Keep the EXACT same walls, wall color, wall texture
3. Keep the EXACT same flooring material and color
4. Keep the EXACT same windows, window frames, and their positions
5. Keep the EXACT same doors and door frames
6. Only add/change the items listed in "Items to ADD"
${scenario === "redecorate" ? "7. Keep the items listed in \"Items to KEEP\" - they should remain in the room" : ""}
8. Maintain the same room dimensions, perspective, and lighting direction
9. **CRITICAL: The output image MUST have the EXACT same aspect ratio as the input room image**

## CRITICAL LIGHTING RULE - MUST FOLLOW:
- **ONLY ONE ceiling light fixture is allowed per room** - this means ONE pendant light OR ONE ceiling light, NOT both
- If the furniture list includes a ceiling light, place ONLY that ONE ceiling light
- Do NOT add any additional ceiling lights, pendant lights, or chandeliers
- Floor lamps, table lamps, and wall sconces are allowed in addition to the single ceiling light
- If the original room has multiple ceiling lights, replace them with JUST ONE ceiling light from the furniture list

## Style Guidelines for ${style}:
${this.getStyleGuidelines(options?.style || "modern")}

Generate a single photorealistic image showing the redesigned room.
`;

    if (furnitureReferences.length > 0) {
      prompt += `\n## SPECIFIC FURNITURE TO PLACE IN THE ROOM:
The following furniture items have been specifically selected for this room.
Reference images for each item are provided after the room image.

**CRITICAL: You MUST use the EXACT furniture shown in the reference images.**
Do NOT create generic or different furniture. Copy the visual appearance of each reference image.

`;
      furnitureReferences.slice(0, 8).forEach((ref, index) => {
        prompt += `【${index + 1}】 ${ref.name}
   - Category: ${ref.category}
   - Reference image #${index + 2} shows this exact item
   - Place this EXACT item (matching the reference image) naturally in the room
`;
      });

      prompt += `
## IMPORTANT INSTRUCTIONS FOR FURNITURE PLACEMENT:
1. The images are provided in this order: [Room image], [Furniture 1], [Furniture 2], ...
2. Each furniture reference image shows the EXACT product to place
3. Match the color, shape, and design of each reference image precisely
4. Place each item in an appropriate location within the room
5. Do NOT add any numbers, labels, or text on the generated image - keep it clean and photorealistic
`;
    }

    return prompt;
  }

  /**
   * シナリオに応じたコンテキストを取得
   */
  private getScenarioContext(scenario: string): { specialty: string; task: string; description: string } {
    const contexts: Record<string, { specialty: string; task: string; description: string }> = {
      redecorate: {
        specialty: "room makeovers and redecoration",
        task: "generate a redecorated room image that adds new items while keeping existing furniture the user wants to preserve",
        description: "Room redecoration - refreshing the space with new items while keeping some existing furniture",
      },
      moving: {
        specialty: "new home styling and furniture coordination",
        task: "generate a fully furnished room image for a new home, placing all selected furniture items",
        description: "Moving to a new home - furnishing an empty or nearly empty space with all new items",
      },
    };
    return contexts[scenario] || contexts.redecorate;
  }

  /**
   * アイテムカテゴリの説明を取得（新形式）
   */
  private getItemCategoryDescriptions(items: string[]): string[] {
    // 日本語カテゴリ名をそのまま使用（AI理解可能）
    return items.filter(Boolean);
  }

  /**
   * 変更対象アイテムの説明を取得
   */
  private getTargetItemDescriptions(targetItems: string[]): string[] {
    const descriptions: Record<string, string> = {
      lighting: "Lighting fixtures (ceiling lights, floor lamps, table lamps)",
      rug: "Rugs and carpets",
      cushion: "Cushions and throw pillows",
      wall_decor: "Wall decorations (art, mirrors, shelves - but NOT wall color/texture)",
      plants: "Indoor plants and greenery",
      small_furniture: "Small furniture (side tables, chairs, storage units)",
      curtain: "Curtains and window treatments",
    };
    return targetItems.map(item => descriptions[item] || item).filter(Boolean);
  }

  /**
   * 維持対象アイテムの説明を取得
   */
  private getPreservedItemDescriptions(preservedItems: string[]): string[] {
    const descriptions: Record<string, string> = {
      walls_ceiling: "Walls and ceiling (EXACT same color, texture, and material)",
      flooring: "Flooring (EXACT same material, color, and pattern - hardwood, tile, carpet, etc.)",
      windows: "Windows and window frames (EXACT same position, size, and frame color)",
      large_furniture: "Large furniture pieces (existing beds, sofas, wardrobes - if present)",
      doors: "Doors and door frames (EXACT same position, style, and color)",
    };
    return preservedItems.map(item => descriptions[item] || item).filter(Boolean);
  }

  /**
   * スタイル別のガイドラインを取得
   */
  private getStyleGuidelines(style: string): string {
    const guidelines: Record<string, string> = {
      scandinavian: `- Use light, natural wood tones
- Add cozy textiles (wool, linen)
- Include minimalist, functional furniture
- Soft, neutral color palette with occasional muted colors
- Natural light emphasis with sheer curtains`,
      modern: `- Clean lines and minimal ornamentation
- Neutral color palette (black, white, gray)
- Sleek, contemporary furniture
- Strategic use of metallic accents
- Uncluttered, open feeling`,
      vintage: `- Mix of antique and retro pieces
- Warm, rich color tones
- Textured fabrics and patterns
- Decorative accessories with history
- Layered, collected look`,
      industrial: `- Exposed metal elements
- Raw, unfinished textures
- Dark color accents
- Functional, utilitarian furniture
- Edison bulbs and metal light fixtures`,
    };
    return guidelines[style] || guidelines.modern;
  }

  /**
   * スタイルの説明を取得
   */
  private getStyleDescription(style: string): string {
    const styleDescriptions: Record<string, string> = {
      scandinavian: "Scandinavian (simple, warm, with light wood and white tones)",
      modern: "Modern (sophisticated, minimal design with clean lines and neutral colors)",
      vintage: "Vintage (retro charm with antique furniture and warm tones)",
      industrial: "Industrial (raw and cool with metal, concrete, and exposed materials)",
    };
    return styleDescriptions[style] || style;
  }

  /**
   * 部屋タイプの説明を取得
   */
  private getRoomTypeDescription(roomType: string): string {
    const roomTypeDescriptions: Record<string, string> = {
      // 新しい部屋タイプ
      living: "Living room",
      dining: "Dining room",
      bedroom: "Bedroom",
      one_room: "One-room apartment (studio)",
      // 旧形式（後方互換性）
      living_room: "Living room",
      kitchen: "Kitchen",
      dining_room: "Dining room",
      office: "Home office",
      bathroom: "Bathroom",
    };
    return roomTypeDescriptions[roomType] || roomType;
  }
}
