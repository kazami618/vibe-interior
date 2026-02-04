'use client';

import { useCallback, useRef } from 'react';
import { Upload, Camera, ImageIcon, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ImageUploaderProps {
  previewUrl: string | null;
  error: string | null;
  onFileSelect: (file: File) => void;
  onClear: () => void;
  disabled?: boolean;
}

export function ImageUploader({
  previewUrl,
  error,
  onFileSelect,
  onClear,
  disabled = false,
}: ImageUploaderProps) {
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (disabled) return;

      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        onFileSelect(file);
      }
    },
    [onFileSelect, disabled]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFileSelect(file);
      }
      e.target.value = '';
    },
    [onFileSelect]
  );

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden border-2 border-dashed border-border">
        <CardContent className="p-0">
          {previewUrl ? (
            <div className="relative aspect-video bg-neutral-900">
              <img
                src={previewUrl}
                alt="アップロードした画像のプレビュー"
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className={cn(
                'aspect-video flex flex-col items-center justify-center gap-4 transition-colors p-6',
                disabled
                  ? 'cursor-not-allowed opacity-50'
                  : ''
              )}
            >
              {/* PC用: ドラッグ&ドロップエリア */}
              <div className="hidden sm:flex flex-col items-center gap-4 w-full">
                <label
                  htmlFor="image-upload-pc"
                  className={cn(
                    'flex flex-col items-center justify-center gap-4 w-full p-8 cursor-pointer hover:bg-emerald-500/5 rounded-lg transition-colors',
                    disabled && 'cursor-not-allowed'
                  )}
                >
                  <div className="p-4 rounded-full bg-emerald-500/10">
                    <Upload className="h-8 w-8 text-emerald-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">
                      クリックまたはドラッグ&ドロップで画像をアップロード
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      JPEG、PNG、WebP形式（最大10MB）
                    </p>
                  </div>
                  <input
                    id="image-upload-pc"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={handleFileInput}
                    disabled={disabled}
                  />
                </label>
              </div>

              {/* スマホ用: カメラ/アルバム選択ボタン */}
              <div className="flex sm:hidden flex-col items-center gap-4 w-full">
                <div className="p-3 rounded-full bg-emerald-500/10">
                  <Upload className="h-6 w-6 text-emerald-500" />
                </div>
                <p className="text-sm font-medium text-center">
                  部屋の写真をアップロード
                </p>
                <p className="text-xs text-muted-foreground">
                  JPEG、PNG、WebP形式（最大10MB）
                </p>
                <div className="flex gap-3 w-full max-w-xs">
                  {/* カメラで撮影 */}
                  <label
                    htmlFor="image-upload-camera"
                    className={cn(
                      'flex-1 flex flex-col items-center gap-2 p-4 bg-emerald-500 text-white rounded-lg cursor-pointer active:bg-emerald-600 transition-colors',
                      disabled && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <Camera className="h-6 w-6" />
                    <span className="text-sm font-medium">カメラで撮影</span>
                    <input
                      id="image-upload-camera"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="sr-only"
                      onChange={handleFileInput}
                      disabled={disabled}
                    />
                  </label>
                  {/* アルバムから選択 */}
                  <label
                    htmlFor="image-upload-gallery"
                    className={cn(
                      'flex-1 flex flex-col items-center gap-2 p-4 bg-white border-2 border-emerald-500 text-emerald-600 rounded-lg cursor-pointer active:bg-emerald-50 transition-colors',
                      disabled && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <ImageIcon className="h-6 w-6" />
                    <span className="text-sm font-medium">アルバムから</span>
                    <input
                      id="image-upload-gallery"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={handleFileInput}
                      disabled={disabled}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-destructive/10 border-t border-destructive/20">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 画像変更ボタン（画像がある場合のみ表示） */}
      {previewUrl && (
        <Button
          variant="outline"
          onClick={onClear}
          disabled={disabled}
          className="w-full border-2 hover:border-orange-500 hover:text-orange-500 hover:bg-orange-500/5"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          画像を変更する
        </Button>
      )}
    </div>
  );
}
