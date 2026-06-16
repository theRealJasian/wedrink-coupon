import type { Metadata } from "next";
import "./globals.css";

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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
