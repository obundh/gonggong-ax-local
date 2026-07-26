import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const projectRoot = path.resolve(import.meta.dirname, "..");
const assetDir = path.join(projectRoot, "public", "threads");
const width = 1080;
const height = 1350;
const fontFamily = "'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif";

const colors = {
  navy: "#163047",
  navyDeep: "#0D2233",
  cream: "#FFF8E9",
  paper: "#F7EEDB",
  coral: "#EF6B5B",
  mint: "#79C5B2",
  yellow: "#F5C95B",
  ink: "#183047",
  white: "#FFFFFF",
};

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
  fill = colors.ink,
  weight = 800,
  anchor = "start",
  stroke = "none",
  strokeWidth = 0,
  letterSpacing = -1.4,
}) {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}"
    font-family="${fontFamily}" font-size="${size}" font-weight="${weight}"
    fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"
    paint-order="stroke fill" letter-spacing="${letterSpacing}">
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
      xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#0D2233" flood-opacity=".25"/>
        </filter>
        <pattern id="grid" width="42" height="42" patternUnits="userSpaceOnUse">
          <path d="M42 0H0V42" fill="none" stroke="#79C5B2" stroke-opacity=".12" stroke-width="2"/>
        </pattern>
      </defs>
      ${content}
    </svg>`,
  );
}

function paw(x, y, scale = 1, fill = colors.coral) {
  return `
    <g transform="translate(${x} ${y}) scale(${scale})" fill="${fill}">
      <ellipse cx="0" cy="16" rx="18" ry="15"/>
      <circle cx="-19" cy="-5" r="8"/>
      <circle cx="-6" cy="-15" r="8"/>
      <circle cx="9" cy="-15" r="8"/>
      <circle cx="22" cy="-4" r="8"/>
    </g>
  `;
}

function caseHeader(number, label, { dark = false } = {}) {
  const foreground = dark ? colors.cream : colors.navy;
  return `
    <g transform="rotate(-2 54 61)">
      <rect x="52" y="48" width="360" height="60" rx="8" fill="${colors.coral}"/>
      <text x="91" y="88" font-family="${fontFamily}" font-size="22" font-weight="900"
        fill="${colors.white}">문서 수사대</text>
      <text x="390" y="88" text-anchor="end" font-family="${fontFamily}" font-size="19"
        font-weight="800" fill="${colors.navyDeep}">CASE 001</text>
    </g>
    ${paw(450, 72, 0.72, colors.mint)}
    <text x="1019" y="78" text-anchor="end" font-family="${fontFamily}" font-size="23"
      font-weight="900" fill="${foreground}">${number}/5</text>
    <text x="1019" y="105" text-anchor="end" font-family="${fontFamily}" font-size="18"
      font-weight="750" fill="${foreground}" opacity=".82">${escapeXml(label)}</text>
  `;
}

function speechBubble({
  x,
  y,
  width: bubbleWidth,
  height: bubbleHeight,
  tail = "",
  text,
  textX,
  textY,
  size = 32,
  lineHeight = 1.32,
  fill = colors.cream,
  stroke = colors.navy,
}) {
  return `
    <g filter="url(#shadow)">
      ${tail}
      <rect x="${x}" y="${y}" width="${bubbleWidth}" height="${bubbleHeight}" rx="42"
        fill="${fill}" stroke="${stroke}" stroke-width="6"/>
    </g>
    ${lines({
      values: text,
      x: textX,
      y: textY,
      size,
      lineHeight,
      weight: 800,
    })}
  `;
}

function evidenceTape(text, { y = 1222, fill = colors.yellow, textFill = colors.navy } = {}) {
  return `
    <g transform="rotate(-1.3 540 ${y + 43})" filter="url(#shadow)">
      <rect x="41" y="${y}" width="998" height="86" rx="8" fill="${fill}"/>
      <path d="M41 ${y + 14}H1039M41 ${y + 72}H1039" stroke="${colors.navy}" stroke-width="3"
        stroke-dasharray="16 12" opacity=".42"/>
      <text x="540" y="${y + 56}" text-anchor="middle" font-family="${fontFamily}"
        font-size="27" font-weight="900" fill="${textFill}" letter-spacing="-1">${escapeXml(text)}</text>
    </g>
  `;
}

async function imageBase(background, { position = "centre", blur = 0 } = {}) {
  let pipeline = sharp(source(background)).resize(width, height, {
    fit: "cover",
    position,
  });
  if (blur > 0) {
    pipeline = pipeline.blur(blur);
  }
  return pipeline.jpeg({ quality: 92, chromaSubsampling: "4:4:4" }).toBuffer();
}

async function illustratedSlide({ background, file, overlay, position = "centre" }) {
  const base = await imageBase(background, { position });
  await sharp(base)
    .composite([{ input: svg(overlay), left: 0, top: 0 }])
    .jpeg({ quality: 93, chromaSubsampling: "4:4:4" })
    .toFile(output(file));
}

await illustratedSlide({
  background: "source-v2-01-kitten-cover.png",
  file: "threads-01-cover.jpg",
  position: "bottom",
  overlay: `
    <rect width="${width}" height="${height}" fill="none" stroke="${colors.navy}" stroke-width="28"/>
    <rect x="28" y="28" width="1024" height="290" rx="28" fill="${colors.navy}" fill-opacity=".97"/>
    ${caseHeader(1, "최초 상황 분석", { dark: true })}
    ${lines({
      values: ["100쪽 가이드에서", "오류를 찾아라!"],
      x: 58,
      y: 173,
      size: 49,
      lineHeight: 1.12,
      fill: colors.cream,
      weight: 900,
    })}
    ${speechBubble({
      x: 52,
      y: 318,
      width: 700,
      height: 380,
      tail: `<path d="M634 672 L758 748 L704 644 Z" fill="${colors.cream}" stroke="${colors.navy}" stroke-width="6" stroke-linejoin="round"/>`,
      text: [
        "문제는 세 가지다냥.",
        "① 분량이 너무 많고",
        "② 오류 위치를 모르고",
        "③ 종류별로 다시 봐야 한다냥.",
      ],
      textX: 96,
      textY: 390,
      size: 34,
      lineHeight: 1.46,
    })}
    <g transform="rotate(7 890 365)">
      <rect x="794" y="322" width="198" height="90" rx="10" fill="${colors.mint}"
        stroke="${colors.navy}" stroke-width="4"/>
      <text x="893" y="358" text-anchor="middle" font-family="${fontFamily}" font-size="18"
        font-weight="800" fill="${colors.navy}">최초 진술</text>
      <text x="893" y="389" text-anchor="middle" font-family="${fontFamily}" font-size="25"
        font-weight="900" fill="${colors.navy}">검수 난항</text>
    </g>
    ${evidenceTape("맞춤법 · 띄어쓰기 · 문장부호 · 공공언어")}
  `,
});

await illustratedSlide({
  background: "source-v2-02-kitten-problem.png",
  file: "threads-02-problem.jpg",
  position: "bottom",
  overlay: `
    <rect width="${width}" height="${height}" fill="none" stroke="${colors.navy}" stroke-width="28"/>
    <rect x="28" y="28" width="1024" height="210" rx="28" fill="${colors.navy}" fill-opacity=".97"/>
    ${caseHeader(2, "현장 감식", { dark: true })}
    ${lines({
      values: ["맞춤법만 찾으면 검수가 끝날까?"],
      x: 58,
      y: 183,
      size: 43,
      fill: colors.cream,
      weight: 900,
    })}
    ${speechBubble({
      x: 68,
      y: 265,
      width: 866,
      height: 306,
      tail: `<path d="M704 548 L778 626 L812 531 Z" fill="${colors.cream}" stroke="${colors.navy}" stroke-width="6" stroke-linejoin="round"/>`,
      text: [
        "아니다냥!  ‘할수’는 띄어쓰기,",
        "‘않됩니다’는 맞춤법,",
        "‘금일’은 공공언어다냥.",
      ],
      textX: 112,
      textY: 340,
      size: 35,
      lineHeight: 1.45,
    })}
    ${lines({
      values: ["한 종류만 보면", "또 놓친다냥!"],
      x: 207,
      y: 987,
      size: 23,
      lineHeight: 1.35,
      anchor: "middle",
      weight: 900,
    })}
    <g transform="rotate(-3 315 1147)" filter="url(#shadow)">
      <rect x="55" y="1095" width="590" height="112" rx="14" fill="${colors.cream}"
        stroke="${colors.coral}" stroke-width="6"/>
      <text x="83" y="1132" font-family="${fontFamily}" font-size="18" font-weight="900"
        fill="${colors.coral}">증거물 A</text>
      <text x="83" y="1173" font-family="${fontFamily}" font-size="28" font-weight="900"
        fill="${colors.navy}">같은 문서 안에서도 문제 종류가 다름</text>
      ${paw(598, 1146, 0.65, colors.coral)}
    </g>
    ${evidenceTape("오류 위치 + 오류 종류를 함께 좁혀야 한다", {
      y: 1232,
      fill: colors.coral,
      textFill: colors.white,
    })}
  `,
});

await illustratedSlide({
  background: "source-v2-03-kitten-solution.png",
  file: "threads-03-solution.jpg",
  position: "bottom",
  overlay: `
    <rect width="${width}" height="${height}" fill="none" stroke="${colors.navy}" stroke-width="28"/>
    <rect x="28" y="28" width="1024" height="242" rx="28" fill="${colors.navy}" fill-opacity=".97"/>
    ${caseHeader(3, "로컬 감식실", { dark: true })}
    ${lines({
      values: ["문서는 PC 밖으로 보내지 않는다"],
      x: 58,
      y: 183,
      size: 44,
      fill: colors.cream,
      weight: 900,
    })}
    ${speechBubble({
      x: 48,
      y: 270,
      width: 560,
      height: 342,
      tail: `<path d="M410 585 L440 680 L503 580 Z" fill="${colors.cream}" stroke="${colors.navy}" stroke-width="6" stroke-linejoin="round"/>`,
      text: [
        "HWP·HWPX·DOCX·TXT를",
        "PC 안에서 읽고,",
        "오류별 형광펜을",
        "칠한다냥.",
      ],
      textX: 82,
      textY: 335,
      size: 31,
      lineHeight: 1.42,
    })}
    <g filter="url(#shadow)">
      <rect x="46" y="1190" width="232" height="72" rx="36" fill="${colors.coral}"/>
      <rect x="297" y="1190" width="232" height="72" rx="36" fill="${colors.mint}"/>
      <rect x="548" y="1190" width="232" height="72" rx="36" fill="${colors.yellow}"/>
      <rect x="799" y="1190" width="235" height="72" rx="36" fill="${colors.navy}"/>
    </g>
    <text x="162" y="1236" text-anchor="middle" font-family="${fontFamily}" font-size="25"
      font-weight="900" fill="${colors.white}">형광펜</text>
    <text x="413" y="1236" text-anchor="middle" font-family="${fontFamily}" font-size="25"
      font-weight="900" fill="${colors.navy}">분류 필터</text>
    <text x="664" y="1236" text-anchor="middle" font-family="${fontFamily}" font-size="25"
      font-weight="900" fill="${colors.navy}">전후 비교</text>
    <text x="916" y="1226" text-anchor="middle" font-family="${fontFamily}" font-size="19"
      font-weight="900" fill="${colors.white}">외부 업로드</text>
    <text x="916" y="1250" text-anchor="middle" font-family="${fontFamily}" font-size="19"
      font-weight="900" fill="${colors.mint}">없음</text>
    <text x="1018" y="1313" text-anchor="end" font-family="${fontFamily}" font-size="20"
      font-weight="800" fill="${colors.navy}">공공AX 로컬 시리즈 2 - 문서 검수</text>
  `,
});

const kittenAvatar = await sharp(source("source-v2-03-kitten-solution.png"))
  .extract({ left: 0, top: 680, width: 620, height: 620 })
  .resize(250, 250, { fit: "cover" })
  .composite([
    {
      input: Buffer.from(
        `<svg width="250" height="250"><circle cx="125" cy="125" r="119" fill="white"/></svg>`,
      ),
      blend: "dest-in",
    },
  ])
  .png()
  .toBuffer();

const overview = await sharp(source("actual-app-overview.png"))
  .resize(925, 643, { fit: "cover" })
  .png()
  .toBuffer();

const spellingZoom = await sharp(source("actual-app-spelling-filter.png"))
  .extract({ left: 260, top: 154, width: 1140, height: 780 })
  .resize(600, 411, { fit: "cover" })
  .png()
  .toBuffer();

await sharp({
  create: {
    width,
    height,
    channels: 4,
    background: colors.navyDeep,
  },
})
  .composite([
    {
      input: svg(`
        <rect width="${width}" height="${height}" fill="${colors.navyDeep}"/>
        <rect width="${width}" height="${height}" fill="url(#grid)"/>
        <rect x="28" y="28" width="1024" height="1294" rx="30" fill="none"
          stroke="${colors.cream}" stroke-width="4" stroke-dasharray="16 12"/>
        ${caseHeader(4, "증거 화면", { dark: true })}
        ${lines({
          values: ["‘맞춤법’만 선택했더니"],
          x: 54,
          y: 175,
          size: 48,
          fill: colors.cream,
          weight: 900,
        })}
        <rect x="52" y="226" width="976" height="690" rx="26" fill="${colors.cream}"
          stroke="${colors.coral}" stroke-width="7" filter="url(#shadow)"/>
        <rect x="55" y="931" width="632" height="355" rx="26" fill="${colors.cream}"
          stroke="${colors.mint}" stroke-width="7" filter="url(#shadow)"/>
        <g transform="rotate(2 887 940)">
          <rect x="775" y="905" width="230" height="62" rx="8" fill="${colors.yellow}"/>
          <text x="890" y="945" text-anchor="middle" font-family="${fontFamily}"
            font-size="22" font-weight="900" fill="${colors.navy}">증거물 B · 실제 화면</text>
        </g>
      `),
      left: 0,
      top: 0,
    },
    { input: overview, left: 77, top: 250 },
    { input: spellingZoom, left: 72, top: 950 },
    { input: kittenAvatar, left: 785, top: 1034 },
    {
      input: svg(`
        ${speechBubble({
          x: 650,
          y: 715,
          width: 370,
          height: 248,
          tail: `<path d="M882 932 L870 1038 L954 936 Z" fill="${colors.cream}" stroke="${colors.navy}" stroke-width="6" stroke-linejoin="round"/>`,
          text: [
            "전체 9건 →",
            "맞춤법 1건!",
            "원문과 결과가",
            "같이 좁혀졌다냥.",
          ],
          textX: 685,
          textY: 771,
          size: 27,
          lineHeight: 1.34,
        })}
        <rect x="703" y="1247" width="329" height="52" rx="12" fill="${colors.coral}"/>
        <text x="868" y="1281" text-anchor="middle" font-family="${fontFamily}" font-size="19"
          font-weight="900" fill="${colors.white}">localhost 실제 구동 화면</text>
      `),
      left: 0,
      top: 0,
    },
  ])
  .jpeg({ quality: 93, chromaSubsampling: "4:4:4" })
  .toFile(output("threads-04-actual-screen.jpg"));

const kittenSticker = await sharp(source("source-v2-03-kitten-solution.png"))
  .extract({ left: 0, top: 710, width: 650, height: 760 })
  .resize(410, 480, { fit: "cover" })
  .composite([
    {
      input: Buffer.from(
        `<svg width="410" height="480"><rect x="8" y="8" width="394" height="464" rx="58" fill="white"/></svg>`,
      ),
      blend: "dest-in",
    },
  ])
  .png()
  .toBuffer();

await sharp({
  create: {
    width,
    height,
    channels: 4,
    background: colors.navyDeep,
  },
})
  .composite([
    {
      input: svg(`
        <rect width="${width}" height="${height}" fill="${colors.navyDeep}"/>
        <rect width="${width}" height="${height}" fill="url(#grid)"/>
        <g transform="rotate(-1 540 677)" filter="url(#shadow)">
          <path d="M48 155H365L420 102H1032V1248H48Z" fill="${colors.paper}"/>
          <rect x="48" y="155" width="984" height="1093" rx="22" fill="none"
            stroke="${colors.cream}" stroke-width="5"/>
        </g>
        ${caseHeader(5, "사건 종결", { dark: true })}
        <g transform="rotate(-1 540 220)">
          <rect x="84" y="138" width="912" height="171" rx="18" fill="${colors.navy}"/>
          ${lines({
            values: ["자동 수정과 사람 판단을 분리"],
            x: 540,
            y: 238,
            size: 47,
            anchor: "middle",
            fill: colors.cream,
            weight: 900,
          })}
        </g>
        <g transform="rotate(3 218 400)">
          <rect x="86" y="340" width="264" height="119" rx="14" fill="${colors.yellow}"
            stroke="${colors.navy}" stroke-width="5"/>
          <text x="218" y="382" text-anchor="middle" font-family="${fontFamily}" font-size="19"
            font-weight="900" fill="${colors.coral}">판정 원칙</text>
          <text x="218" y="423" text-anchor="middle" font-family="${fontFamily}" font-size="29"
            font-weight="900" fill="${colors.navy}">확실성과 문맥</text>
          ${paw(321, 402, 0.54, colors.coral)}
        </g>
        ${speechBubble({
          x: 425,
          y: 365,
          width: 565,
          height: 330,
          tail: `<path d="M488 665 L363 764 L560 681 Z" fill="${colors.cream}" stroke="${colors.navy}" stroke-width="6" stroke-linejoin="round"/>`,
          text: [
            "확실한 오류는",
            "빠르게 고치고,",
            "문맥이 필요한 표현은",
            "담당자가 끝까지 본다냥.",
          ],
          textX: 468,
          textY: 429,
          size: 31,
          lineHeight: 1.43,
        })}
        <g transform="rotate(-2 757 860)">
          <rect x="512" y="760" width="480" height="207" rx="18" fill="${colors.mint}"
            stroke="${colors.navy}" stroke-width="5"/>
          <circle cx="575" cy="825" r="35" fill="${colors.navy}"/>
          <path d="M558 825L571 839L594 810" fill="none" stroke="${colors.cream}"
            stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
          <text x="630" y="823" font-family="${fontFamily}" font-size="22" font-weight="900"
            fill="${colors.navy}">확실한 오류</text>
          <text x="630" y="853" font-family="${fontFamily}" font-size="20" font-weight="800"
            fill="${colors.navy}">자동 수정 후보</text>
          <circle cx="575" cy="910" r="35" fill="${colors.coral}"/>
          <text x="575" y="921" text-anchor="middle" font-family="${fontFamily}" font-size="30"
            font-weight="900" fill="${colors.white}">?</text>
          <text x="630" y="907" font-family="${fontFamily}" font-size="22" font-weight="900"
            fill="${colors.navy}">문맥 표현</text>
          <text x="630" y="937" font-family="${fontFamily}" font-size="20" font-weight="800"
            fill="${colors.navy}">담당자 최종 판단</text>
        </g>
        <rect x="55" y="1150" width="970" height="139" rx="24" fill="${colors.navy}"/>
        <text x="540" y="1200" text-anchor="middle" font-family="${fontFamily}" font-size="27"
          font-weight="900" fill="${colors.cream}">Windows EXE 하나로 실행</text>
        <text x="540" y="1248" text-anchor="middle" font-family="${fontFamily}" font-size="24"
          font-weight="800" fill="${colors.mint}">github.com/obundh/gonggong-ax-local-2</text>
      `),
      left: 0,
      top: 0,
    },
    { input: kittenSticker, left: 57, top: 668 },
    {
      input: svg(`
        <g transform="rotate(-4 270 1085)">
          <rect x="79" y="1038" width="382" height="94" rx="16" fill="${colors.coral}"
            stroke="${colors.cream}" stroke-width="4"/>
          <text x="270" y="1080" text-anchor="middle" font-family="${fontFamily}" font-size="18"
            font-weight="800" fill="${colors.cream}">CASE 001</text>
          <text x="270" y="1111" text-anchor="middle" font-family="${fontFamily}" font-size="26"
            font-weight="900" fill="${colors.white}">사건 종결 · 검수는 계속</text>
        </g>
      `),
      left: 0,
      top: 0,
    },
  ])
  .jpeg({ quality: 93, chromaSubsampling: "4:4:4" })
  .toFile(output("threads-05-result.jpg"));

console.log(`Document Detectives Threads comic created in ${assetDir}`);
