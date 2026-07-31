import JSZip from "jszip";

export type PackageFamily =
  | "hwpx"
  | "word"
  | "presentation"
  | "spreadsheet"
  | "odf-text"
  | "odf-spreadsheet"
  | "odf-presentation"
  | "odf-graphics"
  | "visio"
  | "xps"
  | "epub";

export const EXTENSION_FAMILY = {
  hwpx: "hwpx",
  docx: "word",
  docm: "word",
  dotx: "word",
  dotm: "word",
  pptx: "presentation",
  pptm: "presentation",
  potx: "presentation",
  potm: "presentation",
  ppsx: "presentation",
  ppsm: "presentation",
  xlsx: "spreadsheet",
  xlsm: "spreadsheet",
  xlsb: "spreadsheet",
  xltx: "spreadsheet",
  xltm: "spreadsheet",
  odt: "odf-text",
  ods: "odf-spreadsheet",
  odp: "odf-presentation",
  odg: "odf-graphics",
  ott: "odf-text",
  ots: "odf-spreadsheet",
  otp: "odf-presentation",
  otg: "odf-graphics",
  vsdx: "visio",
  vsdm: "visio",
  vssx: "visio",
  vssm: "visio",
  vstx: "visio",
  vstm: "visio",
  xps: "xps",
  oxps: "xps",
  epub: "epub",
} as const satisfies Record<string, PackageFamily>;

export type PackageKind = keyof typeof EXTENSION_FAMILY;

export const SUPPORTED_EXTENSIONS = Object.keys(EXTENSION_FAMILY) as PackageKind[];
export const SUPPORTED_FORMAT_COUNT = SUPPORTED_EXTENSIONS.length;
export const ACCEPTED_FILE_TYPES = SUPPORTED_EXTENSIONS.map((extension) => `.${extension}`).join(",");

export const SUPPORTED_FORMAT_GROUPS: ReadonlyArray<{
  label: string;
  extensions: readonly PackageKind[];
}> = [
  { label: "한글", extensions: ["hwpx"] },
  { label: "Word", extensions: ["docx", "docm", "dotx", "dotm"] },
  {
    label: "PowerPoint",
    extensions: ["pptx", "pptm", "potx", "potm", "ppsx", "ppsm"],
  },
  { label: "Excel", extensions: ["xlsx", "xlsm", "xlsb", "xltx", "xltm"] },
  {
    label: "OpenDocument",
    extensions: ["odt", "ods", "odp", "odg", "ott", "ots", "otp", "otg"],
  },
  {
    label: "Visio",
    extensions: ["vsdx", "vsdm", "vssx", "vssm", "vstx", "vstm"],
  },
  { label: "XPS", extensions: ["xps", "oxps"] },
  { label: "EPUB", extensions: ["epub"] },
];

export const KIND_LABELS = Object.fromEntries(
  SUPPORTED_EXTENSIONS.map((extension) => [extension, extension.toUpperCase()]),
) as Record<PackageKind, string>;

export function isSupportedPackageExtension(extension: string): extension is PackageKind {
  return Object.prototype.hasOwnProperty.call(EXTENSION_FAMILY, extension.toLowerCase());
}

export type ResourceCategory =
  | "image"
  | "video"
  | "audio"
  | "attachment"
  | "font"
  | "style"
  | "script"
  | "structure"
  | "other";

export type ExtractedResource = {
  id: string;
  path: string;
  name: string;
  extension: string;
  category: ResourceCategory;
  mime: string;
  size: number;
  data: Uint8Array;
  usage: string[];
};

export type ExtractionResult = {
  kind: PackageKind;
  family: PackageFamily;
  fileName: string;
  fileSize: number;
  totalSize: number;
  resources: ExtractedResource[];
};

export type ExtractionLimits = {
  maxEntryBytes?: number;
  maxTotalBytes?: number;
};

export const CATEGORY_ORDER: ResourceCategory[] = [
  "image",
  "video",
  "audio",
  "attachment",
  "font",
  "style",
  "script",
  "structure",
  "other",
];

export const CATEGORY_LABELS: Record<ResourceCategory, string> = {
  image: "이미지",
  video: "영상",
  audio: "오디오",
  attachment: "첨부 파일",
  font: "글꼴",
  style: "테마·서식",
  script: "스크립트·매크로",
  structure: "문서 구조",
  other: "기타 파일",
};

