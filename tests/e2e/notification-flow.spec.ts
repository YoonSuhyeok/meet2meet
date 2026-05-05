import { expect, test } from "@playwright/test";

const HOST_USER = {
	id: "u1",
	name: "Host",
	email: "host@example.com",
	profileImage: "",
	provider: "kakao",
};

const PARTICIPANT_USER = {
	id: "u2",
	name: "Participant",
	email: "participant@example.com",
	profileImage: "",
	provider: "kakao",
};

const SHARED_MEETING = {
	id: "35",
	shortId: "m35",
	inviteCode: "ABC-1234",
	title: "알림 테스트 미팅",
	description: "",
	location: "",
	dates: ["2026-04-30"],
	timeRange: { start: "09:00", end: "11:00" },
	hostId: "u1",
	hostName: "Host",
	participantCount: 3,
	isClosed: false,
	createdAt: "2026-04-30T00:00:00.000Z",
	updatedAt: "2026-04-30T00:00:00.000Z",
	voteSummary: [],
};

const DETAIL_MEETING = {
	...SHARED_MEETING,
	isClosed: true,
};

test.describe("notification flows", () => {
	test("shared meeting: logged-out user clicks notification toggle and is redirected to login", async ({
		page,
	}) => {
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
				body: JSON.stringify(SHARED_MEETING),
			});
		});

		await page.route("**/api/meetings/35/votes?participantCode=**", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					meetingId: "35",
					votes: [],
					summary: [],
				}),
			});
		});

		await page.goto("/m/m35");

		await expect(page.getByText("로그인하면 이 미팅의 일정 변경")).toBeVisible();
		await page.getByRole("button", { name: "로그인 후 알림 설정" }).click();
		await expect(page).toHaveURL(/\/login$/);

		const savedRedirectRaw = await page.evaluate(() =>
			window.localStorage.getItem("meet2meet:post-login-redirect"),
		);
		expect(savedRedirectRaw).not.toBeNull();
		expect(savedRedirectRaw ?? "").toContain('"path":"/m/m35"');
	});

	test("shared meeting: subscribed user sees active notification state", async ({ page }) => {
		await page.route("**/api/auth/me", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(PARTICIPANT_USER),
			});
		});

		await page.route("**/api/meetings/s/m35", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(SHARED_MEETING),
			});
		});

		await page.route("**/api/meetings/35/votes", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					meetingId: "35",
					votes: [],
					summary: [],
				}),
			});
		});

		let statusRequestCount = 0;
		await page.route("**/api/meetings/35/push-subscriptions/status", async (route) => {
			statusRequestCount += 1;
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					meetingId: 35,
					userId: "u2",
					deviceId: "dev-1",
					isSubscribed: true,
					isStandalone: true,
					notificationPermissionStatus: "granted",
					installFlagStatus: "active",
					pushEndpointStatus: "active",
					lastVerifiedAt: "2026-05-05T00:00:00.000Z",
					lastNudgeAt: null,
				}),
			});
		});

		await page.goto("/m/m35");

		const toggle = page.getByRole("button", { name: "알림 받는 중" });
		await expect(toggle).toBeVisible();
		await expect(toggle).toHaveAttribute("aria-pressed", "true");
		expect(statusRequestCount).toBeGreaterThanOrEqual(1);
	});

	test("meeting detail: host can send attendance nudge once", async ({ page }) => {
		await page.route("**/api/auth/me", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(HOST_USER),
			});
		});

		await page.route("**/api/meetings/35", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(DETAIL_MEETING),
			});
		});

		await page.route("**/api/meetings/35/votes", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					meetingId: "35",
					votes: [
						{
							meetingId: "35",
							userId: "u2",
							userName: "Participant",
							slots: ["2026-04-30-09:00"],
							updatedAt: "2026-05-05T00:00:00.000Z",
						},
					],
					summary: [{ slot: "2026-04-30-09:00", count: 1 }],
				}),
			});
		});

		let nudgeRequestCount = 0;
		await page.route("**/api/meetings/35/attendance-nudges", async (route) => {
			nudgeRequestCount += 1;
			await route.fulfill({
				status: 202,
				contentType: "application/json",
				body: JSON.stringify({
					nudgeId: "nudge-1",
					meetingId: 35,
					targetCount: 2,
					queuedAt: "2026-05-05T00:00:00.000Z",
				}),
			});
		});

		await page.goto("/meeting/35");

		const nudgeButton = page.getByRole("button", { name: "미응답자 독촉 발송" });
		await expect(nudgeButton).toBeVisible();
		await nudgeButton.click();

		await expect(page.getByText("독촉 발송 완료 (2명)")).toBeVisible();
		await expect(page.getByText("이후 추가 발송은 불가합니다.")).toBeVisible();
		await expect(page.getByRole("button", { name: "독촉 발송 완료 (2명)" })).toBeDisabled();
		expect(nudgeRequestCount).toBe(1);
	});
});
