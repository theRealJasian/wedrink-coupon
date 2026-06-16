import type { Metadata } from 'next';
import './globals.css';
import BrandLogo from '@/components/BrandLogo';

export const metadata: Metadata = {
  title: 'WeDrink U-Thong — คูปองกาแฟ ☕',
  description: 'ซื้อกาแฟ 1 แถม 1 — รับคูปองได้เลย ☕✨',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <div className="border-b border-cyan-200/70 bg-white/70 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-center px-4 py-2 sm:px-6 sm:py-3">
            <BrandLogo />
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}
