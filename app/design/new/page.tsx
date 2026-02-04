'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, ChevronLeft, Ticket } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import { useAuth } from '@/lib/auth';
import { useImageUpload } from '@/lib/hooks/useImageUpload';
import { useDesignGeneration } from '@/lib/hooks/useDesignGeneration';
import { loadDesignState, clearDesignState } from '@/lib/designState';
import type {
  DesignStyle,
  Scenario,
  RoomType,
  ItemCategory,
} from '@/lib/types/design';
import { getDefaultItemsForRoom } from '@/lib/types/design';

import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ImageUploader } from '@/components/features/design/ImageUploader';
import { StyleSelector } from '@/components/features/design/StyleSelector';
import { GenerateButton } from '@/components/features/design/GenerateButton';
import { GenerationProgress } from '@/components/features/design/GenerationProgress';
import { StepIndicator } from '@/components/features/design/StepIndicator';
import { ScenarioSelector } from '@/components/features/design/ScenarioSelector';
import { RoomTypeSelector } from '@/components/features/design/RoomTypeSelector';
import { ItemCategorySelector } from '@/components/features/design/ItemCategorySelector';

const STEPS = ['シナリオ', '画像', '部屋', 'スタイル', 'アイテム', '確認'];

function DesignNewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userData, loading: authLoading } = useAuth();
  const {
    file,
    previewUrl,
    uploading,
    error: uploadError,
    selectFile,
    uploadFile,
    clearFile,
    restoreFromDataUrl,
  } = useImageUpload();
  const { generating, error: generateError, generate } = useDesignGeneration();

  // Step management
  const [currentStep, setCurrentStep] = useState(0);

  // Form state
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [roomType, setRoomType] = useState<RoomType | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<DesignStyle>('modern');
  const [addItems, setAddItems] = useState<ItemCategory[]>([]);
  const [keepItems, setKeepItems] = useState<ItemCategory[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const stateRestoredRef = useRef(false);
  const toastShownRef = useRef(false);

  // 購入後の状態復元と成功トースト
  useEffect(() => {
    const restore = searchParams.get('restore');
    const purchaseSuccess = searchParams.get('purchase_success');
    const quantity = searchParams.get('quantity');

    // 状態を復元（一度だけ）
    if (restore === 'true' && !stateRestoredRef.current) {
      stateRestoredRef.current = true;
      const savedState = loadDesignState();

      if (savedState) {
        setScenario(savedState.scenario);
        setRoomType(savedState.roomType);
        setSelectedStyle(savedState.selectedStyle);
        setAddItems(savedState.addItems);
        setKeepItems(savedState.keepItems);
        // 画像をdata URLから復元
        if (savedState.previewUrl) {
          restoreFromDataUrl(savedState.previewUrl);
        }
        // 確認ステップに直接移動
        setCurrentStep(5);
        // 保存データをクリア
        clearDesignState();
      }
    }

    // 購入成功トースト（一度だけ）
    if (purchaseSuccess === 'true' && !toastShownRef.current) {
      toastShownRef.current = true;

      // URLからクエリパラメータを削除
      router.replace('/design/new', { scroll: false });

      setTimeout(() => {
        const message = quantity
          ? `${quantity}枚のチケット購入が完了しました！`
          : 'チケット購入が完了しました！';
        toast.success(message, {
          duration: 4000,
          icon: <Ticket className="w-5 h-5" />,
          description: 'デザインを生成できます',
        });
      }, 300);
    }
  }, [searchParams, router, restoreFromDataUrl]);

  // シナリオと部屋タイプに基づいてデフォルトアイテムを設定（復元時はスキップ）
  useEffect(() => {
    if (scenario && !stateRestoredRef.current) {
      const defaults = getDefaultItemsForRoom(roomType, scenario);
      setAddItems(defaults.add);
      setKeepItems(defaults.keep);
    }
  }, [scenario, roomType]);

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
    if (!file || !scenario || !roomType) return;

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

      // 2. デザイン生成（新しいパラメータを含める）
      console.log('Starting generation...');
      const generateResult = await generate(
        selectedStyle,
        uploadResult.path,
        [], // targetItems (legacy) - 空配列
        [], // preservedItems (legacy) - 空配列
        {
          scenario,
          roomType,
          addItems,
          keepItems,
        }
      );
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

  const canProceedToNextStep = (): boolean => {
    switch (currentStep) {
      case 0: // シナリオ
        return scenario !== null;
      case 1: // 画像
        return file !== null;
      case 2: // 部屋タイプ
        return roomType !== null;
      case 3: // スタイル
        return selectedStyle !== null;
      case 4: // アイテム
        return addItems.length > 0;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1 && canProceedToNextStep()) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
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

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // シナリオ選択
        return (
          <ScenarioSelector
            value={scenario}
            onChange={setScenario}
            disabled={isDisabled}
          />
        );

      case 1: // 画像アップロード
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">部屋の画像</h2>
              <p className="text-sm text-muted-foreground">
                コーディネートしたい部屋の画像をアップロードしてください
              </p>
            </div>
            <ImageUploader
              previewUrl={previewUrl}
              error={null}
              onFileSelect={selectFile}
              onClear={clearFile}
              disabled={isDisabled}
            />
          </div>
        );

      case 2: // 部屋タイプ選択
        return (
          <RoomTypeSelector
            value={roomType}
            onChange={setRoomType}
            disabled={isDisabled}
          />
        );

      case 3: // スタイル選択
        return (
          <StyleSelector
            value={selectedStyle}
            onChange={setSelectedStyle}
            disabled={isDisabled}
          />
        );

      case 4: // アイテム選択
        const defaults = getDefaultItemsForRoom(roomType, scenario);
        return (
          <div className="space-y-6">
            <ItemCategorySelector
              title={scenario === 'redecorate' ? '追加したいアイテム' : '購入したいアイテム'}
              description={
                scenario === 'redecorate'
                  ? 'お部屋に追加したいアイテムを選択してください'
                  : '新居に置きたいアイテムを選択してください'
              }
              selectedItems={addItems}
              onSelectedItemsChange={setAddItems}
              disabled={isDisabled}
              defaultItems={defaults.add}
            />
            {scenario === 'redecorate' && (
              <ItemCategorySelector
                title="残したいアイテム"
                description="そのまま使い続けたいアイテムを選択してください"
                selectedItems={keepItems}
                onSelectedItemsChange={setKeepItems}
                disabled={isDisabled}
                defaultItems={defaults.keep}
              />
            )}
          </div>
        );

      case 5: // 確認・生成
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold">設定内容の確認</h2>
              <p className="text-sm text-muted-foreground">
                以下の内容でデザインを生成します
              </p>
            </div>

            <div className="space-y-4 bg-muted/50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">シナリオ</span>
                <span className="font-medium">
                  {scenario === 'redecorate' ? '模様替え' : '引越し・新生活'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">部屋タイプ</span>
                <span className="font-medium">
                  {roomType === 'living' && 'リビング'}
                  {roomType === 'dining' && 'ダイニング'}
                  {roomType === 'bedroom' && '寝室'}
                  {roomType === 'one_room' && 'ワンルーム'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">スタイル</span>
                <span className="font-medium">
                  {selectedStyle === 'scandinavian' && '北欧'}
                  {selectedStyle === 'modern' && 'モダン'}
                  {selectedStyle === 'vintage' && 'ヴィンテージ'}
                  {selectedStyle === 'industrial' && 'インダストリアル'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {scenario === 'redecorate' ? '追加アイテム' : '購入アイテム'}
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {addItems.map((item) => (
                    <span
                      key={item}
                      className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              {scenario === 'redecorate' && keepItems.length > 0 && (
                <div>
                  <span className="text-muted-foreground">残すアイテム</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {keepItems.map((item) => (
                      <span
                        key={item}
                        className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded-full"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {previewUrl && (
                <div>
                  <span className="text-muted-foreground">アップロード画像</span>
                  <img
                    src={previewUrl}
                    alt="アップロード画像"
                    className="mt-2 rounded-lg max-h-40 object-cover"
                  />
                </div>
              )}
            </div>

            <GenerateButton
              onClick={handleGenerate}
              disabled={!file || isDisabled}
              loading={isProcessing}
              ticketBalance={userData?.ticketBalance ?? 0}
              designState={{
                scenario,
                roomType,
                selectedStyle,
                addItems,
                keepItems,
                previewUrl,
              }}
            />
          </div>
        );

      default:
        return null;
    }
  };

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

        {/* ステップインジケーター */}
        <StepIndicator steps={STEPS} currentStep={currentStep} />

        {/* エラー表示 */}
        {error && (
          <Alert variant="destructive">
            <AlertTitle>エラー</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* ステップコンテンツ */}
        <div className="min-h-[300px]">{renderStepContent()}</div>

        {/* ナビゲーションボタン */}
        {currentStep < STEPS.length - 1 && (
          <div className="flex justify-between pt-6 border-t border-border">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={currentStep === 0 || isDisabled}
              className="text-muted-foreground"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              戻る
            </Button>
            <Button
              onClick={handleNext}
              disabled={!canProceedToNextStep() || isDisabled}
              className={
                canProceedToNextStep() && !isDisabled
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 px-8'
                  : ''
              }
            >
              次へ
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {/* 最終ステップでは戻るボタンのみ */}
        {currentStep === STEPS.length - 1 && (
          <div className="flex justify-start pt-6 border-t border-border">
            <Button variant="ghost" onClick={handleBack} disabled={isDisabled} className="text-muted-foreground">
              <ChevronLeft className="h-4 w-4 mr-1" />
              戻る
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DesignNewPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <GenerationProgress message="読み込み中..." />
          </div>
        </div>
      }
    >
      <DesignNewContent />
    </Suspense>
  );
}
