// 统一决定 web 应用应该把 BFF 风格请求转发到哪里。
// 本地开发默认转发到 53141 端口；生产环境必须显式配置 backend 域名。
export function getBackendBaseUrl() {
  const configured = process.env.BACKEND_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "BACKEND_BASE_URL is required in production. Please set it to your backend domain URL.",
    );
  }

  return "http://localhost:53141";
}
