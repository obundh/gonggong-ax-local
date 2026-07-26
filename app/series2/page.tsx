"use client";

import {
  DragEvent,
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  createFlowDocument,
  parseDocument,
  ParsedDocument,
} from "./document-parser";
import {
  analyzeParagraphs,
  Finding,
  FindingCategory,
  findingIgnoreKey,
  publicLanguageEntryCount,
  publicLanguageSource,
} from "./rule-engine";
import styles from "./series2.module.css";

const sampleParagraphs = [
  "2026년 공공시설 안내 서비스 개선 가이드",
  "본 가이드는 금번 사업을 통해 주민이 공공시설 정보를 보다 편리하게 확인할 수 있도록 업무 절차를 정리한 문서입니다.",
  "신청자는 금일 오후 6시까지 홈페이지에서 신청할수 있습니다. 접수 결과는 익일 이메일로 안내 됩니다 .",
  "사업 담당자는 관련 법령에 의거하여 필요한 조치를 실시하여 주시기 바랍니다.",
  "시스템 점검으로 인해 서비스 이용이 않됩니다. 자세한 사항은 가이드 스팟을 확인해 주십시오.",
  "추후 확정",
];

const categoryFilters: Array<"전체" | FindingCategory> = [
  "전체",
  "맞춤법",
  "띄어쓰기",
  "공공언어",
  "문장",
  "표기",
];

type HistoryItem = Finding & {
  status: "적용" | "제외";
  chosenReplacement: string | null;
};

