import JSZip from "jszip";

export type PackageKind = "hwpx" | "pptx" | "docx";

export type ResourceCategory =
  | "image"
  | "video"
  | "audio"
  | "attachment"
  | "font"
  | "style"
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
  structure: "문서 구조",
  other: "기타 파일",
};

export const KIND_LABELS: Record<PackageKind, string> = {
  hwpx: "HWPX",
  pptx: "PPTX",
  docx: "DOCX",
};

const SUPPORTED_EXTENSIONS = new Set<PackageKind>(["hwpx", "pptx", "docx"]);
const DEFAULT_MAX_ENTRY_BYTES = 128 * 1024 * 1024;
const DEFAULT_MAX_TOTAL_BYTES = 512 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
  svg: "image/svg+xml",
  emf: "image/emf",
  wmf: "image/wmf",
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
  woff: "font/woff",
  woff2: "font/woff2",
  xml: "application/xml",
  rels: "application/vnd.openxmlformats-package.relationships+xml",
  json: "application/json",
  txt: "text/plain",
  css: "text/css",
  bin: "application/octet-stream",
  dat: "application/octet-stream",
  hpf: "application/xml",
};

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "tif",
  "tiff",
  "svg",
  "emf",
  "wmf",
]);
const VIDEO_EXTENSIONS = new Set(["mp4", "m4v", "mov", "avi", "wmv", "webm"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "aac", "ogg", "flac"]);
const FONT_EXTENSIONS = new Set(["ttf", "otf", "woff", "woff2"]);
const PREVIEWABLE_IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp"]);

export class PackageExtractionError extends Error {
  code:
    | "UNSUPPORTED_EXTENSION"
    | "INVALID_PACKAGE"
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

