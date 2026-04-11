# =============================================================================
# Dockerfile — meet2meet 개발 & 프로덕션 빌드
# =============================================================================
# Docker는 "컨테이너"라는 격리된 환경에서 앱을 실행합니다.
# 이 파일은 그 컨테이너를 어떻게 구성할지 정의하는 "레시피"입니다.
#
# 멀티스테이지 빌드: 여러 단계(stage)로 나눠서
#   1) 의존성 설치 → 2) 빌드 → 3) 실행용 경량 이미지
# 이렇게 하면 최종 이미지 크기가 작아집니다.
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: base — Node.js 기본 이미지 + pnpm 설치
# ---------------------------------------------------------------------------
# "FROM"은 어떤 이미지를 기반으로 할지 지정합니다.
# node:22-alpine = Node.js 22 + Alpine Linux (매우 가벼운 리눅스, ~5MB)
FROM node:22-alpine AS base

# corepack: Node.js에 내장된 패키지 매니저 관리 도구
# pnpm을 전역 설치하지 않고도 사용 가능하게 해 줍니다.
RUN corepack enable && corepack prepare pnpm@latest --activate

# ---------------------------------------------------------------------------
# Stage 2: deps — 의존성(node_modules) 설치
# ---------------------------------------------------------------------------
FROM base AS deps

# WORKDIR: 컨테이너 안에서의 작업 디렉토리 (cd와 비슷)
WORKDIR /app

# package.json, pnpm-lock.yaml만 먼저 복사합니다.
# 왜? → Docker는 각 명령을 "레이어"로 캐시합니다.
# 소스코드가 바뀌어도 의존성 파일이 안 바뀌면 이 레이어는 재사용됩니다.
# → 빌드 속도가 빨라집니다!
COPY package.json pnpm-lock.yaml ./

# --frozen-lockfile: lock 파일과 정확히 일치하는 버전만 설치
# CI/CD에서 "어? 내 PC에선 되는데?" 문제를 방지합니다.
RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# Stage 3: build — 앱 빌드
# ---------------------------------------------------------------------------
FROM base AS build
WORKDIR /app

# 이전 스테이지(deps)에서 설치한 node_modules를 복사
COPY --from=deps /app/node_modules ./node_modules

# 나머지 소스코드 전체 복사
COPY . .

# Vike 앱 빌드 (Vite 기반 SSR 빌드)
RUN pnpm build

# ---------------------------------------------------------------------------
# Stage 4: runner — 프로덕션 실행
# ---------------------------------------------------------------------------
FROM base AS runner
WORKDIR /app

# 보안: root 유저 대신 전용 유저를 만들어서 실행
# 컨테이너가 해킹당해도 호스트 시스템에 미치는 영향을 최소화합니다.
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# 빌드 결과물과 필요한 파일만 복사 (소스코드는 복사하지 않음!)
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

# 앱 실행 유저 변경
USER appuser

# EXPOSE: 컨테이너가 사용하는 포트를 선언 (문서화 용도)
# 실제 포트 매핑은 docker run -p 3000:3000 으로 합니다.
EXPOSE 3000

# 환경변수 설정
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# CMD: 컨테이너가 시작될 때 실행할 명령
# Vike는 빌드 후 dist/server/index.js 로 서버를 실행합니다.
CMD ["node", "./dist/server/index.js"]