const DEFAULT_MAX_ENTRY_BYTES = 128 * 1024 * 1024;
const DEFAULT_MAX_TOTAL_BYTES = 512 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
  svg: "image/svg+xml",
  emf: "image/emf",
  wmf: "image/wmf",
  eps: "application/postscript",
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  wmv: "video/x-ms-wmv",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  flac: "audio/flac",
  ttf: "font/ttf",
  otf: "font/otf",
  odttf: "application/vnd.openxmlformats-officedocument.obfuscatedFont",
  odttc: "application/vnd.ms-package.obfuscated-opentype",
  fntdata: "application/x-fontdata",
  eot: "application/vnd.ms-fontobject",
  woff: "font/woff",
  woff2: "font/woff2",
  xml: "application/xml",
  rels: "application/vnd.openxmlformats-package.relationships+xml",
  hpf: "application/xml",
  opf: "application/oebps-package+xml",
  ncx: "application/x-dtbncx+xml",
  html: "text/html",
  htm: "text/html",
  xhtml: "application/xhtml+xml",
  css: "text/css",
  json: "application/json",
  txt: "text/plain",
  js: "text/javascript",
  mjs: "text/javascript",
  vbs: "text/vbscript",
  jxr: "image/vnd.ms-photo",
  wdp: "image/vnd.ms-photo",
  fpage: "application/vnd.ms-package.xps-fixedpage+xml",
  fdoc: "application/vnd.ms-package.xps-fixeddocument+xml",
  fdseq: "application/vnd.ms-package.xps-fixeddocumentsequence+xml",
  bin: "application/octet-stream",
  dat: "application/octet-stream",
};

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "avif",
  "bmp",
  "tif",
  "tiff",
  "svg",
  "emf",
  "wmf",
  "eps",
  "jxr",
  "wdp",
]);
const VIDEO_EXTENSIONS = new Set(["mp4", "m4v", "mov", "avi", "wmv", "webm"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "aac", "ogg", "flac"]);
const FONT_EXTENSIONS = new Set([
  "ttf",
  "otf",
  "odttf",
  "odttc",
  "fntdata",
  "eot",
  "woff",
  "woff2",
]);
const SCRIPT_EXTENSIONS = new Set(["js", "mjs", "vbs", "vba", "exe", "dll", "ocx", "com"]);
const PREVIEWABLE_IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "avif",
  "bmp",
]);

const ODF_MIME_FAMILY: Record<string, PackageFamily> = {
  "application/vnd.oasis.opendocument.text": "odf-text",
  "application/vnd.oasis.opendocument.text-template": "odf-text",
  "application/vnd.oasis.opendocument.spreadsheet": "odf-spreadsheet",
  "application/vnd.oasis.opendocument.spreadsheet-template": "odf-spreadsheet",
  "application/vnd.oasis.opendocument.presentation": "odf-presentation",
  "application/vnd.oasis.opendocument.presentation-template": "odf-presentation",
  "application/vnd.oasis.opendocument.graphics": "odf-graphics",
  "application/vnd.oasis.opendocument.graphics-template": "odf-graphics",
};

export class PackageExtractionError extends Error {
  code:
    | "UNSUPPORTED_EXTENSION"
    | "INVALID_PACKAGE"
    | "PROTECTED_PACKAGE"
    | "FORMAT_MISMATCH"
    | "ENTRY_TOO_LARGE"
    | "PACKAGE_TOO_LARGE"
    | "EMPTY_PACKAGE";

  constructor(code: PackageExtractionError["code"], message: string) {
    super(message);
    this.name = "PackageExtractionError";
    this.code = code;
  }
}

function extensionOf(path: string) {
  const name = path.split("/").pop() ?? path;
  const dot = name.lastIndexOf(".");
  return dot > -1 ? name.slice(dot + 1).toLowerCase() : "";
}

function normalizePackagePath(path: string) {
  const segments: string[] = [];
  for (const segment of path.replaceAll("\\", "/").split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      segments.pop();
      continue;
    }
    segments.push(segment.replace(/[\u0000-\u001f\u007f]/g, ""));
  }
  return segments.join("/");
}

