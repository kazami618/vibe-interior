import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Firebase Admin初期化
admin.initializeApp();

// サンプル関数
export const helloWorld = functions.https.onRequest((request, response) => {
  response.send("Hello from Vibe Interior!");
});

// 将来的にAI関数をここに追加
// export { generateInteriorDesign } from "./ai/services/ImageGenerationService";
// export { recommendFurniture } from "./ai/services/FurnitureRecommendationService";
