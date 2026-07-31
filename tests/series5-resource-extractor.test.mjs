import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import {
  EXTENSION_FAMILY,
  PackageExtractionError,
  SUPPORTED_EXTENSIONS,
  SUPPORTED_FORMAT_COUNT,
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
  <Override PartName="/xl/vbaProject.bin" ContentType="application/vnd.ms-office.vbaProject"/>
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
    "word/vbaProject.bin": Uint8Array.from([6, 7]),
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
    "ppt/activeX/activeX1.bin": Uint8Array.from([1]),
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
    "Scripts/default.js": "alert(1)",
  });
}

async function spreadsheetBuffer(binaryWorkbook = false) {
  const sheetPath = binaryWorkbook ? "xl/worksheets/sheet1.bin" : "xl/worksheets/sheet1.xml";
  const sheetRelationshipsPath = binaryWorkbook
    ? "xl/worksheets/_rels/sheet1.bin.rels"
    : "xl/worksheets/_rels/sheet1.xml.rels";
  return zipBuffer({
    "[Content_Types].xml": contentTypes,
    "_rels/.rels": rootRelationships,
    [binaryWorkbook ? "xl/workbook.bin" : "xl/workbook.xml"]: binaryWorkbook
      ? Uint8Array.from([1, 2])
      : "<workbook/>",
    [sheetPath]: binaryWorkbook ? Uint8Array.from([3, 4]) : "<worksheet/>",
    [sheetRelationshipsPath]: `<Relationships>
      <Relationship Id="rId1" Target="../drawings/drawing1.xml"/>
    </Relationships>`,
    "xl/drawings/drawing1.xml": "<drawing/>",
    "xl/drawings/_rels/drawing1.xml.rels": `<Relationships>
      <Relationship Id="rId1" Target="../media/image1.png"/>
    </Relationships>`,
    "xl/media/image1.png": Uint8Array.from([137, 80, 78, 71]),
    "xl/vbaProject.bin": Uint8Array.from([1, 2, 3]),
  });
}

const odfMimes = {
  odt: "application/vnd.oasis.opendocument.text",
  ott: "application/vnd.oasis.opendocument.text-template",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  ots: "application/vnd.oasis.opendocument.spreadsheet-template",
  odp: "application/vnd.oasis.opendocument.presentation",
  otp: "application/vnd.oasis.opendocument.presentation-template",
  odg: "application/vnd.oasis.opendocument.graphics",
  otg: "application/vnd.oasis.opendocument.graphics-template",
};

async function odfBuffer(extension) {
  const mime = odfMimes[extension];
  return zipBuffer({
    mimetype: mime,
    "META-INF/manifest.xml": `<manifest:manifest>
      <manifest:file-entry manifest:full-path="/" manifest:media-type="${mime}"/>
      <manifest:file-entry manifest:full-path="Pictures/image.bin" manifest:media-type="image/png"/>
    </manifest:manifest>`,
    "content.xml": '<office:document><draw:image xlink:href="Pictures/image.bin"/></office:document>',
    "styles.xml": "<office:styles/>",
    "Pictures/image.bin": Uint8Array.from([137, 80, 78, 71]),
    "Scripts/main.js": "alert(1)",
  });
}

async function visioBuffer() {
  return zipBuffer({
    "[Content_Types].xml": contentTypes,
    "_rels/.rels": rootRelationships,
    "visio/document.xml": "<VisioDocument/>",
    "visio/pages/page1.xml": "<PageContents/>",
    "visio/pages/_rels/page1.xml.rels": `<Relationships>
      <Relationship Id="rId1" Target="../media/image1.png"/>
    </Relationships>`,
    "visio/media/image1.png": Uint8Array.from([137, 80, 78, 71]),
    "visio/vbaProject.bin": Uint8Array.from([1, 2]),
  });
}

async function xpsBuffer() {
  return zipBuffer({
    "[Content_Types].xml": contentTypes,
    "_rels/.rels": rootRelationships,
    "FixedDocumentSequence.fdseq": "<FixedDocumentSequence/>",
    "Documents/1/FixedDocument.fdoc": "<FixedDocument/>",
    "Documents/1/Pages/Page1.fpage": "<FixedPage/>",
    "Documents/1/Pages/_rels/Page1.fpage.rels": `<Relationships>
      <Relationship Id="rId1" Target="/Resources/Images/image1.png"/>
      <Relationship Id="rId2" Target="/Resources/Fonts/font1.odttf"/>
    </Relationships>`,
    "Resources/Images/image1.png": Uint8Array.from([137, 80, 78, 71]),
    "Resources/Fonts/font1.odttf": Uint8Array.from([1, 2]),
  });
}

