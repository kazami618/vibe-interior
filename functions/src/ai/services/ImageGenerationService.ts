/**
 * 画像生成サービス
 * ビジネスロジックを含む
 */

import * as admin from "firebase-admin";
import { getImageGenerationAdapter } from "../config";
import { FurnitureReference, GenerationOptions } from "../adapters/ImageGenerationAdapter";

export interface ImageGenerationRequest {
  userId: string;
  roomImageUrl: string;
  furnitureReferences: FurnitureReference[];
  options?: GenerationOptions;
}

export interface ImageGenerationResult {
  designId: string;
  generatedImageUrl: string;
  status: "completed" | "failed";
  errorMessage?: string;
}

/**
 * インテリアデザインを生成
 */
export async function generateInteriorDesign(
  request: ImageGenerationRequest
): Promise<ImageGenerationResult> {
  const db = admin.firestore();
  const storage = admin.storage();

  try {
    // 1. Firestoreにデザインドキュメントを作成
    const designRef = db.collection("designs").doc();
    const designId = designRef.id;

    await designRef.set({
      designId,
      userId: request.userId,
      title: `デザイン ${new Date().toLocaleDateString("ja-JP")}`,
      originalImageUrl: request.roomImageUrl,
      generatedImageUrl: "",
      thumbnailUrl: "",
      aiModel: {
        imageGeneration: getImageGenerationAdapter().getModelName(),
        furnitureRecommendation: "",
      },
      generationOptions: request.options || {},
      status: "processing",
      processingSteps: {
        imageUpload: "completed",
        imageGeneration: "processing",
        furnitureRecommendation: "pending",
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      isFavorite: false,
      viewCount: 0,
    });

    // 2. 元画像をダウンロード
    const bucket = storage.bucket();
    const roomImageFile = bucket.file(request.roomImageUrl);
    const [roomImageBuffer] = await roomImageFile.download();

    // 3. AIアダプターで画像生成
    const adapter = getImageGenerationAdapter();
    const generatedImage = await adapter.generateInteriorDesign(
      roomImageBuffer,
      request.furnitureReferences,
      request.options
    );

    // 4. 生成された画像をStorageにアップロード
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

    // 5. Firestoreを更新
    await designRef.update({
      generatedImageUrl,
      "processingSteps.imageGeneration": "completed",
      status: "completed",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      designId,
      generatedImageUrl,
      status: "completed",
    };
  } catch (error) {
    console.error("Error generating interior design:", error);

    return {
      designId: "",
      generatedImageUrl: "",
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
