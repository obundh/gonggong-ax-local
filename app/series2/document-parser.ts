"use client";

import JSZip from "jszip";

export type ParsedDocument = {
  name: string;
  format: "TXT" | "DOCX" | "HWPX" | "직접 입력";
  paragraphs: string[];
  bytes: number;
};

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

  return {
    name: file.name,
    format: "DOCX",
    paragraphs,
    bytes: file.size,
  };
}

async function parseHwpx(file: File): Promise<ParsedDocument> {
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

  return {
    name: file.name,
    format: "HWPX",
    paragraphs,
    bytes: file.size,
  };
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

  return {
    name: file.name,
    format: "TXT",
    paragraphs,
    bytes: file.size,
  };
}

export async function parseDocument(file: File): Promise<ParsedDocument> {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "txt") return parseTxt(file);
  if (extension === "docx") return parseDocx(file);
  if (extension === "hwpx") return parseHwpx(file);
  if (extension === "hwp") {
    throw new Error(
      "구형 HWP는 구조가 달라 현재 버전에서 직접 읽지 않습니다. 한글에서 HWPX로 저장한 뒤 불러오세요.",
    );
  }

  throw new Error("현재 TXT, DOCX, HWPX 문서를 불러올 수 있습니다.");
}