async function epubBuffer() {
  return zipBuffer({
    mimetype: "application/epub+zip",
    "META-INF/container.xml": '<container><rootfile full-path="OEBPS/package.opf"/></container>',
    "OEBPS/package.opf": `<package><manifest>
      <item id="chapter" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
      <item id="cover" href="images/cover.bin" media-type="image/png"/>
      <item id="script" href="scripts/app.js" media-type="text/javascript"/>
    </manifest></package>`,
    "OEBPS/chapter1.xhtml": '<html><body><img src="images/cover.bin"/></body></html>',
    "OEBPS/images/cover.bin": Uint8Array.from([137, 80, 78, 71]),
    "OEBPS/scripts/app.js": "alert(1)",
  });
}

test("지원 확장자 33종 목록", () => {
  assert.equal(SUPPORTED_FORMAT_COUNT, 33);
  assert.deepEqual(SUPPORTED_EXTENSIONS.sort(), Object.keys(EXTENSION_FAMILY).sort());
});

test("HWPX 선언 MIME·본문 연결·스크립트 격리", async () => {
  const result = await extractDocumentPackage(await hwpxBuffer(), "서식.hwpx");
  assert.equal(result.family, "hwpx");
  const image = result.resources.find((item) => item.path === "BinData/image1.bin");
  assert.equal(image?.mime, "image/png");
  assert.equal(image?.category, "image");
  assert.deepEqual(image?.usage, ["본문 1"]);
  assert.equal(image ? isInlinePreviewSupported(image) : false, true);
  assert.equal(result.resources.find((item) => item.path === "Scripts/default.js")?.category, "script");
});

test("Word 계열 4종", async () => {
  for (const extension of ["docx", "docm", "dotx", "dotm"]) {
    const result = await extractDocumentPackage(await docxBuffer(), `문서.${extension}`);
    assert.equal(result.kind, extension);
    assert.equal(result.family, "word");
    assert.deepEqual(result.resources.find((item) => item.path.endsWith("image1.png"))?.usage, ["본문"]);
    assert.equal(result.resources.find((item) => item.path.endsWith("font1.odttf"))?.category, "font");
    const macro = result.resources.find((item) => item.path.endsWith("vbaProject.bin"));
    assert.equal(macro?.category, "script");
    assert.equal(macro ? isInlinePreviewSupported(macro) : true, false);
  }
});

test("PowerPoint 계열 6종", async () => {
  for (const extension of ["pptx", "pptm", "potx", "potm", "ppsx", "ppsm"]) {
    const result = await extractDocumentPackage(await pptxBuffer(), `발표.${extension}`);
    assert.equal(result.family, "presentation");
    assert.deepEqual(result.resources.find((item) => item.path.endsWith("photo.jpg"))?.usage, ["슬라이드 1"]);
    assert.equal(result.resources.find((item) => item.path.endsWith("movie.mp4"))?.category, "video");
    assert.equal(result.resources.find((item) => item.path.endsWith("sound.mp3"))?.category, "audio");
    assert.equal(result.resources.find((item) => item.path.includes("activeX"))?.category, "script");
  }
});

test("Excel 계열 5종과 관계 체인", async () => {
  for (const extension of ["xlsx", "xlsm", "xltx", "xltm"]) {
    const result = await extractDocumentPackage(await spreadsheetBuffer(), `표.${extension}`);
    assert.equal(result.family, "spreadsheet");
    assert.deepEqual(result.resources.find((item) => item.path.endsWith("image1.png"))?.usage, ["시트 1"]);
    assert.equal(result.resources.find((item) => item.path.endsWith("vbaProject.bin"))?.category, "script");
  }
  const binary = await extractDocumentPackage(await spreadsheetBuffer(true), "표.xlsb");
  assert.equal(binary.kind, "xlsb");
  assert.deepEqual(binary.resources.find((item) => item.path.endsWith("image1.png"))?.usage, ["시트 1"]);
});

