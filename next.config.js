/** @type {import('next').NextConfig} */
const nextConfig = {
  // 本番ビルド時のみ静的エクスポート（開発時は通常モード）
  ...(process.env.NODE_ENV === 'production' && { output: 'export' }),
  reactStrictMode: true,
  images: {
    unoptimized: true, // Firebase Hosting用
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'tshop.r10s.jp',
      },
      {
        protocol: 'https',
        hostname: 'm.media-amazon.com',
      },
      {
        protocol: 'https',
        hostname: 'thumbnail.image.rakuten.co.jp',
      },
      {
        protocol: 'https',
        hostname: 'images-fe.ssl-images-amazon.com',
      },
    ],
  },
};

module.exports = nextConfig;
