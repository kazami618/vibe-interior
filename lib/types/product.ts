import { Timestamp } from 'firebase/firestore';
import type { ItemCategory, DesignStyle } from './design';

// ============================================
// 新データモデル（商品中心設計）
// ============================================

/** 商品マスターデータ */
export interface Product {
  id: string;
  name: string;
  description?: string;
  images: string[];
  category: ItemCategory;
  style: DesignStyle;
  tags: string[];
  brand?: string;
  purchaseLinks: PurchaseLink[];
  status: 'candidate' | 'approved' | 'rejected';
  curatedAt?: Timestamp;
  curatedBy?: string;
  // AI学習用（将来実装だがスキーマに含める）
  aiScore?: number;
  aiSuggestedCategory?: ItemCategory;
  aiSuggestedStyle?: DesignStyle;
  collectedFrom?: 'article' | 'rakuten-xref' | 'brand-search' | 'manual';
  sourceUrl?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** 購入リンク */
export interface PurchaseLink {
  source: 'amazon' | 'rakuten' | 'official' | 'other';
  url: string;
  affiliateUrl?: string;
  price?: number;
  priceUpdatedAt?: Timestamp;
  asin?: string;
  rakutenItemCode?: string;
  reviewAverage?: number;
  reviewCount?: number;
}

/** キュレーションレビュー履歴 */
export interface ProductReview {
  id: string;
  productId: string;
  decision: 'approved' | 'rejected';
  originalCategory?: ItemCategory;
  editedCategory?: ItemCategory;
  originalStyle?: DesignStyle;
  editedStyle?: DesignStyle;
  originalTags?: string[];
  editedTags?: string[];
  reviewedBy: string;
  reviewedAt: Timestamp;
  reviewDurationMs?: number;
  confidence?: number;
}

// ============================================
// 旧データモデル（後方互換性のため維持）
// ============================================

/** @deprecated 新しい Product 型を使用してください */
export interface LegacyProduct {
  id: string;
  source: 'rakuten' | 'amazon';
  name: string;
  price: number;
  imageUrl: string;
  affiliateLink: string;
  category: string;
  tags: string[];
  vibe: string;
  asin?: string;
  rakutenItemCode?: string;
  reviewAverage?: number;
  reviewCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SpreadsheetRow {
  name: string;
  price: string;
  imageUrl: string;
  affiliateLink: string;
  category: string;
  tags: string;
  vibe: string;
}

export interface AmazonSpreadsheetRow {
  name: string;
  price: string;
  imageUrl: string;
  asin: string;
  category: string;
  vibe: string;
  tags: string;
  reviewAverage: string;
  reviewCount: string;
  updatedAt: string;
}
