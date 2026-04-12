import vike from "@vikejs/hono";
import { Hono } from "hono";

const app = new Hono();

// API 라우트는 Vike 미들웨어보다 먼저 등록
// app.route("/api/auth", authRoutes);

// Vike SSR 미들웨어
vike(app);

export default {
    fetch: app.fetch,
};
