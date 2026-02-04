/**
 * generateRoomDesign Callable Function
 * ユーザーが部屋の画像をアップロードし、AIで改装イメージを生成する
 */

import * as functions from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { generateInteriorDesign } from "../ai/services/ImageGenerationService";

// リージョン設定
const REGION = "asia-northeast1";

// スタイルの型定義
type DesignStyle = "scandinavian" | "modern" | "vintage" | "industrial";

// 変更対象アイテムの型定義
type TargetItem = "lighting" | "rug" | "cushion" | "wall_decor" | "plants" | "small_furniture" | "curtain";

// 維持対象アイテムの型定義
type PreservedItem = "walls_ceiling" | "flooring" | "windows" | "large_furniture" | "doors";

// シナリオの型定義
type Scenario = "redecorate" | "moving";

// 部屋タイプの型定義
type RoomType = "living" | "dining" | "bedroom" | "one_room";

// リクエスト型定義
interface GenerateRoomDesignRequest {
  style: DesignStyle;
  originalImagePath: string;
  targetItems?: TargetItem[];
  preservedItems?: PreservedItem[];
  // 新しいシナリオパラメータ
  scenario?: Scenario;
  roomType?: RoomType;
  addItems?: string[];
  keepItems?: string[];
}

// レスポンス型定義
interface GenerateRoomDesignResponse {
  designId: string;
  generatedImageUrl: string;
}

// 有効なスタイルリスト
const VALID_STYLES: DesignStyle[] = ["scandinavian", "modern", "vintage", "industrial"];

// 有効な変更対象アイテムリスト
const VALID_TARGET_ITEMS: TargetItem[] = ["lighting", "rug", "cushion", "wall_decor", "plants", "small_furniture", "curtain"];

// 有効な維持対象アイテムリスト
const VALID_PRESERVED_ITEMS: PreservedItem[] = ["walls_ceiling", "flooring", "windows", "large_furniture", "doors"];

// 有効なシナリオリスト
const VALID_SCENARIOS: Scenario[] = ["redecorate", "moving"];

// 有効な部屋タイプリスト
const VALID_ROOM_TYPES: RoomType[] = ["living", "dining", "bedroom", "one_room"];

// デフォルト値
const DEFAULT_TARGET_ITEMS: TargetItem[] = ["lighting", "rug", "cushion", "wall_decor", "plants", "small_furniture", "curtain"];
const DEFAULT_PRESERVED_ITEMS: PreservedItem[] = ["walls_ceiling", "flooring", "windows"];

/**
 * 入力バリデーション
 */
function validateInput(data: unknown): GenerateRoomDesignRequest {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "入力データが不正です");
  }

  const { style, originalImagePath, targetItems, preservedItems, scenario, roomType, addItems, keepItems } = data as Record<string, unknown>;

  if (!style || typeof style !== "string" || !VALID_STYLES.includes(style as DesignStyle)) {
    throw new HttpsError("invalid-argument", "無効なスタイルが指定されました");
  }

  if (!originalImagePath || typeof originalImagePath !== "string") {
    throw new HttpsError("invalid-argument", "画像パスが指定されていません");
  }

  // パスの形式を検証（users/{uid}/originals/{filename}）
  const pathPattern = /^users\/[^/]+\/originals\/[^/]+$/;
  if (!pathPattern.test(originalImagePath)) {
    throw new HttpsError("invalid-argument", "画像パスの形式が不正です");
  }

  // targetItemsのバリデーション
  let validatedTargetItems: TargetItem[] = DEFAULT_TARGET_ITEMS;
  if (targetItems !== undefined) {
    if (!Array.isArray(targetItems)) {
      throw new HttpsError("invalid-argument", "targetItemsは配列である必要があります");
    }
    const invalidTargetItems = targetItems.filter(item => !VALID_TARGET_ITEMS.includes(item as TargetItem));
    if (invalidTargetItems.length > 0) {
      throw new HttpsError("invalid-argument", `無効なtargetItemsが含まれています: ${invalidTargetItems.join(", ")}`);
    }
    validatedTargetItems = targetItems as TargetItem[];
  }

  // preservedItemsのバリデーション
  let validatedPreservedItems: PreservedItem[] = DEFAULT_PRESERVED_ITEMS;
  if (preservedItems !== undefined) {
    if (!Array.isArray(preservedItems)) {
      throw new HttpsError("invalid-argument", "preservedItemsは配列である必要があります");
    }
    const invalidPreservedItems = preservedItems.filter(item => !VALID_PRESERVED_ITEMS.includes(item as PreservedItem));
    if (invalidPreservedItems.length > 0) {
      throw new HttpsError("invalid-argument", `無効なpreservedItemsが含まれています: ${invalidPreservedItems.join(", ")}`);
    }
    validatedPreservedItems = preservedItems as PreservedItem[];
  }

  // scenarioのバリデーション（オプション）
  let validatedScenario: Scenario | undefined;
  if (scenario !== undefined) {
    if (typeof scenario !== "string" || !VALID_SCENARIOS.includes(scenario as Scenario)) {
      throw new HttpsError("invalid-argument", "無効なシナリオが指定されました");
    }
    validatedScenario = scenario as Scenario;
  }

  // roomTypeのバリデーション（オプション）
  let validatedRoomType: RoomType | undefined;
  if (roomType !== undefined) {
    if (typeof roomType !== "string" || !VALID_ROOM_TYPES.includes(roomType as RoomType)) {
      throw new HttpsError("invalid-argument", "無効な部屋タイプが指定されました");
    }
    validatedRoomType = roomType as RoomType;
  }

  // addItemsのバリデーション（オプション、文字列配列）
  let validatedAddItems: string[] | undefined;
  if (addItems !== undefined) {
    if (!Array.isArray(addItems)) {
      throw new HttpsError("invalid-argument", "addItemsは配列である必要があります");
    }
    validatedAddItems = addItems as string[];
  }

  // keepItemsのバリデーション（オプション、文字列配列）
  let validatedKeepItems: string[] | undefined;
  if (keepItems !== undefined) {
    if (!Array.isArray(keepItems)) {
      throw new HttpsError("invalid-argument", "keepItemsは配列である必要があります");
    }
    validatedKeepItems = keepItems as string[];
  }

  return {
    style: style as DesignStyle,
    originalImagePath,
    targetItems: validatedTargetItems,
    preservedItems: validatedPreservedItems,
    scenario: validatedScenario,
    roomType: validatedRoomType,
    addItems: validatedAddItems,
    keepItems: validatedKeepItems,
  };
}

