import type { Metadata } from "next";
import "./globals.css";
import BrandLogo from "@/components/BrandLogo";

export const metadata: Metadata = {
  title: "WeDrink U-Thong — Coffee BOGO Coupons",
  description: "Buy one coffee, get one free — claim your coupon",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <div className="border-b border-cyan-200/70 bg-white/70 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-center px-6 py-3">
            <BrandLogo />
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}
