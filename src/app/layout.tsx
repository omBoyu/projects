import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import { BackgroundPaths } from '@/components/background-paths';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'AI 旅行攻略助手',
    template: '%s | AI 旅行攻略助手',
  },
  description: '输入目的地和旅行时间，AI 为你量身定制旅行攻略与行李建议',
  keywords: [
    '旅行攻略',
    'AI 旅行',
    '行李清单',
    '旅行规划',
    '出行建议',
  ],
  openGraph: {
    title: 'AI 旅行攻略助手',
    description: '输入目的地和旅行时间，AI 为你量身定制旅行攻略与行李建议',
    locale: 'zh_CN',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-white antialiased">
        <BackgroundPaths />
        {isDev && <Inspector />}
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
