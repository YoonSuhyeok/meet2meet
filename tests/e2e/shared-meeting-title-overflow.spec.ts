import { expect, test } from "@playwright/test";

const LONG_TITLE = "s".repeat(120);

test.describe("shared meeting mobile", () => {
	test.use({
		viewport: { width: 390, height: 844 },
		hasTouch: true,
		isMobile: true,
	});

	test("long title does not overflow viewport", async ({ page }) => {
		await page.route("**/api/auth/me", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: "null",
			});
		});

		await page.route("**/api/meetings/s/m35", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					id: "35",
					shortId: "m35",
					inviteCode: "ABC-1234",
					title: LONG_TITLE,
					description: "",
					location: "",
					dates: ["2026-04-30"],
					timeRange: { start: "00:00", end: "24:00" },
					hostId: "u1",
					hostName: "Tester",
					participantCount: 0,
					createdAt: "2026-04-30T00:00:00.000Z",
					updatedAt: "2026-04-30T00:00:00.000Z",
					voteSummary: [],
				}),
			});
		});

		await page.goto("/m/m35");
		await expect(page).toHaveURL(/\/m\/m35$/);

		const title = page.locator("section").first().locator("h1").first();
		await expect(title).toHaveText(LONG_TITLE);

		await expect
			.poll(async () => {
				return page.evaluate(() => {
					const root = document.documentElement;
					const maxAllowedWidth = window.innerWidth + 1;
					return root.scrollWidth <= maxAllowedWidth;
				});
			})
			.toBe(true);

		const titleBox = await title.boundingBox();
		expect(titleBox).not.toBeNull();
		expect((titleBox?.x ?? 0) + (titleBox?.width ?? 0)).toBeLessThanOrEqual(391);
	});
});
