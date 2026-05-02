import { mkdir, readFile, writeFile, copyFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const docsSiteRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(docsSiteRoot, "..");
const sourceDocsRoot = path.resolve(projectRoot, "docs");

const docsContentRoot = path.resolve(
	docsSiteRoot,
	"src",
	"content",
	"docs",
	"planning",
);
const prdContentRoot = path.resolve(docsSiteRoot, "src", "content", "docs", "prd");
const sourcePrdRoot = path.resolve(sourceDocsRoot, "prd");
const publicWireframesRoot = path.resolve(docsSiteRoot, "public", "wireframes");
const publicOpenapiRoot = path.resolve(docsSiteRoot, "public", "openapi");

const planningMappings = [
	{
		source: path.resolve(sourceDocsRoot, "ARCHITECTURE.md"),
		dest: path.resolve(docsContentRoot, "architecture.md"),
		title: "아키텍처",
	},
	{
		source: path.resolve(sourceDocsRoot, "PROJECT_SETUP.md"),
		dest: path.resolve(docsContentRoot, "project-setup.md"),
		title: "프로젝트 설정",
	},
	{
		source: path.resolve(sourceDocsRoot, "features", "auth.md"),
		dest: path.resolve(docsContentRoot, "auth.md"),
		title: "인증 플로우",
	},
	{
		source: path.resolve(sourceDocsRoot, "features", "time-select.md"),
		dest: path.resolve(docsContentRoot, "time-select.md"),
		title: "시간 선택 테이블",
	},
	{
		source: path.resolve(sourceDocsRoot, "PWA_SETUP.md"),
		dest: path.resolve(docsContentRoot, "pwa-setup.md"),
		title: "PWA 설정",
	},
	{
		source: path.resolve(sourceDocsRoot, "NOTIFICATION_CORE_API_README.md"),
		dest: path.resolve(docsContentRoot, "notification-core-api.md"),
		title: "Notification Core API",
	},
];

const wireframeMappings = [
	{
		source: path.resolve(
			sourceDocsRoot,
			"features",
			"01.auth-wireframe-login.html",
		),
		dest: path.resolve(publicWireframesRoot, "01.auth-wireframe-login.html"),
	},
	{
		source: path.resolve(
			sourceDocsRoot,
			"features",
			"02.meeting-new-wireframe.html",
		),
		dest: path.resolve(publicWireframesRoot, "02.meeting-new-wireframe.html"),
	},
	{
		source: path.resolve(
			sourceDocsRoot,
			"features",
			"03.meeting-detail-wireframe.html",
		),
		dest: path.resolve(publicWireframesRoot, "03.meeting-detail-wireframe.html"),
	},
	{
		source: path.resolve(
			sourceDocsRoot,
			"features",
			"04.meeting-finalize-wireframe.html",
		),
		dest: path.resolve(publicWireframesRoot, "04.meeting-finalize-wireframe.html"),
	},
	{
		source: path.resolve(
			sourceDocsRoot,
			"features",
			"05.meeting-reminder-attendance-wireframe.html",
		),
		dest: path.resolve(
			publicWireframesRoot,
			"05.meeting-reminder-attendance-wireframe.html",
		),
	},
	{
		source: path.resolve(
			sourceDocsRoot,
			"features",
			"06.meeting-recap-next-step-wireframe.html",
		),
		dest: path.resolve(
			publicWireframesRoot,
			"06.meeting-recap-next-step-wireframe.html",
		),
	},
	{
		source: path.resolve(
			sourceDocsRoot,
			"features",
			"07.meeting-mobile-rsvp-quick-flow-wireframe.html",
		),
		dest: path.resolve(
			publicWireframesRoot,
			"07.meeting-mobile-rsvp-quick-flow-wireframe.html",
		),
	},
];

const openApiMappings = [
	{
		source: path.resolve(sourceDocsRoot, "MEETING_API_SPEC.yaml"),
		dest: path.resolve(publicOpenapiRoot, "MEETING_API_SPEC.yaml"),
	},
	{
		source: path.resolve(sourceDocsRoot, "NOTIFICATION_API_SPEC.yaml"),
		dest: path.resolve(publicOpenapiRoot, "NOTIFICATION_API_SPEC.yaml"),
	},
];

function withFrontMatter(title, body) {
	return `---\ntitle: ${title}\n---\n\n${body.trim()}\n`;
}

function titleFromFileName(fileName) {
	const stem = fileName.replace(/\.md$/i, "");
	const normalized = stem.replace(/^\d{4}-\d{2}-\d{2}-/, "");
	return normalized
		.split("-")
		.map((token) => token.charAt(0).toUpperCase() + token.slice(1))
		.join(" ");
}

for (const mapping of planningMappings) {
	await mkdir(path.dirname(mapping.dest), { recursive: true });
	const sourceBody = await readFile(mapping.source, "utf8");
	await writeFile(
		mapping.dest,
		withFrontMatter(mapping.title, sourceBody),
		"utf8",
	);
}

for (const mapping of wireframeMappings) {
	await mkdir(path.dirname(mapping.dest), { recursive: true });
	await copyFile(mapping.source, mapping.dest);
}

await mkdir(prdContentRoot, { recursive: true });
const prdFiles = (await readdir(sourcePrdRoot)).filter((name) => name.endsWith(".md"));

for (const prdFile of prdFiles) {
	const source = path.resolve(sourcePrdRoot, prdFile);
	const dest = path.resolve(prdContentRoot, prdFile);
	const sourceBody = await readFile(source, "utf8");
	await writeFile(dest, withFrontMatter(titleFromFileName(prdFile), sourceBody), "utf8");
}

for (const mapping of openApiMappings) {
	await mkdir(path.dirname(mapping.dest), { recursive: true });
	await copyFile(mapping.source, mapping.dest);
}

console.log("Planning docs, PRDs, wireframes, and OpenAPI spec synchronized.");
