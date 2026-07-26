"use client";

import JSZip from "jszip";

export type ParsedPage = {
  number: number;
  paragraphIndexes: number[];
  width?: number;
  height?: number;
  lines?: ParsedPageLine[];
};

export type ParsedPageRun = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  charX?: number[];
};

export type ParsedPageLine = {
  paragraphIndex: number;
  runs: ParsedPageRun[];
};

export type ParsedDocument = {
  name: string;
  format: "TXT" | "DOCX" | "HWP" | "HWPX" | "직접 입력";
  paragraphs: string[];
  paragraphPages: number[];
  pages: ParsedPage[];
  bytes: number;
  previewKind: "original-svg" | "flow";
  renderPage?: (pageIndex: number) => string;
  dispose?: () => void;
};

type RhwpTextRun = {
  text?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  charX?: number[];
};

type RhwpPageInfo = {
  width?: number;
  height?: number;
};

const FLOW_PAGE_CHARACTER_LIMIT = 1_700;
let rhwpModulePromise: Promise<typeof import("@rhwp/core")> | null = null;
let measureCanvas: HTMLCanvasElement | null = null;

function ensureValidXml(xml: string, fileLabel: string) {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.getElementsByTagName("parsererror").length > 0) {
    throw new Error(`${fileLabel}의 문서 구조를 읽을 수 없습니다.`);
  }
  return document;
}

function textFromNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue ?? "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const element = node as Element;
  const name = element.localName.toLowerCase();
  if (name === "tab") return "\t";
  if (name === "br" || name === "linebreak") return "\n";
  if (name === "t") return element.textContent ?? "";

  return Array.from(element.childNodes).map(textFromNode).join("");
}

function paragraphTexts(document: XMLDocument) {
  const elements = Array.from(document.getElementsByTagNameNS("*", "p"));
  return elements
    .map((paragraph) => textFromNode(paragraph).replace(/\u00a0/g, " ").trimEnd())
    .filter((paragraph) => paragraph.trim().length > 0);
}

export function createFlowDocument(
  input: Pick<ParsedDocument, "name" | "format" | "paragraphs" | "bytes">,
): ParsedDocument {
  const pages: ParsedPage[] = [];
  const paragraphPages: number[] = [];
  let currentPage: ParsedPage = { number: 1, paragraphIndexes: [] };
  let currentCharacterCount = 0;

  for (let paragraphIndex = 0; paragraphIndex < input.paragraphs.length; paragraphIndex += 1) {
    const paragraph = input.paragraphs[paragraphIndex];
    const nextSize = Math.max(1, paragraph.length) + 1;
    if (
      currentPage.paragraphIndexes.length > 0 &&
      currentCharacterCount + nextSize > FLOW_PAGE_CHARACTER_LIMIT
    ) {
      pages.push(currentPage);
      currentPage = { number: pages.length + 1, paragraphIndexes: [] };
      currentCharacterCount = 0;
    }
    currentPage.paragraphIndexes.push(paragraphIndex);
    paragraphPages[paragraphIndex] = currentPage.number - 1;
    currentCharacterCount += nextSize;
  }

  if (currentPage.paragraphIndexes.length > 0 || pages.length === 0) {
    pages.push(currentPage);
  }

  return {
    ...input,
    paragraphPages,
    pages,
    previewKind: "flow",
  };
}

function installLocalTextMeasurement() {
  const globalScope = globalThis as typeof globalThis & {
    measureTextWidth?: (font: string, text: string) => number;
  };
  if (globalScope.measureTextWidth) return;

  globalScope.measureTextWidth = (font, text) => {
    measureCanvas ??= window.document.createElement("canvas");
    const context = measureCanvas.getContext("2d");
    if (!context) return text.length * 10;
    context.font = font;
    return context.measureText(text).width;
  };
}

async function loadRhwp() {
  if (!rhwpModulePromise) {
    rhwpModulePromise = (async () => {
      installLocalTextMeasurement();
      const rhwp = await import("@rhwp/core");
      await rhwp.default({ module_or_path: "/rhwp_bg.wasm" });
      return rhwp;
    })();
  }
  return rhwpModulePromise;
}

