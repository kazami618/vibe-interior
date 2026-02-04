import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AIコーディネート | 部屋づくりAI',
  description: 'AIが部屋をコーディネートしました。実在する家具を使った理想のインテリアデザインをご覧ください。',
  openGraph: {
    title: 'AIコーディネート - 部屋づくりAI',
    description: 'AIが部屋をコーディネートしました。実在する家具を使った理想のインテリアデザインをご覧ください。',
    type: 'article',
    siteName: '部屋づくりAI',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AIコーディネート - 部屋づくりAI',
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
