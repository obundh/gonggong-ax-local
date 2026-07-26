import publicLanguageData from "@/data/public-language.json";

export type FindingCategory =
  | "맞춤법"
  | "띄어쓰기"
  | "공공언어"
  | "문장"
  | "표기";

export type FindingConfidence = "높음" | "검토";
export type FindingSeverity = "오류" | "권고";

export type Finding = {
  id: string;
  ruleId: string;
  paragraphIndex: number;
  start: number;
  end: number;
  original: string;
  replacement: string | null;
  alternatives?: string[];
  category: FindingCategory;
  confidence: FindingConfidence;
  severity: FindingSeverity;
  reason: string;
  sourceLabel: string;
  sourceUrl?: string;
  safe: boolean;
};

type PatternRule = {
  id: string;
  pattern: RegExp;
  replacement: string | ((match: string, groups: string[]) => string) | null;
  category: FindingCategory;
  confidence: FindingConfidence;
  severity: FindingSeverity;
  reason: string;
  safe: boolean;
};

const KOREAN_RULES_URL =
  "https://korean.go.kr/kornorms/regltn/regltnView.do?regltn_code=0001";
const PUBLIC_LANGUAGE_URL =
  "https://www.data.go.kr/data/15130006/fileData.do";

const patternRules: PatternRule[] = [
  {
    id: "spell-doet",
    pattern: /됬/g,
    replacement: "됐",
    category: "맞춤법",
    confidence: "높음",
    severity: "오류",
    reason: "‘되었다’의 준말은 ‘됐다’입니다.",
    safe: true,
  },
  {
    id: "spell-myeochil",
    pattern: /몇일/g,
    replacement: "며칠",
    category: "맞춤법",
    confidence: "높음",
    severity: "오류",
    reason: "날짜의 수를 나타낼 때는 ‘며칠’로 적습니다.",
    safe: true,
  },
  {
    id: "spell-doeyeo",
    pattern: /되여/g,
    replacement: "되어",
    category: "맞춤법",
    confidence: "높음",
    severity: "오류",
    reason: "‘되다’에 ‘-어’가 결합하면 ‘되어’가 됩니다.",
    safe: true,
  },
  {
    id: "spell-eotteokhae",
    pattern: /어떻해/g,
    replacement: "어떻게",
    category: "맞춤법",
    confidence: "높음",
    severity: "오류",
    reason: "방법이나 상태를 물을 때는 ‘어떻게’로 적습니다.",
    safe: true,
  },
  {
    id: "spell-waenji",
    pattern: /웬지/g,
    replacement: "왠지",
    category: "맞춤법",
    confidence: "높음",
    severity: "오류",
    reason: "‘왜인지’가 줄어든 말은 ‘왠지’입니다.",
    safe: true,
  },
  {
    id: "spell-geumse",
    pattern: /금새/g,
    replacement: "금세",
    category: "맞춤법",
    confidence: "높음",
    severity: "오류",
    reason: "‘지금 바로’라는 뜻의 말은 ‘금세’입니다.",
    safe: true,
  },
  {
    id: "spell-seollem",
    pattern: /설레임/g,
    replacement: "설렘",
    category: "맞춤법",
    confidence: "높음",
    severity: "오류",
    reason: "‘설레다’의 명사형은 ‘설렘’입니다.",
    safe: true,
  },
  {
    id: "spell-huihan",
    pattern: /희안/g,
    replacement: "희한",
    category: "맞춤법",
    confidence: "높음",
    severity: "오류",
    reason: "매우 드물거나 신기하다는 뜻은 ‘희한하다’입니다.",
    safe: true,
  },
  {
    id: "spell-wenman",
    pattern: /왠만/g,
    replacement: "웬만",
    category: "맞춤법",
    confidence: "높음",
    severity: "오류",
    reason: "정도나 형편이 보통이라는 뜻은 ‘웬만하다’입니다.",
    safe: true,
  },
  {
    id: "spell-ilili",
    pattern: /일일히/g,
    replacement: "일일이",
    category: "맞춤법",
    confidence: "높음",
    severity: "오류",
    reason: "하나씩 빠짐없이 한다는 뜻은 ‘일일이’입니다.",
    safe: true,
  },
  {
    id: "spell-an-doemnida",
    pattern: /않\s*됩니다/g,
    replacement: "안 됩니다",
    category: "맞춤법",
    confidence: "높음",
    severity: "오류",
    reason: "부정 부사 ‘안’과 동사 ‘되다’를 구분해 적습니다.",
    safe: true,
  },
  {
    id: "spacing-hal-su",
    pattern: /할수(?=\s*있|\s*없|\s|[.,!?)]|$)/g,
    replacement: "할 수",
    category: "띄어쓰기",
    confidence: "높음",
    severity: "오류",
    reason: "의존 명사 ‘수’는 앞말과 띄어 씁니다.",
    safe: true,
  },
  {
    id: "spacing-doel-su",
    pattern: /될수(?=\s*있|\s*없|\s|[.,!?)]|$)/g,
    replacement: "될 수",
    category: "띄어쓰기",
    confidence: "높음",
    severity: "오류",
    reason: "의존 명사 ‘수’는 앞말과 띄어 씁니다.",
    safe: true,
  },
  {
    id: "spacing-bol-su",
    pattern: /볼수(?=\s*있|\s*없|\s|[.,!?)]|$)/g,
    replacement: "볼 수",
    category: "띄어쓰기",
    confidence: "높음",
    severity: "오류",
    reason: "의존 명사 ‘수’는 앞말과 띄어 씁니다.",
    safe: true,
  },
  {
    id: "spacing-al-su",
    pattern: /알수(?=\s*있|\s*없|\s|[.,!?)]|$)/g,
    replacement: "알 수",
    category: "띄어쓰기",
    confidence: "높음",
    severity: "오류",
    reason: "의존 명사 ‘수’는 앞말과 띄어 씁니다.",
    safe: true,
  },
  {
    id: "spacing-su-it",
    pattern: /수있/g,
    replacement: "수 있",
    category: "띄어쓰기",
    confidence: "높음",
    severity: "오류",
    reason: "의존 명사 ‘수’와 용언 ‘있다’를 띄어 씁니다.",
    safe: true,
  },
  {
    id: "spacing-su-eop",
    pattern: /수없/g,
    replacement: "수 없",
    category: "띄어쓰기",
    confidence: "높음",
    severity: "오류",
    reason: "의존 명사 ‘수’와 용언 ‘없다’를 띄어 씁니다.",
    safe: true,
  },
  {
    id: "spacing-hal-ttae",
    pattern: /할때/g,
    replacement: "할 때",
    category: "띄어쓰기",
    confidence: "높음",
    severity: "오류",
    reason: "시간을 나타내는 의존 명사 ‘때’는 띄어 씁니다.",
    safe: true,
  },
  {
    id: "spacing-bbunman-anira",
    pattern: /뿐만아니라/g,
    replacement: "뿐만 아니라",
    category: "띄어쓰기",
    confidence: "높음",
    severity: "오류",
    reason: "‘아니라’는 앞말과 띄어 씁니다.",
    safe: true,
  },
  {
    id: "spacing-geu-bakke",
    pattern: /그밖에/g,
    replacement: "그 밖에",
    category: "띄어쓰기",
    confidence: "높음",
    severity: "오류",
    reason: "‘그것 이외에’라는 뜻의 ‘그 밖에’는 띄어 씁니다.",
    safe: true,
  },
  {
    id: "spacing-iwa-gachi",
    pattern: /이와같이/g,
    replacement: "이와 같이",
    category: "띄어쓰기",
    confidence: "높음",
    severity: "오류",
    reason: "부사 ‘같이’는 앞말과 띄어 씁니다.",
    safe: true,
  },
  {
    id: "spacing-e-uihae",
    pattern: /에의해/g,
    replacement: "에 의해",
    category: "띄어쓰기",
    confidence: "높음",
    severity: "오류",
    reason: "조사 뒤에 오는 용언 활용형은 띄어 씁니다.",
    safe: true,
  },
  {
    id: "spacing-hada-doemnida",
    pattern: /(안내|처리|접수|확인|제출|운영|적용|사용)\s+됩니다/g,
    replacement: (_match, groups) => `${groups[0]}됩니다`,
    category: "띄어쓰기",
    confidence: "높음",
    severity: "오류",
    reason: "‘-되다’가 접미사로 쓰인 말은 앞말에 붙여 씁니다.",
    safe: true,
  },
  {
    id: "style-uigeohayeo",
    pattern: /에\s*의거하여/g,
    replacement: "에 따라",
    category: "공공언어",
    confidence: "검토",
    severity: "권고",
    reason: "딱딱한 행정 표현을 익숙한 표현으로 바꾸면 이해하기 쉽습니다.",
    safe: false,
  },
  {
    id: "style-geumbeon",
    pattern: /금번/g,
    replacement: "이번",
    category: "공공언어",
    confidence: "검토",
    severity: "권고",
    reason: "일상에서 널리 쓰는 쉬운 말이 더 빠르게 이해됩니다.",
    safe: false,
  },
  {
    id: "style-geumil",
    pattern: /금일/g,
    replacement: "오늘",
    category: "공공언어",
    confidence: "검토",
    severity: "권고",
    reason: "날짜가 중요한 문서라면 구체적인 날짜를 쓰는 것이 더 명확합니다.",
    safe: false,
  },
  {
    id: "style-igik",
    pattern: /익일/g,
    replacement: "다음 날",
    category: "공공언어",
    confidence: "검토",
    severity: "권고",
    reason: "한자어보다 쉬운 우리말을 쓰면 오해를 줄일 수 있습니다.",
    safe: false,
  },
  {
    id: "style-myeongil",
    pattern: /명일/g,
    replacement: "내일",
    category: "공공언어",
    confidence: "검토",
    severity: "권고",
    reason: "한자어보다 쉬운 우리말을 쓰면 오해를 줄일 수 있습니다.",
    safe: false,
  },
  {
    id: "style-danghae",
    pattern: /당해(?=\s*(연도|사업|기관|규정|기간))/g,
    replacement: "해당",
    category: "공공언어",
    confidence: "검토",
    severity: "권고",
    reason: "뜻이 바로 드러나는 ‘해당’으로 다듬을 수 있습니다.",
    safe: false,
  },
  {
    id: "style-doeeojin",
    pattern: /되어진/g,
    replacement: "된",
    category: "문장",
    confidence: "높음",
    severity: "오류",
    reason: "불필요한 이중 피동 표현을 간결하게 고칩니다.",
    safe: true,
  },
  {
    id: "format-double-space",
    pattern: / {2,}/g,
    replacement: " ",
    category: "표기",
    confidence: "높음",
    severity: "오류",
    reason: "본문의 연속된 공백을 한 칸으로 통일합니다.",
    safe: true,
  },
  {
    id: "format-space-before-punctuation",
    pattern: / +([,.;!?])/g,
    replacement: (_match, groups) => groups[0],
    category: "표기",
    confidence: "높음",
    severity: "오류",
    reason: "문장 부호 앞에는 공백을 두지 않습니다.",
    safe: true,
  },
  {
    id: "format-space-after-comma",
    pattern: /,([가-힣A-Za-z0-9])/g,
    replacement: (_match, groups) => `, ${groups[0]}`,
    category: "표기",
    confidence: "높음",
    severity: "오류",
    reason: "쉼표 뒤에는 한 칸을 띄워 읽기 쉽게 합니다.",
    safe: true,
  },
];

