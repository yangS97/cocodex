"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ToastProvider } from "@/components/providers/toast-provider";
import { LocaleProvider } from "@/components/providers/locale-provider";

// App Router 的 layout 默认是服务端组件。
// 这里单独用一个客户端组件，把依赖浏览器状态或副作用的 Provider 收拢在一起。
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      enableColorScheme
    >
      <LocaleProvider>
        <ToastProvider>{children}</ToastProvider>
      </LocaleProvider>
    </NextThemesProvider>
  );
}
