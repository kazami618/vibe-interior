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

// ターゲットアイテムとカテゴリのマッピング（旧形式：英語キー）
const TARGET_ITEM_CATEGORIES: Record<string, string[]> = {
  lighting: ["照明", "ライト", "ランプ", "シーリングライト", "フロアライト", "テーブルライト"],
  rug: ["ラグ", "カーペット", "マット"],
  cushion: ["クッション", "枕", "ピロー"],
  wall_decor: ["壁掛け", "アート", "ポスター", "ミラー", "時計", "ウォールデコ"],
  plants: ["観葉植物", "フェイクグリーン", "プランター", "植物"],
  small_furniture: ["サイドテーブル", "スツール", "チェスト", "収納", "シェルフ", "ラック"],
  curtain: ["カーテン", "ブラインド", "シェード"],
};

// 新形式：日本語カテゴリ名から検索キーワードへのマッピング
const JAPANESE_CATEGORY_KEYWORDS: Record<string, string[]> = {
  // 大型家具
  ソファ: ["ソファ", "ソファー", "カウチ"],
  ベッド: ["ベッド", "ベッドフレーム"],
  テーブル: ["テーブル", "センターテーブル", "ローテーブル"],
  チェア: ["チェア", "椅子", "イス"],
  ダイニングテーブル: ["ダイニングテーブル", "食卓"],
  ダイニングチェア: ["ダイニングチェア", "食卓椅子"],
  座椅子: ["座椅子", "フロアチェア"],
  こたつ: ["こたつ", "炬燵"],
  // 収納・家具
  収納: ["収納", "ラック", "シェルフ", "棚"],
  サイドテーブル: ["サイドテーブル", "ナイトテーブル"],
  ワードローブ: ["ワードローブ", "クローゼット"],
  ドレッサー: ["ドレッサー", "化粧台"],
  ハンガーラック: ["ハンガーラック", "コートハンガー"],
  収納小物: ["収納ボックス", "収納ケース", "バスケット"],
  ゴミ箱: ["ゴミ箱", "ダストボックス"],
  // 照明
  照明: ["照明", "ライト", "ランプ", "シーリングライト"],
  間接照明: ["間接照明", "フロアランプ", "テーブルランプ", "フロアライト"],
  ダイニング照明: ["ペンダントライト", "ダイニング照明"],
  // ファブリック
  ラグ: ["ラグ", "カーペット"],
  ダイニングラグ: ["ラグ", "ダイニングラグ"],
  玄関マット: ["玄関マット", "エントランスマット"],
  カーテン: ["カーテン", "ドレープ"],
  クッション: ["クッション", "ピロー"],
  ブランケット: ["ブランケット", "膝掛け", "毛布"],
  寝具: ["寝具", "布団", "掛け布団", "シーツ"],
  // 装飾
  観葉植物: ["観葉植物", "フェイクグリーン", "グリーン"],
  壁掛け: ["壁掛け", "アート", "ポスター", "額縁"],
  ミラー: ["ミラー", "鏡", "姿見"],
  // 内装
  壁紙: ["壁紙", "ウォールステッカー"],
  フロアタイル: ["フロアタイル", "フロアシート"],
  // その他
  インテリア家電: ["加湿器", "空気清浄機", "サーキュレーター", "扇風機"],
  マットレス: ["マットレス"],
};

