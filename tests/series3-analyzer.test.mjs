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
    byName.get("20260726_안전한국훈련_실시.hwp").statusPeriod,
    "2026",
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

test("ignores structural plan and result folders when choosing a work branch", () => {
  const analysis = analyzeFilenameInventory([
    item("교통업무/특별교통대책/계획/2026_특별교통대책_추진계획.hwp"),
    item("교통업무/특별교통대책/결과/2026_특별교통대책_결과보고.hwp"),
  ]);

  assert.equal(analysis.branches.length, 1);
  assert.equal(analysis.branches[0].label, "특별교통대책");
  assert.equal(analysis.branches[0].statusCode, "TERMINAL_SIGNAL_FOUND");
  assert.equal(analysis.branches[0].focusPeriod, "2026");
});

test("uses the latest identified work cycle instead of an older completion", () => {
  const analysis = analyzeFilenameInventory([
    item("재난업무/안전한국훈련/2025_안전한국훈련_결과보고.hwp"),
    item("재난업무/안전한국훈련/2026_안전한국훈련_추진계획.hwp"),
  ]);
  const branch = analysis.branches[0];

  assert.equal(branch.focusPeriod, "2026");
  assert.equal(branch.statusCode, "PLAN_ONLY");
  assert.match(branch.statusEvidence, /2025에는 마무리 단서/);
  assert.equal(
    branch.historicalStatuses.find((status) => status.period === "2025")?.code,
    "TERMINAL_SIGNAL_FOUND",
  );
});

test("prefers an explicit filename period over a conflicting folder year", () => {
  const analysis = analyzeFilenameInventory([
    item("재난업무/2026/안전한국훈련/2025_안전한국훈련_결과보고.hwp"),
  ]);
  const branch = analysis.branches[0];

  assert.equal(branch.files[0].statusPeriod, "2025");
  assert.equal(branch.focusPeriod, "2025");
});

test("separates document role from lifecycle stage", () => {
  const analysis = analyzeFilenameInventory([
    item("재난업무/시설점검/2026_취약시설점검결과.hwp"),
    item("재난업무/회의/2026_재난대책회의결과.hwp"),
  ]);
  const files = analysis.branches.flatMap((branch) => branch.files);
  const inspection = files.find((file) => file.name.includes("시설점검"));
  const meeting = files.find((file) => file.name.includes("회의결과"));

  assert.equal(inspection.role, "INSPECTION");
  assert.equal(inspection.lifecycleStage, "terminal");
  assert.equal(meeting.role, "MEETING");
  assert.notEqual(meeting.lifecycleStage, "terminal");
});

test("does not let a negative result filename become a completion signal", () => {
  const analysis = analyzeFilenameInventory([
    item("재난업무/복구지원/2026_조치결과_미완료목록.xlsx"),
  ]);
  const branch = analysis.branches[0];

  assert.notEqual(branch.statusCode, "TERMINAL_SIGNAL_FOUND");
  assert.ok(
    branch.files[0].lifecycleStage === "active" ||
      branch.files[0].lifecycleStage === "conflict",
  );
});

test("treats draft and review-looking result reports as active, not complete", () => {
  const analysis = analyzeFilenameInventory([
    item("사업업무/지역사업/2026_지역사업_결과보고_초안.hwp"),
    item("사업업무/지역사업/2026_지역사업_결과보고_검토본.hwp"),
    item("사업업무/지역사업/2026_지역사업_결과보고_최종(안).hwp"),
  ]);
  const branch = analysis.branches[0];

  assert.equal(branch.statusCode, "ACTIVE_SIGNAL_FOUND");
  assert.ok(branch.files.every((file) => file.lifecycleStage !== "terminal"));
});

test("treats a plan review opinion as active review work", () => {
  const analysis = analyzeFilenameInventory([
    item("사업업무/지역사업/2026_지역사업계획_검토의견.hwp"),
  ]);

  assert.equal(analysis.branches[0].files[0].lifecycleStage, "active");
  assert.equal(analysis.branches[0].statusCode, "ACTIVE_SIGNAL_FOUND");
});

test("uses a compact exact date as current-cycle completion evidence", () => {
  const analysis = analyzeFilenameInventory([
    item("재난업무/안전한국훈련/2026_안전한국훈련_추진계획.hwp"),
    item("재난업무/안전한국훈련/20260726_안전한국훈련_결과보고.hwp"),
  ]);
  const branch = analysis.branches[0];

  assert.equal(branch.focusPeriod, "2026");
  assert.equal(branch.statusCode, "TERMINAL_SIGNAL_FOUND");
});

