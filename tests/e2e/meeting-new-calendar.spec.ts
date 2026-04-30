import { expect, test, type Page } from "@playwright/test";

const MOCK_USER = {
	id: "u1",
	name: "Tester",
	email: "test@example.com",
	profileImage: "",
	provider: "kakao",
};

async function setupMeetingNewPage(page: Page) {
	await page.route("**/api/auth/me", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify(MOCK_USER),
		});
	});

	await page.goto("/meeting/new");
	await expect(page).toHaveURL(/\/meeting\/new$/);
}

async function selectTodayDate(page: Page) {
	const todayKey = await page.evaluate(() => {
		const d = new Date();
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");
		return `${y}-${m}-${day}`;
	});

	const todayCell = page.locator(`[data-date="${todayKey}"]`);
	await expect(todayCell).toBeVisible();
	await todayCell.click();
}

async function tapTodayDate(page: Page) {
	const todayKey = await page.evaluate(() => {
		const d = new Date();
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");
		return `${y}-${m}-${day}`;
	});

	const todayCell = page.locator(`[data-date="${todayKey}"]`);
	await expect(todayCell).toBeVisible();
	await todayCell.tap();
}

async function expectSingleDateSelected(page: Page) {

	await expect.poll(async () => {
		return page.locator("[data-date].bg-primary").count();
	}).toBe(1);

	await expect(page.getByText("1일 선택됨")).toBeVisible();
	await expect(page.locator("#field-dates")).toContainText("선택된 날짜");
	await expect(page.locator("#field-dates")).toContainText("1일");
}

test("meeting/new calendar date click selects a day", async ({ page }) => {
	await setupMeetingNewPage(page);
	await selectTodayDate(page);
	await expectSingleDateSelected(page);
});

test.describe("mobile", () => {
	test.use({
		viewport: { width: 390, height: 844 },
		hasTouch: true,
		isMobile: true,
	});

	test("meeting/new calendar date selects a day", async ({ page }) => {
		await setupMeetingNewPage(page);
		await tapTodayDate(page);
		await expectSingleDateSelected(page);
	});

	test("meeting/new title 50 chars keeps mobile layout stable", async ({ page }) => {
		await setupMeetingNewPage(page);

		const titleInput = page.locator("#meeting-title");
		await expect(titleInput).toBeVisible();
		await titleInput.tap();

		const fiftyChars = "0123456789".repeat(5);
		await titleInput.fill(fiftyChars);

		await expect(titleInput).toHaveValue(fiftyChars);
		await expect(page.getByText("50 / 50")).toBeVisible();

		await expect
			.poll(async () => {
				return page.evaluate(() => {
					const root = document.documentElement;
					const maxAllowedWidth = window.innerWidth + 1;
					const noHorizontalOverflow = root.scrollWidth <= maxAllowedWidth;
					const scale = window.visualViewport?.scale ?? 1;
					const stableScale = scale <= 1.01;
					return noHorizontalOverflow && stableScale;
				});
			})
			.toBe(true);
	});
});
