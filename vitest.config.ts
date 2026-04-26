import { defineConfig } from "vitest/config";

/**
 * 노트: 이 프로젝트 경로에 한글이 포함되어 있어
 * `@cloudflare/vitest-pool-workers`(workerd)가 모듈 해석에 실패합니다.
 * Hono 라우트는 표준 fetch 핸들러이고 통합 테스트는 fetch를 mocking 하므로
 * Node 환경의 plain Vitest로도 동등하게 검증 가능합니다.
 */
export default defineConfig({
	test: {
		environment: "node",
		include: ["src/**/*.test.{ts,tsx}"],
		coverage: {
			provider: "istanbul",
			reporter: ["text", "html"],
			include: ["src/**/*.{ts,tsx}"],
			exclude: [
				"src/**/*.test.{ts,tsx}",
				"src/**/*.stories.{ts,tsx}",
				"src/**/+*.{ts,tsx}",
			],
		},
	},
});