const initialSample: ParsedDocument = createFlowDocument({
  name: "공공시설_안내_가이드.hwpx",
  format: "직접 입력",
  paragraphs: sampleParagraphs,
  bytes: new Blob([sampleParagraphs.join("\n")]).size,
});

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function escapeCsv(value: string | number) {
  const stringValue = String(value);
  return /[",\r\n]/.test(stringValue)
    ? `"${stringValue.replaceAll('"', '""')}"`
    : stringValue;
}

function downloadBlob(content: BlobPart, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function baseName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}

function visiblePageNumbers(pageCount: number, currentPage: number) {
  if (pageCount <= 9) return Array.from({ length: pageCount }, (_, index) => index);
  const indexes = new Set([0, pageCount - 1]);
  for (
    let index = Math.max(0, currentPage - 3);
    index <= Math.min(pageCount - 1, currentPage + 3);
    index += 1
  ) {
    indexes.add(index);
  }
  return [...indexes].sort((left, right) => left - right);
}

export default function SeriesTwoPage() {
  const [document, setDocument] = useState<ParsedDocument>(initialSample);
  const [currentPage, setCurrentPage] = useState(0);
  const [ignoredIds, setIgnoredIds] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [filter, setFilter] = useState<"전체" | FindingCategory>("전체");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replacementChoices, setReplacementChoices] = useState<
    Record<string, string>
  >({});
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(sampleParagraphs.join("\n"));
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [notice, setNotice] = useState(
    "예시 문서를 검사했습니다. 실제 문서를 불러오면 이 화면에서 바로 바뀝니다.",
  );
  const [baselineCount, setBaselineCount] = useState(
    () => analyzeParagraphs(sampleParagraphs).length,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const findings = useMemo(
    () => analyzeParagraphs(document.paragraphs, ignoredIds),
    [document.paragraphs, ignoredIds],
  );

  const currentPageFindings = useMemo(
    () =>
      findings.filter(
        (finding) =>
          (document.paragraphPages[finding.paragraphIndex] ?? 0) === currentPage,
      ),
    [currentPage, document.paragraphPages, findings],
  );

  const visibleFindings = useMemo(
    () =>
      filter === "전체"
        ? currentPageFindings
        : currentPageFindings.filter((finding) => finding.category === filter),
    [currentPageFindings, filter],
  );

  const selectedFinding =
    visibleFindings.find((finding) => finding.id === selectedId) ?? null;

  const counts = useMemo(() => {
    const result: Record<"전체" | FindingCategory, number> = {
      전체: currentPageFindings.length,
      맞춤법: 0,
      띄어쓰기: 0,
      공공언어: 0,
      문장: 0,
      표기: 0,
    };
    for (const finding of currentPageFindings) result[finding.category] += 1;
    return result;
  }, [currentPageFindings]);

  const findingsByPage = useMemo(() => {
    const result = Array.from({ length: document.pages.length }, () => 0);
    for (const finding of findings) {
      const pageIndex = document.paragraphPages[finding.paragraphIndex] ?? 0;
      if (pageIndex >= 0 && pageIndex < result.length) result[pageIndex] += 1;
    }
    return result;
  }, [document.pages.length, document.paragraphPages, findings]);

  const currentPageParagraphIndexes =
    document.pages[currentPage]?.paragraphIndexes ?? [];
  const pageNumbers = visiblePageNumbers(document.pages.length, currentPage);
  const currentSvg = useMemo(() => {
    if (document.previewKind !== "original-svg" || !document.renderPage) return null;
    try {
      return document.renderPage(currentPage);
    } catch {
      return null;
    }
  }, [currentPage, document]);

  const safeCount = findings.filter(
    (finding) => finding.safe && finding.replacement,
  ).length;
  const processedCount = history.length;
  const progress =
    baselineCount === 0
      ? 100
      : Math.min(100, Math.round((processedCount / baselineCount) * 100));
  const characterCount = document.paragraphs.join("\n").length;
  const disposeDocument = document.dispose;

  useEffect(
    () => () => {
      disposeDocument?.();
    },
    [disposeDocument],
  );

  const resetForDocument = (nextDocument: ParsedDocument) => {
    const nextFindings = analyzeParagraphs(nextDocument.paragraphs);
    setDocument(nextDocument);
    setCurrentPage(0);
    setIgnoredIds(new Set());
    setHistory([]);
    setReplacementChoices({});
    setFilter("전체");
    setSelectedId(null);
    setBaselineCount(nextFindings.length);
    setDraftText(nextDocument.paragraphs.join("\n"));
    setIsEditing(false);
  };

  const loadFile = async (file: File | undefined) => {
    if (!file || isProcessing) return;
    setIsProcessing(true);
    setNotice(`${file.name} 문서 구조를 로컬에서 읽고 있습니다.`);

    try {
      const parsed = await parseDocument(file);
      resetForDocument(parsed);
      setNotice(
        `${parsed.name}의 ${parsed.pages.length.toLocaleString()}쪽을 로컬에서 읽었습니다. 문서 내용은 외부로 전송되지 않았습니다.`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "문서를 읽는 중 알 수 없는 문제가 발생했습니다.",
      );
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void loadFile(event.dataTransfer.files[0]);
  };

  const chooseFinding = (finding: Finding) => {
    setCurrentPage(document.paragraphPages[finding.paragraphIndex] ?? 0);
    setSelectedId(finding.id);
  };

  const applyOne = (finding: Finding) => {
    const replacement =
      replacementChoices[finding.id] ?? finding.replacement ?? "";
    if (!replacement) return;

    setDocument((current) => {
      const paragraphs = [...current.paragraphs];
      const paragraph = paragraphs[finding.paragraphIndex];
      paragraphs[finding.paragraphIndex] =
        paragraph.slice(0, finding.start) +
        replacement +
        paragraph.slice(finding.end);
      return { ...current, paragraphs };
    });
    setHistory((current) => [
      ...current,
      { ...finding, status: "적용", chosenReplacement: replacement },
    ]);
    setSelectedId(null);
    setNotice(`‘${finding.original}’을(를) ‘${replacement}’으로 고쳤습니다.`);
  };

  const applySafeFindings = () => {
    const targets = findings.filter(
      (finding) => finding.safe && finding.replacement,
    );
    if (targets.length === 0) {
      setNotice("현재 일괄 적용할 수 있는 높은 확신도의 오류가 없습니다.");
      return;
    }

    setDocument((current) => {
      const paragraphs = [...current.paragraphs];
      const grouped = new Map<number, Finding[]>();
      for (const finding of targets) {
        const group = grouped.get(finding.paragraphIndex) ?? [];
        group.push(finding);
        grouped.set(finding.paragraphIndex, group);
      }

      for (const [paragraphIndex, group] of grouped) {
        let paragraph = paragraphs[paragraphIndex];
        for (const finding of [...group].sort(
          (left, right) => right.start - left.start,
        )) {
          paragraph =
            paragraph.slice(0, finding.start) +
            finding.replacement +
            paragraph.slice(finding.end);
        }
        paragraphs[paragraphIndex] = paragraph;
      }
      return { ...current, paragraphs };
    });

    setHistory((current) => [
      ...current,
      ...targets.map((finding) => ({
        ...finding,
        status: "적용" as const,
        chosenReplacement: finding.replacement,
      })),
    ]);
    setSelectedId(null);
    setNotice(`높은 확신도의 오류 ${targets.length}건을 일괄 수정했습니다.`);
  };

  const ignoreFinding = (finding: Finding) => {
    setIgnoredIds((current) =>
      new Set(current).add(findingIgnoreKey(finding)),
    );
    setHistory((current) => [
      ...current,
      { ...finding, status: "제외", chosenReplacement: null },
    ]);
    setSelectedId(null);
    setNotice(`‘${finding.original}’ 항목을 이번 검사에서 제외했습니다.`);
  };

  const saveDraft = () => {
    const paragraphs = draftText.split(/\r?\n/);
    const nextDocument = createFlowDocument({
      name: document.name,
      format: "직접 입력",
      paragraphs,
      bytes: new Blob([draftText]).size,
    });
    resetForDocument(nextDocument);
    setNotice("직접 편집한 내용을 다시 검사했습니다.");
  };

  const downloadText = () => {
    downloadBlob(
      `\uFEFF${document.paragraphs.join("\r\n")}`,
      `${baseName(document.name)}_검수본.txt`,
      "text/plain;charset=utf-8",
    );
    setNotice("현재 수정본을 UTF-8 TXT로 내려받았습니다. 원본 문서는 바뀌지 않았습니다.");
  };

  const downloadReport = () => {
    const rows = [
      [
        "상태",
        "쪽",
        "문단",
        "분류",
        "확신도",
        "원문",
        "제안",
        "사유",
        "출처",
      ],
      ...history.map((item) => [
        item.status,
        (document.paragraphPages[item.paragraphIndex] ?? 0) + 1,
        item.paragraphIndex + 1,
        item.category,
        item.confidence,
        item.original,
        item.chosenReplacement ?? item.replacement ?? "",
        item.reason,
        item.sourceLabel,
      ]),
      ...findings.map((item) => [
        "미처리",
        (document.paragraphPages[item.paragraphIndex] ?? 0) + 1,
        item.paragraphIndex + 1,
        item.category,
        item.confidence,
        item.original,
        item.replacement ?? "",
        item.reason,
        item.sourceLabel,
      ]),
    ];
    const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    downloadBlob(
      `\uFEFF${csv}`,
      `${baseName(document.name)}_검사보고서.csv`,
      "text/csv;charset=utf-8",
    );
    setNotice("적용·제외·미처리 항목이 담긴 검사보고서를 내려받았습니다.");
  };

  const renderParagraph = (paragraph: string, paragraphIndex: number) => {
    const paragraphFindings = findings.filter(
      (finding) => finding.paragraphIndex === paragraphIndex,
    );
    if (paragraphFindings.length === 0) return paragraph || "\u00a0";

    const pieces = [];
    let cursor = 0;
    for (const finding of paragraphFindings) {
      pieces.push(
        <Fragment key={`${finding.id}-before`}>
          {paragraph.slice(cursor, finding.start)}
        </Fragment>,
      );
      pieces.push(
        <button
          type="button"
          key={finding.id}
          className={`${styles.highlight} ${styles[`category${finding.category}`]} ${
            selectedFinding?.id === finding.id ? styles.selectedHighlight : ""
          }`}
          onClick={() => chooseFinding(finding)}
          aria-label={`${finding.category} 검사 항목: ${finding.original}`}
        >
          {paragraph.slice(finding.start, finding.end)}
        </button>,
      );
      cursor = finding.end;
    }
    pieces.push(
      <Fragment key={`paragraph-${paragraphIndex}-after`}>
        {paragraph.slice(cursor)}
      </Fragment>,
    );
    return pieces;
  };

  return (
    <main className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            가
          </span>
          <div>
            <strong>공공 AX 로컬</strong>
            <small>시리즈 2 · 문서 검수</small>
          </div>
        </div>

        <Link href="/" className={styles.backLink}>
          <span aria-hidden="true">←</span>
          시리즈 1로 돌아가기
        </Link>

        <section className={styles.sidebarSection}>
          <p className={styles.sidebarLabel}>검사 대상</p>
          <button
            type="button"
            className={`${styles.dropZone} ${isDragging ? styles.dragging : ""}`}
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            disabled={isProcessing}
          >
            <span className={styles.uploadIcon} aria-hidden="true">
              {isProcessing ? "···" : "＋"}
            </span>
            <strong>{isProcessing ? "문서 읽는 중" : "문서 불러오기"}</strong>
            <small>HWP · HWPX · DOCX · TXT</small>
          </button>
          <input
            ref={fileInputRef}
            className={styles.visuallyHidden}
            type="file"
            accept=".hwpx,.docx,.txt,.hwp"
            onChange={(event) => void loadFile(event.target.files?.[0])}
          />
        </section>

        <section className={styles.documentCard}>
          <span className={styles.fileBadge}>{document.format}</span>
          <div>
            <strong title={document.name}>{document.name}</strong>
            <small>
              {document.pages.length.toLocaleString()}쪽 ·{" "}
              {document.paragraphs.length.toLocaleString()}개 검사 줄 ·{" "}
              {formatBytes(document.bytes)}
            </small>
          </div>
        </section>

        <section className={styles.sidebarSection}>
          <div className={styles.sidebarHeading}>
            <p className={styles.sidebarLabel}>검사 기준</p>
            <span>{publicLanguageEntryCount.toLocaleString()}+</span>
          </div>
          <div className={styles.sourceCard}>
            <span className={styles.sourceIcon} aria-hidden="true">
              국
            </span>
            <div>
              <strong>국립국어원 공공언어</strong>
              <small>공공누리 제1유형 · 로컬 내장</small>
            </div>
            <span className={styles.sourceOn}>사용</span>
          </div>
          <div className={styles.sourceCard}>
            <span className={`${styles.sourceIcon} ${styles.ruleIcon}`} aria-hidden="true">
              규
            </span>
            <div>
              <strong>맞춤법·띄어쓰기 규칙</strong>
              <small>높은 확신도만 자동 수정</small>
            </div>
            <span className={styles.sourceOn}>사용</span>
          </div>
        </section>

        <div className={styles.privacyCard}>
          <span aria-hidden="true">✓</span>
          <div>
            <strong>외부 전송 없음</strong>
            <small>파일은 이 브라우저 안에서만 열립니다.</small>
          </div>
        </div>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <div>
            <p>공공문서 로컬 검수기</p>
            <h1>문서살림</h1>
          </div>
          <div className={styles.topActions}>
            <span className={styles.localBadge}>
              <i />
              로컬 규칙 엔진
            </span>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => {
                setDraftText(document.paragraphs.join("\n"));
                setIsEditing((current) => !current);
              }}
            >
              {isEditing ? "원문 보기" : "검수본 편집"}
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={applySafeFindings}
              disabled={safeCount === 0}
            >
              안전 수정 {safeCount > 0 && <span>{safeCount}</span>}
            </button>
          </div>
        </header>

        <div className={styles.notice} role="status">
          <span aria-hidden="true">i</span>
          <p>{notice}</p>
        </div>

        <section className={styles.summaryGrid} aria-label="검사 요약">
          <article>
            <span className={styles.summaryIcon}>!</span>
            <div>
              <small>남은 검사 항목</small>
              <strong>{findings.length.toLocaleString()}</strong>
            </div>
          </article>
          <article>
            <span className={`${styles.summaryIcon} ${styles.safeIcon}`}>✓</span>
            <div>
              <small>안전 수정 가능</small>
              <strong>{safeCount.toLocaleString()}</strong>
            </div>
          </article>
          <article>
            <span className={`${styles.summaryIcon} ${styles.reviewIcon}`}>?</span>
            <div>
              <small>문맥 확인 필요</small>
              <strong>
                {findings
                  .filter((finding) => finding.confidence === "검토")
                  .length.toLocaleString()}
              </strong>
            </div>
          </article>
          <article className={styles.progressCard}>
            <div className={styles.progressHeading}>
              <span>
                <small>검수 진행</small>
                <strong>{progress}%</strong>
              </span>
              <small>{processedCount.toLocaleString()}건 처리</small>
            </div>
            <div className={styles.progressTrack}>
              <span style={{ width: `${progress}%` }} />
            </div>
          </article>
        </section>

        <div className={styles.editorLayout}>
          <section className={styles.paperPanel}>
            <div className={styles.paperToolbar}>
              <div>
                <span className={styles.paperDot} />
                <strong>{document.name}</strong>
                <span className={styles.previewMode}>
                  {document.previewKind === "original-svg"
                    ? "원문 조판"
                    : "텍스트 페이지"}
                </span>
              </div>
              <div>
                <span>{characterCount.toLocaleString()}자</span>
                <button type="button" onClick={downloadText}>
                  수정본 TXT
                </button>
                <button type="button" onClick={downloadReport}>
                  검사보고서
                </button>
              </div>
            </div>

            {!isEditing && (
              <nav className={styles.pageNavigator} aria-label="원문 페이지 이동">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage((page) => Math.max(0, page - 1));
                    setSelectedId(null);
                  }}
                  disabled={currentPage === 0}
                  aria-label="이전 페이지"
                >
                  ←
                </button>
                <div className={styles.pageButtons}>
                  {pageNumbers.map((pageIndex, listIndex) => (
                    <Fragment key={pageIndex}>
                      {listIndex > 0 &&
                        pageIndex - pageNumbers[listIndex - 1] > 1 && (
                          <span>…</span>
                        )}
                      <button
                        type="button"
                        className={
                          currentPage === pageIndex ? styles.activePage : ""
                        }
                        onClick={() => {
                          setCurrentPage(pageIndex);
                          setSelectedId(null);
                        }}
                        aria-current={
                          currentPage === pageIndex ? "page" : undefined
                        }
                        aria-label={`${pageIndex + 1}쪽${
                          findingsByPage[pageIndex]
                            ? `, 검사 항목 ${findingsByPage[pageIndex]}건`
                            : ""
                        }`}
                      >
                        {pageIndex + 1}
                        {findingsByPage[pageIndex] > 0 && (
                          <i aria-hidden="true">{findingsByPage[pageIndex]}</i>
                        )}
                      </button>
                    </Fragment>
                  ))}
                </div>
                <span className={styles.pagePosition}>
                  <strong>{currentPage + 1}</strong> / {document.pages.length}쪽
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage((page) =>
                      Math.min(document.pages.length - 1, page + 1),
                    );
                    setSelectedId(null);
                  }}
                  disabled={currentPage >= document.pages.length - 1}
                  aria-label="다음 페이지"
                >
                  →
                </button>
              </nav>
            )}

            {isEditing ? (
              <div className={styles.editArea}>
                <textarea
                  value={draftText}
                  onChange={(event) => setDraftText(event.target.value)}
                  aria-label="문서 직접 편집"
                  spellCheck={false}
                />
                <div>
                  <p>줄바꿈을 기준으로 문단을 구분해 다시 검사합니다.</p>
                  <button type="button" onClick={saveDraft}>
                    편집 내용 다시 검사
                  </button>
                </div>
              </div>
            ) : currentSvg ? (
              <div className={styles.originalPreview}>
                <div className={styles.originalNotice}>
                  <span aria-hidden="true">▣</span>
                  <p>
                    <strong>원문 {currentPage + 1}쪽</strong>
                    글꼴·표·그림·쪽 배치를 로컬에서 재현합니다. 수정 제안은 오른쪽
                    검사 결과와 검수본에만 반영되어 원본은 바뀌지 않습니다.
                  </p>
                </div>
                <article
                  className={styles.originalSheet}
                  aria-label={`원문 ${currentPage + 1}쪽 미리보기`}
                  dangerouslySetInnerHTML={{ __html: currentSvg }}
                />
              </div>
            ) : (
              <article className={styles.paper} aria-label="검사 문서 미리보기">
                <div className={styles.flowPageLabel}>
                  <span>{currentPage + 1}쪽</span>
                  <p>
                    이 형식은 원문 조판 정보가 없어 읽기 편한 페이지로 나누어
                    표시합니다.
                  </p>
                </div>
                {currentPageParagraphIndexes.map((paragraphIndex) => {
                  const paragraph = document.paragraphs[paragraphIndex];
                  return (
                    <div
                      className={styles.paragraphRow}
                      id={`paragraph-${paragraphIndex}`}
                      key={`${paragraphIndex}-${paragraph.slice(0, 12)}`}
                    >
                      <span>{String(paragraphIndex + 1).padStart(2, "0")}</span>
                      <p>{renderParagraph(paragraph, paragraphIndex)}</p>
                    </div>
                  );
                })}
              </article>
            )}
          </section>

          <aside className={styles.findingsPanel}>
            <div className={styles.findingsHeader}>
              <div>
                <p>
                  <strong>{currentPage + 1}쪽</strong> 검사 결과
                </p>
                <span>
                  이 쪽 {visibleFindings.length.toLocaleString()}건 · 문서 전체{" "}
                  {findings.length.toLocaleString()}건
                </span>
              </div>
              <div className={styles.resultPageNav}>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage((page) => Math.max(0, page - 1));
                    setSelectedId(null);
                  }}
                  disabled={currentPage === 0}
                >
                  ← 이전 쪽
                </button>
                <span>
                  {currentPage + 1} / {document.pages.length}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage((page) =>
                      Math.min(document.pages.length - 1, page + 1),
                    );
                    setSelectedId(null);
                  }}
                  disabled={currentPage >= document.pages.length - 1}
                >
                  다음 쪽 →
                </button>
              </div>
              <div className={styles.filterRow}>
                {categoryFilters.map((category) => (
                  <button
                    type="button"
                    key={category}
                    className={filter === category ? styles.activeFilter : ""}
                    onClick={() => {
                      setFilter(category);
                      setSelectedId(null);
                    }}
                  >
                    {category}
                    {category !== "전체" && counts[category] > 0 && (
                      <span>{counts[category]}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.findingsList}>
              {visibleFindings.length === 0 ? (
                <div className={styles.emptyState}>
                  <span>✓</span>
                  <strong>{currentPage + 1}쪽의 남은 항목이 없습니다</strong>
                  <p>다른 쪽으로 이동하거나 다른 범주를 확인하세요.</p>
                </div>
              ) : (
                visibleFindings.map((finding) => (
                    <article
                      key={finding.id}
                      className={`${styles.findingCard} ${
                        selectedFinding?.id === finding.id
                          ? styles.selectedCard
                          : ""
                      }`}
                    >
                      <button
                        type="button"
                        className={styles.findingMain}
                        onClick={() => chooseFinding(finding)}
                      >
                        <span className={styles.findingMeta}>
                          <b
                            className={
                              finding.severity === "오류"
                                ? styles.errorTag
                                : styles.reviewTag
                            }
                          >
                            {finding.category}
                          </b>
                          <small>{finding.confidence} 확신</small>
                          <small>{currentPage + 1}쪽</small>
                          <small>{finding.paragraphIndex + 1}번째 검사 줄</small>
                        </span>
                        <span className={styles.changeRow}>
                          <del>{finding.original}</del>
                          <i aria-hidden="true">→</i>
                          <strong>{finding.replacement ?? "내용 확인"}</strong>
                        </span>
                        <span className={styles.reason}>{finding.reason}</span>
                      </button>

                      {selectedFinding?.id === finding.id && (
                        <div className={styles.findingDetails}>
                          {finding.alternatives &&
                            finding.alternatives.length > 1 && (
                              <label>
                                <span>대안어 선택</span>
                                <select
                                  value={
                                    replacementChoices[finding.id] ??
                                    finding.replacement ??
                                    ""
                                  }
                                  onChange={(event) =>
                                    setReplacementChoices((current) => ({
                                      ...current,
                                      [finding.id]: event.target.value,
                                    }))
                                  }
                                >
                                  {finding.alternatives.map((alternative) => (
                                    <option key={alternative} value={alternative}>
                                      {alternative}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            )}
                          <a
                            href={finding.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {finding.sourceLabel} ↗
                          </a>
                          <div>
                            <button
                              type="button"
                              className={styles.ignoreButton}
                              onClick={() => ignoreFinding(finding)}
                            >
                              이번만 제외
                            </button>
                            {finding.replacement && (
                              <button
                                type="button"
                                className={styles.applyButton}
                                onClick={() => applyOne(finding)}
                              >
                                이 제안 적용
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </article>
                  ))
              )}
            </div>

            <footer className={styles.attribution}>
              <strong>데이터 출처</strong>
              <p>
                {publicLanguageSource.title}({publicLanguageSource.snapshot}),
                공공누리 제1유형
              </p>
              <a
                href={publicLanguageSource.url}
                target="_blank"
                rel="noreferrer"
              >
                원문 데이터 확인 ↗
              </a>
            </footer>
          </aside>
        </div>
      </section>
    </main>
  );
}
