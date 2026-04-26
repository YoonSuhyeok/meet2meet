---
title: 인증 플로우
---

# OAuth 인증 API Spec

## 개요

소셜 로그인을 통한 회원가입/로그인 통합 플로우.
OAuth 2.0 Authorization Code Grant 방식을 사용한다.

## 플로우

```
1. 프론트엔드: /login 페이지에서 소셜 로그인 버튼 클릭
2. 프론트엔드 → 백엔드: GET /api/auth/{provider} 요청
3. 백엔드: OAuth state 생성 후 HttpOnly 쿠키로 저장
4. 백엔드 → 소셜 제공자: state 포함 OAuth 인증 페이지로 리다이렉트
5. 사용자: 소셜 제공자에서 인증 완료
6. 소셜 제공자 → 백엔드: GET /api/auth/{provider}/callback?code=xxx&state=yyy
7. 백엔드: state 검증 → code로 access_token 교환 → 사용자 정보 조회
8. 백엔드: 앱 JWT 발급 후 HttpOnly 쿠키(`meet2meet_auth`) 설정
9. 백엔드 → 프론트엔드: `/auth/callback`으로 리다이렉트
```

## 엔드포인트

### 1. 소셜 로그인 시작

```
GET /api/auth/{provider}
```

| Provider | 값       |
|----------|----------|
| 네이버   | `naver`  |
| 카카오   | `kakao`  |
| 구글     | `google` |

**응답**: 302 Redirect → 소셜 제공자의 OAuth 인증 페이지

보안:
- 서버가 state를 발급하여 provider별 HttpOnly 쿠키(`meet2meet_oauth_state_{provider}`)로 저장
- 콜백에서 query state와 쿠키 state를 반드시 일치 검증

### 2. 콜백

```
GET /api/auth/{provider}/callback?code={authorization_code}&state={csrf_state}
```

**성공 응답**: 302 Redirect → `/auth/callback`

성공 시 서버 동작:
- `Set-Cookie: meet2meet_auth=<jwt>; HttpOnly; SameSite=Lax; Path=/`
- state 쿠키 즉시 삭제

**실패 응답**: 302 Redirect → `/login?error={error_code}`

| error_code          | 설명                        |
|---------------------|-----------------------------|
| `auth_failed`       | 소셜 인증 실패               |
| `invalid_state`     | CSRF 방어 state 불일치/누락  |
| `token_exchange`    | 토큰 교환 실패               |
| `user_info`         | 사용자 정보 조회 실패         |
| `server_error`      | 서버 내부 오류               |

### 3. 로그아웃

```
POST /api/auth/logout
```

**응답**: 200 OK

서버 동작:
- `meet2meet_auth` 쿠키 삭제 (만료)

```json
{ "ok": true }
```

### 4. 현재 사용자 조회

```
GET /api/auth/me
```

인증 방식:
- 기본: 브라우저가 same-origin 요청에 HttpOnly 쿠키 자동 전송
- 호환: `Authorization: Bearer <token>` 헤더도 허용

**인증됨 (200)**:
```json
{
  "id": "uuid",
  "name": "홍길동",
  "email": "hong@example.com",
  "profileImage": "https://...",
  "provider": "kakao"
}
```

**미인증 (401)**:
```json
{ "error": "unauthorized" }
```

## OAuth 제공자별 설정

### Naver

| 항목             | 값                                             |
|------------------|------------------------------------------------|
| Auth URL         | `https://nid.naver.com/oauth2.0/authorize`     |
| Token URL        | `https://nid.naver.com/oauth2.0/token`         |
| User Info URL    | `https://openapi.naver.com/v1/nid/me`          |
| Callback URL     | `/api/auth/naver/callback`                     |
| 환경변수 (ID)    | `NAVER_CLIENT_ID`                              |
| 환경변수 (Secret)| `NAVER_CLIENT_SECRET`                          |

### Kakao

| 항목             | 값                                                  |
|------------------|-----------------------------------------------------|
| Auth URL         | `https://kauth.kakao.com/oauth/authorize`           |
| Token URL        | `https://kauth.kakao.com/oauth/token`               |
| User Info URL    | `https://kapi.kakao.com/v2/user/me`                 |
| Callback URL     | `/api/auth/kakao/callback`                          |
| 환경변수 (ID)    | `KAKAO_CLIENT_ID`                                   |
| 환경변수 (Secret)| `KAKAO_CLIENT_SECRET`                               |

### Google

| 항목             | 값                                                    |
|------------------|-------------------------------------------------------|
| Auth URL         | `https://accounts.google.com/o/oauth2/v2/auth`       |
| Token URL        | `https://oauth2.googleapis.com/token`                 |
| User Info URL    | `https://openidconnect.googleapis.com/v1/userinfo`    |
| Callback URL     | `/api/auth/google/callback`                           |
| 환경변수 (ID)    | `GOOGLE_CLIENT_ID`                                    |
| 환경변수 (Secret)| `GOOGLE_CLIENT_SECRET`                                |

## 프론트엔드 사용법

```tsx
// 로그인 버튼 클릭 시
window.location.href = "/api/auth/kakao";

// OAuth 콜백 페이지 (/auth/callback)
// 서버가 이미 HttpOnly 쿠키를 설정했으므로 홈으로 이동만 수행
window.location.replace("/");

// 보호 API 호출 시 same-origin 쿠키 사용
const res = await fetch("/api/auth/me", {
  credentials: "same-origin",
});

// 에러 표시 (콜백 실패 시)
const params = new URLSearchParams(window.location.search);
const error = params.get("error"); // "auth_failed", "invalid_state" 등
```