  if (IMAGE_EXTENSIONS.has(extension) || mime.startsWith("image/")) return "image";
  if (VIDEO_EXTENSIONS.has(extension) || mime.startsWith("video/")) return "video";
  if (AUDIO_EXTENSIONS.has(extension) || mime.startsWith("audio/")) return "audio";
  if (FONT_EXTENSIONS.has(extension) || /(^|\/)fonts?\//.test(lowerPath)) return "font";

  if (
    /(^|\/)(embeddings?|attachments?|ole|objects?)(\/|$)/.test(lowerPath) ||
    /oleobject|embeddedobject/.test(lowerPath) ||
    lowerPath.startsWith("bindata/")
  ) {
    return "attachment";
  }

  if (
    /(^|\/)(theme|themes|styles?|layouts?|slidemasters?|slidelayouts?|masters?|numbering)(\/|$)/.test(
      lowerPath,
    ) ||
    /(^|\/)(styles|settings|numbering|fonttable)\.xml$/.test(lowerPath)
  ) {
    return "style";
  }

  if (
    extension === "xml" ||
    extension === "rels" ||
    extension === "hpf" ||
    lowerPath === "mimetype" ||
    lowerPath === "[content_types].xml"
  ) {
    return "structure";
  }

  return "other";
}

function packageKindFromPaths(paths: Set<string>, mimetype: string): PackageKind | null {
  const lowerPaths = new Set(Array.from(paths, (path) => path.toLowerCase()));
  const hasOoxmlEnvelope =
    lowerPaths.has("[content_types].xml") && lowerPaths.has("_rels/.rels");
  if (hasOoxmlEnvelope && lowerPaths.has("word/document.xml")) return "docx";
  if (hasOoxmlEnvelope && lowerPaths.has("ppt/presentation.xml")) return "pptx";
  if (
    mimetype.trim() === "application/hwp+zip" &&
    lowerPaths.has("contents/content.hpf") &&
    lowerPaths.has("contents/header.xml") &&
    Array.from(lowerPaths).some((path) => /^contents\/section\d+\.xml$/.test(path))
  ) {
    return "hwpx";
  }
  return null;
}

function applyDeclaredMimeTypes(
  resources: ExtractedResource[],
  textByPath: Map<string, string>,
) {
  const defaults = new Map<string, string>();
  const overrides = new Map<string, string>();
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

  const manifest = Array.from(textByPath.entries()).find(
    ([path]) => path.toLowerCase() === "contents/content.hpf",
  );
  if (manifest) {
    const itemPattern = /<(?:[\w-]+:)?item\b([^>]*?)\/?\s*>/gi;
    for (const match of manifest[1].matchAll(itemPattern)) {
      const href = normalizePackagePath(attributeOf(match[1], "href"));
      const mime = attributeOf(match[1], "media-type");
      if (href && mime) overrides.set(href.toLowerCase(), mime);
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
  const candidate = entry as {
    _data?: { uncompressedSize?: number };
  };
  const value = candidate._data?.uncompressedSize;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function decodeXmlEntities(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function attributeOf(source: string, name: string) {
  const match = source.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match ? decodeXmlEntities(match[2]) : "";
}

function relationshipSource(relsPath: string) {
  const normalized = normalizePackagePath(relsPath);
  const marker = "/_rels/";
  const markerIndex = normalized.lastIndexOf(marker);
  if (markerIndex < 0 || !normalized.toLowerCase().endsWith(".rels")) return "";
  const prefix = normalized.slice(0, markerIndex);
  const file = normalized.slice(markerIndex + marker.length, -5);
  return [prefix, file].filter(Boolean).join("/");
}

function resolveTarget(sourcePath: string, target: string) {
  const cleanTarget = target.replaceAll("\\", "/");
  if (cleanTarget.startsWith("/")) return normalizePackagePath(cleanTarget);
  const sourceParts = sourcePath.split("/");
  sourceParts.pop();
  return normalizePackagePath([...sourceParts, cleanTarget].join("/"));
}

function usageLabel(kind: PackageKind, sourcePath: string) {
  const lower = sourcePath.toLowerCase();
  let match: RegExpMatchArray | null;

  if (kind === "pptx") {
    match = lower.match(/^ppt\/slides\/slide(\d+)\.xml$/);
    if (match) return `슬라이드 ${Number(match[1])}`;
    match = lower.match(/^ppt\/slidemasters\/slidemaster(\d+)\.xml$/);
    if (match) return `마스터 ${Number(match[1])}`;
    match = lower.match(/^ppt\/slidelayouts\/slidelayout(\d+)\.xml$/);
    if (match) return `레이아웃 ${Number(match[1])}`;
    if (lower === "ppt/presentation.xml") return "프레젠테이션";
  }

  if (kind === "docx") {
    if (lower === "word/document.xml") return "본문";
    match = lower.match(/^word\/header(\d+)\.xml$/);
    if (match) return `머리말 ${Number(match[1])}`;
    match = lower.match(/^word\/footer(\d+)\.xml$/);
    if (match) return `바닥글 ${Number(match[1])}`;
    if (lower === "word/footnotes.xml") return "각주";
    if (lower === "word/endnotes.xml") return "미주";
    if (lower === "word/comments.xml") return "메모";
  }

  if (kind === "hwpx") {
    match = lower.match(/^contents\/section(\d+)\.xml$/);
    if (match) return `본문 ${Number(match[1]) + 1}`;
  }

  return "문서 구성";
}

function buildUsageMap(
  kind: PackageKind,
  resources: ExtractedResource[],
  textByPath: Map<string, string>,
) {
  const canonicalPath = new Map(resources.map((resource) => [resource.path.toLowerCase(), resource.path]));
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
    if (!sourcePath) continue;
    const relationshipPattern = /<(?:[\w-]+:)?Relationship\b([^>]*?)\/?\s*>/gi;
    for (const match of text.matchAll(relationshipPattern)) {
      const attributes = match[1];
      if (attributeOf(attributes, "TargetMode").toLowerCase() === "external") continue;
      const target = attributeOf(attributes, "Target");
      if (!target) continue;
      addUsage(resolveTarget(sourcePath, target), usageLabel(kind, sourcePath));
    }
  }

  if (kind === "hwpx") {
    const manifestEntry = Array.from(textByPath.entries()).find(
      ([path]) => path.toLowerCase() === "contents/content.hpf",
    );
    if (manifestEntry) {
      const itemPattern = /<(?:[\w-]+:)?item\b([^>]*?)\/?\s*>/gi;
      for (const match of manifestEntry[1].matchAll(itemPattern)) {
        const attributes = match[1];
        const id = attributeOf(attributes, "id");
        const href = attributeOf(attributes, "href");
        if (!id || !href) continue;
        const directPath = normalizePackagePath(href);
        const relativePath = resolveTarget(manifestEntry[0], href);
        const assetPath = canonicalPath.get(directPath.toLowerCase())
          ? directPath
          : relativePath;
        for (const [sectionPath, sectionText] of textByPath) {
          if (!/^contents\/section\d+\.xml$/i.test(sectionPath)) continue;
          if (sectionText.includes(id)) addUsage(assetPath, usageLabel(kind, sectionPath));
        }
      }
    }
  }

  return usage;
}

export function isInlinePreviewSupported(resource: ExtractedResource) {
  if (resource.category === "image") {
    return (
      PREVIEWABLE_IMAGE_EXTENSIONS.has(resource.extension) ||
      ["image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp"].includes(resource.mime)
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
  const expectedKind = extensionOf(fileName) as PackageKind;
  if (!SUPPORTED_EXTENSIONS.has(expectedKind)) {
    throw new PackageExtractionError("UNSUPPORTED_EXTENSION", "지원하지 않는 파일 형식");
  }

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

  const normalizedPaths = new Set(entries.map((entry) => normalizePackagePath(entry.name)));
  const mimetypeEntry = entries.find(
    (entry) => normalizePackagePath(entry.name).toLowerCase() === "mimetype",
  );
  const mimetype = mimetypeEntry ? (await mimetypeEntry.async("string")).trim() : "";
  const detectedKind = packageKindFromPaths(normalizedPaths, mimetype);
  if (!detectedKind) {
    throw new PackageExtractionError("INVALID_PACKAGE", "지원 문서 구조 없음");
  }
  if (detectedKind !== expectedKind) {
    throw new PackageExtractionError("FORMAT_MISMATCH", "확장자와 문서 구조 불일치");
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

    const extension = extensionOf(path);
    const category = categoryFor(path, extension);
    resources.push({
      id: `${index}-${path}`,
      path,
      name: fileNameOf(path),
      extension,
      category,
      mime: MIME_BY_EXTENSION[extension] ?? "application/octet-stream",
      size: bytes.byteLength,
      data: bytes,
      usage: [],
    });

    if (category === "structure" && bytes.byteLength <= 8 * 1024 * 1024) {
      textByPath.set(path, new TextDecoder("utf-8").decode(bytes));
    }
  }

  applyDeclaredMimeTypes(resources, textByPath);
  const usageMap = buildUsageMap(detectedKind, resources, textByPath);
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
    kind: detectedKind,
    fileName,
    fileSize: data.byteLength,
    totalSize,
    resources,
  };
}
