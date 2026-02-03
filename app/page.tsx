'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import {
  Upload,
  Palette,
  Sparkles,
  ShoppingBag,
  ArrowRight,
  Camera,
  Wand2,
  Home,
  Sofa,
  Lamp,
  Frame
} from 'lucide-react';

import { useAuth } from '@/lib/auth';
import { db, storage } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface RecentDesign {
  id: string;
  generatedImageUrl: string;
  style?: string;
}

interface SampleDesign {
  id: string;
  originalImageUrl: string;
  generatedImageUrl: string;
  style?: string;
}

interface StyleImage {
  style: string;
  imageUrl: string | null;
}

export default function HomePage() {
  const { user, signInWithGoogle } = useAuth();
  const [recentDesigns, setRecentDesigns] = useState<RecentDesign[]>([]);
  const [sampleDesigns, setSampleDesigns] = useState<SampleDesign[]>([]);
  const [styleImages, setStyleImages] = useState<Record<string, string | null>>({});
  const [activeBeforeAfter, setActiveBeforeAfter] = useState(0);

  // サンプルデザインを取得（トップページ表示用）
  useEffect(() => {
    const fetchSampleDesigns = async () => {
      try {
        const designsRef = collection(db, 'designs');
        const q = query(
          designsRef,
          where('status', '==', 'completed'),
          orderBy('createdAt', 'desc'),
          limit(8)
        );
        const snapshot = await getDocs(q);

        const items: SampleDesign[] = [];

        for (const doc of snapshot.docs) {
          const data = doc.data();

          // 生成画像URLが必須
          if (!data.generatedImageUrl) continue;

          let originalUrl = data.originalImageUrl;

          // Storage パスの場合はダウンロードURLを取得（認証済みの場合のみ）
          if (originalUrl && !originalUrl.startsWith('http')) {
            try {
              const imageRef = ref(storage, originalUrl);
              originalUrl = await getDownloadURL(imageRef);
            } catch (err) {
              // 元画像が取得できない場合は生成画像のみ使用
              originalUrl = data.generatedImageUrl;
            }
          }

          items.push({
            id: doc.id,
            originalImageUrl: originalUrl || data.generatedImageUrl,
            generatedImageUrl: data.generatedImageUrl,
            style: data.generationOptions?.style,
          });
        }

        setSampleDesigns(items);
      } catch (err) {
        console.error('Error fetching sample designs:', err);
      }
    };

    fetchSampleDesigns();
  }, []);

  // サンプル画像の自動切り替え
  useEffect(() => {
    if (sampleDesigns.length <= 1) return;
    const timer = setInterval(() => {
      setActiveBeforeAfter((prev) => (prev + 1) % sampleDesigns.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [sampleDesigns.length]);

  // スタイル別の代表画像を設定（サンプルデザインから抽出）
  useEffect(() => {
    if (sampleDesigns.length === 0) return;

    const styles = ['scandinavian', 'modern', 'vintage', 'industrial'];
    const images: Record<string, string | null> = {};

    for (const style of styles) {
      const design = sampleDesigns.find((d) => d.style === style);
      images[style] = design?.generatedImageUrl || null;
    }

    // スタイル画像がない場合は、サンプルデザインから順番に割り当て
    let sampleIndex = 0;
    for (const style of styles) {
      if (!images[style] && sampleDesigns[sampleIndex]) {
        images[style] = sampleDesigns[sampleIndex].generatedImageUrl;
        sampleIndex++;
      }
    }

    setStyleImages(images);
  }, [sampleDesigns]);

  // ログインユーザーの最近のデザインを取得
  useEffect(() => {
    if (!user) {
      setRecentDesigns([]);
      return;
    }

    const fetchRecentDesigns = async () => {
      try {
        const designsRef = collection(db, 'designs');
        const q = query(
          designsRef,
          where('userId', '==', user.uid),
          where('status', '==', 'completed'),
          orderBy('createdAt', 'desc'),
          limit(6)
        );
        const snapshot = await getDocs(q);

        const items = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            generatedImageUrl: doc.data().generatedImageUrl,
            style: doc.data().generationOptions?.style,
          }))
          .filter((item) => item.generatedImageUrl);

        setRecentDesigns(items);
      } catch (err) {
        console.error('Error fetching recent designs:', err);
      }
    };

    fetchRecentDesigns();
  }, [user]);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden gradient-warm">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
        <div className="container mx-auto px-4 py-16 md:py-24 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* 左側：テキスト */}
            <div className="text-center lg:text-left space-y-6">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
                <Sparkles className="h-4 w-4" />
                AIがあなたの部屋を素敵にコーディネート
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                部屋の写真を
                <span className="text-primary block">プロのデザイン</span>
                に変える
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl">
                Vibe Interiorは、AIが部屋の写真を分析し、
                実在する家具を使った理想のインテリアを提案します。
                賃貸でもできるコーディネートで、毎日の暮らしをもっと素敵に。
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-2">
                {user ? (
                  <Button asChild size="lg" className="text-lg px-8">
                    <Link href="/design/new">
                      <Wand2 className="h-5 w-5 mr-2" />
                      コーディネートを始める
                    </Link>
                  </Button>
                ) : (
                  <Button onClick={signInWithGoogle} size="lg" className="text-lg px-8">
                    無料で始める
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                )}
              </div>
            </div>

            {/* 右側：ビフォーアフター画像 */}
            <div className="relative">
              {sampleDesigns.length > 0 ? (
                <div className="relative">
                  {/* メインのビフォーアフター表示 */}
                  <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                    <div className="grid grid-cols-2 gap-1 bg-muted">
                      {/* Before */}
                      <div className="relative aspect-[4/3]">
                        <img
                          src={sampleDesigns[activeBeforeAfter]?.originalImageUrl}
                          alt="Before"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/60 text-white text-xs font-medium">
                          Before
                        </div>
                      </div>
                      {/* After */}
                      <div className="relative aspect-[4/3]">
                        <img
                          src={sampleDesigns[activeBeforeAfter]?.generatedImageUrl}
                          alt="After"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2 right-2 px-2 py-1 rounded bg-primary text-primary-foreground text-xs font-medium">
                          After
                        </div>
                      </div>
                    </div>
                    {/* スタイルバッジ */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/90 text-sm font-medium shadow">
                      {getStyleLabel(sampleDesigns[activeBeforeAfter]?.style)}スタイル
                    </div>
                  </div>

                  {/* サムネイル選択 */}
                  {sampleDesigns.length > 1 && (
                    <div className="flex justify-center gap-2 mt-4">
                      {sampleDesigns.slice(0, 4).map((design, idx) => (
                        <button
                          key={design.id}
                          onClick={() => setActiveBeforeAfter(idx)}
                          className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                            activeBeforeAfter === idx
                              ? 'border-primary scale-110'
                              : 'border-transparent opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img
                            src={design.generatedImageUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 装飾 */}
                  <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/20 rounded-full blur-2xl" />
                  <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-primary/10 rounded-full blur-2xl" />
                </div>
              ) : (
                /* サンプル画像がない場合：イメージイラスト */
                <div className="relative">
                  <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                    <div className="grid grid-cols-2 gap-1 bg-muted">
                      {/* Before イメージ */}
                      <div className="relative aspect-[4/3] bg-gradient-to-br from-gray-200 to-gray-300">
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                          <div className="w-16 h-10 bg-gray-400/50 rounded mb-2" />
                          <div className="w-24 h-6 bg-gray-400/30 rounded mb-4" />
                          <div className="flex gap-2">
                            <div className="w-8 h-8 bg-gray-400/40 rounded" />
                            <div className="w-8 h-8 bg-gray-400/40 rounded" />
                          </div>
                        </div>
                        <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/60 text-white text-xs font-medium">
                          Before
                        </div>
                      </div>
                      {/* After イメージ */}
                      <div className="relative aspect-[4/3] bg-gradient-to-br from-amber-100 to-orange-100">
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                          <div className="w-16 h-10 bg-amber-300/50 rounded mb-2" />
                          <div className="w-24 h-6 bg-amber-300/30 rounded mb-4" />
                          <div className="flex gap-2">
                            <div className="w-8 h-8 bg-green-300/50 rounded" />
                            <div className="w-8 h-8 bg-amber-300/40 rounded" />
                            <div className="w-6 h-10 bg-yellow-300/40 rounded" />
                          </div>
                        </div>
                        <div className="absolute top-2 right-2 px-2 py-1 rounded bg-primary text-primary-foreground text-xs font-medium">
                          After
                        </div>
                        <Sparkles className="absolute bottom-4 right-4 w-6 h-6 text-primary/60" />
                      </div>
                    </div>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/90 text-sm font-medium shadow">
                      AIがコーディネート
                    </div>
                  </div>
                  <p className="text-center text-sm text-muted-foreground mt-4">
                    あなたの部屋もこんな風に変わります
                  </p>
                  {/* 装飾 */}
                  <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/20 rounded-full blur-2xl" />
                  <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-primary/10 rounded-full blur-2xl" />
                </div>
              )}
            </div>
          </div>
        </div>
        {/* 装飾的な要素 */}
        <div className="absolute -bottom-px left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* How it Works Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">使い方はカンタン3ステップ</h2>
            <p className="text-muted-foreground">
              面倒な登録や設定は不要。写真を撮って、スタイルを選ぶだけ。
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {/* Step 1 */}
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Camera className="h-8 w-8 text-primary" />
              </div>
              <div className="text-4xl font-bold text-primary/20">01</div>
              <h3 className="text-xl font-semibold">部屋の写真をアップロード</h3>
              <p className="text-muted-foreground text-sm">
                スマホで撮った写真でOK。今の部屋をそのままアップロードしてください。
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Palette className="h-8 w-8 text-primary" />
              </div>
              <div className="text-4xl font-bold text-primary/20">02</div>
              <h3 className="text-xl font-semibold">好きなスタイルを選択</h3>
              <p className="text-muted-foreground text-sm">
                北欧、モダン、ヴィンテージなど。お好みのテイストを選んでください。
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div className="text-4xl font-bold text-primary/20">03</div>
              <h3 className="text-xl font-semibold">AIがデザインを生成</h3>
              <p className="text-muted-foreground text-sm">
                AIがあなたの部屋にぴったりの家具を選び、コーディネートを提案します。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Sample Gallery Section */}
      {sampleDesigns.length > 0 && (
        <section className="py-16 bg-secondary/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold mb-4">みんなのコーディネート</h2>
              <p className="text-muted-foreground">
                AIが生成した実際のコーディネート例をご覧ください
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
              {sampleDesigns.map((design, idx) => (
                <div
                  key={design.id}
                  className="group relative aspect-square rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all cursor-pointer"
                  onClick={() => setActiveBeforeAfter(idx)}
                >
                  <img
                    src={design.generatedImageUrl}
                    alt={`コーディネート例 ${idx + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-3 left-3 right-3">
                      <span className="text-white text-sm font-medium">
                        {getStyleLabel(design.style)}スタイル
                      </span>
                    </div>
                  </div>
                  {/* Before/Afterバッジ */}
                  <div className="absolute top-2 right-2 px-2 py-1 rounded bg-primary/90 text-primary-foreground text-xs font-medium">
                    AI生成
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center mt-8">
              {user ? (
                <Button asChild variant="outline" size="lg">
                  <Link href="/design/new">
                    <Wand2 className="h-4 w-4 mr-2" />
                    あなたの部屋もコーディネートする
                  </Link>
                </Button>
              ) : (
                <Button onClick={signInWithGoogle} variant="outline" size="lg">
                  無料で試してみる
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Features Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Vibe Interiorの特徴</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <Card className="bg-background border-none shadow-sm">
              <CardContent className="p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Home className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">賃貸OK</h3>
                <p className="text-sm text-muted-foreground">
                  壁や床はそのままに。賃貸でもできるコーディネートを提案します。
                </p>
              </CardContent>
            </Card>

            <Card className="bg-background border-none shadow-sm">
              <CardContent className="p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <ShoppingBag className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">実在する家具</h3>
                <p className="text-sm text-muted-foreground">
                  楽天で購入できる実際の商品を使ってデザイン。すぐに買えます。
                </p>
              </CardContent>
            </Card>

            <Card className="bg-background border-none shadow-sm">
              <CardContent className="p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Lamp className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">カスタマイズ</h3>
                <p className="text-sm text-muted-foreground">
                  照明、ラグ、小物など変えたいアイテムを選べます。
                </p>
              </CardContent>
            </Card>

            <Card className="bg-background border-none shadow-sm">
              <CardContent className="p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Frame className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">Before/After</h3>
                <p className="text-sm text-muted-foreground">
                  元の画像と比較できるスライダー付き。変化が一目でわかります。
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Style Showcase */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">選べるスタイル</h2>
            <p className="text-muted-foreground">
              あなたの好みに合わせた4つのスタイルから選べます
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              { key: 'scandinavian', name: '北欧', sub: 'Scandinavian', desc: 'シンプルで温かみのある', color: 'from-amber-100 to-orange-50' },
              { key: 'modern', name: 'モダン', sub: 'Modern', desc: '洗練されたミニマル', color: 'from-gray-100 to-slate-50' },
              { key: 'vintage', name: 'ヴィンテージ', sub: 'Vintage', desc: 'レトロな魅力', color: 'from-amber-200 to-yellow-100' },
              { key: 'industrial', name: 'インダストリアル', sub: 'Industrial', desc: '無骨でクール', color: 'from-zinc-200 to-stone-100' },
            ].map((style) => (
              <Card key={style.key} className="group overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1">
                {/* スタイル画像 */}
                <div className="aspect-[4/3] overflow-hidden relative">
                  {styleImages[style.key] ? (
                    <img
                      src={styleImages[style.key]!}
                      alt={`${style.name}スタイルの例`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${style.color} flex items-center justify-center`}>
                      <Sofa className="h-12 w-12 text-primary/30" />
                    </div>
                  )}
                  {/* オーバーレイ */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  {/* スタイル名（画像上に表示） */}
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <h3 className="font-bold text-lg">{style.name}</h3>
                    <p className="text-xs text-white/80">{style.sub}</p>
                  </div>
                </div>
                {/* 説明 */}
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">{style.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Designs Section */}
      {recentDesigns.length > 0 && (
        <section className="py-20 bg-secondary/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">あなたの最近のコーディネート</h2>
              <p className="text-muted-foreground">
                作成したデザインをもう一度チェック
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {recentDesigns.map((design) => (
                <div
                  key={design.id}
                  className="aspect-square rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-shadow"
                >
                  <img
                    src={design.generatedImageUrl}
                    alt="Generated design"
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            あなたの部屋も変えてみませんか？
          </h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            今すぐ無料で始められます。
            写真1枚で、理想のインテリアを見つけましょう。
          </p>
          {user ? (
            <Button asChild size="lg" variant="secondary" className="text-lg px-8">
              <Link href="/design/new">
                <Wand2 className="h-5 w-5 mr-2" />
                コーディネートを始める
              </Link>
            </Button>
          ) : (
            <Button onClick={signInWithGoogle} size="lg" variant="secondary" className="text-lg px-8">
              無料で始める
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-background border-t">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
                <Home className="h-3 w-3 text-primary-foreground" />
              </div>
              <span className="font-semibold">Vibe Interior</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 Vibe Interior. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
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
