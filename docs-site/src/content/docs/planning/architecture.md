---
title: 아키텍처
---

# meet2meet — 아키텍처

## 시스템 구성

```
[Cloudflare Workers]                     [Fly.io]           [Supabase]
 Vike + Hono (vike-photon)          Go Core API Server      PostgreSQL
 ├── SSR 렌더링                      ├── 미팅 CRUD
 ├── /api/auth/* (OAuth)             ├── 시간 슬롯 계산
 └── /api/* → Go 서버 프록시          ├── 사용자 관리
                                     └── 알림 처리
```

| 계층 | 기술 | 역할 | 배포 |
|------|------|------|------|
| **프론트엔드 + BFF** | Vike + Hono | SSR 렌더링, OAuth, API 프록시 | Cloudflare Workers |
| **Core API** | Go (표준 라이브러리) | 비즈니스 로직 | Fly.io |
| **DB** | PostgreSQL | 데이터 저장 | Supabase |

---

## 레포지토리 구성

멀티레포로 운영한다.

| 레포 | 기술 | 내용 |
|------|------|------|
| `meet2meet` | Vike + Hono + React | 프론트엔드 + BFF |
| `meet2meet-api` | Go (표준 라이브러리) | Core API 서버 |

---

## 프론트엔드 + BFF (Cloudflare Workers)

### 기술 스택

- **Vike** — SSR/SPA/SSG 렌더링
- **vike-photon + @photonjs/cloudflare** — Cloudflare Workers 배포
- **Hono** — API 라우트, OAuth, Go 서버 프록시
- **React 19** — UI
- **Tailwind CSS v4** — 스타일링

### 역할

1. **SSR 렌더링** — 페이지 요청 시 서버에서 HTML 생성
2. **OAuth 처리** — 소셜 로그인 플로우 (Naver, Kakao, Google)
3. **토큰 인증** — OAuth 완료 후 앱 JWT 발급/검증 (Bearer)
4. **API 프록시** — `/api/*` 요청을 Go Core API로 전달

### 배포

```bash
pnpm i wrangler vike-photon @photonjs/cloudflare
wrangler deploy
```

- 무료 티어: 10만 요청/일
- 같은 도메인으로 프론트 + API 처리 → CORS/쿠키 문제 없음

---

## Core API 서버 (Go)

### 기술 스택

- **Go 표준 라이브러리** — `net/http` (외부 프레임워크 없음)
- **Docker** — 컨테이너 배포

### 역할

1. **미팅 도메인** — 미팅 생성, 조회, 시간 슬롯 계산, 투표
2. **사용자 도메인** — 프로필 관리
3. **알림** — PostgreSQL LISTEN/NOTIFY 기반

### 프로젝트 구조 (meet2meet-api)

```
meet2meet-api/
├── go.mod
├── go.sum
├── main.go
├── Dockerfile
├── internal/
│   ├── meeting/       # 미팅 핸들러 + 로직
│   ├── user/          # 사용자 핸들러 + 로직
│   ├── notification/  # 알림 처리
│   └── db/            # DB 연결, 마이그레이션
└── api/
    └── router.go      # 라우팅
```

### 배포

Fly.io에 Docker 이미지로 배포한다.

```dockerfile
FROM golang:1.24-alpine AS build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o server .

FROM alpine:3.21
COPY --from=build /app/server /server
EXPOSE 8080
CMD ["/server"]
```

- 무료 티어: shared VM 3개, 256MB RAM

---

## 통신 구조

```
[브라우저]
    │
    ▼
[Cloudflare Workers — Hono]
    ├── /login, /meeting/* → Vike SSR
    ├── /api/auth/*        → Hono에서 직접 처리 (OAuth + JWT)
    └── /api/meetings/*    → Go Core API로 HTTP 프록시
                                │
                                ▼
                           [Go 서버 — Fly.io]
                                │
                                ▼
                           [PostgreSQL — Supabase]
```

---

## 참가 승인/참가 코드 정책

초대 코드 기반 진입은 미팅별 `invite_policy`에 따라 분기한다.

- `auto`: 참가 요청 즉시 승인, `participant_code` 즉시 발급
- `approval`: 참가 요청은 `pending`으로 저장, 주최자가 승인 시 `participant_code` 발급

주요 데이터 흐름은 다음과 같다.

1. 참여자가 `inviteCode`로 미팅 기본 정보와 참가 정책을 조회한다.
2. 참여자가 참가 요청을 생성한다.
3. `approval` 정책이면 주최자가 요청을 승인/거절한다.
4. 발급된 `participant_code`를 통해 투표 결과 조회 권한을 검증한다.

핵심 테이블은 `meetings(invite_policy)`, `meeting_join_requests`, `meeting_participants`로 구성한다.

---

## 로컬 개발 환경

```bash
# 프론트엔드 (meet2meet/)
pnpm dev              # Vike 개발 서버 (localhost:3000)

# Core API (meet2meet-api/)
go run .              # Go 서버 (localhost:8080)

# DB (docker-compose)
docker compose up db  # PostgreSQL (localhost:5432)
```

---

## 비용 (무료 티어 기준)

| 서비스 | 무료 범위 | 유료 시작 |
|--------|----------|----------|
| Cloudflare Workers | 10만 요청/일 | $5/월 |
| Fly.io | shared VM 3개, 256MB | $1.94/월~ |
| Supabase | 500MB, 2개 프로젝트 | $25/월 |
| **합계** | **$0/월** | |

커스텀 도메인 구매 시 연 $10~15 추가.

---

## 기술 선택 근거

| 결정 | 이유 |
|------|------|
| Cloudflare Workers (BFF) | Vike 공식 지원 (vike-photon), 무료 티어 넉넉, 같은 도메인으로 CORS 없음 |
| Hono (BFF 서버) | Cloudflare Workers 네이티브 지원, 경량, TypeScript |
| Go 표준 라이브러리 | 학습 목적, 외부 의존성 제거, Go 1.22+ `net/http` 라우팅 충분 |
| 멀티레포 | 프론트엔드(TS)와 백엔드(Go) 기술 스택 분리, 독립 배포 |
| PostgreSQL (Supabase) | 관계형 데이터에 적합, LISTEN/NOTIFY로 알림 처리 가능 |
| SSR 대신 SPA 고려 가능 | meet2meet은 SEO 중요도 낮음, SPA로 시작 후 필요 시 SSR 전환 |
