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
