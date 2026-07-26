import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const projectRoot = path.resolve(import.meta.dirname, "..");
const assetDir = path.join(projectRoot, "public", "threads");
const width = 1080;
const height = 1350;
const fontFamily = "'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif";

await mkdir(assetDir, { recursive: true });

const source = (name) => path.join(assetDir, name);
const output = (name) => path.join(assetDir, name);

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function lines({
  values,
  x,
  y,
  size,
  lineHeight = 1.24,
  fill = "#183047",
  weight = 800,
  anchor = "start",
  stroke = "none",
  strokeWidth = 0,
}) {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}"
    font-family="${fontFamily}" font-size="${size}" font-weight="${weight}"
    fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"
    paint-order="stroke fill" letter-spacing="-1.5">
    ${values
      .map(
        (value, index) =>
          `<tspan x="${x}" dy="${index === 0 ? 0 : size * lineHeight}">${escapeXml(value)}</tspan>`,
      )
      .join("")}
  </text>`;
}

function svg(content) {
  return Buffer.from(
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"
      xmlns="http://www.w3.org/2000/svg">${content}</svg>`,
  );
}

function commonHeader(number, kicker) {
  return `
    <rect x="62" y="52" width="340" height="52" rx="26" fill="#183047"/>
    <circle cx="91" cy="78" r="18" fill="#d8674c"/>
    <text x="91" y="86" text-anchor="middle" font-family="${fontFamily}"
      font-size="20" font-weight="900" fill="#fff8ed">냥</text>
    <text x="121" y="85" font-family="${fontFamily}" font-size="22"
      font-weight="800" fill="#fff8ed">${escapeXml(kicker)}</text>
    <text x="1018" y="88" text-anchor="end" font-family="${fontFamily}"
      font-size="22" font-weight="800" fill="#183047">${number}/5</text>
  `;
}

async function illustratedSlide({
  background,
  file,
  overlay,
  position = "centre",
}) {
  const base = await sharp(source(background))
    .resize(width, height, { fit: "cover", position })
    .jpeg({ quality: 91, chromaSubsampling: "4:4:4" })
    .toBuffer();

  await sharp(base)
    .composite([{ input: svg(overlay), left: 0, top: 0 }])
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toFile(output(file));
}

await illustratedSlide({
  background: "source-01-cat-cover.png",
  file: "threads-01-cover.jpg",
  position: "centre",
  overlay: `
    <rect width="1080" height="330" fill="#fff8ed" fill-opacity="0.94"/>
    ${commonHeader(1, "고양이 주무관의 문서 검수")}
    ${lines({
      values: ["100쪽 가이드,", "이제 눈으로 다 보지 마세요"],
      x: 62,
      y: 169,
      size: 58,
    })}
    ${lines({
      values: ["오탈자 하나 찾다가", "퇴근이 늦어진다냥…"],
      x: 317,
      y: 434,
      size: 34,
      lineHeight: 1.3,
      anchor: "middle",
      weight: 750,
    })}
    <rect x="54" y="1255" width="972" height="66" rx="20" fill="#183047" fill-opacity="0.94"/>
    <text x="540" y="1298" text-anchor="middle" font-family="${fontFamily}"
      font-size="30" font-weight="800" fill="#fff8ed">공공AX 로컬 시리즈 2 - 문서 검수</text>
  `,
});

await illustratedSlide({
  background: "source-02-cat-problem.png",
  file: "threads-02-problem.jpg",
  position: "centre",
  overlay: `
    <rect width="1080" height="252" fill="#fff8ed" fill-opacity="0.94"/>
    ${commonHeader(2, "문제는 문서 안에 숨어 있다")}
    ${lines({
      values: ["맞춤법만 보면 끝일까?"],
      x: 62,
      y: 176,
      size: 58,
    })}
    ${lines({
      values: ["띄어쓰기, 문장부호,", "공공언어까지 숨어 있다냥."],
      x: 792,
      y: 360,
      size: 33,
      lineHeight: 1.35,
      anchor: "middle",
      weight: 750,
    })}
    ${lines({
      values: ["100쪽 × 줄줄이 검사", "= 눈 빠짐"],
      x: 209,
      y: 930,
      size: 22,
      lineHeight: 1.35,
      anchor: "middle",
      weight: 800,
    })}
    <rect x="54" y="1265" width="520" height="54" rx="18" fill="#d8674c"/>
    <text x="314" y="1301" text-anchor="middle" font-family="${fontFamily}"
      font-size="25" font-weight="800" fill="#fff8ed">오류 위치를 먼저 좁히는 게 핵심</text>
  `,
});

