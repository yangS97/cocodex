import { getBackendBaseUrl } from "@/lib/backend/backend-base-url";
import { requireAdminForApi } from "@/lib/auth/api-route-auth";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// 这是一个很典型的 BFF 路由：
// 浏览器 -> Next.js API Route -> backend。
// 它先在本地读取并校验 admin session cookie，再带着 bearer token 转发给 backend，
// 从而避免浏览器直接暴露 backend 的鉴权模型。
export async function GET() {
  const authed = await requireAdminForApi();
  if (authed instanceof Response) {
    return authed;
  }
  const { token } = authed;
  const base = getBackendBaseUrl();
  const upstream = await fetch(`${base}/api/signup-proxies`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") ?? "application/json",
    },
  });
}

export async function PUT(req: Request) {
  const authed = await requireAdminForApi();
  if (authed instanceof Response) {
    return authed;
  }
  const { token } = authed;
  const body = await req.text();
  const base = getBackendBaseUrl();
  const upstream = await fetch(`${base}/api/signup-proxies`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body || "{}",
    cache: "no-store",
  });
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") ?? "application/json",
    },
  });
}
