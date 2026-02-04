export interface Product {
  id: string; // affiliateLinkをIDとして使用
  source: 'rakuten' | 'amazon';
  name: string;
  price: number;
  imageUrl: string;
  affiliateLink: string;
  category: string;
  tags: string[];
  vibe: string;
  asin?: string; // Amazon用
  rakutenItemCode?: string; // 楽天用
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
