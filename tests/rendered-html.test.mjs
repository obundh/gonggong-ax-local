import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Public AX Local workspace", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ko">/i);
  assert.match(html, /<title>공공 AX 로컬 시리즈 1<\/title>/i);
  assert.match(html, /오늘은 어떤 업무를/);
  assert.match(html, /로컬 LLM 찾기/);
  assert.match(html, /Gemma 4 E2B/);
  assert.match(html, /외부 전송 없음/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("server-renders the local public-document checker", async () => {
  const response = await render("/series2");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>공공AX 로컬 시리즈 2 - 문서 검수<\/title>/i);
  assert.match(html, /공공문서 로컬 검수기/);
  assert.match(html, /HWP · HWPX · DOCX · TXT/);
  assert.match(html, /원문 페이지 이동/);
  assert.match(html, /쪽<\/strong> 검사 결과/);
  assert.match(html, /전후 비교/);
  assert.match(html, /형광펜 범주 선택/);
  assert.match(html, /type="checkbox"/);
  assert.match(html, /외부 전송 없음/);
  assert.match(html, /국립국어원 공공언어/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("server-renders the filename-only handover mapper", async () => {
  const response = await render("/series3");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(
    html,
    /<title>공공 AX 로컬 시리즈 - 인수인계<\/title>/i,
  );
  assert.match(html, /파일 탐색/);
  assert.match(html, /일정 달력/);
  assert.match(html, /월간·목록 달력과 연·월 바로가기/);
  assert.match(html, /series3-og-v4\.png/);
  assert.match(html, /파일명 날짜는 시행일 후보/);
  assert.match(html, /파일 수정일은 시행일이 아닙니다/);
  assert.match(html, /파일명에서 추출한 제목 후보/);
  assert.match(html, /인수인계 폴더 선택/);
  assert.match(html, /CPU 경량 분류 엔진 v2/);
  assert.match(html, /파일 내용은 읽지 않습니다/);
  assert.match(html, /인터넷·기관 외부 전송 없음/);
  assert.match(html, /재난업무 예시로 체험/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("server-renders the local document resource extractor", async () => {
  const response = await render("/series5");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>공공 AX 로컬 5 - 문서 리소스 추출기<\/title>/i);
  assert.match(html, /문서 리소스 추출기/);
  assert.match(html, /ZIP 패키지 문서(?:\s|<!-- -->)*33(?:\s|<!-- -->)*종/);
  assert.match(html, /DOCX · DOCM · DOTX · DOTM/);
  assert.match(html, /PPTX · PPTM · POTX · POTM · PPSX · PPSM/);
  assert.match(html, /XLSX · XLSM · XLSB · XLTX · XLTM/);
  assert.match(html, /ODT · ODS · ODP · ODG · OTT · OTS · OTP · OTG/);
  assert.match(html, /VSDX · VSDM · VSSX · VSSM · VSTX · VSTM/);
  assert.match(html, /XPS · OXPS/);
  assert.match(html, /EPUB/);
  assert.match(html, /파일 선택/);
  assert.match(html, /파일 끌어놓기/);
  assert.match(html, /지원 문서/);
  assert.match(html, /미지원 문서/);
  assert.match(html, /HWP · DOC · PPT · XLS/);
  assert.match(html, /PDF · 일반 ZIP/);
  assert.match(html, /암호 · DRM · 손상/);
  assert.match(html, /외부 전송 없음/);
  assert.match(html, /Windows 원클릭/);
  assert.match(html, /series5-v0\.1\.0/);
  assert.match(html, /series5-og\.png/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("series 3 exposes shared year-month controls and both calendar views", async () => {
  const source = await readFile(
    new URL("../app/series3/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /aria-label="연도 선택"/);
  assert.match(source, /aria-label="월 선택"/);
  assert.match(source, /aria-label="달력 보기 방식"/);
  assert.match(source, />\s*월간 보기\s*</);
  assert.match(source, />\s*목록 보기\s*</);
  assert.match(source, /calendarEvidenceItems\(evidence\)/);
});
