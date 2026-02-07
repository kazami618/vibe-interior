'use client';

import { useState } from 'react';
import {
  ExternalLink,
  ShoppingCart,
  Star,
  Tag,
  ImageOff,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { Product, PurchaseLink } from '@/lib/types/product';
import type { ItemCategory, DesignStyle } from '@/lib/types/design';
import { DESIGN_STYLES } from '@/lib/types/design';
import CategoryStyleEditor from './CategoryStyleEditor';

interface ProductCardProps {
  product: Product;
  category: ItemCategory;
  style: DesignStyle;
  tags: string[];
  onCategoryChange: (category: ItemCategory) => void;
  onStyleChange: (style: DesignStyle) => void;
  onTagsChange: (tags: string[]) => void;
}

function getSourceLabel(source: PurchaseLink['source']) {
  switch (source) {
    case 'amazon':
      return 'Amazon';
    case 'rakuten':
      return '楽天';
    case 'official':
      return '公式';
    case 'other':
      return 'その他';
  }
}

function getSourceColor(source: PurchaseLink['source']) {
  switch (source) {
    case 'amazon':
      return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    case 'rakuten':
      return 'bg-red-500/10 text-red-400 border-red-500/20';
    case 'official':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'other':
      return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  }
}

function getCollectedFromLabel(from?: Product['collectedFrom']) {
  switch (from) {
    case 'article':
      return '記事';
    case 'rakuten-xref':
      return '楽天相互参照';
    case 'brand-search':
      return 'ブランド検索';
    case 'manual':
      return '手動';
    default:
      return null;
  }
}

function formatPrice(price?: number) {
  if (price == null) return null;
  return `\u00a5${price.toLocaleString()}`;
}

export default function ProductCard({
  product,
  category,
  style,
  tags,
  onCategoryChange,
  onStyleChange,
  onTagsChange,
}: ProductCardProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [imageError, setImageError] = useState<Set<number>>(new Set());

  const mainImage = product.images[selectedImageIndex] || product.images[0];
  const styleLabel =
    DESIGN_STYLES.find((s) => s.value === product.style)?.label ?? product.style;
  const collectedLabel = getCollectedFromLabel(product.collectedFrom);

  const handleImageError = (index: number) => {
    setImageError((prev) => new Set(prev).add(index));
  };

  return (
    <Card className="overflow-hidden max-w-2xl w-full mx-auto">
      {/* Image Gallery */}
      <div className="relative bg-muted">
        {/* Main Image */}
        <div className="relative w-full aspect-square max-h-[400px] flex items-center justify-center overflow-hidden">
          {mainImage && !imageError.has(selectedImageIndex) ? (
            <img
              src={mainImage}
              alt={product.name}
              className="w-full h-full object-contain"
              onError={() => handleImageError(selectedImageIndex)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <ImageOff className="h-12 w-12" />
              <span className="text-sm">画像を読み込めません</span>
            </div>
          )}
        </div>

        {/* Thumbnails */}
        {product.images.length > 1 && (
          <div className="flex gap-1 p-2 overflow-x-auto bg-background/50 backdrop-blur-sm">
            {product.images.map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedImageIndex(i)}
                className={`relative w-14 h-14 flex-shrink-0 rounded-md overflow-hidden border-2 transition-colors ${
                  i === selectedImageIndex
                    ? 'border-primary'
                    : 'border-transparent hover:border-muted-foreground/50'
                }`}
              >
                {!imageError.has(i) ? (
                  <img
                    src={img}
                    alt={`${product.name} - ${i + 1}`}
                    className="w-full h-full object-cover"
                    onError={() => handleImageError(i)}
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <ImageOff className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Collection source badge */}
        {collectedLabel && (
          <div className="absolute top-3 left-3 pointer-events-none">
            <span className="inline-flex items-center gap-1 rounded-full bg-background/80 backdrop-blur-sm px-2.5 py-1 text-xs font-medium text-foreground border border-border">
              <Tag className="h-3 w-3" />
              {collectedLabel}
            </span>
          </div>
        )}

        {/* AI Score badge */}
        {product.aiScore != null && (
          <div className="absolute top-3 right-3 pointer-events-none">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/80 backdrop-blur-sm px-2.5 py-1 text-xs font-bold text-primary-foreground">
              AI {Math.round(product.aiScore * 100)}%
            </span>
          </div>
        )}
      </div>

      <CardContent className="p-5 space-y-4">
        {/* Name and brand */}
        <div>
          <h2 className="text-lg font-semibold text-foreground leading-tight">
            {product.name}
          </h2>
          {product.brand && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {product.brand}
            </p>
          )}
        </div>

        {/* Description */}
        {product.description && (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {product.description}
          </p>
        )}

        {/* Current category / style badges (read-only display) */}
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary border border-primary/20">
            {category}
          </span>
          <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
            {DESIGN_STYLES.find((s) => s.value === style)?.label ?? style}
          </span>
        </div>

        {/* Purchase Links */}
        {product.purchaseLinks.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              購入リンク
            </h3>
            <div className="space-y-1.5">
              {product.purchaseLinks.map((link, i) => (
                <a
                  key={i}
                  href={link.affiliateUrl || link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-2.5 hover:bg-accent transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border ${getSourceColor(
                        link.source
                      )}`}
                    >
                      <ShoppingCart className="h-3 w-3" />
                      {getSourceLabel(link.source)}
                    </span>
                    {link.price != null && (
                      <span className="text-sm font-semibold text-foreground">
                        {formatPrice(link.price)}
                      </span>
                    )}
                    {link.reviewAverage != null && (
                      <span className="flex items-center gap-0.5 text-xs text-amber-500">
                        <Star className="h-3 w-3 fill-current" />
                        {link.reviewAverage.toFixed(1)}
                        {link.reviewCount != null && (
                          <span className="text-muted-foreground">
                            ({link.reviewCount})
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Category / Style / Tag Editor */}
        <div className="border-t border-border pt-4">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            カテゴリ・スタイル編集
          </h3>
          <CategoryStyleEditor
            category={category}
            style={style}
            tags={tags}
            onCategoryChange={onCategoryChange}
            onStyleChange={onStyleChange}
            onTagsChange={onTagsChange}
          />
        </div>
      </CardContent>
    </Card>
  );
}
