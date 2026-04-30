import { expect, test } from "@playwright/test";

const MOCK_USER = {
	id: "u1",
	name: "Tester",
	email: "test@example.com",
	profileImage: "",
	provider: "kakao",
};

test("home renders meetings when API returns numeric id items", async ({ page }) => {
	await page.route("**/api/auth/me", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify(MOCK_USER),
		});
	});

	await page.route("**/api/meetings?limit=20", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				meetings: [
					{
						id: 35,
						title: "테스트 미팅",
						dates: ["2026-04-30"],
						timeRange: { start: "00:00", end: "24:00" },
						participantCount: 2,
						createdAt: "2026-04-30T00:00:00.000Z",
						updatedAt: "2026-04-30T00:00:00.000Z",
					},
				],
				nextCursor: null,
			}),
		});
	});

	await page.goto("/");

	await expect(page.getByText("내 미팅")).toBeVisible();
	await expect(page.getByText("테스트 미팅")).toBeVisible();
	await expect(page.locator('a[href="/meeting/35"]')).toBeVisible();
});