test("does not merge recurring records that have different explicit dates", () => {
  const analysis = analyzeFilenameInventory([
    item("재난업무/시설점검/2026-05-01_시설점검결과.hwp"),
    item("재난업무/시설점검/2026-06-01_시설점검결과.hwp"),
  ]);
  const branch = analysis.branches[0];

  assert.equal(branch.evidenceFileCount, 2);
  assert.equal(branch.duplicateCount, 0);
});

test("prefers the filename and nearest folder over an unrelated parent work name", () => {
  const analysis = analyzeFilenameInventory([
    item(
      "업무/안전한국훈련/취약시설점검/2026_시설안전점검_결과보고.hwp",
    ),
  ]);

  assert.equal(analysis.branches[0].label, "취약시설 점검");
});

test("ignores original and copy folders as branch names", () => {
  const analysis = analyzeFilenameInventory([
    item("업무/지역사업/원본/2026_지역사업_결과보고_최종.hwp"),
    item("업무/지역사업/사본/2026_지역사업_결과보고_사본.hwp"),
  ]);

  assert.equal(analysis.branches.length, 1);
  assert.equal(analysis.branches[0].label, "지역사업");
  assert.equal(analysis.branches[0].duplicateCount, 1);
});

test("counts version copies once for status evidence and preserves every file", () => {
  const analysis = analyzeFilenameInventory([
    item("재난업무/안전한국훈련/2026_안전한국훈련_결과보고_최종.hwp"),
    item("재난업무/안전한국훈련/2026_안전한국훈련_결과보고_사본.hwp"),
    item("재난업무/안전한국훈련/2026_안전한국훈련_결과보고_백업.hwp"),
  ]);
  const branch = analysis.branches[0];

  assert.equal(branch.fileCount, 3);
  assert.equal(branch.evidenceFileCount, 1);
  assert.equal(branch.duplicateCount, 2);
  assert.equal(branch.statusBasisFileCount, 1);
  assert.equal(
    branch.files.filter((file) => file.evidenceRepresentative).length,
    1,
  );
});

test("flags multiple final-looking files without declaring the real final copy", () => {
  const analysis = analyzeFilenameInventory([
    item("재난업무/안전한국훈련/2026_안전한국훈련_결과보고_최종.hwp"),
    item("재난업무/안전한국훈련/2026_안전한국훈련_결과보고_진짜최종.hwp"),
    item("재난업무/안전한국훈련/2026_안전한국훈련_결과보고_최종2.hwp"),
  ]);
  const branch = analysis.branches[0];

  assert.equal(branch.multipleFinalGroups, 1);
  assert.match(branch.versionCaution, /실제 최종본 확인/);
  assert.notEqual(branch.statusConfidence, "높음");
  assert.equal(analysis.reviewRequiredCount, 3);
});

test("keeps work rounds while removing actual revision markers", () => {
  const analysis = analyzeFilenameInventory([
    item("재난업무/훈련/2026_1차_재난훈련_결과보고.hwp"),
    item("재난업무/훈련/2026_재난훈련_2차수정_결과보고.hwp"),
  ]);
  const files = analysis.branches.flatMap((branch) => branch.files);
  const round = files.find((file) => file.name.includes("1차"));
  const revision = files.find((file) => file.name.includes("2차수정"));

  assert.match(round.analysisTitle, /1차/);
  assert.deepEqual(round.versionTags, []);
  assert.ok(revision.versionTags.some((tag) => tag.includes("2차수정")));
});

test("does not classify a generic progress status as continuous work", () => {
  const analysis = analyzeFilenameInventory([
    item("사업업무/2026_지역사업_진행현황.xlsx"),
  ]);

  assert.notEqual(analysis.branches[0].mode, "CONTINUOUS");
  assert.equal(analysis.branches[0].statusCode, "ACTIVE_SIGNAL_FOUND");
});

test("produces explicit review and confidence metrics for the lightweight engine", () => {
  const analysis = analyzeFilenameInventory([
    item("업무/문서1.hwp"),
    item("업무/안전한국훈련/2026_안전한국훈련_추진계획.hwp"),
  ]);

  assert.equal(analysis.version, 2);
  assert.equal(analysis.engine.id, "weighted-filename-v2");
  assert.ok(analysis.reviewRequiredCount >= 1);
  assert.equal(
    Object.values(analysis.branchConfidenceCounts).reduce(
      (sum, count) => sum + count,
      0,
    ),
    analysis.branches.length,
  );
});

