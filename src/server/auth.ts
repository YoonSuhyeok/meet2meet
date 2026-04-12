import { Hono } from "hono";

const authRoutes = new Hono();

// GET /api/auth/:provider — 소셜 로그인 시작
authRoutes.get("/:provider", async (c) => {
    // TODO
});

// GET /api/auth/:provider/callback — 콜백 처리
authRoutes.get("/:provider/callback", async (c) => {
    // TODO
});

// POST /api/auth/logout — 로그아웃
authRoutes.post("/logout", async (c) => {
    // TODO
});

// GET /api/auth/me — 현재 사용자 조회
authRoutes.get("/me", async (c) => {
    // TODO
});

export { authRoutes };