await illustratedSlide({
  background: "source-03-cat-solution.png",
  file: "threads-03-solution.jpg",
  position: "centre",
  overlay: `
    <rect width="1080" height="270" fill="#fff8ed" fill-opacity="0.95"/>
    ${commonHeader(3, "로컬에서 읽고 근거와 함께 검수")}
    ${lines({
      values: ["문서는 PC 밖으로", "나가지 않습니다"],
      x: 62,
      y: 165,
      size: 55,
      lineHeight: 1.12,
    })}
    ${lines({
      values: ["HWP·HWPX·DOCX·TXT를", "로컬에서 바로 검사한다냥!"],
      x: 275,
      y: 392,
      size: 30,
      lineHeight: 1.35,
      anchor: "middle",
      weight: 750,
    })}
    <rect x="58" y="1213" width="230" height="58" rx="29" fill="#d8674c"/>
    <rect x="307" y="1213" width="230" height="58" rx="29" fill="#28776f"/>
    <rect x="556" y="1213" width="230" height="58" rx="29" fill="#dca72f"/>
    <text x="173" y="1251" text-anchor="middle" font-family="${fontFamily}" font-size="25" font-weight="850" fill="#fff">형광펜</text>
    <text x="422" y="1251" text-anchor="middle" font-family="${fontFamily}" font-size="25" font-weight="850" fill="#fff">분류 필터</text>
    <text x="671" y="1251" text-anchor="middle" font-family="${fontFamily}" font-size="25" font-weight="850" fill="#183047">전후 비교</text>
    <rect x="806" y="1213" width="220" height="58" rx="18" fill="#183047"/>
    <text x="916" y="1238" text-anchor="middle" font-family="${fontFamily}" font-size="18" font-weight="800" fill="#fff8ed">외부 파일 업로드</text>
    <text x="916" y="1261" text-anchor="middle" font-family="${fontFamily}" font-size="18" font-weight="800" fill="#fff8ed">API 없음</text>
  `,
});

const catAvatar = await sharp(source("source-03-cat-solution.png"))
  .extract({ left: 25, top: 735, width: 500, height: 500 })
  .resize(210, 210, { fit: "cover" })
  .composite([
    {
      input: Buffer.from(
        `<svg width="210" height="210"><circle cx="105" cy="105" r="102" fill="white"/></svg>`,
      ),
      blend: "dest-in",
    },
  ])
  .png()
  .toBuffer();

const overview = await sharp(source("actual-app-overview.png"))
  .resize(940, 653, { fit: "cover" })
  .png()
  .toBuffer();

const spellingZoom = await sharp(source("actual-app-spelling-filter.png"))
  .extract({ left: 275, top: 180, width: 1120, height: 760 })
  .resize(835, 566, { fit: "cover" })
  .png()
  .toBuffer();