function pageTextLines(layoutJson: string) {
  let parsed: { runs?: RhwpTextRun[] };
  try {
    parsed = JSON.parse(layoutJson) as { runs?: RhwpTextRun[] };
  } catch {
    return [];
  }

  const runs = (parsed.runs ?? [])
    .filter((run) => run.text && run.text.trim().length > 0)
    .sort((left, right) => {
      const yDifference = (left.y ?? 0) - (right.y ?? 0);
      return Math.abs(yDifference) > 2.5
        ? yDifference
        : (left.x ?? 0) - (right.x ?? 0);
    });

  const rows: Array<{ y: number; runs: RhwpTextRun[] }> = [];
  for (const run of runs) {
    const y = run.y ?? 0;
    const row = rows.find((candidate) => Math.abs(candidate.y - y) <= 2.5);
    if (row) {
      row.runs.push(run);
    } else {
      rows.push({ y, runs: [run] });
    }
  }

  return rows
    .sort((left, right) => left.y - right.y)
    .map((row) => {
      const sortedRuns = row.runs.sort(
        (left, right) => (left.x ?? 0) - (right.x ?? 0),
      );
      return {
        text: sortedRuns
          .map((run) => run.text ?? "")
          .join("")
          .replace(/\u00a0/g, " ")
          .trimEnd(),
        runs: sortedRuns.map((run) => ({
          text: (run.text ?? "").replace(/\u00a0/g, " "),
          x: run.x ?? 0,
          y: run.y ?? row.y,
          width: run.w ?? 0,
          height: run.h ?? 0,
          charX: run.charX,
        })),
      };
    })
    .filter((line) => line.text.trim().length > 0);
}

function sanitizeSvg(svg: string) {
  const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (parsed.getElementsByTagName("parsererror").length > 0) {
    throw new Error("HWP 페이지 그림을 안전하게 표시하지 못했습니다.");
  }

  parsed
    .querySelectorAll("script, foreignObject, iframe, object, embed, audio, video")
    .forEach((element) => element.remove());

  parsed.querySelectorAll("*").forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();
      if (name.startsWith("on")) element.removeAttribute(attribute.name);
      if (
        (name === "href" || name === "xlink:href") &&
        !value.startsWith("#") &&
        !value.startsWith("data:image/")
      ) {
        element.removeAttribute(attribute.name);
      }
      if (name === "style" && /url\s*\(\s*['"]?(?:https?:|\/\/|javascript:)/i.test(value)) {
        element.removeAttribute(attribute.name);
      }
    }
  });

  return new XMLSerializer().serializeToString(parsed.documentElement);
}

async function parseRhwp(file: File, format: "HWP" | "HWPX"): Promise<ParsedDocument> {
  const rhwp = await loadRhwp();
  const hwpDocument = new rhwp.HwpDocument(new Uint8Array(await file.arrayBuffer()));
  const renderedPages = new Map<number, string>();

  try {
    const pageCount = hwpDocument.pageCount();
    if (pageCount < 1) throw new Error(`${format}에서 표시할 페이지를 찾지 못했습니다.`);

    const paragraphs: string[] = [];
    const paragraphPages: number[] = [];
    const pages: ParsedPage[] = [];

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      const pageParagraphIndexes: number[] = [];
      const pageLines: ParsedPageLine[] = [];
      for (const line of pageTextLines(hwpDocument.getPageTextLayout(pageIndex))) {
        const paragraphIndex = paragraphs.length;
        pageParagraphIndexes.push(paragraphs.length);
        pageLines.push({ paragraphIndex, runs: line.runs });
        paragraphs.push(line.text);
        paragraphPages.push(pageIndex);
      }

      let pageInfo: RhwpPageInfo = {};
      try {
        pageInfo = JSON.parse(hwpDocument.getPageInfo(pageIndex)) as RhwpPageInfo;
      } catch {
        // 페이지 크기 정보가 없더라도 SVG 자체 크기로 표시할 수 있습니다.
      }

      pages.push({
        number: pageIndex + 1,
        paragraphIndexes: pageParagraphIndexes,
        width: pageInfo.width,
        height: pageInfo.height,
        lines: pageLines,
      });

      if (pageIndex > 0 && pageIndex % 8 === 0) {
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      }
    }

    if (paragraphs.length === 0) {
      throw new Error(`${format}에서 검사할 한글 본문을 찾지 못했습니다.`);
    }

    renderedPages.set(0, sanitizeSvg(hwpDocument.renderPageSvg(0)));

    return {
      name: file.name,
      format,
      paragraphs,
      paragraphPages,
      pages,
      bytes: file.size,
      previewKind: "original-svg",
      renderPage: (pageIndex) => {
        const safePageIndex = Math.max(0, Math.min(pageCount - 1, pageIndex));
        const cached = renderedPages.get(safePageIndex);
        if (cached) return cached;
        const rendered = sanitizeSvg(hwpDocument.renderPageSvg(safePageIndex));
        renderedPages.set(safePageIndex, rendered);
        return rendered;
      },
      dispose: () => {
        renderedPages.clear();
        hwpDocument.free();
      },
    };
  } catch (error) {
    hwpDocument.free();
    throw error;
  }
}

