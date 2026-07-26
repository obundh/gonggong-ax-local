import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeFilenameInventory,
  buildFilenameHandoverMarkdown,
} from "../app/series3/filename-analyzer.mjs";

function item(relativePath, lastModified = Date.UTC(2026, 0, 1)) {
  const parts = relativePath.split("/");
  return {
    name: parts.at(-1),
    relativePath,
    size: 1024,
    lastModified,
  };
}

test("groups a plan and result into one recurring disaster drill branch", () => {
  const analysis = analyzeFilenameInventory([
    item("재난업무/훈련/2025_안전한국훈련_추진계획.hwp"),
    item("재난업무/훈련/2025_안전한국훈련_결과보고_최종.hwp"),
  ]);

  assert.equal(analysis.rootName, "재난업무");
  assert.equal(analysis.branches.length, 1);
  assert.equal(analysis.branches[0].label, "안전한국훈련");
  assert.equal(analysis.branches[0].mode, "PERIODIC");
  assert.equal(analysis.branches[0].statusCode, "TERMINAL_SIGNAL_FOUND");
  assert.deepEqual(analysis.branches[0].periods, ["2025"]);
  assert.equal(analysis.branches[0].files[0].analysisTitle, "안전한국훈련");
  assert.equal(analysis.branches[0].files[1].analysisTitle, "안전한국훈련");
});

test("keeps an explicit filename-derived title for the preview pane", () => {
  const analysis = analyzeFilenameInventory([
    item("인수인계/재난대응훈련/2026_재난대응훈련_시행계획_초안.hwpx"),
  ]);

  assert.equal(analysis.rootName, "인수인계");
  assert.equal(analysis.branches[0].files[0].analysisTitle, "재난대응훈련");
});

test("extracts supported exact filename dates and removes the full date from the analysis title", () => {
  const analysis = analyzeFilenameInventory([
    item("인수인계/훈련/20260726_안전한국훈련_실시.hwp"),
    item("인수인계/점검/안전점검_2026-7-6_결과.hwp"),
    item("인수인계/점검/2026_07_03_시설점검.hwp"),
    item("인수인계/회의/2026. 7. 5. 재난회의.hwp"),
    item("인수인계/교육/2026년 7월 4일_안전교육.hwp"),
  ]);
  const files = analysis.branches.flatMap((branch) => branch.files);
  const byName = new Map(files.map((file) => [file.name, file]));

  assert.deepEqual(
    byName.get("20260726_안전한국훈련_실시.hwp").dateCandidates,
    [
      {
        date: "2026-07-26",
        raw: "20260726",
        source: "filename",
        contextHint: "execution",
        confidence: "high",
      },
    ],
  );
  assert.equal(
    byName.get("20260726_안전한국훈련_실시.hwp").analysisTitle,
    "안전한국훈련 실시",
  );
  assert.equal(
    byName.get("안전점검_2026-7-6_결과.hwp").dateCandidates[0].date,
    "2026-07-06",
  );
  assert.equal(
    byName.get("2026_07_03_시설점검.hwp").dateCandidates[0].date,
    "2026-07-03",
  );
  assert.equal(
    byName.get("2026. 7. 5. 재난회의.hwp").dateCandidates[0].date,
    "2026-07-05",
  );
  assert.equal(
    byName.get("2026년 7월 4일_안전교육.hwp").dateCandidates[0].date,
    "2026-07-04",
  );
});

test("rejects invalid calendar dates and explicit document-number or version false positives", () => {
  const analysis = analyzeFilenameInventory([
    item("인수인계/보고/20260229_보고.hwp"),
    item("인수인계/보고/20260431_보고.hwp"),
    item("인수인계/보고/문서번호_2026-07-26호.hwp"),
    item("인수인계/보고/제2026-07-25호_시행문.hwp"),
    item("인수인계/매뉴얼/v2026.7.26_매뉴얼.hwp"),
    item("인수인계/보고/20260726원_지출현황.xlsx"),
    item("인수인계/보고/20240229_보고.hwp"),
  ]);
  const files = analysis.branches.flatMap((branch) => branch.files);
  const candidatesByName = new Map(
    files.map((file) => [file.name, file.dateCandidates]),
  );

  assert.deepEqual(candidatesByName.get("20260229_보고.hwp"), []);
  assert.deepEqual(candidatesByName.get("20260431_보고.hwp"), []);
  assert.deepEqual(
    candidatesByName.get("문서번호_2026-07-26호.hwp"),
    [],
  );
  assert.deepEqual(candidatesByName.get("제2026-07-25호_시행문.hwp"), []);
  assert.deepEqual(candidatesByName.get("v2026.7.26_매뉴얼.hwp"), []);
  assert.deepEqual(candidatesByName.get("20260726원_지출현황.xlsx"), []);
  assert.equal(
    candidatesByName.get("20240229_보고.hwp")[0].date,
    "2024-02-29",
  );
});

