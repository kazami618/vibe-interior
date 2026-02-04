'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Upload,
  Palette,
  Sparkles,
  ShoppingBag,
  ArrowRight,
  Camera,
  Wand2,
  Home,
  Lamp,
  Frame,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

// 固定のBefore/Afterサンプル（スタイル画像を使用）
const HERO_SAMPLES = [
  {
    id: 'scandinavian',
    style: '北欧',
    afterImageUrl: '/styles/scandinavian.jpg',
  },
  {
    id: 'modern',
    style: 'モダン',
    afterImageUrl: '/styles/modern.jpg',
  },
  {
    id: 'vintage',
    style: 'ヴィンテージ',
    afterImageUrl: '/styles/vintage.jpg',
  },
  {
    id: 'industrial',
    style: 'インダストリアル',
    afterImageUrl: '/styles/industrial.jpg',
  },
];

// スタイル情報（静的画像を使用）
const STYLES = [
  {
    key: 'scandinavian',
    name: '北欧',
    sub: 'Scandinavian',
    desc: 'シンプルで温かみのある',
    imageUrl: '/styles/scandinavian.jpg',
  },
  {
    key: 'modern',
    name: 'モダン',
    sub: 'Modern',
    desc: '洗練されたミニマル',
    imageUrl: '/styles/modern.jpg',
  },
  {
    key: 'vintage',
    name: 'ヴィンテージ',
    sub: 'Vintage',
    desc: 'レトロな魅力',
    imageUrl: '/styles/vintage.jpg',
  },
  {
    key: 'industrial',
    name: 'インダストリアル',
    sub: 'Industrial',
    desc: '無骨でクール',
    imageUrl: '/styles/industrial.jpg',
  },
];

export default function HomePage() {
  const { user, signInWithGoogle } = useAuth();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // サンプル画像の自動切り替え
  useEffect(() => {
    const timer = setInterval(() => {
      handleNext();
    }, 4000);
    return () => clearInterval(timer);
  }, [activeIndex]);

  const handlePrev = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setActiveIndex((prev) => (prev - 1 + HERO_SAMPLES.length) % HERO_SAMPLES.length);
    setTimeout(() => setIsTransitioning(false), 300);
  };

  const handleNext = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setActiveIndex((prev) => (prev + 1) % HERO_SAMPLES.length);
    setTimeout(() => setIsTransitioning(false), 300);
  };

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
                写真をアップするだけで簡単に使える
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                あなたのお部屋を
                <span className="text-primary block">プロフェッショナルなAIが</span>
                コーディネート
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl">
                部屋づくりAIは、AIが部屋の写真を分析し、
                実在する家具を使った理想のインテリアを提案します。
                スタイルやアイテムを選んであなた好みのお部屋にコーディネートします。
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-4 relative z-10">
                {user ? (
                  <Link
                    href="/design/new"
                    className="inline-flex items-center justify-center text-lg px-10 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/40 transition-all hover:scale-105 text-white font-medium rounded-md"
                  >
                    <Wand2 className="h-5 w-5 mr-2" />
                    コーディネートを始める
                  </Link>
                ) : (
                  <button
                    onClick={signInWithGoogle}
                    className="inline-flex items-center justify-center text-lg px-10 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/40 transition-all hover:scale-105 text-white font-medium rounded-md"
                  >
                    無料で始める
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </button>
                )}
              </div>
            </div>

            {/* 右側：スタイルサンプル画像 */}
            <div className="relative">
              <div className="relative">
                {/* メイン画像表示 */}
                <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                  <div className="relative aspect-[4/3]">
                    {HERO_SAMPLES.map((sample, idx) => (
                      <img
                        key={sample.id}
                        src={sample.afterImageUrl}
                        alt={`${sample.style}スタイルの部屋`}
                        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                          idx === activeIndex ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                    ))}
                    {/* スタイルバッジ */}
                    <div className="absolute bottom-4 left-4 px-4 py-2 rounded-full bg-white/95 text-sm font-semibold shadow-lg">
                      {HERO_SAMPLES[activeIndex]?.style}スタイル
                    </div>
                    {/* ナビゲーションボタン */}
                    <button
                      onClick={handlePrev}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow-lg transition-all"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={handleNext}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow-lg transition-all"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* サムネイル選択 */}
                <div className="flex justify-center gap-2 mt-4">
                  {HERO_SAMPLES.map((sample, idx) => (
                    <button
                      key={sample.id}
                      onClick={() => setActiveIndex(idx)}
                      className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                        activeIndex === idx
                          ? 'border-primary scale-110 shadow-lg'
                          : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={sample.afterImageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>

                {/* 装飾 */}
                <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/20 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
              </div>
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

          {/* セクション下部のCTA */}
          <div className="text-center mt-12">
            {user ? (
              <Button
                asChild
                size="lg"
                className="text-lg px-8 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/25"
              >
                <Link href="/design/new">
                  <Wand2 className="h-5 w-5 mr-2" />
                  コーディネートを始める
                </Link>
              </Button>
            ) : (
              <Button
                onClick={signInWithGoogle}
                size="lg"
                className="text-lg px-8 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/25"
              >
                無料で始める
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">部屋づくりAIの特徴</h2>
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
            {STYLES.map((style) => (
              <Card
                key={style.key}
                className="group overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1"
              >
                {/* スタイル画像 */}
                <div className="aspect-[4/3] overflow-hidden relative">
                  <img
                    src={style.imageUrl}
                    alt={`${style.name}スタイルの例`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
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

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            あなたの部屋も変えてみませんか？
          </h2>
          <p className="text-white/80 mb-8 max-w-xl mx-auto">
            今すぐ無料で始められます。
            写真1枚で、理想のインテリアを見つけましょう。
          </p>
          {user ? (
            <Button
              asChild
              size="lg"
              className="text-lg px-10 py-6 bg-white text-emerald-600 hover:bg-gray-100 shadow-xl hover:shadow-2xl transition-all hover:scale-105"
            >
              <Link href="/design/new">
                <Wand2 className="h-5 w-5 mr-2" />
                コーディネートを始める
              </Link>
            </Button>
          ) : (
            <Button
              onClick={signInWithGoogle}
              size="lg"
              className="text-lg px-10 py-6 bg-white text-emerald-600 hover:bg-gray-100 shadow-xl hover:shadow-2xl transition-all hover:scale-105"
            >
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
              <span className="font-semibold">部屋づくりAI</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 部屋づくりAI (room-setup.com). All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