async function parseDocx(file: File): Promise<ParsedDocument> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) {
    throw new Error("DOCX 본문(word/document.xml)을 찾을 수 없습니다.");
  }

  const xml = await documentFile.async("string");
  const document = ensureValidXml(xml, file.name);
  const paragraphs = paragraphTexts(document);
  if (paragraphs.length === 0) {
    throw new Error("DOCX에서 검사할 본문을 찾지 못했습니다.");
  }

  return createFlowDocument({
    name: file.name,
    format: "DOCX",
    paragraphs,
    bytes: file.size,
  });
}

async function parseHwpxFallback(file: File): Promise<ParsedDocument> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const sectionNames = Object.keys(zip.files)
    .filter((name) => /^Contents\/section\d+\.xml$/i.test(name))
    .sort((left, right) => {
      const leftIndex = Number(left.match(/\d+/)?.[0] ?? 0);
      const rightIndex = Number(right.match(/\d+/)?.[0] ?? 0);
      return leftIndex - rightIndex;
    });

  if (sectionNames.length === 0) {
    throw new Error("HWPX 본문(Contents/section*.xml)을 찾을 수 없습니다.");
  }

  const paragraphs: string[] = [];
  for (const sectionName of sectionNames) {
    const sectionFile = zip.file(sectionName);
    if (!sectionFile) continue;
    const xml = await sectionFile.async("string");
    paragraphs.push(...paragraphTexts(ensureValidXml(xml, sectionName)));
  }

  if (paragraphs.length === 0) {
    throw new Error("HWPX에서 검사할 본문을 찾지 못했습니다.");
  }

  return createFlowDocument({
    name: file.name,
    format: "HWPX",
    paragraphs,
    bytes: file.size,
  });
}

async function parseTxt(file: File): Promise<ParsedDocument> {
  const text = (await file.text()).replace(/^\uFEFF/, "");
  const replacementCount = text.match(/\uFFFD/g)?.length ?? 0;
  if (replacementCount > Math.max(2, text.length * 0.002)) {
    throw new Error(
      "TXT 문자 인코딩을 읽지 못했습니다. UTF-8로 저장한 뒤 다시 불러오세요.",
    );
  }

  const paragraphs = text.split(/\r?\n/);
  if (!paragraphs.some((paragraph) => paragraph.trim())) {
    throw new Error("TXT에 검사할 내용이 없습니다.");
  }

  return createFlowDocument({
    name: file.name,
    format: "TXT",
    paragraphs,
    bytes: file.size,
  });
}

export async function parseDocument(file: File): Promise<ParsedDocument> {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "txt") return parseTxt(file);
  if (extension === "docx") return parseDocx(file);
  if (extension === "hwp") return parseRhwp(file, "HWP");
  if (extension === "hwpx") {
    try {
      return await parseRhwp(file, "HWPX");
    } catch (renderError) {
      try {
        return await parseHwpxFallback(file);
      } catch {
        throw renderError;
      }
    }
  }

  throw new Error("현재 HWP, HWPX, DOCX, TXT 문서를 불러올 수 있습니다.");
}
