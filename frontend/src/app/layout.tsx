import type { Metadata, Viewport } from "next";
import { Noto_Sans_SC } from "next/font/google";
import { AuthProvider } from "@/contexts/auth-context";
import "./globals.css";

const notoSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-noto-sans-sc",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "TulipAgent - 你们的专属助理",
  description: "一个贴心的个人AI助理，为你们提供日程管理、记账、待办事项等服务",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`h-full antialiased ${notoSansSC.variable}`}>
      <body
        className={`${notoSansSC.className}`}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
