'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, onSnapshot, collection, getDocs } from 'firebase/firestore';
import { ArrowLeft, Download, Plus, AlertCircle, ExternalLink, Share2 } from 'lucide-react';
import Link from 'next/link';

import { ref, getDownloadURL } from 'firebase/storage';
import { useAuth } from '@/lib/auth';
import { db, storage } from '@/lib/firebase';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { GenerationProgress } from '@/components/features/design/GenerationProgress';

interface FirestoreDesign {
  designId: string;
  userId: string;
  title: string;
  originalImageUrl: string;
  generatedImageUrl: string;
  generationOptions?: {
    style?: string;
  };
  usedItemIds?: string[];
  status: 'processing' | 'completed' | 'failed';
  errorMessage?: string;
  createdAt: { toDate: () => Date } | null;
  updatedAt: { toDate: () => Date } | null;
}

interface PurchaseLinkInfo {
  source: 'amazon' | 'rakuten' | 'official' | 'other';
  url: string;
  affiliateUrl?: string;
  price?: number;
}

interface FurnitureItem {
  itemId: string;
  productId: string;
  name: string;
  category: string;
  imageUrl: string;
  affiliateUrl: string;
  price: number;
  reason: string;
  itemNumber?: number;
  position?: { x: number; y: number };
  reviewAverage?: number;
  reviewCount?: number;
  source?: 'rakuten' | 'amazon';
  purchaseLinks?: PurchaseLinkInfo[];
}