test("uses folder dates at medium confidence and prefers a duplicate filename date", () => {
  const analysis = analyzeFilenameInventory([
    item(
      "인수인계/2026-07-26 시행/훈련/2026년 7월 26일_안전한국훈련_결과보고.hwp",
      Date.UTC(2025, 0, 2),
    ),
    item(
      "인수인계/2026-07-25 기준/연락망/비상연락망.xlsx",
      Date.UTC(2030, 0, 2),
    ),
  ]);
  const files = analysis.branches.flatMap((branch) => branch.files);
  const byName = new Map(files.map((file) => [file.name, file]));

  assert.deepEqual(
    byName.get("2026년 7월 26일_안전한국훈련_결과보고.hwp")
      .dateCandidates,
    [
      {
        date: "2026-07-26",
        raw: "2026년 7월 26일",
        source: "filename",
        contextHint: "execution",
        confidence: "high",
      },
    ],
  );
  assert.deepEqual(byName.get("비상연락망.xlsx").dateCandidates, [
    {
      date: "2026-07-25",
      raw: "2026-07-25",
      source: "folder",
      contextHint: "reference",
      confidence: "medium",
    },
  ]);
  assert.equal(byName.get("비상연락망.xlsx").lastModified, Date.UTC(2030, 0, 2));
});

test("does not treat templates or planned completion as completed work", () => {
  const analysis = analyzeFilenameInventory([
    item("재난업무/점검/2026_안전점검_결과보고서_서식.hwp"),
    item("재난업무/정산/2026_재난물품_정산완료예정_계획.hwp"),
  ]);

  const roles = analysis.branches.flatMap((branch) =>
    branch.files.map((file) => file.role),
  );
  assert.ok(roles.includes("TEMPLATE"));
  assert.ok(roles.includes("PLAN"));
  assert.ok(
    analysis.branches.every(
      (branch) => branch.statusCode !== "TERMINAL_SIGNAL_FOUND",
    ),
  );
});

test("marks contact lists as continuous work with freshness unknown", () => {
  const analysis = analyzeFilenameInventory([
    item("재난업무/연락망/2024_비상연락망_수정본.xlsx"),
    item("재난업무/연락망/2025_비상연락망_최종.xlsx"),
  ]);

  assert.equal(analysis.branches.length, 1);
  assert.equal(analysis.branches[0].label, "비상연락망 관리");
  assert.equal(analysis.branches[0].mode, "CONTINUOUS");
  assert.equal(analysis.branches[0].statusCode, "CONTINUOUS_MATERIAL");
});

test("uses a meaningful subfolder when a filename has little information", () => {
  const analysis = analyzeFilenameInventory([
    item("재난업무/재난안전위원회/회의자료.hwp"),
    item("재난업무/재난안전위원회/참석자명단.xlsx"),
  ]);

  assert.equal(analysis.branches.length, 1);
  assert.equal(analysis.branches[0].label, "재난안전위원회");
  assert.equal(analysis.branches[0].sourceCounts["하위 폴더명"], 2);
});

test("exports an explicitly provisional handover report with evidence paths", () => {
  const analysis = analyzeFilenameInventory([
    item("재난업무/훈련/2026_재난대응훈련_계획.hwp"),
  ]);
  const report = buildFilenameHandoverMarkdown(analysis);

  assert.match(report, /폴더명과 파일명만으로 작성한 초벌 자료/);
  assert.match(report, /문서 본문은 확인하지 않았/);
  assert.match(report, /재난대응훈련/);
  assert.match(report, /2026_재난대응훈련_계획\.hwp/);
  assert.match(report, /실제 결재·시행·정산 완료 여부/);
});
