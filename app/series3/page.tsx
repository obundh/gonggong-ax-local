"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  analyzeFilenameInventory,
  buildFilenameHandoverMarkdown,
} from "./filename-analyzer.mjs";
import type {
  FilenameAnalysis,
  HandoverBranch,
  InventoryFile,
} from "./filename-analyzer.mjs";
import styles from "./series3.module.css";

type LocalModel = {
  id: string;
  family: string;
  parameterSize: string;
};

type AiState = "idle" | "connecting" | "generating" | "done" | "error";

const sampleInventory: InventoryFile[] = [
  {
    name: "2025_안전한국훈련_추진계획.hwp",
    relativePath: "재난안전업무/01_재난대응훈련/2025_안전한국훈련_추진계획.hwp",
    size: 482_000,
    lastModified: Date.UTC(2025, 3, 8),
  },
  {
    name: "2025_안전한국훈련_결과보고_최종.hwp",
    relativePath: "재난안전업무/01_재난대응훈련/2025_안전한국훈련_결과보고_최종.hwp",
    size: 1_284_000,
    lastModified: Date.UTC(2025, 5, 2),
  },
  {
    name: "2026_재난대응훈련_시행계획_초안.hwpx",
    relativePath: "재난안전업무/01_재난대응훈련/2026_재난대응훈련_시행계획_초안.hwpx",
    size: 638_000,
    lastModified: Date.UTC(2026, 1, 18),
  },
  {
    name: "2025_비상연락망_수정본.xlsx",
    relativePath: "재난안전업무/02_비상연락망/2025_비상연락망_수정본.xlsx",
    size: 96_000,
    lastModified: Date.UTC(2025, 10, 12),
  },
  {
    name: "2026_비상연락망_최종.xlsx",
    relativePath: "재난안전업무/02_비상연락망/2026_비상연락망_최종.xlsx",
    size: 104_000,
    lastModified: Date.UTC(2026, 0, 22),
  },
  {
    name: "2026_상반기_재난취약시설_안전점검계획.hwp",
    relativePath: "재난안전업무/03_취약시설점검/2026_상반기_재난취약시설_안전점검계획.hwp",
    size: 744_000,
    lastModified: Date.UTC(2026, 2, 3),
  },
  {
    name: "2026_상반기_점검진행현황.xlsx",
    relativePath: "재난안전업무/03_취약시설점검/2026_상반기_점검진행현황.xlsx",
    size: 228_000,
    lastModified: Date.UTC(2026, 3, 21),
  },
  {
    name: "호우대비_재난물품_재고현황.xlsx",
    relativePath: "재난안전업무/04_재난자원/호우대비_재난물품_재고현황.xlsx",
    size: 172_000,
    lastModified: Date.UTC(2026, 4, 6),
  },
  {
    name: "2025_재난물품_구매정산보고.pdf",
    relativePath: "재난안전업무/04_재난자원/2025_재난물품_구매정산보고.pdf",
    size: 2_044_000,
    lastModified: Date.UTC(2025, 11, 19),
  },
  {
    name: "재난상황보고서_작성서식.hwp",
    relativePath: "재난안전업무/05_상황보고/재난상황보고서_작성서식.hwp",
    size: 318_000,
    lastModified: Date.UTC(2025, 7, 1),
  },
  {
    name: "문서1.hwp",
    relativePath: "재난안전업무/기타/문서1.hwp",
    size: 82_000,
    lastModified: Date.UTC(2024, 8, 14),
  },
];

const statusOrder = [
  "CONFLICT",
  "ACTIVE_SIGNAL_FOUND",
  "PLAN_ONLY",
  "TERMINAL_SIGNAL_FOUND",
  "CONTINUOUS_MATERIAL",
  "REFERENCE_ONLY",
  "NO_SIGNAL",
];

