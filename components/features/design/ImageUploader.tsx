'use client';

import { useCallback } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
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
      // 同じファイルを再選択できるようにリセット
      e.target.value = '';
    },
    [onFileSelect]
  );

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {previewUrl ? (
          <div className="relative aspect-video">
            <img
              src={previewUrl}
              alt="アップロードした画像のプレビュー"
              className="w-full h-full object-cover"
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2"
              onClick={onClear}
              disabled={disabled}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className={cn(
              'aspect-video flex flex-col items-center justify-center gap-4 border-2 border-dashed border-border rounded-lg transition-colors',
              disabled
                ? 'cursor-not-allowed opacity-50'
                : 'cursor-pointer hover:border-primary hover:bg-accent/50'
            )}
          >
            <label
              htmlFor="image-upload"
              className={cn(
                'flex flex-col items-center justify-center gap-4 w-full h-full p-8',
                disabled ? 'cursor-not-allowed' : 'cursor-pointer'
              )}
            >
              <div className="p-4 rounded-full bg-muted">
                <Upload className="h-8 w-8 text-muted-foreground" />
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
                id="image-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={handleFileInput}
                disabled={disabled}
              />
            </label>
          </div>
        )}

        {error && (
          <div className="p-4 bg-destructive/10 border-t border-destructive/20">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
