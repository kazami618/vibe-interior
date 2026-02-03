export interface Product {
  id: string; // affiliateLinkをIDとして使用
  name: string;
  price: number;
  imageUrl: string;
  affiliateLink: string;
  category: string;
  tags: string[];
  vibe: string;
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
