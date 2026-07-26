/**
 * @typedef {Object} InventoryFile
 * @property {string} name
 * @property {string} relativePath
 * @property {number} size
 * @property {number} lastModified
 */

/**
 * @typedef {"PLAN"|"REQUEST"|"REVIEW"|"NOTICE"|"EXECUTION"|"MEETING"|"INSPECTION"|"PROGRESS"|"RESULT"|"SETTLEMENT"|"ACCEPTANCE"|"CONTINUOUS"|"REFERENCE"|"TEMPLATE"|"ATTACHMENT"|"UNKNOWN"} DocumentRole
 */

/**
 * @typedef {Object} FilenameDateCandidate
 * @property {string} date
 * @property {string} raw
 * @property {"filename"|"folder"} source
 * @property {"execution"|"plan"|"deadline"|"written"|"reference"|"unknown"} contextHint
 * @property {"high"|"medium"} confidence
 */

const ROLE_LABELS = {
  PLAN: "계획·착수",
  REQUEST: "요청·접수",
  REVIEW: "검토·보완",
  NOTICE: "승인·통보",
  EXECUTION: "시행·집행",
  MEETING: "회의·협의",
  INSPECTION: "점검·확인",
  PROGRESS: "진행·중간보고",
  RESULT: "결과·완료",
  SETTLEMENT: "정산",
  ACCEPTANCE: "검수·준공",
  CONTINUOUS: "상시관리",
  REFERENCE: "지침·참고",
  TEMPLATE: "서식·양식",
  ATTACHMENT: "붙임·증빙",
  UNKNOWN: "역할 미확인",
};

const MODE_LABELS = {
  PROJECT: "사업·과제",
  PERIODIC: "정기·반복 업무",
  CONTINUOUS: "상시관리 업무",
  EVENT_RESPONSE: "사건·재난 대응",
  REFERENCE_ONLY: "참고자료",
  UNKNOWN: "업무 형태 미확인",
};

const STATUS_LABELS = {
  TERMINAL_SIGNAL_FOUND: "완료 단서 있음",
  ACTIVE_SIGNAL_FOUND: "진행 단서 있음",
  PLAN_ONLY: "계획 자료만 발견",
  CONTINUOUS_MATERIAL: "상시관리 자료",
  CONFLICT: "상태 단서 충돌",
  REFERENCE_ONLY: "참고자료만 발견",
  NO_SIGNAL: "상태 미확인",
};

const SPECIFIC_BRANCH_RULES = [
  { label: "비상연락망 관리", pattern: /비상\s*연락|연락망|비상망/u },
  {
    label: "안전한국훈련",
    pattern: /안전\s*한국\s*훈련|안전한국훈련/u,
  },
  {
    label: "재난대응훈련",
    pattern: /재난.{0,6}(대응)?\s*훈련|대응\s*훈련|모의\s*훈련/u,
  },
  {
    label: "취약시설 점검",
    pattern: /취약.{0,5}시설|시설.{0,5}(안전)?\s*점검/u,
  },
  {
    label: "재난물품·자원 관리",
    pattern: /재난.{0,5}(물품|자원|장비)|비축.{0,4}(물품|자원)|방재.{0,4}(물품|장비)/u,
  },
  {
    label: "상황근무 편성",
    pattern: /상황\s*근무|비상\s*근무|재난\s*근무|근무\s*편성/u,
  },
  {
    label: "피해·상황 보고",
    pattern: /피해\s*상황|상황\s*보고|재난\s*보고|피해\s*보고/u,
  },
];

const HAZARD_RULES = [
  ["호우", /호우|집중\s*호우|침수/u],
  ["태풍", /태풍/u],
  ["폭염", /폭염|온열\s*질환/u],
  ["한파", /한파|동파/u],
  ["지진", /지진|내진/u],
  ["산불", /산불/u],
  ["대설", /대설|폭설/u],
  ["홍수", /홍수/u],
  ["가뭄", /가뭄/u],
  ["감염병", /감염병|감염\s*예방|방역/u],
];

