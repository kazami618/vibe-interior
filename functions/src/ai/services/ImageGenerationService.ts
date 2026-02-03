/**
 * 画像生成サービス
 * ビジネスロジックを含む
 * RAGによる家具選定 → 画像生成 → 結果保存のフローを管理
 */

import * as admin from "firebase-admin";
import { getImageGenerationAdapter, getFurnitureRecommendationAdapter } from "../config";
import { FurnitureReference, GenerationOptions } from "../adapters/ImageGenerationAdapter";
import { SelectedFurniture } from "../adapters/FurnitureRecommendationAdapter";

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

    if (request.options?.targetItems && request.options.targetItems.length > 0) {
      try {
        const furnitureAdapter = getFurnitureRecommendationAdapter();
        // 選択されたカテゴリ数に応じてmaxItemsを動的に設定（各カテゴリ1-2個）
        const dynamicMaxItems = Math.min(request.options.targetItems.length * 2, 10);
        selectedFurniture = await furnitureAdapter.selectFurnitureForRoom({
          roomImage: roomImageBuffer,
          style: request.options?.style || "modern",
          targetItems: request.options.targetItems,
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

    // 6. 生成画像から家具の位置を検出
    const furnitureAdapter = getFurnitureRecommendationAdapter();
    let detectedPositions: Array<{ number: number; category: string; position: { x: number; y: number } }> = [];
    try {
      detectedPositions = await (furnitureAdapter as any).detectFurniturePositions(generatedImage.imageBuffer);
      console.log(`Detected ${detectedPositions.length} furniture positions`);
    } catch (error) {
      console.warn("Position detection failed, using default positions:", error);
    }

    // 7. 事前選定した家具に位置情報を付与
    const finalFurniture = selectedFurniture.map((f, index) => {
      const itemNumber = index + 1;
      // 検出された位置情報とマッチング（番号ベース）
      const detectedPos = detectedPositions.find((p) => p.number === itemNumber);
      return {
        ...f,
        itemNumber,
        position: detectedPos?.position || null,
      };
    });
    const usedItemIds = finalFurniture.map((f) => f.productId);
    console.log(`Using ${finalFurniture.length} pre-selected furniture items with positions`);

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
          source: "pre_selection",
          addedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }

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