/**
 * チケット消費処理（トランザクション）
 */
async function consumeTicket(
  db: admin.firestore.Firestore,
  uid: string,
  designId: string
): Promise<void> {
  const userRef = db.collection("users").doc(uid);

  await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists) {
      throw new HttpsError("failed-precondition", "ユーザーが見つかりません");
    }

    const userData = userDoc.data();
    const ticketBalance = userData?.ticketBalance || 0;

    if (ticketBalance < 1) {
      throw new HttpsError("failed-precondition", "チケットが不足しています");
    }

    // チケット残高を減らす
    transaction.update(userRef, {
      ticketBalance: admin.firestore.FieldValue.increment(-1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // チケットログを追加
    const ticketLogRef = userRef.collection("ticketLogs").doc();
    transaction.set(ticketLogRef, {
      amount: -1,
      reason: "generation_fee",
      description: "デザイン生成",
      designId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
}

/**
 * generateRoomDesign Callable Function
 */
export const generateRoomDesign = onCall<GenerateRoomDesignRequest, Promise<GenerateRoomDesignResponse>>(
  {
    region: REGION,
    timeoutSeconds: 300, // 画像生成は時間がかかるため5分に設定
    memory: "1GiB",
    secrets: ["GOOGLE_GENAI_API_KEY"],
  },
  async (request) => {
    // 1. 認証チェック
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "ログインが必要です");
    }

    const uid = request.auth.uid;
    functions.logger.info(`generateRoomDesign called by user: ${uid}`);

    // 2. 入力バリデーション
    const { style, originalImagePath, targetItems, preservedItems, scenario, roomType, addItems, keepItems } = validateInput(request.data);

    // パスに含まれるuidとリクエストのuidが一致するか確認
    const pathUid = originalImagePath.split("/")[1];
    if (pathUid !== uid) {
      throw new HttpsError("permission-denied", "他のユーザーの画像にはアクセスできません");
    }

    const db = admin.firestore();
    const storage = admin.storage();
    const BUCKET_NAME = "vibe-interior-2026-f948c.firebasestorage.app";

    // 3. 元画像の存在確認
    try {
      const bucket = storage.bucket(BUCKET_NAME);
      const file = bucket.file(originalImagePath);
      const [exists] = await file.exists();

      if (!exists) {
        throw new HttpsError("not-found", "画像が見つかりません");
      }
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      functions.logger.error("Error checking image:", error);
      throw new HttpsError("internal", "画像の確認に失敗しました");
    }

    // 4. デザインIDを事前に生成（チケットログに使用）
    const designRef = db.collection("designs").doc();
    const designId = designRef.id;

    // 5. チケット消費（トランザクション）
    try {
      await consumeTicket(db, uid, designId);
      functions.logger.info(`Ticket consumed for user: ${uid}, designId: ${designId}`);
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      functions.logger.error("Error consuming ticket:", error);
      throw new HttpsError("internal", "チケットの消費に失敗しました");
    }

    // 6. 画像生成サービスを呼び出し
    try {
      const result = await generateInteriorDesign({
        userId: uid,
        roomImageUrl: originalImagePath,
        furnitureReferences: [], // MVPでは家具参照なしで生成
        options: {
          style,
          targetItems,
          preservedItems,
          // 新しいシナリオパラメータ
          scenario,
          roomType,
          addItems,
          keepItems,
        },
      });

      if (result.status === "failed") {
        // 画像生成失敗時はチケットを返却
        await refundTicket(db, uid, designId);
        throw new HttpsError("internal", result.errorMessage || "画像生成に失敗しました");
      }

      functions.logger.info(`Design generated successfully: ${result.designId}`);

      return {
        designId: result.designId,
        generatedImageUrl: result.generatedImageUrl,
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }

      // 予期せぬエラー時もチケットを返却
      await refundTicket(db, uid, designId);

      functions.logger.error("Error generating design:", error);
      throw new HttpsError("internal", "画像生成に失敗しました");
    }
  }
);

/**
 * チケット返却処理
 */
async function refundTicket(
  db: admin.firestore.Firestore,
  uid: string,
  designId: string
): Promise<void> {
  try {
    const userRef = db.collection("users").doc(uid);

    await db.runTransaction(async (transaction) => {
      // チケット残高を戻す
      transaction.update(userRef, {
        ticketBalance: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 返却ログを追加
      const ticketLogRef = userRef.collection("ticketLogs").doc();
      transaction.set(ticketLogRef, {
        amount: 1,
        reason: "generation_fee",
        description: "デザイン生成失敗による返却",
        designId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    functions.logger.info(`Ticket refunded for user: ${uid}, designId: ${designId}`);
  } catch (error) {
    functions.logger.error("Error refunding ticket:", error);
    // 返却失敗は致命的ではないためログのみ
  }
}
