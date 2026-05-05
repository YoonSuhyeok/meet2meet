Generated with [vike.dev/new](https://vike.dev/new) ([version 599](https://www.npmjs.com/package/create-vike/v/0.0.599)) using this command:

```sh
pnpm create vike@latest --react
```

## Contents

- [Vike](#vike)
  - [Plus files](#plus-files)
  - [Routing](#routing)
  - [SSR](#ssr)
  - [HTML Streaming](#html-streaming)

## Vike

This app is ready to start. It's powered by [Vike](https://vike.dev) and [React](https://react.dev/learn).

### Plus files

[The + files are the interface](https://vike.dev/config) between Vike and your code.

- [`+config.ts`](https://vike.dev/settings) — Settings (e.g. `<title>`)
- [`+Page.tsx`](https://vike.dev/Page) — The `<Page>` component
- [`+data.ts`](https://vike.dev/data) — Fetching data (for your `<Page>` component)
- [`+Layout.tsx`](https://vike.dev/Layout) — The `<Layout>` component (wraps your `<Page>` components)
- [`+Head.tsx`](https://vike.dev/Head) - Sets `<head>` tags
- [`/pages/_error/+Page.tsx`](https://vike.dev/error-page) — The error page (rendered when an error occurs)
- [`+onPageTransitionStart.ts`](https://vike.dev/onPageTransitionStart) and `+onPageTransitionEnd.ts` — For page transition animations

### Routing

[Vike's built-in router](https://vike.dev/routing) lets you choose between:

- [Filesystem Routing](https://vike.dev/filesystem-routing) (the URL of a page is determined based on where its `+Page.jsx` file is located on the filesystem)
- [Route Strings](https://vike.dev/route-string)
- [Route Functions](https://vike.dev/route-function)

### SSR

SSR is enabled by default. You can [disable it](https://vike.dev/ssr) for all or specific pages.

### HTML Streaming

You can [enable/disable HTML streaming](https://vike.dev/stream) for all or specific pages.

## Documentation Portal (Docusaurus + Swagger)

기획 문서와 OpenAPI 문서를 통합해서 보려면 아래를 실행합니다.

```sh
cd docs-site
pnpm install
pnpm start
```

또는 루트에서:

```sh
pnpm docs:dev
```

- 문서 서버: `http://localhost:3001`
- OpenAPI 소스: `docs/MEETING_API_SPEC.yaml`
- 기획 문서/와이어프레임은 실행 시 자동 동기화됩니다.

## PWA Push 테스트 메모

브라우저 구독 생성 시 VAPID 공개키가 필요합니다. 로컬 실행 전 아래 값을 설정하세요.

```powershell
$env:VITE_VAPID_PUBLIC_KEY = "<your-public-key>"
pnpm dev --host 0.0.0.0
```

참고: 현재 서비스워커 등록은 `import.meta.env.DEV`에서 비활성화되어 있어, 실제 PWA 알림 검증은 `pnpm preview -- --host 0.0.0.0` 실행 환경을 권장합니다.

수동 테스트 발송은 BFF 경유 API로 호출할 수 있습니다.

- `POST /api/meetings/:meetingId/push-test-send`