test("OpenDocument 계열 8종과 manifest MIME", async () => {
  for (const extension of Object.keys(odfMimes)) {
    const result = await extractDocumentPackage(await odfBuffer(extension), `공개문서.${extension}`);
    assert.equal(result.kind, extension);
    const image = result.resources.find((item) => item.path === "Pictures/image.bin");
    assert.equal(image?.mime, "image/png");
    assert.equal(image?.category, "image");
    assert.deepEqual(image?.usage, ["본문"]);
    assert.equal(result.resources.find((item) => item.path === "Scripts/main.js")?.category, "script");
  }
});

test("Visio 계열 6종", async () => {
  for (const extension of ["vsdx", "vsdm", "vssx", "vssm", "vstx", "vstm"]) {
    const result = await extractDocumentPackage(await visioBuffer(), `도면.${extension}`);
    assert.equal(result.family, "visio");
    assert.deepEqual(result.resources.find((item) => item.path.endsWith("image1.png"))?.usage, ["페이지 1"]);
    assert.equal(result.resources.find((item) => item.path.endsWith("vbaProject.bin"))?.category, "script");
  }
});

test("XPS 2종", async () => {
  for (const extension of ["xps", "oxps"]) {
    const result = await extractDocumentPackage(await xpsBuffer(), `고정문서.${extension}`);
    assert.equal(result.family, "xps");
    assert.deepEqual(result.resources.find((item) => item.path.endsWith("image1.png"))?.usage, ["페이지 1"]);
    assert.equal(result.resources.find((item) => item.path.endsWith("font1.odttf"))?.category, "font");
  }
});

test("EPUB 패키지·본문 연결·스크립트 격리", async () => {
  const result = await extractDocumentPackage(await epubBuffer(), "책.epub");
  assert.equal(result.family, "epub");
  const cover = result.resources.find((item) => item.path.endsWith("cover.bin"));
  assert.equal(cover?.mime, "image/png");
  assert.equal(cover?.category, "image");
  assert.deepEqual(cover?.usage, ["본문 · chapter1.xhtml"]);
  assert.equal(result.resources.find((item) => item.path.endsWith("app.js"))?.category, "script");
});

test("확장자·내부 구조 불일치 거부", async () => {
  await assert.rejects(
    async () => extractDocumentPackage(await docxBuffer(), "위장문서.pptx"),
    (error) => error instanceof PackageExtractionError && error.code === "FORMAT_MISMATCH",
  );
  await assert.rejects(
    async () => extractDocumentPackage(await odfBuffer("odt"), "위장문서.ods"),
    (error) => error instanceof PackageExtractionError && error.code === "FORMAT_MISMATCH",
  );
});

test("구형 문서·일반 ZIP·손상 파일 거부", async () => {
  await assert.rejects(
    async () => extractDocumentPackage(await zipBuffer({ "readme.txt": "hello" }), "일반.zip"),
    (error) => error instanceof PackageExtractionError && error.code === "UNSUPPORTED_EXTENSION",
  );
  await assert.rejects(
    async () => extractDocumentPackage(await zipBuffer({ "readme.txt": "hello" }), "구형.hwp"),
    (error) => error instanceof PackageExtractionError && error.code === "UNSUPPORTED_EXTENSION",
  );
  await assert.rejects(
    () => extractDocumentPackage(Uint8Array.from([1, 2, 3]).buffer, "손상.docx"),
    (error) => error instanceof PackageExtractionError && error.code === "INVALID_PACKAGE",
  );
});

test("ODF·EPUB 암호화 표시 거부", async () => {
  const protectedOdf = await zipBuffer({
    mimetype: odfMimes.odt,
    "META-INF/manifest.xml": `<manifest:manifest>
      <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml">
        <manifest:encryption-data/>
      </manifest:file-entry>
    </manifest:manifest>`,
    "content.xml": "<office:document/>",
  });
  await assert.rejects(
    () => extractDocumentPackage(protectedOdf, "보호문서.odt"),
    (error) => error instanceof PackageExtractionError && error.code === "PROTECTED_PACKAGE",
  );

  const protectedEpub = await zipBuffer({
    mimetype: "application/epub+zip",
    "META-INF/container.xml": '<container><rootfile full-path="OEBPS/package.opf"/></container>',
    "META-INF/encryption.xml": "<encryption/>",
    "OEBPS/package.opf": "<package/>",
  });
  await assert.rejects(
    () => extractDocumentPackage(protectedEpub, "보호책.epub"),
    (error) => error instanceof PackageExtractionError && error.code === "PROTECTED_PACKAGE",
  );
});

test("내부 파일·전체 해제 용량 제한", async () => {
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