type PublicEntry = (typeof publicLanguageData.entries)[number];

const publicTermMap = new Map<
  string,
  { entry: PublicEntry; isVariant: boolean }
>();

for (const entry of publicLanguageData.entries) {
  const canonicalKey = entry.term.toLocaleLowerCase("ko-KR");
  if (!publicTermMap.has(canonicalKey)) {
    publicTermMap.set(canonicalKey, { entry, isVariant: false });
  }
  for (const variant of entry.variants) {
    const variantKey = variant.toLocaleLowerCase("ko-KR");
    if (!publicTermMap.has(variantKey)) {
      publicTermMap.set(variantKey, { entry, isVariant: true });
    }
  }
}

const publicTermPattern = [...publicTermMap.keys()]
  .sort((left, right) => right.length - left.length)
  .map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");

const publicTermRegex = new RegExp(publicTermPattern, "giu");

function isWordCharacter(value: string | undefined) {
  return Boolean(value && /[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]/u.test(value));
}

function buildId(
  ruleId: string,
  paragraphIndex: number,
  start: number,
  original: string,
) {
  return `${ruleId}:${paragraphIndex}:${start}:${original}`;
}

function findPatternRules(paragraph: string, paragraphIndex: number) {
  const findings: Finding[] = [];

  for (const rule of patternRules) {
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    for (const match of paragraph.matchAll(regex)) {
      const start = match.index ?? 0;
      const original = match[0];
      const replacement =
        typeof rule.replacement === "function"
          ? rule.replacement(original, match.slice(1))
          : rule.replacement;

      findings.push({
        id: buildId(rule.id, paragraphIndex, start, original),
        ruleId: rule.id,
        paragraphIndex,
        start,
        end: start + original.length,
        original,
        replacement,
        category: rule.category,
        confidence: rule.confidence,
        severity: rule.severity,
        reason: rule.reason,
        sourceLabel: "국립국어원 어문 규범 기반 내장 규칙",
        sourceUrl: KOREAN_RULES_URL,
        safe: rule.safe,
      });
    }
  }

  return findings;
}