function fileNameOf(path: string) {
  return path.split("/").pop() || path;
}

function categoryFor(path: string, extension: string, mime = ""): ResourceCategory {
  const lowerPath = path.toLowerCase();
  const lowerMime = mime.toLowerCase();

  if (
    SCRIPT_EXTENSIONS.has(extension) ||
    /(^|\/)(scripts?|macros?|activex|customui|basic|dialogs?)(\/|$)/.test(lowerPath) ||
    /vbaproject|vbadata/.test(lowerPath) ||
    /vba|activex|javascript|vbscript/.test(lowerMime)
  ) {
    return "script";
  }
  if (IMAGE_EXTENSIONS.has(extension) || lowerMime.startsWith("image/")) return "image";
  if (VIDEO_EXTENSIONS.has(extension) || lowerMime.startsWith("video/")) return "video";
  if (AUDIO_EXTENSIONS.has(extension) || lowerMime.startsWith("audio/")) return "audio";
  if (FONT_EXTENSIONS.has(extension) || /(^|\/)fonts?(\/|$)/.test(lowerPath)) return "font";

  if (
    /(^|\/)(embeddings?|attachments?|ole|objects?|charts?|diagrams?)(\/|$)/.test(lowerPath) ||
    /oleobject|embeddedobject/.test(lowerPath) ||
    lowerPath.startsWith("bindata/")
  ) {
    return "attachment";
  }

  if (
    /(^|\/)(theme|themes|styles?|layouts?|slidemasters?|slidelayouts?|masters?|numbering)(\/|$)/.test(
      lowerPath,
    ) ||
    /(^|\/)(styles|settings|numbering|fonttable)\.(?:xml|bin)$/.test(lowerPath) ||
    extension === "css"
  ) {
    return "style";
  }

  if (
    ["xml", "rels", "hpf", "opf", "ncx", "html", "htm", "xhtml", "fpage", "fdoc", "fdseq"].includes(
      extension,
    ) ||
    lowerPath === "mimetype" ||
    lowerPath === "[content_types].xml"
  ) {
    return "structure";
  }

  return "other";
}

function packageFamilyFromPaths(paths: Set<string>, mimetype: string): PackageFamily | null {
  const lowerPaths = new Set(Array.from(paths, (path) => path.toLowerCase()));
  const normalizedMime = mimetype.trim().toLowerCase();

  if (
    normalizedMime === "application/hwp+zip" &&
    lowerPaths.has("contents/content.hpf") &&
    lowerPaths.has("contents/header.xml") &&
    Array.from(lowerPaths).some((path) => /^contents\/section\d+\.xml$/.test(path))
  ) {
    return "hwpx";
  }

  if (
    normalizedMime === "application/epub+zip" &&
    lowerPaths.has("meta-inf/container.xml") &&
    Array.from(lowerPaths).some((path) => path.endsWith(".opf"))
  ) {
    return "epub";
  }

  const odfFamily = ODF_MIME_FAMILY[normalizedMime];
  if (
    odfFamily &&
    lowerPaths.has("meta-inf/manifest.xml") &&
    lowerPaths.has("content.xml")
  ) {
    return odfFamily;
  }

  const hasOpcEnvelope = lowerPaths.has("[content_types].xml") && lowerPaths.has("_rels/.rels");
  if (!hasOpcEnvelope) return null;
  if (lowerPaths.has("word/document.xml")) return "word";
  if (lowerPaths.has("ppt/presentation.xml")) return "presentation";
  if (lowerPaths.has("xl/workbook.xml") || lowerPaths.has("xl/workbook.bin")) return "spreadsheet";
  if (lowerPaths.has("visio/document.xml")) return "visio";
  if (Array.from(lowerPaths).some((path) => path.endsWith(".fdseq"))) return "xps";
  return null;
}

