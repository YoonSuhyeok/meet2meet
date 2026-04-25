import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
	title: "Meet2Meet 문서 포털",
	tagline: "기획 문서 + Swagger(OpenAPI) 통합 문서",
	favicon: "img/logo.svg",

	url: "https://meet2meet.local",
	baseUrl: "/",

	organizationName: "meet2meet",
	projectName: "meet2meet-docs",

	onBrokenLinks: "throw",
	markdown: {
		hooks: {
			onBrokenMarkdownLinks: "warn",
		},
	},

	// Use SWC for the JS loader instead of Babel.
	// `docusaurus-theme-openapi-docs` ships transpiled CJS files; Babel's
	// `@babel/plugin-transform-runtime` injects ESM helper imports into them,
	// which then makes webpack interpret the file as ESM and `exports`
	// becomes undefined at runtime. SWC handles CJS interop correctly.
	future: {
		faster: {
			swcJsLoader: true,
		},
	},

	i18n: {
		defaultLocale: "ko",
		locales: ["ko"],
	},

	presets: [
		[
			"classic",
			{
				docs: {
					path: "docs",
					routeBasePath: "/",
					sidebarPath: "./sidebars.ts",
				},
				blog: false,
				pages: false,
				theme: {
					customCss: "./src/css/custom.css",
				},
			} satisfies Preset.Options,
		],
	],

	plugins: [
		[
			"docusaurus-plugin-openapi-docs",
			{
				id: "openapi",
				docsPluginId: "classic",
				config: {
					meetingApi: {
						specPath: "openapi/MEETING_API_SPEC.yaml",
						outputDir: "docs/api/meeting/generated",
						sidebarOptions: {
							groupPathsBy: "tag",
						},
						downloadUrl: "/openapi/MEETING_API_SPEC.yaml",
					},
				},
			},
		],
	],

	themes: ["docusaurus-theme-openapi-docs"],

	themeConfig: {
		navbar: {
			title: "Meet2Meet Docs",
			items: [
				{
					to: "/",
					label: "기획 문서",
					position: "left",
				},
				{
					to: "/api/meeting",
					label: "Swagger API",
					position: "left",
				},
			],
		},
		footer: {
			style: "dark",
			links: [
				{
					title: "문서",
					items: [
						{
							label: "기획 개요",
							to: "/",
						},
						{
							label: "Swagger API",
							to: "/api/meeting",
						},
					],
				},
			],
			copyright: `Copyright © ${new Date().getFullYear()} Meet2Meet.`,
		},
		prism: {
			theme: prismThemes.github,
			darkTheme: prismThemes.dracula,
		},
	} satisfies Preset.ThemeConfig,
};

export default config;
