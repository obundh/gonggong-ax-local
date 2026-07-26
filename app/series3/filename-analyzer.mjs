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
 * @typedef {"terminal"|"active"|"planned"|"continuous"|"reference"|"conflict"|"unknown"} LifecycleStage
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

const LIFECYCLE_LABELS = {
  terminal: "마무리 단서",
  active: "진행 단서",
  planned: "계획 단서",
  continuous: "상시관리 단서",
  reference: "상태 판단 제외",
  conflict: "상충 단서",
  unknown: "단계 미확인",
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
  /^(?:\d{2,4}(?:년)?|제?\d+[장편]?|자료|문서|업무|관련|기타|참고|참고자료|붙임|별첨|서식|양식|계획|계획서|추진계획|진행|검토|보완|결과|결과보고|보고|완료|완료본|완료문서|제출본|정산|증빙|원본|사본|복사본|수정본|검토본|보완본|초안|최종|최종본|백업|구버전|신규|공통|전체)$/u;

const ROLE_NOISE_PATTERN =
  /(?:결과\s*보고(?:서)?|완료\s*보고(?:서)?|추진\s*계획|시행\s*계획|기본\s*계획|종합\s*계획|계획(?:서)?|검토\s*의견|중간\s*보고|진행\s*현황|상황\s*보고|회의록|회의\s*자료|점검\s*결과|점검\s*계획|정산\s*보고|정산|검수\s*조서|준공계|납품\s*확인|통보|공고|요청|접수|회신|신청|서식|양식|매뉴얼|지침|참고\s*자료|붙임|별첨|증빙)/gu;

const VERSION_PATTERN =
  /(?:최종(?:본|\s*\d+)?|진짜\s*최종|수정(?:본)?|보완(?:본)?|검토(?:본)?|초안|사본|복사본|백업|구버전|old|copy|v(?:er)?\.?\s*\d+|\d+\s*차\s*(?:수정|보완|검토|개정|버전))(?:\s*\(\s*안\s*\))?/giu;

const FINAL_DRAFT_PATTERN =
  /최종(?:\s*본)?\s*(?:\(\s*안\s*\)|안)(?:$|\s)/u;

const ROLE_SCORING_RULES = [
  {
    role: "TEMPLATE",
    score: 120,
    reason: "서식·양식 표현",
    pattern: /서식|양식|샘플|예시|작성\s*요령/u,
  },
  {
    role: "PLAN",
    score: 115,
    reason: "구체적인 계획 표현",
    pattern:
      /(?:추진|시행|실시|점검|교육|훈련|정산|집행|구매|사업|대응|운영)?\s*계획(?:서)?|추진\s*방안|완료\s*예정/u,
  },
  {
    role: "PLAN",
    score: 130,
    reason: "향후 작성·제출 요청",
    pattern: /결과\s*보고.{0,8}(?:작성|제출)\s*요청/u,
  },
  {
    role: "ACCEPTANCE",
    score: 120,
    reason: "검수·준공 표현",
    pattern: /검수\s*조서|준공계|납품\s*확인|인수\s*확인/u,
  },
  {
    role: "SETTLEMENT",
    score: 115,
    reason: "정산 마무리 표현",
    pattern: /정산\s*(?:보고|결과|완료)|집행\s*결과/u,
  },
  {
    role: "RESULT",
    score: 110,
    reason: "결과·완료 보고 표현",
    pattern: /결과\s*보고|완료\s*보고|조치\s*결과|종결|성과\s*보고/u,
  },
  {
    role: "INSPECTION",
    score: 125,
    reason: "점검 결과 표현",
    pattern: /점검\s*(?:결과|보고|조서)/u,
  },
  {
    role: "PROGRESS",
    score: 100,
    reason: "중간 진행 표현",
    pattern: /진행\s*현황|중간\s*보고|상황\s*보고|제?\s*\d+\s*보\b/u,
  },
  {
    role: "MEETING",
    score: 95,
    reason: "회의 기록 표현",
    pattern: /회의록|회의\s*결과|협의\s*결과|간담회/u,
  },
  {
    role: "REVIEW",
    score: 105,
    reason: "계획 검토·보완 표현",
    pattern: /계획.{0,6}(?:검토|심사|보완|의견)|미완료|보류|재검토|수정\s*요청/u,
  },
  {
    role: "INSPECTION",
    score: 85,
    reason: "점검·조사 표현",
    pattern: /점검(?!\s*(?:계획|예정))|조사|확인\s*결과|실태/u,
  },
  {
    role: "NOTICE",
    score: 85,
    reason: "승인·통보 표현",
    pattern: /승인|통보|공고|결정|교부\s*결정/u,
  },
  {
    role: "REQUEST",
    score: 80,
    reason: "요청·접수 표현",
    pattern: /접수|신청|제출\s*요청|협조\s*요청|회신\s*요청|요청/u,
  },
  {
    role: "REVIEW",
    score: 75,
    reason: "검토·심사 표현",
    pattern: /검토|심사|보완|의견/u,
  },
  {
    role: "EXECUTION",
    score: 75,
    reason: "시행·실시 표현",
    pattern: /시행(?!\s*계획)|실시(?!\s*계획)|교육(?!\s*계획)|훈련(?!\s*계획)|계약|발주|교부/u,
  },
  {
    role: "PLAN",
    score: 70,
    reason: "일정·착수 표현",
    pattern: /계획|일정|기안|착수|예정/u,
  },
  {
    role: "CONTINUOUS",
    score: 75,
    reason: "대장·목록 관리 표현",
    pattern: /연락망|대장|명부|재고|목록|관리\s*카드/u,
  },
  {
    role: "REFERENCE",
    score: 75,
    reason: "지침·참고 표현",
    pattern: /매뉴얼|지침|기준|참고|행동\s*요령/u,
  },
  {
    role: "ATTACHMENT",
    score: 45,
    reason: "붙임·증빙 표현",
    pattern: /붙임|별첨|증빙/u,
  },
];

const ROLE_TIE_PRIORITY = [
  "TEMPLATE",
  "PLAN",
  "ACCEPTANCE",
  "SETTLEMENT",
  "RESULT",
  "PROGRESS",
  "MEETING",
  "REVIEW",
  "INSPECTION",
  "NOTICE",
  "REQUEST",
  "EXECUTION",
  "CONTINUOUS",
  "REFERENCE",
  "ATTACHMENT",
  "UNKNOWN",
];

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

function statusPeriodForFile(file) {
  const chooseLatest = (periods) =>
    [...periods].sort(
      (left, right) =>
        periodRank(right) - periodRank(left) ||
        right.localeCompare(left, "ko"),
    )[0];
  const exactFilenameDate = extractExactDateMatches(
    withoutExtension(file.name),
    "filename",
  )[0]?.candidate.date;
  if (exactFilenameDate) return exactFilenameDate.slice(0, 4);
  const filenamePeriod = chooseLatest(extractPeriods(withoutExtension(file.name)));
  if (filenamePeriod) return filenamePeriod;

  const folders = file.relativePath
    .split(/[\\/]/)
    .filter(Boolean)
    .slice(1, -1)
    .reverse();
  for (const folder of folders) {
    const exactFolderDate = extractExactDateMatches(folder, "folder")[0]?.candidate
      .date;
    if (exactFolderDate) return exactFolderDate.slice(0, 4);
    const folderPeriod = chooseLatest(extractPeriods(folder));
    if (folderPeriod) return folderPeriod;
  }
  return "";
}

function extractVersionTags(value) {
  return [...value.matchAll(new RegExp(VERSION_PATTERN.source, VERSION_PATTERN.flags))]
    .map((match) => cleanSpacing(match[0]))
    .filter(Boolean);
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function confidenceLabel(score, margin = score) {
  if (score >= 82 && margin >= 18) return "높음";
  if (score >= 55 && margin >= 8) return "보통";
  return "낮음";
}

/**
 * @param {string} name
 * @returns {{
 *   role: DocumentRole;
 *   score: number;
 *   confidence: "높음"|"보통"|"낮음";
 *   reasons: string[];
 *   alternatives: Array<{role: DocumentRole; label: string; score: number}>;
 * }}
 */
function scoreDocumentRole(name) {
  const title = cleanSpacing(withoutExtension(name));
  if (/서식|양식|샘플|예시|작성\s*요령/u.test(title)) {
    return {
      role: "TEMPLATE",
      score: 100,
      confidence: "높음",
      reasons: ["서식·양식 보호 규칙"],
      alternatives: [],
    };
  }
  const roleScores = new Map();
  const roleReasons = new Map();

  for (const rule of ROLE_SCORING_RULES) {
    if (!rule.pattern.test(title)) continue;
    const current = roleScores.get(rule.role) ?? 0;
    roleScores.set(rule.role, Math.max(current, rule.score));
    const reasons = roleReasons.get(rule.role) ?? [];
    if (!reasons.includes(rule.reason)) reasons.push(rule.reason);
    roleReasons.set(rule.role, reasons);
  }

  if (FINAL_DRAFT_PATTERN.test(title)) {
    roleScores.set("REVIEW", Math.max(roleScores.get("REVIEW") ?? 0, 105));
    roleReasons.set("REVIEW", [
      ...(roleReasons.get("REVIEW") ?? []),
      "최종안 표현",
    ]);
  }

  const ranked = [...roleScores.entries()]
    .map(([role, score]) => ({
      role,
      label: ROLE_LABELS[role],
      score,
      priority: ROLE_TIE_PRIORITY.indexOf(role),
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.priority - right.priority ||
        left.label.localeCompare(right.label, "ko"),
    );

  if (ranked.length === 0) {
    return {
      role: "UNKNOWN",
      score: 0,
      confidence: "낮음",
      reasons: ["역할 핵심어 없음"],
      alternatives: [],
    };
  }

  const best = ranked[0];
  const secondScore = ranked[1]?.score ?? 0;
  const margin = best.score - secondScore;
  const normalizedScore = clamp(
    Math.round(best.score * 0.72 + Math.min(28, margin * 0.7)),
    1,
    100,
  );
  return {
    role: best.role,
    score: normalizedScore,
    confidence: confidenceLabel(normalizedScore, margin),
    reasons: roleReasons.get(best.role) ?? [],
    alternatives: ranked.slice(1, 3).map(({ role, label, score }) => ({
      role,
      label,
      score: clamp(
        Math.round((score / Math.max(1, best.score)) * normalizedScore),
        0,
        normalizedScore,
      ),
    })),
  };
}

/**
 * @param {string} name
 * @param {DocumentRole} role
 * @returns {{stage: LifecycleStage; label: string; reasons: string[]}}
 */
function detectLifecycleStage(name, role) {
  const title = cleanSpacing(withoutExtension(name));
  const excluded =
    role === "TEMPLATE" ||
    role === "REFERENCE" ||
    (role === "ATTACHMENT" && !/결과|완료|정산|검수|준공/u.test(title));

  if (excluded) {
    return {
      stage: "reference",
      label: LIFECYCLE_LABELS.reference,
      reasons: ["서식·참고·단순 붙임은 상태 근거에서 제외"],
    };
  }

  if (role === "CONTINUOUS") {
    return {
      stage: "continuous",
      label: LIFECYCLE_LABELS.continuous,
      reasons: ["대장·목록 등 계속 갱신하는 자료"],
    };
  }

  const suppressesTerminal =
    /완료\s*예정|정산\s*계획|결과\s*보고.{0,8}(?:작성|제출)\s*요청|초안|검토본|보완본/u.test(
      title,
    ) || FINAL_DRAFT_PATTERN.test(title);
  const hasTerminal =
    !suppressesTerminal &&
    (/결과\s*보고|완료\s*보고|점검\s*(?:결과|보고|조서)|정산\s*(?:결과|완료|보고)|집행\s*결과|검수\s*조서|준공계|납품\s*확인|조치\s*결과|종결|성과\s*보고/u.test(
      title,
    ) ||
      ["RESULT", "SETTLEMENT", "ACCEPTANCE"].includes(role));
  const hasNegative = /미완료|보류|취소|중단|재검토|보완\s*요청|수정\s*요청/u.test(
    title,
  );
  const hasActiveReview =
    /검토\s*의견|검토본|보완본|재검토|보완\s*요청|수정\s*요청|초안/u.test(
      title,
    ) || FINAL_DRAFT_PATTERN.test(title);

  if (hasTerminal && hasNegative) {
    return {
      stage: "conflict",
      label: LIFECYCLE_LABELS.conflict,
      reasons: ["한 파일명에 완료와 미완료·보완 표현이 함께 있음"],
    };
  }
  if (hasNegative) {
    return {
      stage: "active",
      label: LIFECYCLE_LABELS.active,
      reasons: ["미완료·보류·보완 표현"],
    };
  }
  if (hasActiveReview) {
    return {
      stage: "active",
      label: LIFECYCLE_LABELS.active,
      reasons: ["초안·검토·보완 표현"],
    };
  }
  if (hasTerminal) {
    return {
      stage: "terminal",
      label: LIFECYCLE_LABELS.terminal,
      reasons: ["결과·완료·정산·검수 표현"],
    };
  }
  if (role === "PLAN" || role === "REQUEST") {
    return {
      stage: "planned",
      label: LIFECYCLE_LABELS.planned,
      reasons: ["계획·예정·요청 표현"],
    };
  }
  if (
    ["REVIEW", "PROGRESS", "EXECUTION", "INSPECTION"].includes(role)
  ) {
    return {
      stage: "active",
      label: LIFECYCLE_LABELS.active,
      reasons: ["검토·진행·시행·점검 표현"],
    };
  }
  return {
    stage: "unknown",
    label: LIFECYCLE_LABELS.unknown,
    reasons: ["상태 핵심어 없음"],
  };
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
  const filenameText = cleanSpacing(withoutExtension(name));
  const folder = meaningfulFolder(relativePath);
  const combined = cleanSpacing(`${folder} ${filenameText}`);

  for (const [scopeLabel, scope] of [
    ["파일명", filenameText],
    ["가까운 폴더와 파일명", combined],
  ]) {
    for (const rule of SPECIFIC_BRANCH_RULES) {
      if (rule.pattern.test(scope)) {
        return {
          label: rule.label,
          source: "명확한 업무명",
          score: 96,
          confidence: "높음",
          reasons: [`${scopeLabel}의 업무명 사전 일치: ${rule.label}`],
        };
      }
    }
  }

  const matchedHazards = HAZARD_RULES.filter(([, pattern]) =>
    pattern.test(combined),
  ).map(([hazard]) => hazard);
  if (matchedHazards.length > 1) {
    return {
      label: "복합 재난 대비·대응",
      source: "복수 재난 유형명",
      score: 54,
      confidence: "낮음",
      reasons: [`여러 재난 유형 발견: ${matchedHazards.join(", ")}`],
    };
  }
  if (matchedHazards.length === 1) {
    const action = /복구|피해|지원/u.test(combined) ? "피해·복구" : "대비·대응";
    return {
      label: `${matchedHazards[0]} ${action}`,
      source: "재난 유형명",
      score: 84,
      confidence: "높음",
      reasons: [`재난 유형과 대응 표현: ${matchedHazards[0]}`],
    };
  }

  if (folder) {
    return {
      label: folder,
      source: "하위 폴더명",
      score: 78,
      confidence: "보통",
      reasons: [`가장 가까운 유효 폴더: ${folder}`],
    };
  }

  const core = normalizeAnalysisTitle(name);
  const genericCore =
    /^(?:문서|자료|보고|계획|결과|진행|현황|검토|정산|붙임|별첨|서식|양식)\s*\d*$/u;
  if (core.length >= 3 && core.length <= 40 && !genericCore.test(core)) {
    return {
      label: core,
      source: "파일명 핵심어",
      score: core.length >= 5 ? 66 : 58,
      confidence: core.length >= 5 ? "보통" : "낮음",
      reasons: [`날짜·역할·버전 표현을 뺀 제목: ${core}`],
    };
  }

  for (const rule of GENERAL_BRANCH_RULES) {
    if (rule.pattern.test(combined)) {
      return {
        label: rule.label,
        source: "업무 핵심어",
        score: 50,
        confidence: "낮음",
        reasons: [`일반 업무 핵심어: ${rule.label}`],
      };
    }
  }

  return {
    label: "기타·분류 필요",
    source: "분류 단서 부족",
    score: 12,
    confidence: "낮음",
    reasons: ["업무명·유효 폴더·핵심어가 부족함"],
  };
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

function branchGroupingKey(label) {
  return cleanSpacing(label)
    .toLocaleLowerCase("ko")
    .replace(/[\s·ㆍ._-]+/gu, "");
}

function representativeBranchLabel(files) {
  const sourcePriority = {
    "명확한 업무명": 5,
    "재난 유형명": 4,
    "복수 재난 유형명": 3,
    "하위 폴더명": 3,
    "파일명 핵심어": 2,
    "업무 핵심어": 1,
    "분류 단서 부족": 0,
  };
  const labels = new Map();
  for (const file of files) {
    const current = labels.get(file.branchLabel) ?? {
      label: file.branchLabel,
      count: 0,
      maxScore: 0,
      sourcePriority: 0,
    };
    current.count += 1;
    current.maxScore = Math.max(current.maxScore, file.branchScore);
    current.sourcePriority = Math.max(
      current.sourcePriority,
      sourcePriority[file.branchSource] ?? 0,
    );
    labels.set(file.branchLabel, current);
  }
  return [...labels.values()].sort(
    (left, right) =>
      right.count - left.count ||
      right.maxScore - left.maxScore ||
      right.sourcePriority - left.sourcePriority ||
      left.label.localeCompare(right.label, "ko"),
  )[0]?.label ?? "기타·분류 필요";
}

function periodRank(value) {
  const yearMatch = String(value).match(/(?:19|20)\d{2}/u);
  const year = yearMatch ? Number(yearMatch[0]) : 0;
  let cycle = 0;
  if (/상반기/u.test(value)) cycle = 3;
  if (/하반기/u.test(value)) cycle = 9;
  const quarter = String(value).match(/([1-4])\s*분기/u);
  if (quarter) cycle = Number(quarter[1]) * 3;
  const month = String(value).match(/(\d{1,2})\s*월/u);
  if (month) cycle = clamp(Number(month[1]), 1, 12);
  return year * 100 + cycle;
}

function primaryPeriod(file) {
  if (file.statusPeriod) return file.statusPeriod;
  return [...file.periods].sort(
    (left, right) =>
      periodRank(right) - periodRank(left) ||
      right.localeCompare(left, "ko"),
  )[0];
}

function logicalFamilyKey(file) {
  const directories = file.relativePath
    .split(/[\\/]/)
    .filter(Boolean)
    .slice(1, -1)
    .map(cleanFolderLabel)
    .filter((part) => part && !GENERIC_FOLDER_PATTERN.test(part))
    .join("/");
  const title =
    branchGroupingKey(file.analysisTitle) ||
    branchGroupingKey(
      cleanSpacing(removeExactFilenameDates(withoutExtension(file.name))).replace(
        new RegExp(VERSION_PATTERN.source, VERSION_PATTERN.flags),
        " ",
      ),
    );
  const explicitFilenameDate =
    file.dateCandidates.find((candidate) => candidate.source === "filename")
      ?.date ?? "";
  return [
    directories || "root",
    primaryPeriod(file) || "기간 미상",
    explicitFilenameDate || "날짜 미상",
    title || branchGroupingKey(file.name),
    file.role,
  ].join("|");
}

function representativeScore(file) {
  const title = cleanSpacing(withoutExtension(file.name));
  let score = 0;
  if (/사본|복사본|백업|구버전|old|copy/iu.test(title)) score -= 100;
  if (/초안|검토본/u.test(title) || FINAL_DRAFT_PATTERN.test(title)) {
    score -= 30;
  }
  if (isFinalCandidateName(title)) score += 25;
  const revision = title.match(/v(?:er)?\.?\s*(\d+)/iu);
  if (revision) score += clamp(Number(revision[1]), 0, 50);
  if (file.dateCandidates.some((candidate) => candidate.source === "filename")) {
    score += 8;
  }
  return score;
}

function isFinalCandidateName(value) {
  if (FINAL_DRAFT_PATTERN.test(value)) return false;
  return /(?:진짜\s*최종|최종(?:본|\s*\d+)?)(?!\s*(?:\(\s*안\s*\)|안))/u.test(
    value,
  );
}

function deduplicateEvidence(files) {
  const groups = new Map();
  for (const file of files) {
    const key = logicalFamilyKey(file);
    const group = groups.get(key) ?? [];
    group.push(file);
    groups.set(key, group);
  }

  const representatives = [];
  let multipleFinalGroups = 0;
  for (const group of groups.values()) {
    const representative = group
      .map((file) => ({ file, score: representativeScore(file) }))
      .sort(
        (left, right) =>
          right.score - left.score ||
          right.file.lastModified - left.file.lastModified ||
          left.file.relativePath.localeCompare(right.file.relativePath, "ko"),
      )[0].file;
    representatives.push(representative);
    const finalCount = group.filter((file) =>
      isFinalCandidateName(cleanSpacing(withoutExtension(file.name))),
    ).length;
    if (finalCount > 1) multipleFinalGroups += 1;
    for (const file of group) {
      file.duplicateGroupSize = group.length;
      file.finalCandidateConflict = finalCount > 1;
      file.evidenceRepresentative =
        file.relativePath === representative.relativePath;
    }
  }

  return {
    representatives,
    duplicateCount: Math.max(0, files.length - representatives.length),
    multipleFinalGroups,
  };
}

function detectMode(label, files) {
  const meaningfulRoles = new Set(files.map((file) => file.role));
  const hasText = (pattern) =>
    pattern.test(label) || files.some((file) => pattern.test(file.name));
  const periodYears = new Set(
    files
      .flatMap((file) => file.periods)
      .map((period) => period.match(/(?:19|20)\d{2}/u)?.[0])
      .filter(Boolean),
  );

  if (
    meaningfulRoles.size <= 2 &&
    [...meaningfulRoles].every((role) =>
      ["REFERENCE", "TEMPLATE", "ATTACHMENT"].includes(role),
    )
  ) {
    return {
      code: "REFERENCE_ONLY",
      score: 100,
      reason: "서식·지침·참고 역할만 발견",
    };
  }
  if (hasText(/연락망|대장|명부|재고|목록|관리\s*카드/u)) {
    return {
      code: "CONTINUOUS",
      score: 90,
      reason: "계속 갱신하는 대장·목록 표현",
    };
  }
  if (
    HAZARD_RULES.some(([, pattern]) => hasText(pattern)) &&
    hasText(/대응|피해|복구|상황/u)
  ) {
    return {
      code: "EVENT_RESPONSE",
      score: 84,
      reason: "재난 유형과 대응·피해·복구 표현",
    };
  }
  if (
    periodYears.size >= 2 ||
    hasText(/훈련|정기|연간|분기|상반기|하반기|매월|월간/u)
  ) {
    return {
      code: "PERIODIC",
      score: periodYears.size >= 2 ? 92 : 78,
      reason:
        periodYears.size >= 2
          ? "서로 다른 연도의 같은 업무 자료"
          : "정기·반복 주기 표현",
    };
  }
  if (files.some((file) => file.role !== "UNKNOWN")) {
    return {
      code: "PROJECT",
      score: 68,
      reason: "계획·시행·결과 등 문서 역할 발견",
    };
  }
  return {
    code: "UNKNOWN",
    score: 20,
    reason: "업무 형태 단서 부족",
  };
}

function statusForCycle(mode, files) {
  if (mode === "REFERENCE_ONLY") {
    return {
      code: "REFERENCE_ONLY",
      evidence: "서식·지침·참고자료 파일명만 발견됐습니다.",
      score: 92,
    };
  }
  if (mode === "CONTINUOUS") {
    return {
      code: "CONTINUOUS_MATERIAL",
      evidence: "연락망·대장·현황 등 계속 관리하는 자료명이 발견됐습니다.",
      score: 88,
    };
  }

  const stages = new Set(files.map((file) => file.lifecycleStage));
  const hasNegative = files.some((file) =>
    /미완료|보류|취소|중단|재검토|보완\s*요청|수정\s*요청/u.test(
      file.name,
    ),
  );
  const hasTerminal = stages.has("terminal");
  const hasActive = stages.has("active");
  const hasPlan = stages.has("planned");

  if (stages.has("conflict") || (hasNegative && hasTerminal)) {
    return {
      code: "CONFLICT",
      evidence: "같은 업무 주기에 완료와 미완료·중단·보완 단서가 함께 있습니다.",
      score: 72,
    };
  }
  if (hasTerminal) {
    return {
      code: "TERMINAL_SIGNAL_FOUND",
      evidence: "결과·정산·검수 등 마무리 단계의 파일명이 발견됐습니다.",
      score: 88,
    };
  }
  if (hasActive) {
    return {
      code: "ACTIVE_SIGNAL_FOUND",
      evidence: "검토·보완·중간보고 등 진행 단계의 파일명이 발견됐습니다.",
      score: hasNegative ? 86 : 76,
    };
  }
  if (hasPlan) {
    return {
      code: "PLAN_ONLY",
      evidence: "계획·요청·시행 관련 파일명은 있지만 결과 단서는 찾지 못했습니다.",
      score: 70,
    };
  }
  return {
    code: "NO_SIGNAL",
    evidence: "파일명만으로 진행 단계를 판단할 표현을 찾지 못했습니다.",
    score: 20,
  };
}

function detectStatus(mode, files) {
  const cycleGroups = new Map();
  for (const file of files) {
    const period = primaryPeriod(file) || "기간 미상";
    const group = cycleGroups.get(period) ?? [];
    group.push(file);
    cycleGroups.set(period, group);
  }
  const periods = [...cycleGroups.keys()].filter((period) => period !== "기간 미상");
  const focusPeriod =
    periods.sort(
      (left, right) =>
        periodRank(right) - periodRank(left) ||
        right.localeCompare(left, "ko"),
    )[0] ?? "기간 미상";
  const focusFiles = cycleGroups.get(focusPeriod) ?? files;
  const focusStatus = statusForCycle(mode, focusFiles);
  const historicalStatuses = [...cycleGroups.entries()]
    .filter(([period]) => period !== focusPeriod)
    .map(([period, cycleFiles]) => ({
      period,
      ...statusForCycle(mode, cycleFiles),
    }))
    .sort(
      (left, right) =>
        periodRank(right.period) - periodRank(left.period) ||
        right.period.localeCompare(left.period, "ko"),
    );
  const historicalTerminalPeriods = historicalStatuses
    .filter((status) => status.code === "TERMINAL_SIGNAL_FOUND")
    .map((status) => status.period);
  const periodPrefix =
    focusPeriod === "기간 미상"
      ? ""
      : `최신 식별 주기 ${focusPeriod} 기준으로 `;
  const historicalSuffix = historicalTerminalPeriods.length
    ? ` 이전 ${historicalTerminalPeriods.join(", ")}에는 마무리 단서가 있습니다.`
    : "";

  return {
    ...focusStatus,
    evidence: `${periodPrefix}${focusStatus.evidence}${historicalSuffix}`,
    focusPeriod,
    focusFileCount: focusFiles.length,
    historicalStatuses,
    confidence: confidenceLabel(
      focusStatus.score - (focusPeriod === "기간 미상" ? 12 : 0),
    ),
  };
}

function confidenceForBranch(files) {
  const average =
    files.reduce((sum, file) => sum + file.branchScore, 0) /
    Math.max(1, files.length);
  const agreementBonus = files.length >= 2 ? Math.min(9, 3 + files.length) : 0;
  const ambiguityPenalty = files.some((file) =>
    file.branchReasons.some((reason) => reason.startsWith("여러 재난 유형")),
  )
    ? 14
    : 0;
  const score = clamp(
    Math.round(average + agreementBonus - ambiguityPenalty),
    0,
    100,
  );
  return {
    score,
    label: confidenceLabel(score),
    reasons: [
      `파일별 업무 가지 점수 평균 ${Math.round(average)}점`,
      files.length >= 2
        ? `같은 가지로 묶인 파일 ${files.length}개`
        : "단일 파일 근거",
      ...(ambiguityPenalty ? ["복수 재난 유형으로 모호성 감점"] : []),
    ],
  };
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
    const roleResult = scoreDocumentRole(file.name);
    const lifecycle = detectLifecycleStage(file.name, roleResult.role);
    const branch = classifyBranch(file.relativePath, file.name);
    const dateCandidates = filenameDateCandidates(file);
    const periods = [
      ...new Set([
        ...extractPeriods(`${file.relativePath} ${file.name}`),
        ...dateCandidates.map((candidate) => candidate.date.slice(0, 4)),
      ]),
    ];
    return {
      ...file,
      extension: fileExtension(file.name),
      analysisTitle: normalizeAnalysisTitle(file.name),
      dateCandidates,
      periods,
      statusPeriod: statusPeriodForFile(file),
      versionTags: extractVersionTags(file.name),
      role: roleResult.role,
      roleLabel: ROLE_LABELS[roleResult.role],
      roleScore: roleResult.score,
      roleConfidence: roleResult.confidence,
      roleReasons: roleResult.reasons,
      roleAlternatives: roleResult.alternatives,
      lifecycleStage: lifecycle.stage,
      lifecycleLabel: lifecycle.label,
      lifecycleReasons: lifecycle.reasons,
      branchLabel: branch.label,
      branchSource: branch.source,
      branchScore: branch.score,
      branchConfidence: branch.confidence,
      branchReasons: branch.reasons,
      duplicateGroupSize: 1,
      finalCandidateConflict: false,
      evidenceRepresentative: true,
    };
  });

  const grouped = new Map();
  for (const file of analyzedFiles) {
    const key = branchGroupingKey(file.branchLabel);
    const current = grouped.get(key) ?? {
      key,
      files: [],
    };
    current.files.push(file);
    grouped.set(key, current);
  }

  const branches = [...grouped.values()]
    .map(({ key, files }) => {
      const label = representativeBranchLabel(files);
      const sourceCounts = files.reduce((counts, file) => {
        counts[file.branchSource] = (counts[file.branchSource] ?? 0) + 1;
        return counts;
      }, {});
      const deduplicated = deduplicateEvidence(files);
      const mode = detectMode(label, deduplicated.representatives);
      const status = detectStatus(mode.code, deduplicated.representatives);
      const branchConfidence = confidenceForBranch(
        deduplicated.representatives,
      );
      const versionCaution = deduplicated.multipleFinalGroups
        ? `최종 표현이 여러 개인 문서 묶음 ${deduplicated.multipleFinalGroups}개가 있어 실제 최종본 확인이 필요합니다.`
        : "";
      const statusScore = clamp(
        status.score -
          (status.focusPeriod === "기간 미상" ? 12 : 0) -
          (deduplicated.multipleFinalGroups ? 15 : 0),
        0,
        100,
      );
      const periods = [...new Set(files.flatMap((file) => file.periods))].sort(
        (left, right) =>
          periodRank(right) - periodRank(left) ||
          right.localeCompare(left, "ko"),
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
      const latestTimestamp = files.reduce(
        (latest, file) => Math.max(latest, file.lastModified),
        0,
      );

      return {
        id: stableId(key),
        label,
        fileCount: files.length,
        evidenceFileCount: deduplicated.representatives.length,
        duplicateCount: deduplicated.duplicateCount,
        multipleFinalGroups: deduplicated.multipleFinalGroups,
        mode: mode.code,
        modeLabel: MODE_LABELS[mode.code],
        modeScore: mode.score,
        modeEvidence: mode.reason,
        statusCode: status.code,
        statusLabel: STATUS_LABELS[status.code],
        statusEvidence: [status.evidence, versionCaution]
          .filter(Boolean)
          .join(" "),
        statusScore,
        statusConfidence: confidenceLabel(statusScore),
        focusPeriod: status.focusPeriod,
        statusBasisFileCount: status.focusFileCount,
        historicalStatuses: status.historicalStatuses,
        classificationScore: branchConfidence.score,
        classificationConfidence: branchConfidence.label,
        classificationReasons: branchConfidence.reasons,
        versionCaution,
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
  const branchConfidenceCounts = branches.reduce((counts, branch) => {
    counts[branch.classificationConfidence] =
      (counts[branch.classificationConfidence] ?? 0) + 1;
    return counts;
  }, {});
  const roleConfidenceCounts = analyzedFiles.reduce((counts, file) => {
    counts[file.roleConfidence] = (counts[file.roleConfidence] ?? 0) + 1;
    return counts;
  }, {});
  const reviewRequiredCount = analyzedFiles.filter(
    (file) =>
      file.branchConfidence === "낮음" ||
      file.roleConfidence === "낮음" ||
      file.lifecycleStage === "conflict" ||
      file.finalCandidateConflict,
  ).length;
  const duplicateCount = branches.reduce(
    (sum, branch) => sum + branch.duplicateCount,
    0,
  );

  return {
    version: 2,
    basis: "folder-and-filename-only",
    engine: {
      id: "weighted-filename-v2",
      label: "CPU 경량 분류 엔진 v2",
      targetProfile: "13세대 i5 · 메모리 16GB · 외장 GPU 없음",
      method: "가중치 규칙 · 폴더 문맥 · 최신 주기 · 중복본 억제",
    },
    rootName,
    analyzedAt: new Date().toISOString(),
    fileCount: analyzedFiles.length,
    folderCount: folderPaths.size,
    totalSize,
    branches,
    statusCounts,
    branchConfidenceCounts,
    roleConfidenceCounts,
    reviewRequiredCount,
    duplicateCount,
    unclassifiedCount: analyzedFiles.filter(
      (file) => file.branchLabel === "기타·분류 필요",
    ).length,
    limitations: [
      "문서 본문은 읽지 않았습니다.",
      "빈 폴더는 브라우저의 폴더 선택 결과에 포함되지 않습니다.",
      "파일의 수정일은 복사 과정에서 달라질 수 있으므로 상태 근거로 확정하지 않습니다.",
      "완료·진행 표시는 최신 식별 주기의 파일명 단서이며 실제 업무 상태가 아닙니다.",
      "같은 문서의 사본·수정본 후보는 상태 근거에 한 번만 반영하지만 실제 최종본을 확정하지 않습니다.",
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
      `- 검토 권장 파일: ${analysis.reviewRequiredCount ?? analysis.unclassifiedCount}개`,
      `- 중복·버전 후보: ${analysis.duplicateCount ?? 0}개`,
      `- 분류 방식: ${analysis.engine?.label ?? "파일명 규칙 분석"}`,
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
      `- 업무 가지 근거 등급: ${branch.classificationConfidence}`,
      `- 규칙 근거 점수: ${Number.isFinite(branch.classificationScore) ? `${branch.classificationScore}점` : "미산정"}`,
      `- 상태 단서 강도: ${branch.statusConfidence ?? "미산정"}`,
      `- 대표 판단 주기: ${branch.focusPeriod ?? "기간 미상"}`,
      `- 관련 기간: ${branch.periods.length ? branch.periods.join(", ") : "파일명에서 확인되지 않음"}`,
      `- 최근 수정일 후보: ${branch.latestLabel}`,
      `- 판단 이유: ${branch.statusEvidence}`,
      `- 중복·버전 후보: ${branch.duplicateCount ?? 0}개`,
      ...(branch.versionCaution
        ? [`- 최종본 확인: ${branch.versionCaution}`]
        : []),
      `- 문서 역할 흔적: ${Object.entries(branch.roleCounts)
        .map(([role, count]) => `${role} ${count}개`)
        .join(", ")}`,
      "",
      "관련 파일:",
      ...branch.files.map(
        (file) =>
          `- \`${markdownInline(file.relativePath)}\` — ${file.roleLabel}${file.roleConfidence ? `(근거 ${file.roleConfidence})` : ""}${file.periods.length ? ` · ${file.periods.join(", ")}` : ""}${file.duplicateGroupSize > 1 ? ` · 중복·버전 후보 ${file.duplicateGroupSize}개 묶음` : ""}`,
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
  lifecycle: LIFECYCLE_LABELS,
};
