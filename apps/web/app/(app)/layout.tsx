import { AppShell } from "@/components/layout/app-shell";
import { LogoLoadingOverlay } from "@/components/layout/logo-loading-overlay";
import { Providers } from "@/components/providers/providers";

// 所有登录后后台页面共用的外壳布局。可以把它理解成服务端渲染后台里的受保护控制台模板。
export default function PrivateAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Providers>
      <LogoLoadingOverlay />
      <AppShell>{children}</AppShell>
    </Providers>
  );
}