function formatBytes(bytes: number) {
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1_000))}KB`;
  if (bytes < 1_000_000_000) return `${(bytes / 1_000_000).toFixed(1)}MB`;
  return `${(bytes / 1_000_000_000).toFixed(1)}GB`;
}

function statusClass(statusCode: string) {
  if (statusCode === "TERMINAL_SIGNAL_FOUND") return styles.statusComplete;
  if (statusCode === "ACTIVE_SIGNAL_FOUND" || statusCode === "PLAN_ONLY") {
    return styles.statusActive;
  }
  if (statusCode === "CONFLICT") return styles.statusConflict;
  if (statusCode === "CONTINUOUS_MATERIAL") return styles.statusContinuous;
  return styles.statusUnknown;
}

function branchSummary(branch: HandoverBranch) {
  const roleSummary = Object.entries(branch.roleCounts)
    .slice(0, 3)
    .map(([role, count]) => `${role} ${count}`)
    .join(" · ");
  return roleSummary || "문서 역할 확인 필요";
}

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob(["\uFEFF", content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function sanitizeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
}

function modelScore(model: LocalModel) {
  const name = `${model.id} ${model.family} ${model.parameterSize}`.toLowerCase();
  let score = name.includes("gemma4") || name.includes("gemma-4") ? 100 : 0;
  if (name.includes("12b")) score += 40;
  else if (name.includes("26b") || name.includes("31b")) score += 30;
  else if (name.includes("e4b")) score += 20;
  else if (name.includes("e2b")) score += 10;
  return score;
}

function aiContext(analysis: FilenameAnalysis) {
  const branches = analysis.branches.map((branch) => ({
    branch: branch.label,
    work_mode_hint: branch.modeLabel,
    status_signal: branch.statusLabel,
    periods: branch.periods,
    document_roles: branch.roleCounts,
    filenames: branch.files.map((file) => file.relativePath),
  }));
  const serialized = JSON.stringify(
    {
      root_folder: analysis.rootName,
      warning: "문서 본문 미확인. 폴더명과 파일명만 제공됨.",
      branches,
    },
    null,
    2,
  );
  return serialized.length <= 60_000
    ? serialized
    : `${serialized.slice(0, 60_000)}\n[파일명이 많아 이후 목록은 생략됨]`;
}

function stripThinking(value: string) {
  return value.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

export default function SeriesThreePage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [analysis, setAnalysis] = useState<FilenameAnalysis | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [aiState, setAiState] = useState<AiState>("idle");
  const [aiDraft, setAiDraft] = useState("");
  const [aiError, setAiError] = useState("");
  const [activeModel, setActiveModel] = useState<LocalModel | null>(null);

  useEffect(() => {
    inputRef.current?.setAttribute("webkitdirectory", "");
    inputRef.current?.setAttribute("directory", "");
  }, []);

  const selectedBranch = useMemo(() => {
    if (!analysis) return null;
    return (
      analysis.branches.find((branch) => branch.id === selectedBranchId) ??
      analysis.branches[0] ??
      null
    );
  }, [analysis, selectedBranchId]);

  const applyInventory = (inventory: InventoryFile[]) => {
    const next = analyzeFilenameInventory(inventory);
    setAnalysis(next);
    setSelectedBranchId(next.branches[0]?.id ?? "");
    setAiDraft("");
    setAiError("");
    setAiState("idle");
    setActiveModel(null);
  };

  const handleFolder = (files: FileList | null) => {
    if (!files?.length) return;
    const inventory = Array.from(files).map((file) => {
      const selected = file as File & { webkitRelativePath?: string };
      return {
        name: file.name,
        relativePath: selected.webkitRelativePath || file.name,
        size: file.size,
        lastModified: file.lastModified,
      };
    });
    applyInventory(inventory);
    if (inputRef.current) inputRef.current.value = "";
  };

  const reset = () => {
    setAnalysis(null);
    setSelectedBranchId("");
    setAiDraft("");
    setAiError("");
    setAiState("idle");
    setActiveModel(null);
  };

  const downloadMarkdown = () => {
    if (!analysis) return;
    const report = buildFilenameHandoverMarkdown(analysis, aiDraft);
    downloadText(
      `${sanitizeFilename(analysis.rootName)}_1차_인수인계.md`,
      report,
      "text/markdown;charset=utf-8",
    );
  };

  const downloadJson = () => {
    if (!analysis) return;
    downloadText(
      `${sanitizeFilename(analysis.rootName)}_파일명분석.json`,
      JSON.stringify({ ...analysis, aiDraft: aiDraft || undefined }, null, 2),
      "application/json;charset=utf-8",
    );
  };

  const generateWithLocalAi = async () => {
    if (!analysis || aiState === "connecting" || aiState === "generating") return;
    setAiState("connecting");
    setAiError("");

    try {
      const tagsResponse = await fetch("http://127.0.0.1:11434/api/tags", {
        signal: AbortSignal.timeout(4_000),
      });
      if (!tagsResponse.ok) {
        throw new Error(`Ollama 모델 목록 요청 실패 (${tagsResponse.status})`);
      }
      const tags = (await tagsResponse.json()) as {
        models?: Array<{
          name?: string;
          model?: string;
          details?: { family?: string; parameter_size?: string };
        }>;
      };
      const models = (tags.models ?? [])
        .map((model) => ({
          id: model.name || model.model || "",
          family: model.details?.family ?? "",
          parameterSize: model.details?.parameter_size ?? "",
        }))
        .filter((model) => model.id)
        .sort((left, right) => modelScore(right) - modelScore(left));
      if (models.length === 0) {
        throw new Error("Ollama에 설치된 모델이 없습니다.");
      }

      const model = models[0];
      setActiveModel(model);
      setAiState("generating");

      const response = await fetch("http://127.0.0.1:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: model.id,
          stream: false,
          think: false,
          options: {
            temperature: 0.2,
            num_ctx: 16_384,
          },
          messages: [
            {
              role: "system",
              content:
                "당신은 공공기관 인수인계를 돕는 로컬 AI입니다. 제공된 폴더명과 파일명 외에는 어떤 사실도 가정하지 마세요. 완료나 진행을 확정하지 말고 반드시 '단서', '추정', '확인 필요'로 표현하세요. 문서 본문을 읽은 것처럼 말하지 마세요.",
            },
            {
              role: "user",
              content: `아래 파일명 분석 결과만 이용해 후임자가 업무 구조를 빠르게 파악할 수 있는 1차 인수인계 초안을 한국어 Markdown으로 작성하세요.

