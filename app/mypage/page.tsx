'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { Plus, Image as ImageIcon, Calendar, Ticket, Sparkles, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface DesignItem {
  id: string;
  title: string;
  generatedImageUrl: string;
  originalImageUrl: string;
  status: 'processing' | 'completed' | 'failed';
  style?: string;
  createdAt: Date | null;
}

function MyPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userData, loading: authLoading } = useAuth();

  const [designs, setDesigns] = useState<DesignItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticketAnimation, setTicketAnimation] = useState(false);
  const [displayedBalance, setDisplayedBalance] = useState<number | null>(null);
  const toastShownRef = useRef(false);
  const animationStartedRef = useRef(false);
  const purchasedQuantityRef = useRef<number>(0);

  // 購入成功の処理
  useEffect(() => {
    const purchaseSuccess = searchParams.get('purchase_success');
    const quantity = searchParams.get('quantity');

    if (purchaseSuccess === 'true' && !toastShownRef.current) {
      toastShownRef.current = true;
      // 購入数量を保存（URLから消える前に）
      purchasedQuantityRef.current = parseInt(quantity || '1', 10);

      // URLからクエリパラメータを削除
      router.replace('/mypage', { scroll: false });

      // 少し遅延させてトーストを表示
      setTimeout(() => {
        const message = quantity
          ? `${quantity}枚のチケット購入が完了しました。購入ありがとうございます 😊`
          : 'チケット購入が完了しました。購入ありがとうございます 😊';

        toast.success(message, {
          duration: 5000,
          icon: <Ticket className="w-5 h-5" />,
        });

        // チケット残高のアニメーションを開始
        setTicketAnimation(true);
      }, 500);
    }
  }, [searchParams, router]);

  // チケット残高のカウントアップアニメーション
  useEffect(() => {
    // アニメーションが既に開始されている場合はスキップ
    if (!ticketAnimation || animationStartedRef.current) return;
    // userDataがロードされるまで待つ
    if (userData?.ticketBalance === undefined) return;

    animationStartedRef.current = true;

    const quantity = purchasedQuantityRef.current;
    const targetBalance = userData.ticketBalance;
    const startBalance = Math.max(0, targetBalance - quantity);

    // カウントアップアニメーション（ゆっくり、目立つように）
    let current = startBalance;
    setDisplayedBalance(current);

    // 数字を1ずつ増やす（より分かりやすく）
    const interval = setInterval(() => {
      current = current + 1;
      setDisplayedBalance(current);

      if (current >= targetBalance) {
        clearInterval(interval);
        // アニメーション完了後も少し残す
        setTimeout(() => {
          setTicketAnimation(false);
          setDisplayedBalance(null); // リセット
          animationStartedRef.current = false;
        }, 2000);
      }
    }, 150); // ゆっくりカウントアップ

    return () => clearInterval(interval);
  }, [ticketAnimation, userData?.ticketBalance]);

  // 認証チェック
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [authLoading, user, router]);

  // デザイン一覧を取得
  useEffect(() => {
    if (!user) return;

    const fetchDesigns = async () => {
      try {
        const designsRef = collection(db, 'designs');
        const q = query(
          designsRef,
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);

        const items: DesignItem[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || 'デザイン',
            generatedImageUrl: data.generatedImageUrl || '',
            originalImageUrl: data.originalImageUrl || '',
            status: data.status,
            style: data.generationOptions?.style,
            createdAt: data.createdAt?.toDate() || null,
          };
        });

        setDesigns(items);
      } catch (err) {
        console.error('Error fetching designs:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDesigns();
  }, [user]);

  // ローディング中
  if (authLoading || !user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <Skeleton className="h-10 w-48 mb-8" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const completedDesigns = designs.filter((d) => d.status === 'completed');
  const processingDesigns = designs.filter((d) => d.status === 'processing');

  // 表示するチケット残高（アニメーション中はdisplayedBalance、それ以外はuserDataから）
  const shownBalance = displayedBalance !== null ? displayedBalance : (userData?.ticketBalance || 0);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">マイページ</h1>
            <p className="text-muted-foreground">
              {userData?.displayName}さんのコーディネート
            </p>
          </div>
          <Button asChild>
            <Link href="/design/new">
              <Plus className="h-4 w-4 mr-2" />
              新規作成
            </Link>
          </Button>
        </div>

        {/* 統計 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-secondary/30">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">作成したデザイン</p>
              <p className="text-2xl font-bold">{completedDesigns.length}</p>
            </CardContent>
          </Card>
          <Card className={`relative overflow-hidden transition-all duration-500 ${
            ticketAnimation
              ? 'ring-4 ring-green-500 bg-gradient-to-br from-green-500/20 to-emerald-500/20 shadow-lg shadow-green-500/30'
              : 'bg-secondary/30 hover:bg-secondary/50'
          }`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Ticket className={`w-4 h-4 transition-all duration-300 ${ticketAnimation ? 'text-green-500 animate-bounce' : ''}`} />
                    チケット残高
                  </p>
                  <div className="flex items-baseline gap-2">
                    <p className={`text-3xl font-bold transition-all duration-300 ${
                      ticketAnimation ? 'text-green-500 scale-125 animate-pulse' : ''
                    }`}>
                      {shownBalance}
                    </p>
                    <span className="text-sm text-muted-foreground">枚</span>
                  </div>
                </div>
                <Link href="/purchase">
                  <Button
                    variant="outline"
                    size="sm"
                    className={`transition-all ${
                      ticketAnimation
                        ? 'border-green-500 text-green-500 hover:bg-green-500/10'
                        : 'hover:bg-primary/10'
                    }`}
                  >
                    <ShoppingCart className="w-4 h-4 mr-1" />
                    購入
                  </Button>
                </Link>
              </div>
              {/* アニメーション中のキラキラエフェクト */}
              {ticketAnimation && (
                <>
                  <div className="absolute top-1 right-1">
                    <Sparkles className="w-5 h-5 text-yellow-400 animate-ping" />
                  </div>
                  <div className="absolute bottom-1 left-1">
                    <Sparkles className="w-4 h-4 text-green-400 animate-ping" style={{ animationDelay: '0.2s' }} />
                  </div>
                  <div className="absolute top-1/2 right-8">
                    <Sparkles className="w-3 h-3 text-emerald-400 animate-ping" style={{ animationDelay: '0.4s' }} />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500/0 via-green-500/10 to-green-500/0 animate-pulse" />
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 処理中のデザイン */}
        {processingDesigns.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-muted-foreground">処理中</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {processingDesigns.map((design) => (
                <Link key={design.id} href={`/design/${design.id}`}>
                  <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="aspect-square bg-muted flex items-center justify-center">
                      <div className="text-center p-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">生成中...</p>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* 完了したデザイン */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">デザイン一覧</h2>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          ) : completedDesigns.length === 0 ? (
            <Card className="p-12 text-center">
              <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">まだデザインがありません</h3>
              <p className="text-muted-foreground mb-6">
                部屋の画像をアップロードして、AIコーディネートを始めましょう
              </p>
              <Button asChild>
                <Link href="/design/new">
                  <Plus className="h-4 w-4 mr-2" />
                  最初のデザインを作成
                </Link>
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {completedDesigns.map((design) => (
                <Link key={design.id} href={`/design/${design.id}`}>
                  <Card className="overflow-hidden group hover:shadow-lg transition-all hover:ring-2 hover:ring-primary/20">
                    <div className="aspect-square relative">
                      {design.generatedImageUrl ? (
                        <img
                          src={design.generatedImageUrl}
                          alt={design.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      {/* オーバーレイ */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute bottom-0 left-0 right-0 p-3 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-sm font-medium truncate">{design.title}</p>
                        {design.createdAt && (
                          <p className="text-xs opacity-80 flex items-center gap-1 mt-1">
                            <Calendar className="h-3 w-3" />
                            {design.createdAt.toLocaleDateString('ja-JP')}
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function MyPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            <Skeleton className="h-10 w-48 mb-8" />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      }
    >
      <MyPageContent />
    </Suspense>
  );
}