function decodeXmlEntities(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function attributeOf(source: string, name: string) {
  const escapedName = escapeRegExp(name);
  const qualifiedName = name.includes(":") ? escapedName : `(?:[\\w-]+:)?${escapedName}`;
  const match = source.match(
    new RegExp(`(?:^|\\s)${qualifiedName}\\s*=\\s*(["'])(.*?)\\1`, "i"),
  );
  return match ? decodeXmlEntities(match[2]) : "";
}

function relationshipSource(relsPath: string) {
  const normalized = normalizePackagePath(relsPath);
  if (normalized.toLowerCase() === "_rels/.rels") return "";
  const marker = "/_rels/";
  const markerIndex = normalized.toLowerCase().lastIndexOf(marker);
  if (markerIndex < 0 || !normalized.toLowerCase().endsWith(".rels")) return null;
  const prefix = normalized.slice(0, markerIndex);
  const file = normalized.slice(markerIndex + marker.length, -5);
  return [prefix, file].filter(Boolean).join("/");
}

function resolveTarget(sourcePath: string, target: string) {
  const cleanTarget = target.replaceAll("\\", "/");
  if (cleanTarget.startsWith("/")) return normalizePackagePath(cleanTarget);
  const sourceParts = sourcePath ? sourcePath.split("/") : [];
  if (sourceParts.length) sourceParts.pop();
  return normalizePackagePath([...sourceParts, cleanTarget].join("/"));
}

function setDeclaredMime(
  overrides: Map<string, string>,
  canonicalPaths: Set<string>,
  manifestPath: string,
  declaredPath: string,
  mime: string,
) {
  if (!declaredPath || !mime || declaredPath === "/") return;
  const directPath = normalizePackagePath(declaredPath);
  const relativePath = resolveTarget(manifestPath, declaredPath);
  const selectedPath = canonicalPaths.has(directPath.toLowerCase()) ? directPath : relativePath;
  if (selectedPath) overrides.set(selectedPath.toLowerCase(), mime);
}

function applyDeclaredMimeTypes(
  resources: ExtractedResource[],
  textByPath: Map<string, string>,
) {
  const defaults = new Map<string, string>();
  const overrides = new Map<string, string>();
  const canonicalPaths = new Set(resources.map((resource) => resource.path.toLowerCase()));
  const contentTypes = Array.from(textByPath.entries()).find(
    ([path]) => path.toLowerCase() === "[content_types].xml",
  );

  if (contentTypes) {
    const defaultPattern = /<(?:[\w-]+:)?Default\b([^>]*?)\/?\s*>/gi;
    for (const match of contentTypes[1].matchAll(defaultPattern)) {
      const extension = attributeOf(match[1], "Extension").toLowerCase();
      const mime = attributeOf(match[1], "ContentType");
      if (extension && mime) defaults.set(extension, mime);
    }
    const overridePattern = /<(?:[\w-]+:)?Override\b([^>]*?)\/?\s*>/gi;
    for (const match of contentTypes[1].matchAll(overridePattern)) {
      const partName = normalizePackagePath(attributeOf(match[1], "PartName"));
      const mime = attributeOf(match[1], "ContentType");
      if (partName && mime) overrides.set(partName.toLowerCase(), mime);
    }
  }

  for (const [manifestPath, text] of textByPath) {
    const lowerPath = manifestPath.toLowerCase();
    if (lowerPath === "contents/content.hpf" || lowerPath.endsWith(".opf")) {
      const itemPattern = /<(?:[\w-]+:)?item\b([^>]*?)\/?\s*>/gi;
      for (const match of text.matchAll(itemPattern)) {
        setDeclaredMime(
          overrides,
          canonicalPaths,
          manifestPath,
          attributeOf(match[1], "href"),
          attributeOf(match[1], "media-type"),
        );
      }
    }

    if (lowerPath === "meta-inf/manifest.xml") {
      const entryPattern = /<(?:[\w-]+:)?file-entry\b([^>]*?)\/?\s*>/gi;
      for (const match of text.matchAll(entryPattern)) {
        setDeclaredMime(
          overrides,
          canonicalPaths,
          manifestPath,
          attributeOf(match[1], "full-path"),
          attributeOf(match[1], "media-type"),
        );
      }
    }
  }

  for (const resource of resources) {
    resource.mime =
      overrides.get(resource.path.toLowerCase()) ??
      defaults.get(resource.extension) ??
      resource.mime;
    resource.category = categoryFor(resource.path, resource.extension, resource.mime);
  }
}

function declaredSize(entry: unknown) {
  const candidate = entry as { _data?: { uncompressedSize?: number } };
  const value = candidate._data?.uncompressedSize;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function usageLabel(family: PackageFamily, sourcePath: string) {
  const lower = sourcePath.toLowerCase();
  let match: RegExpMatchArray | null;

  if (family === "presentation") {
    match = lower.match(/^ppt\/slides\/slide(\d+)\.xml$/);
    if (match) return `슬라이드 ${Number(match[1])}`;
    match = lower.match(/^ppt\/slidemasters\/slidemaster(\d+)\.xml$/);
    if (match) return `마스터 ${Number(match[1])}`;
    match = lower.match(/^ppt\/slidelayouts\/slidelayout(\d+)\.xml$/);
    if (match) return `레이아웃 ${Number(match[1])}`;
    if (lower === "ppt/presentation.xml") return "프레젠테이션";
  }

  if (family === "word") {
    if (lower === "word/document.xml") return "본문";
    match = lower.match(/^word\/header(\d+)\.xml$/);
    if (match) return `머리말 ${Number(match[1])}`;
    match = lower.match(/^word\/footer(\d+)\.xml$/);
    if (match) return `바닥글 ${Number(match[1])}`;
    if (lower === "word/footnotes.xml") return "각주";
    if (lower === "word/endnotes.xml") return "미주";
    if (lower === "word/comments.xml") return "메모";
  }

  if (family === "spreadsheet") {
    match = lower.match(/^xl\/worksheets\/sheet(\d+)\.(?:xml|bin)$/);
    if (match) return `시트 ${Number(match[1])}`;
    match = lower.match(/^xl\/chartsheets\/sheet(\d+)\.xml$/);
    if (match) return `차트 시트 ${Number(match[1])}`;
    if (lower === "xl/workbook.xml" || lower === "xl/workbook.bin") return "통합 문서";
  }

  if (family === "visio") {
    match = lower.match(/^visio\/pages\/page(\d+)\.xml$/);
    if (match) return `페이지 ${Number(match[1])}`;
    if (lower === "visio/document.xml") return "다이어그램";
  }

  if (family === "xps") {
    match = lower.match(/(?:^|\/)(?:page)?(\d+)\.fpage$/);
    if (match) return `페이지 ${Number(match[1])}`;
    if (lower.endsWith(".fdseq")) return "문서 묶음";
    if (lower.endsWith(".fdoc")) return "문서";
  }

  if (family === "hwpx") {
    match = lower.match(/^contents\/section(\d+)\.xml$/);
    if (match) return `본문 ${Number(match[1]) + 1}`;
  }

  if (family.startsWith("odf-")) {
    if (lower === "content.xml" || lower.endsWith("/content.xml")) return "본문";
    if (lower === "styles.xml" || lower.endsWith("/styles.xml")) return "스타일";
  }

  if (family === "epub") {
    if (["html", "htm", "xhtml"].includes(extensionOf(lower))) {
      return `본문 · ${fileNameOf(sourcePath)}`;
    }
    if (lower.endsWith(".opf")) return "전자책 구성";
    if (lower.endsWith(".ncx") || /(?:^|\/)nav\.xhtml$/.test(lower)) return "목차";
  }

  return null;
}

function buildUsageMap(
  family: PackageFamily,
  resources: ExtractedResource[],
  textByPath: Map<string, string>,
) {
  const canonicalPath = new Map(resources.map((resource) => [resource.path.toLowerCase(), resource.path]));
  const parentSources = new Map<string, Set<string>>();
  const usage = new Map<string, Set<string>>();

  const addUsage = (path: string, label: string) => {
    const actualPath = canonicalPath.get(path.toLowerCase());
    if (!actualPath) return;
    const labels = usage.get(actualPath) ?? new Set<string>();
    labels.add(label);
    usage.set(actualPath, labels);
  };

  for (const [path, text] of textByPath) {
    if (!path.toLowerCase().endsWith(".rels")) continue;
    const sourcePath = relationshipSource(path);
    if (sourcePath === null) continue;
    const relationshipPattern = /<(?:[\w-]+:)?Relationship\b([^>]*?)\/?\s*>/gi;
    for (const match of text.matchAll(relationshipPattern)) {
      const attributes = match[1];
      if (attributeOf(attributes, "TargetMode").toLowerCase() === "external") continue;
      const target = attributeOf(attributes, "Target");
      if (!target) continue;
      const targetPath = resolveTarget(sourcePath, target).toLowerCase();
      const parents = parentSources.get(targetPath) ?? new Set<string>();
      parents.add(sourcePath.toLowerCase());
      parentSources.set(targetPath, parents);
    }
  }

  for (const resource of resources) {
    const queue = [resource.path.toLowerCase()];
    const visited = new Set<string>();
    while (queue.length) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      for (const source of parentSources.get(current) ?? []) {
        const label = usageLabel(family, canonicalPath.get(source) ?? source);
        if (label) addUsage(resource.path, label);
        if (!visited.has(source)) queue.push(source);
      }
    }
  }

  if (family === "hwpx") {
    const manifestEntry = Array.from(textByPath.entries()).find(
      ([path]) => path.toLowerCase() === "contents/content.hpf",
    );
    if (manifestEntry) {
      const itemPattern = /<(?:[\w-]+:)?item\b([^>]*?)\/?\s*>/gi;
      for (const match of manifestEntry[1].matchAll(itemPattern)) {
        const id = attributeOf(match[1], "id");
        const href = attributeOf(match[1], "href");
        if (!id || !href) continue;
        const directPath = normalizePackagePath(href);
        const relativePath = resolveTarget(manifestEntry[0], href);
        const assetPath = canonicalPath.has(directPath.toLowerCase()) ? directPath : relativePath;
        for (const [sectionPath, sectionText] of textByPath) {
          if (!/^contents\/section\d+\.xml$/i.test(sectionPath)) continue;
          if (sectionText.includes(id)) {
            const label = usageLabel(family, sectionPath);
            if (label) addUsage(assetPath, label);
          }
        }
      }
    }
  }

  if (family.startsWith("odf-") || family === "epub") {
    const referenceSources = Array.from(textByPath.entries()).filter(([path]) => {
      const lower = path.toLowerCase();
      return family === "epub"
        ? ["html", "htm", "xhtml"].includes(extensionOf(lower))
        : lower === "content.xml" || lower.endsWith("/content.xml");
    });
    for (const resource of resources) {
      if (["structure", "style"].includes(resource.category)) continue;
      for (const [sourcePath, sourceText] of referenceSources) {
        const relativeTarget = resolveTarget(sourcePath, resource.name);
        const referenced =
          sourceText.includes(resource.path) ||
          sourceText.includes(relativeTarget) ||
          sourceText.includes(resource.name);
        if (!referenced) continue;
        const label = usageLabel(family, sourcePath);
        if (label) addUsage(resource.path, label);
      }
    }
  }

  return usage;
}

export function isInlinePreviewSupported(resource: ExtractedResource) {
  if (resource.category === "image") {
    return (
      PREVIEWABLE_IMAGE_EXTENSIONS.has(resource.extension) ||
      ["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "image/bmp"].includes(
        resource.mime,
      )
    );
  }
  if (resource.category === "video") {
    return (
      ["mp4", "m4v", "webm"].includes(resource.extension) ||
      ["video/mp4", "video/webm"].includes(resource.mime)
    );
  }
  if (resource.category === "audio") {
    return (
      ["mp3", "wav", "m4a", "aac", "ogg", "flac"].includes(resource.extension) ||
      ["audio/mpeg", "audio/wav", "audio/mp4", "audio/aac", "audio/ogg", "audio/flac"].includes(
        resource.mime,
      )
    );
  }
  return false;
}

export async function extractDocumentPackage(
  data: ArrayBuffer,
  fileName: string,
  limits: ExtractionLimits = {},
): Promise<ExtractionResult> {
  const extension = extensionOf(fileName);
  if (!isSupportedPackageExtension(extension)) {
    throw new PackageExtractionError("UNSUPPORTED_EXTENSION", "지원하지 않는 파일 형식");
  }
  const expectedKind = extension;
  const expectedFamily = EXTENSION_FAMILY[expectedKind];

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data, { checkCRC32: false });
  } catch {
    throw new PackageExtractionError("INVALID_PACKAGE", "손상되었거나 올바르지 않은 문서 패키지");
  }

  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  if (!entries.length) {
    throw new PackageExtractionError("EMPTY_PACKAGE", "비어 있는 문서 패키지");
  }

  const maxEntryBytes = limits.maxEntryBytes ?? DEFAULT_MAX_ENTRY_BYTES;
  const maxTotalBytes = limits.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES;
  let declaredTotal = 0;
  for (const entry of entries) {
    const size = declaredSize(entry);
    if (size === null) continue;
    if (size > maxEntryBytes) {
      throw new PackageExtractionError("ENTRY_TOO_LARGE", "대용량 내부 파일");
    }
    declaredTotal += size;
    if (declaredTotal > maxTotalBytes) {
      throw new PackageExtractionError("PACKAGE_TOO_LARGE", "대용량 문서 패키지");
    }
  }

  const normalizedPaths = new Set(entries.map((entry) => normalizePackagePath(entry.name)));
  const mimetypeEntry = entries.find(
    (entry) => normalizePackagePath(entry.name).toLowerCase() === "mimetype",
  );
  const mimetype = mimetypeEntry ? (await mimetypeEntry.async("string")).trim() : "";
  if (Array.from(normalizedPaths).some((path) => path.toLowerCase() === "meta-inf/encryption.xml")) {
    throw new PackageExtractionError("PROTECTED_PACKAGE", "암호화·DRM 문서 미지원");
  }
  const odfManifestEntry = entries.find(
    (entry) => normalizePackagePath(entry.name).toLowerCase() === "meta-inf/manifest.xml",
  );
  if (odfManifestEntry) {
    const manifestText = await odfManifestEntry.async("string");
    if (/<(?:[\w-]+:)?encryption-data\b/i.test(manifestText)) {
      throw new PackageExtractionError("PROTECTED_PACKAGE", "암호화·DRM 문서 미지원");
    }
  }
  const detectedFamily = packageFamilyFromPaths(normalizedPaths, mimetype);
  if (!detectedFamily) {
    throw new PackageExtractionError("INVALID_PACKAGE", "지원 문서 구조 없음");
  }
  if (detectedFamily !== expectedFamily) {
    throw new PackageExtractionError("FORMAT_MISMATCH", "확장자와 문서 구조 불일치");
  }

  const resources: ExtractedResource[] = [];
  const textByPath = new Map<string, string>();
  let totalSize = 0;

  for (const [index, entry] of entries.entries()) {
    const path = normalizePackagePath(entry.name) || `resource-${index + 1}`;
    const bytes = Uint8Array.from(await entry.async("uint8array"));
    if (bytes.byteLength > maxEntryBytes) {
      throw new PackageExtractionError("ENTRY_TOO_LARGE", "대용량 내부 파일");
    }
    totalSize += bytes.byteLength;
    if (totalSize > maxTotalBytes) {
      throw new PackageExtractionError("PACKAGE_TOO_LARGE", "대용량 문서 패키지");
    }

    const resourceExtension = extensionOf(path);
    const category = categoryFor(path, resourceExtension);
    resources.push({
      id: `${index}-${path}`,
      path,
      name: fileNameOf(path),
      extension: resourceExtension,
      category,
      mime: MIME_BY_EXTENSION[resourceExtension] ?? "application/octet-stream",
      size: bytes.byteLength,
      data: bytes,
      usage: [],
    });

    if (
      (category === "structure" || category === "style") &&
      bytes.byteLength <= 8 * 1024 * 1024
    ) {
      textByPath.set(path, new TextDecoder("utf-8").decode(bytes));
    }
  }

  applyDeclaredMimeTypes(resources, textByPath);
  const usageMap = buildUsageMap(detectedFamily, resources, textByPath);
  for (const resource of resources) {
    resource.usage = Array.from(usageMap.get(resource.path) ?? []).sort((a, b) =>
      a.localeCompare(b, "ko", { numeric: true }),
    );
  }

  resources.sort((a, b) => {
    const categoryDifference = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    return categoryDifference || a.path.localeCompare(b.path, "ko", { numeric: true });
  });

  return {
    kind: expectedKind,
    family: detectedFamily,
    fileName,
    fileSize: data.byteLength,
    totalSize,
    resources,
  };
}
