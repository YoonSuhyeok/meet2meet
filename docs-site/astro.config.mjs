// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// https://astro.build/config
export default defineConfig({
	server: {
		host: "0.0.0.0",
		port: 3001,
	},
	integrations: [
		starlight({
			title: "Meet2Meet 문서 포털",
			description: "기획 문서 + Swagger(OpenAPI) 통합 문서",
			defaultLocale: "root",
			locales: {
				root: { label: "한국어", lang: "ko" },
			},
			logo: { src: "./src/assets/logo.svg" },
			sidebar: [
				{
					label: "소개",
					link: "/",
				},
				{
					label: "기획 문서",
					autogenerate: { directory: "planning" },
				},
					{
						label: "PRD",
						autogenerate: { directory: "prd" },
					},
				{
					label: "API 문서",
					items: [
						{ label: "Meeting API (Swagger)", link: "/api/meeting/" },
						{ label: "Notification API (Swagger)", link: "/api/notification/" },
					],
				},
			],
			customCss: ["./src/styles/global.css"],
		}),
	],
});





