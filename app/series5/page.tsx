"use client";

import JSZip from "jszip";
import {
  ChangeEvent,
  DragEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "./series5.module.css";
import {
  ACCEPTED_FILE_TYPES,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  ExtractedResource,
  ExtractionResult,
  KIND_LABELS,
  PackageExtractionError,
  ResourceCategory,
  SUPPORTED_FORMAT_COUNT,
  SUPPORTED_FORMAT_GROUPS,
  extractDocumentPackage,
  isInlinePreviewSupported,
  isSupportedPackageExtension,
} from "./resource-extractor";

const MAX_SOURCE_BYTES = 100 * 1024 * 1024;

type CategoryFilter = "all" | ResourceCategory;
type ExtractorPhase = "idle" | "reading" | "ready" | "error";

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(bytes < 10 * 1024 ** 2 ? 1 : 0)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
};

const safeBaseName = (fileName: string) =>
  fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .trim() || "document";

const blobFromResource = (resource: ExtractedResource) => {
  const copy = Uint8Array.from(resource.data);
  return new Blob([copy.buffer], { type: resource.mime });
};

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

function ResourceGlyph({ resource }: { resource: ExtractedResource }) {
  const labels: Record<ResourceCategory, string> = {
    image: "IMG",
    video: "VID",
    audio: "AUD",
    attachment: "ATT",
    font: "FNT",
    style: "STY",
    script: "VBA",
    structure: "XML",
    other: "ETC",
  };
  return (
    <span className={`${styles.resourceGlyph} ${styles[`glyph_${resource.category}`]}`} aria-hidden="true">
      {resource.category === "script"
        ? labels.script
        : resource.extension
          ? resource.extension.slice(0, 4).toUpperCase()
          : labels[resource.category]}
    </span>
  );
}

