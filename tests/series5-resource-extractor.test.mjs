import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import {
  PackageExtractionError,
  extractDocumentPackage,
  isInlinePreviewSupported,
} from "../app/series5/resource-extractor.ts";

const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Default Extension="mp4" ContentType="video/mp4"/>
  <Default Extension="mp3" ContentType="audio/mpeg"/>
</Types>`;

const rootRelationships = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;

async function zipBuffer(entries) {
  const zip = new JSZip();
  for (const [path, data] of Object.entries(entries)) zip.file(path, data);
  return zip.generateAsync({ type: "arraybuffer" });
}

async function docxBuffer() {
  return zipBuffer({
    "[Content_Types].xml": contentTypes,
    "_rels/.rels": rootRelationships,
    "word/document.xml": "<w:document/>",
    "word/_rels/document.xml.rels": `<Relationships>
      <Relationship Id="rId1" Target="media/image1.png"/>
      <Relationship Id="rId2" Target="embeddings/data1.bin"/>
    </Relationships>`,
    "word/media/image1.png": Uint8Array.from([137, 80, 78, 71]),
    "word/embeddings/data1.bin": Uint8Array.from([1, 2, 3]),
    "word/fonts/font1.odttf": Uint8Array.from([4, 5]),
  });
}

async function pptxBuffer() {
  return zipBuffer({
    "[Content_Types].xml": contentTypes,
    "_rels/.rels": rootRelationships,
    "ppt/presentation.xml": "<p:presentation/>",
    "ppt/slides/slide1.xml": "<p:sld/>",
    "ppt/slides/_rels/slide1.xml.rels": `<Relationships>
      <Relationship Id="rId1" Target="../media/photo.jpg"/>
      <Relationship Id="rId2" Target="../media/movie.mp4"/>
      <Relationship Id="rId3" Target="../media/sound.mp3"/>
    </Relationships>`,
    "ppt/media/photo.jpg": Uint8Array.from([255, 216, 255]),
    "ppt/media/movie.mp4": Uint8Array.from([0, 0, 0, 24]),
    "ppt/media/sound.mp3": Uint8Array.from([73, 68, 51]),
    "ppt/theme/theme1.xml": "<a:theme/>",
  });
}

async function hwpxBuffer() {
  return zipBuffer({
    mimetype: "application/hwp+zip",
    "Contents/content.hpf": `<opf:package>
      <opf:item id="img1" href="BinData/image1.bin" media-type="image/png"/>
      <opf:item id="ole1" href="BinData/object1.bin" media-type="application/octet-stream"/>
    </opf:package>`,
    "Contents/header.xml": "<hh:head/>",
    "Contents/section0.xml": '<hp:img binaryItemIDRef="img1"/>',
    "BinData/image1.bin": Uint8Array.from([137, 80, 78, 71]),
    "BinData/object1.bin": Uint8Array.from([1, 2, 3, 4]),
  });
}

test("DOCX 리소스 분류와 본문 연결", async () => {
  const result = await extractDocumentPackage(await docxBuffer(), "업무보고.docx");
  assert.equal(result.kind, "docx");
  assert.equal(result.resources.find((item) => item.path.endsWith("image1.png"))?.category, "image");
  assert.deepEqual(result.resources.find((item) => item.path.endsWith("image1.png"))?.usage, ["본문"]);
  assert.equal(result.resources.find((item) => item.path.endsWith("data1.bin"))?.category, "attachment");
  assert.equal(result.resources.find((item) => item.path.endsWith("font1.odttf"))?.category, "font");
});

test("PPTX 미디어 분류와 슬라이드 연결", async () => {
  const result = await extractDocumentPackage(await pptxBuffer(), "발표자료.pptx");
  assert.equal(result.kind, "pptx");
  assert.deepEqual(result.resources.find((item) => item.path.endsWith("photo.jpg"))?.usage, ["슬라이드 1"]);
  assert.equal(result.resources.find((item) => item.path.endsWith("movie.mp4"))?.category, "video");
  assert.equal(result.resources.find((item) => item.path.endsWith("sound.mp3"))?.category, "audio");
  assert.equal(result.resources.find((item) => item.path.endsWith("theme1.xml"))?.category, "style");
});

test("HWPX 선언 MIME과 본문 연결", async () => {
  const result = await extractDocumentPackage(await hwpxBuffer(), "서식.hwpx");
  assert.equal(result.kind, "hwpx");
  const image = result.resources.find((item) => item.path === "BinData/image1.bin");
  assert.equal(image?.mime, "image/png");
  assert.equal(image?.category, "image");
  assert.deepEqual(image?.usage, ["본문 1"]);
  assert.equal(image ? isInlinePreviewSupported(image) : false, true);
  assert.equal(result.resources.find((item) => item.path === "BinData/object1.bin")?.category, "attachment");
});

test("확장자와 내부 구조 불일치 거부", async () => {
  const data = await docxBuffer();
  await assert.rejects(
    () => extractDocumentPackage(data, "위장문서.pptx"),
    (error) => error instanceof PackageExtractionError && error.code === "FORMAT_MISMATCH",
  );
});

test("일반 ZIP과 손상 파일 거부", async () => {
  const plainZip = await zipBuffer({ "readme.txt": "hello" });
  await assert.rejects(
    () => extractDocumentPackage(plainZip, "일반압축.docx"),
    (error) => error instanceof PackageExtractionError && error.code === "INVALID_PACKAGE",
  );
  await assert.rejects(
    () => extractDocumentPackage(Uint8Array.from([1, 2, 3]).buffer, "손상.docx"),
    (error) => error instanceof PackageExtractionError && error.code === "INVALID_PACKAGE",
  );
});

test("내부 파일과 전체 해제 용량 제한", async () => {
  const data = await docxBuffer();
  await assert.rejects(
    () => extractDocumentPackage(data, "대용량.docx", { maxEntryBytes: 2 }),
    (error) => error instanceof PackageExtractionError && error.code === "ENTRY_TOO_LARGE",
  );
  await assert.rejects(
    () => extractDocumentPackage(data, "대용량.docx", { maxTotalBytes: 8 }),
    (error) => error instanceof PackageExtractionError && error.code === "PACKAGE_TOO_LARGE",
  );
});
