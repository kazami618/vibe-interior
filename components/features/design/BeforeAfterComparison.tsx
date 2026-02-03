'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { GripVertical } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface BeforeAfterComparisonProps {
  beforeImageUrl: string;
  afterImageUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
}

export function BeforeAfterComparison({
  beforeImageUrl,
  afterImageUrl,
  beforeLabel = 'Before',
  afterLabel = 'After',
}: BeforeAfterComparisonProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [containerHeight, setContainerHeight] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const afterImageRef = useRef<HTMLImageElement>(null);

  // After画像がロードされたらコンテナの高さを設定
  const handleAfterImageLoad = useCallback(() => {
    if (afterImageRef.current && containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      const imgNaturalWidth = afterImageRef.current.naturalWidth;
      const imgNaturalHeight = afterImageRef.current.naturalHeight;

      // コンテナ幅に対する画像の高さを計算
      const scaledHeight = (containerWidth / imgNaturalWidth) * imgNaturalHeight;
      setContainerHeight(scaledHeight);
    }
  }, []);

  // ウィンドウリサイズ時に高さを再計算
  useEffect(() => {
    const handleResize = () => {
      handleAfterImageLoad();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleAfterImageLoad]);

  const handleMove = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setSliderPosition(percentage);
    },
    []
  );

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        handleMove(e.clientX);
      }
    },
    [isDragging, handleMove]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      handleMove(e.touches[0].clientX);
    },
    [handleMove]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      handleMove(e.clientX);
    },
    [handleMove]
  );

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div
          ref={containerRef}
          className="relative select-none cursor-ew-resize bg-muted"
          style={{ height: containerHeight ? `${containerHeight}px` : 'auto' }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleClick}
        >
          {/* After画像（生成画像）- ベース */}
          <img
            ref={afterImageRef}
            src={afterImageUrl}
            alt={afterLabel}
            className="w-full h-full object-contain"
            draggable={false}
            onLoad={handleAfterImageLoad}
          />

          {/* Before画像（元画像）- クリップ表示 */}
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ width: `${sliderPosition}%` }}
          >
            <div
              className="h-full flex items-center"
              style={{ width: `${100 / (sliderPosition / 100)}%` }}
            >
              <img
                src={beforeImageUrl}
                alt={beforeLabel}
                className="w-full h-full object-contain"
                draggable={false}
              />
            </div>
          </div>

          {/* スライダーライン */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-white shadow-lg"
            style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
          >
            {/* スライダーハンドル */}
            <div
              className={cn(
                'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
                'w-10 h-10 rounded-full bg-white shadow-lg',
                'flex items-center justify-center',
                'cursor-ew-resize transition-transform',
                isDragging && 'scale-110'
              )}
              onMouseDown={handleMouseDown}
              onTouchStart={handleMouseDown}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleMouseUp}
            >
              <GripVertical className="h-5 w-5 text-gray-600" />
            </div>
          </div>

          {/* ラベル */}
          <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-black/50 text-white text-sm font-medium">
            {beforeLabel}
          </div>
          <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-black/50 text-white text-sm font-medium">
            {afterLabel}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