const GENERAL_BRANCH_RULES = [
  { label: "훈련·교육", pattern: /훈련|교육|워크숍|연수/u },
  { label: "점검·현장관리", pattern: /점검|현장\s*확인|실태\s*조사/u },
  { label: "계획·매뉴얼", pattern: /종합\s*계획|기본\s*계획|매뉴얼|행동\s*요령|지침/u },
  { label: "예산·계약·정산", pattern: /예산|계약|발주|구매|지출|정산|보조금/u },
  { label: "회의·협의체 운영", pattern: /위원회|협의회|협의체|회의/u },
  { label: "통계·실적관리", pattern: /통계|실적|현황|성과/u },
  { label: "홍보·행사", pattern: /홍보|캠페인|행사/u },
  { label: "민원·신청", pattern: /민원|신청|접수/u },
  { label: "물품·자산관리", pattern: /물품|재고|자산|장비|비품/u },
  { label: "인사·복무", pattern: /인사|복무|근태|근무\s*명령/u },
];

const GENERIC_FOLDER_PATTERN =
  /^(?:\d{2,4}(?:년)?|제?\d+[장편]?|자료|문서|업무|관련|기타|참고|붙임|별첨|서식|양식|완료|최종|백업|구버전|신규|공통|전체)$/u;

const ROLE_NOISE_PATTERN =
  /(?:결과\s*보고(?:서)?|완료\s*보고(?:서)?|추진\s*계획|시행\s*계획|기본\s*계획|종합\s*계획|계획(?:서)?|검토\s*의견|중간\s*보고|진행\s*현황|상황\s*보고|회의록|회의\s*자료|점검\s*결과|점검\s*계획|정산\s*보고|정산|검수\s*조서|준공계|납품\s*확인|통보|공고|요청|접수|회신|신청|서식|양식|매뉴얼|지침|참고\s*자료|붙임|별첨|증빙)/gu;

const VERSION_PATTERN =
  /(?:최종(?:본)?|진짜\s*최종|수정(?:본)?|보완(?:본)?|검토(?:본)?|초안|사본|복사본|백업|구버전|old|copy|v(?:er)?\.?\s*\d+|\d+\s*차)(?:\s*\(\s*안\s*\))?/giu;

