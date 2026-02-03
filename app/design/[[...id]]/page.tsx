import DesignResultClient from './DesignResultClient';

// 静的エクスポート用：オプショナルキャッチオールルートのベースパスを生成
export async function generateStaticParams(): Promise<{ id?: string[] }[]> {
  return [
    { id: undefined }, // /design
  ];
}

export default function DesignResultPage() {
  return <DesignResultClient />;
}
