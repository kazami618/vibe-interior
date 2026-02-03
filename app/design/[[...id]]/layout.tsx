import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AIコーディネート | Vibe Interior',
  description: 'AIが部屋をコーディネートしました。実在する家具を使った理想のインテリアデザインをご覧ください。',
  openGraph: {
    title: 'AIコーディネート - Vibe Interior',
    description: 'AIが部屋をコーディネートしました。実在する家具を使った理想のインテリアデザインをご覧ください。',
    type: 'article',
    siteName: 'Vibe Interior',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AIコーディネート - Vibe Interior',
    description: 'AIが部屋をコーディネートしました',
  },
};

export default function DesignLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