function InlinePreview({ resource, compact = false }: { resource: ExtractedResource; compact?: boolean }) {
  const [url, setUrl] = useState("");
  const supported = isInlinePreviewSupported(resource) && resource.size <= 24 * 1024 * 1024;

  useEffect(() => {
    const nextUrl = supported ? URL.createObjectURL(blobFromResource(resource)) : "";
    const update = window.setTimeout(() => setUrl(nextUrl), 0);
    return () => {
      window.clearTimeout(update);
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [resource, supported]);

  if (!url) return <ResourceGlyph resource={resource} />;
  if (resource.category === "image") {
    // Package-local Blob URLs cannot use the framework image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={compact ? "" : resource.name} />;
  }
  if (resource.category === "video") {
    return compact ? <ResourceGlyph resource={resource} /> : <video src={url} controls preload="metadata" />;
  }
  if (resource.category === "audio") {
    return compact ? <ResourceGlyph resource={resource} /> : <audio src={url} controls preload="metadata" />;
  }
  return <ResourceGlyph resource={resource} />;
}

export default function SeriesFivePage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<ExtractorPhase>("idle");
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [packing, setPacking] = useState(false);

  const counts = useMemo(() => {
    const next = Object.fromEntries(CATEGORY_ORDER.map((item) => [item, 0])) as Record<
      ResourceCategory,
      number
    >;
    for (const resource of result?.resources ?? []) next[resource.category] += 1;
    return next;
  }, [result]);

  const visibleResources = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ko");
    return (result?.resources ?? []).filter((resource) => {
      if (category !== "all" && resource.category !== category) return false;
      if (!normalizedQuery) return true;
      return `${resource.name}\n${resource.path}`.toLocaleLowerCase("ko").includes(normalizedQuery);
    });
  }, [category, query, result]);

  const selectedResource =
    result?.resources.find((resource) => resource.id === selectedId) ?? visibleResources[0] ?? null;

  const reset = () => {
    setPhase("idle");
    setResult(null);
    setError("");
    setDragActive(false);
    setCategory("all");
    setQuery("");
    setSelectedId("");
    setPacking(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const openPicker = () => inputRef.current?.click();

  const processFile = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setResult(null);
    setPhase("reading");

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !isSupportedPackageExtension(extension)) {
      setError(`지원 형식: ZIP 패키지 문서 ${SUPPORTED_FORMAT_COUNT}종`);
      setPhase("error");
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setError("파일 크기 제한: 100 MB");
      setPhase("error");
      return;
    }

    try {
      const extraction = await extractDocumentPackage(await file.arrayBuffer(), file.name);
      const firstVisual = extraction.resources.find((resource) => resource.category === "image");
      const firstResource = firstVisual ?? extraction.resources[0];
      setResult(extraction);
      setCategory(firstVisual ? "image" : "all");
      setSelectedId(firstResource?.id ?? "");
      setPhase("ready");
    } catch (caught) {
      const message =
        caught instanceof PackageExtractionError || caught instanceof Error
          ? caught.message
          : "문서 패키지 분석 오류";
      setError(message);
      setPhase("error");
    }
  };

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    void processFile(event.target.files?.[0]);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    void processFile(event.dataTransfer.files?.[0]);
  };

  const handleDropKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  };

  const downloadResource = (resource: ExtractedResource) => {
    downloadBlob(blobFromResource(resource), resource.name);
  };

  const downloadAll = async () => {
    if (!result || packing) return;
    setPacking(true);
    try {
      const output = new JSZip();
      for (const resource of result.resources) {
        output.file(`${CATEGORY_LABELS[resource.category]}/${resource.path}`, resource.data, {
          binary: true,
        });
      }
      const blob = await output.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });
      downloadBlob(blob, `${safeBaseName(result.fileName)}-리소스.zip`);
    } finally {
      setPacking(false);
    }
  };

  const renderIdle = () => (
    <section className={styles.dropStage}>
      <div
        className={`${styles.dropZone} ${dragActive ? styles.dropZoneActive : ""}`}
        role="button"
        tabIndex={0}
        aria-label="문서 파일 선택"
        onClick={openPicker}
        onKeyDown={handleDropKey}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (event.currentTarget === event.target) setDragActive(false);
        }}
        onDrop={handleDrop}
      >
        <div className={styles.packageMark} aria-hidden="true">
          <span>DOC</span>
          <i />
          <i />
          <i />
        </div>
        <div className={styles.dropCopy}>
          <span className={styles.sectionLabel}>문서 패키지</span>
          <h1>문서 리소스 추출기</h1>
          <p>ZIP 패키지 문서 {SUPPORTED_FORMAT_COUNT}종</p>
        </div>
        <button type="button" className={styles.primaryButton} tabIndex={-1}>
          파일 선택
        </button>
        <span className={styles.dropHint}>파일 끌어놓기</span>
      </div>

      <div className={styles.formatGuide} aria-label="지원 문서와 미지원 문서">
        <section className={styles.supportedFormats}>
          <header>
            <span aria-hidden="true">✓</span>
            <strong>지원 문서</strong>
            <b>{SUPPORTED_FORMAT_COUNT}</b>
          </header>
          <ul>
            {SUPPORTED_FORMAT_GROUPS.map((group) => (
              <li key={group.label}>
                <b>{group.extensions.map((extension) => extension.toUpperCase()).join(" · ")}</b>
                <span>{group.label}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className={styles.unsupportedFormats}>
          <header>
            <span aria-hidden="true">×</span>
            <strong>미지원 문서</strong>
            <b>현재</b>
          </header>
          <ul>
            <li><b>HWP · DOC · PPT · XLS</b><span>구형 바이너리</span></li>
            <li><b>PDF · 일반 ZIP</b><span>별도 구조</span></li>
            <li><b>암호 · DRM · 손상</b><span>보호·오류 문서</span></li>
          </ul>
        </section>
      </div>
    </section>
  );

  const renderReading = () => (
    <section className={styles.centerState} aria-live="polite">
      <div className={styles.loader} aria-hidden="true"><span /><span /><span /></div>
      <span className={styles.sectionLabel}>로컬 처리</span>
      <h1>문서 패키지 분석</h1>
      <p>리소스 분류</p>
    </section>
  );

  const renderError = () => (
    <section className={styles.centerState} role="alert">
      <div className={styles.errorMark} aria-hidden="true">!</div>
      <span className={styles.sectionLabel}>추출 실패</span>
      <h1>{error}</h1>
      <p>HWP · PPT · DOC · 암호 · DRM · 손상 파일</p>
      <button type="button" className={styles.primaryButton} onClick={reset}>다른 파일</button>
    </section>
  );

  const renderWorkspace = () => {
    if (!result) return null;
    const totalCount = result.resources.length;
    return (
      <section className={styles.workspace}>
        <div className={styles.fileBar}>
          <div className={styles.documentBadge} aria-hidden="true">{KIND_LABELS[result.kind]}</div>
          <div className={styles.fileIdentity}>
            <strong>{result.fileName}</strong>
            <span>{KIND_LABELS[result.kind]} · {formatBytes(result.fileSize)}</span>
          </div>
          <div className={styles.fileFacts}>
            <span><small>리소스</small><strong>{totalCount}</strong></span>
            <span><small>해제 용량</small><strong>{formatBytes(result.totalSize)}</strong></span>
          </div>
          <div className={styles.fileActions}>
            <button type="button" className={styles.secondaryButton} onClick={reset}>다른 파일</button>
            <button type="button" className={styles.primaryButton} onClick={() => void downloadAll()} disabled={packing}>
              {packing ? "ZIP 생성" : "전체 ZIP"}
            </button>
          </div>
        </div>

        <div className={styles.workspaceGrid}>
          <aside className={styles.categoryPane} aria-label="리소스 분류">
            <div className={styles.paneTitle}>
              <span>분류</span>
              <b>{totalCount}</b>
            </div>
            <button
              type="button"
              className={category === "all" ? styles.categoryActive : ""}
              onClick={() => setCategory("all")}
            >
              <span className={styles.categorySwatch} data-category="all" />
              <span>전체 리소스</span>
              <b>{totalCount}</b>
            </button>
            {CATEGORY_ORDER.map((item) => (
              <button
                type="button"
                className={category === item ? styles.categoryActive : ""}
                key={item}
                onClick={() => setCategory(item)}
                disabled={counts[item] === 0}
              >
                <span className={styles.categorySwatch} data-category={item} />
                <span>{CATEGORY_LABELS[item]}</span>
                <b>{counts[item]}</b>
              </button>
            ))}
            <div className={styles.localCard}>
              <span className={styles.localDot} />
              <div><strong>브라우저 로컬</strong><small>외부 전송 없음</small></div>
            </div>
          </aside>

          <div className={styles.resourcePane}>
            <div className={styles.resourceToolbar}>
              <div>
                <span>{category === "all" ? "전체 리소스" : CATEGORY_LABELS[category]}</span>
                <b>{visibleResources.length}</b>
              </div>
              <label className={styles.searchBox}>
                <span aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="파일명·경로 검색"
                  aria-label="파일명과 경로 검색"
                />
              </label>
            </div>

            {visibleResources.length ? (
              <div className={styles.resourceGrid}>
                {visibleResources.map((resource) => {
                  const active = selectedResource?.id === resource.id;
                  return (
                    <button
                      type="button"
                      className={`${styles.resourceCard} ${active ? styles.resourceCardActive : ""}`}
                      key={resource.id}
                      onClick={() => setSelectedId(resource.id)}
                    >
                      <span className={styles.cardPreview}>
                        <InlinePreview resource={resource} compact />
                        <i>{CATEGORY_LABELS[resource.category]}</i>
                      </span>
                      <span className={styles.cardCopy}>
                        <strong>{resource.name}</strong>
                        <small>{formatBytes(resource.size)}{resource.usage.length ? ` · ${resource.usage.join(", ")}` : ""}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className={styles.emptyResults}>
                <span aria-hidden="true" />
                <strong>검색 결과 없음</strong>
                <button type="button" onClick={() => setQuery("")}>검색 초기화</button>
              </div>
            )}
          </div>

          <aside className={styles.previewPane} aria-label="리소스 미리보기">
            <div className={styles.paneTitle}>
              <span>미리보기</span>
              {selectedResource && <b>{selectedResource.extension.toUpperCase() || "FILE"}</b>}
            </div>
            {selectedResource ? (
              <div className={styles.previewContent}>
                <div className={styles.largePreview}>
                  <InlinePreview resource={selectedResource} />
                </div>
                <div className={styles.previewIdentity}>
                  <span>{CATEGORY_LABELS[selectedResource.category]}</span>
                  <h2>{selectedResource.name}</h2>
                </div>
                <dl className={styles.resourceDetails}>
                  <div><dt>파일 크기</dt><dd>{formatBytes(selectedResource.size)}</dd></div>
                  <div><dt>파일 형식</dt><dd>{selectedResource.extension.toUpperCase() || "FILE"}</dd></div>
                  <div><dt>사용 위치</dt><dd>{selectedResource.usage.join(", ") || "연결 정보 없음"}</dd></div>
                  <div className={styles.pathDetail}><dt>내부 경로</dt><dd>{selectedResource.path}</dd></div>
                </dl>
                <button type="button" className={styles.downloadButton} onClick={() => downloadResource(selectedResource)}>
                  파일 저장
                </button>
              </div>
            ) : (
              <div className={styles.previewEmpty}><strong>리소스 선택</strong></div>
            )}
          </aside>
        </div>
      </section>
    );
  };

  return (
    <main className={styles.app}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true"><i /><i /><i /></span>
          <div><strong>공공 AX 로컬 5</strong><small>문서 리소스 추출기</small></div>
        </div>
        <div className={styles.topStatus}>
          <span><i /> 로컬 처리</span>
          <b>{SUPPORTED_FORMAT_COUNT}개 형식</b>
          <a
            className={styles.downloadLink}
            href="https://github.com/obundh/gonggong-ax-local-2/releases/tag/series5-v0.1.0"
            target="_blank"
            rel="noreferrer"
          >
            Windows 원클릭
          </a>
        </div>
      </header>

      <input
        ref={inputRef}
        className={styles.hiddenInput}
        type="file"
        accept={ACCEPTED_FILE_TYPES}
        onChange={handleInput}
      />

      {phase === "idle" && renderIdle()}
      {phase === "reading" && renderReading()}
      {phase === "error" && renderError()}
      {phase === "ready" && renderWorkspace()}

      <footer className={styles.footer}>
        <span>브라우저 메모리 처리</span>
        <span>외부 전송 없음</span>
        <span>원본 변경 없음</span>
        <b>최대 100 MB</b>
      </footer>
    </main>
  );
}
