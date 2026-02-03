/**
 * Gemini 3.0 Pro を使用した家具推薦アダプター
 * RAGで商品カタログから検索し、最適な家具を選定
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import * as admin from "firebase-admin";
import {
  FurnitureRecommendationAdapter,
  DetectedFurniture,
  FurnitureRecommendation,
  FurnitureSelectionRequest,
  SelectedFurniture,
  ImageAnalysisRequest,
} from "./FurnitureRecommendationAdapter";

// スタイルとカテゴリのマッピング
const STYLE_KEYWORDS: Record<string, string[]> = {
  scandinavian: ["北欧", "ナチュラル", "シンプル", "木製", "白", "ウッド"],
  modern: ["モダン", "シンプル", "ミニマル", "スタイリッシュ", "モノトーン"],
  vintage: ["ヴィンテージ", "レトロ", "アンティーク", "クラシック", "木目"],
  industrial: ["インダストリアル", "ブルックリン", "アイアン", "スチール", "ヴィンテージ"],
};

// ターゲットアイテムとカテゴリのマッピング
const TARGET_ITEM_CATEGORIES: Record<string, string[]> = {
  lighting: ["照明", "ライト", "ランプ", "シーリングライト", "フロアライト", "テーブルライト"],
  rug: ["ラグ", "カーペット", "マット"],
  cushion: ["クッション", "枕", "ピロー"],
  wall_decor: ["壁掛け", "アート", "ポスター", "ミラー", "時計", "ウォールデコ"],
  plants: ["観葉植物", "フェイクグリーン", "プランター", "植物"],
  small_furniture: ["サイドテーブル", "スツール", "チェスト", "収納", "シェルフ", "ラック"],
  curtain: ["カーテン", "ブラインド", "シェード"],
};

export class Gemini3MultimodalAdapter implements FurnitureRecommendationAdapter {
  private readonly modelName = "gemini-2.0-flash";
  private genAI: GoogleGenerativeAI;

  constructor() {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_GENAI_API_KEY is not set");
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * 部屋画像とスタイルに基づいて最適な家具を選定（RAG）
   */
  async selectFurnitureForRoom(
    request: FurnitureSelectionRequest
  ): Promise<SelectedFurniture[]> {
    const { roomImage, style, targetItems, maxItems = 4 } = request;
    const db = admin.firestore();

    try {
      // 1. Firestoreからスタイルに合致する商品を検索
      const products = await this.searchProductsByStyle(db, style, targetItems);

      if (products.length === 0) {
        console.log("No products found for style:", style);
        return [];
      }

      // 2. Geminiに部屋画像と商品リストを渡して最適な家具を選定
      const selectedProducts = await this.selectBestFurniture(
        roomImage,
        products,
        style,
        maxItems
      );

      return selectedProducts;
    } catch (error) {
      console.error("Error selecting furniture:", error);
      return [];
    }
  }

  /**
   * Firestoreから商品を検索
   */
  private async searchProductsByStyle(
    db: admin.firestore.Firestore,
    style: string,
    targetItems: string[]
  ): Promise<ProductData[]> {
    const productsRef = db.collection("products");
    const allProducts: ProductData[] = [];

    // ターゲットアイテムに対応するカテゴリを取得
    const targetCategories: string[] = [];
    for (const item of targetItems) {
      const categories = TARGET_ITEM_CATEGORIES[item];
      if (categories) {
        targetCategories.push(...categories);
      }
    }

    // スタイルに関連するキーワード
    const styleKeywords = STYLE_KEYWORDS[style] || [];

    try {
      // カテゴリごとに商品を検索
      for (const category of [...new Set(targetCategories)]) {
        const snapshot = await productsRef
          .where("isActive", "==", true)
          .where("keywords", "array-contains", category)
          .limit(20)
          .get();

        snapshot.docs.forEach((doc) => {
          const data = doc.data() as ProductData;
          data.productId = doc.id;

          // スタイルキーワードとのマッチングでスコアを計算
          const keywords = data.keywords || [];
          const matchCount = styleKeywords.filter((kw) =>
            keywords.some((k) => k.includes(kw) || kw.includes(k))
          ).length;

          if (matchCount > 0 || styleKeywords.length === 0) {
            allProducts.push(data);
          }
        });
      }

      // 重複を除去
      const uniqueProducts = Array.from(
        new Map(allProducts.map((p) => [p.productId, p])).values()
      );

      console.log(`Found ${uniqueProducts.length} products for style: ${style}`);
      return uniqueProducts.slice(0, 50); // 最大50件に制限
    } catch (error) {
      console.error("Error searching products:", error);
      return [];
    }
  }

  /**
   * Geminiを使用して最適な家具を選定
   */
  private async selectBestFurniture(
    roomImage: Buffer,
    products: ProductData[],
    style: string,
    maxItems: number
  ): Promise<SelectedFurniture[]> {
    const model = this.genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
    });

    // 商品リストをJSON形式で準備
    const productList = products.map((p) => ({
      id: p.productId,
      name: p.name,
      category: p.category,
      price: p.price,
      description: p.description,
      keywords: p.keywords,
    }));

    const prompt = `あなたはプロのインテリアコーディネーターです。
提供された部屋画像を分析し、この部屋に最も合う家具を以下の商品リストから最大${maxItems}個選んでください。

## 選定基準
- スタイル: ${this.getStyleDescription(style)}
- 部屋の雰囲気や既存の家具との調和
- バランスの取れたカテゴリの組み合わせ（照明、ラグ、小物など異なるカテゴリから選ぶ）
- 実用性と見た目の両立

## 商品リスト
${JSON.stringify(productList, null, 2)}

## 出力形式
以下のJSON形式で出力してください。JSONのみを出力し、他のテキストは含めないでください。
{
  "selectedProducts": [
    {
      "id": "商品ID",
      "reason": "選定理由（日本語で簡潔に）"
    }
  ]
}`;

    try {
      const roomImageBase64 = roomImage.toString("base64");

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: roomImageBase64,
          },
        },
        { text: prompt },
      ]);

      const responseText = result.response.text();

      // JSONを抽出
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("Failed to parse JSON from response:", responseText);
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const selectedIds = parsed.selectedProducts || [];

      // 選定された商品のデータを組み立て
      const selectedFurniture: SelectedFurniture[] = [];
      for (const selected of selectedIds) {
        const product = products.find((p) => p.productId === selected.id);
        if (product) {
          // レビュー情報を取得
          const reviewAverage = product.reviewAverage || 0;
          const reviewCount = product.reviewCount || 0;
          const reviewInfo = reviewCount > 0
            ? `★${reviewAverage.toFixed(1)} (${reviewCount}件のレビュー)`
            : "";

          selectedFurniture.push({
            productId: product.productId,
            name: product.name,
            category: product.category || "",
            imageUrl: product.imageUrls?.[0] || product.thumbnailUrl || "",
            affiliateUrl: product.affiliateUrl || "",
            price: product.price || 0,
            reason: reviewInfo, // レビュー情報を表示
          });
        }
      }

      console.log(`Selected ${selectedFurniture.length} furniture items`);
      return selectedFurniture;
    } catch (error) {
      console.error("Error in Gemini selection:", error);
      return [];
    }
  }

  /**
   * スタイルの説明を取得
   */
  private getStyleDescription(style: string): string {
    const descriptions: Record<string, string> = {
      scandinavian: "北欧スタイル（シンプルで温かみのある、明るい木材と白を基調）",
      modern: "モダンスタイル（洗練されたミニマルなデザイン、クリーンなライン）",
      vintage: "ヴィンテージスタイル（レトロな魅力、アンティーク調の温かさ）",
      industrial: "インダストリアルスタイル（無骨でクール、金属とコンクリート調）",
    };
    return descriptions[style] || style;
  }

  // 既存のメソッド（互換性のため維持）
  async detectFurniture(image: Buffer): Promise<DetectedFurniture[]> {
    console.log("Detecting furniture in image, size:", image.length);
    // 将来の実装用
    return [];
  }

  async recommendProducts(
    detectedFurniture: DetectedFurniture[],
    catalogEmbeddings?: number[][]
  ): Promise<FurnitureRecommendation[]> {
    console.log("Recommending products for detected furniture:", detectedFurniture.length);
    // 将来の実装用
    return [];
  }

  /**
   * 生成された画像を分析して家具を検出し、カタログから類似商品を検索
   */
  async analyzeGeneratedImageAndMatchProducts(
    request: ImageAnalysisRequest
  ): Promise<SelectedFurniture[]> {
    const { generatedImage, style } = request;
    const db = admin.firestore();

    try {
      // 1. 生成画像を分析して家具を検出
      const detectedItems = await this.detectFurnitureInImage(generatedImage);
      console.log(`Detected ${detectedItems.length} furniture items in generated image`);

      if (detectedItems.length === 0) {
        return [];
      }

      // 2. 検出された各アイテムに対してカタログから類似商品を検索
      const matchedProducts: SelectedFurniture[] = [];
      const usedProductIds = new Set<string>(); // 重複防止用

      // 番号順にソート
      const sortedItems = [...detectedItems].sort((a, b) => (a.number || 99) - (b.number || 99));

      for (const item of sortedItems) {
        const products = await this.searchProductsByDescription(db, item, style);

        // 重複していない商品を探す
        for (const product of products) {
          if (!usedProductIds.has(product.productId)) {
            usedProductIds.add(product.productId);

            // レビュー情報を取得
            const reviewAverage = (product as any).reviewAverage || 0;
            const reviewCount = (product as any).reviewCount || 0;
            const reviewInfo = reviewCount > 0
              ? `★${reviewAverage.toFixed(1)} (${reviewCount}件のレビュー)`
              : "";

            matchedProducts.push({
              productId: product.productId,
              name: product.name,
              category: product.category || item.category,
              imageUrl: product.imageUrls?.[0] || product.thumbnailUrl || "",
              affiliateUrl: product.affiliateUrl || "",
              price: product.price || 0,
              reason: reviewInfo,
              // @ts-ignore - 番号を追加
              itemNumber: item.number || matchedProducts.length + 1,
            });
            break; // このカテゴリからは1つだけ選択
          }
        }
      }

      console.log(`Matched ${matchedProducts.length} unique products from catalog`);
      return matchedProducts;
    } catch (error) {
      console.error("Error analyzing generated image:", error);
      return [];
    }
  }

  /**
   * 生成された画像から家具を検出
   */
  private async detectFurnitureInImage(
    image: Buffer
  ): Promise<Array<{ number: number; category: string; description: string; color: string; style: string }>> {
    const model = this.genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
    });

    const prompt = `この部屋の画像を分析して、配置されている家具・インテリアアイテムをすべてリストアップしてください。

## 重要
画像内に①②③などの番号ラベルが付いているアイテムがある場合は、その番号も記録してください。
番号がない場合は、左上から右下の順に1から番号を振ってください。

## 検出対象
- 照明器具（シーリングライト、ペンダントライト、フロアランプ、テーブルランプなど）
- ラグ・カーペット
- クッション・枕
- 壁掛けアイテム（絵画、鏡、時計、アートなど）
- 観葉植物・フェイクグリーン
- 小型家具（サイドテーブル、スツール、シェルフなど）
- カーテン・ブラインド
- その他のインテリア小物

## 出力形式
以下のJSON形式で出力してください。JSONのみを出力し、他のテキストは含めないでください。
{
  "items": [
    {
      "number": 1,
      "category": "照明",
      "description": "白いシェードの北欧風ペンダントライト",
      "color": "白",
      "style": "北欧"
    }
  ]
}`;

    try {
      const imageBase64 = image.toString("base64");
      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: imageBase64,
          },
        },
        { text: prompt },
      ]);

      const responseText = result.response.text();
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("Failed to parse JSON from response:", responseText);
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.items || [];
    } catch (error) {
      console.error("Error detecting furniture in image:", error);
      return [];
    }
  }

  /**
   * 検出されたアイテムの説明に基づいて商品を検索
   */
  private async searchProductsByDescription(
    db: admin.firestore.Firestore,
    item: { category: string; description: string; color: string; style: string },
    targetStyle: string
  ): Promise<ProductData[]> {
    const productsRef = db.collection("products");

    // カテゴリに対応するキーワードを取得
    const categoryMap: Record<string, string> = {
      照明: "lighting",
      ラグ: "rug",
      カーペット: "rug",
      クッション: "cushion",
      壁掛け: "wall_decor",
      アート: "wall_decor",
      ミラー: "wall_decor",
      観葉植物: "plants",
      フェイクグリーン: "plants",
      サイドテーブル: "small_furniture",
      スツール: "small_furniture",
      シェルフ: "small_furniture",
      カーテン: "curtain",
    };

    // カテゴリキーワードを特定
    let searchCategory = item.category;
    for (const [key, value] of Object.entries(categoryMap)) {
      if (item.category.includes(key) || item.description.includes(key)) {
        const categories = TARGET_ITEM_CATEGORIES[value];
        if (categories && categories.length > 0) {
          searchCategory = categories[0];
          break;
        }
      }
    }

    // スタイルキーワード
    const styleKeywords = STYLE_KEYWORDS[targetStyle] || [];

    try {
      // カテゴリで検索
      const snapshot = await productsRef
        .where("isActive", "==", true)
        .where("keywords", "array-contains", searchCategory)
        .limit(10)
        .get();

      const products: ProductData[] = [];
      snapshot.docs.forEach((doc) => {
        const data = doc.data() as ProductData;
        data.productId = doc.id;

        // スタイルとの一致度でスコアリング
        const keywords = data.keywords || [];
        const styleMatch = styleKeywords.filter((kw) =>
          keywords.some((k) => k.includes(kw) || kw.includes(k))
        ).length;

        // 色の一致
        const colorMatch = item.color && data.name?.includes(item.color) ? 1 : 0;

        // スコアが高いものを優先
        (data as any).score = styleMatch + colorMatch;
        products.push(data);
      });

      // スコア順にソート
      products.sort((a, b) => ((b as any).score || 0) - ((a as any).score || 0));
      return products;
    } catch (error) {
      console.error("Error searching products by description:", error);
      return [];
    }
  }

  getModelName(): string {
    return this.modelName;
  }
}

// 商品データの型定義
interface ProductData {
  productId: string;
  name: string;
  description?: string;
  category?: string;
  price?: number;
  imageUrls?: string[];
  thumbnailUrl?: string;
  affiliateUrl?: string;
  keywords?: string[];
  isActive?: boolean;
  reviewAverage?: number;
  reviewCount?: number;
}
