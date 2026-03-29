// backend 路由分组的统一导出入口。
// server.ts 会从这里集中挂载路由，作用类似 Java 应用里统一注册 controller 模块。
export { registerAccountMaintenanceRoutes } from "./admin/account-maintenance-routes.ts";
export { registerAdminRoutes } from "./admin/admin-routes.ts";
export { registerChatRoutes } from "./openai/chat-routes.ts";
export { registerPublicOpenAIRoutes } from "./openai/public-openai-routes.ts";
export { registerResponsesRoutes } from "./openai/responses-routes.ts";
export {
  ResponsesWebSocketUpgradeError,
  prepareResponsesWebSocketProxyContext,
  setupResponsesWebSocketProxy,
} from "./openai/responses-ws.ts";
