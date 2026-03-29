import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { resolvePortalSessionFromCookieStore } from "@/lib/auth/admin-auth";

// App Router 页面使用的服务端鉴权守卫。它会在页面渲染前执行，作用类似鉴权拦截器加跳转策略。
export async function requireAuth(nextPath: string) {
  const cookieStore = await cookies();
  const resolved = await resolvePortalSessionFromCookieStore(cookieStore);
  if (!resolved) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  const payload = resolved.session;
  if (payload.mustSetup && nextPath !== "/setup") {
    redirect("/setup?reason=setup_required");
  }
  return payload;
}

// 管理区页面使用的 admin 鉴权版本。
export async function requireAdmin(nextPath: string) {
  const payload = await requireAuth(nextPath);
  if (payload.role !== "admin") {
    redirect("/dashboard");
  }
  return payload;
}
