/**
 * 家具推薦サービス
 * ビジネスロジックを含む
 */

import * as admin from "firebase-admin";
import { getFurnitureRecommendationAdapter } from "../config";
import { FurnitureRecommendation } from "../adapters/FurnitureRecommendationAdapter";

export interface FurnitureRecommendationRequest {
  designId: string;
  generatedImageUrl: string;
}

export interface FurnitureRecommendationResult {
  designId: string;
  recommendations: FurnitureRecommendation[];
  status: "completed" | "failed";
  errorMessage?: string;
}

/**
 * 家具推薦を実行
 */
export async function recommendFurniture(
  request: FurnitureRecommendationRequest
): Promise<FurnitureRecommendationResult> {
  const db = admin.firestore();
  const storage = admin.storage();

  try {
    // 1. Firestoreのデザインドキュメントを更新
    const designRef = db.collection("designs").doc(request.designId);
    await designRef.update({
      "processingSteps.furnitureRecommendation": "processing",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 2. 生成画像をダウンロード
    const bucket = storage.bucket();
    const imageFile = bucket.file(request.generatedImageUrl);
    const [imageBuffer] = await imageFile.download();

    // 3. AIアダプターで家具検出
    const adapter = getFurnitureRecommendationAdapter();
    const detectedFurniture = await adapter.detectFurniture(imageBuffer);

    // 4. 家具推薦を取得（RAG）
    const recommendations = await adapter.recommendProducts(detectedFurniture);

    // 5. Firestoreに推薦情報を保存
    const batch = db.batch();

    // 各家具アイテムをサブコレクションに保存
    for (let i = 0; i < detectedFurniture.length; i++) {
      const furniture = detectedFurniture[i];
      const itemRef = designRef.collection("furnitureItems").doc();

      const furnitureRecommendations = recommendations.filter(
        (rec) => rec.category === furniture.category
      );

      batch.set(itemRef, {
        itemId: itemRef.id,
        productId: furnitureRecommendations[0]?.productId || "",
        position: furniture.position,
        category: furniture.category,
        recommendations: furnitureRecommendations.map((rec) => ({
          productId: rec.productId,
          score: rec.score,
          reason: rec.reason,
        })),
        addedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // デザインドキュメントを更新
    batch.update(designRef, {
      "processingSteps.furnitureRecommendation": "completed",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return {
      designId: request.designId,
      recommendations,
      status: "completed",
    };
  } catch (error) {
    console.error("Error recommending furniture:", error);

    // エラー時もFirestoreを更新
    const designRef = db.collection("designs").doc(request.designId);
    await designRef.update({
      "processingSteps.furnitureRecommendation": "failed",
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      designId: request.designId,
      recommendations: [],
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
