/**
 * 画像生成サービス
 * ビジネスロジックを含む
 * RAGによる家具選定 → 画像生成 → 結果保存のフローを管理
 */

import * as admin from "firebase-admin";
import { getImageGenerationAdapter, getFurnitureRecommendationAdapter } from "../config";
import { FurnitureReference, GenerationOptions } from "../adapters/ImageGenerationAdapter";
import { SelectedFurniture } from "../adapters/FurnitureRecommendationAdapter";
import { validateDesign, logValidationResult } from "./DesignValidationService";

/**
 * バリデーションをバックグラウンドで実行（タイムアウト防止）
 */
function runValidationInBackground(
  imageBuffer: Buffer,
  furniture: Array<{ itemNumber: number; name: string; category: string; position?: { x: number; y: number } }>,
  designId: string,
  designRef: admin.firestore.DocumentReference
): void {
  // 非同期でバリデーション実行（awaitしない）
  (async () => {
    try {
      console.log(`Starting background validation for design: ${designId}`);
      const validationResult = await validateDesign(
        imageBuffer,
        furniture.map((f) => ({
          itemNumber: f.itemNumber,
          name: f.name,
          category: f.category,
          position: f.position,
        }))
      );
      logValidationResult(validationResult, designId);

      // バリデーション結果をFirestoreに保存
      await designRef.update({
        validation: {
          isValid: validationResult.isValid,
          issueCount: validationResult.issues.length,
          issues: validationResult.issues.map((issue) => ({
            type: issue.type,
            itemNumber: issue.itemNumber,
            productName: issue.productName,
            description: issue.description,
            severity: issue.severity,
          })),
          summary: validationResult.summary,
          validatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`Background validation completed for design: ${designId}`);
    } catch (error) {
      console.error(`Background validation failed for design ${designId}:`, error);
    }
  })();
}

export interface ImageGenerationRequest {
  userId: string;
  roomImageUrl: string;
  furnitureReferences: FurnitureReference[];
  options?: GenerationOptions;
}

export interface ImageGenerationResult {
  designId: string;
  generatedImageUrl: string;
  usedItemIds: string[];
  status: "completed" | "failed";
  errorMessage?: string;
}

const BUCKET_NAME = "vibe-interior-2026-f948c.firebasestorage.app";

/**
 * インテリアデザインを生成
 */
export async function generateInteriorDesign(
  request: ImageGenerationRequest
): Promise<ImageGenerationResult> {
  const db = admin.firestore();
  const storage = admin.storage();

  // デザインドキュメントのIDを事前に生成
  const designRef = db.collection("designs").doc();
  const designId = designRef.id;

  try {
    // 1. Firestoreにデザインドキュメントを作成（処理中ステータス）
    await designRef.set({
      designId,
      userId: request.userId,
      title: `デザイン ${new Date().toLocaleDateString("ja-JP")}`,
      originalImageUrl: request.roomImageUrl,
      generatedImageUrl: "",
      thumbnailUrl: "",
      aiModel: {
        imageGeneration: getImageGenerationAdapter().getModelName(),
        furnitureRecommendation: getFurnitureRecommendationAdapter().getModelName(),
      },
      generationOptions: request.options || {},
      usedItemIds: [],
      status: "processing",
      processingSteps: {
        imageUpload: "completed",
        furnitureRecommendation: "processing",
        imageGeneration: "pending",
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      isFavorite: false,
      viewCount: 0,
    });

    // 2. 元画像をダウンロード
    const bucket = storage.bucket(BUCKET_NAME);
    const roomImageFile = bucket.file(request.roomImageUrl);
    const [roomImageBuffer] = await roomImageFile.download();

    // 3. 家具選定（RAG）
    let selectedFurniture: SelectedFurniture[] = [];
    let furnitureReferences: FurnitureReference[] = request.furnitureReferences;

    // 新しいaddItemsを優先、フォールバックとして旧targetItemsを使用
    const itemsToAdd = request.options?.addItems || request.options?.targetItems || [];

    if (itemsToAdd.length > 0) {
      try {
        const furnitureAdapter = getFurnitureRecommendationAdapter();
        // 選択されたカテゴリ数に応じてmaxItemsを動的に設定（各カテゴリ1-2個）
        const dynamicMaxItems = Math.min(itemsToAdd.length * 2, 10);
        selectedFurniture = await furnitureAdapter.selectFurnitureForRoom({
          roomImage: roomImageBuffer,
          style: request.options?.style || "modern",
          targetItems: itemsToAdd,
          maxItems: dynamicMaxItems,
        });

        // 選定された家具をFurnitureReferenceに変換
        if (selectedFurniture.length > 0) {
          furnitureReferences = selectedFurniture.map((f) => ({
            productId: f.productId,
            name: f.name,
            imageUrl: f.imageUrl,
            category: f.category,
            affiliateUrl: f.affiliateUrl,
          }));
        }

        console.log(`Selected ${selectedFurniture.length} furniture items for design`);
      } catch (error) {
        console.error("Error in furniture selection (continuing without):", error);
        // 家具選定に失敗しても画像生成は続行
      }
    }

    // 家具選定完了を記録
    await designRef.update({
      "processingSteps.furnitureRecommendation": "completed",
      "processingSteps.imageGeneration": "processing",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 4. AIアダプターで画像生成
    const imageAdapter = getImageGenerationAdapter();
    const generatedImage = await imageAdapter.generateInteriorDesign(
      roomImageBuffer,
      furnitureReferences,
      request.options
    );

    // 5. 生成された画像をStorageにアップロード
    const generatedImagePath = `designs/${designId}/generated.jpg`;
    const generatedImageFile = bucket.file(generatedImagePath);
    await generatedImageFile.save(generatedImage.imageBuffer, {
      metadata: {
        contentType: "image/jpeg",
      },
    });

    // 公開URLを取得
    await generatedImageFile.makePublic();
    const generatedImageUrl = generatedImageFile.publicUrl();

    // 6. 事前選定した家具を使用し、位置情報を検出して付与
    const furnitureAdapter = getFurnitureRecommendationAdapter();
    let finalFurniture: Array<{
      productId: string;
      name: string;
      category: string;
      imageUrl: string;
      affiliateUrl: string;
      price: number;
      reason: string;
      itemNumber: number;
      position: { x: number; y: number } | undefined;
      reviewAverage?: number;
      reviewCount?: number;
    }> = [];

    // 事前選定した家具がある場合はそれを優先的に使用
    if (selectedFurniture.length > 0) {
      console.log(`Using ${selectedFurniture.length} pre-selected furniture items`);

      // 位置情報を検出
      let detectedPositions: Array<{ number: number; category: string; position: { x: number; y: number } }> = [];
      try {
        detectedPositions = await (furnitureAdapter as any).detectFurniturePositions(generatedImage.imageBuffer);
        console.log(`Detected ${detectedPositions.length} positions in generated image`);
      } catch (posError) {
        console.warn("Position detection failed:", posError);
      }

      const usedDetectedPositions = new Set<number>();
      finalFurniture = selectedFurniture.map((f, index) => {
        const itemNumber = index + 1;
        const categoryKeywords = getCategoryKeywords(f.category);

        // 商品の照明タイプを判定
        const productNameLower = f.name.toLowerCase();
        const isCeilingLight = productNameLower.includes("シーリング") || productNameLower.includes("ペンダント") || productNameLower.includes("天井");
        const isFloorLight = productNameLower.includes("フロア") || productNameLower.includes("スタンド");
        const isDeskLight = productNameLower.includes("デスク") || productNameLower.includes("テーブルランプ") || productNameLower.includes("テーブルライト");

        // カテゴリベースで位置をマッチング（照明タイプと位置の整合性をチェック）
        let matchedPos = detectedPositions.find((p) => {
          if (usedDetectedPositions.has(p.number)) return false;

          // カテゴリキーワードのマッチング
          const categoryMatches = categoryKeywords.some(keyword =>
            p.category.toLowerCase().includes(keyword.toLowerCase()) ||
            keyword.toLowerCase().includes(p.category.toLowerCase())
          );

          if (!categoryMatches) return false;

          // 照明タイプと位置の整合性チェック
          if (categoryKeywords.some(k => ["照明", "ライト", "ランプ"].includes(k))) {
            const isCeilingPosition = p.position.y < 25; // 画像上部25%は天井エリア
            const isFloorPosition = p.position.y > 50; // 画像下部50%以下は床/テーブル上

            // デスクライト/テーブルランプは天井位置にマッチしない
            if (isDeskLight && isCeilingPosition) {
              console.log(`Skipping ceiling position for desk light: ${f.name}`);
              return false;
            }

            // フロアライトは天井位置にマッチしない
            if (isFloorLight && isCeilingPosition) {
              console.log(`Skipping ceiling position for floor light: ${f.name}`);
              return false;
            }

            // シーリングライトは床位置にマッチしない
            if (isCeilingLight && isFloorPosition) {
              console.log(`Skipping floor position for ceiling light: ${f.name}`);
              return false;
            }
          }

          return true;
        });

        if (matchedPos) {
          usedDetectedPositions.add(matchedPos.number);
          console.log(`Matched "${f.name}" (${f.category}) with position ${matchedPos.number} (${matchedPos.category}) at (${matchedPos.position.x}, ${matchedPos.position.y})`);
        }

        return {
          productId: f.productId,
          name: f.name,
          category: f.category,
          imageUrl: f.imageUrl,
          affiliateUrl: f.affiliateUrl,
          price: f.price,
          reason: f.reason,
          itemNumber,
          position: matchedPos?.position || undefined,
          reviewAverage: f.reviewAverage,
          reviewCount: f.reviewCount,
        };
      });
    } else {
      // 事前選定がない場合は画像分析でフォールバック
      try {
        const detectedAndMatchedFurniture = await (furnitureAdapter as any).analyzeGeneratedImageAndMatchProducts({
          generatedImage: generatedImage.imageBuffer,
          style: request.options?.style || "modern",
        });

        console.log(`Detected and matched ${detectedAndMatchedFurniture.length} furniture items from generated image`);

        finalFurniture = detectedAndMatchedFurniture.map((f: any, index: number) => ({
          productId: f.productId,
          name: f.name,
          category: f.category,
          imageUrl: f.imageUrl,
          affiliateUrl: f.affiliateUrl,
          price: f.price,
          reason: f.reason,
          itemNumber: f.itemNumber || index + 1,
          position: f.position || undefined,
          reviewAverage: f.reviewAverage,
          reviewCount: f.reviewCount,
        }));
      } catch (error) {
        console.warn("Image analysis failed:", error);
      }
    }

    const usedItemIds = finalFurniture.map((f) => f.productId);
    console.log(`Final furniture list: ${finalFurniture.length} items`);

    // 8. Firestoreを更新（完了ステータス + usedItemIds）
    await designRef.update({
      generatedImageUrl,
      usedItemIds,
      "processingSteps.imageGeneration": "completed",
      status: "completed",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 9. furnitureItemsサブコレクションに家具を保存（位置情報付き）
    if (finalFurniture.length > 0) {
      const batch = db.batch();
      for (const furniture of finalFurniture) {
        const itemRef = designRef.collection("furnitureItems").doc();
        batch.set(itemRef, {
          itemId: itemRef.id,
          productId: furniture.productId,
          name: furniture.name,
          category: furniture.category,
          imageUrl: furniture.imageUrl,
          affiliateUrl: furniture.affiliateUrl,
          price: furniture.price,
          reason: furniture.reason,
          itemNumber: furniture.itemNumber || null,
          position: furniture.position || null,
          reviewAverage: furniture.reviewAverage || null,
          reviewCount: furniture.reviewCount || null,
          source: "image_analysis", // 生成画像から検出
          addedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
      console.log(`Saved ${finalFurniture.length} furniture items to Firestore`);
    }

    // 10. 自動バリデーション（バックグラウンドで非同期実行 - タイムアウト防止）
    // 注意: awaitしないことでメインレスポンスを先に返す
    runValidationInBackground(
      generatedImage.imageBuffer,
      finalFurniture,
      designId,
      designRef
    );

    return {
      designId,
      generatedImageUrl,
      usedItemIds,
      status: "completed",
    };
  } catch (error) {
    console.error("Error generating interior design:", error);

    // エラー時はステータスを更新
    try {
      await designRef.update({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (updateError) {
      console.error("Error updating design status:", updateError);
    }

    return {
      designId,
      generatedImageUrl: "",
      usedItemIds: [],
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * 商品カテゴリから検出用キーワードを取得
 */
function getCategoryKeywords(category: string): string[] {
  const categoryMap: Record<string, string[]> = {
    // 大型家具
    ソファ: ["ソファ", "ソファー", "カウチ"],
    ベッド: ["ベッド", "ベッドフレーム"],
    テーブル: ["テーブル", "センターテーブル", "ローテーブル"],
    チェア: ["チェア", "椅子", "イス"],
    ダイニングテーブル: ["ダイニングテーブル", "テーブル", "食卓"],
    ダイニングチェア: ["ダイニングチェア", "チェア", "椅子"],
    座椅子: ["座椅子", "フロアチェア"],
    こたつ: ["こたつ", "炬燵"],
    // 収納・家具
    収納: ["収納", "シェルフ", "ラック", "棚"],
    サイドテーブル: ["サイドテーブル", "テーブル", "小型家具"],
    ワードローブ: ["ワードローブ", "クローゼット"],
    ドレッサー: ["ドレッサー", "化粧台"],
    ハンガーラック: ["ハンガーラック", "コートハンガー"],
    収納小物: ["収納ボックス", "収納ケース", "バスケット"],
    ゴミ箱: ["ゴミ箱", "ダストボックス"],
    スツール: ["スツール", "椅子"],
    チェスト: ["チェスト", "収納"],
    シェルフ: ["シェルフ", "棚", "収納"],
    // 照明系
    照明: ["照明", "ライト", "ランプ", "シーリング", "ペンダント"],
    間接照明: ["照明", "間接", "ライト", "フロアランプ", "テーブルランプ"],
    ダイニング照明: ["ペンダントライト", "ダイニング照明", "照明"],
    ライト: ["照明", "ライト", "ランプ"],
    ランプ: ["照明", "ライト", "ランプ", "フロアランプ", "テーブルランプ"],
    シーリングライト: ["照明", "シーリング", "ペンダント"],
    ペンダントライト: ["照明", "ペンダント", "シーリング"],
    フロアライト: ["フロアランプ", "フロアライト", "照明"],
    テーブルライト: ["テーブルランプ", "テーブルライト", "照明"],
    // ファブリック
    ラグ: ["ラグ", "カーペット", "マット"],
    ダイニングラグ: ["ラグ", "カーペット", "ダイニングラグ"],
    玄関マット: ["玄関マット", "エントランスマット", "マット"],
    カーペット: ["ラグ", "カーペット", "マット"],
    マット: ["マット", "ラグ"],
    カーテン: ["カーテン", "ブラインド"],
    ブラインド: ["ブラインド", "カーテン"],
    クッション: ["クッション", "枕", "ピロー"],
    クッションカバー: ["クッション"],
    ブランケット: ["ブランケット", "膝掛け", "毛布"],
    寝具: ["寝具", "布団", "シーツ"],
    // 装飾
    観葉植物: ["植物", "グリーン", "観葉"],
    フェイクグリーン: ["植物", "グリーン", "フェイク"],
    プランター: ["植物", "プランター"],
    壁掛け: ["壁掛け", "アート", "ポスター", "ミラー"],
    アート: ["アート", "壁掛け", "絵"],
    ポスター: ["ポスター", "アート", "壁掛け"],
    ミラー: ["ミラー", "鏡", "姿見"],
    時計: ["時計", "壁掛け"],
    // 内装
    壁紙: ["壁紙", "ウォールステッカー"],
    フロアタイル: ["フロアタイル", "フロアシート"],
    // その他
    インテリア家電: ["加湿器", "空気清浄機", "サーキュレーター"],
    マットレス: ["マットレス"],
  };

  // カテゴリ名で直接マッチ
  if (categoryMap[category]) {
    return categoryMap[category];
  }

  // 部分一致でマッチ
  for (const [key, keywords] of Object.entries(categoryMap)) {
    if (category.includes(key) || key.includes(category)) {
      return keywords;
    }
  }

  // マッチしない場合はカテゴリ名自体をキーワードとして返す
  return [category];
}
