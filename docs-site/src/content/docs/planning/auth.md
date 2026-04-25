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
3. 백엔드 → 소셜 제공자: OAuth 인증 페이지로 리다이렉트
4. 사용자: 소셜 제공자에서 인증 완료
5. 소셜 제공자 → 백엔드: GET /api/auth/{provider}/callback?code=xxx
6. 백엔드: code로 access_token 교환 → 사용자 정보 조회 → 회원 생성/조회
7. 백엔드 → 프론트엔드: 앱 JWT 토큰 발급 후 `/auth/callback#token=...`로 리다이렉트
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

### 2. 콜백

```
GET /api/auth/{provider}/callback?code={authorization_code}&state={csrf_state}
```

**성공 응답**: 302 Redirect → `/auth/callback#token={jwt}`

**실패 응답**: 302 Redirect → `/login?error={error_code}`

| error_code          | 설명                        |
|---------------------|-----------------------------|
| `auth_failed`       | 소셜 인증 실패               |
| `token_exchange`    | 토큰 교환 실패               |
| `user_info`         | 사용자 정보 조회 실패         |
| `server_error`      | 서버 내부 오류               |

### 3. 로그아웃

```
POST /api/auth/logout
```

**응답**: 200 OK (서버 측 무상태, 클라이언트 토큰 삭제 트리거)

```json
{ "ok": true }
```

### 4. 현재 사용자 조회

```
GET /api/auth/me
```

요청 헤더:
```http
Authorization: Bearer <token>
```

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
| User Info URL    | `https://www.googleapis.com/oauth2/v2/userinfo`       |
| Callback URL     | `/api/auth/google/callback`                           |
| 환경변수 (ID)    | `GOOGLE_CLIENT_ID`                                    |
| 환경변수 (Secret)| `GOOGLE_CLIENT_SECRET`                                |

## 프론트엔드 사용법

```tsx
// 로그인 버튼 클릭 시
window.location.href = "/api/auth/kakao";

// OAuth 콜백 페이지 (/auth/callback)에서 토큰 저장
const hash = new URLSearchParams(window.location.hash.slice(1));
const token = hash.get("token");
if (token) {
  localStorage.setItem("meet2meet.auth.token", token);
  window.location.replace("/");
}

// 에러 표시 (콜백 실패 시)
const params = new URLSearchParams(window.location.search);
const error = params.get("error"); // "auth_failed" 등
```
