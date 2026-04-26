# Meet2Meet PWA 적용 가이드

## 목표

Meet2Meet 웹앱을 설치 가능한 PWA로 구성해 재방문성과 체감 성능을 높입니다.

## 적용 가능성 점검

현재 스택(Vike + Vite + Cloudflare Worker) 기준으로 PWA 적용은 가능합니다.

- 정적 자산(`manifest.webmanifest`, `sw.js`)은 Vite 빌드 결과에 포함되어 Worker에서 제공 가능
- HTTPS 배포 환경에서 Service Worker 동작 가능 (Cloudflare 배포 기본 HTTPS)
- API 요청 경로(`/api/*`)는 네비게이션 fallback 대상에서 제외하여 SSR/BFF 흐름과 충돌 방지 가능

주의 사항:

- 오프라인에서 동적 API 데이터는 보장되지 않음 (현재는 정적 자산/폰트 캐싱 중심)
- iOS의 Web Push 등 일부 기능은 브라우저 정책 제한을 받음

## 1차 설정 범위 (초기 적용)

1. Vite PWA 플러그인 추가 (`vite-plugin-pwa`)
2. `manifest.webmanifest` 생성
3. Service Worker 생성/등록
4. 기본 메타태그(테마컬러, 애플 웹앱 태그) 추가
5. PWA 아이콘 추가

## 현재 반영 상태 (2026-04-26)

- 완료: `vite-plugin-pwa` 설정 및 `manifest.webmanifest` 생성
- 완료: Service Worker 등록(`src/pages/+Layout.tsx`) 및 자동 업데이트 전략
- 완료: 오프라인 네비게이션 fallback 페이지(`public/offline.html`) 연결
- 완료: 읽기 전용 API(`GET /api/meetings*`) NetworkFirst 캐시 정책 적용
- 완료: `/api/*` 경로는 navigation fallback 제외

운영 참고:

- 쓰기 요청(POST/PUT 등)은 캐시하지 않음
- 읽기 캐시는 최신성 우선으로 짧은 TTL(5분) 사용

## 체크 방법

### 로컬 빌드 확인

```bash
pnpm build
pnpm preview
```

브라우저에서 확인:

- `/manifest.webmanifest` 응답 확인
- `/sw.js` 응답 확인
- DevTools > Application > Service Workers 등록 상태 확인

### Lighthouse 점검

Chrome Lighthouse의 PWA 항목에서 아래를 확인합니다.

- Web app manifest 통과
- Service worker 등록 통과
- Installable 기준 통과 여부

## 다음 단계 (운영 기준 고도화)

- 앱 아이콘 PNG 다중 사이즈(192/512) 추가
- 버전 배포 시 SW 업데이트 정책 검증
- Lighthouse PWA 항목 정기 점검 자동화