export default function DesignResultClient() {
  const router = useRouter();
  const params = useParams();

  // 静的エクスポート対応: URLから直接IDを取得（useParamsが初期化される前のフォールバック）
  const [designId, setDesignId] = useState<string | null>(null);
  const [paramsReady, setParamsReady] = useState(false);

  useEffect(() => {
    // クライアントサイドでURLからIDを取得
    if (typeof window !== 'undefined') {
      const pathParts = window.location.pathname.split('/');
      // /design/[id] の形式からIDを抽出
      if (pathParts[1] === 'design' && pathParts[2] && pathParts[2] !== 'new') {
        setDesignId(pathParts[2]);
      }
      setParamsReady(true);
    }
  }, []);

  // useParamsからも取得を試みる（フォールバック）
  useEffect(() => {
    const idArray = params.id as string[] | undefined;
    if (idArray?.[0]) {
      setDesignId(idArray[0]);
    }
  }, [params]);

  const { user, loading: authLoading } = useAuth();

  const [design, setDesign] = useState<FirestoreDesign | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [furnitureItems, setFurnitureItems] = useState<FurnitureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);
  const [highlightedItemNumber, setHighlightedItemNumber] = useState<number | null>(null);

  // Web Share API対応チェック
  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && !!navigator.share);
  }, []);

  // IDがない場合は/design/newにリダイレクト（paramsReady後のみ）
  useEffect(() => {
    if (paramsReady && !designId && !authLoading) {
      router.push('/design/new');
    }
  }, [designId, authLoading, paramsReady, router]);

  // 認証チェック
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [authLoading, user, router]);

  // デザインデータのリアルタイム監視
  useEffect(() => {
    if (!user || !designId) return;

    const designRef = doc(db, 'designs', designId);
    const unsubscribe = onSnapshot(
      designRef,
      async (snapshot) => {
        if (!snapshot.exists()) {
          setError('デザインが見つかりません');
          setLoading(false);
          return;
        }

        const data = snapshot.data() as FirestoreDesign;

        // 自分のデザインか確認
        if (data.userId !== user.uid) {
          setError('このデザインにはアクセスできません');
          setLoading(false);
          return;
        }

        setDesign(data);

        // 元画像のダウンロードURLを取得
        if (data.originalImageUrl && !data.originalImageUrl.startsWith('http')) {
          const imageRef = ref(storage, data.originalImageUrl);
          getDownloadURL(imageRef)
            .then((url) => setOriginalImageUrl(url))
            .catch((err) => console.error('Error getting original image URL:', err));
        } else {
          setOriginalImageUrl(data.originalImageUrl);
        }

        // 家具アイテムを取得
        if (data.status === 'completed') {
          const furnitureRef = collection(db, 'designs', designId, 'furnitureItems');
          const furnitureSnapshot = await getDocs(furnitureRef);
          const items = furnitureSnapshot.docs.map((doc) => ({
            itemId: doc.id,
            ...doc.data(),
          })) as FurnitureItem[];
          setFurnitureItems(items);
        }

        setLoading(false);
      },
      (err) => {
        console.error('Error fetching design:', err);
        setError('デザインの読み込みに失敗しました');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, designId]);

  // ダウンロード処理
  const handleDownload = async () => {
    if (!design?.generatedImageUrl) return;

    try {
      const response = await fetch(design.generatedImageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vibe-interior-${designId}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  // シェア処理
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = '部屋づくりAIで部屋をコーディネートしました！';
  const shareHashtags = '部屋づくりAI,AIインテリア,模様替え';

  // 画像をBlobとして取得
  const getImageBlob = async (): Promise<Blob | null> => {
    if (!design?.generatedImageUrl) return null;
    try {
      const response = await fetch(design.generatedImageUrl);
      return await response.blob();
    } catch (err) {
      console.error('Failed to fetch image:', err);
      return null;
    }
  };

  // ネイティブシェア（Web Share API）
  const handleNativeShare = async () => {
    if (!navigator.share) return;

    try {
      const blob = await getImageBlob();
      const shareData: ShareData = {
        title: design?.title || 'AIコーディネート',
        text: shareText,
        url: shareUrl,
      };

      // 画像付きシェア（対応している場合）
      if (blob && navigator.canShare) {
        const file = new File([blob], 'vibe-interior.jpg', { type: 'image/jpeg' });
        const dataWithFile = { ...shareData, files: [file] };
        if (navigator.canShare(dataWithFile)) {
          await navigator.share(dataWithFile);
          return;
        }
      }

      // 画像なしシェア
      await navigator.share(shareData);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Share failed:', err);
      }
    }
  };

  const handleShareTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}&hashtags=${encodeURIComponent(shareHashtags)}`;
    window.open(url, '_blank', 'width=550,height=420');
  };

  const handleShareLine = () => {
    const url = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank', 'width=550,height=420');
  };

  // 画像付きでTwitterにシェア（モバイルはネイティブシェア推奨）
  const handleShareTwitterWithImage = async () => {
    // モバイルでネイティブシェアが使える場合はそちらを使用
    if (navigator.share && navigator.canShare) {
      try {
        const blob = await getImageBlob();
        if (blob) {
          const file = new File([blob], 'vibe-interior.jpg', { type: 'image/jpeg' });
          const shareData = { files: [file], text: `${shareText} #VibeInterior #AIインテリア`, url: shareUrl };
          if (navigator.canShare(shareData)) {
            await navigator.share(shareData);
            return;
          }
        }
      } catch (err) {
        console.log('Native share not available, falling back to Twitter intent');
      }
    }
    // フォールバック: Twitter Intent URL
    handleShareTwitter();
  };

  // 画像付きでLINEにシェア（モバイルはネイティブシェア推奨）
  const handleShareLineWithImage = async () => {
    // モバイルでネイティブシェアが使える場合はそちらを使用
    if (navigator.share && navigator.canShare) {
      try {
        const blob = await getImageBlob();
        if (blob) {
          const file = new File([blob], 'vibe-interior.jpg', { type: 'image/jpeg' });
          const shareData = { files: [file], text: shareText, url: shareUrl };
          if (navigator.canShare(shareData)) {
            await navigator.share(shareData);
            return;
          }
        }
      } catch (err) {
        console.log('Native share not available, falling back to LINE');
      }
    }
    // フォールバック: LINE Share URL
    handleShareLine();
  };

  // パラメータ初期化中またはIDがない場合
  if (!paramsReady || !designId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <GenerationProgress message="読み込み中..." />
        </div>
      </div>
    );
  }

  // ローディング中
  if (authLoading || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <GenerationProgress message="読み込み中..." />
        </div>
      </div>
    );
  }

  // 未ログイン
  if (!user) {
    return null;
  }

  // エラー
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Button variant="ghost" asChild>
            <Link href="/">
              <ArrowLeft className="h-5 w-5 mr-2" />
              ホームに戻る
            </Link>
          </Button>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>エラー</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // デザインなし
  if (!design) {
    return null;
  }

  // 処理中
  if (design.status === 'processing') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">デザイン生成中</h1>
          </div>
          <GenerationProgress message="AIがデザインを生成しています..." />
        </div>
      </div>
    );
  }

  // 失敗
  if (design.status === 'failed') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">生成失敗</h1>
          </div>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>生成に失敗しました</AlertTitle>
            <AlertDescription>
              {design.errorMessage || 'エラーが発生しました。もう一度お試しください。'}
            </AlertDescription>
          </Alert>
          <Button asChild>
            <Link href="/design/new">
              <Plus className="h-5 w-5 mr-2" />
              新しいデザインを作成
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // 完了
  const styleLabel = getStyleLabel(design.generationOptions?.style);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/mypage">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{design.title}</h1>
              <p className="text-sm text-muted-foreground">
                {styleLabel}スタイル
              </p>
            </div>
          </div>
        </div>

        {/* メイン画像（オーバーレイ番号付き） */}
        <div className="relative rounded-lg overflow-hidden shadow-lg">
          <img
            src={design.generatedImageUrl}
            alt="AIデザイン"
            className="w-full"
          />
          {/* オーバーレイマーカー */}
          {furnitureItems.map((item) =>
            item.position ? (
              <button
                key={item.itemId}
                className={`absolute w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-lg transform -translate-x-1/2 -translate-y-1/2 transition-all cursor-pointer hover:scale-125 ${
                  highlightedItemNumber === item.itemNumber
                    ? 'bg-primary text-primary-foreground ring-2 ring-white scale-125'
                    : 'bg-white/90 text-gray-800 hover:bg-primary hover:text-primary-foreground'
                }`}
                style={{
                  left: `${item.position.x}%`,
                  top: `${item.position.y}%`,
                }}
                onClick={() => {
                  setHighlightedItemNumber(
                    highlightedItemNumber === item.itemNumber ? null : item.itemNumber ?? null
                  );
                  const element = document.getElementById(`furniture-item-${item.itemNumber}`);
                  element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
              >
                {getCircledNumber(item.itemNumber || 0)}
              </button>
            ) : null
          )}
        </div>

        {/* アクションボタン + シェアボタン */}
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              ダウンロード
            </Button>
            <Button variant="outline" asChild>
              <Link href="/design/new">
                <Plus className="h-4 w-4 mr-2" />
                新規作成
              </Link>
            </Button>
          </div>

          {/* シェアボタン */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* ネイティブシェア（モバイル向け） */}
            {canShare && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleNativeShare}
                className="gap-1"
              >
                <Share2 className="h-4 w-4" />
                シェア
              </Button>
            )}

            {/* X (Twitter) */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleShareTwitterWithImage}
              className="bg-black text-white hover:bg-gray-800 border-none"
              title="X (Twitter)でシェア"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </Button>

            {/* LINE */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleShareLineWithImage}
              className="bg-[#00B900] text-white hover:bg-[#00A000] border-none"
              title="LINEでシェア"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
              </svg>
            </Button>

          </div>
        </div>

        {/* 使用された家具リスト */}
        {furnitureItems.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              このコーディネートに使われた家具
              <span className="text-sm font-normal text-muted-foreground">
                ({furnitureItems.length}点)
              </span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[...furnitureItems]
                .sort((a, b) => (a.itemNumber || 999) - (b.itemNumber || 999))
                .map((item) => (
                <div
                  key={item.itemId}
                  id={`furniture-item-${item.itemNumber}`}
                  className={`transition-all duration-300 rounded-lg ${
                    highlightedItemNumber === item.itemNumber
                      ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                      : ''
                  }`}
                  onClick={() => setHighlightedItemNumber(
                    highlightedItemNumber === item.itemNumber ? null : item.itemNumber ?? null
                  )}
                >
                  <Card className={`overflow-hidden transition-all hover:shadow-lg ${
                      highlightedItemNumber === item.itemNumber
                        ? 'border-primary shadow-lg'
                        : 'hover:border-primary/50'
                    }`}>
                      <div className="flex">
                        {/* 商品画像 */}
                        <div className="w-28 h-28 flex-shrink-0 bg-muted relative">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                              No Image
                            </div>
                          )}
                          {/* アイテム番号バッジ（①②③形式） */}
                          {item.itemNumber && (
                            <div className={`absolute top-1 left-1 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shadow-md transition-all ${
                              highlightedItemNumber === item.itemNumber
                                ? 'bg-primary text-primary-foreground scale-110'
                                : 'bg-primary text-primary-foreground'
                            }`}>
                              {getCircledNumber(item.itemNumber)}
                            </div>
                          )}
                        </div>
                        {/* 商品情報 */}
                        <div className="flex-1 p-3 flex flex-col justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                              {item.itemNumber && (
                                <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold transition-all ${
                                  highlightedItemNumber === item.itemNumber
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-primary/10 text-primary'
                                }`}>
                                  {getCircledNumber(item.itemNumber)}
                                </span>
                              )}
                              {item.category}
                            </p>
                            <h3 className="font-medium text-sm line-clamp-2">
                              {item.name}
                            </h3>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-primary">
                                ¥{item.price?.toLocaleString() || '-'}
                              </span>
                              {item.reviewCount && item.reviewCount > 0 && (
                                <span className="text-xs text-amber-500 flex items-center gap-0.5">
                                  <span>★</span>
                                  <span>{item.reviewAverage?.toFixed(1) || '-'}</span>
                                  <span className="text-muted-foreground">({item.reviewCount})</span>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {item.purchaseLinks && item.purchaseLinks.length > 0 ? (
                                item.purchaseLinks.map((link, idx) => (
                                  <a
                                    key={idx}
                                    href={link.affiliateUrl || link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className={`text-xs font-medium flex items-center gap-1 px-2 py-1 rounded transition-all ${
                                      link.source === 'amazon'
                                        ? 'bg-[#FF9900] text-white hover:bg-[#E88B00]'
                                        : 'bg-[#BF0000] text-white hover:bg-[#A00000]'
                                    }`}
                                  >
                                    {link.source === 'amazon' ? 'Amazon' : '楽天'}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                ))
                              ) : (
                                <a
                                  href={item.affiliateUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className={`text-xs font-medium flex items-center gap-1 px-2 py-1 rounded transition-all ${
                                    item.source === 'amazon'
                                      ? 'bg-[#FF9900] text-white hover:bg-[#E88B00]'
                                      : 'bg-[#BF0000] text-white hover:bg-[#A00000]'
                                  }`}
                                >
                                  {item.source === 'amazon' ? 'Amazonで見る' : '楽天市場で見る'}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Before/After 比較 */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Before</CardTitle>
            </CardHeader>
            <CardContent>
              {originalImageUrl ? (
                <img
                  src={originalImageUrl}
                  alt="元の部屋"
                  className="w-full rounded-lg"
                />
              ) : (
                <div className="w-full aspect-video bg-muted rounded-lg animate-pulse" />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">After</CardTitle>
            </CardHeader>
            <CardContent>
              <img
                src={design.generatedImageUrl}
                alt="AIデザイン後"
                className="w-full rounded-lg"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function getStyleLabel(style?: string): string {
  const labels: Record<string, string> = {
    scandinavian: '北欧',
    modern: 'モダン',
    vintage: 'ヴィンテージ',
    industrial: 'インダストリアル',
  };
  return labels[style || 'modern'] || style || 'モダン';
}

function getCircledNumber(num: number): string {
  const circledNumbers = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
  if (num >= 1 && num <= 10) {
    return circledNumbers[num - 1];
  }
  return `(${num})`;
}
