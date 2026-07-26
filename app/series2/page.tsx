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

const findingCategories: FindingCategory[] = [
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

type DiffPart = {
  type: "same" | "removed" | "added";
  value: string;
};

type OriginalHighlight = {
  id: string;
  finding: Finding;
  left: number;
  top: number;
  width: number;
  height: number;
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

function tokenizeForComparison(text: string) {
  return text.match(/\s+|[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]+|./gu) ?? [];
}

function fallbackDiff(before: string, after: string): DiffPart[] {
  let prefixLength = 0;
  while (
    prefixLength < before.length &&
    prefixLength < after.length &&
    before[prefixLength] === after[prefixLength]
  ) {
    prefixLength += 1;
  }

  let beforeSuffix = before.length;
  let afterSuffix = after.length;
  while (
    beforeSuffix > prefixLength &&
    afterSuffix > prefixLength &&
    before[beforeSuffix - 1] === after[afterSuffix - 1]
  ) {
    beforeSuffix -= 1;
    afterSuffix -= 1;
  }

  return [
    { type: "same", value: before.slice(0, prefixLength) },
    { type: "removed", value: before.slice(prefixLength, beforeSuffix) },
    { type: "added", value: after.slice(prefixLength, afterSuffix) },
    { type: "same", value: before.slice(beforeSuffix) },
  ].filter((part) => part.value.length > 0) as DiffPart[];
}

function compareText(before: string, after: string): DiffPart[] {
  if (before === after) return [{ type: "same", value: before }];

  const beforeTokens = tokenizeForComparison(before);
  const afterTokens = tokenizeForComparison(after);
  if (beforeTokens.length * afterTokens.length > 40_000) {
    return fallbackDiff(before, after);
  }

  const table = Array.from({ length: beforeTokens.length + 1 }, () =>
    new Uint16Array(afterTokens.length + 1),
  );
  for (let beforeIndex = beforeTokens.length - 1; beforeIndex >= 0; beforeIndex -= 1) {
    for (let afterIndex = afterTokens.length - 1; afterIndex >= 0; afterIndex -= 1) {
      table[beforeIndex][afterIndex] =
        beforeTokens[beforeIndex] === afterTokens[afterIndex]
          ? table[beforeIndex + 1][afterIndex + 1] + 1
          : Math.max(
              table[beforeIndex + 1][afterIndex],
              table[beforeIndex][afterIndex + 1],
            );
    }
  }

  const parts: DiffPart[] = [];
  const append = (type: DiffPart["type"], value: string) => {
    const last = parts[parts.length - 1];
    if (last?.type === type) last.value += value;
    else parts.push({ type, value });
  };

  let beforeIndex = 0;
  let afterIndex = 0;
  while (beforeIndex < beforeTokens.length && afterIndex < afterTokens.length) {
    if (beforeTokens[beforeIndex] === afterTokens[afterIndex]) {
      append("same", beforeTokens[beforeIndex]);
      beforeIndex += 1;
      afterIndex += 1;
    } else if (
      table[beforeIndex + 1][afterIndex] >= table[beforeIndex][afterIndex + 1]
    ) {
      append("removed", beforeTokens[beforeIndex]);
      beforeIndex += 1;
    } else {
      append("added", afterTokens[afterIndex]);
      afterIndex += 1;
    }
  }
  while (beforeIndex < beforeTokens.length) {
    append("removed", beforeTokens[beforeIndex]);
    beforeIndex += 1;
  }
  while (afterIndex < afterTokens.length) {
    append("added", afterTokens[afterIndex]);
    afterIndex += 1;
  }
  return parts;
}

export default function SeriesTwoPage() {
  const [document, setDocument] = useState<ParsedDocument>(initialSample);
  const [sourceParagraphs, setSourceParagraphs] = useState([...sampleParagraphs]);
  const [currentPage, setCurrentPage] = useState(0);
  const [previewView, setPreviewView] = useState<"original" | "compare">(
    "original",
  );
  const [ignoredIds, setIgnoredIds] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeCategories, setActiveCategories] = useState<Set<FindingCategory>>(
    () => new Set(findingCategories),
  );
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
      currentPageFindings.filter((finding) =>
        activeCategories.has(finding.category),
      ),
    [activeCategories, currentPageFindings],
  );

  const selectedFinding =
    visibleFindings.find((finding) => finding.id === selectedId) ?? null;

  const counts = useMemo(() => {
    const result: Record<FindingCategory, number> = {
      맞춤법: 0,
      띄어쓰기: 0,
      공공언어: 0,
      문장: 0,
      표기: 0,
    };
    for (const finding of currentPageFindings) result[finding.category] += 1;
    return result;
  }, [currentPageFindings]);

  const allCategoriesSelected = findingCategories.every((category) =>
    activeCategories.has(category),
  );
  const someCategoriesSelected = activeCategories.size > 0;

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
  const pageComparableCount = visibleFindings.filter(
    (finding) => finding.replacement,
  ).length;
  const pageSafeComparableCount = visibleFindings.filter(
    (finding) => finding.safe && finding.replacement,
  ).length;
  const pageReviewComparableCount =
    pageComparableCount - pageSafeComparableCount;
  const pageUnresolvedCount = visibleFindings.length - pageComparableCount;
  const pageAppliedCount = history.filter(
    (item) =>
      item.status === "적용" &&
      (document.paragraphPages[item.paragraphIndex] ?? 0) === currentPage,
  ).length;
  const pageNumbers = visiblePageNumbers(document.pages.length, currentPage);
  const currentSvg = useMemo(() => {
    if (document.previewKind !== "original-svg" || !document.renderPage) return null;
    try {
      return document.renderPage(currentPage);
    } catch {
      return null;
    }
  }, [currentPage, document]);

  const originalHighlights = useMemo(() => {
    const page = document.pages[currentPage];
    if (!page?.lines || !page.width || !page.height) return [];

    const highlights: OriginalHighlight[] = [];
    for (const finding of visibleFindings) {
      const line = page.lines.find(
        (candidate) => candidate.paragraphIndex === finding.paragraphIndex,
      );
      if (!line) continue;

      let textOffset = 0;
      for (let runIndex = 0; runIndex < line.runs.length; runIndex += 1) {
        const run = line.runs[runIndex];
        const runStart = textOffset;
        const runEnd = runStart + run.text.length;
        textOffset = runEnd;

        const overlapStart = Math.max(finding.start, runStart);
        const overlapEnd = Math.min(finding.end, runEnd);
        if (overlapStart >= overlapEnd || run.text.length === 0) continue;

        const localStart = overlapStart - runStart;
        const localEnd = overlapEnd - runStart;
        const hasExactPositions =
          run.charX && run.charX.length >= run.text.length + 1;
        const startOffset = hasExactPositions
          ? run.charX?.[localStart] ?? 0
          : run.width * (localStart / run.text.length);
        const endOffset = hasExactPositions
          ? run.charX?.[localEnd] ?? run.width
          : run.width * (localEnd / run.text.length);

        highlights.push({
          id: `${finding.id}-${runIndex}`,
          finding,
          left: ((run.x + startOffset) / page.width) * 100,
          top: ((run.y + run.height * 0.1) / page.height) * 100,
          width: (Math.max(2, endOffset - startOffset) / page.width) * 100,
          height: (Math.max(7, run.height * 0.82) / page.height) * 100,
        });
      }
    }
    return highlights;
  }, [currentPage, document.pages, visibleFindings]);

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
    setSourceParagraphs([...nextDocument.paragraphs]);
    setCurrentPage(0);
    setPreviewView("original");
    setIgnoredIds(new Set());
    setHistory([]);
    setReplacementChoices({});
    setActiveCategories(new Set(findingCategories));
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
    setPreviewView("compare");
    setSelectedId(finding.id);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.document
          .getElementById(`compare-row-${finding.paragraphIndex}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
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
    const paragraphFindings = visibleFindings.filter(
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
          aria-label={`${finding.category} 검사 항목: ${finding.original}, 제안: ${
            finding.replacement ?? "문맥 확인"
          }. ${finding.reason}`}
        >
          {paragraph.slice(finding.start, finding.end)}
          <span className={styles.highlightTooltip} aria-hidden="true">
            <b>{finding.category}</b>
            <span>
              <del>{finding.original}</del>
              <i>→</i>
              <strong>{finding.replacement ?? "문맥 확인"}</strong>
            </span>
            <small>{finding.reason}</small>
          </span>
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

  const proposedParagraph = (paragraph: string, paragraphIndex: number) => {
    const paragraphFindings = visibleFindings
      .filter(
        (finding) =>
          finding.paragraphIndex === paragraphIndex && finding.replacement,
      )
      .sort((left, right) => right.start - left.start);

    let proposed = paragraph;
    for (const finding of paragraphFindings) {
      const replacement =
        replacementChoices[finding.id] ?? finding.replacement ?? "";
      proposed =
        proposed.slice(0, finding.start) +
        replacement +
        proposed.slice(finding.end);
    }
    return proposed;
  };

  const renderComparisonSide = (
    parts: DiffPart[],
    side: "before" | "after",
    hasReviewSuggestion: boolean,
  ) =>
    parts.map((part, index) => {
      if (side === "before" && part.type === "added") return null;
      if (side === "after" && part.type === "removed") return null;
      if (part.type === "same") {
        return <Fragment key={`${side}-same-${index}`}>{part.value}</Fragment>;
      }

      return (
        <mark
          key={`${side}-${part.type}-${index}`}
          className={
            side === "before"
              ? styles.compareRemoved
              : hasReviewSuggestion
                ? styles.compareAddedReview
                : styles.compareAddedSafe
          }
        >
          {part.value}
        </mark>
      );
    });

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
              <div className={styles.previewViewBar}>
                <div className={styles.previewViewTabs} role="group" aria-label="미리보기 방식">
                  <button
                    type="button"
                    className={
                      previewView === "original" ? styles.activePreviewView : ""
                    }
                    onClick={() => setPreviewView("original")}
                    aria-pressed={previewView === "original"}
                  >
                    원문 페이지
                  </button>
                  <button
                    type="button"
                    className={
                      previewView === "compare" ? styles.activePreviewView : ""
                    }
                    onClick={() => setPreviewView("compare")}
                    aria-pressed={previewView === "compare"}
                  >
                    전후 비교
                    {visibleFindings.length > 0 && (
                      <span>{visibleFindings.length}</span>
                    )}
                  </button>
                </div>
                <p>
                  {previewView === "original"
                    ? "실제 문서 배치와 서식을 확인합니다."
                    : "원본과 적용된 수정·남은 제안을 한 줄씩 맞춰 봅니다."}
                </p>
              </div>
            )}

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
            ) : previewView === "compare" ? (
              <section
                className={styles.comparePreview}
                aria-label={`${currentPage + 1}쪽 수정 전후 비교 미리보기`}
              >
                <div className={styles.compareSummary}>
                  <div>
                    <span aria-hidden="true">↔</span>
                    <p>
                      <strong>{currentPage + 1}쪽 전후 비교</strong>
                      왼쪽은 처음 불러온 원문, 오른쪽은 적용한 수정과 아직 남은
                      제안을 합친 예상 검수본입니다.
                    </p>
                  </div>
                  <div className={styles.compareLegend}>
                    {pageAppliedCount > 0 && (
                      <span className={styles.appliedLegend}>
                        적용 완료 {pageAppliedCount}
                      </span>
                    )}
                    {pageSafeComparableCount > 0 && (
                      <span className={styles.safeLegend}>
                        안전 제안 {pageSafeComparableCount}
                      </span>
                    )}
                    {pageReviewComparableCount > 0 && (
                      <span className={styles.reviewLegend}>
                        검토 제안 {pageReviewComparableCount}
                      </span>
                    )}
                    {pageUnresolvedCount > 0 && (
                      <span className={styles.unresolvedLegend}>
                        문맥 확인 {pageUnresolvedCount}
                      </span>
                    )}
                  </div>
                </div>

                <div className={styles.compareColumnHeaders} aria-hidden="true">
                  <div>
                    <span>수정 전</span>
                    <strong>처음 불러온 원문</strong>
                  </div>
                  <div>
                    <span>수정 후 예상</span>
                    <strong>제안 반영 미리보기 · 확정 전</strong>
                  </div>
                </div>

                <div className={styles.compareRows}>
                  {currentPageParagraphIndexes.map((paragraphIndex) => {
                    const original =
                      sourceParagraphs[paragraphIndex] ??
                      document.paragraphs[paragraphIndex] ??
                      "";
                    const current = document.paragraphs[paragraphIndex] ?? "";
                    const proposed = proposedParagraph(current, paragraphIndex);
                    const parts = compareText(original, proposed);
                    const paragraphFindings = visibleFindings.filter(
                      (finding) => finding.paragraphIndex === paragraphIndex,
                    );
                    const paragraphApplied = history.filter(
                      (item) =>
                        item.status === "적용" &&
                        item.paragraphIndex === paragraphIndex,
                    );
                    const pendingTextChangeCount = paragraphFindings.filter(
                      (finding) => finding.replacement,
                    ).length;
                    const hasReviewSuggestion =
                      paragraphFindings.some(
                        (finding) => !finding.safe && finding.replacement,
                      ) ||
                      paragraphApplied.some((item) => !item.safe);
                    const changed = original !== proposed;
                    const isSelected = paragraphFindings.some(
                      (finding) => finding.id === selectedId,
                    );

                    return (
                      <article
                        id={`compare-row-${paragraphIndex}`}
                        className={`${styles.compareRow} ${
                          changed ? styles.changedCompareRow : styles.unchangedCompareRow
                        } ${isSelected ? styles.selectedCompareRow : ""}`}
                        key={`compare-${paragraphIndex}`}
                      >
                        <div className={styles.compareLineMeta}>
                          <span>{paragraphIndex + 1}번째 검사 줄</span>
                          <strong>
                            {changed
                              ? `${pendingTextChangeCount + paragraphApplied.length}개 변화`
                              : paragraphFindings.length > 0
                                ? "문맥 확인"
                                : "변화 없음"}
                          </strong>
                        </div>
                        <section className={styles.beforePane}>
                          <p>
                            {renderComparisonSide(
                              parts,
                              "before",
                              hasReviewSuggestion,
                            )}
                          </p>
                        </section>
                        <section className={styles.afterPane}>
                          <p>
                            {renderComparisonSide(
                              parts,
                              "after",
                              hasReviewSuggestion,
                            )}
                          </p>
                        </section>
                        {paragraphFindings.length > 0 && (
                          <div className={styles.compareSuggestionStrip}>
                            {paragraphFindings.map((finding) => (
                              <button
                                type="button"
                                key={`compare-suggestion-${finding.id}`}
                                onClick={() => chooseFinding(finding)}
                                className={
                                  selectedFinding?.id === finding.id
                                    ? styles.activeCompareSuggestion
                                    : ""
                                }
                              >
                                <b
                                  className={
                                    finding.safe
                                      ? styles.safeSuggestion
                                      : styles.reviewSuggestion
                                  }
                                >
                                  {finding.safe ? "안전" : "검토"}
                                </b>
                                <del>{finding.original}</del>
                                <span aria-hidden="true">→</span>
                                <strong>
                                  {replacementChoices[finding.id] ??
                                    finding.replacement ??
                                    "문맥 확인"}
                                </strong>
                              </button>
                            ))}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : currentSvg ? (
              <div className={styles.originalPreview}>
                <div className={styles.originalNotice}>
                  <span aria-hidden="true">▣</span>
                  <p>
                    <strong>원문 {currentPage + 1}쪽</strong>
                    글꼴·표·그림·쪽 배치를 로컬에서 재현하고, 체크한 범주의
                    검사 위치 {visibleFindings.length}곳을 형광펜으로 표시합니다.
                    원본 파일 자체는 바뀌지 않습니다.
                  </p>
                </div>
                <article
                  className={styles.originalSheet}
                  aria-label={`원문 ${currentPage + 1}쪽 미리보기`}
                >
                  <div
                    className={styles.originalSvgHost}
                    dangerouslySetInnerHTML={{ __html: currentSvg }}
                  />
                  <div className={styles.originalHighlightLayer}>
                    {originalHighlights.map((highlight) => (
                      <button
                        type="button"
                        key={highlight.id}
                        className={`${styles.originalHighlight} ${
                          styles[`highlight${highlight.finding.category}`]
                        } ${
                          selectedFinding?.id === highlight.finding.id
                            ? styles.selectedOriginalHighlight
                            : ""
                        }`}
                        style={{
                          left: `${highlight.left}%`,
                          top: `${highlight.top}%`,
                          width: `${highlight.width}%`,
                          height: `${highlight.height}%`,
                        }}
                        aria-label={`${highlight.finding.category} 검사 위치: ${
                          highlight.finding.original
                        }, 제안: ${
                          highlight.finding.replacement ?? "문맥 확인"
                        }. ${highlight.finding.reason}`}
                        onClick={() => chooseFinding(highlight.finding)}
                      >
                        <span className={styles.highlightTooltip} aria-hidden="true">
                          <b>{highlight.finding.category}</b>
                          <span>
                            <del>{highlight.finding.original}</del>
                            <i>→</i>
                            <strong>
                              {highlight.finding.replacement ?? "문맥 확인"}
                            </strong>
                          </span>
                          <small>{highlight.finding.reason}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </article>
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
                  선택 표시 {visibleFindings.length.toLocaleString()}건 · 이 쪽 전체{" "}
                  {currentPageFindings.length.toLocaleString()}건 · 문서 전체{" "}
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
              <fieldset className={styles.filterChecks}>
                <legend>형광펜 범주 선택</legend>
                <label
                  className={`${styles.filterCheck} ${styles.allFilterCheck} ${
                    allCategoriesSelected ? styles.checkedFilter : ""
                  } ${
                    someCategoriesSelected && !allCategoriesSelected
                      ? styles.partialFilter
                      : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={allCategoriesSelected}
                    ref={(input) => {
                      if (input) {
                        input.indeterminate =
                          someCategoriesSelected && !allCategoriesSelected;
                      }
                    }}
                    onChange={() => {
                      setActiveCategories(new Set(findingCategories));
                      setSelectedId(null);
                    }}
                  />
                  <span className={styles.filterCheckBox} aria-hidden="true" />
                  <strong>전체</strong>
                  <small>{currentPageFindings.length}</small>
                </label>
                {findingCategories.map((category) => {
                  const isChecked = activeCategories.has(category);
                  return (
                    <label
                      key={category}
                      className={`${styles.filterCheck} ${
                        styles[`filter${category}`]
                      } ${isChecked ? styles.checkedFilter : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          setActiveCategories((current) => {
                            if (
                              findingCategories.every((item) => current.has(item))
                            ) {
                              return new Set([category]);
                            }
                            const next = new Set(current);
                            if (next.has(category)) next.delete(category);
                            else next.add(category);
                            return next;
                          });
                          setSelectedId(null);
                        }}
                      />
                      <span className={styles.filterCheckBox} aria-hidden="true" />
                      <i aria-hidden="true" />
                      <strong>{category}</strong>
                      <small>{counts[category]}</small>
                    </label>
                  );
                })}
              </fieldset>
              <p className={styles.filterHelp}>
                전체 상태에서 범주 하나를 누르면 그 항목만 표시합니다. 이후에는
                여러 범주를 함께 선택할 수 있습니다.
              </p>
            </div>

            <div className={styles.findingsList}>
              {visibleFindings.length === 0 ? (
                <div className={styles.emptyState}>
                  <span>{someCategoriesSelected ? "✓" : "□"}</span>
                  <strong>
                    {someCategoriesSelected
                      ? `${currentPage + 1}쪽의 선택 범주 항목이 없습니다`
                      : "표시할 범주를 체크하세요"}
                  </strong>
                  <p>
                    {someCategoriesSelected
                      ? "다른 쪽으로 이동하거나 다른 범주를 선택하세요."
                      : "전체 또는 맞춤법·띄어쓰기 같은 범주를 여러 개 선택할 수 있습니다."}
                  </p>
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
