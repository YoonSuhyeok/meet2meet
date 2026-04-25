---
title: 프로젝트 설정
---

# meet2meet — 프로젝트 설정 문서

## 기술 스택

| 항목 | 기술 | 버전 | 역할 |
|------|------|------|------|
| **프레임워크** | Vike (Vite 기반 SSR/SSG) | 0.4.256 | 페이지 라우팅, SSR |
| **UI 라이브러리** | React | 19.2.4 | 컴포넌트 렌더링 |
| **타입 체크** | TypeScript 7 (`@typescript/native-preview`) | 7.0.0-dev | Go로 작성된 네이티브 컴파일러, `tsgo` 명령어 사용 |
| **번들러** | Vite | 7.3.2 | 개발 서버 + 프로덕션 빌드 (esbuild 트랜스파일) |
| **스타일링** | Tailwind CSS v4 | 4.2.2 | 유틸리티 퍼스트 CSS |
| **컴포넌트 시스템** | shadcn/UI | 수동 설정 | 복사-붙여넣기 방식의 컴포넌트 라이브러리 |
| **컴포넌트 문서** | Storybook | 10.3.4 | 컴포넌트 격리 개발 & 시각적 테스트 |
| **컨테이너** | Docker | - | 개발/배포 환경 격리 |
| **패키지 매니저** | pnpm | 10.30+ | 빠른 의존성 관리 |

---

## 프로젝트 구조

```
meet2meet/
├── .storybook/
│   ├── main.ts              # Storybook 설정 (스토리 경로, 프레임워크)
│   └── preview.ts            # Storybook 글로벌 CSS, 뷰포트 프리셋
├── assets/
│   └── logo.svg
├── components/               # 재사용 가능한 UI 컴포넌트
│   └── Link.tsx
├── lib/
│   └── utils.ts              # cn() 유틸리티 (clsx + tailwind-merge)
├── pages/                    # Vike 파일시스템 라우팅
│   ├── +Layout.tsx           # 공통 레이아웃
│   ├── +Head.tsx             # <head> 메타태그
│   ├── Layout.css            # 글로벌 CSS (Tailwind import + shadcn 테마)
│   ├── index/+Page.tsx       # / 페이지
│   ├── todo/+Page.tsx        # /todo 페이지
│   └── star-wars/            # /star-wars 페이지 (데이터 페칭 예시)
├── .dockerignore             # Docker 빌드 시 제외 파일
├── docker-compose.yml        # 개발 환경 컨테이너 구성
├── Dockerfile                # 멀티스테이지 빌드 (학습용 주석 포함)
├── package.json
├── tsconfig.json             # TypeScript 설정 (@ 경로 별칭 포함)
└── vite.config.ts            # Vite 설정 (Tailwind + Vike + React + alias)
```

---

## 실행 명령어

### 로컬 개발 (pnpm 직접 실행)

```bash
# 의존성 설치
pnpm install

# 개발 서버 (http://localhost:3000)
pnpm dev

# Storybook (http://localhost:6006)
pnpm storybook

# 타입 체크 (TypeScript 7 / tsgo)
pnpm typecheck

# 프로덕션 빌드
pnpm build

# 프로덕션 미리보기
pnpm preview
```

### Docker 실행

```bash
# 개발 서버 + Storybook 동시 실행
docker compose up

# 백그라운드 실행
docker compose up -d

# 특정 서비스만 실행
docker compose up app-dev         # 개발 서버만
docker compose up storybook       # Storybook만

# 이미지 재빌드 (Dockerfile 또는 의존성 변경 시)
docker compose up --build

# 종료
docker compose down

# 프로덕션 이미지 빌드 & 실행
docker build -t meet2meet .
docker run -p 3000:3000 meet2meet
```

---

## Docker 학습 가이드

### 핵심 개념

| 개념 | 설명 | 비유 |
|------|------|------|
| **Image** | 앱 실행에 필요한 모든 것을 담은 읽기 전용 패키지 | 요리의 "레시피" |
| **Container** | 이미지를 실행한 인스턴스 | 레시피대로 만든 "요리" |
| **Dockerfile** | 이미지를 만드는 명령어 모음 | 레시피 작성법 |
| **docker-compose** | 여러 컨테이너를 한 번에 관리 | 코스 요리 전체 구성표 |
| **Volume** | 호스트↔컨테이너 폴더 연결 | 공유 폴더 |
| **Port mapping** | 호스트 포트 ↔ 컨테이너 포트 연결 | 건물 입구 ↔ 방 번호 |

### 멀티스테이지 빌드 (이 프로젝트에서 사용)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Stage 1    │     │  Stage 2    │     │  Stage 3    │
│  base       │────▶│  deps       │────▶│  build      │
│  Node.js +  │     │  pnpm       │     │  vike build │
│  pnpm 설치  │     │  install    │     │             │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                        ┌──────▼──────┐
                                        │  Stage 4    │
                                        │  runner     │
                                        │  dist/ 만   │
                                        │  복사해서   │
                                        │  경량 실행  │
                                        └─────────────┘
```

### 자주 쓰는 Docker 명령어

```bash
# 이미지 목록
docker images

# 실행 중인 컨테이너 목록
docker ps

# 모든 컨테이너 (중지된 것 포함)
docker ps -a

# 컨테이너 안으로 셸 접속 (디버깅)
docker exec -it <컨테이너ID> sh

# 컨테이너 로그 보기
docker logs <컨테이너ID>

# 사용하지 않는 이미지/컨테이너 정리
docker system prune
```

---

## shadcn/UI 컴포넌트 추가 방법

이 프로젝트는 Next.js가 아니므로 `npx shadcn` CLI를 직접 사용할 수 없습니다.
[shadcn/ui 공식 사이트](https://ui.shadcn.com/)에서 컴포넌트 코드를 복사하여 `components/ui/` 폴더에 추가합니다.

```bash
# 예: Button 컴포넌트 추가
# 1. https://ui.shadcn.com/docs/components/button 에서 코드 복사
# 2. components/ui/button.tsx 파일 생성
# 3. import 경로를 @/lib/utils 로 수정
```

임포트 예시:
```tsx
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
```

---

## 경로 별칭 (Path Alias)

`@/`는 프로젝트 루트를 가리킵니다.

```tsx
// ❌ 상대 경로
import { cn } from "../../../lib/utils";

// ✅ 별칭 사용
import { cn } from "@/lib/utils";
```

설정 위치:
- `tsconfig.json` → `paths: { "@/*": ["./*"] }` (타입체크용)
- `vite.config.ts` → `resolve.alias` (빌드용)

---

## TypeScript 7 (native-preview) 참고

- **타입체크**: `pnpm typecheck` (`tsgo --noEmit`)
- **빌드**: Vite가 esbuild로 트랜스파일 (tsgo는 빌드에 관여하지 않음)
- **상태**: 파싱, 타입체킹, JSX 완료. Declaration emit / JS output 일부 진행 중
- **VS Code**: TypeScriptTeam.native-preview 확장 설치 후 `"js/ts.experimental.useTsgo": true` 설정
