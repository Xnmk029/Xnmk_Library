import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HARBOUR ATLAS — 维多利亚港体素沙盘',
  description: '在统一米制体素网格中，俯瞰香港天际线，走入维港两岸。基于香港地政总署公开数据的可交互城市沙盘。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark">
      <body>{children}</body>
    </html>
  );
}