function findPublicLanguage(paragraph: string, paragraphIndex: number) {
  const findings: Finding[] = [];
  const regex = new RegExp(publicTermRegex.source, publicTermRegex.flags);

  for (const match of paragraph.matchAll(regex)) {
    const start = match.index ?? 0;
    const original = match[0];
    const before = paragraph[start - 1];
    const after = paragraph[start + original.length];
    if (isWordCharacter(before) || isWordCharacter(after)) continue;

    const found = publicTermMap.get(original.toLocaleLowerCase("ko-KR"));
    if (!found) continue;

    const replacement = found.entry.alternatives[0] ?? null;
    const ruleId = `public-language-${found.entry.serial}`;
    findings.push({
      id: buildId(ruleId, paragraphIndex, start, original),
      ruleId,
      paragraphIndex,
      start,
      end: start + original.length,
      original,
      replacement,
      alternatives: found.entry.alternatives,
      category: "공공언어",
      confidence: found.isVariant ? "높음" : "검토",
      severity: found.isVariant ? "오류" : "권고",
      reason: found.isVariant
        ? `국립국어원 목록의 이표기·오표기입니다. ‘${found.entry.term}’에 제시된 쉬운 말을 확인하세요.`
        : "국립국어원이 제안한 쉬운 공공언어 대체어가 있습니다. 문맥에 맞는 표현을 선택하세요.",
      sourceLabel: `${publicLanguageData.source.title} ${publicLanguageData.source.snapshot}`,
      sourceUrl: PUBLIC_LANGUAGE_URL,
      safe: false,
    });
  }

  return findings;
}

