import { cookies } from "next/headers";
import {
  type PortalSessionPayload,
  resolvePortalSessionFromCookieStore,
} from "@/lib/auth/admin-auth";

// Next API Route 版的鉴权入口，对应 require-admin.ts 里的页面守卫。
// Next.js 页面路由和 API 路由是两套独立入口，所以都要各自校验 session cookie。
type AuthenticatedApiSession = {
  token: string;
  session: PortalSessionPayload;
};

function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function forbiddenResponse() {
  return Response.json({ error: "Forbidden" }, { status: 403 });
}

export async function requireSessionForApi(): Promise<
  AuthenticatedApiSession | Response
> {
  const cookieStore = await cookies();
  const resolved = await resolvePortalSessionFromCookieStore(cookieStore);
  if (!resolved) {
    return unauthorizedResponse();
  }
  return { token: resolved.accessToken, session: resolved.session };
}

// 大部分管理接口在转发给真正的 backend 之前，都要求调用方已经是 admin。
export async function requireAdminForApi(): Promise<
  AuthenticatedApiSession | Response
> {
  const authed = await requireSessionForApi();
  if (authed instanceof Response) {
    return authed;
  }
  if (authed.session.role !== "admin") {
    return forbiddenResponse();
  }
  return authed;
}
