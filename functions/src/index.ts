import * as functions from "firebase-functions";
import { auth } from "firebase-functions/v1";
import * as admin from "firebase-admin";

// Firebase Admin初期化
admin.initializeApp();

// サンプル関数
export const helloWorld = functions.https.onRequest((request, response) => {
  response.send("Hello from Vibe Interior!");
});

// ユーザー登録時のチケット付与トリガー
export const onUserCreated = auth.user().onCreate(async (user) => {
  const db = admin.firestore();
  const uid = user.uid;

  try {
    // ユーザードキュメントを作成
    await db.collection("users").doc(uid).set({
      uid: uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      ticketBalance: 3, // 初回ボーナス
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // チケット履歴を記録
    await db.collection("users").doc(uid).collection("ticketLogs").add({
      amount: 3,
      reason: "signup_bonus",
      description: "新規登録ボーナス",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    functions.logger.info(`User ${uid} created with 3 bonus tickets`);
  } catch (error) {
    functions.logger.error("Error creating user document:", error);
    throw error;
  }
});

// AI画像生成関数
export { generateRoomDesign } from "./callable/generateRoomDesign";