await sharp({
  create: {
    width,
    height,
    channels: 4,
    background: "#f5efe4",
  },
})
  .composite([
    {
      input: svg(`
        <rect width="1080" height="1350" fill="#f5efe4"/>
        <rect x="0" y="0" width="1080" height="232" fill="#183047"/>
        <rect x="58" y="45" width="295" height="48" rx="24" fill="#d8674c"/>
        <text x="205" y="78" text-anchor="middle" font-family="${fontFamily}"
          font-size="21" font-weight="850" fill="#fff8ed">실제 구동 화면</text>
        <text x="1018" y="79" text-anchor="end" font-family="${fontFamily}"
          font-size="22" font-weight="800" fill="#fff8ed">4/5</text>
        ${lines({
          values: ["‘맞춤법’만 누르면", "원문과 결과가 같이 좁혀집니다"],
          x: 58,
          y: 142,
          size: 43,
          lineHeight: 1.16,
          fill: "#fff8ed",
        })}
        <rect x="48" y="256" width="984" height="697" rx="24" fill="#fff" stroke="#183047" stroke-width="5"/>
        <rect x="161" y="744" width="871" height="604" rx="24" fill="#fff" stroke="#d8674c" stroke-width="7"/>
        <rect x="53" y="970" width="302" height="218" rx="36" fill="#fff8ed" stroke="#183047" stroke-width="4"/>
        <path d="M310 1020 L394 982 L330 1066 Z" fill="#fff8ed" stroke="#183047" stroke-width="4"/>
        ${lines({
          values: ["전체 9건에서", "맞춤법 1건으로!", "이게 진짜 화면이다냥."],
          x: 203,
          y: 1016,
          size: 25,
          lineHeight: 1.34,
          anchor: "middle",
          weight: 800,
        })}
        <rect x="540" y="1267" width="492" height="54" rx="20" fill="#28776f"/>
        <text x="786" y="1303" text-anchor="middle" font-family="${fontFamily}"
          font-size="23" font-weight="850" fill="#fff">형광펜과 오른쪽 결과가 함께 연동</text>
      `),
      left: 0,
      top: 0,
    },
    { input: overview, left: 70, top: 278 },
    { input: spellingZoom, left: 180, top: 764 },
    {
      input: svg(`
        <rect x="53" y="970" width="302" height="218" rx="36" fill="#fff8ed" stroke="#183047" stroke-width="4"/>
        <path d="M310 1020 L394 982 L330 1066 Z" fill="#fff8ed" stroke="#183047" stroke-width="4"/>
        ${lines({
          values: ["전체 9건에서", "맞춤법 1건으로!", "이게 진짜 화면이다냥."],
          x: 203,
          y: 1016,
          size: 25,
          lineHeight: 1.34,
          anchor: "middle",
          weight: 800,
        })}
      `),
      left: 0,
      top: 0,
    },
    { input: catAvatar, left: 45, top: 1122 },
    {
      input: svg(`
        <rect x="540" y="1267" width="492" height="54" rx="20" fill="#28776f"/>
        <text x="786" y="1303" text-anchor="middle" font-family="${fontFamily}"
          font-size="23" font-weight="850" fill="#fff">형광펜과 오른쪽 결과가 함께 연동</text>
      `),
      left: 0,
      top: 0,
    },
  ])
  .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
  .toFile(output("threads-04-actual-screen.jpg"));

await illustratedSlide({
  background: "source-05-cat-result.png",
  file: "threads-05-result.jpg",
  position: "centre",
  overlay: `
    <rect width="1080" height="300" fill="#fff8ed" fill-opacity="0.95"/>
    ${commonHeader(5, "마지막 판단은 사람이")}
    ${lines({
      values: ["AI가 다 고치는 앱은 아닙니다"],
      x: 62,
      y: 172,
      size: 54,
    })}
    ${lines({
      values: ["확실한 건 빠르게,", "문맥 판단은 사람이 끝낸다냥."],
      x: 803,
      y: 555,
      size: 29,
      lineHeight: 1.35,
      anchor: "middle",
      weight: 750,
    })}
    <rect x="42" y="1198" width="996" height="124" rx="28" fill="#183047" fill-opacity="0.96"/>
    <text x="540" y="1244" text-anchor="middle" font-family="${fontFamily}"
      font-size="26" font-weight="850" fill="#fff8ed">Windows EXE 하나로 실행 · GitHub 공개 배포</text>
    <text x="540" y="1287" text-anchor="middle" font-family="${fontFamily}"
      font-size="25" font-weight="750" fill="#76c9bd">github.com/obundh/gonggong-ax-local</text>
  `,
});

console.log(`Threads comic created in ${assetDir}`);
