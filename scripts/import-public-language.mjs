import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function splitList(value) {
  return value
    .split(/[,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

const inputPath = process.argv[2];
const outputPath = process.argv[3] ?? "data/public-language.json";

if (!inputPath) {
  throw new Error(
    "사용법: node scripts/import-public-language.mjs <공식 CSV 경로> [출력 JSON 경로]",
  );
}

const csv = await readFile(resolve(inputPath), "utf8");
const [header, ...records] = parseCsv(csv.replace(/^\uFEFF/, ""));
const indexByName = new Map(header.map((name, index) => [name.trim(), index]));

for (const required of ["연번", "단어_용어", "이표기_오표기", "대안어(안)"]) {
  if (!indexByName.has(required)) {
    throw new Error(`공식 CSV에 '${required}' 열이 없습니다.`);
  }
}

const entries = records
  .map((record) => ({
    serial: Number(record[indexByName.get("연번")]?.trim()),
    term: record[indexByName.get("단어_용어")]?.trim() ?? "",
    variants: splitList(record[indexByName.get("이표기_오표기")] ?? ""),
    alternatives: splitList(record[indexByName.get("대안어(안)")] ?? ""),
  }))
  .filter(
    (entry) =>
      Number.isFinite(entry.serial) &&
      entry.term &&
      entry.alternatives.length > 0,
  );

const payload = {
  source: {
    title: "국립국어원 쉽고 바른 공공언어 쓰기 평가용 용어 목록",
    snapshot: "2024-02-28",
    license: "공공누리 제1유형(출처표시)",
    url: "https://www.data.go.kr/data/15130006/fileData.do",
    importedFrom: basename(inputPath),
  },
  entries,
};

const resolvedOutput = resolve(outputPath);
await mkdir(dirname(resolvedOutput), { recursive: true });
await writeFile(resolvedOutput, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`공공언어 ${entries.length}개 항목을 ${resolvedOutput}에 저장했습니다.`);