// 除外キーワード（これらを含む商品は該当カテゴリから除外）
const CATEGORY_EXCLUDE_KEYWORDS: Record<string, string[]> = {
  ベッド: ["ペット", "犬", "猫", "サマーベッド", "アウトドア", "キャンプ"],
  クッション: ["ペット", "犬", "猫", "ペットベッド", "犬用", "猫用"],
  照明: ["キャンプ", "アウトドア", "懐中電灯", "ヘッドライト", "車"],
  間接照明: ["キャンプ", "アウトドア", "懐中電灯", "ヘッドライト", "車", "防災", "登山"],
  ソファ: ["ペット", "犬", "猫", "車"],
  テーブル: ["キャンプ", "アウトドア", "折りたたみ"],
  カーテン: ["カーテンレール", "レール", "タッセル", "フック", "ランナー"],
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
    const foundCategories = new Set<string>();

    // ターゲットアイテムごとに検索キーワードをマッピング
    const targetCategoryMap: Map<string, string[]> = new Map();
    for (const item of targetItems) {
      const keywords: string[] = [];

      // 旧形式（英語キー）をチェック
      const englishCategories = TARGET_ITEM_CATEGORIES[item];
      if (englishCategories) {
        keywords.push(...englishCategories);
      }

      // 新形式（日本語キー）をチェック
      const japaneseKeywords = JAPANESE_CATEGORY_KEYWORDS[item];
      if (japaneseKeywords) {
        keywords.push(...japaneseKeywords);
      }

      // どちらにもマッチしない場合は、item自体をキーワードとして使用
      if (keywords.length === 0) {
        keywords.push(item);
      }

      targetCategoryMap.set(item, keywords);
    }

    // スタイルに関連するキーワード
    const styleKeywords = STYLE_KEYWORDS[style] || [];

    // 商品が除外対象かチェックする関数
    const shouldExcludeProduct = (product: ProductData, targetCategory: string): boolean => {
      const excludeKeywords = CATEGORY_EXCLUDE_KEYWORDS[targetCategory] || [];
      if (excludeKeywords.length === 0) return false;

      const productText = `${product.name || ""} ${product.category || ""} ${getProductKeywords(product).join(" ")}`.toLowerCase();
      return excludeKeywords.some((kw) => productText.includes(kw.toLowerCase()));
    };

    console.log(`Searching products for target items: ${targetItems.join(', ')}`);

    try {
      // 各ターゲットアイテムに対して商品を検索（カテゴリごとに確実に検索）
      for (const [targetItem, searchKeywords] of targetCategoryMap) {
        let foundForThisCategory = false;

        // 1. まずcategoryフィールドで完全一致検索（最も正確）
        for (const keyword of [targetItem, ...searchKeywords]) {
          if (foundForThisCategory) break;

          const snapshot = await productsRef
            .where("status", "==", "approved")
            .where("category", "==", keyword)
            .limit(20)
            .get();

          // 除外キーワードでフィルタリング
          const validDocs = snapshot.docs.filter((doc) => {
            const data = doc.data() as ProductData;
            return !shouldExcludeProduct(data, targetItem);
          });

          if (validDocs.length > 0) {
            console.log(`Found ${validDocs.length} products for "${targetItem}" via category="${keyword}" (after exclusion filter)`);
            foundForThisCategory = true;
            foundCategories.add(targetItem);

            validDocs.forEach((doc) => {
              const data = doc.data() as ProductData;
              data.productId = doc.id;
              (data as any).targetCategory = targetItem;
              // カテゴリ完全一致は高スコア
              const keywords = getProductKeywords(data);
              const styleMatch = styleKeywords.filter((kw) =>
                keywords.some((k) => k.includes(kw) || kw.includes(k))
              ).length;
              (data as any).styleScore = styleMatch + 10; // カテゴリ一致ボーナス
              (data as any).categoryMatch = true;
              allProducts.push(data);
            });
          }
        }

        // 2. カテゴリで見つからなければkeywordsで検索（カテゴリ一致+除外フィルタ）
        if (!foundForThisCategory) {
          for (const keyword of searchKeywords) {
            if (foundForThisCategory) break;

            const snapshot = await productsRef
              .where("status", "==", "approved")
              .where("keywords", "array-contains", keyword)
              .limit(30)
              .get();

            // カテゴリ一致 + 除外キーワードでフィルタ
            const matchingDocs = snapshot.docs.filter((doc) => {
              const data = doc.data() as ProductData;
              const category = data.category || "";
              // 除外チェック
              if (shouldExcludeProduct(data, targetItem)) return false;
              // ターゲットと商品カテゴリが関連しているかチェック
              return searchKeywords.some((kw) =>
                category.includes(kw) || kw.includes(category) || category === targetItem
              );
            });

            if (matchingDocs.length > 0) {
              console.log(`Found ${matchingDocs.length} products for "${targetItem}" via keyword="${keyword}" (after filters)`);
              foundForThisCategory = true;
              foundCategories.add(targetItem);

              matchingDocs.forEach((doc) => {
                const data = doc.data() as ProductData;
                data.productId = doc.id;
                (data as any).targetCategory = targetItem;
                const keywords = getProductKeywords(data);
                const styleMatch = styleKeywords.filter((kw) =>
                  keywords.some((k) => k.includes(kw) || kw.includes(k))
                ).length;
                (data as any).styleScore = styleMatch + 5; // キーワード一致ボーナス
                (data as any).categoryMatch = true;
                allProducts.push(data);
              });
            }
          }
        }

        // 3. それでも見つからなければkeywordsで検索（除外フィルタのみ、最終手段）
        if (!foundForThisCategory) {
          for (const keyword of searchKeywords) {
            if (foundForThisCategory) break;

            const snapshot = await productsRef
              .where("status", "==", "approved")
              .where("keywords", "array-contains", keyword)
              .limit(20)
              .get();

            // 除外キーワードでフィルタ
            const validDocs = snapshot.docs.filter((doc) => {
              const data = doc.data() as ProductData;
              return !shouldExcludeProduct(data, targetItem);
            });

            if (validDocs.length > 0) {
              console.log(`Found ${validDocs.length} products for "${targetItem}" via keyword="${keyword}" (exclusion filter only)`);
              foundForThisCategory = true;
              foundCategories.add(targetItem);

              validDocs.forEach((doc) => {
                const data = doc.data() as ProductData;
                data.productId = doc.id;
                (data as any).targetCategory = targetItem;
                const keywords = getProductKeywords(data);
                const styleMatch = styleKeywords.filter((kw) =>
                  keywords.some((k) => k.includes(kw) || kw.includes(k))
                ).length;
                (data as any).styleScore = styleMatch;
                (data as any).categoryMatch = false;
                allProducts.push(data);
              });
            }
          }
        }

        if (!foundForThisCategory) {
          console.warn(`No products found for target item: ${targetItem} (searched with keywords: ${searchKeywords.join(', ')})`);
        }
      }

      // 重複を除去
      const uniqueProducts = Array.from(
        new Map(allProducts.map((p) => [p.productId, p])).values()
      );

      console.log(`Found ${uniqueProducts.length} unique products for ${foundCategories.size}/${targetItems.length} categories`);

      // ターゲットカテゴリごとに最低1つは含まれるようにソート
      // まず各カテゴリから1つずつ選び、残りをスコア順で追加
      const sortedProducts: ProductData[] = [];
      const usedIds = new Set<string>();

      // 各カテゴリから最もスコアの高いものを1つずつ選択
      for (const targetItem of targetItems) {
        const categoryProducts = uniqueProducts.filter(
          (p) => (p as any).targetCategory === targetItem && !usedIds.has(p.productId)
        );
        if (categoryProducts.length > 0) {
          // スタイルスコア + レビュースコアでソート（レビューがある商品を優先）
          categoryProducts.sort((a, b) => {
            const styleScoreA = (a as any).styleScore || 0;
            const styleScoreB = (b as any).styleScore || 0;
            // レビューがある商品にボーナスを付与（レビュー件数100件以上で+3、10件以上で+2、1件以上で+1）
            const reviewCountA = getProductReview(a).count;
            const reviewCountB = getProductReview(b).count;
            const reviewBonusA = reviewCountA >= 100 ? 3 : reviewCountA >= 10 ? 2 : reviewCountA > 0 ? 1 : 0;
            const reviewBonusB = reviewCountB >= 100 ? 3 : reviewCountB >= 10 ? 2 : reviewCountB > 0 ? 1 : 0;
            return (styleScoreB + reviewBonusB) - (styleScoreA + reviewBonusA);
          });
          const bestProduct = categoryProducts[0];
          sortedProducts.push(bestProduct);
          usedIds.add(bestProduct.productId);
        }
      }

      // 残りの商品を追加
      for (const product of uniqueProducts) {
        if (!usedIds.has(product.productId)) {
          sortedProducts.push(product);
          usedIds.add(product.productId);
        }
      }

      return sortedProducts.slice(0, 50); // 最大50件に制限
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

    // 商品リストをJSON形式で準備（ターゲットカテゴリ情報も含める）
    const productList = products.map((p) => ({
      id: p.productId,
      name: p.name,
      category: p.category,
      targetCategory: (p as any).targetCategory || p.category, // ユーザーが選択したカテゴリ
      price: p.price,
      description: p.description,
      keywords: p.keywords,
    }));

    // ターゲットカテゴリの一覧を取得
    const targetCategories = [...new Set(products.map((p) => (p as any).targetCategory).filter(Boolean))];

    const prompt = `あなたはプロのインテリアコーディネーターです。
提供された部屋画像を分析し、この部屋に最も合う家具を以下の商品リストから選んでください。

## 最重要ルール（必ず守ること）
1. ユーザーが以下のカテゴリをリクエストしています。**各カテゴリから必ず1つ以上**選んでください：
${targetCategories.map((cat) => `   - ${cat}`).join('\n')}

2. **商品の"category"フィールドがリクエストカテゴリと一致するものを優先**してください
   - 例：「ベッド」リクエストなら category="ベッド" の商品を選ぶ
   - 例：「カーテン」リクエストなら category="カーテン" の商品を選ぶ

3. 商品名に別のカテゴリ名が含まれていても、categoryフィールドが異なる場合は選ばないでください
   - 例：「ペットベッド」(category="クッション")は「ベッド」リクエストには不適切

## 選定基準
- スタイル: ${this.getStyleDescription(style)}
- 部屋の雰囲気との調和

## 制約
- 天井照明（シーリングライト、ペンダントライト）は1部屋に1つまで
- 最大${maxItems}個まで

## 商品リスト
${JSON.stringify(productList, null, 2)}

## 出力形式（JSONのみ）
{
  "selectedProducts": [
    { "id": "商品ID", "reason": "選定理由" }
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
      let hasCeilingLight = false; // 天井照明の制限チェック用
      const coveredCategories = new Set<string>();

      for (const selected of selectedIds) {
        const product = products.find((p) => p.productId === selected.id);
        if (product) {
          // 天井照明のチェック（シーリングライト、ペンダントライトは1部屋に1つまで）
          const isCeilingLight = this.isCeilingLightProduct(product);
          if (isCeilingLight) {
            if (hasCeilingLight) {
              console.log(`Skipping duplicate ceiling light: ${product.name}`);
              continue; // 2つ目以降の天井照明はスキップ
            }
            hasCeilingLight = true;
          }

          // レビュー情報を取得（新旧スキーマ対応）
          const review = getProductReview(product);
          const reviewInfo = review.count > 0
            ? `★${review.average.toFixed(1)} (${review.count}件のレビュー)`
            : "";

          const targetCategory = (product as any).targetCategory || product.category || "";
          coveredCategories.add(targetCategory);

          const productImages = getProductImages(product);
          selectedFurniture.push({
            productId: product.productId,
            name: product.name,
            category: targetCategory,
            imageUrl: productImages[0] || "",
            affiliateUrl: getAffiliateUrl(product),
            price: product.price || 0,
            reason: reviewInfo,
            reviewAverage: review.average,
            reviewCount: review.count,
          });
        }
      }

      // フォールバック：AIが選ばなかったカテゴリから手動で追加
      const allTargetCategories = [...new Set(products.map((p) => (p as any).targetCategory).filter(Boolean))];
      const missingCategories = allTargetCategories.filter((cat) => !coveredCategories.has(cat));

      if (missingCategories.length > 0) {
        console.log(`AI missed categories: ${missingCategories.join(', ')}, adding fallback products`);
        const usedProductIds = new Set(selectedFurniture.map((f) => f.productId));

        for (const missingCat of missingCategories) {
          // このカテゴリの商品を探す（カテゴリ一致を優先）
          const categoryProducts = products.filter(
            (p) => (p as any).targetCategory === missingCat && !usedProductIds.has(p.productId)
          );

          if (categoryProducts.length > 0) {
            // カテゴリ一致 → スタイルスコアの順でソート
            categoryProducts.sort((a, b) => {
              const aMatch = (a as any).categoryMatch ? 100 : 0;
              const bMatch = (b as any).categoryMatch ? 100 : 0;
              const aScore = aMatch + ((a as any).styleScore || 0);
              const bScore = bMatch + ((b as any).styleScore || 0);
              return bScore - aScore;
            });
            const fallbackProduct = categoryProducts[0];

            // 天井照明チェック
            const isCeilingLight = this.isCeilingLightProduct(fallbackProduct);
            if (isCeilingLight && hasCeilingLight) {
              console.log(`Skipping fallback ceiling light: ${fallbackProduct.name}`);
              continue;
            }
            if (isCeilingLight) hasCeilingLight = true;

            const fbReview = getProductReview(fallbackProduct);
            const reviewInfo = fbReview.count > 0
              ? `★${fbReview.average.toFixed(1)} (${fbReview.count}件のレビュー)`
              : "";

            const fbImages = getProductImages(fallbackProduct);
            selectedFurniture.push({
              productId: fallbackProduct.productId,
              name: fallbackProduct.name,
              category: missingCat,
              imageUrl: fbImages[0] || "",
              affiliateUrl: getAffiliateUrl(fallbackProduct),
              price: fallbackProduct.price || 0,
              reason: reviewInfo,
              reviewAverage: fbReview.average,
              reviewCount: fbReview.count,
            });
            usedProductIds.add(fallbackProduct.productId);
            console.log(`Added fallback product for ${missingCat}: ${fallbackProduct.name} (categoryMatch: ${(fallbackProduct as any).categoryMatch})`);
          }
        }
      }

      console.log(`Selected ${selectedFurniture.length} furniture items (ceiling light limit enforced: ${hasCeilingLight})`);
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

  /**
   * 商品が天井照明かどうかを判定
   * シーリングライト、ペンダントライトは1部屋に1つまで
   * フロアライト、テーブルライトは別途追加可能
   */
  private isCeilingLightProduct(product: ProductData): boolean {
    const ceilingLightKeywords = [
      "シーリングライト",
      "シーリング",
      "ペンダントライト",
      "ペンダント",
      "天井照明",
      "天井",
    ];

    // 除外キーワード（これらが含まれる場合は天井照明ではない）
    const excludeKeywords = [
      "フロアライト",
      "フロアランプ",
      "テーブルライト",
      "テーブルランプ",
      "デスクライト",
      "スタンドライト",
      "間接照明",
      "スポットライト",
    ];

    const name = product.name || "";
    const category = product.category || "";
    const keywords = getProductKeywords(product);
    const allText = `${name} ${category} ${keywords.join(" ")}`.toLowerCase();

    // 除外キーワードに該当する場合は天井照明ではない
    for (const exclude of excludeKeywords) {
      if (allText.includes(exclude.toLowerCase())) {
        return false;
      }
    }

    // 天井照明キーワードに該当するかチェック
    for (const keyword of ceilingLightKeywords) {
      if (allText.includes(keyword.toLowerCase())) {
        return true;
      }
    }

    return false;
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
    const { generatedImage, style, targetCategories } = request as any;
    const db = admin.firestore();

    try {
      // 1. 生成画像を分析して家具を検出
      const detectedItems = await this.detectFurnitureInImage(generatedImage);
      console.log(`Detected ${detectedItems.length} furniture items in generated image`);

      if (detectedItems.length === 0) {
        return [];
      }

      // 2. 検出されたカテゴリを整理（重複するカテゴリは1つにまとめる）
      const categoryGroups = new Map<string, typeof detectedItems[0]>();
      const processedCategories = new Set<string>();

      for (const item of detectedItems) {
        const normalizedCategory = this.normalizeCategory(item.category);

        // 同じカテゴリのアイテムは最初のものだけを使用
        if (!processedCategories.has(normalizedCategory)) {
          processedCategories.add(normalizedCategory);
          categoryGroups.set(normalizedCategory, item);
        }
      }

      console.log(`Unique categories: ${Array.from(categoryGroups.keys()).join(', ')}`);

      // 3. 検出された各カテゴリに対してカタログから類似商品を検索
      const matchedProducts: SelectedFurniture[] = [];
      const usedProductIds = new Set<string>(); // 重複防止用
      let itemNumber = 1;

      // 番号順にソートしたアイテムを処理
      const sortedCategories = Array.from(categoryGroups.entries())
        .sort((a, b) => (a[1].number || 99) - (b[1].number || 99));

      for (const [category, item] of sortedCategories) {
        const products = await this.searchProductsByDescription(db, item, style);

        // 重複していない商品を探す
        for (const product of products) {
          if (!usedProductIds.has(product.productId)) {
            usedProductIds.add(product.productId);

            // レビュー情報を取得（新旧スキーマ対応）
            const matchReview = getProductReview(product);
            const reviewInfo = matchReview.count > 0
              ? `★${matchReview.average.toFixed(1)} (${matchReview.count}件のレビュー)`
              : "";

            const matchImages = getProductImages(product);
            matchedProducts.push({
              productId: product.productId,
              name: product.name,
              category: product.category || item.category,
              imageUrl: matchImages[0] || "",
              affiliateUrl: getAffiliateUrl(product),
              price: product.price || 0,
              reason: reviewInfo,
              // @ts-ignore - 番号と位置を追加
              itemNumber: itemNumber,
              // @ts-ignore
              position: item.position,
            });
            itemNumber++;
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
   * カテゴリ名を正規化（類似カテゴリをグループ化）
   */
  private normalizeCategory(category: string): string {
    const categoryNormalization: Record<string, string> = {
      // 照明系
      "シーリングライト": "照明",
      "ペンダントライト": "照明",
      "フロアランプ": "フロアライト",
      "テーブルランプ": "テーブルライト",
      "ライト": "照明",
      // ラグ系
      "カーペット": "ラグ",
      "マット": "ラグ",
      // 植物系
      "フェイクグリーン": "観葉植物",
      "グリーン": "観葉植物",
      "植物": "観葉植物",
      // アート系
      "絵画": "壁掛け",
      "ポスター": "壁掛け",
      "アート": "壁掛け",
    };

    return categoryNormalization[category] || category;
  }

  /**
   * 生成された画像から家具を検出（位置情報付き）
   */
  private async detectFurnitureInImage(
    image: Buffer
  ): Promise<Array<{ number: number; category: string; description: string; color: string; style: string; position?: { x: number; y: number } }>> {
    const model = this.genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
    });

    const prompt = `この部屋の画像を分析して、配置されている家具・インテリアアイテムをすべてリストアップしてください。

## 重要
左上から右下の順に1から番号を振ってください。
各アイテムの位置を、画像の左上を(0,0)、右下を(100,100)とした相対座標（パーセンテージ）で記録してください。

## 検出対象（すべての家具とインテリアアイテム）
- 大型家具（ソファ、ベッド、ダイニングテーブル、デスク、テレビ台など）
- 椅子類（ダイニングチェア、オフィスチェア、アームチェア、スツールなど）
- 照明器具（シーリングライト、ペンダントライト、フロアランプ、テーブルランプなど）
- ラグ・カーペット
- クッション・枕
- 壁掛けアイテム（絵画、鏡、時計、アートなど）
- 観葉植物・フェイクグリーン
- 収納家具（サイドテーブル、チェスト、シェルフ、本棚など）
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
      "style": "北欧",
      "position": { "x": 50, "y": 15 }
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

    // カテゴリに対応する検索キーワードを取得
    const categorySearchMap: Record<string, string[]> = {
      // 大型家具
      ソファ: ["ソファ", "ソファー", "カウチ"],
      ベッド: ["ベッド", "ベッドフレーム"],
      テーブル: ["テーブル", "センターテーブル", "ローテーブル"],
      ダイニングテーブル: ["ダイニングテーブル", "テーブル"],
      デスク: ["デスク", "机"],
      テレビ台: ["テレビ台", "テレビボード", "AVボード"],
      // 椅子類
      チェア: ["チェア", "椅子"],
      ダイニングチェア: ["ダイニングチェア", "チェア"],
      アームチェア: ["アームチェア", "チェア"],
      スツール: ["スツール"],
      // 照明
      照明: ["照明", "ライト", "ランプ"],
      シーリングライト: ["シーリングライト", "照明"],
      ペンダントライト: ["ペンダントライト", "照明"],
      フロアランプ: ["フロアランプ", "フロアライト"],
      テーブルランプ: ["テーブルランプ", "テーブルライト"],
      // ファブリック
      ラグ: ["ラグ", "カーペット"],
      カーペット: ["ラグ", "カーペット"],
      クッション: ["クッション"],
      カーテン: ["カーテン"],
      ブラインド: ["ブラインド"],
      // 装飾
      壁掛け: ["壁掛け", "アート", "ポスター"],
      アート: ["アート", "壁掛け"],
      ミラー: ["ミラー", "鏡"],
      時計: ["時計"],
      観葉植物: ["観葉植物", "フェイクグリーン", "グリーン"],
      フェイクグリーン: ["フェイクグリーン", "観葉植物"],
      植物: ["観葉植物", "フェイクグリーン"],
      // 収納
      サイドテーブル: ["サイドテーブル"],
      チェスト: ["チェスト", "収納"],
      シェルフ: ["シェルフ", "棚"],
      本棚: ["本棚", "シェルフ"],
      収納: ["収納", "ラック"],
    };

    // カテゴリキーワードを特定
    let searchKeywords: string[] = [];
    for (const [key, keywords] of Object.entries(categorySearchMap)) {
      if (item.category.includes(key) || item.description.includes(key) || key.includes(item.category)) {
        searchKeywords = keywords;
        break;
      }
    }

    // マッチしない場合はカテゴリ名自体を使用
    if (searchKeywords.length === 0) {
      searchKeywords = [item.category];
    }

    const searchCategory = searchKeywords[0];

    // スタイルキーワード
    const styleKeywords = STYLE_KEYWORDS[targetStyle] || [];

    try {
      // カテゴリで検索
      const snapshot = await productsRef
        .where("status", "==", "approved")
        .where("keywords", "array-contains", searchCategory)
        .limit(10)
        .get();

      const products: ProductData[] = [];
      snapshot.docs.forEach((doc) => {
        const data = doc.data() as ProductData;
        data.productId = doc.id;

        // スタイルとの一致度でスコアリング
        const keywords = getProductKeywords(data);
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

  /**
   * 生成された画像から家具の位置を検出（公開メソッド）
   * @param image 生成された画像
   * @returns 検出されたアイテムの位置情報
   */
  async detectFurniturePositions(
    image: Buffer
  ): Promise<Array<{ number: number; category: string; position: { x: number; y: number } }>> {
    const model = this.genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
    });

    const prompt = `この部屋の画像を分析して、配置されているすべての家具・インテリアアイテムの位置を特定してください。

## 重要
- 各アイテムの中心位置を、画像の左上を(0,0)、右下を(100,100)とした相対座標（パーセンテージ）で記録してください。
- 左上から右下の順に1から番号を振ってください。
- 大型家具も小型家具もすべて検出してください。

## 検出対象（すべて必須）
### 大型家具
- ソファ、カウチ
- ベッド、ベッドフレーム
- ダイニングテーブル、センターテーブル、ローテーブル
- テレビ台、テレビボード
- デスク

### 椅子類
- ダイニングチェア、オフィスチェア
- アームチェア、ラウンジチェア
- スツール

### 照明器具
- シーリングライト、ペンダントライト
- フロアランプ、テーブルランプ

### ファブリック・装飾
- ラグ・カーペット
- クッション・枕
- カーテン・ブラインド

### その他
- 壁掛けアイテム（絵画、鏡、時計、アートなど）
- 観葉植物・フェイクグリーン
- サイドテーブル、チェスト、シェルフなどの収納家具

## 出力形式
以下のJSON形式で出力してください。JSONのみを出力し、他のテキストは含めないでください。
{
  "items": [
    { "number": 1, "category": "照明", "position": { "x": 50, "y": 10 } },
    { "number": 2, "category": "ソファ", "position": { "x": 40, "y": 60 } },
    { "number": 3, "category": "ベッド", "position": { "x": 60, "y": 50 } },
    { "number": 4, "category": "ラグ", "position": { "x": 50, "y": 80 } }
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
        console.error("Failed to parse JSON from position detection:", responseText);
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return (parsed.items || []).map((item: any) => ({
        number: item.number,
        category: item.category,
        position: item.position || { x: 50, y: 50 },
      }));
    } catch (error) {
      console.error("Error detecting furniture positions:", error);
      return [];
    }
  }
}

// 購入リンクの型定義（新スキーマ）
interface PurchaseLinkData {
  source: 'amazon' | 'rakuten' | 'official' | 'other';
  url: string;
  affiliateUrl?: string;
  price?: number;
  asin?: string;
  rakutenItemCode?: string;
  reviewAverage?: number;
  reviewCount?: number;
}

// 商品データの型定義
interface ProductData {
  productId: string;
  name: string;
  description?: string;
  category?: string;
  price?: number;
  imageUrls?: string[];
  images?: string[]; // 新スキーマ
  thumbnailUrl?: string;
  affiliateUrl?: string;
  purchaseLinks?: PurchaseLinkData[]; // 新スキーマ
  keywords?: string[];
  tags?: string[]; // 新スキーマ
  isActive?: boolean;
  status?: 'candidate' | 'approved' | 'rejected'; // 新スキーマ
  reviewAverage?: number;
  reviewCount?: number;
}

/**
 * ProductData からアフィリエイトURLを取得（新旧スキーマ対応）
 */
function getAffiliateUrl(product: ProductData): string {
  // 新スキーマ: purchaseLinks から取得
  if (product.purchaseLinks?.length) {
    // Amazon優先、次に楽天
    const amazonLink = product.purchaseLinks.find(l => l.source === 'amazon');
    if (amazonLink?.affiliateUrl) return amazonLink.affiliateUrl;
    const rakutenLink = product.purchaseLinks.find(l => l.source === 'rakuten');
    if (rakutenLink?.affiliateUrl) return rakutenLink.affiliateUrl;
    // affiliateUrlがなければurl
    const firstLink = product.purchaseLinks[0];
    return firstLink.affiliateUrl || firstLink.url || '';
  }
  // 旧スキーマ
  return product.affiliateUrl || '';
}

/**
 * ProductData から画像URLリストを取得（新旧スキーマ対応）
 */
function getProductImages(product: ProductData): string[] {
  if (product.images?.length) return product.images;
  if (product.imageUrls?.length) return product.imageUrls;
  if (product.thumbnailUrl) return [product.thumbnailUrl];
  return [];
}

/**
 * ProductData からレビュー情報を取得（新旧スキーマ対応）
 */
function getProductReview(product: ProductData): { average: number; count: number } {
  // 新スキーマ: purchaseLinks から最もレビュー数の多いものを取得
  if (product.purchaseLinks?.length) {
    let bestReview = { average: 0, count: 0 };
    for (const link of product.purchaseLinks) {
      if ((link.reviewCount || 0) > bestReview.count) {
        bestReview = {
          average: link.reviewAverage || 0,
          count: link.reviewCount || 0,
        };
      }
    }
    if (bestReview.count > 0) return bestReview;
  }
  // 旧スキーマ
  return {
    average: product.reviewAverage || 0,
    count: product.reviewCount || 0,
  };
}

/**
 * ProductData から検索用キーワードを取得（新旧スキーマ対応）
 */
function getProductKeywords(product: ProductData): string[] {
  return product.keywords || product.tags || [];
}
