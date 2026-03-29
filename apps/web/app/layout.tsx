import type { Metadata } from "next";

import "@workspace/ui/globals.css";

// 整个 Next.js 应用的根布局。你可以把它类比成 Java MVC 里所有页面都会继承的顶层模板。
export const metadata: Metadata = {
  title: "CoCodex",
  icons: {
    icon: "/codex-shell-logo.svg",
    shortcut: "/codex-shell-logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* 当前直接使用共享 CSS 里的字体栈，不再依赖远程 Google 字体。 */}
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
