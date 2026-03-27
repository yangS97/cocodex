import type { Metadata } from "next";

import "@workspace/ui/globals.css";

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
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
