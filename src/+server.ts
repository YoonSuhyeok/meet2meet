import vike from "@vikejs/hono";
import { Hono } from "hono";
import { authRoutes } from "./server/auth";
import { meetingRoutes } from "./server/meeting";
import { notificationRoutes } from "./server/notification";

const app = new Hono();

// API 라우트는 Vike 미들웨어보다 먼저 등록
app.route("/api/auth", authRoutes);

// 알림 라우트를 먼저 등록하여 우선처리 (push-subscriptions, attendance-nudges)
app.route("/api/meetings", notificationRoutes);

// 미팅 라우트 (모든 나머지 요청을 Go Core API로 프록시)
app.route("/api/meetings", meetingRoutes);

// Vike SSR 미들웨어
vike(app);

export default {
    fetch: app.fetch,
};
