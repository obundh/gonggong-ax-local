"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import {
  analyzeFilenameInventory,
  buildFilenameHandoverMarkdown,
} from "./filename-analyzer.mjs";
import type {
  AnalyzedFilename,
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
type WorkspaceView = "files" | "handover";

type ExplorerFile = AnalyzedFilename & {
  branchId: string;
  branchLabel: string;
  branchStatusCode: string;
  branchStatusLabel: string;
  classificationConfidence: HandoverBranch["classificationConfidence"];
};

type FolderEntry = {
  path: string;
  name: string;
  depth: number;
  fileCount: number;
};

const sampleInventory: InventoryFile[] = [
  {
    name: "2025_안전한국훈련_추진계획.hwp",
    relativePath: "재난안전업무/01_재난대응훈련/2025_안전한국훈련_추진계획.hwp",
    size: 482_000,
    lastModified: Date.UTC(2025, 3, 8),
  },
  {
    name: "2025_안전한국훈련_결과보고_최종.hwp",
    relativePath:
      "재난안전업무/01_재난대응훈련/2025_안전한국훈련_결과보고_최종.hwp",
    size: 1_284_000,
    lastModified: Date.UTC(2025, 5, 2),
  },
  {
    name: "2026_재난대응훈련_시행계획_초안.hwpx",
    relativePath:
      "재난안전업무/01_재난대응훈련/2026_재난대응훈련_시행계획_초안.hwpx",
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
    relativePath:
      "재난안전업무/03_취약시설점검/2026_상반기_재난취약시설_안전점검계획.hwp",
    size: 744_000,
    lastModified: Date.UTC(2026, 2, 3),
  },
  {
    name: "2026_상반기_점검진행현황.xlsx",
    relativePath:
      "재난안전업무/03_취약시설점검/2026_상반기_점검진행현황.xlsx",
    size: 228_000,
    lastModified: Date.UTC(2026, 3, 21),
  },
  {
    name: "호우대비_재난물품_재고현황.xlsx",
    relativePath:
      "재난안전업무/04_재난자원/호우대비_재난물품_재고현황.xlsx",
    size: 172_000,
    lastModified: Date.UTC(2026, 4, 6),
  },
  {
    name: "2025_재난물품_구매정산보고.pdf",
    relativePath:
      "재난안전업무/04_재난자원/2025_재난물품_구매정산보고.pdf",
    size: 2_044_000,
    lastModified: Date.UTC(2025, 11, 19),
  },
  {
    name: "재난상황보고서_작성서식.hwp",
    relativePath:
      "재난안전업무/05_상황보고/재난상황보고서_작성서식.hwp",
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

function normalizePath(value: string) {
  return value.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
}

function parentPath(value: string) {
  const parts = normalizePath(value).split("/");
  return parts.length > 1 ? parts.slice(0, -1).join("/") : "";
}

function folderPathForFile(file: ExplorerFile, rootName: string) {
  const path = normalizePath(file.relativePath);
  const parts = path.split("/");
  if (parts.length <= 1) return rootName;
  return parts.slice(0, -1).join("/");
}

function formatBytes(bytes: number) {
  if (bytes < 1_000) return `${bytes}B`;
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1_000))}KB`;
  if (bytes < 1_000_000_000) return `${(bytes / 1_000_000).toFixed(1)}MB`;
  return `${(bytes / 1_000_000_000).toFixed(1)}GB`;
}

function formatDate(timestamp: number) {
  if (!timestamp) return "날짜 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(timestamp);
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
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([role, count]) => `${role} ${count}`)
    .join(" · ");
  return roleSummary || "역할 확인 필요";
}

function fileTypeLabel(extension: string) {
  const normalized = extension.toLowerCase();
  const labels: Record<string, string> = {
    hwp: "한글 문서",
    hwpx: "한글 표준 문서",
    doc: "Word 문서",
    docx: "Word 문서",
    xls: "Excel 문서",
    xlsx: "Excel 문서",
    ppt: "PowerPoint 문서",
    pptx: "PowerPoint 문서",
    pdf: "PDF 문서",
    txt: "텍스트 문서",
    zip: "압축 파일",
  };
  return labels[normalized] ?? `${normalized.toUpperCase() || "일반"} 파일`;
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
  const [selectedFolderPath, setSelectedFolderPath] = useState("");
  const [selectedFilePath, setSelectedFilePath] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("files");
  const [query, setQuery] = useState("");
  const [aiState, setAiState] = useState<AiState>("idle");
  const [aiDraft, setAiDraft] = useState("");
  const [aiError, setAiError] = useState("");
  const [activeModel, setActiveModel] = useState<LocalModel | null>(null);

  useEffect(() => {
    inputRef.current?.setAttribute("webkitdirectory", "");
    inputRef.current?.setAttribute("directory", "");
  }, []);

  const allFiles = useMemo<ExplorerFile[]>(() => {
    if (!analysis) return [];
    const seen = new Set<string>();
    return analysis.branches.flatMap((branch) =>
      branch.files
        .filter((file) => {
          if (seen.has(file.relativePath)) return false;
          seen.add(file.relativePath);
          return true;
        })
        .map((file) => ({
          ...file,
          branchId: branch.id,
          branchLabel: branch.label,
          branchStatusCode: branch.statusCode,
          branchStatusLabel: branch.statusLabel,
          classificationConfidence: branch.classificationConfidence,
        })),
    );
  }, [analysis]);

  const folderEntries = useMemo<FolderEntry[]>(() => {
    if (!analysis) return [];
    const counts = new Map<string, number>();
    counts.set(analysis.rootName, 0);

    allFiles.forEach((file) => {
      const folder = folderPathForFile(file, analysis.rootName);
      const parts = normalizePath(folder).split("/").filter(Boolean);
      const normalizedRoot = normalizePath(analysis.rootName);
      if (parts[0] !== normalizedRoot) parts.unshift(normalizedRoot);
      parts.forEach((_, index) => {
        const path = parts.slice(0, index + 1).join("/");
        counts.set(path, (counts.get(path) ?? 0) + 1);
      });
    });

    return Array.from(counts.entries())
      .map(([path, fileCount]) => {
        const parts = path.split("/");
        return {
          path,
          name: parts.at(-1) ?? path,
          depth: Math.max(0, parts.length - 1),
          fileCount,
        };
      })
      .sort((left, right) =>
        left.path.localeCompare(right.path, "ko", { numeric: true }),
      );
  }, [allFiles, analysis]);

  const selectedFolder =
    folderEntries.find((folder) => folder.path === selectedFolderPath) ??
    folderEntries[0] ??
    null;

  const childFolders = useMemo(() => {
    if (!selectedFolder) return [];
    return folderEntries.filter(
      (folder) => parentPath(folder.path) === selectedFolder.path,
    );
  }, [folderEntries, selectedFolder]);

  const visibleFiles = useMemo(() => {
    if (!analysis || !selectedFolder) return [];
    const normalizedQuery = query.trim().toLocaleLowerCase("ko");
    return allFiles
      .filter((file) => {
        const fileFolder = folderPathForFile(file, analysis.rootName);
        if (normalizedQuery) {
          const inCurrentTree =
            fileFolder === selectedFolder.path ||
            fileFolder.startsWith(`${selectedFolder.path}/`);
          const haystack =
            `${file.name} ${file.analysisTitle} ${file.branchLabel}`.toLocaleLowerCase(
              "ko",
            );
          return inCurrentTree && haystack.includes(normalizedQuery);
        }
        return fileFolder === selectedFolder.path;
      })
      .sort((left, right) =>
        left.name.localeCompare(right.name, "ko", { numeric: true }),
      );
  }, [allFiles, analysis, query, selectedFolder]);

  const selectedFile =
    allFiles.find((file) => file.relativePath === selectedFilePath) ?? null;

  const selectedBranch = useMemo(() => {
    if (!analysis) return null;
    return (
      analysis.branches.find((branch) => branch.id === selectedBranchId) ??
      analysis.branches[0] ??
      null
    );
  }, [analysis, selectedBranchId]);

  const breadcrumbs = useMemo(() => {
    if (!selectedFolder) return [];
    const parts = selectedFolder.path.split("/");
    return parts.map((name, index) => ({
      name,
      path: parts.slice(0, index + 1).join("/"),
    }));
  }, [selectedFolder]);

  const applyInventory = (inventory: InventoryFile[]) => {
    const next = analyzeFilenameInventory(inventory);
    setAnalysis(next);
    setSelectedFolderPath(next.rootName);
    setSelectedFilePath(next.branches[0]?.files[0]?.relativePath ?? "");
    setSelectedBranchId(next.branches[0]?.id ?? "");
    setWorkspaceView("files");
    setQuery("");
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
    setSelectedFolderPath("");
    setSelectedFilePath("");
    setSelectedBranchId("");
    setWorkspaceView("files");
    setQuery("");
    setAiDraft("");
    setAiError("");
    setAiState("idle");
    setActiveModel(null);
  };

  const openFolder = (path: string) => {
    setSelectedFolderPath(path);
    setSelectedFilePath("");
    setWorkspaceView("files");
    setQuery("");
  };

  const openBranch = (branch: HandoverBranch) => {
    setSelectedBranchId(branch.id);
    setSelectedFilePath("");
    setWorkspaceView("handover");
  };

  const downloadMarkdown = () => {
    if (!analysis) return;
    downloadText(
      `${sanitizeFilename(analysis.rootName)}_1차_인수인계.md`,
      buildFilenameHandoverMarkdown(analysis, aiDraft),
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
          options: { temperature: 0.2, num_ctx: 16_384 },
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
      setWorkspaceView("handover");
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      const browserHint =
        window.location.protocol === "https:"
          ? " 배포 화면에서 차단되면 localhost 실행 또는 Ollama 허용 출처 설정이 필요합니다."
          : " Ollama가 실행 중인지 확인하세요.";
      setAiError(`${message}.${browserHint}`);
      setAiState("error");
    }
  };

  return (
    <main className={styles.desktop}>
      <section className={styles.explorerWindow}>
        <header className={styles.titleBar}>
          <div className={styles.appTitle}>
            <span className={styles.appIcon} aria-hidden="true">
              AX
            </span>
            <strong>공공 AX 로컬 시리즈 - 인수인계</strong>
          </div>
          <nav className={styles.seriesNav} aria-label="시리즈 이동">
            <Link href="/">시리즈 1</Link>
            <Link href="/series2">시리즈 2</Link>
            <span>인수인계</span>
          </nav>
          <div className={styles.windowButtons} aria-hidden="true">
            <span>—</span>
            <span>□</span>
            <span>×</span>
          </div>
        </header>

        <input
          ref={inputRef}
          className={styles.visuallyHidden}
          type="file"
          multiple
          onChange={(event) => handleFolder(event.target.files)}
          aria-label="분석할 인수인계 폴더 선택"
        />

        <div className={styles.commandBar}>
          <button
            className={styles.primaryCommand}
            type="button"
            onClick={() => inputRef.current?.click()}
          >
            <span aria-hidden="true">＋</span>
            폴더 선택
          </button>
          <button type="button" onClick={() => applyInventory(sampleInventory)}>
            <span aria-hidden="true">▣</span>
            재난업무 예시
          </button>
          <i />
          <button
            type="button"
            className={workspaceView === "files" ? styles.commandSelected : ""}
            onClick={() => setWorkspaceView("files")}
            disabled={!analysis}
          >
            파일 탐색
          </button>
          <button
            type="button"
            className={workspaceView === "handover" ? styles.commandSelected : ""}
            onClick={() => setWorkspaceView("handover")}
            disabled={!analysis}
          >
            인수인계 보기
          </button>
          <div className={styles.commandSpacer} />
          <button type="button" onClick={downloadJson} disabled={!analysis}>
            JSON
          </button>
          <button type="button" onClick={downloadMarkdown} disabled={!analysis}>
            초안 저장
          </button>
          <button
            className={styles.moreButton}
            type="button"
            aria-label="분석 결과 지우기"
            title="분석 결과 지우기"
            onClick={reset}
            disabled={!analysis}
          >
            ···
          </button>
        </div>

        <div className={styles.addressRow}>
          <button
            type="button"
            aria-label="상위 폴더로"
            disabled={!selectedFolder || !parentPath(selectedFolder.path)}
            onClick={() => {
              if (selectedFolder) openFolder(parentPath(selectedFolder.path));
            }}
          >
            ↑
          </button>
          <div className={styles.addressBar}>
            <span className={styles.pcIcon} aria-hidden="true">
              ▣
            </span>
            <span>이 PC</span>
            <b>›</b>
            <span>인수인계</span>
            {breadcrumbs.map((crumb) => (
              <span className={styles.crumb} key={crumb.path}>
                <b>›</b>
                <button type="button" onClick={() => openFolder(crumb.path)}>
                  {crumb.name}
                </button>
              </span>
            ))}
          </div>
          <label className={styles.searchBox}>
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                selectedFolder ? `${selectedFolder.name} 검색` : "파일명 검색"
              }
              disabled={!analysis || workspaceView !== "files"}
            />
          </label>
        </div>

        <div className={styles.safetyStrip}>
          <span>
            <i className={styles.safeDot} />
            기본 분석: 브라우저 안에서 처리
          </span>
          <span>파일 내용은 읽지 않습니다</span>
          <span>원본 변경 없음</span>
          <span>인터넷·기관 외부 전송 없음</span>
          <b>1차 · 파일명 기준</b>
          <em>2차 · 본문 파싱 예정</em>
        </div>

        <div className={styles.explorerBody}>
          <aside className={styles.navigationPane} aria-label="폴더 탐색">
            <div className={styles.navGroup}>
              <strong>홈</strong>
              <button
                type="button"
                className={!analysis ? styles.navSelected : ""}
                onClick={() => {
                  if (analysis) openFolder(analysis.rootName);
                }}
              >
                <span aria-hidden="true">⌂</span>
                인수인계 홈
              </button>
              <button
                type="button"
                className={workspaceView === "handover" ? styles.navSelected : ""}
                disabled={!analysis}
                onClick={() => setWorkspaceView("handover")}
              >
                <span aria-hidden="true">≡</span>
                업무 가지
                {analysis && <b>{analysis.branches.length}</b>}
              </button>
              <button
                type="button"
                disabled={!analysis}
                onClick={() => {
                  if (!analysis) return;
                  setWorkspaceView("handover");
                  const branch = analysis.branches.find(
                    (item) => item.classificationConfidence === "낮음",
                  );
                  if (branch) openBranch(branch);
                }}
              >
                <span aria-hidden="true">?</span>
                분류 필요
                {analysis && <b>{analysis.unclassifiedCount}</b>}
              </button>
            </div>

            <div className={styles.navGroup}>
              <strong>폴더</strong>
              {analysis ? (
                <div className={styles.folderTree}>
                  {folderEntries.map((folder) => (
                    <button
                      type="button"
                      key={folder.path}
                      className={
                        workspaceView === "files" &&
                        selectedFolder?.path === folder.path
                          ? styles.navSelected
                          : ""
                      }
                      style={{ paddingLeft: `${12 + folder.depth * 16}px` }}
                      onClick={() => openFolder(folder.path)}
                      title={folder.path}
                    >
                      <span className={styles.folderGlyph} aria-hidden="true" />
                      <span>{folder.name}</span>
                      <b>{folder.fileCount}</b>
                    </button>
                  ))}
                </div>
              ) : (
                <p className={styles.navEmpty}>폴더를 선택하세요.</p>
              )}
            </div>
          </aside>

          <section className={styles.contentPane}>
            {!analysis ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyFolder} aria-hidden="true">
                  <span />
                </div>
                <h1>인수인계 폴더 선택</h1>
                <p>폴더명과 파일명으로 업무 지도를 만듭니다.</p>
                <div>
                  <button
                    className={styles.emptyPrimary}
                    type="button"
                    onClick={() => inputRef.current?.click()}
                  >
                    폴더 선택
                  </button>
                  <button
                    type="button"
                    onClick={() => applyInventory(sampleInventory)}
                  >
                    재난업무 예시로 체험
                  </button>
                </div>
                <ul>
                  <li>본문 미확인</li>
                  <li>파일명에서 추출한 제목 후보 미리보기</li>
                  <li>원본 파일 변경 없음</li>
                </ul>
              </div>
            ) : workspaceView === "files" ? (
              <>
                <div className={styles.paneHeading}>
                  <div>
                    <span className={styles.folderGlyph} aria-hidden="true" />
                    <h1>{selectedFolder?.name ?? analysis.rootName}</h1>
                  </div>
                  <span>
                    {query
                      ? `검색 결과 ${visibleFiles.length}개`
                      : `폴더 ${childFolders.length}개 · 파일 ${visibleFiles.length}개`}
                  </span>
                </div>
                <div className={styles.tableWrap}>
                  <table className={styles.fileTable}>
                    <thead>
                      <tr>
                        <th>이름</th>
                        <th>파일명에서 추출한 제목 후보</th>
                        <th>문서 역할</th>
                        <th>수정한 날짜</th>
                        <th>크기</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!query &&
                        childFolders.map((folder) => (
                          <tr
                            className={styles.folderRow}
                            key={folder.path}
                            onClick={() => openFolder(folder.path)}
                          >
                            <td>
                              <span className={styles.folderGlyph} />
                              <strong>{folder.name}</strong>
                            </td>
                            <td className={styles.mutedCell}>
                              하위 파일 {folder.fileCount}개
                            </td>
                            <td>파일 폴더</td>
                            <td>—</td>
                            <td>—</td>
                          </tr>
                        ))}
                      {visibleFiles.map((file) => (
                        <tr
                          key={file.relativePath}
                          className={
                            selectedFile?.relativePath === file.relativePath
                              ? styles.fileSelected
                              : ""
                          }
                          onClick={() => {
                            setSelectedFilePath(file.relativePath);
                            setSelectedBranchId(file.branchId);
                          }}
                        >
                          <td>
                            <span
                              className={`${styles.fileGlyph} ${styles[
                                `file${file.extension.toUpperCase()}`
                              ] ?? ""}`}
                              aria-hidden="true"
                            >
                              {file.extension.slice(0, 4)}
                            </span>
                            <span>
                              <strong>{file.name}</strong>
                              <small>{fileTypeLabel(file.extension)}</small>
                            </span>
                          </td>
                          <td>
                            <strong className={styles.parsedTitle}>
                              {file.analysisTitle || "제목 단서 부족"}
                            </strong>
                            <small>파일명 기준</small>
                          </td>
                          <td>
                            <span
                              className={`${styles.statusTag} ${statusClass(
                                file.branchStatusCode,
                              )}`}
                            >
                              {file.roleLabel}
                            </span>
                          </td>
                          <td>{formatDate(file.lastModified)}</td>
                          <td>{formatBytes(file.size)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!childFolders.length && !visibleFiles.length && (
                    <div className={styles.noResults}>
                      {query ? "일치하는 파일이 없습니다." : "표시할 파일이 없습니다."}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className={styles.paneHeading}>
                  <div>
                    <span className={styles.handoverGlyph} aria-hidden="true">
                      ≡
                    </span>
                    <h1>인수인계 보기</h1>
                  </div>
                  <span>업무 가지 {analysis.branches.length}개</span>
                </div>
                <div className={styles.branchTableWrap}>
                  <table className={styles.branchTable}>
                    <thead>
                      <tr>
                        <th>업무 가지</th>
                        <th>상태 단서</th>
                        <th>기간</th>
                        <th>문서 흐름</th>
                        <th>파일</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.branches.map((branch) => (
                        <tr
                          key={branch.id}
                          className={
                            selectedBranch?.id === branch.id
                              ? styles.fileSelected
                              : ""
                          }
                          onClick={() => openBranch(branch)}
                        >
                          <td>
                            <span
                              className={`${styles.branchDot} ${statusClass(
                                branch.statusCode,
                              )}`}
                            />
                            <span>
                              <strong>{branch.label}</strong>
                              <small>{branch.modeLabel}</small>
                            </span>
                          </td>
                          <td>
                            <span
                              className={`${styles.statusTag} ${statusClass(
                                branch.statusCode,
                              )}`}
                            >
                              {branch.statusLabel}
                            </span>
                          </td>
                          <td>
                            {branch.periods.length
                              ? branch.periods.join(" · ")
                              : "기간 미상"}
                          </td>
                          <td>{branchSummary(branch)}</td>
                          <td>{branch.fileCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {aiDraft && (
                  <section className={styles.aiDraft}>
                    <div>
                      <span>로컬 AI 초안</span>
                      {activeModel && <small>{activeModel.id}</small>}
                    </div>
                    <pre>{aiDraft}</pre>
                  </section>
                )}
              </>
            )}
          </section>

          <aside className={styles.previewPane} aria-label="분석 미리보기">
            <div className={styles.previewHeading}>
              <strong>미리 보기</strong>
              <span>본문 미확인</span>
            </div>

            {!analysis ? (
              <div className={styles.previewEmpty}>
                <div className={styles.previewDocument} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </div>
                <strong>추출 제목 미리보기</strong>
                <p>파일을 선택하면 원본 파일명과 제목 후보를 비교합니다.</p>
              </div>
            ) : selectedFile ? (
              <div className={styles.filePreview}>
                <div className={styles.previewFileIcon}>
                  <span>{selectedFile.extension.toUpperCase()}</span>
                </div>
                <h2>{selectedFile.analysisTitle || "제목 단서 부족"}</h2>
                <span className={styles.previewBasis}>파일명에서 추출한 제목 후보</span>

                <div className={styles.parseFlow}>
                  <small>원본 파일명</small>
                  <strong>{selectedFile.name}</strong>
                  <i aria-hidden="true">↓</i>
                  <small>분석용 제목</small>
                  <b>{selectedFile.analysisTitle || "제목 단서 부족"}</b>
                </div>

                <dl className={styles.fileFacts}>
                  <div>
                    <dt>업무 가지</dt>
                    <dd>{selectedFile.branchLabel}</dd>
                  </div>
                  <div>
                    <dt>문서 역할</dt>
                    <dd>{selectedFile.roleLabel}</dd>
                  </div>
                  <div>
                    <dt>발견 기간</dt>
                    <dd>
                      {selectedFile.periods.length
                        ? selectedFile.periods.join(" · ")
                        : "기간 단서 없음"}
                    </dd>
                  </div>
                  <div>
                    <dt>버전 표현</dt>
                    <dd>
                      {selectedFile.versionTags.length
                        ? selectedFile.versionTags.join(" · ")
                        : "표현 없음"}
                    </dd>
                  </div>
                  <div>
                    <dt>분류 근거</dt>
                    <dd>{selectedFile.branchSource}</dd>
                  </div>
                  <div>
                    <dt>분류 신뢰도</dt>
                    <dd>{selectedFile.classificationConfidence}</dd>
                  </div>
                </dl>

                <div className={styles.pathBox}>
                  <small>위치</small>
                  <span>{selectedFile.relativePath}</span>
                </div>
                <div className={styles.previewCaution}>
                  파일 내부 제목이 아닙니다. 파일명만 정리한 후보입니다.
                </div>
              </div>
            ) : selectedBranch && workspaceView === "handover" ? (
              <div className={styles.branchPreview}>
                <span
                  className={`${styles.statusTag} ${statusClass(
                    selectedBranch.statusCode,
                  )}`}
                >
                  {selectedBranch.statusLabel}
                </span>
                <h2>{selectedBranch.label}</h2>
                <p>{selectedBranch.statusEvidence}</p>
                <dl className={styles.fileFacts}>
                  <div>
                    <dt>업무 형태</dt>
                    <dd>{selectedBranch.modeLabel}</dd>
                  </div>
                  <div>
                    <dt>발견 기간</dt>
                    <dd>
                      {selectedBranch.periods.length
                        ? selectedBranch.periods.join(" · ")
                        : "기간 미상"}
                    </dd>
                  </div>
                  <div>
                    <dt>최근 수정일</dt>
                    <dd>{selectedBranch.latestLabel}</dd>
                  </div>
                  <div>
                    <dt>분류 신뢰도</dt>
                    <dd>{selectedBranch.classificationConfidence}</dd>
                  </div>
                </dl>
                <strong className={styles.previewSubheading}>관련 파일</strong>
                <div className={styles.previewFileList}>
                  {selectedBranch.files.map((file) => (
                    <button
                      type="button"
                      key={file.relativePath}
                      onClick={() => setSelectedFilePath(file.relativePath)}
                    >
                      <span>{file.extension}</span>
                      <span>
                        <strong>{file.analysisTitle || "제목 단서 부족"}</strong>
                        <small>{file.name}</small>
                      </span>
                    </button>
                  ))}
                </div>
                <div className={styles.previewCaution}>
                  {selectedBranch.caution}
                </div>
              </div>
            ) : (
              <div className={styles.folderPreview}>
                <div className={styles.largeFolder} aria-hidden="true" />
                <h2>{selectedFolder?.name}</h2>
                <p>하위 파일 {selectedFolder?.fileCount ?? 0}개</p>
                <small>파일을 선택해 추출 제목을 확인하세요.</small>
              </div>
            )}

            {analysis && (
              <section className={styles.aiTool}>
                <div>
                  <span className={styles.aiBadge}>AI</span>
                  <span>
                    <strong>로컬 Gemma 초안</strong>
                    <small>선택 시 파일명만 이 PC의 Ollama로 전달</small>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={generateWithLocalAi}
                  disabled={aiState === "connecting" || aiState === "generating"}
                >
                  {aiState === "connecting" && "모델 확인 중…"}
                  {aiState === "generating" && "초안 작성 중…"}
                  {(aiState === "idle" || aiState === "error") && "초안 만들기"}
                  {aiState === "done" && "다시 만들기"}
                </button>
                {activeModel && <small>사용 모델: {activeModel.id}</small>}
                {aiError && (
                  <p className={styles.aiError} role="alert">
                    {aiError}
                  </p>
                )}
              </section>
            )}
          </aside>
        </div>

        <footer className={styles.statusBar}>
          <span>
            {analysis
              ? `${analysis.fileCount}개 항목 · ${formatBytes(analysis.totalSize)}`
              : "폴더를 선택하면 분석을 시작합니다."}
          </span>
          <span>
            파일명 기준 추정
            <i />
            문서 본문 미확인
          </span>
        </footer>
      </section>
    </main>
  );
}