구성:
1. 담당 업무 개요
2. 업무 가지별 역할과 발견된 기간
3. 완료·진행·상시관리 단서
4. 후임자가 먼저 확인할 사항
5. 파일명 분석의 한계

관련 파일명을 각 판단의 근거로 짧게 제시하세요.

${aiContext(analysis)}`,
            },
          ],
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: { content?: string };
      };
      if (!response.ok || payload.error) {
        throw new Error(payload.error || `Ollama 분석 요청 실패 (${response.status})`);
      }
      const draft = stripThinking(payload.message?.content ?? "");
      if (!draft) throw new Error("로컬 모델이 빈 응답을 반환했습니다.");

      setAiDraft(draft);
      setAiState("done");
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      const browserHint =
        window.location.protocol === "https:"
          ? " 배포 화면에서 차단되면 이 프로젝트를 localhost로 실행하거나 Ollama의 허용 출처 설정을 확인하세요."
          : " Ollama가 실행 중인지 확인하세요.";
      setAiError(`${message}.${browserHint}`);
      setAiState("error");
    }
  };

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>
            <strong>업무이어봄</strong>
            <small>공공 AX 로컬 시리즈 3</small>
          </span>
        </div>
        <nav className={styles.nav} aria-label="시리즈 이동">
          <a href="/">시리즈 1</a>
          <a href="/series2">시리즈 2</a>
          <span>시리즈 3</span>
        </nav>
        <div className={styles.localBadge}>
          <span />
          외부 전송 없음
        </div>
      </header>

      <section className={styles.stageBar} aria-label="분석 단계">
        <div className={styles.stageActive}>
          <b>1</b>
          <span>
            <strong>파일명으로 초벌 지도</strong>
            <small>{analysis ? "분석 완료" : "현재 단계"}</small>
          </span>
        </div>
        <i aria-hidden="true" />
        <div className={styles.stageNext}>
          <b>2</b>
          <span>
            <strong>본문 파싱 후 재분류</strong>
            <small>다음 MVP</small>
          </span>
        </div>
      </section>
      <input
        ref={inputRef}
        className={styles.visuallyHidden}
        type="file"
        multiple
        onChange={(event) => handleFolder(event.target.files)}
        aria-label="분석할 인수인계 폴더 선택"
      />

      {!analysis ? (
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>인수인계의 첫 10분</p>
            <h1>
              폴더와 파일명만으로
              <br />
              업무의 가지를 먼저 펼칩니다.
            </h1>
            <p className={styles.heroDescription}>
              문서 본문을 열기 전에 담당 업무, 반복 주기, 완료·진행 단서를
              초벌로 정리합니다. 결과는 모두 추정으로 표시하고 근거 파일명을
              함께 남깁니다.
            </p>

            <div className={styles.heroActions}>
              <button
                className={styles.primaryButton}
                type="button"
                onClick={() => inputRef.current?.click()}
              >
                <span aria-hidden="true">＋</span>
                인수인계 폴더 선택
              </button>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => applyInventory(sampleInventory)}
              >
                재난업무 예시로 체험
              </button>
            </div>

            <div className={styles.privacyLine}>
              <span aria-hidden="true">✓</span>
              파일 내용은 읽지 않습니다
              <i />
              원본을 변경하지 않습니다
              <i />
              서버로 업로드하지 않습니다
            </div>
          </div>

          <div className={styles.previewCard} aria-label="예상 분석 결과 미리보기">
            <div className={styles.previewTop}>
              <span>
                <b />
                <b />
                <b />
              </span>
              <small>재난안전업무 · 1차 지도</small>
              <em>파일명 기준</em>
            </div>
            <div className={styles.previewDomain}>
              <span>재</span>
              <div>
                <small>담당 대분류</small>
                <strong>재난 관련 업무</strong>
              </div>
              <b>5개 가지</b>
            </div>
            <div className={styles.previewTree}>
              <div>
                <span className={styles.treeDotGreen} />
                <p>
                  <strong>재난대응훈련</strong>
                  <small>계획 2 · 결과 1</small>
                </p>
                <em>완료 단서</em>
              </div>
              <div>
                <span className={styles.treeDotBlue} />
                <p>
                  <strong>비상연락망 관리</strong>
                  <small>2025 · 2026</small>
                </p>
                <em>상시관리</em>
              </div>
              <div>
                <span className={styles.treeDotOrange} />
                <p>
                  <strong>취약시설 점검</strong>
                  <small>상반기 계획 · 진행현황</small>
                </p>
                <em>진행 단서</em>
              </div>
              <div>
                <span className={styles.treeDotGray} />
                <p>
                  <strong>기타·분류 필요</strong>
                  <small>문서1.hwp</small>
                </p>
                <em>확인 필요</em>
              </div>
            </div>
            <div className={styles.previewFooter}>
              <span>본문 미확인</span>
              <p>후임자가 먼저 확인할 파일을 찾았습니다.</p>
            </div>
          </div>
        </section>
      ) : (
        <section className={styles.workspace}>
          <div className={styles.workspaceHeading}>
            <div>
              <p className={styles.kicker}>1차 인수인계 지도</p>
              <h1>{analysis.rootName}</h1>
              <p>
                폴더명과 파일명만 분석했습니다. 상태 표시는 업무 확정이 아니라
                발견한 문서명의 단서입니다.
              </p>
            </div>
            <div className={styles.workspaceActions}>
              <button type="button" onClick={() => inputRef.current?.click()}>
                다른 폴더
              </button>
              <button type="button" onClick={downloadJson}>
                분석 JSON
              </button>
              <button
                className={styles.downloadButton}
                type="button"
                onClick={downloadMarkdown}
              >
                인수인계 초안 받기
              </button>
            </div>
          </div>

          <div className={styles.stats}>
            <article>
              <small>파일</small>
              <strong>{analysis.fileCount}</strong>
              <span>{formatBytes(analysis.totalSize)}</span>
            </article>
            <article>
              <small>파일이 있는 폴더</small>
              <strong>{analysis.folderCount}</strong>
              <span>빈 폴더 제외</span>
            </article>
            <article>
              <small>업무 가지 후보</small>
              <strong>{analysis.branches.length}</strong>
              <span>본문 미확인</span>
            </article>
            <article>
              <small>분류 필요 파일</small>
              <strong>{analysis.unclassifiedCount}</strong>
              <span>후임자 확인</span>
            </article>
          </div>

          <div className={styles.analysisGrid}>
            <aside className={styles.branchPanel}>
              <div className={styles.panelHeading}>
                <span>
                  <small>업무 구조</small>
                  <strong>발견한 업무 가지</strong>
                </span>
                <b>{analysis.branches.length}</b>
              </div>
              <div className={styles.branchList}>
                {analysis.branches.map((branch) => (
                  <button
                    type="button"
                    key={branch.id}
                    className={
                      selectedBranch?.id === branch.id ? styles.branchSelected : ""
                    }
                    onClick={() => setSelectedBranchId(branch.id)}
                  >
                    <span className={statusClass(branch.statusCode)} />
                    <span>
                      <strong>{branch.label}</strong>
                      <small>{branchSummary(branch)}</small>
                    </span>
                    <b>{branch.fileCount}</b>
                  </button>
                ))}
              </div>
              <div className={styles.branchLegend}>
                <span>
                  <i className={styles.statusComplete} /> 완료 단서
                </span>
                <span>
                  <i className={styles.statusActive} /> 진행·계획
                </span>
                <span>
                  <i className={styles.statusContinuous} /> 상시관리
                </span>
                <span>
                  <i className={styles.statusUnknown} /> 미확인
                </span>
              </div>
            </aside>

            {selectedBranch && (
              <article className={styles.detailPanel}>
                <div className={styles.detailHeader}>
                  <div>
                    <span className={styles.estimateTag}>파일명 기준 추정</span>
                    <h2>{selectedBranch.label}</h2>
                    <p>{selectedBranch.modeLabel}</p>
                  </div>
                  <span
                    className={`${styles.statusPill} ${statusClass(
                      selectedBranch.statusCode,
                    )}`}
                  >
                    {selectedBranch.statusLabel}
                  </span>
                </div>

                <div className={styles.evidenceBox}>
                  <span aria-hidden="true">!</span>
                  <div>
                    <strong>{selectedBranch.statusEvidence}</strong>
                    <p>{selectedBranch.caution}</p>
                  </div>
                </div>

                <div className={styles.detailFacts}>
                  <div>
                    <small>발견 기간</small>
                    <strong>
                      {selectedBranch.periods.length
                        ? selectedBranch.periods.join(" · ")
                        : "기간 미상"}
                    </strong>
                  </div>
                  <div>
                    <small>최근 수정일 후보</small>
                    <strong>{selectedBranch.latestLabel}</strong>
                  </div>
                  <div>
                    <small>분류 신뢰도</small>
                    <strong>{selectedBranch.classificationConfidence}</strong>
                  </div>
                </div>

                <section className={styles.roleSection}>
                  <div className={styles.sectionTitle}>
                    <span>
                      <small>문서 흐름 단서</small>
                      <strong>파일명에서 발견한 역할</strong>
                    </span>
                  </div>
                  <div className={styles.roleChips}>
                    {Object.entries(selectedBranch.roleCounts)
                      .sort((left, right) => right[1] - left[1])
                      .map(([role, count]) => (
                        <span key={role}>
                          {role}
                          <b>{count}</b>
                        </span>
                      ))}
                  </div>
                </section>

                <section className={styles.fileSection}>
                  <div className={styles.sectionTitle}>
                    <span>
                      <small>판단 근거</small>
                      <strong>관련 파일명</strong>
                    </span>
                    <b>{selectedBranch.fileCount}개</b>
                  </div>
                  <div className={styles.fileList}>
                    {selectedBranch.files.map((file) => (
                      <div className={styles.fileRow} key={file.relativePath}>
                        <span className={styles.fileType}>{file.extension}</span>
                        <span>
                          <strong>{file.name}</strong>
                          <small>{file.relativePath}</small>
                        </span>
                        <span>
                          <b>{file.roleLabel}</b>
                          <small>
                            {file.periods.length
                              ? file.periods.join(" · ")
                              : "기간 미상"}
                          </small>
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              </article>
            )}

            <aside className={styles.reviewPanel}>
              <div className={styles.reviewHeader}>
                <small>후임자 검토</small>
                <strong>먼저 확인할 것</strong>
              </div>
              <ol>
                <li>
                  결과·정산 파일이 실제 결재와 시행 완료를 뜻하는지 확인
                </li>
                <li>진행·보완 자료의 마지막 조치와 다음 기한 확인</li>
                <li>연락망·대장·현황 자료가 현재도 유효한지 확인</li>
                <li>폴더 밖 전자결재·메일·업무시스템 자료 확인</li>
              </ol>

              <div className={styles.aiCard}>
                <div className={styles.aiTitle}>
                  <span>AI</span>
                  <div>
                    <strong>로컬 Gemma로 초안 정리</strong>
                    <small>선택 기능 · 파일명만 전달</small>
                  </div>
                </div>
                <p>
                  이 PC의 Ollama 모델을 찾아 현재 업무 지도를 인수인계 문장으로
                  정리합니다. 기본 분석은 모델 없이도 유지됩니다.
                </p>
                <button
                  type="button"
                  onClick={generateWithLocalAi}
                  disabled={aiState === "connecting" || aiState === "generating"}
                >
                  {aiState === "connecting" && "로컬 모델 찾는 중…"}
                  {aiState === "generating" && "인수인계 초안 작성 중…"}
                  {(aiState === "idle" || aiState === "error") &&
                    "로컬 AI로 초안 만들기"}
                  {aiState === "done" && "로컬 AI로 다시 작성"}
                </button>
                {activeModel && (
                  <span className={styles.modelUsed}>
                    사용 모델: {activeModel.id}
                  </span>
                )}
                {aiError && (
                  <p className={styles.aiError} role="alert">
                    {aiError}
                  </p>
                )}
              </div>

              <button className={styles.resetButton} type="button" onClick={reset}>
                분석 결과 지우기
              </button>
            </aside>
          </div>

          {aiDraft && (
            <section className={styles.aiDraft}>
              <div>
                <span className={styles.estimateTag}>로컬 AI · 파일명 기준</span>
                <h2>인수인계 초안</h2>
                <p>
                  문서 본문을 읽지 않은 초안입니다. 내려받기 전에 담당자가
                  사실관계를 확인해야 합니다.
                </p>
              </div>
              <pre>{aiDraft}</pre>
            </section>
          )}

          <div className={styles.limitations}>
            <strong>이 분석에서 하지 않은 것</strong>
            <div>
              {analysis.limitations.map((limitation) => (
                <span key={limitation}>— {limitation}</span>
              ))}
            </div>
          </div>
        </section>
      )}

      <footer className={styles.footer}>
        <span>공공 AX 로컬 시리즈 3 · 업무이어봄 MVP</span>
        <p>
          선택한 파일의 내용은 읽지 않으며, 파일명 분석 결과는 이 브라우저
          메모리에만 머뭅니다.
        </p>
      </footer>
    </main>
  );
}
