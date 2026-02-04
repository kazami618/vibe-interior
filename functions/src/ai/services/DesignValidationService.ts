/**
 * デザイン検証サービス
 * 生成された画像と家具リストの一致を検証
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  detectedItems: DetectedItem[];
  summary: string;
}

export interface ValidationIssue {
  type: "missing_in_image" | "wrong_product" | "position_mismatch" | "extra_in_image";
  itemNumber: number;
  productName: string;
  description: string;
  severity: "error" | "warning";
}

export interface DetectedItem {
  number: number;
  category: string;
  description: string;
  position: { x: number; y: number };
  confidence: "high" | "medium" | "low";
}

export interface FurnitureItem {
  itemNumber: number;
  name: string;
  category: string;
  position?: { x: number; y: number };
}

/**
 * 生成画像と家具リストを検証
 */
export async function validateDesign(
  generatedImage: Buffer,
  furnitureItems: FurnitureItem[]
): Promise<ValidationResult> {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GENAI_API_KEY is not set");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  // 家具リストを文字列に変換
  const furnitureListStr = furnitureItems
    .map((f) => `${f.itemNumber}. ${f.name} (${f.category})`)
    .join("\n");

  const prompt = `この部屋の画像を分析し、以下の家具リストと比較してください。

## 家具リスト（配置されているはずのアイテム）
${furnitureListStr}

## タスク
1. 画像に実際に配置されている家具・インテリアを全て検出してください
2. 家具リストの各アイテムが画像に存在するか確認してください
3. 不一致や問題点を報告してください

## 判定基準
- 「存在する」: 画像内に該当するアイテムが明確に見える
- 「存在しない」: 画像内に該当するアイテムが見えない
- 「異なる商品」: カテゴリは合っているが、リストの商品とは異なるものが配置されている

## 出力形式（JSONのみ）
{
  "detectedItems": [
    {
      "number": 1,
      "category": "検出されたカテゴリ",
      "description": "検出されたアイテムの詳細説明",
      "position": { "x": 50, "y": 30 },
      "confidence": "high"
    }
  ],
  "validation": [
    {
      "itemNumber": 1,
      "productName": "リストの商品名",
      "status": "found" | "missing" | "different",
      "actualDescription": "実際に画像にあるものの説明（differentの場合）",
      "reason": "判定理由"
    }
  ],
  "summary": "全体的な検証結果の要約（日本語）"
}`;

  try {
    const imageBase64 = generatedImage.toString("base64");
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
      console.error("Failed to parse validation response:", responseText);
      return {
        isValid: false,
        issues: [
          {
            type: "missing_in_image",
            itemNumber: 0,
            productName: "",
            description: "検証レスポンスのパースに失敗",
            severity: "error",
          },
        ],
        detectedItems: [],
        summary: "検証に失敗しました",
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const issues: ValidationIssue[] = [];

    // 検証結果を処理
    for (const v of parsed.validation || []) {
      if (v.status === "missing") {
        issues.push({
          type: "missing_in_image",
          itemNumber: v.itemNumber,
          productName: v.productName,
          description: v.reason || "画像内にアイテムが見つかりません",
          severity: "error",
        });
      } else if (v.status === "different") {
        issues.push({
          type: "wrong_product",
          itemNumber: v.itemNumber,
          productName: v.productName,
          description: `期待: ${v.productName} / 実際: ${v.actualDescription}`,
          severity: "warning",
        });
      }
    }

    return {
      isValid: issues.filter((i) => i.severity === "error").length === 0,
      issues,
      detectedItems: parsed.detectedItems || [],
      summary: parsed.summary || "",
    };
  } catch (error) {
    console.error("Error validating design:", error);
    return {
      isValid: false,
      issues: [
        {
          type: "missing_in_image",
          itemNumber: 0,
          productName: "",
          description: `検証エラー: ${error instanceof Error ? error.message : "Unknown error"}`,
          severity: "error",
        },
      ],
      detectedItems: [],
      summary: "検証中にエラーが発生しました",
    };
  }
}

/**
 * 検証結果をログ出力
 */
export function logValidationResult(result: ValidationResult, designId: string): void {
  console.log(`\n========== Design Validation: ${designId} ==========`);
  console.log(`Status: ${result.isValid ? "✓ VALID" : "✗ INVALID"}`);
  console.log(`Summary: ${result.summary}`);

  if (result.issues.length > 0) {
    console.log(`\nIssues (${result.issues.length}):`);
    for (const issue of result.issues) {
      const icon = issue.severity === "error" ? "❌" : "⚠️";
      console.log(`  ${icon} #${issue.itemNumber} ${issue.productName}`);
      console.log(`     Type: ${issue.type}`);
      console.log(`     ${issue.description}`);
    }
  }

  console.log(`\nDetected Items (${result.detectedItems.length}):`);
  for (const item of result.detectedItems) {
    console.log(`  ${item.number}. ${item.category}: ${item.description} (${item.confidence})`);
  }
  console.log("=".repeat(50) + "\n");
}