function findLongSentences(paragraph: string, paragraphIndex: number) {
  const findings: Finding[] = [];
  const sentenceRegex = /[^.!?]+[.!?]?/g;

  for (const match of paragraph.matchAll(sentenceRegex)) {
    const sentence = match[0].trim();
    if (sentence.length < 100) continue;
    const matchStart = match.index ?? 0;
    const leadingSpace = match[0].indexOf(sentence);
    const start = matchStart + Math.max(0, leadingSpace);
    const markerStart = Math.max(start, start + sentence.length - 1);
    const original = paragraph.slice(markerStart, markerStart + 1) || sentence.slice(-1);

    findings.push({
      id: buildId("sentence-too-long", paragraphIndex, markerStart, original),
      ruleId: "sentence-too-long",
      paragraphIndex,
      start: markerStart,
      end: markerStart + original.length,
      original,
      replacement: null,
      category: "문장",
      confidence: "검토",
      severity: "권고",
      reason: `이 문장은 ${sentence.length}자입니다. 한 문장에 한 가지 핵심만 남기도록 나눠 보세요.`,
      sourceLabel: "공공문서 가독성 내장 규칙",
      safe: false,
    });
  }

  return findings;
}

function findPlaceholders(paragraph: string, paragraphIndex: number) {
  const findings: Finding[] = [];
  const regex = /\b(?:TBD|TODO)\b|[○△□]{2,}|추후\s*(?:작성|입력|확정)/giu;

  for (const match of paragraph.matchAll(regex)) {
    const start = match.index ?? 0;
    const original = match[0];
    findings.push({
      id: buildId("document-placeholder", paragraphIndex, start, original),
      ruleId: "document-placeholder",
      paragraphIndex,
      start,
      end: start + original.length,
      original,
      replacement: null,
      category: "문장",
      confidence: "검토",
      severity: "권고",
      reason: "배포 전 남아 있는 임시 표기인지 확인하세요.",
      sourceLabel: "문서 완결성 내장 규칙",
      safe: false,
    });
  }

  return findings;
}

const categoryPriority: Record<FindingCategory, number> = {
  맞춤법: 0,
  띄어쓰기: 1,
  표기: 2,
  공공언어: 3,
  문장: 4,
};

function removeOverlaps(findings: Finding[]) {
  const accepted: Finding[] = [];
  const sorted = [...findings].sort(
    (left, right) =>
      left.start - right.start ||
      categoryPriority[left.category] - categoryPriority[right.category] ||
      right.end - right.start - (left.end - left.start),
  );

  for (const finding of sorted) {
    const overlaps = accepted.some(
      (current) =>
        current.paragraphIndex === finding.paragraphIndex &&
        finding.start < current.end &&
        finding.end > current.start,
    );
    if (!overlaps) accepted.push(finding);
  }

  return accepted;
}

export function analyzeParagraphs(
  paragraphs: string[],
  ignoredIds: ReadonlySet<string> = new Set(),
) {
  const findings = paragraphs.flatMap((paragraph, paragraphIndex) =>
    removeOverlaps([
      ...findPatternRules(paragraph, paragraphIndex),
      ...findPublicLanguage(paragraph, paragraphIndex),
      ...findLongSentences(paragraph, paragraphIndex),
      ...findPlaceholders(paragraph, paragraphIndex),
    ]),
  );

  return findings
    .filter(
      (finding) =>
        !ignoredIds.has(finding.id) &&
        !ignoredIds.has(findingIgnoreKey(finding)),
    )
    .sort(
      (left, right) =>
        left.paragraphIndex - right.paragraphIndex ||
        left.start - right.start ||
        categoryPriority[left.category] - categoryPriority[right.category],
    );
}

export function findingIgnoreKey(finding: Finding) {
  return `${finding.ruleId}:${finding.paragraphIndex}:${finding.original}`;
}

export const publicLanguageSource = publicLanguageData.source;
export const publicLanguageEntryCount = publicLanguageData.entries.length;