test("keeps branch identifiers and statuses stable when input order changes", () => {
  const inventory = [
    item("재난업무/안전한국훈련/2025_안전한국훈련_결과보고.hwp"),
    item("재난업무/안전한국훈련/2026_안전한국훈련_추진계획.hwp"),
    item("재난업무/연락망/2026_비상연락망_최종.xlsx"),
  ];
  const forward = analyzeFilenameInventory(inventory).branches.map((branch) => ({
    id: branch.id,
    status: branch.statusCode,
  }));
  const reversed = analyzeFilenameInventory([...inventory].reverse()).branches.map(
    (branch) => ({
      id: branch.id,
      status: branch.statusCode,
    }),
  );

  assert.deepEqual(forward, reversed);
});

test("uses a stable grouping key for spacing variants regardless of input order", () => {
  const inventory = [
    item("업무/재난 안전 위원회/2026_자료1.hwp"),
    item("업무/재난안전위원회/2026_자료2.hwp"),
  ];
  const forward = analyzeFilenameInventory(inventory).branches[0];
  const reversed = analyzeFilenameInventory([...inventory].reverse()).branches[0];

  assert.equal(forward.id, reversed.id);
  assert.equal(forward.label, reversed.label);
});

test("does not raise branch evidence strength by counting copies", () => {
  const analysis = analyzeFilenameInventory([
    item("업무/지역사업/2026_지역사업_결과보고_최종.hwp"),
    item("업무/지역사업/2026_지역사업_결과보고_사본.hwp"),
    item("업무/지역사업/2026_지역사업_결과보고_백업.hwp"),
  ]);
  const branch = analysis.branches[0];

  assert.equal(branch.evidenceFileCount, 1);
  assert.notEqual(branch.classificationConfidence, "높음");
});

test("keeps alternative role scores on the same scale as the primary role", () => {
  const analysis = analyzeFilenameInventory([
    item("재난업무/시설점검/2026_시설점검결과보고.hwp"),
  ]);
  const file = analysis.branches[0].files[0];

  assert.ok(
    file.roleAlternatives.every(
      (alternative) => alternative.score <= file.roleScore,
    ),
  );
});

test("prefers a real final report over a newer final draft copy", () => {
  const analysis = analyzeFilenameInventory([
    item(
      "사업업무/지역사업/2026_지역사업_결과보고_최종.hwp",
      Date.UTC(2026, 0, 1),
    ),
    item(
      "사업업무/지역사업/2026_지역사업_결과보고_최종(안).hwp",
      Date.UTC(2026, 0, 2),
    ),
  ]);
  const branch = analysis.branches[0];

  assert.equal(branch.evidenceFileCount, 1);
  assert.equal(branch.statusCode, "TERMINAL_SIGNAL_FOUND");
  assert.match(
    branch.files.find((file) => file.evidenceRepresentative)?.name ?? "",
    /_최종\.hwp$/u,
  );
  assert.equal(branch.multipleFinalGroups, 0);
});

test("treats final-copy drafts as review work, not completed work", () => {
  const draftOnly = analyzeFilenameInventory([
    item("사업업무/지역사업/2026_지역사업_결과보고_최종본(안).hwp"),
  ]);
  const comparison = analyzeFilenameInventory([
    item(
      "사업업무/지역사업/2026_지역사업_결과보고_최종본.hwp",
      Date.UTC(2026, 0, 1),
    ),
    item(
      "사업업무/지역사업/2026_지역사업_결과보고_최종본(안).hwp",
      Date.UTC(2026, 0, 2),
    ),
  ]);
  const draftFile = draftOnly.branches[0].files[0];
  const branch = comparison.branches[0];

  assert.equal(draftFile.lifecycleStage, "active");
  assert.equal(draftOnly.branches[0].statusCode, "ACTIVE_SIGNAL_FOUND");
  assert.ok(draftOnly.reviewRequiredCount >= 1);
  assert.match(
    branch.files.find((file) => file.evidenceRepresentative)?.name ?? "",
    /_최종본\.hwp$/u,
  );
  assert.equal(branch.multipleFinalGroups, 0);
});

test("ignores archive and draft folder names when deriving a work branch", () => {
  const analysis = analyzeFilenameInventory([
    item("사업업무/지역축제지원/최종본/2026_지역축제지원_결과보고.hwp"),
    item("사업업무/지역축제지원/완료본/2026_지역축제지원_완료보고.hwp"),
    item("사업업무/지역축제지원/제출본/2026_지역축제지원_정산보고.hwp"),
    item("사업업무/지역축제지원/참고자료/2026_지역축제지원_지침.pdf"),
    item("사업업무/지역축제지원/초안/2026_지역축제지원_추진계획.hwp"),
  ]);

  assert.equal(analysis.branches.length, 1);
  assert.equal(analysis.branches[0].label, "지역축제지원");
});
