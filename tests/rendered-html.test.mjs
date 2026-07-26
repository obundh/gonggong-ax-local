import assert from "node:assert/strict";
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
  assert.match(html, /<title>문서살림 \| 공공 AX 로컬 시리즈 2<\/title>/i);
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
    /<title>업무이어봄 \| 공공 AX 로컬 시리즈 3<\/title>/i,
  );
  assert.match(html, /폴더와 파일명만으로/);
  assert.match(html, /인수인계 폴더 선택/);
  assert.match(html, /파일 내용은 읽지 않습니다/);
  assert.match(html, /외부 전송 없음/);
  assert.match(html, /재난업무 예시로 체험/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});
