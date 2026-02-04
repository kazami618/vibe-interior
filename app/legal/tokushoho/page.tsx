import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Home } from 'lucide-react';

export const metadata: Metadata = {
  title: '特定商取引法に基づく表記 | 部屋づくりAI',
  description: '部屋づくりAIの特定商取引法に基づく表記',
};

export default function TokushohoPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* 戻るリンク */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          トップページに戻る
        </Link>

        <h1 className="text-2xl font-bold mb-8">特定商取引法に基づく表記</h1>

        <div className="space-y-6">
          <table className="w-full border-collapse">
            <tbody className="divide-y divide-border">
              <tr>
                <th className="py-4 px-4 text-left font-medium bg-muted/50 w-1/3 align-top">
                  販売業者
                </th>
                <td className="py-4 px-4">宮本 雄大</td>
              </tr>
              <tr>
                <th className="py-4 px-4 text-left font-medium bg-muted/50 align-top">
                  運営責任者
                </th>
                <td className="py-4 px-4">宮本 雄大</td>
              </tr>
              <tr>
                <th className="py-4 px-4 text-left font-medium bg-muted/50 align-top">
                  所在地
                </th>
                <td className="py-4 px-4">
                  〒108-0072<br />
                  東京都港区白金3丁目7-8
                </td>
              </tr>
              <tr>
                <th className="py-4 px-4 text-left font-medium bg-muted/50 align-top">
                  電話番号
                </th>
                <td className="py-4 px-4">
                  090-3569-3767<br />
                  <span className="text-sm text-muted-foreground">
                    ※お問い合わせはメールにてお願いいたします
                  </span>
                </td>
              </tr>
              <tr>
                <th className="py-4 px-4 text-left font-medium bg-muted/50 align-top">
                  メールアドレス
                </th>
                <td className="py-4 px-4">
                  <a
                    href="mailto:support@room-setup.com"
                    className="text-primary hover:underline"
                  >
                    support@room-setup.com
                  </a>
                </td>
              </tr>
              <tr>
                <th className="py-4 px-4 text-left font-medium bg-muted/50 align-top">
                  販売URL
                </th>
                <td className="py-4 px-4">
                  <a
                    href="https://room-setup.com"
                    className="text-primary hover:underline"
                  >
                    https://room-setup.com
                  </a>
                </td>
              </tr>
              <tr>
                <th className="py-4 px-4 text-left font-medium bg-muted/50 align-top">
                  販売価格
                </th>
                <td className="py-4 px-4">
                  デザインチケット: 1枚100円（税込）<br />
                  <span className="text-sm text-muted-foreground">
                    ※各商品ページに表示された価格が適用されます
                  </span>
                </td>
              </tr>
              <tr>
                <th className="py-4 px-4 text-left font-medium bg-muted/50 align-top">
                  商品代金以外の必要料金
                </th>
                <td className="py-4 px-4">なし</td>
              </tr>
              <tr>
                <th className="py-4 px-4 text-left font-medium bg-muted/50 align-top">
                  お支払い方法
                </th>
                <td className="py-4 px-4">
                  クレジットカード（Visa、Mastercard、American Express、JCB）<br />
                  <span className="text-sm text-muted-foreground">
                    ※決済はStripe社の安全な決済システムを使用しています
                  </span>
                </td>
              </tr>
              <tr>
                <th className="py-4 px-4 text-left font-medium bg-muted/50 align-top">
                  お支払い時期
                </th>
                <td className="py-4 px-4">
                  ご注文確定時に即時決済
                </td>
              </tr>
              <tr>
                <th className="py-4 px-4 text-left font-medium bg-muted/50 align-top">
                  商品の引き渡し時期
                </th>
                <td className="py-4 px-4">
                  決済完了後、即時<br />
                  <span className="text-sm text-muted-foreground">
                    ※デザインチケットはお客様のアカウントに即時付与されます
                  </span>
                </td>
              </tr>
              <tr>
                <th className="py-4 px-4 text-left font-medium bg-muted/50 align-top">
                  返品・キャンセルについて
                </th>
                <td className="py-4 px-4">
                  デジタル商品の性質上、購入後の返品・返金はお受けしておりません。<br />
                  <span className="text-sm text-muted-foreground">
                    ※システム障害等により正常にサービスが提供できなかった場合は、個別に対応いたします
                  </span>
                </td>
              </tr>
              <tr>
                <th className="py-4 px-4 text-left font-medium bg-muted/50 align-top">
                  動作環境
                </th>
                <td className="py-4 px-4">
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Google Chrome（最新版）</li>
                    <li>Safari（最新版）</li>
                    <li>Microsoft Edge（最新版）</li>
                    <li>Firefox（最新版）</li>
                  </ul>
                  <span className="text-sm text-muted-foreground">
                    ※JavaScriptを有効にする必要があります
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* フッター */}
        <div className="mt-12 pt-8 border-t border-border">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <Home className="h-3 w-3 text-primary-foreground" />
            </div>
            <span>部屋づくりAI</span>
          </div>
        </div>
      </div>
    </div>
  );
}
