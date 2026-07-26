# 공공 AX 로컬 시리즈

공공업무를 외부 전송 없이 처리하는 로컬 우선 도구 모음입니다.

- `/`: 공공 AX 로컬 시리즈 1 업무공간
- `/series2`: 공공 AX 로컬 시리즈 2 `문서살림`
- `/series3`: 공공 AX 로컬 시리즈 3 `업무이어봄`

## 시리즈 2 · 문서살림

HWP 5.0, HWPX, DOCX, UTF-8 TXT의 본문을 브라우저 메모리에서 읽어 맞춤법,
띄어쓰기, 문서 표기, 공공언어를 규칙 기반으로 검사합니다.

- HWP/HWPX는 글꼴·표·그림·쪽 배치를 페이지 SVG로 로컬 재현
- 쪽별 원문 미리보기와 현재 쪽 검사 결과를 나란히 표시
- 최초 원문과 적용된 수정·남은 제안을 줄별 전후 비교로 확인
- 국립국어원 공공언어 용어 1,331개를 빌드에 포함
- 높은 확신도의 기계적 오류만 `안전 수정`으로 일괄 적용
- 문맥에 따라 달라지는 쉬운 말 제안은 담당자가 한 건씩 선택
- 원본 파일은 변경하지 않고 수정본 TXT와 검사보고서 CSV를 내려받음
- 파일 내용 업로드 API, 서버 저장소, 외부 맞춤법 API를 사용하지 않음

암호·배포용 문서나 HWP 5.0보다 오래된 형식은 열리지 않을 수 있습니다.
DOCX/TXT는 현재 본문을 읽기 편한 가상 페이지로 나누며, 원본 형식을 보존한
DOCX 재생성과 HWP/HWPX 원본 파일 직접 수정은 후속 단계입니다.

## 시리즈 3 · 업무이어봄

사용자가 선택한 폴더의 이름과 파일명, 확장자, 수정일만 브라우저 메모리에서
분석해 1차 인수인계 업무지도를 만듭니다.

- 문서 본문을 읽지 않고 업무 가지와 문서 역할 후보를 분류
- 완료·진행·상시관리 단서를 확정이 아닌 추정으로 표시
- 모든 판단에 근거 파일명을 연결
- Markdown 인수인계 초안과 JSON 분석 결과 다운로드
- 선택적으로 이 PC의 Ollama 모델에 파일명 분석 결과만 보내 초안을 정리
- 파일 내용 업로드 API, 서버 저장소, 원본 변경 없음

브라우저의 폴더 선택 결과에는 빈 폴더가 포함되지 않으며, 파일명만으로 실제
시행·결재·완료 상태를 확정할 수 없습니다. 본문 파싱 후 재분류는 다음
단계입니다.

A clean full-stack starter running on
[vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and
Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

This starter does not use `wrangler.jsonc`.

## Included Shape

- edit site code under `app/`
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

OpenAI workspace sites can read the current user's email from
`oai-authenticated-user-email`.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build both series and verify the rendered HTML
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
