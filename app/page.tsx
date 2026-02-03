export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-8 text-center">
          Vibe Interior
        </h1>
        <p className="text-center text-xl mb-4">
          AIインテリアコーディネーター
        </p>
        <p className="text-center text-gray-400">
          部屋の画像をアップロードして、AIが実在する家具を配置した改装イメージを生成します
        </p>
      </div>
    </main>
  );
}
