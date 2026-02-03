'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { useAuth } from '@/lib/auth';
import { useImageUpload } from '@/lib/hooks/useImageUpload';
import { useDesignGeneration } from '@/lib/hooks/useDesignGeneration';
import type { DesignStyle, TargetItem, PreservedItem } from '@/lib/types/design';
import {
  TARGET_ITEMS,
  PRESERVED_ITEMS,
  DEFAULT_TARGET_ITEMS,
  DEFAULT_PRESERVED_ITEMS,
} from '@/lib/types/design';

import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ImageUploader } from '@/components/features/design/ImageUploader';
import { StyleSelector } from '@/components/features/design/StyleSelector';
import { ItemSelector } from '@/components/features/design/ItemSelector';
import { GenerateButton } from '@/components/features/design/GenerateButton';
import { GenerationProgress } from '@/components/features/design/GenerationProgress';

export default function DesignNewPage() {
  const router = useRouter();
  const { user, userData, loading: authLoading } = useAuth();
  const {
    file,
    previewUrl,
    uploading,
    error: uploadError,
    selectFile,
    uploadFile,
    clearFile,
  } = useImageUpload();
  const { generating, error: generateError, generate } = useDesignGeneration();

  const [selectedStyle, setSelectedStyle] = useState<DesignStyle>('modern');
  const [targetItems, setTargetItems] = useState<TargetItem[]>(DEFAULT_TARGET_ITEMS);
  const [preservedItems, setPreservedItems] = useState<PreservedItem[]>(DEFAULT_PRESERVED_ITEMS);
  const [isProcessing, setIsProcessing] = useState(false);

  // 未ログインの場合はリダイレクト
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [authLoading, user, router]);

  // ローディング中
  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <GenerationProgress message="読み込み中..." />
        </div>
      </div>
    );
  }

  // 未ログイン
  if (!user) {
    return null;
  }

  const handleGenerate = async () => {
    if (!file) return;

    setIsProcessing(true);

    try {
      // 1. 画像をアップロード
      console.log('Starting upload...');
      const uploadResult = await uploadFile();
      console.log('Upload result:', uploadResult);

      if (!uploadResult) {
        console.log('Upload failed, stopping');
        setIsProcessing(false);
        return;
      }

      // 2. デザイン生成
      console.log('Starting generation...');
      const generateResult = await generate(selectedStyle, uploadResult.path, targetItems, preservedItems);
      console.log('Generation result:', generateResult);

      if (!generateResult) {
        console.log('Generation failed, stopping');
        setIsProcessing(false);
        return;
      }

      // 3. 結果ページにリダイレクト
      router.push(`/design/${generateResult.designId}`);
    } catch (error) {
      console.error('Error generating design:', error);
      setIsProcessing(false);
    }
  };

  const error = uploadError || generateError;
  const isDisabled = isProcessing || uploading || generating;

  // 生成中の表示
  if (isProcessing) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <GenerationProgress
            message={
              uploading
                ? '画像をアップロードしています...'
                : 'AIがデザインを生成しています...'
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">新しいデザインを作成</h1>
            <p className="text-sm text-muted-foreground">
              部屋の画像をアップロードして、AIでインテリアをコーディネート
            </p>
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <Alert variant="destructive">
            <AlertTitle>エラー</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 画像アップロード */}
        <div>
          <h2 className="text-lg font-semibold mb-3">部屋の画像</h2>
          <ImageUploader
            previewUrl={previewUrl}
            error={null}
            onFileSelect={selectFile}
            onClear={clearFile}
            disabled={isDisabled}
          />
        </div>

        {/* スタイル選択 */}
        <StyleSelector
          value={selectedStyle}
          onChange={setSelectedStyle}
          disabled={isDisabled}
        />

        {/* 変更・追加したいアイテム */}
        <ItemSelector
          title="変更・追加したいアイテム"
          description="AIが変更または追加するアイテムを選択してください"
          options={TARGET_ITEMS}
          selectedItems={targetItems}
          onSelectedItemsChange={(items) => setTargetItems(items as TargetItem[])}
          disabled={isDisabled}
        />

        {/* 維持したいアイテム */}
        <ItemSelector
          title="維持したいアイテム"
          description="賃貸物件の場合、壁や床などは変更できないため維持する項目を選択してください"
          options={PRESERVED_ITEMS}
          selectedItems={preservedItems}
          onSelectedItemsChange={(items) => setPreservedItems(items as PreservedItem[])}
          disabled={isDisabled}
        />

        {/* 生成ボタン */}
        <GenerateButton
          onClick={handleGenerate}
          disabled={!file || isDisabled}
          loading={isProcessing}
          ticketBalance={userData?.ticketBalance ?? 0}
        />
      </div>
    </div>
  );
}
