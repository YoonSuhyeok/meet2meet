---
title: Meet2Meet 문서 포털
description: 기획 문서 + Swagger(OpenAPI) 통합 문서
template: splash
hero:
  title: Meet2Meet 문서 포털
  tagline: 기획 문서 + Swagger(OpenAPI) 통합 문서
  actions:
    - text: 기획 문서 보기
      link: /planning/architecture/
      icon: right-arrow
      variant: primary
    - text: Meeting API
      link: /api/meeting/
      icon: external
---

## 포함 내용

1. 기획/아키텍처 문서 (`docs/` 소스 동기화)
2. PRD 문서 (`docs/prd/` 소스 동기화)
3. 와이어프레임 HTML 산출물
4. OpenAPI 스펙 기반 API 문서 (`MEETING_API_SPEC.yaml`)

## 동기화 방식

- 기획 문서와 와이어프레임은 `pnpm run sync:planning`에서 자동 반영됩니다.
- API 문서는 `/api/meeting/` 페이지에서 Scalar로 인터랙티브하게 확인할 수 있습니다.