const EXACT_DATE_PATTERNS = [
  {
    pattern:
      /(?<!\d)((?:19|20)\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일(?!\d)/gu,
    yearGroup: 1,
    monthGroup: 2,
    dayGroup: 3,
  },
  {
    pattern:
      /(?<!\d)((?:19|20)\d{2})\s*([._-])\s*(\d{1,2})\s*\2\s*(\d{1,2})(?:\s*\.)?(?!\d)/gu,
    yearGroup: 1,
    monthGroup: 3,
    dayGroup: 4,
  },
  {
    pattern: /(?<!\d)((?:19|20)\d{2})(\d{2})(\d{2})(?!\d)/gu,
    yearGroup: 1,
    monthGroup: 2,
    dayGroup: 3,
  },
];

const DATE_CONTEXT_RULES = [
  {
    hint: "deadline",
    pattern: /마감|기한|제출|접수|신청/gu,
  },
  {
    hint: "plan",
    pattern: /계획|예정|일정|기안|추진\s*방안/gu,
  },
  {
    hint: "written",
    pattern: /작성|보고|결과|회의록/gu,
  },
  {
    hint: "reference",
    pattern: /기준|현재|현황/gu,
  },
  {
    hint: "execution",
    pattern: /시행|실시|개최|훈련|점검|행사|회의|교육|착수/gu,
  },
];

function fileExtension(name) {
  const dot = name.lastIndexOf(".");
  return dot > -1 ? name.slice(dot + 1).toUpperCase() : "파일";
}

function withoutExtension(name) {
  const dot = name.lastIndexOf(".");
  return dot > -1 ? name.slice(0, dot) : name;
}

function cleanSpacing(value) {
  return value
    .normalize("NFKC")
    .replace(/[_\-–—]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanFolderLabel(value) {
  return cleanSpacing(value)
    .replace(/^\s*(?:제\s*)?\d+[.)_\-\s]+/u, "")
    .replace(/\b(?:19|20)\d{2}(?:년)?\b/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isValidCalendarDate(year, month, day) {
  if (
    year < 1900 ||
    year > 2099 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return false;
  }
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

function isoCalendarDate(year, month, day) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(
    2,
    "0",
  )}-${String(day).padStart(2, "0")}`;
}

function dateContextHint(value, start, end) {
  let bestHint = "unknown";
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestPriority = Number.POSITIVE_INFINITY;

  DATE_CONTEXT_RULES.forEach((rule, priority) => {
    for (const match of value.matchAll(
      new RegExp(rule.pattern.source, rule.pattern.flags),
    )) {
      const matchStart = match.index ?? 0;
      const matchEnd = matchStart + match[0].length;
      const distance =
        matchEnd < start ? start - matchEnd : matchStart > end ? matchStart - end : 0;
      if (
        distance <= 16 &&
        (distance < bestDistance ||
          (distance === bestDistance && priority < bestPriority))
      ) {
        bestHint = rule.hint;
        bestDistance = distance;
        bestPriority = priority;
      }
    }
  });

  return bestHint;
}

function isExplicitDateFalsePositive(value, start, end) {
  const before = value.slice(Math.max(0, start - 24), start);
  const after = value.slice(end, Math.min(value.length, end + 12));
  const compactBefore = before.replace(/[\s_.()\[\]-]+/gu, "");

  if (
    /(?:문서|관리|접수|공고|계약|등록|사건|참조|시행)?번호$/u.test(
      compactBefore,
    )
  ) {
    return true;
  }
  if (/(?:version|ver|rev|v|버전)$/iu.test(compactBefore)) return true;
  if (
    /제$/u.test(compactBefore) &&
    /^[\s_.()\[\]-]*(?:호|번)(?:$|[\s_.()\[\]-])/u.test(after)
  ) {
    return true;
  }
  return /^[\s_.()\[\]-]*(?:호|번|차|원|건|명)(?:$|[\s_.()\[\]-])/u.test(
    after,
  );
}

function extractExactDateMatches(value, source) {
  const normalized = value.normalize("NFKC");
  const matches = [];

  for (const definition of EXACT_DATE_PATTERNS) {
    const expression = new RegExp(
      definition.pattern.source,
      definition.pattern.flags,
    );
    for (const match of normalized.matchAll(expression)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      if (
        matches.some(
          (existing) => start < existing.end && end > existing.start,
        )
      ) {
        continue;
      }

      const year = Number(match[definition.yearGroup]);
      const month = Number(match[definition.monthGroup]);
      const day = Number(match[definition.dayGroup]);
      if (
        !isValidCalendarDate(year, month, day) ||
        isExplicitDateFalsePositive(normalized, start, end)
      ) {
        continue;
      }

      matches.push({
        start,
        end,
        candidate: {
          date: isoCalendarDate(year, month, day),
          raw: match[0],
          source,
          contextHint: dateContextHint(normalized, start, end),
          confidence: source === "filename" ? "high" : "medium",
        },
      });
    }
  }

  return matches.sort((left, right) => left.start - right.start);
}

function filenameDateCandidates(file) {
  const candidates = [];
  const seenDates = new Set();
  const addMatches = (matches) => {
    for (const match of matches) {
      if (seenDates.has(match.candidate.date)) continue;
      seenDates.add(match.candidate.date);
      candidates.push(match.candidate);
    }
  };

  addMatches(extractExactDateMatches(withoutExtension(file.name), "filename"));

  const folders = file.relativePath
    .split(/[\\/]/)
    .filter(Boolean)
    .slice(0, -1)
    .reverse();
  for (const folder of folders) {
    addMatches(extractExactDateMatches(folder, "folder"));
  }

  return candidates;
}

function removeExactFilenameDates(value) {
  const matches = extractExactDateMatches(value, "filename");
  if (matches.length === 0) return value;

  let result = value;
  for (const match of [...matches].reverse()) {
    result = `${result.slice(0, match.start)} ${result.slice(match.end)}`;
  }
  return result;
}

function extractPeriods(value) {
  const years = [
    ...value.matchAll(/(?:^|[^\d])((?:19|20)\d{2})(?:년)?(?!\d)/gu),
  ].map(
    (match) => match[1],
  );
  const cycleMatch = value.match(
    /(상반기|하반기|[1-4]\s*분기|연간|월간|주간|\d{1,2}\s*월)/u,
  );
  const uniqueYears = [...new Set(years)];
  if (uniqueYears.length === 0 && !cycleMatch) return [];

  if (uniqueYears.length > 0 && cycleMatch) {
    return uniqueYears.map(
      (year) => `${year} ${cycleMatch[1].replace(/\s+/g, "")}`,
    );
  }
  return uniqueYears.length > 0
    ? uniqueYears
    : [cycleMatch[1].replace(/\s+/g, "")];
}

function extractVersionTags(value) {
  return [...value.matchAll(new RegExp(VERSION_PATTERN.source, VERSION_PATTERN.flags))]
    .map((match) => cleanSpacing(match[0]))
    .filter(Boolean);
}

/**
 * @param {string} name
 * @returns {DocumentRole}
 */
function detectRole(name) {
  const title = cleanSpacing(withoutExtension(name));

  if (/서식|양식|샘플|예시|작성\s*요령/u.test(title)) return "TEMPLATE";
  if (/붙임|별첨|증빙/u.test(title)) return "ATTACHMENT";
  if (/완료\s*예정|정산\s*계획|결과\s*보고.{0,8}(작성|제출)\s*요청/u.test(title)) {
    return "PLAN";
  }
  if (/최종\s*(?:\(\s*안\s*\)|안)\b/u.test(title)) return "REVIEW";
  if (/미완료|보류|재검토|보완|수정\s*요청/u.test(title)) return "REVIEW";
  if (/검수\s*조서|준공계|납품\s*확인|인수\s*확인/u.test(title)) {
    return "ACCEPTANCE";
  }
  if (/정산\s*(?:보고|결과|완료)|집행\s*결과/u.test(title)) {
    return "SETTLEMENT";
  }
  if (/결과\s*보고|완료\s*보고|조치\s*결과|종결|성과\s*보고/u.test(title)) {
    return "RESULT";
  }
  if (/진행\s*현황|중간\s*보고|상황\s*보고|제?\s*\d+\s*보\b/u.test(title)) {
    return "PROGRESS";
  }
  if (/회의록|회의\s*결과|협의\s*결과|간담회/u.test(title)) return "MEETING";
  if (/점검|조사|확인\s*결과|실태/u.test(title)) return "INSPECTION";
  if (/승인|통보|공고|결정|교부\s*결정/u.test(title)) return "NOTICE";
  if (/접수|신청|제출\s*요청|협조\s*요청|회신\s*요청|요청/u.test(title)) {
    return "REQUEST";
  }
  if (/검토|심사|보완|의견/u.test(title)) return "REVIEW";
  if (/시행|실시|교육|훈련|계약|발주|교부/u.test(title)) return "EXECUTION";
  if (/계획|일정|기안|착수|추진\s*방안/u.test(title)) return "PLAN";
  if (/연락망|대장|명부|재고|현황|목록|관리\s*카드/u.test(title)) {
    return "CONTINUOUS";
  }
  if (/매뉴얼|지침|기준|참고|행동\s*요령/u.test(title)) return "REFERENCE";
  return "UNKNOWN";
}

function meaningfulFolder(relativePath) {
  const parts = relativePath.split(/[\\/]/).filter(Boolean);
  const directories = parts.slice(1, -1);
  for (let index = directories.length - 1; index >= 0; index -= 1) {
    const candidate = cleanFolderLabel(directories[index]);
    if (
      candidate.length >= 2 &&
      candidate.length <= 32 &&
      !GENERIC_FOLDER_PATTERN.test(candidate)
    ) {
      return candidate;
    }
  }
  return "";
}

function classifyBranch(relativePath, name) {
  const combined = cleanSpacing(`${relativePath} ${withoutExtension(name)}`);

  for (const rule of SPECIFIC_BRANCH_RULES) {
    if (rule.pattern.test(combined)) {
      return { label: rule.label, source: "명확한 업무명" };
    }
  }

  for (const [hazard, pattern] of HAZARD_RULES) {
    if (pattern.test(combined)) {
      const action = /복구|피해|지원/u.test(combined) ? "피해·복구" : "대비·대응";
      return { label: `${hazard} ${action}`, source: "재난 유형명" };
    }
  }

  const folder = meaningfulFolder(relativePath);
  if (folder) return { label: folder, source: "하위 폴더명" };

  for (const rule of GENERAL_BRANCH_RULES) {
    if (rule.pattern.test(combined)) {
      return { label: rule.label, source: "업무 핵심어" };
    }
  }

  const core = normalizeAnalysisTitle(name);
  if (core.length >= 3 && core.length <= 26 && !/^(?:문서|자료)\s*\d*$/u.test(core)) {
    return { label: core, source: "파일명 핵심어" };
  }
  return { label: "기타·분류 필요", source: "분류 단서 부족" };
}

function normalizeAnalysisTitle(name) {
  return cleanSpacing(removeExactFilenameDates(withoutExtension(name)))
    .replace(/\b(?:19|20)\d{2}(?:년)?\b/gu, " ")
    .replace(/(?:상반기|하반기|[1-4]\s*분기|\d{1,2}\s*월)/gu, " ")
    .replace(new RegExp(VERSION_PATTERN.source, VERSION_PATTERN.flags), " ")
    .replace(new RegExp(ROLE_NOISE_PATTERN.source, ROLE_NOISE_PATTERN.flags), " ")
    .replace(/\(\s*안\s*\)|\[\s*안\s*\]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stableId(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return `branch-${(hash >>> 0).toString(36)}`;
}

function formatDate(timestamp) {
  if (!timestamp) return "날짜 정보 없음";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "날짜 정보 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function detectMode(label, files) {
  const combined = `${label} ${files.map((file) => file.name).join(" ")}`;
  const meaningfulRoles = new Set(files.map((file) => file.role));

  if (
    meaningfulRoles.size <= 2 &&
    [...meaningfulRoles].every((role) =>
      ["REFERENCE", "TEMPLATE", "ATTACHMENT"].includes(role),
    )
  ) {
    return "REFERENCE_ONLY";
  }
  if (/연락망|대장|명부|재고|현황|목록|관리\s*카드/u.test(combined)) {
    return "CONTINUOUS";
  }
  if (
    HAZARD_RULES.some(([, pattern]) => pattern.test(combined)) &&
    /대응|피해|복구|상황/u.test(combined)
  ) {
    return "EVENT_RESPONSE";
  }
  if (/훈련|점검|교육|정기|연간|분기|상반기|하반기|매월|월간/u.test(combined)) {
    return "PERIODIC";
  }
  if (files.some((file) => file.role !== "UNKNOWN")) return "PROJECT";
  return "UNKNOWN";
}

function detectStatus(mode, files) {
  const roles = new Set(files.map((file) => file.role));
  const allNames = files.map((file) => file.name).join(" ");
  const hasNegative = /미완료|보류|취소|중단|재검토/u.test(allNames);
  const hasTerminal = ["RESULT", "SETTLEMENT", "ACCEPTANCE"].some((role) =>
    roles.has(role),
  );
  const hasActive = ["REVIEW", "PROGRESS", "MEETING", "INSPECTION"].some((role) =>
    roles.has(role),
  );
  const hasPlan = ["PLAN", "REQUEST", "NOTICE", "EXECUTION"].some((role) =>
    roles.has(role),
  );

  if (hasNegative && hasTerminal) {
    return {
      code: "CONFLICT",
      evidence: "완료 관련 파일명과 미완료·보완 관련 파일명이 함께 발견됐습니다.",
    };
  }
  if (mode === "REFERENCE_ONLY") {
    return {
      code: "REFERENCE_ONLY",
      evidence: "서식·지침·참고자료 파일명만 발견됐습니다.",
    };
  }
  if (mode === "CONTINUOUS") {
    return {
      code: "CONTINUOUS_MATERIAL",
      evidence: "연락망·대장·현황 등 계속 관리하는 자료명이 발견됐습니다.",
    };
  }
  if (hasTerminal) {
    return {
      code: "TERMINAL_SIGNAL_FOUND",
      evidence: "결과·정산·검수 등 마무리 단계의 파일명이 발견됐습니다.",
    };
  }
  if (hasNegative || hasActive) {
    return {
      code: "ACTIVE_SIGNAL_FOUND",
      evidence: "검토·보완·중간보고 등 진행 단계의 파일명이 발견됐습니다.",
    };
  }
  if (hasPlan) {
    return {
      code: "PLAN_ONLY",
      evidence: "계획·요청·시행 관련 파일명은 있지만 결과 단서는 찾지 못했습니다.",
    };
  }
  return {
    code: "NO_SIGNAL",
    evidence: "파일명만으로 진행 단계를 판단할 표현을 찾지 못했습니다.",
  };
}

function confidenceForBranch(sourceCounts, files, statusCode) {
  const explicit = sourceCounts["명확한 업무명"] ?? 0;
  const folder = sourceCounts["하위 폴더명"] ?? 0;
  const periods = new Set(files.flatMap((file) => file.periods));
  const hasPair =
    files.some((file) => file.role === "PLAN") &&
    files.some((file) =>
      ["RESULT", "SETTLEMENT", "ACCEPTANCE"].includes(file.role),
    );

  if ((explicit >= 2 || folder >= 2) && hasPair && periods.size > 0) return "높음";
  if (explicit > 0 || folder > 0 || files.length >= 3 || statusCode !== "NO_SIGNAL") {
    return "보통";
  }
  return "낮음";
}

function rootFolderName(files) {
  const roots = files
    .map((file) => file.relativePath.split(/[\\/]/).filter(Boolean)[0])
    .filter(Boolean);
  if (roots.length === 0) return "선택한 업무 폴더";
  return roots.every((root) => root === roots[0]) ? roots[0] : "선택한 업무 폴더";
}

/**
 * @param {InventoryFile[]} inventory
 */
export function analyzeFilenameInventory(inventory) {
  const safeInventory = inventory
    .filter((file) => file && typeof file.name === "string")
    .map((file) => ({
      name: file.name,
      relativePath: file.relativePath || file.name,
      size: Number.isFinite(file.size) ? file.size : 0,
      lastModified: Number.isFinite(file.lastModified) ? file.lastModified : 0,
    }));

  const rootName = rootFolderName(safeInventory);
  const analyzedFiles = safeInventory.map((file) => {
    const role = detectRole(file.name);
    const branch = classifyBranch(file.relativePath, file.name);
    return {
      ...file,
      extension: fileExtension(file.name),
      analysisTitle: normalizeAnalysisTitle(file.name),
      dateCandidates: filenameDateCandidates(file),
      periods: extractPeriods(`${file.relativePath} ${file.name}`),
      versionTags: extractVersionTags(file.name),
      role,
      roleLabel: ROLE_LABELS[role],
      branchLabel: branch.label,
      branchSource: branch.source,
    };
  });

  const grouped = new Map();
  for (const file of analyzedFiles) {
    const current = grouped.get(file.branchLabel) ?? [];
    current.push(file);
    grouped.set(file.branchLabel, current);
  }

  const branches = [...grouped.entries()]
    .map(([label, files]) => {
      const sourceCounts = files.reduce((counts, file) => {
        counts[file.branchSource] = (counts[file.branchSource] ?? 0) + 1;
        return counts;
      }, {});
      const mode = detectMode(label, files);
      const status = detectStatus(mode, files);
      const periods = [...new Set(files.flatMap((file) => file.periods))].sort(
        (left, right) => right.localeCompare(left, "ko"),
      );
      const roleCounts = files.reduce((counts, file) => {
        counts[file.roleLabel] = (counts[file.roleLabel] ?? 0) + 1;
        return counts;
      }, {});
      const sortedFiles = [...files].sort(
        (left, right) =>
          right.lastModified - left.lastModified ||
          left.relativePath.localeCompare(right.relativePath, "ko"),
      );
      const latestTimestamp = Math.max(0, ...files.map((file) => file.lastModified));

      return {
        id: stableId(label),
        label,
        fileCount: files.length,
        mode,
        modeLabel: MODE_LABELS[mode],
        statusCode: status.code,
        statusLabel: STATUS_LABELS[status.code],
        statusEvidence: status.evidence,
        classificationConfidence: confidenceForBranch(
          sourceCounts,
          files,
          status.code,
        ),
        periods,
        roleCounts,
        latestTimestamp,
        latestLabel: formatDate(latestTimestamp),
        sourceCounts,
        files: sortedFiles,
        caution:
          "파일명과 폴더명만으로 만든 추정입니다. 실제 시행·결재·완료 여부는 문서 본문과 업무시스템에서 확인해야 합니다.",
      };
    })
    .sort(
      (left, right) =>
        right.fileCount - left.fileCount ||
        left.label.localeCompare(right.label, "ko"),
    );

  const folderPaths = new Set(
    safeInventory
      .map((file) => file.relativePath.split(/[\\/]/).slice(0, -1).join("/"))
      .filter(Boolean),
  );
  const totalSize = safeInventory.reduce((sum, file) => sum + file.size, 0);
  const statusCounts = branches.reduce((counts, branch) => {
    counts[branch.statusCode] = (counts[branch.statusCode] ?? 0) + 1;
    return counts;
  }, {});

  return {
    version: 1,
    basis: "folder-and-filename-only",
    rootName,
    analyzedAt: new Date().toISOString(),
    fileCount: analyzedFiles.length,
    folderCount: folderPaths.size,
    totalSize,
    branches,
    statusCounts,
    unclassifiedCount:
      grouped.get("기타·분류 필요")?.length ?? 0,
    limitations: [
      "문서 본문은 읽지 않았습니다.",
      "빈 폴더는 브라우저의 폴더 선택 결과에 포함되지 않습니다.",
      "파일의 수정일은 복사 과정에서 달라질 수 있으므로 상태 근거로 확정하지 않습니다.",
      "완료·진행 표시는 파일명에서 발견한 단서이며 실제 업무 상태가 아닙니다.",
    ],
  };
}

function markdownInline(value) {
  return String(value).replace(/`/g, "ˋ");
}

function dateTimeLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

export function buildFilenameHandoverMarkdown(analysis, aiDraft = "") {
  const lines = [
    `# ${analysis.rootName} 1차 인수인계 초안`,
    "",
    "> 폴더명과 파일명만으로 작성한 초벌 자료입니다. 문서 본문은 확인하지 않았으며 모든 상태는 추정입니다.",
    "",
    "## 분석 개요",
    "",
    `- 분석 시각: ${dateTimeLabel(analysis.analyzedAt)}`,
    `- 발견한 파일: ${analysis.fileCount}개`,
    `- 파일이 있는 폴더: ${analysis.folderCount}개`,
    `- 업무 가지 후보: ${analysis.branches.length}개`,
    `- 분류 필요 파일: ${analysis.unclassifiedCount}개`,
    "",
  ];

  if (aiDraft.trim()) {
    lines.push("## 로컬 AI 인수인계 초안", "", aiDraft.trim(), "");
  }

  lines.push("## 업무 가지", "");

  analysis.branches.forEach((branch, index) => {
    lines.push(
      `### ${index + 1}. ${branch.label}`,
      "",
      `- 업무 형태 후보: ${branch.modeLabel}`,
      `- 상태 단서: ${branch.statusLabel}`,
      `- 분류 신뢰도: ${branch.classificationConfidence}`,
      `- 관련 기간: ${branch.periods.length ? branch.periods.join(", ") : "파일명에서 확인되지 않음"}`,
      `- 최근 수정일 후보: ${branch.latestLabel}`,
      `- 판단 이유: ${branch.statusEvidence}`,
      `- 문서 역할 흔적: ${Object.entries(branch.roleCounts)
        .map(([role, count]) => `${role} ${count}개`)
        .join(", ")}`,
      "",
      "관련 파일:",
      ...branch.files.map(
        (file) =>
          `- \`${markdownInline(file.relativePath)}\` — ${file.roleLabel}${file.periods.length ? ` · ${file.periods.join(", ")}` : ""}`,
      ),
      "",
      `확인 필요: ${branch.caution}`,
      "",
    );
  });

  lines.push(
    "## 분석 한계",
    "",
    ...analysis.limitations.map((limitation) => `- ${limitation}`),
    "",
    "## 후임자 우선 확인사항",
    "",
    "1. `완료 단서 있음` 업무의 실제 결재·시행·정산 완료 여부",
    "2. `진행 단서 있음` 업무의 마지막 조치와 다음 기한",
    "3. 상시관리 자료의 최신성 및 실제 담당자",
    "4. `기타·분류 필요` 파일이 어느 업무에 속하는지",
    "5. 현재 폴더 밖의 전자결재·메일·업무시스템 자료 존재 여부",
    "",
  );

  return lines.join("\n");
}

export const analyzerLabels = {
  roles: ROLE_LABELS,
  modes: MODE_LABELS,
  statuses: STATUS_LABELS,
};
